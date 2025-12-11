const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const fs = require('fs');

// Database configuration
const dbPath = process.env.DATABASE_PATH || path.join(__dirname, 'streamfactory.db');
const dbDir = path.dirname(dbPath);

// Ensure database directory exists
if (!fs.existsSync(dbDir)) {
    fs.mkdirSync(dbDir, { recursive: true });
}

// Create database connection
const db = new sqlite3.Database(dbPath, sqlite3.OPEN_READWRITE | sqlite3.OPEN_CREATE, (err) => {
    if (err) {
        console.error('❌ Database connection error:', err.message);
        process.exit(1);
    }
    console.log('✅ Connected to StreamFactory database');
});

// Enable foreign keys
db.run('PRAGMA foreign_keys = ON');

// Helper function to check if users exist
async function checkIfUsersExist() {
    return new Promise((resolve, reject) => {
        db.get('SELECT COUNT(*) as count FROM users', (err, row) => {
            if (err) {
                // If users table doesn't exist yet, return false
                if (err.message.includes('no such table')) {
                    return resolve(false);
                }
                return reject(err);
            }
            resolve(row.count > 0);
        });
    });
}

// Helper function to run queries
function runQuery(sql, params = []) {
    return new Promise((resolve, reject) => {
        db.run(sql, params, function (err) {
            if (err) {
                reject(err);
            } else {
                resolve({ id: this.lastID, changes: this.changes });
            }
        });
    });
}

// Helper function to get single row
function getOne(sql, params = []) {
    return new Promise((resolve, reject) => {
        db.get(sql, params, (err, row) => {
            if (err) {
                reject(err);
            } else {
                resolve(row);
            }
        });
    });
}

// Helper function to get all rows
function getAll(sql, params = []) {
    return new Promise((resolve, reject) => {
        db.all(sql, params, (err, rows) => {
            if (err) {
                reject(err);
            } else {
                resolve(rows);
            }
        });
    });
}

// Initialize database tables
async function initializeDatabase() {
    return new Promise((resolve, reject) => {
        db.serialize(() => {
            // Create users table (from Streamflow)
            db.run(`
        CREATE TABLE IF NOT EXISTS users (
          id TEXT PRIMARY KEY,
          username TEXT UNIQUE NOT NULL,
          password TEXT NOT NULL,
          email TEXT,
          user_role TEXT DEFAULT 'user',
          status TEXT DEFAULT 'active',
          avatar TEXT,
          youtube_access_token TEXT,
          youtube_refresh_token TEXT,
          gemini_api_key TEXT,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )
      `, (err) => {
                if (err) {
                    console.error('❌ Error creating users table:', err.message);
                    return reject(err);
                }
                console.log('✅ Users table created/verified');
            });

            // Create streams table (from Streamflow)
            db.run(`
        CREATE TABLE IF NOT EXISTS streams (
          id TEXT PRIMARY KEY,
          user_id TEXT NOT NULL,
          platform TEXT NOT NULL,
          stream_key TEXT,
          stream_url TEXT,
          status TEXT DEFAULT 'offline',
          title TEXT,
          description TEXT,
          thumbnail TEXT,
          scheduled_time DATETIME,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
        )
      `, (err) => {
                if (err) console.error('⚠️  Error creating streams table:', err.message);
            });

            // Create videos table (from Streamflow) - FIXED SCHEMA!
            db.run(`
        CREATE TABLE IF NOT EXISTS videos (
          id TEXT PRIMARY KEY,
          user_id TEXT NOT NULL,
          title TEXT NOT NULL,
          description TEXT,
          filepath TEXT NOT NULL,
          thumbnail_path TEXT,
          duration INTEGER,
          filesize INTEGER,
          resolution TEXT,
          bitrate INTEGER,
          fps INTEGER,
          status TEXT DEFAULT 'ready',
          upload_date DATETIME DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
        )
      `, (err) => {
                if (err) console.error('⚠️  Error creating videos table:', err.message);
            });

            // Create playlists table (from Streamflow)
            db.run(`
        CREATE TABLE IF NOT EXISTS playlists (
          id TEXT PRIMARY KEY,
          user_id TEXT NOT NULL,
          name TEXT NOT NULL,
          description TEXT,
          thumbnail TEXT,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
        )
      `, (err) => {
                if (err) console.error('⚠️  Error creating playlists table:', err.message);
            });

            // Create playlist_videos join table
            db.run(`
        CREATE TABLE IF NOT EXISTS playlist_videos (
          id TEXT PRIMARY KEY,
          playlist_id TEXT NOT NULL,
          video_id TEXT NOT NULL,
          position INTEGER DEFAULT 0,
          FOREIGN KEY (playlist_id) REFERENCES playlists(id) ON DELETE CASCADE,
          FOREIGN KEY (video_id) REFERENCES videos(id) ON DELETE CASCADE
        )
      `, (err) => {
                if (err) console.error('⚠️  Error creating playlist_videos table:', err.message);
                console.log('✅ Database initialization complete');
                resolve();
            });
        });
    });
}

// Graceful shutdown
process.on('SIGINT', () => {
    db.close((err) => {
        if (err) {
            console.error('❌ Error closing database:', err.message);
        } else {
            console.log('✅ Database connection closed');
        }
        process.exit(0);
    });
});

module.exports = {
    db,
    checkIfUsersExist,
    initializeDatabase,
    runQuery,
    getOne,
    getAll
};
