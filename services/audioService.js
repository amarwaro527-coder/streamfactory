const ffmpeg = require('fluent-ffmpeg');
const ffmpegInstaller = require('@ffmpeg-installer/ffmpeg');
const path = require('path');
const fs = require('fs-extra');
const sqlite3 = require('sqlite3').verbose();

// Set FFmpeg path
ffmpeg.setFfmpegPath(ffmpegInstaller.path);

const dbPath = process.env.DATABASE_PATH || './db/streamfactory.db';

class AudioService {
    constructor() {
        this.audioStemsDir = process.env.AUDIO_STEMS_DIR || './audio-stems';
        this.audioOutputDir = process.env.AUDIO_OUTPUT_DIR || './public/audio-output';

        // Ensure output directory exists
        fs.ensureDirSync(this.audioOutputDir);
    }

    /**
     * Get audio stems from database
     */
    async getAudioStems(stemIds = null) {
        return new Promise((resolve, reject) => {
            const db = new sqlite3.Database(dbPath);

            let query = 'SELECT * FROM audio_stems';
            let params = [];

            if (stemIds && stemIds.length > 0) {
                query += ` WHERE id IN (${stemIds.map(() => '?').join(',')})`;
                params = stemIds;
            }

            db.all(query, params, (err, rows) => {
                db.close();
                if (err) return reject(err);
                resolve(rows);
            });
        });
    }

    /**
     * Get audio preset from database
     */
    async getAudioPreset(presetId) {
        return new Promise((resolve, reject) => {
            const db = new sqlite3.Database(dbPath);

            db.get('SELECT * FROM audio_presets WHERE id = ?', [presetId], (err, row) => {
                db.close();
                if (err) return reject(err);

                if (!row) {
                    return reject(new Error(`Preset ${presetId} not found`));
                }

                // Parse stem_configs JSON
                row.stem_configs = JSON.parse(row.stem_configs);
                resolve(row);
            });
        });
    }

    /**
     * Generate random volume drift curve
     * Creates natural-sounding volume variations over time
     */
    generateVolumeCurve(duration, baseVolume, volatility) {
        const points = Math.max(10, Math.floor(duration / 60)); // One point per minute minimum
        const curve = [];

        for (let i = 0; i <= points; i++) {
            const time = (i / points) * duration;
            const randomOffset = (Math.random() - 0.5) * volatility;
            const volume = Math.max(0.1, Math.min(1.0, baseVolume + randomOffset));

            curve.push({ time, volume });
        }

        return curve;
    }

    /**
     * Generate random stereo panning curve
     */
    generatePanCurve(duration, spatialDrift) {
        const points = Math.max(10, Math.floor(duration / 60));
        const curve = [];

        for (let i = 0; i <= points; i++) {
            const time = (i / points) * duration;
            const pan = (Math.random() - 0.5) * 2 * spatialDrift; // -1 to 1

            curve.push({ time, pan });
        }

        return curve;
    }

    /**
     * Build FFmpeg volume filter string from curve
     */
    buildVolumeFilter(curve) {
        const expr = curve.map(point =>
            `between(t,${point.time},${point.time + 1})*${point.volume}`
        ).join('+');

        return `volume='${expr}':eval=frame`;
    }

    /**
     * Build FFmpeg pan filter for stereo positioning
     */
    buildPanFilter(panValue) {
        // Pan value: -1 (full left) to 1 (full right), 0 (center)
        const leftGain = 1 - Math.max(0, panValue);
        const rightGain = 1 + Math.min(0, panValue);

        return `pan=stereo|c0=${leftGain}*c0|c1=${rightGain}*c1`;
    }

