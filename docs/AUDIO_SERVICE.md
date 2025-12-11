# Audio Service - Feature Documentation

## Overview

The Audio Service provides advanced audio generation capabilities with complex mixing, dynamic volume curves, and stereo panning effects.

## Key Features

### 1. Dynamic Volume Drift
- Generates natural-sounding volume variations over time
- Configurable volatility (0-1) controls randomness
- Prevents static, unnatural audio

### 2. Stereo Panning
- Random stereo positioning for each stem
- Spatial drift parameter creates movement
- Enhances immersion and depth

### 3. Multi-Stem Mixing
- Support for up to 10 audio stems simultaneously
- Individual volume control per stem
- Automatic normalization to prevent clipping

### 4. Database Integration
- Presets stored in database
- Stem library management
- Easy preset selection

### 5. Progress Tracking
- Real-time progress callbacks
- Integration with Socket.io for live updates
- Accurate time estimation

## API Reference

### `generateAudio(config, progressCallback)`

Generates mixed audio from multiple stems.

**Parameters:**
```javascript
{
  stems: [{ id: 1, volume: 0.7 }, ...],  // Array of stem configurations
  duration: 3600,                         // Duration in seconds
  volatility: 0.3,                        // Volume drift (0-1)
  density: 0.7,                           // Layer density (0-1)
  spatialDrift: 0.5,                      // Stereo movement (0-1)
  outputName: 'custom_mix.mp3'            // Optional filename
}
```

**Returns:**
```javascript
{
  success: true,
  outputPath: '/full/path/to/audio.mp3',
  relativePath: '/audio-output/audio.mp3',
  duration: 3600,
  stems: 3,
  generationTime: 125.5,
  fileSize: 52428800,
  fileName: 'audio_1234567890.mp3'
}
```

### `generateFromPreset(presetId, duration, customConfig, progressCallback)`

Generate audio using a saved preset.

**Example:**
```javascript
const result = await audioService.generateFromPreset(
  1,              // Preset ID
  7200,           // 2 hours
  {
    volatility: 0.4,
    spatialDrift: 0.6
  },
  (progress, message) => {
    console.log(`${progress}%: ${message}`);
  }
);
```

### `getAllPresets()`

Get all available audio presets.

**Returns:**
```javascript
[
  {
    id: 1,
    name: 'Rainy Night',
    description: 'Perfect for sleep',
    stem_configs: [
      { stem_id: 1, volume: 0.9 },
      { stem_id: 4, volume: 0.3 }
    ]
  },
  ...
]
```

### `getAllStemsByCategory()`

Get all stems grouped by category.

**Returns:**
```javascript
{
  rain: [
    { id: 1, name: 'Rain on Tent', duration: 300, default_volume: 0.7 },
    ...
  ],
  thunder: [...],
  nature: [...],
  ...
}
```

## Usage Examples

### Basic Audio Generation

```javascript
const audioService = require('./services/audioService');

const config = {
  stems: [
    { id: 1, volume: 0.8 },  // Rain on Tent
    { id: 4, volume: 0.3 }   // Thunder Rumble
  ],
  duration: 3600,  // 1 hour
  volatility: 0.3,
  spatialDrift: 0.5
};

const result = await audioService.generateAudio(config, (progress, msg) => {
  console.log(`Progress: ${progress}% - ${msg}`);
});

console.log(`Audio saved to: ${result.outputPath}`);
```

### Using Presets

```javascript
// Get all presets
const presets = await audioService.getAllPresets();

// Generate from preset
const result = await audioService.generateFromPreset(
  presets[0].id,
  7200,  // 2 hours
  { volatility: 0.4 }
);
```

### Integration with Job Queue

```javascript
const jobQueueService = require('./services/jobQueueService');
const audioService = require('./services/audioService');

// Define processor
const audioProcessor = async (data, updateProgress) => {
  return await audioService.generateAudio(data.config, (progress, message) => {
    updateProgress(progress, message);
  });
};

// Add job
const job = await jobQueueService.addJob(
  'audio',
  'generate',
  { config: audioConfig },
  audioProcessor
);

console.log(`Job ${job.jobId} queued`);
```

## Performance Notes

### Generation Times

| Duration | Stems | Estimated Time |
|----------|-------|----------------|
| 1 hour   | 3     | ~2-3 minutes   |
| 3 hours  | 5     | ~5-8 minutes   |
| 10 hours | 10    | ~15-25 minutes |

*Times vary based on CPU performance*

### File Sizes

| Duration | Bitrate | Approximate Size |
|----------|---------|------------------|
| 1 hour   | 192kbps | ~85 MB           |
| 3 hours  | 192kbps | ~255 MB          |
| 10 hours | 192kbps | ~850 MB          |

## Error Handling

All methods throw descriptive errors:

```javascript
try {
  const result = await audioService.generateAudio(config);
} catch (error) {
  if (error.message.includes('not found')) {
    // Handle missing file
  } else if (error.message.includes('Maximum')) {
    // Handle validation error
  } else {
    // Handle FFmpeg error
  }
}
```

## Configuration Recommendations

### For Sleep/Relaxation
```javascript
{
  volatility: 0.2,    // Subtle changes
  density: 0.8,       // Rich layering
  spatialDrift: 0.3   // Gentle movement
}
```

### For Study/Focus
```javascript
{
  volatility: 0.3,    // Moderate variation
  density: 0.6,       // Balanced
  spatialDrift: 0.4   // Some spatial interest
}
```

### For Meditation
```javascript
{
  volatility: 0.1,    // Minimal variation
  density: 0.9,       // Deep layers
  spatialDrift: 0.2   // Subtle movement
}
```

## Troubleshooting

### Issue: "Audio file not found"
- **Cause**: Stem file doesn't exist at specified path
- **Solution**: Verify `audio-stems/` directory structure

### Issue: "FFmpeg error"
- **Cause**: Invalid FFmpeg parameters or corrupted audio file
- **Solution**: Check FFmpeg installation, verify source files

### Issue: Slow generation
- **Cause**: Low CPU performance or too many stems
- **Solution**: Reduce number of stems or use shorter duration

## Future Enhancements

- [ ] Real-time preview generation
- [ ] Custom EQ per stem
- [ ] Fade in/out effects
- [ ] Reverb and spatial effects
- [ ] Export to multiple formats (FLAC, WAV, OGG)
- [ ] Audio visualization generation

---

**Version**: 1.0.0  
**Last Updated**: December 2024
