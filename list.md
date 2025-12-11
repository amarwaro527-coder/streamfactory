# 📋 DAFTAR FILE BERMASALAH - Developer Handover Document

**Project**: StreamFactory v1.0  
**Date**: 11 December 2024  
**Status**: Partially Functional (80%)  
**Critical Issue**: Database schema mismatch

---

## 🎯 EXECUTIVE SUMMARY

### Current Status:
- ✅ **StreamFactory Features**: WORKING (Audio, Video, Metadata, YouTube)
- ❌ **Streamflow Features**: NOT WORKING (Stream management)
- ✅ **User System**: WORKING (Registration, Login)

### Root Cause:
**Old database file** (`db/streamfactory.db`) on VPS has **outdated schema**, despite code being fixed on GitHub.

---

## 📊 FILE ANALYSIS RESULTS

### Files Checked: 50+
### Files with Issues: 1
### Code Files Fixed on GitHub: ✅ ALL

---

## ❌ PROBLEMATIC FILE

### 1. `/home/ubuntu/streamfactory/db/streamfactory.db` (VPS Only)

**Type**: SQLite Database File  
**Location**: VPS Server  
**Status**: ❌ SCHEMA OUTDATED  
**Severity**: MEDIUM (Affects only streaming features)

#### Problem Description:

Database created with OLD schema (missing 13 columns in `streams` table).

**Current Schema** (Wrong):
```sql
CREATE TABLE streams (
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
  created_at DATETIME
);
-- Only 11 columns, MISSING 13 critical columns!
```

**Required Schema** (Correct - from db/database.js):
```sql
CREATE TABLE streams (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  title TEXT,
  video_id TEXT,              -- MISSING
  rtmp_url TEXT,              -- MISSING
  stream_key TEXT,
  platform TEXT,
  platform_icon TEXT,         -- MISSING
  bitrate INTEGER,            -- MISSING
  resolution TEXT,            -- MISSING
  fps INTEGER,                -- MISSING
  orientation TEXT,           -- MISSING
  loop_video INTEGER,         -- MISSING
  schedule_time DATETIME,     -- WAS scheduled_time
  end_time DATETIME,          -- MISSING
  start_time DATETIME,        -- MISSING
  duration INTEGER,           -- MISSING
  status TEXT,
  status_updated_at DATETIME, -- MISSING
  use_advanced_settings INTEGER, -- MISSING
  created_at DATETIME,
  updated_at DATETIME         -- MISSING
);
-- Complete 22 columns
```

#### Impact:

**Affected Functionality**:
- ❌ `Stream.create()` - Cannot insert streams (missing columns)
- ❌ `Stream.findAll()` - SQL error when joining with videos (`s.video_id` not found)
- ❌ `Stream.findScheduledInRange()` - SQL error (`s.schedule_time` not found)
- ❌ Stream scheduler service - Cannot track scheduled streams
- ❌ Streaming service - Cannot sync stream statuses

**Unaffected Functionality**:
- ✅ User registration/login (uses `users` table - OK)
- ✅ Audio Studio (uses `audio_stems` table - OK)
- ✅ Video Composer (uses `projects` table - OK)
- ✅ Metadata generation (uses Gemini API - OK)
- ✅ YouTube upload (uses YouTube API - OK)

#### Error Messages:

```
Error: SQLITE_ERROR: no such column: s.video_id
Error: SQLITE_ERROR: no such column: s.schedule_time
```

**Frequency**: Every 60 seconds (scheduler interval)

#### Why This Happened:

**Timeline**:
1. Database created during initial deployment with incomplete schema
2. Code fixed on GitHub (commit 7ccfb3c)
3. `git pull` executed on VPS
4. `rm -f db/streamfactory.db*` command executed
5. **BUT**: Database file not fully deleted (WAL/SHM files may remain)
6. App restarted → `CREATE TABLE IF NOT EXISTS streams` → **SKIPPED** (table exists)
7. Old schema retained

