const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const dbPath = process.env.DATABASE_PATH || './db/streamfactory.db';

console.log('🔄 Updating database schema for YouTube metadata...');

const db = new sqlite3.Database(dbPath, (err) => {
    if (err) {
        console.error('❌ Error opening database:', err);
        process.exit(1);
    }
});

db.serialize(() => {
    // Add YouTube metadata fields to projects table
    const columns = [
        { name: 'youtube_title', type: 'TEXT' },
        { name: 'youtube_description', type: 'TEXT' },
        { name: 'youtube_tags', type: 'TEXT' },
        { name: 'youtube_category', type: 'TEXT' },
        { name: 'youtube_privacy', type: 'TEXT DEFAULT \'public\'' },
        { name: 'youtube_metadata', type: 'TEXT' }
    ];

    columns.forEach(col => {
        db.run(`ALTER TABLE projects ADD COLUMN ${col.name} ${col.type}`, [], (err) => {
            if (err && !err.message.includes('duplicate column')) {
                console.error(`⚠️  Could not add ${col.name} column:`, err.message);
            } else if (!err) {
                console.log(`✅ Added ${col.name} column to projects`);
            }
        });
    });
});

db.close((err) => {
    if (err) {
        console.error('❌ Error closing database:', err);
    } else {
        console.log('✅ Database schema updated!');
    }
});
