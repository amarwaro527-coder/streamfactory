const ffmpeg = require('fluent-ffmpeg');
const ffmpegInstaller = require('@ffmpeg-installer/ffmpeg');
const path = require('path');
const fs = require('fs-extra');
const sqlite3 = require('sqlite3').verbose();
const { v4: uuidv4 } = require('uuid');

// Set FFmpeg path
ffmpeg.setFfmpegPath(ffmpegInstaller.path);

const dbPath = process.env.DATABASE_PATH || './db/streamfactory.db';

class VideoService {
    constructor() {
        this.videoOutputDir = process.env.VIDEO_OUTPUT_DIR || './public/video-output';
        this.tempDir = path.join(this.videoOutputDir, 'temp');

        // Ensure directories exist
        fs.ensureDirSync(this.videoOutputDir);
        fs.ensureDirSync(this.tempDir);
    }

    /**
     * Get video duration using FFprobe
     */
    async getVideoDuration(videoPath) {
        return new Promise((resolve, reject) => {
            ffmpeg.ffprobe(videoPath, (err, metadata) => {
                if (err) {
                    console.error('FFprobe error:', err);
                    return reject(err);
                }
                resolve(metadata.format.duration || 0);
            });
        });
    }

    /**
     * Get video metadata (duration, resolution, codec, etc)
     */
    async getVideoInfo(videoPath) {
        return new Promise((resolve, reject) => {
            ffmpeg.ffprobe(videoPath, (err, metadata) => {
                if (err) return reject(err);

                const videoStream = metadata.streams.find(s => s.codec_type === 'video');
                const audioStream = metadata.streams.find(s => s.codec_type === 'audio');

                resolve({
                    duration: metadata.format.duration,
                    size: metadata.format.size,
                    bitrate: metadata.format.bit_rate,
                    format: metadata.format.format_name,
                    video: videoStream ? {
                        codec: videoStream.codec_name,
                        width: videoStream.width,
                        height: videoStream.height,
                        fps: eval(videoStream.r_frame_rate) // e.g., "30/1" -> 30
                    } : null,
                    audio: audioStream ? {
                        codec: audioStream.codec_name,
                        sampleRate: audioStream.sample_rate,
                        channels: audioStream.channels
                    } : null
                });
            });
        });
    }

    /**
     * Create reversed version of video (for ping-pong effect)
     */
    async createReversedVideo(inputPath, outputPath, progressCallback = null) {
        return new Promise((resolve, reject) => {
            let lastProgress = 0;

            ffmpeg(inputPath)
                .videoFilters('reverse')
                .audioFilters('areverse')
                .on('start', (cmd) => {
                    console.log('Creating reversed video...');
                    if (progressCallback) {
                        progressCallback(0, 'Creating reversed video...');
                    }
                })
                .on('progress', (progress) => {
                    if (progress.percent && progress.percent > lastProgress + 5) {
                        lastProgress = Math.floor(progress.percent);
                        console.log(`Reversing: ${lastProgress}%`);
                        if (progressCallback) {
                            progressCallback(Math.floor(lastProgress / 4), `Reversing video: ${lastProgress}%`);
                        }
                    }
                })
                .on('end', () => {
                    console.log('Reversed video created');
                    if (progressCallback) {
                        progressCallback(25, 'Reversed video created');
                    }
                    resolve();
                })
                .on('error', (err) => {
                    console.error('Error creating reversed video:', err);
                    reject(err);
                })
                .save(outputPath);
        });
    }

