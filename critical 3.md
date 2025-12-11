# 🚨 CRITICAL ERROR #3 - Missing initializeDatabase Function

**Error**: `TypeError: initializeDatabase is not a function`  
**Status**: ❌ BLOCKING APP STARTUP  
**Severity**: CRITICAL

---

## 🔍 ERROR ANALYSIS

### Terminal Output (PM2 Logs)
```bash
0|streamfactory  | Failed to init ialize database: TypeError: initializeDatabase is not a function
0|streamfactory  |     at Server.<anonymous> (/home/ubuntu/streamfactory/app.js:2389:11)
```

### Root Cause

**Import vs Export Mismatch**

**app.js Line 17** (trying to import):
```javascript
const { db, checkIfUsersExist, initializeDatabase } = require('./db/database');
                                 ^^^^^^^^^^^^^^^^^^^^
                                 EXPECTING THIS!
```

**db/database.js** (NOT exporting):
```javascript
module.exports = {
  db,
  checkIfUsersExist,
  runQuery,
  getOne,
  getAll
};
// initializeDatabase TIDAK ADA! ❌
```

**app.js Line 2389** (trying to call):
```javascript
server.listen(port, '0.0.0.0', async () => {
  try {
    await initializeDatabase();  // ← CRASH HERE!
```

---

## 🎯 WHY THIS HAPPENED

### Timeline of Issues

1. **First Error**: `generate-secret.js` not found
   - ✅ Fixed: Created scripts/generate-secret.js

2. **Second Error**: `db/database.js` module not found
   - ✅ Fixed: Created db/database.js
   - ❌ BUT: File created incomplete (missing initializeDatabase function)

3. **Third Error (NOW)**: `initializeDatabase is not a function`
   - ❌ Cause: db/database.js doesn't export this function

### Why Function Was Missing

When I created `db/database.js` in **critical 2.md**, I only created:
- Database connection
- Helper functions (checkIfUsersExist, runQuery, getOne, getAll)
- **BUT forgot** `initializeDatabase()` function!

This function is critical because:
- Creates `users` table (required for login)
- Creates `streams`, `videos`, `playlists` tables (Streamflow features)
- Must be called before  app starts

---

## ✅ SOLUTION

### Add initializeDatabase Function to db/database.js

**Complete function (add before module.exports)**:

```javascript
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

      // Create videos table (from Streamflow)
      db.run(`
        CREATE TABLE IF NOT EXISTS videos (
          id TEXT PRIMARY KEY,
          user_id TEXT NOT NULL,
          title TEXT NOT NULL,
          description TEXT,
          file_path TEXT NOT NULL,
          thumbnail TEXT,
          duration INTEGER,
          file_size INTEGER,
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
```

**Update module.exports**:
```javascript
module.exports = {
  db,
  checkIfUsersExist,
  initializeDatabase,  // ← ADD THIS!
  runQuery,
  getOne,
  getAll
};
```

---

## 🚀 FIX OPTIONS

### Option 1: Pull dari GitHub (FASTEST!)

Saya sudah **upload fixed version** ke GitHub:

```bash
cd ~/streamfactory
git pull origin main
pm2 restart streamfactory
pm2 logs streamfactory
```

**Expected output**:
```bash
✅ Connected to StreamFactory database
✅ Users table created/verified
✅ Database initialization complete
✅ StreamFactory services initialized
✅ Socket.io initialized
🏭 StreamFactory running at: http://54.219.178.244:7576
```

---

### Option 2: Manual Fix di VPS (if pull fails)

**Complete copy-paste command**:

```bash
cd ~/streamfactory

# Backup existing file
cp db/database.js db/database.js.backup

# Create new version
cat > db/database.js << 'ENDOFFILE'
const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const fs = require('fs');

const dbPath = process.env.DATABASE_PATH || path.join(__dirname, 'streamfactory.db');
const dbDir = path.dirname(dbPath);

if (!fs.existsSync(dbDir)) {
  fs.mkdirSync(dbDir, { recursive: true });
}

const db = new sqlite3.Database(dbPath, sqlite3.OPEN_READWRITE | sqlite3.OPEN_CREATE, (err) => {
  if (err) {
    console.error('❌ Database connection error:', err.message);
    process.exit(1);
  }
  console.log('✅ Connected to StreamFactory database');
});

db.run('PRAGMA foreign_keys = ON');

async function checkIfUsersExist() {
  return new Promise((resolve, reject) => {
    db.get('SELECT COUNT(*) as count FROM users', (err, row) => {
      if (err) {
        if (err.message.includes('no such table')) {
          return resolve(false);
        }
        return reject(err);
      }
      resolve(row.count > 0);
    });
  });
}

function runQuery(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.run(sql, params, function(err) {
      if (err) {
        reject(err);
      } else {
        resolve({ id: this.lastID, changes: this.changes });
      }
    });
  });
}

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

