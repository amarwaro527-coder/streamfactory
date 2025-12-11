/**
 * Auto-scan audio-stems directory and populate database
 * Supports: .mp3, .wav, .ogg, .flac
 * Handles nested folders
 */

const fs = require('fs-extra');
const path = require('path');
const sqlite3 = require('sqlite3').verbose();
const ffmpeg = require('fluent-ffmpeg');
const ffmpegInstaller = require('@ffmpeg-installer/ffmpeg');

ffmpeg.setFfmpegPath(ffmpegInstaller.path);

const dbPath = process.env.DATABASE_PATH || './db/streamfactory.db';
const audioStemsDir = process.env.AUDIO_STEMS_DIR || './audio-stems';

// Supported audio formats
const AUDIO_EXTENSIONS = ['.mp3', '.wav', '.ogg', '.flac', '.m4a', '.aac'];

/**
 * Get audio file duration using FFprobe
 */
function getAudioDuration(filePath) {
    return new Promise((resolve, reject) => {
        ffmpeg.ffprobe(filePath, (err, metadata) => {
            if (err) {
                console.warn(`⚠️  Could not get duration for ${path.basename(filePath)}: ${err.message}`);
                resolve(300); // Default 5 minutes
            } else {
                resolve(metadata.format.duration || 300);
            }
        });
    });
}

/**
 * Scan directory recursively for audio files
 */
async function scanDirectory(directory, category = null) {
    const results = [];

    try {
        const items = await fs.readdir(directory);

        for (const item of items) {
            const fullPath = path.join(directory, item);
            const stat = await fs.stat(fullPath);

            if (stat.isDirectory()) {
                // Recursive scan subdirectories
                const subCategory = category || item;
                const subResults = await scanDirectory(fullPath, subCategory);
                results.push(...subResults);
            } else if (stat.isFile()) {
                const ext = path.extname(item).toLowerCase();

                if (AUDIO_EXTENSIONS.includes(ext)) {
                    // Determine category
                    const fileCategory = category || path.basename(path.dirname(fullPath));

                    // Get relative path from audio-stems root
                    const relativePath = path.relative(audioStemsDir, fullPath).replace(/\\/g, '/');

                    // Get duration
                    console.log(`   Analyzing: ${path.basename(fullPath)}...`);
                    const duration = await getAudioDuration(fullPath);

                    results.push({
                        name: path.basename(item, ext).replace(/_/g, ' ').replace(/-/g, ' '), // Clean name
                        category: fileCategory.toLowerCase(),
                        file_path: relativePath,
                        duration: Math.round(duration),
                        default_volume: 0.7,
                        file_size: stat.size
                    });
                }
            }
        }
    } catch (error) {
        console.error(`Error scanning ${directory}:`, error);
    }

    return results;
}

/**
 * Main function
 */
async function main() {
    console.log('🔍 StreamFactory Audio Stems Scanner\n');
    console.log(`📂 Scanning directory: ${path.resolve(audioStemsDir)}\n`);

    // Check if directory exists
    if (!fs.existsSync(audioStemsDir)) {
        console.error(`❌ Directory not found: ${audioStemsDir}`);
        console.error('   Please create the directory and add audio files first.');
        process.exit(1);
    }

    // Scan for audio files
    console.log('🔍 Scanning for audio files...\n');
    const audioFiles = await scanDirectory(audioStemsDir);

    if (audioFiles.length === 0) {
        console.error('❌ No audio files found!');
        console.error('   Supported formats: .mp3, .wav, .ogg, .flac, .m4a, .aac');
        console.error(`   Please add audio files to: ${audioStemsDir}`);
        process.exit(1);
    }

    // Group by category
    const byCategory = {};
    audioFiles.forEach(file => {
        if (!byCategory[file.category]) {
            byCategory[file.category] = [];
        }
        byCategory[file.category].push(file);
    });

    // Show summary
    console.log('✅ Scan complete!\n');
    console.log('📊 Summary:');
    Object.keys(byCategory).sort().forEach(category => {
        console.log(`   ${category}: ${byCategory[category].length} files`);
    });
    console.log(`   TOTAL: ${audioFiles.length} files\n`);

    // Update database
    console.log('💾 Updating database...\n');

    const db = new sqlite3.Database(dbPath);

    await new Promise((resolve, reject) => {
        db.serialize(() => {
            // Clear existing audio stems
            db.run('DELETE FROM audio_stems', (err) => {
                if (err) {
                    console.error('Error clearing table:', err);
                    reject(err);
                    return;
                }
                console.log('   Cleared existing entries');
            });

            // Insert new stems
            const stmt = db.prepare('INSERT INTO audio_stems (name, category, file_path, duration, default_volume) VALUES (?, ?, ?, ?, ?)');

            audioFiles.forEach((file, index) => {
                stmt.run(file.name, file.category, file.file_path, file.duration, file.default_volume, (err) => {
                    if (err) {
                        console.error(`Error inserting ${file.name}:`, err);
                    }
                });
            });

            stmt.finalize((err) => {
                if (err) {
                    reject(err);
                } else {
                    console.log(`   Inserted ${audioFiles.length} entries`);
                    resolve();
                }
            });
        });
    });

    db.close();

    console.log('\n✅ Database updated successfully!\n');

    // Show detailed breakdown
    console.log('📋 Detailed Breakdown:\n');
    Object.keys(byCategory).sort().forEach(category => {
        console.log(`📁 ${category.toUpperCase()} (${byCategory[category].length} files):`);
        byCategory[category].slice(0, 5).forEach(file => {
            const duration = Math.floor(file.duration / 60);
            const size = (file.file_size / 1024 / 1024).toFixed(2);
            console.log(`   • ${file.name} (${duration}m, ${size}MB)`);
        });
        if (byCategory[category].length > 5) {
            console.log(`   ... and ${byCategory[category].length - 5} more`);
        }
        console.log('');
    });

    console.log('🎉 All done! Your audio stems are ready to use.\n');
    console.log('📋 Next steps:');
    console.log('   1. Run: npm start');
    console.log('   2. Open: http://localhost:7576/audio-studio');
    console.log('   3. Go to "Custom Mix" tab');
    console.log('   4. Your files will be listed by category\n');
}

// Run
main().catch(error => {
    console.error('❌ Fatal error:', error);
    process.exit(1);
});