    /**
     * Assemble video with ping-pong looping (A -> Reverse -> A -> Reverse...)
     * This creates seamless loops without jump cuts
     * 
     * @param {Object} config - Assembly configuration
     * @param {string} config.videoPath - Path to source video
     * @param {string} config.audioPath - Path to generated audio
     * @param {number} config.audioDuration - Audio duration in seconds
     * @param {string} config.loopType - 'ping-pong' or 'standard'
     * @param {string} config.outputName - Optional output filename
     * @param {Function} progressCallback - Progress callback function
     */
    async assembleVideo(config, progressCallback = null) {
        const {
            videoPath,
            audioPath,
            audioDuration,
            loopType = 'ping-pong',
            outputName = null
        } = config;

        // Validation
        if (!fs.existsSync(videoPath)) {
            throw new Error(`Video file not found: ${videoPath}`);
        }

        if (!fs.existsSync(audioPath)) {
            throw new Error(`Audio file not found: ${audioPath}`);
        }

        if (!audioDuration || audioDuration < 1) {
            throw new Error('Audio duration must be at least 1 second');
        }

        console.log(`🎬 Starting video assembly: ${loopType} loop, ${Math.floor(audioDuration / 60)} minutes`);

        // Generate output filename
        const timestamp = Date.now();
        const fileName = outputName || `video_${timestamp}.mp4`;
        const outputPath = path.join(this.videoOutputDir, fileName);

        // Temp files
        const reversedVideoPath = path.join(this.tempDir, `reversed_${timestamp}.mp4`);
        const concatListPath = path.join(this.tempDir, `concat_${timestamp}.txt`);

        const startTime = Date.now();

        try {
            // Step 1: Get video duration
            if (progressCallback) {
                progressCallback(0, 'Analyzing source video...');
            }

            const videoDuration = await this.getVideoDuration(videoPath);
            console.log(`Source video duration: ${videoDuration}s`);

            // Step 2: Create concat list based on loop type
            let concatList = [];

            if (loopType === 'ping-pong') {
                // Create reversed version
                if (progressCallback) {
                    progressCallback(5, 'Creating reversed version for ping-pong effect...');
                }

                await this.createReversedVideo(videoPath, reversedVideoPath, (progress, message) => {
                    if (progressCallback) {
                        progressCallback(5 + Math.floor(progress / 2), message);
                    }
                });

                // Calculate loops needed
                const singlePingPongDuration = videoDuration * 2; // A + A_reversed
                const loopsNeeded = Math.ceil(audioDuration / singlePingPongDuration);

                console.log(`Ping-pong duration: ${singlePingPongDuration}s, loops needed: ${loopsNeeded}`);

                // Build concat list: A, A_reversed, A, A_reversed, ...
                for (let i = 0; i < loopsNeeded; i++) {
                    concatList.push(`file '${path.resolve(videoPath).replace(/\\/g, '/')}'`);
                    concatList.push(`file '${path.resolve(reversedVideoPath).replace(/\\/g, '/')}'`);
                }

            } else if (loopType === 'standard') {
                // Standard looping: A, A, A, A, ...
                const loopsNeeded = Math.ceil(audioDuration / videoDuration);
                console.log(`Standard loops needed: ${loopsNeeded}`);

                for (let i = 0; i < loopsNeeded; i++) {
                    concatList.push(`file '${path.resolve(videoPath).replace(/\\/g, '/')}'`);
                }
            } else {
                throw new Error(`Unknown loop type: ${loopType}. Use 'ping-pong' or 'standard'`);
            }

            // Write concat list
            await fs.writeFile(concatListPath, concatList.join('\n'));

            if (progressCallback) {
                progressCallback(30, 'Merging video with audio...');
            }

            // Step 3: Concatenate videos and merge with audio
            await this.mergeVideoWithAudio(
                concatListPath,
                audioPath,
                outputPath,
                audioDuration,
                (progress, message) => {
                    if (progressCallback) {
                        // Map 0-100% to 30-100%
                        progressCallback(30 + Math.floor(progress * 0.7), message);
                    }
                }
            );

            const totalTime = ((Date.now() - startTime) / 1000).toFixed(2);
            console.log(`✅ Video assembly completed in ${totalTime}s`);

            if (progressCallback) {
                progressCallback(100, 'Video assembly completed');
            }

            // Get output file info
            const stats = fs.statSync(outputPath);
            const videoInfo = await this.getVideoInfo(outputPath);

            return {
                success: true,
                outputPath,
                relativePath: `/video-output/${fileName}`,
                duration: audioDuration,
                loopType,
                generationTime: parseFloat(totalTime),
                fileSize: stats.size,
                fileName,
                videoInfo
            };

        } catch (error) {
            console.error('❌ Video assembly failed:', error);
            throw error;
        } finally {
            // Cleanup temp files
            try {
                if (fs.existsSync(reversedVideoPath)) {
                    await fs.unlink(reversedVideoPath);
                    console.log('Cleaned up reversed video');
                }
                if (fs.existsSync(concatListPath)) {
                    await fs.unlink(concatListPath);
                    console.log('Cleaned up concat list');
                }
            } catch (cleanupError) {
                console.error('Cleanup error:', cleanupError);
            }
        }
    }

