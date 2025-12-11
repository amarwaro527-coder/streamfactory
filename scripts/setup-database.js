const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const fs = require('fs-extra');

const dbPath = process.env.DATABASE_PATH || './db/streamfactory.db';
const dbDir = path.dirname(dbPath);

// Ensure db directory exists
fs.ensureDirSync(dbDir);

console.log('🗄️  Setting up StreamFactory database...');
console.log(`📍 Database path: ${dbPath}`);

const db = new sqlite3.Database(dbPath, (err) => {
  if (err) {
    console.error('❌ Error opening database:', err);
    process.exit(1);
  }
  console.log('✅ Database connected');
});

// Run migrations
db.serialize(() => {
  // Projects table (NEW - for audio/video composition)
  db.run(`
    CREATE TABLE IF NOT EXISTS projects (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      name TEXT NOT NULL,
      type TEXT NOT NULL,
      status TEXT DEFAULT 'draft',
      
      audio_preset TEXT,
      audio_config TEXT,
      audio_duration INTEGER,
      audio_output_path TEXT,
      
      video_source_ids TEXT,
      video_loop_type TEXT,
      video_output_path TEXT,
      
      metadata TEXT,
      
      youtube_video_id TEXT,
      youtube_status TEXT,
      
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    )
  `, [], (err) => {
    if (err) {
      console.error('❌ Error creating projects table:', err);
    } else {
      console.log('✅ Projects table created/verified');
    }
  });

  // Audio stems table (NEW)
  db.run(`
    CREATE TABLE IF NOT EXISTS audio_stems (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      category TEXT NOT NULL,
      file_path TEXT NOT NULL,
      duration REAL NOT NULL,
      default_volume REAL DEFAULT 0.7,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `, [], (err) => {
    if (err) {
      console.error('❌ Error creating audio_stems table:', err);
    } else {
      console.log('✅ Audio stems table created/verified');
    }
  });

  // Audio presets table (NEW)
  db.run(`
    CREATE TABLE IF NOT EXISTS audio_presets (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      description TEXT,
      stem_configs TEXT NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `, [], (err) => {
    if (err) {
      console.error('❌ Error creating audio_presets table:', err);
    } else {
      console.log('✅ Audio presets table created/verified');
    }
  });

  // Jobs table (NEW - for BullMQ tracking)
  db.run(`
    CREATE TABLE IF NOT EXISTS jobs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      job_id TEXT UNIQUE NOT NULL,
      job_type TEXT NOT NULL,
      project_id INTEGER,
      user_id INTEGER NOT NULL,
      status TEXT DEFAULT 'pending',
      progress INTEGER DEFAULT 0,
      data TEXT,
      result TEXT,
      error TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      started_at DATETIME,
      completed_at DATETIME,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
      FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE SET NULL
    )
  `, [], (err) => {
    if (err) {
      console.error('❌ Error creating jobs table:', err);
    } else {
      console.log('✅ Jobs table created/verified');
    }
  });

  // Add YouTube token columns to users table (if not exists)
  db.run(`
    ALTER TABLE users ADD COLUMN youtube_access_token TEXT
  `, [], (err) => {
    if (err && !err.message.includes('duplicate column')) {
      console.error('⚠️  Could not add youtube_access_token column:', err.message);
    } else if (!err) {
      console.log('✅ Added youtube_access_token column to users');
    }
  });

  db.run(`
    ALTER TABLE users ADD COLUMN youtube_refresh_token TEXT
  `, [], (err) => {
    if (err && !err.message.includes('duplicate column')) {
      console.error('⚠️  Could not add youtube_refresh_token column:', err.message);
    } else if (!err) {
      console.log('✅ Added youtube_refresh_token column to users');
    }
  });

  db.run(`
    ALTER TABLE users ADD COLUMN gemini_api_key TEXT
  `, [], (err) => {
    if (err && !err.message.includes('duplicate column')) {
      console.error('⚠️  Could not add gemini_api_key column:', err.message);
    } else if (!err) {
      console.log('✅ Added gemini_api_key column to users');
    }
  });
});

// Close database after migrations
db.close((err) => {
  if (err) {
    console.error('❌ Error closing database:', err);
    process.exit(1);
  }
  console.log('✅ Database setup complete!');
  console.log('');
  console.log('📋 Next steps:');
  console.log('   1. Run: npm run seed-audio (optional - seed audio stems)');
  console.log('   2. Run: npm start');
  console.log('   3. Visit: http://localhost:7576/setup-account');
});
