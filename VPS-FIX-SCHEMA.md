# 🚀 VPS QUICK FIX - Database Schema Update

**Problem**: Column name mismatch (file_path vs filepath)  
**Solution**: Delete database dan pull schema baru

Copy semua command di bawah dan paste ke VPS terminal:

```bash
cd ~/streamfactory

# Stop app
pm2 stop streamfactory

# Backup database (just in case)
cp db/streamfactory.db db/streamfactory.db.before-schema-fix

# Delete database (will be recreated with correct schema)
rm db/streamfactory.db

# Pull  fixed schema from GitHub
git pull origin main

# Restart app (will auto-create correct tables)
pm2 restart streamfactory

# Watch logs for success
pm2 logs streamfactory --lines 50
```

---

## ✅ Expected Output (NO Red Errors!):

```
✅ Connected to StreamFactory database
✅ Users table created/verified
✅ Database initialization complete
✅ StreamFactory services initialized
🏭 StreamFactory running at:
  http://172.31.11.228:7576
Stream scheduler initialized
[StreamingService] Syncing stream statuses...  ← NO ERROR!
```

---

## 🎯 After Fix - Test App:

**Open browser**:
```
http://54-219-178-244.nip.io:7576/setup-account
```

Create admin account dan login! 🎉