    /**
     * Advanced audio generation with complex mixing
     * 
     * @param {Object} config - Audio configuration
     * @param {Array} config.stems - Array of {id, volume} objects
     * @param {number} config.duration - Duration in seconds
     * @param {number} config.volatility - Volume drift randomness (0-1)
     * @param {number} config.density - How many layers to overlap (0-1)
     * @param {number} config.spatialDrift - Stereo panning amount (0-1)
     * @param {Function} progressCallback - Called with progress 0-100
     */
    async generateAudio(config, progressCallback = null) {
        const {
            stems = [],
            duration = 3600, // Default: 1 hour
            volatility = 0.3,
            density = 0.7,
            spatialDrift = 0.5,
            outputName = null
        } = config;

        // Validation
        if (!stems || stems.length === 0) {
            throw new Error('At least one audio stem is required');
        }

        if (stems.length > 10) {
            throw new Error('Maximum 10 audio stems allowed');
        }

        if (duration < 60 || duration > 36000) { // 1 min to 10 hours
            throw new Error('Duration must be between 1 minute and 10 hours');
        }

        console.log(`🎵 Starting audio generation: ${stems.length} stems, ${Math.floor(duration / 60)} minutes`);

        // Get stems from database
        const stemIds = stems.map(s => s.stem_id || s.id);
        const dbStems = await this.getAudioStems(stemIds);

        if (dbStems.length !== stemIds.length) {
            throw new Error('Some audio stems not found in database');
        }

        // Map database stems with config
        const audioStems = dbStems.map(dbStem => {
            const stemConfig = stems.find(s => (s.stem_id || s.id) === dbStem.id);
            return {
                ...dbStem,
                volume: stemConfig.volume || dbStem.default_volume || 0.7
            };
        });

        // Verify audio files exist
        for (const stem of audioStems) {
            const fullPath = path.resolve(stem.file_path);
            if (!fs.existsSync(fullPath)) {
                throw new Error(`Audio file not found: ${stem.file_path}`);
            }
        }

        // Generate output filename
        const timestamp = Date.now();
        const fileName = outputName || `audio_${timestamp}.mp3`;
        const outputPath = path.join(this.audioOutputDir, fileName);

        // Generate volume drift curves
        const volumeCurves = audioStems.map(stem =>
            this.generateVolumeCurve(duration, stem.volume, volatility)
        );

        // Generate stereo panning curves
        const panCurves = audioStems.map(() =>
            this.generatePanCurve(duration, spatialDrift)
        );

        // Build FFmpeg command
        const command = ffmpeg();

        // Add all inputs with infinite loop
        audioStems.forEach(stem => {
            command.input(path.resolve(stem.file_path))
                .inputOptions(['-stream_loop', '-1']); // Infinite loop
        });

        // Build complex filter chains
        const filterChains = [];

        audioStems.forEach((stem, index) => {
            // Get average pan value for this stem
            const avgPan = panCurves[index].reduce((sum, p) => sum + p.pan, 0) / panCurves[index].length;

            // Build filter: volume + pan
            const volumeFilter = this.buildVolumeFilter(volumeCurves[index]);
            const panFilter = this.buildPanFilter(avgPan);

            filterChains.push(
                `[${index}:a]${volumeFilter},${panFilter}[a${index}]`
            );
        });

        // Mix all processed streams
        const mixInput = audioStems.map((_, i) => `[a${i}]`).join('');
        const amixFilter = `${mixInput}amix=inputs=${audioStems.length}:duration=first:dropout_transition=2,dynaudnorm=f=150:g=15[out]`;

        filterChains.push(amixFilter);

        // Execute FFmpeg command
        return new Promise((resolve, reject) => {
            const startTime = Date.now();
            let lastProgress = 0;

            command
                .complexFilter(filterChains, 'out')
                .duration(duration)
                .audioCodec('libmp3lame')
                .audioBitrate('192k')
                .audioChannels(2)
                .audioFrequency(44100)
                .outputOptions([
                    '-max_muxing_queue_size', '1024', // Prevent memory overflow
                    '-loglevel', 'info'
                ])
                .on('start', (cmd) => {
                    console.log('✅ FFmpeg started');
                    console.log('📋 Command:', cmd.substring(0, 200) + '...');

                    if (progressCallback) {
                        progressCallback(0, 'Audio generation started');
                    }
                })
                .on('progress', (progress) => {
                    if (progress.percent) {
                        const currentProgress = Math.floor(progress.percent);

                        // Only report progress every 5%
                        if (currentProgress >= lastProgress + 5) {
                            lastProgress = currentProgress;
                            console.log(`⏳ Progress: ${currentProgress}%`);

                            if (progressCallback) {
                                const timeElapsed = ((Date.now() - startTime) / 1000).toFixed(1);
                                progressCallback(currentProgress, `Processing... (${timeElapsed}s elapsed)`);
                            }
                        }
                    }
                })
                .on('end', () => {
                    const totalTime = ((Date.now() - startTime) / 1000).toFixed(2);
                    console.log(`✅ Audio generation completed in ${totalTime}s`);
                    console.log(`📁 Output: ${outputPath}`);

                    if (progressCallback) {
                        progressCallback(100, 'Audio generation completed');
                    }

                    // Return result with metadata
                    resolve({
                        success: true,
                        outputPath,
                        relativePath: `/audio-output/${fileName}`,
                        duration,
                        stems: audioStems.length,
                        generationTime: parseFloat(totalTime),
                        fileSize: fs.statSync(outputPath).size,
                        fileName
                    });
                })
                .on('error', (err, stdout, stderr) => {
                    console.error('❌ FFmpeg error:', err.message);
                    console.error('📋 FFmpeg stderr:', stderr);

                    if (progressCallback) {
                        progressCallback(0, `Error: ${err.message}`);
                    }

                    // Cleanup failed output
                    if (fs.existsSync(outputPath)) {
                        fs.unlinkSync(outputPath);
                    }

                    reject(new Error(`Audio generation failed: ${err.message}`));
                })
                .save(outputPath);
        });
    }

