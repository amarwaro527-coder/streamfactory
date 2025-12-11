/**
 * List all audio stems in database
 * Verify scan-audio-files.js worked correctly
 */

const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const dbPath = process.env.DATABASE_PATH || './db/streamfactory.db';

console.log('📊 Audio Stems Database Viewer\n');

const db = new sqlite3.Database(dbPath, (err) => {
    if (err) {
        console.error('❌ Error opening database:', err);
        process.exit(1);
    }
});

// Get all stems grouped by category
db.all(`
  SELECT category, COUNT(*) as count, 
         SUM(duration) as total_duration,
         GROUP_CONCAT(name, '|||') as names
  FROM audio_stems 
  GROUP BY category 
  ORDER BY category
`, (err, categories) => {
    if (err) {
        console.error('Error querying database:', err);
        db.close();
        return;
    }

    if (!categories || categories.length === 0) {
        console.log('⚠️  No audio stems found in database.');
        console.log('\n💡 To populate database:');
        console.log('   1. Add audio files to audio-stems/ directory');
        console.log('   2. Run: node scripts/scan-audio-files.js\n');
        db.close();
        return;
    }

    console.log('📁 Categories:\n');

    let totalFiles = 0;
    let totalDuration = 0;

    categories.forEach(cat => {
        const hours = Math.floor(cat.total_duration / 3600);
        const minutes = Math.floor((cat.total_duration % 3600) / 60);

        console.log(`📂 ${cat.category.toUpperCase()}`);
        console.log(`   Files: ${cat.count}`);
        console.log(`   Total Duration: ${hours}h ${minutes}m`);

        totalFiles += cat.count;
        totalDuration += cat.total_duration;

        // Show first 3 files
        const names = cat.names.split('|||');
        console.log('   Files:');
        names.slice(0, 3).forEach(name => {
            console.log(`      • ${name}`);
        });
        if (names.length > 3) {
            console.log(`      ... and ${names.length - 3} more`);
        }
        console.log('');
    });

    const totalHours = Math.floor(totalDuration / 3600);
    const totalMinutes = Math.floor((totalDuration % 3600) / 60);

    console.log('─────────────────────────────────────');
    console.log(`📊 TOTAL: ${totalFiles} files`);
    console.log(`⏱️  DURATION: ${totalHours}h ${totalMinutes}m of audio`);
    console.log('─────────────────────────────────────\n');

    // Get detailed list for one category
    db.all('SELECT * FROM audio_stems LIMIT 5', (err, samples) => {
        if (!err && samples) {
            console.log('📋 Sample Entries:\n');
            samples.forEach((stem, i) => {
                const duration = Math.floor(stem.duration / 60);
                console.log(`${i + 1}. ${stem.name}`);
                console.log(`   Category: ${stem.category}`);
                console.log(`   Path: ${stem.file_path}`);
                console.log(`   Duration: ${duration} minutes`);
                console.log('');
            });
        }

        db.close();

        console.log('✅ Database verification complete!\n');
    });
});