    /**
     * Merge concatenated video with audio
     * Uses FFmpeg concat demuxer (super fast, no re-encoding for video)
     */
    async mergeVideoWithAudio(concatListPath, audioPath, outputPath, duration, progressCallback = null) {
        return new Promise((resolve, reject) => {
            let lastProgress = 0;

            ffmpeg()
                .input(concatListPath)
                .inputOptions(['-f', 'concat', '-safe', '0'])
                .input(audioPath)
                .outputOptions([
                    '-map', '0:v',      // Video from concat
                    '-map', '1:a',      // Audio from audio file
                    '-c:v', 'copy',     // Copy video (no re-encode!)
                    '-c:a', 'aac',      // Encode audio to AAC for compatibility
                    '-b:a', '192k',     // Audio bitrate
                    '-shortest',        // Cut to shortest input
                    '-movflags', '+faststart' // Enable streaming
                ])
                .duration(duration)
                .on('start', (cmd) => {
                    console.log('FFmpeg command:', cmd.substring(0, 200) + '...');
                    if (progressCallback) {
                        progressCallback(0, 'Merging video and audio...');
                    }
                })
                .on('progress', (progress) => {
                    if (progress.percent) {
                        const currentProgress = Math.floor(progress.percent);

                        if (currentProgress >= lastProgress + 5) {
                            lastProgress = currentProgress;
                            console.log(`Merging: ${currentProgress}%`);

                            if (progressCallback) {
                                progressCallback(currentProgress, `Merging: ${currentProgress}%`);
                            }
                        }
                    }
                })
                .on('end', () => {
                    console.log('Video merge finished');
                    if (progressCallback) {
                        progressCallback(100, 'Merge completed');
                    }
                    resolve(outputPath);
                })
                .on('error', (err, stdout, stderr) => {
                    console.error('FFmpeg error:', err.message);
                    console.error('FFmpeg stderr:', stderr);
                    reject(err);
                })
                .save(outputPath);
        });
    }

    /**
     * Get all videos from gallery for selection
     */
    async getAvailableVideos(userId) {
        return new Promise((resolve, reject) => {
            const db = new sqlite3.Database(dbPath);

            db.all(
                'SELECT id, title, file_path, thumbnail_path, duration, file_size FROM videos WHERE user_id = ? ORDER BY created_at DESC',
                [userId],
                (err, rows) => {
                    db.close();
                    if (err) return reject(err);
                    resolve(rows);
                }
            );
        });
    }

    /**
     * Delete assembled video
     */
    async deleteVideo(fileName) {
        const filePath = path.join(this.videoOutputDir, fileName);

        if (!fs.existsSync(filePath)) {
            throw new Error('Video file not found');
        }

        await fs.unlink(filePath);
        console.log(`🗑️  Deleted video: ${fileName}`);

        return { success: true, message: 'Video deleted' };
    }

    /**
     * Cleanup old temp files (run periodically)
     */
    async cleanupTempFiles(olderThanHours = 24) {
        const files = await fs.readdir(this.tempDir);
        const now = Date.now();
        const threshold = olderThanHours * 60 * 60 * 1000;

        let cleaned = 0;

        for (const file of files) {
            const filePath = path.join(this.tempDir, file);
            const stats = await fs.stat(filePath);

            if (now - stats.mtimeMs > threshold) {
                await fs.unlink(filePath);
                cleaned++;
            }
        }

        console.log(`🧹 Cleaned up ${cleaned} temp files`);
        return { cleaned };
    }
}

// Singleton instance
const videoService = new VideoService();

module.exports = videoService;