    /**
     * Generate audio from preset
     */
    async generateFromPreset(presetId, duration, customConfig = {}, progressCallback = null) {
        console.log(`🎨 Generating audio from preset ${presetId}`);

        // Get preset from database
        const preset = await this.getAudioPreset(presetId);

        // Build config from preset
        const config = {
            stems: preset.stem_configs,
            duration,
            volatility: customConfig.volatility || 0.3,
            density: customConfig.density || 0.7,
            spatialDrift: customConfig.spatialDrift || 0.5,
            outputName: customConfig.outputName || `${preset.name.replace(/\s+/g, '_')}_${Date.now()}.mp3`
        };

        return await this.generateAudio(config, progressCallback);
    }

    /**
     * Get all available presets
     */
    async getAllPresets() {
        return new Promise((resolve, reject) => {
            const db = new sqlite3.Database(dbPath);

            db.all('SELECT * FROM audio_presets ORDER BY created_at DESC', (err, rows) => {
                db.close();
                if (err) return reject(err);

                // Parse stem_configs for each preset
                const presets = rows.map(row => ({
                    ...row,
                    stem_configs: JSON.parse(row.stem_configs)
                }));

                resolve(presets);
            });
        });
    }

    /**
     * Get all available stems grouped by category
     */
    async getAllStemsByCategory() {
        return new Promise((resolve, reject) => {
            const db = new sqlite3.Database(dbPath);

            db.all('SELECT * FROM audio_stems ORDER BY category, name', (err, rows) => {
                db.close();
                if (err) return reject(err);

                // Group by category
                const grouped = {};
                rows.forEach(stem => {
                    if (!grouped[stem.category]) {
                        grouped[stem.category] = [];
                    }
                    grouped[stem.category].push(stem);
                });

                resolve(grouped);
            });
        });
    }

    /**
     * Delete generated audio file
     */
    async deleteAudio(fileName) {
        const filePath = path.join(this.audioOutputDir, fileName);

        if (!fs.existsSync(filePath)) {
            throw new Error('Audio file not found');
        }

        await fs.unlink(filePath);
        console.log(`🗑️  Deleted audio file: ${fileName}`);

        return { success: true, message: 'Audio file deleted' };
    }

    /**
     * Get audio file info
     */
    async getAudioInfo(fileName) {
        const filePath = path.join(this.audioOutputDir, fileName);

        if (!fs.existsSync(filePath)) {
            throw new Error('Audio file not found');
        }

        const stats = fs.statSync(filePath);

        return new Promise((resolve, reject) => {
            ffmpeg.ffprobe(filePath, (err, metadata) => {
                if (err) return reject(err);

                resolve({
                    fileName,
                    fileSize: stats.size,
                    duration: metadata.format.duration,
                    bitrate: metadata.format.bit_rate,
                    format: metadata.format.format_name,
                    created: stats.birthtime
                });
            });
        });
    }
}

// Singleton instance
const audioService = new AudioService();

module.exports = audioService;