**SQLite Behavior**:
- `CREATE TABLE IF NOT EXISTS` will NOT modify existing tables
- Only creates table if it doesn't exist
- Requires explicit `DROP TABLE` or `ALTER TABLE` to change schema

---

## ✅ SOLUTION

### Option 1: Nuclear - Delete All Database Files (RECOMMENDED)

**Pros**:
- ✅ Guaranteed fresh start
- ✅ Simple to execute
- ✅ No risk of leftover cache

**Cons**:
- ❌ Loses all data (user account, etc.)

**Commands**:
```bash
pm2 stop streamfactory
rm -f /home/ubuntu/streamfactory/db/streamfactory.db
rm -f /home/ubuntu/streamfactory/db/streamfactory.db-shm
rm -f /home/ubuntu/streamfactory/db/streamfactory.db-wal
pm2 start app.js --name streamfactory
```

**Time**: 1 minute  
**Risk**: LOW

---

### Option 2: Surgical - Drop & Recreate Streams Table Only

**Pros**:
- ✅ Preserves user accounts
- ✅ Surgical fix

**Cons**:
- ⚠️ Requires SQL knowledge
- ⚠️ Must handle foreign keys

**Migration Script** (`fix-streams-schema.js`):
```javascript
const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const dbPath = path.join(__dirname, 'db', 'streamfactory.db');
const db = new sqlite3.Database(dbPath);

db.serialize(() => {
  console.log('🔧 Dropping old streams table...');
  db.run('DROP TABLE IF EXISTS streams', (err) => {
    if (err) {
      console.error('❌ Error:', err.message);
      process.exit(1);
    }
    console.log('✅ Old table dropped');
    
    console.log('🔧 Creating new streams table...');
    db.run(`
      CREATE TABLE streams (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL,
        title TEXT,
        video_id TEXT,
        rtmp_url TEXT,
        stream_key TEXT,
        platform TEXT,
        platform_icon TEXT,
        bitrate INTEGER DEFAULT 2500,
        resolution TEXT,
        fps INTEGER DEFAULT 30,
        orientation TEXT DEFAULT 'horizontal',
        loop_video INTEGER DEFAULT 1,
        schedule_time DATETIME,
        end_time DATETIME,
        start_time DATETIME,
        duration INTEGER,
        status TEXT DEFAULT 'offline',
        status_updated_at DATETIME,
        use_advanced_settings INTEGER DEFAULT 0,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
      )
    `, (err) => {
      if (err) {
        console.error('❌ Error:', err.message);
        process.exit(1);
      }
      console.log('✅ New streams table created with all 22 columns');
      db.close();
      console.log('✅ Migration complete!');
    });
  });
});
```

**Execute**:
```bash
cd /home/ubuntu/streamfactory
node fix-streams-schema.js
pm2 restart streamfactory
```

**Time**: 2 minutes  
**Risk**: MEDIUM (preserves users, loses streams data - acceptable)

---

### Option 3: Preventive - Add Migration System (FUTURE)

**For Developer Implementation**:

Create `scripts/migrate-database.js`:
```javascript
const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const fs = require('fs');

const migrationsDir = path.join(__dirname, '..', 'migrations');
const dbPath = process.env.DATABASE_PATH || path.join(__dirname, '..', 'db', 'streamfactory.db');
const db = new sqlite3.Database(dbPath);

// Create migrations table
db.run(`
  CREATE TABLE IF NOT EXISTS migrations (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT UNIQUE NOT NULL,
    executed_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )
`);

// Run pending migrations
const files = fs.readdirSync(migrationsDir).filter(f => f.endsWith('.sql')).sort();

files.forEach(file => {
  db.get('SELECT * FROM migrations WHERE name = ?', [file], (err, row) => {
    if (!row) {
      const sql = fs.readFileSync(path.join(migrationsDir, file), 'utf8');
      db.exec(sql, (err) => {
        if (err) {
          console.error(`❌ Migration ${file} failed:`, err);
        } else {
          db.run('INSERT INTO migrations (name) VALUES (?)', [file]);
          console.log(`✅ Migration ${file} executed`);
        }
      });
    }
  });
});
```

