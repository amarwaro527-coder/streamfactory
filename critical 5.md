# 🚨 CRITICAL #5 - Push Failed & Duplicate PM2 Instances

**Status**: ❌ FIX NOT ON GITHUB  
**Cause**: Git workflow issue + PM2 duplicate  
**Severity**: HIGH

---

## 🔍 ROOT CAUSE ANALYSIS

### Why git pull Said "Already up to date"

**Terminal Output**:
```bash
git pull origin main
Already up to date.  ← FIX TIDAK ADA DI GITHUB!
```

**What Happened**:
1. ✅ I created fixed `db/database.js` locally
2. ❌ BUT: Push command returned "Everything up-to-date"
3. ❌ REASON: File changes were NOT committed properly

**Git Workflow Issue**:
```bash
# What should have happened:
git add db/database.js
git commit -m "Fix schema"
git push origin main

# What actually happened:
git add db/database.js  ← Added old version
<file was rewritten>    ← Changes AFTER git add!
git commit              ← Nothing to commit (no changes staged)
git push                ← "Everything up-to-date"
```

**Result**: Fixed `db/database.js` is ONLY on my local machine, NOT on GitHub!

---

## 🚨 ADDITIONAL ISSUES FOUND

### Issue #1: Duplicate PM2 Instances

**PM2 Status Shows**:
```bash
│ 0  │ streamfactory  │ ... │ online  │ 502 restarts │
│ 1  │ streamfactory  │ ... │ online  │ 0 restarts   │
```

**2 instances running!**

**Error Log**:
```bash
0|streamfactory  | Error: listen EADDRINUSE: address already in use 0.0.0.0:7576
```

**Why This Happened**:
- Instance 0: Original app (502 restarts due to errors)
- Instance 1: New app started by `pm2 restart`
- Both trying to listen on port 7576
- Instance 1 succeeded, Instance 0 keeps crashing

**Impact**:
- Confusing logs (2 sets of errors)
- Resource waste
- Harder to debug

---

### Issue #2: User Model Schema Mismatch

**New Error**:
```bash
1|streamfactory | User creation error: SQLITE_ERROR: table users has no column named avatar_path
```

**Problem**:
- User model code expects: `avatar_path`
- Database table has: `avatar`

**This is SAME problem as videos table!**

---

## ✅ COMPLETE FIX PLAN

### Fix #1: Properly Push db/database.js

**Already executing**:
```bash
cd C:\Users\Administrator\Desktop\myapp\streamfactory
git add -A
git commit -m "Fix: Database schema"
git push origin main
```

### Fix #2: Clean PM2 Instances

**On VPS, run**:
```bash
# Delete ALL streamfactory instances
pm2 delete all

# Start fresh with ONE instance
pm2 start app.js --name streamfactory

# Save config
pm2 save

# Setup startup
pm2 startup
```

### Fix #3: Update Database Schema (Again!)

**db/database.js needs one more fix**:

Current users table:
```javascript
avatar TEXT,  ← WRONG! Should be avatar_path
```

Should be:
```javascript
avatar_path TEXT,
```

---

## 📊 ALL SCHEMA ISSUES

### Videos Table (Critical #4)
- ❌ `file_path` → ✅ `filepath`
- ❌ `thumbnail` → ✅ `thumbnail_path`
- ❌ `file_size` → ✅ `filesize`
- Missing: `resolution`, `bitrate`, `fps`

**Status**: ✅ Fixed locally, ❌ NOT on GitHub yet

### Users Table (NEW!)
- ❌ `avatar` → ✅ `avatar_path`

**Status**: ❌ NOT fixed yet

---

## 🚀 COMPLETE VPS FIX SCRIPT

**After GitHub push completes, run on VPS**:

```bash
# 1. Clean PM2 completely
pm2 delete all

# 2. Delete database
cd ~/streamfactory
rm -f db/streamfactory.db*

# 3. Pull fixed schema
git pull origin main

# Verify fix is on GitHub:
grep "avatar_path TEXT" db/database.js
grep "filepath TEXT NOT NULL" db/database.js

# If both grep return results: ✅ Fix is there!

# 4. Start fresh
pm2 start app.js --name streamfactory

# 5. Watch for success (NO red errors)
pm2 logs streamfactory --lines 50
```

---

## ✅ EXPECTED OUTPUT (After Fix)

**NO errors like**:
```
❌ Error: no such column: v.filepath
❌ Error: no such column: avatar_path
❌ Error: listen EADDRINUSE
```

**ONLY green checkmarks**:
```
✅ Connected to StreamFactory database
✅ Users table created/verified
✅ Database initialization complete
✅ StreamFactory services initialized
🏭 StreamFactory running at: http://172.31.11.228:7576
Stream scheduler initialized
[StreamingService] Syncing stream statuses...  ← NO ERROR!
```

---

## 📋 VERIFICATION CHECKLIST

### Before Proceeding

On VPS, verify fix is on GitHub:
```bash
cd ~/streamfactory
git fetch origin main
git log origin/main --oneline -5

# Should show recent commit with "Fix: Database schema"
```

### After VPS Fix

1. **No PM2 duplicates**:
   ```bash
   pm2 status
   # Should show ONLY 1 streamfactory instance
   ```

2. **No SQL errors**:
   ```bash
   pm2 logs streamfactory --lines 100 --err
   # Should show NO "no such column" errors
   ```

3. **App accessible**:
   ```
   http://54-219-178-244.nip.io:7576
   # Should load without errors
   ```

---

## 🎯 WHY THIS KEEPS HAPPENING

**Core Issue**: Streamflow vs StreamFactory schema mismatch

**Timeline**:
1. Streamflow (original): Used columns like `filepath`, `avatar_path`
2. I created database schema using modern convention: `file_path`, `avatar`
3. But ALL existing Streamflow code still references old names!

**Proper Fix**: Match NEW database schema to OLD Streamflow code

**Why Not Fix Code Instead?**:
- 100+ SQL queries to update
- Risk of breaking working features
- 1 file change (database.js) vs 20+ file changes

---

## 📝 UPDATED db/database.js (FINAL VERSION)

**Users table** (line ~85):
```javascript
CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  username TEXT UNIQUE NOT NULL,
  password TEXT NOT NULL,
  email TEXT,
  user_role TEXT DEFAULT 'user',
  status TEXT DEFAULT 'active',
  avatar_path TEXT,          ← CHANGED FROM avatar
  youtube_access_token TEXT,
  youtube_refresh_token TEXT,
  gemini_api_key TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
)
```

**Videos table** (line ~135):
```javascript
CREATE TABLE IF NOT EXISTS videos (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  title TEXT NOT NULL,
  description TEXT,
  filepath TEXT NOT NULL,        ← NO underscore
  thumbnail_path TEXT,           ← WITH underscore
  duration INTEGER,
  filesize INTEGER,              ← NO underscore
  resolution TEXT,               ← NEW
  bitrate INTEGER,               ← NEW
  fps INTEGER,                   ← NEW
  status TEXT DEFAULT 'ready',
  upload_date DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
)
```

---

## 🚨 SUMMARY

**What Went Wrong**:
1. ❌ Git push didn't actually push (workflow issue)
2. ❌ PM2 created duplicate instances (restart instead of reload)
3. ❌ Found NEW schema mismatch (avatar vs avatar_path)

**Current Status**:
- ✅ Fix being pushed to GitHub NOW
- ⏳ Waiting for push to complete
- ⏳ Then VPS can pull and restart

**Next Steps**:
1. Wait for git push confirmation
2. Run VPS fix script (delete PM2, pull, restart)
3. Verify NO red errors

---

**Created**: 11 December 2024  
**Issue**: Push failed + duplicate PM2 + avatar_path mismatch  
**Fix**: Proper git commit + PM2 cleanup + schema update  
**Time to Fix**: 5 minutes