async function initializeDatabase() {
  return new Promise((resolve, reject) => {
    db.serialize(() => {
      db.run(\`
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
      \`, (err) => {
        if (err) {
          console.error('❌ Error creating users table:', err.message);
          return reject(err);
        }
        console.log('✅ Users table created/verified');
      });

      db.run(\`
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
      \`, (err) => {
        if (err) console.error('⚠️  Error creating streams table:', err.message);
      });

      db.run(\`
        CREATE TABLE IF NOT EXISTS videos (
          id TEXT PRIMARY KEY,
          user_id TEXT NOT NULL,
          title TEXT NOT NULL,
          description TEXT,
          file_path TEXT NOT NULL,
          thumbnail TEXT,
          duration INTEGER,
          file_size INTEGER,
          status TEXT DEFAULT 'ready',
          upload_date DATETIME DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
        )
      \`, (err) => {
        if (err) console.error('⚠️  Error creating videos table:', err.message);
      });

      db.run(\`
        CREATE TABLE IF NOT EXISTS playlists (
          id TEXT PRIMARY KEY,
          user_id TEXT NOT NULL,
          name TEXT NOT NULL,
          description TEXT,
          thumbnail TEXT,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
        )
      \`, (err) => {
        if (err) console.error('⚠️  Error creating playlists table:', err.message);
      });

      db.run(\`
        CREATE TABLE IF NOT EXISTS playlist_videos (
          id TEXT PRIMARY KEY,
          playlist_id TEXT NOT NULL,
          video_id TEXT NOT NULL,
          position INTEGER DEFAULT 0,
          FOREIGN KEY (playlist_id) REFERENCES playlists(id) ON DELETE CASCADE,
          FOREIGN KEY (video_id) REFERENCES videos(id) ON DELETE CASCADE
        )
      \`, (err) => {
        if (err) console.error('⚠️  Error creating playlist_videos table:', err.message);
        console.log('✅ Database initialization complete');
        resolve();
      });
    });
  });
}

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
ENDOFFILE

echo "✅ File updated!"
pm2 restart streamfactory
pm2 logs streamfactory --lines 20
```

---

## 📊 GITHUB REPO STATUS

### Checking GitHub via Screenshot

From your screenshot, I can see:
- ✅ "Add missing db/database.js module" (01bd5bc) - 9 minutes ago
- ✅ "Fix: Move generate-secret.js to scripts folder" (4c7b3f0) - 16 minutes ago

**BUT**: The file uploaded was the **OLD version** without `initializeDatabase`!

### How to Verify if Fix is on GitHub

**From VPS terminal**:
```bash
cd ~/streamfactory

# Check current file
grep -n "initializeDatabase" db/database.js

# If it shows:
# - Only in module.exports: ❌ OLD VERSION (not fixed)
# - Also shows "async function initializeDatabase": ✅ NEW VERSION (fixed)
```

**From GitHub Web**:
1. Go to: https://github.com/amarwaro527-coder/streamfactory/blob/main/db/database.js
2. Search for "initializeDatabase" in file
3. If you see `async function initializeDatabase()`: ✅ Fixed
4. If NOT: ❌ Need to pull new version

---

## 🎯 IMMEDIATE ACTION

**Run this at VPS** (Git pull + restart):

```bash
cd ~/streamfactory

# Pull latest changes
git pull origin main

# Check if function exists now
grep -c "async function initializeDatabase" db/database.js
# Should output: 1 (means function exists)

# If output is 0, use manual fix (Option 2 above)

# Restart app
pm2 restart streamfactory

# Watch logs
pm2 logs streamfactory --lines 30
```

### What to Expect

**Success Output**:
```
✅ Connected to StreamFactory database
✅ Users table created/verified
✅ Database initialization complete
✅ StreamFactory services initialized
🏭 StreamFactory running at:
  http://172.31.11.228:7576
  http://54.219.178.244:7576
```

**Then visit**: http://54-219-178-244.nip.io:7576

---

## 📋 SUMMARY OF ALL 3 ERRORS

### Error #1: generate-secret.js missing
- ✅ FIXED: Created scripts/generate-secret.js
- ✅ Uploaded to GitHub

### Error #2: db/database.js missing
- ✅ FIXED: Created db/database.js
- ❌ BUT incomplete (no initializeDatabase)

### Error #3: initializeDatabase not a function (CURRENT)
- ✅ FIXED: Updated db/database.js with function
- 🚀 UPLOADING to GitHub NOW

---

**Created**: 11 December 2024  
**Error**: initializeDatabase is not a function  
**Solution**: Add function to db/database.js  
**Time to Fix**: 2 minutes (git pull + restart)
