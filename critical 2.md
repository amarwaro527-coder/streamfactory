# 🚨 CRITICAL ERROR #2 - Missing Database Module

**Error**: `Cannot find module '../db/database'`  
**Status**: ❌ BLOCKING APP STARTUP  
**Severity**: CRITICAL

---

## 🔍 ERROR ANALYSIS

### Terminal Output
```bash
npm start

Error: Cannot find module '../db/database'
Require stack:
- /home/ubuntu/streamfactory/models/User.js
- /home/ubuntu/streamfactory/app.js
```

### Root Cause

**File Missing**: `db/database.js`

**models/User.js Line 1**:
```javascript
const { db, checkIfUsersExist } = require('../db/database');
                                           ^^^^^^^^^^^^^^^^
                                           FILE NOT FOUND!
```

**Actual Folder Structure**:
```
streamfactory/
└── db/
    └── streamfactory.db  ← Database file ADA
    └── database.js       ← Module TIDAK ADA!
```

---

## 🎯 WHY THIS HAPPENED

### Merge Issue Between Streamflow & Rainfactory

**StreamFactory = Streamflow + Rainfactory merged**

1. **Streamflow** (original base):
   - Has `db/database.js` module
   - Uses centralized database connection
   - All models require `'../db/database'`

2. **Rainfactory** (merged features):
   - Uses SQLite directly in scripts
   - No centralized database module

3. **StreamFactory** (merged result):
   - ❌ Models from Streamflow (User.js, Stream.js, etc.) still require `db/database.js`
   - ❌ File `db/database.js` was NOT copied/created during merge
   - ✅ Only database FILE exists (`streamfactory.db`)

### During GitHub Upload

Terminal log shows:
```bash
77 files changed, 29633 insertions(+)
create mode 100644 db/streamfactory.db
```

**File `db/database.js` was never committed!**

Possible reasons:
1. File was in `.gitignore` (UNLIKELY)
2. File was not created during merge
3. File was lost during git amend when fixing secrets

---

## ✅ SOLUTION

### Critical Missing File: `db/database.js`

**This file provides**:
- SQLite database connection
- Helper function `checkIfUsersExist()`
- Query helpers (runQuery, getOne, getAll)

**Complete File Content**:

```javascript
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
    db.run(sql, params, function(err) {
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
  runQuery,
  getOne,
  getAll
};
```

---

## 🚀 FIX OPTIONS

### Option 1: Create File Directly di VPS (FASTEST!)

**Di VPS terminal**:
```bash
cd ~/streamfactory

# Create db/database.js
cat > db/database.js << 'EOF'
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
  runQuery,
  getOne,
  getAll
};
EOF

# Verify file created
ls -lh db/database.js

# Try starting app again
npm start
```

**Estimasi**: 1 menit ✅

---

### Option 2: Upload via GitHub (PERMANENT FIX)

**Di komputer local (Windows)**:

File `db/database.js` sudah saya buatkan. Upload ke GitHub:

```powershell
cd C:\Users\Administrator\Desktop\myapp\streamfactory

# Add file
git add db/database.js

# Commit
git commit -m "Add missing db/database.js module"

# Push
git push origin main
```

**Di VPS**:
```bash
cd ~/streamfactory
git pull origin main
npm start
```

**Estimasi**: 3 menit ✅

---

## 📊 RELATED WARNINGS

### Setup Database Warnings

Terminal output juga menunjukkan:
```bash
⚠️  Could not add youtube_access_token column: SQLITE_ERROR: no such table: users
⚠️  Could not add youtube_refresh_token column: SQLITE_ERROR: no such table: users
⚠️  Could not add gemini_api_key column: SQLITE_ERROR: no such table: users
```

**This is EXPECTED** karena:
1. `users` table belum dibuat saat `setup-database.js` run
2. StreamFactory database schema hanya create new tables (projects, audio_stems, dll)
3. Tabel `users` dari Streamflow belum ada

**Solution** (will auto-create when app starts):
- App will create `users` table on first run
- Or run original Streamflow migration scripts

**Not Blocking**: App akan tetap jalan, hanya YouTube OAuth features yang perlu table users.

---

## ✅ VERIFICATION AFTER FIX

### Expected Output

```bash
npm start

> streamfactory@1.0.0 start
> node app.js

Logger initialized. Output will be written to console and logs/app.log
✅ Connected to StreamFactory database
✅ StreamFactory services initialized
✅ Socket.io initialized
🏭 StreamFactory running at:
  http://172.31.11.228:7576
  http://54.219.178.244:7576
```

### Test Access

```bash
# From VPS
curl http://localhost:7576

# From browser
http://54-219-178-244.nip.io:7576
```

---

## 🎯 IMMEDIATE ACTION

**Copy command ini ke VPS terminal** (Option 1 - Fastest):

```bash
cd ~/streamfactory && cat > db/database.js << 'DBMODULE'
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
  runQuery,
  getOne,
  getAll
};
DBMODULE

echo "✅ File created! Starting app..."
npm start
```

**Copy blok di atas (termasuk semua baris) dan paste ke VPS!**

---

## 📋 SUMMARY

**Issue**: Missing `db/database.js` module  
**Impact**: App cannot start  
**Cause**: File not uploaded to GitHub during merge  
**Fix**: Create file manually (1 min) or upload via GitHub (3 min)  
**Status**: SOLVABLE ✅

---

**Created**: 11 December 2024  
**Error**: MODULE_NOT_FOUND '../db/database'  
**Solution**: File content provided  
**Time to Fix**: 1-3 minutes
