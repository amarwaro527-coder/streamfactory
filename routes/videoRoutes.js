// Video Composer Routes
// API endpoints for video assembly and management

const videoService = require('../services/videoService');
const audioService = require('../services/audioService');
const Video = require('../models/Video');
const Project = require('../models/Project');
const jobQueueService = require('../services/jobQueueService');
const path = require('path');
const fs = require('fs-extra');

module.exports = (app, isAuthenticated) => {

    // ============================================================================
    // UI ROUTES
    // ============================================================================

    /**
     * Video Composer Page
     */
    app.get('/video-composer', isAuthenticated, async (req, res) => {
        try {
            const User = require('../models/User');
            const user = await User.findById(req.session.userId);

            res.render('video-composer', {
                title: 'Video Composer',
                active: 'video-composer',
                user: user
            });
        } catch (error) {
            console.error('Video composer page error:', error);
            res.redirect('/dashboard');
        }
    });

    // ============================================================================
    // API ROUTES - Video Selection
    // ============================================================================

    /**
     * Get available videos from gallery
     */
    app.get('/api/video/available', isAuthenticated, async (req, res) => {
        try {
            const videos = await videoService.getAvailableVideos(req.session.userId);
            res.json(videos);
        } catch (error) {
            console.error('Error fetching available videos:', error);
            res.status(500).json({
                success: false,
                error: 'Failed to fetch videos'
            });
        }
    });

    /**
     * Get generated audio files
     */
    app.get('/api/audio/output-files', isAuthenticated, async (req, res) => {
        try {
            const audioOutputDir = process.env.AUDIO_OUTPUT_DIR || './public/audio-output';
            const files = await fs.readdir(audioOutputDir);

            const audioFiles = [];

            for (const file of files) {
                if (file.endsWith('.mp3') || file.endsWith('.wav')) {
                    const filePath = path.join(audioOutputDir, file);
                    const stats = await fs.stat(filePath);

                    // Get duration
                    try {
                        const info = await audioService.getAudioInfo(file);
                        audioFiles.push({
                            name: file,
                            path: `/audio-output/${file}`,
                            size: stats.size,
                            duration: info.duration,
                            created: stats.birthtime
                        });
                    } catch (err) {
                        // Skip files we can't read
                        console.warn(`Could not read ${file}:`, err.message);
                    }
                }
            }

            // Sort by created date (newest first)
            audioFiles.sort((a, b) => b.created - a.created);

            res.json(audioFiles);
        } catch (error) {
            console.error('Error fetching audio files:', error);
            res.status(500).json({
                success: false,
                error: 'Failed to fetch audio files'
            });
        }
    });

    // ============================================================================
    // API ROUTES - Video Assembly
    // ============================================================================

    /**
     * Assemble video with audio
     */
    app.post('/api/video/assemble', isAuthenticated, async (req, res) => {
        try {
            const { videoId, audioPath, loopType, outputName } = req.body;

            // Validation
            if (!videoId || !audioPath) {
                return res.status(400).json({
                    success: false,
                    error: 'Video ID and audio path are required'
                });
            }

            // Get video from database
            const video = await Video.findById(videoId);
            if (!video) {
                return res.status(404).json({
                    success: false,
                    error: 'Video not found'
                });
            }

            // Verify user owns the video
            if (video.user_id !== req.session.userId) {
                return res.status(403).json({
                    success: false,
                    error: 'Not authorized'
                });
            }

            // Get audio info
            const audioFullPath = path.join(process.cwd(), 'public', audioPath);
            if (!fs.existsSync(audioFullPath)) {
                return res.status(404).json({
                    success: false,
                    error: 'Audio file not found'
                });
            }

            // Get audio duration
            const audioFileName = path.basename(audioPath);
            const audioInfo = await audioService.getAudioInfo(audioFileName);

            // Processor function
            const videoProcessor = async (data, updateProgress) => {
                const videoFullPath = path.join(process.cwd(), 'public/uploads/videos', video.file_path);

                const config = {
                    videoPath: videoFullPath,
                    audioPath: audioFullPath,
                    audioDuration: audioInfo.duration,
                    loopType: data.loopType || 'ping-pong',
                    outputName: data.outputName || null
                };

                return await videoService.assembleVideo(config, (progress, message) => {
                    if (updateProgress) {
                        updateProgress(progress, message);
                    }
                });
            };

            // Add to job queue
            const result = await jobQueueService.addJob(
                'video',
                'assemble',
                { videoId, audioPath, loopType, outputName, userId: req.session.userId },
                videoProcessor
            );

            // Save project if completed
            if (result.status === 'completed') {
                try {
                    await Project.create({
                        user_id: req.session.userId,
                        name: result.result.fileName,
                        type: 'audio_video',
                        status: 'completed',
                        audio_output_path: audioFullPath,
                        audio_duration: audioInfo.duration,
                        video_source_ids: JSON.stringify([videoId]),
                        video_loop_type: loopType,
                        video_output_path: result.result.outputPath
                    });
                } catch (projectError) {
                    console.error('Error saving project:', projectError);
                }
            }

            res.json(result);
        } catch (error) {
            console.error('Error assembling video:', error);
            res.status(500).json({
                success: false,
                error: error.message || 'Failed to assemble video'
            });
        }
    });

    /**
     * Get video info
     */
    app.get('/api/video/info/:fileName', isAuthenticated, async (req, res) => {
        try {
            const videoOutputDir = process.env.VIDEO_OUTPUT_DIR || './public/video-output';
            const filePath = path.join(videoOutputDir, req.params.fileName);

            if (!fs.existsSync(filePath)) {
                return res.status(404).json({
                    success: false,
                    error: 'Video not found'
                });
            }

            const info = await videoService.getVideoInfo(filePath);
            const stats = fs.statSync(filePath);

            res.json({
                fileName: req.params.fileName,
                fileSize: stats.size,
                created: stats.birthtime,
                ...info
            });
        } catch (error) {
            console.error('Error getting video info:', error);
            res.status(500).json({
                success: false,
                error: 'Failed to get video info'
            });
        }
    });

    /**
     * Delete assembled video
     */
    app.delete('/api/video/:fileName', isAuthenticated, async (req, res) => {
        try {
            await videoService.deleteVideo(req.params.fileName);

            res.json({
                success: true,
                message: 'Video deleted'
            });
        } catch (error) {
            console.error('Error deleting video:', error);
            res.status(500).json({
                success: false,
                error: 'Failed to delete video'
            });
        }
    });

    /**
     * Cleanup temp files
     */
    app.post('/api/video/cleanup-temp', isAuthenticated, async (req, res) => {
        try {
            const result = await videoService.cleanupTempFiles(24);

            res.json({
                success: true,
                ...result
            });
        } catch (error) {
            console.error('Error cleaning up temp files:', error);
            res.status(500).json({
                success: false,
                error: 'Failed to cleanup temp files'
            });
        }
    });

    console.log('✅ Video routes loaded');
};
