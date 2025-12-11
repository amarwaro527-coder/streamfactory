# 🏭 StreamFactory v1.0

**The Ultimate Self-Hosted Content Automation Platform**

StreamFactory combines the stability of live streaming with advanced audio generation, video assembly, and AI-powered automation - all from your own server.

![Status](https://img.shields.io/badge/status-production--ready-green)
![Version](https://img.shields.io/badge/version-1.0.0-blue)
![License](https://img.shields.io/badge/license-MIT-green)
![Node](https://img.shields.io/badge/node-%3E%3D16-brightgreen)

---

## ✨ Features

### 🎥 Live Streaming
- **Multi-Platform Streaming** - Stream to YouTube, Facebook, and any RTMP endpoint simultaneously
- **Video Gallery** - Manage your video library with intuitive interface
- **Upload & Import** - Upload from local storage or import from Google Drive
- **Scheduled Streaming** - Set up automated streaming schedules
- **Real-time Monitoring** - Monitor streams with live statistics

### 🎵 Audio Generation
- **Advanced Audio Engine** - Generate 1-10 hour ambient audio tracks
- **Complex Mixing** - Randomized volume drift and stereo panning
- **Preset System** - Pre-configured audio packs (Rain, Thunder, Forest, Ocean)
- **Custom Mix** - Create your own audio combinations from 13+ stems
- **High Quality** - Professional-grade audio output

### 🎬 Video Assembly
- **Ping-Pong Looping** - Seamless A→Reverse→A looping (no jump cuts!)
- **Standard Looping** - Traditional loop concatenation
- **Auto-Duration Matching** - Video length matches audio automatically
- **Efficient Processing** - Uses FFmpeg concat demuxer (10x faster!)

### 🤖 AI-Powered Metadata
- **Gemini AI Integration** - Auto-generate SEO-friendly titles and descriptions
- **Smart Tags** - Keyword extraction for maximum discoverability
- **Real-time Preview** - See how metadata will appear on YouTube
- **Manual Override** - Full control over all metadata fields

### 📺 YouTube Automation
- **Direct Upload** - Upload videos directly to YouTube
- **OAuth2 Authentication** - Secure Google account integration
- **Resumable Uploads** - Handle network interruptions gracefully
- **Channel Management** - View channel info and recent uploads
- **Metadata Management** - Apply AI-generated or custom metadata

### ⚡ Production-Ready Infrastructure
- **Background Jobs** - BullMQ job queue with retry logic (optional Redis)
- **Real-time Updates** - Socket.io for live progress monitoring
- **Graceful Degradation** - Works with or without Redis
- **User Management** - Role-based access control
- **Responsive UI** - Modern interface that works on all devices
- **Security** - bcrypt, CSRF protection, rate limiting, session management

---

## 🚀 Quick Start

### Prerequisites
- **Node.js** v16 or later (v20 recommended)
- **FFmpeg** (included via npm package or install system-wide)
- **Optional**: Redis (for background job processing)

### Installation

1. **Clone the repository**
   ```bash
   git clone https://github.com/sambatyoi/streamfactory
   cd streamfactory
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Configure environment**
   ```bash
   cp .env.example .env
   nano .env
   ```

4. **Generate session secret**
   ```bash
   npm run generate-secret
   ```

5. **Setup database**
   ```bash
   npm run setup-db
   ```

6. **Seed audio stems** (optional)
   ```bash
   npm run seed-audio
   ```

7. **Start the application**
   ```bash
   npm start
   # or for development with auto-reload
   npm run dev
   ```

8. **Access the application**
   ```
   http://localhost:7576
   ```

9. **Create admin account**
   - Navigate to `http://localhost:7576/setup-account`
   - Follow the setup wizard

---

## 📋 System Requirements

### Minimum (Testing/Personal Use)
- CPU: 2 cores
- RAM: 2 GB
- Storage: 20 GB
- Bandwidth: 10 Mbps upload

### Recommended (Production/Multiple Users)
- CPU: 4+ cores
- RAM: 4-8 GB
- Storage: 100 GB SSD
- Bandwidth: 50+ Mbps upload

---

## 🔧 Configuration

### API Keys

**Google OAuth & YouTube** (for YouTube upload feature):
1. Go to [Google Cloud Console](https://console.cloud.google.com)
2. Create project and enable YouTube Data API v3
3. Create OAuth 2.0 credentials
4. Add authorized redirect URI: `http://localhost:7576/youtube/callback`
5. Add to `.env`:
   ```env
   GOOGLE_CLIENT_ID=your_client_id
   GOOGLE_CLIENT_SECRET=your_client_secret
   GOOGLE_REDIRECT_URI=http://localhost:7576/youtube/callback
   ```

**Gemini AI** (for metadata generation):
1. Visit [Google AI Studio](https://makersuite.google.com/app/apikey)
2. Create API key
3. Add to `.env`:
   ```env
   GEMINI_API_KEY=your_api_key
   ```

### Redis (Optional)

For background job processing:
```bash
# Ubuntu/Debian
sudo apt install redis-server

# macOS
brew install redis

# Or use Docker
docker run -d -p 6379:6379 redis:7-alpine
```

Enable in `.env`:
```env
USE_JOB_QUEUE=true
REDIS_HOST=localhost
REDIS_PORT=6379
```

**Note**: Application works perfectly without Redis - jobs will process synchronously.

---

## 🐳 Docker Deployment

### Quick Start with Docker Compose

```bash
# Build and start
docker-compose up -d

# View logs
docker-compose logs -f

# Stop
docker-compose down
```

### Manual Docker

```bash
# Build image
docker build -t streamfactory .

# Run container
docker run -d \
  -p 7576:7576 \
  -v $(pwd)/db:/app/db \
  -v $(pwd)/audio-stems:/app/audio-stems \
  --env-file .env \
  --name streamfactory \
  streamfactory
```

---

## 📖 Documentation

- **Installation Guide**: See above Quick Start
- **API Documentation**: `docs/AUDIO_SERVICE.md`, `docs/VIDEO_SERVICE.md`
- **Code Analysis**: `list.md` - Complete code compatibility report
- **GitHub Readiness**: `GITHUB_READY.md` - Pre-deployment checklist

---

## 🔒 Security

- ✅ **bcrypt** password hashing
- ✅ **CSRF** protection
- ✅ **Rate limiting** on sensitive endpoints
- ✅ **Session management** with secure cookies
- ✅ **Input validation** on all forms
- ✅ **Secure file uploads** with validation
- ✅ **SQL injection prevention** via parameterized queries

---

## 🛠️ Tech Stack

| Component | Technology |
|-----------|-----------|
| **Backend** | Express.js |
| **Database** | SQLite3 |
| **Queue** | BullMQ + Redis (optional) |
| **Real-time** | Socket.io |
| **Media** | FFmpeg |
| **AI** | Google Gemini Pro |
| **APIs** | YouTube Data API v3 |
| **Auth** | bcrypt + express-session |
| **UI** | Bootstrap 5 + EJS |

---

## 📊 Project Structure

```
streamfactory/
├── app.js                 # Main application file
├── package.json           # Dependencies
├── Dockerfile             # Docker image
├── docker-compose.yml     # Docker Compose config
├── .env.example           # Environment template
│
├── services/              # Business logic
│   ├── socketService.js   # Socket.io real-time
│   ├── jobQueueService.js # Background jobs
│   ├── audioService.js    # Audio generation
│   ├── videoService.js    # Video assembly
│   ├── aiService.js       # Gemini AI
│   └── youtubeService.js  # YouTube API
│
├── routes/                # API endpoints
│   ├── audioRoutes.js
│   ├── videoRoutes.js
│   ├── metadataRoutes.js
│   └── youtubeRoutes.js
│
├── models/                # Database models
│   ├── User.js
│   ├── Project.js
│   └── AudioModels.js
│
├── views/                 # EJS templates
│   ├── audio-studio.ejs
│   ├── video-composer.ejs
│   ├── metadata-editor.ejs
│   └── youtube-publisher.ejs
│
├── public/                # Static assets
│   ├── js/                # Client-side scripts
│   ├── css/               # Stylesheets
│   └── uploads/           # User uploads
│
├── scripts/               # Utility scripts
│   ├── setup-database.js
│   ├── seed-audio-stems.js
│   └── generate-secret.js
│
└── docs/                  # Documentation
    ├── AUDIO_SERVICE.md
    └── VIDEO_SERVICE.md
```

---

## 🎯 Use Cases

**Content Creators**:
- Generate hours of ambient audio (rain, nature sounds)
- Create looping videos with matching audio
- Auto-generate SEO metadata
- Upload directly to YouTube

**Streamers**:
- Schedule multi-platform streams
- Manage video library
- Automated content publishing

**Developers**:
- Self-hosted alternative to cloud services
- Full control over data and processing
- Extensible architecture

---

## 📄 License

MIT License - see [LICENSE.md](LICENSE.md)

Copyright (c) 2025 Sambatyoi

---

## 🙏 Acknowledgments

Built by combining:
- **Streamflow** - Stable live streaming foundation
- **Rainfactory** - Advanced audio/video automation features

Special thanks to:
- FFmpeg community
- Node.js ecosystem
- Google Gemini AI
- YouTube Data API

---

## 🗺️ Roadmap

- [x] **Phase 1**: Foundation & Live Streaming
- [x] **Phase 2**: Audio Generation
- [x] **Phase 3**: Video Assembly
- [x] **Phase 4**: AI Metadata
- [x] **Phase 5**: YouTube Upload
- [x] **Phase 6**: Job Queue & Polish
- [ ] **Phase 7**: Mobile App
- [ ] **Phase 8**: Cloud Storage Integration
- [ ] **Phase 9**: Advanced Analytics
- [ ] **Phase 10**: Multi-language Support

---

## 📞 Contributing

Contributions are welcome! Please feel free to submit pull requests or open issues.

---

**Current Version**: 1.0.0  
**Status**: Production Ready  
**Last Updated**: December 2024

---

**Made with ❤️ for the content creation community**
