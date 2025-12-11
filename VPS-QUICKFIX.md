# 🚨 VPS QUICK FIX - Copy Paste Commands

**Problem**: `generate-secret.js` missing di VPS  
**Solution**: Generate secret manual & lanjutkan deployment

Copy semua command di bawah dan paste ke VPS terminal (satu blok!):

```bash
# Generate session secret
NEW_SECRET=$(node -e "console.log(require('crypto').randomBytes(32).toString('hex'))")

# Update .env automatically
sed -i "s/SESSION_SECRET=.*/SESSION_SECRET=$NEW_SECRET/" .env

# Verify
echo "✅ Secret updated! Your new SESSION_SECRET:"
grep SESSION_SECRET .env

# Setup database
npm run setup-db

# Create required directories
mkdir -p db logs public/uploads/videos public/uploads/thumbnails
mkdir -p public/audio-output public/video-output

# Start app with PM2
pm2 start app.js --name streamfactory

# View logs
pm2 logs streamfactory --lines 50
```

**Setelah paste command di atas, cek apakah app running**:
- Jika muncul "StreamFactory running at..." → ✅ SUCCESS!
- Buka browser: http://54-219-178-244.nip.io:7576

---

**Jika ada error, run**:
```bash
pm2 logs streamfactory --lines 100
```
