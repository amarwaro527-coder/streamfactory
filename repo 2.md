# 🚀 Script Fix Upload GitHub (Repo 2)

Script ini akan memperbaiki error "Secret Scanning" dan melanjutkan upload.
Masalah sebelumnya: GitHub menolak karena ada API Key asli di file `.env.production`.

Script ini akan:
1. Stop tracking file `.env.production` (agar API key aman & tidak di-upload)
2. Commit ulang tanpa file rahasia
3. Push Core App
4. Push Audio Stems

Copy dan paste semua kode di bawah ini ke terminal PowerShell:

```powershell
# 1. Masuk ke folder project
cd "C:\Users\Administrator\Desktop\myapp\streamfactory"

# 2. Unstage file yang berisi secret (PENTING!)
git rm --cached .env.production
git rm --cached .env.example

# 3. Commit ulang (Amend) untuk hapus secret dari history
git commit --amend -m "Initial commit: StreamFactory Core App v1.0 (Clean)" --no-edit

# 4. Push Core App (Force Push karena amend)
Write-Host "🚀 Pushing Core App to GitHub..." -ForegroundColor Cyan
git push -u origin main --force

# 5. Upload Audio Stems
Write-Host "🎵 Staging Audio Stems Library..." -ForegroundColor Cyan
git add audio-stems
git commit -m "Add audio stems library"

Write-Host "🚀 Pushing Audio Stems..." -ForegroundColor Cyan
git push origin main

Write-Host "✅ SELESAI! Cek repository Anda sekarang." -ForegroundColor Green
```

---
**Catatan:**
- File `.env.production` Anda di komputer **TETAP AMAN** (tidak terhapus), hanya tidak di-upload ke GitHub.
- Ini cara paling aman agar akun GitHub Anda tidak kena flag security.
