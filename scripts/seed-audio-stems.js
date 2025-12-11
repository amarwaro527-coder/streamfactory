const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const dbPath = process.env.DATABASE_PATH || './db/streamfactory.db';

console.log('🌱 Seeding audio stems...');

const db = new sqlite3.Database(dbPath, (err) => {
    if (err) {
        console.error('❌ Error opening database:', err);
        process.exit(1);
    }
});

// Sample audio stems (these would normally point to actual audio files)
const audioStems = [
    // Rain category
    { name: 'Rain on Tent', category: 'rain', file_path: 'audio-stems/rain/rain_on_tent.mp3', duration: 300, default_volume: 0.7 },
    { name: 'Heavy Rain', category: 'rain', file_path: 'audio-stems/rain/heavy_rain.mp3', duration: 300, default_volume: 0.8 },
    { name: 'Light Rain', category: 'rain', file_path: 'audio-stems/rain/light_rain.mp3', duration: 300, default_volume: 0.6 },

    // Thunder category
    { name: 'Thunder Rumble', category: 'thunder', file_path: 'audio-stems/thunder/thunder_rumble.mp3', duration: 60, default_volume: 0.5 },
    { name: 'Distant Thunder', category: 'thunder', file_path: 'audio-stems/thunder/distant_thunder.mp3', duration: 60, default_volume: 0.3 },

    // Nature category
    { name: 'Forest Ambience', category: 'nature', file_path: 'audio-stems/nature/forest_ambience.mp3', duration: 600, default_volume: 0.5 },
    { name: 'Birds Chirping', category: 'nature', file_path: 'audio-stems/nature/birds_chirping.mp3', duration: 300, default_volume: 0.4 },
    { name: 'Wind Through Trees', category: 'nature', file_path: 'audio-stems/nature/wind_trees.mp3', duration: 300, default_volume: 0.4 },

    // Water category
    { name: 'Ocean Waves', category: 'water', file_path: 'audio-stems/water/ocean_waves.mp3', duration: 300, default_volume: 0.7 },
    { name: 'River Stream', category: 'water', file_path: 'audio-stems/water/river_stream.mp3', duration: 300, default_volume: 0.6 },
    { name: 'Waterfall', category: 'water', file_path: 'audio-stems/water/waterfall.mp3', duration: 300, default_volume: 0.7 },

    // Fire category
    { name: 'Crackling Fire', category: 'fire', file_path: 'audio-stems/fire/crackling_fire.mp3', duration: 300, default_volume: 0.5 },
    { name: 'Fireplace', category: 'fire', file_path: 'audio-stems/fire/fireplace.mp3', duration: 300, default_volume: 0.6 }
];

// Audio presets (combinations of stems)
const audioPresets = [
    {
        name: 'Rainy Night',
        description: 'Perfect for sleep and relaxation',
        stem_configs: JSON.stringify([
            { stem_id: 1, volume: 0.9 },  // Rain on Tent
            { stem_id: 4, volume: 0.3 }   // Thunder Rumble
        ])
    },
    {
        name: 'Stormy Weather',
        description: 'Intense rain and thunder',
        stem_configs: JSON.stringify([
            { stem_id: 2, volume: 0.9 },  // Heavy Rain
            { stem_id: 4, volume: 0.6 },  // Thunder Rumble
            { stem_id: 8, volume: 0.3 }   // Wind Through Trees
        ])
    },
    {
        name: 'Peaceful Forest',
        description: 'Nature sounds for meditation',
        stem_configs: JSON.stringify([
            { stem_id: 6, volume: 0.7 },  // Forest Ambience
            { stem_id: 7, volume: 0.5 },  // Birds Chirping
            { stem_id: 8, volume: 0.4 }   // Wind Through Trees
        ])
    },
    {
        name: 'Ocean Breeze',
        description: 'Relaxing ocean soundscape',
        stem_configs: JSON.stringify([
            { stem_id: 9, volume: 0.8 },  // Ocean Waves
            { stem_id: 8, volume: 0.3 }   // Wind Through Trees
        ])
    },
    {
        name: 'Cozy Fireplace',
        description: 'Warm and comfortable ambiance',
        stem_configs: JSON.stringify([
            { stem_id: 12, volume: 0.8 }, // Crackling Fire
            { stem_id: 3, volume: 0.2 }   // Light Rain (subtle)
        ])
    }
];

db.serialize(() => {
    // Clear existing data (optional)
    console.log('🗑️  Clearing existing audio data...');
    db.run('DELETE FROM audio_stems');
    db.run('DELETE FROM audio_presets');

    // Insert audio stems
    const stemStmt = db.prepare('INSERT INTO audio_stems (name, category, file_path, duration, default_volume) VALUES (?, ?, ?, ?, ?)');

    audioStems.forEach((stem) => {
        stemStmt.run(stem.name, stem.category, stem.file_path, stem.duration, stem.default_volume);
    });

    stemStmt.finalize((err) => {
        if (err) {
            console.error('❌ Error inserting audio stems:', err);
        } else {
            console.log(`✅ Inserted ${audioStems.length} audio stems`);
        }
    });

    // Insert audio presets
    const presetStmt = db.prepare('INSERT INTO audio_presets (name, description, stem_configs) VALUES (?, ?, ?)');

    audioPresets.forEach((preset) => {
        presetStmt.run(preset.name, preset.description, preset.stem_configs);
    });

    presetStmt.finalize((err) => {
        if (err) {
            console.error('❌ Error inserting audio presets:', err);
        } else {
            console.log(`✅ Inserted ${audioPresets.length} audio presets`);
        }
    });
});

db.close((err) => {
    if (err) {
        console.error('❌ Error closing database:', err);
        process.exit(1);
    }
    console.log('✅ Audio stems seeded successfully!');
    console.log('');
    console.log('📝 Note: Audio files referenced in stems do not exist yet.');
    console.log('   You can either:');
    console.log('   1. Upload your own audio files to audio-stems/ directory');
    console.log('   2. Use the audio generation feature to create them');
    console.log('   3. Download from https://freesound.org or similar');
});