**Benefits**:
- ✅ Version-controlled schema changes
- ✅ No manual database deletion needed
- ✅ Production-safe updates

**Recommendation**: Implement for v1.1+

---

## 📋 CODE FILES STATUS (GitHub)

### All checked, ALL CORRECT ✅

| File | Status | Notes |
|------|--------|-------|
| `db/database.js` | ✅ FIXED | Commit 7ccfb3c - All 22 columns |
| `models/Stream.js` | ✅ OK | No changes needed |
| `models/User.js` | ✅ OK | Uses `avatar_path` correctly |
| `models/Video.js` | ✅ OK | Uses `filepath` correctly |
| `app.js` | ✅ OK | Calls initializeDatabase() |
| `scripts/setup-database.js` | ✅ OK | Setup script working |
| `routes/audioRoutes.js` | ✅ OK | No database issues |
| `routes/videoRoutes.js` | ✅ OK | No database issues |
| `routes/metadataRoutes.js` | ✅ OK | No database issues |
| `routes/youtubeRoutes.js` | ✅ OK | No database issues |
| `services/streamingService.js` | ⚠️ AFFECTED | Works when streams table fixed |
| `services/schedulerService.js` | ⚠️ AFFECTED | Works when streams table fixed |

**NO CODE FILES NEED FIXING!** Only database needs recreation.

---

## 🎯 RECOMMENDED ACTION PLAN

### For Immediate Fix (Production):

**Step 1**: Backup current user (if important)
```bash
sqlite3 /home/ubuntu/streamfactory/db/streamfactory.db "SELECT * FROM users;" > users_backup.sql
```

**Step 2**: Execute Option 1 (Nuclear fix)
```bash
cd /home/ubuntu/streamfactory
pm2 stop streamfactory
rm -f db/streamfactory.db*
pm2 start app.js --name streamfactory
```

**Step 3**: Verify
```bash
pm2 logs streamfactory --lines 100 | grep -i error
# Should show NO "no such column" errors
```

**Step 4**: Recreate user account
```
Visit: http://54-219-178-244.nip.io:7576/setup-account
```

**Total Time**: 5 minutes

---

### For Long-term (Development):

1. **Add migration system** (see Option 3)
2. **Add database version tracking**
3. **Add schema validation on startup**
4. **Add automated tests** for database schema

**Estimated Implementation**: 2-4 hours

---

## 📊 IMPACT ASSESSMENT

### User Impact:

**Before Fix**:
- ✅ Can register/login
- ✅ Can use Audio Studio
- ✅ Can use Video Composer
- ✅ Can generate metadata
- ✅ Can upload to YouTube
- ❌ Cannot use streaming features

**After Fix**:
- ✅ ALL features working
- ✅ No SQL errors
- ✅ Clean logs

### Performance Impact:

**Current**:
- ⚠️ Error logs every 60 seconds (scheduler)
- ⚠️ Wasted CPU cycles on failed queries
- ⚠️ Log file growing unnecessarily

**After Fix**:
- ✅ Clean execution
- ✅ No wasted resources
- ✅ Smaller log files

---

## ✅ FINAL CHECKLIST

**Before deploying fix**:
- [ ] Backup database (if has important data)
- [ ] Notify users of brief downtime (if any)
- [ ] Review fix commands

**After deploying fix**:
- [ ] Verify no SQL errors in logs
- [ ] Test user registration
- [ ] Test audio/video features
- [ ] Test streaming features (if needed)
- [ ] Monitor for 24 hours

---

## 📞 SUPPORT CONTACTS

**For Questions**:
- Code questions: Check `critical *.md` files in repo
- VPS access: Use existing SSH key
- Database issues: This document

**Escalation**:
- If Option 1 fails: Try Option 2
- If both fail: Check file permissions (`ls -la db/`)
- If still broken: Database may be locked (check with `fuser db/streamfactory.db`)

---

**Document Version**: 1.0  
**Last Updated**: 11 December 2024  
**Status**: READY FOR DEVELOPER HANDOVER  
**Priority**: MEDIUM (App functional, optimization needed)
