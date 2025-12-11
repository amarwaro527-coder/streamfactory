# Video Service - API Documentation

**StreamFactory Video Assembly Engine**  
**Version**: 1.0.0  
**Module**: `services/videoService.js`

---

## Overview

The Video Service provides advanced video assembly capabilities with support for:
- **Ping-pong looping** (A → Reverse → A for seamless transitions)
- **Standard looping** (traditional A → A → A repetition)
- **FFmpeg concat demuxer** (super fast, no re-encoding)
- **Progress tracking** via callbacks
- **Automatic temp file cleanup**

---

## Core Methods

### `assembleVideo(config, progressCallback)`

Main method to assemble looping video with audio.

**Parameters**:
```javascript
{
  videoPath: string,        // Path to source video file
  audioPath: string,        // Path to audio file
  audioDuration: number,    // Audio duration in seconds
  loopType: 'ping-pong' | 'standard',  // Loop algorithm
  outputName: string?       // Optional output filename
}
```

**Returns**: Promise<Object>
```javascript
{
  success: true,
  outputPath: '/absolute/path/to/video.mp4',
  relativePath: '/video-output/video.mp4',
  duration: 3600,
  loopType: 'ping-pong',
  generationTime: 125.5,
  fileSize: 524288000,
  fileName: 'video_1234567890.mp4',
  videoInfo: { /* metadata */ }
}
```

**Example**:
```javascript
const config = {
  videoPath: './public/uploads/videos/nature_loop.mp4',
  audioPath: './public/audio-output/rain_10min.mp3',
  audioDuration: 600,
  loopType: 'ping-pong'
};

const result = await videoService.assembleVideo(config, (progress, message) => {
  console.log(`${progress}%: ${message}`);
});
```

---

### `getVideoDuration(videoPath)`

Get video duration using FFprobe.

**Returns**: Promise<number> (duration in seconds)

**Example**:
```javascript
const duration = await videoService.getVideoDuration('./video.mp4');
console.log(`Duration: ${duration}s`);
```

---

### `getVideoInfo(videoPath)`

Get comprehensive video metadata.

**Returns**: Promise<Object>
```javascript
{
  duration: 30.5,
  size: 5242880,
  bitrate: 1500000,
  format: 'mov,mp4,m4a,3gp,3g2,mj2',
  video: {
    codec: 'h264',
    width: 1920,
    height: 1080,
    fps: 30
  },
  audio: {
    codec: 'aac',
    sampleRate: 48000,
    channels: 2
  }
}
```

---

### `createReversedVideo(inputPath, outputPath, progressCallback)`

Create reversed version of video for ping-pong effect.

**Note**: This is computationally expensive. Progress updates are provided via callback.

---

### `mergeVideoWithAudio(concatListPath, audioPath, outputPath, duration, progressCallback)`

Merge concatenated video segments with audio using FFmpeg.

**Uses**:
- Concat demuxer (no video re-encoding!)
- AAC audio encoding (192kbps)
- Fast start for streaming

---

### `getAvailableVideos(userId)`

Get all videos from user's gallery for selection.

**Returns**: Promise<Array>

---

### `deleteVideo(fileName)`

Delete assembled video file.

---

### `cleanupTempFiles(olderThanHours)`

Cleanup old temporary files.

**Default**: 24 hours

**Returns**: Promise<{cleaned: number}>

---

## Loop Types

### Ping-Pong Looping

**Algorithm**:
1. Take source video A (e.g., 10s)
2. Create reversed version A_rev
3. Loop pattern: A → A_rev → A → A_rev...
4. Total segment: 20s per cycle
5. Repeat until audio duration met

**Benefits**:
- Seamless transitions (no jump cuts)
- Natural flow
- Perfect for nature/ambient videos

**Diagram**:
```
Original:  →→→→→→→→→→
Reversed:   ←←←←←←←←←←
Pattern:   →→→→←←←←→→→→←←←←
```

### Standard Looping

**Algorithm**:
1. Take source video A
2. Repeat: A → A → A → A...
3. Cut to audio duration

**Benefits**:
- Simple and straightforward
- Works for any video type
- Faster processing (no reverse needed)

**Use When**:
- Video has intro/outro that should repeat
- Content is directional (e.g., walking forward)

---

## Performance

### Ping-Pong Looping

| Source Video | Audio Duration | Processing Time |
|--------------|----------------|-----------------|
| 10s clip     | 1 hour         | ~5-7 minutes    |
| 30s clip     | 1 hour         | ~3-4 minutes    |
| 10s clip     | 10 hours       | ~25-30 minutes  |

**Bottleneck**: Creating reversed video (first time only)

### Standard Looping

| Source Video | Audio Duration | Processing Time |
|--------------|----------------|-----------------|
| 10s clip     | 1 hour         | ~2-3 minutes    |
| 30s clip     | 1 hour         | ~1-2 minutes    |
| 10s clip     | 10 hours       | ~8-10 minutes   |

**Faster** because no reverse needed!

---

## Best Practices

### Video Selection

**Good Choices**:
- ✅ 5-30 second loops
- ✅ Seamless start/end (for standard loop)
- ✅ Nature scenes (rain, fire, water)
- ✅ Abstract patterns
- ✅ Slow motion footage

**Avoid**:
- ❌ Clips with sudden changes
- ❌ Videos with people talking
- ❌ Content with specific start/end

### Loop Type Selection

**Use Ping-Pong When**:
- Video has distinct start/end
- Want smoother transitions
- Content is symmetrical

**Use Standard When**:
- Video is already seamless
- Processing speed matters
- Content is directional

### Output Optimization

**For YouTube/Streaming**:
```javascript
outputOptions: [
  '-c:v', 'copy',              // No video re-encode
  '-c:a', 'aac',               // AAC audio
  '-b:a', '192k',              // Good quality audio
  '-movflags', '+faststart'    // Enable streaming
]
```

**For Archive/Download**:
```javascript
outputOptions: [
  '-c:v', 'libx264',           // Re-encode video
  '-preset', 'slow',           // Better compression
  '-crf', '18',                // High quality
  '-c:a', 'aac',               
  '-b:a', '320k'               // Higher audio quality
]
```

---

## Error Handling

Common errors and solutions:

### "Video file not found"
- Check file path is absolute
- Verify file exists on disk
- Check file permissions

### "Audio file not found"
- Ensure audio was generated first
- Check audio-output directory
- Verify path formatting

### "FFmpeg error: Invalid data"
- Source video may be corrupted
- Try different video format
- Re-upload source video

### "Out of disk space"
- Video assembly uses ~2-3x audio file size
- Clear old temp files
- Use cleanup method

---

## Integration Example

```javascript
// In routes/videoRoutes.js
const videoService = require('../services/videoService');
const jobQueueService = require('../services/jobQueueService');

app.post('/api/video/assemble', async (req, res) => {
  const processor = async (data, updateProgress) => {
    return await videoService.assembleVideo(
      data.config,
      updateProgress
    );
  };

  const result = await jobQueueService.addJob(
    'video',
    'assemble',
    { config },
    processor
  );

  res.json(result);
});
```

---

## Future Enhancements

- [ ] Multiple video sources (mix different clips)
- [ ] Transition effects (fade, dissolve, etc.)
- [ ] Video filters (blur, brightness, saturation)
- [ ] Custom overlay (watermark, text)
- [ ] Batch processing
- [ ] Cloud storage integration

---

**Last Updated**: 11 December 2024  
**Maintainer**: StreamFactory Development Team
