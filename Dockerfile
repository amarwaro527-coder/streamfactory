# Gunakan image Node.js versi 18 (atau 16+)
FROM node:18-slim

# Install ffmpeg
RUN apt-get update && apt-get install -y ffmpeg && rm -rf /var/lib/apt/lists/*

# Set working directory
WORKDIR /app

# Copy package.json dan package-lock.json
COPY package*.json ./

# Install dependencies
RUN npm install --production

# Copy seluruh source code
COPY . .

# Buat folder yang dibutuhkan
RUN mkdir -p db logs public/uploads/videos public/uploads/thumbnails audio-stems public/audio-output public/video-output

# Expose port (default 7576)
EXPOSE 7576

# Jalankan aplikasi
CMD ["npm", "start"]