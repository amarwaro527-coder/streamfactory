// Audio Studio Routes
// API endpoints for audio generation, presets, and stems management

const audioService = require('../services/audioService');
const { AudioStem, AudioPreset } = require('../models/AudioModels');
const Project = require('../models/Project');
const jobQueueService = require('../services/jobQueueService');

module.exports = (app, isAuthenticated) => {

    // ============================================================================
    // UI ROUTES
    // ============================================================================

    /**
     * Audio Studio Page
     */
    app.get('/audio-studio', isAuthenticated, async (req, res) => {
        try {
            const User = require('../models/User');
            const user = await User.findById(req.session.userId);

            res.render('audio-studio', {
                title: 'Audio Studio',
                active: 'audio-studio',
                user: user
            });
        } catch (error) {
            console.error('Audio studio page error:', error);
            res.redirect('/dashboard');
        }
    });

    // ============================================================================
    // API ROUTES - Presets
    // ============================================================================

    /**
     * Get all audio presets
     */
    app.get('/api/audio/presets', isAuthenticated, async (req, res) => {
        try {
            const presets = await audioService.getAllPresets();
            res.json(presets);
        } catch (error) {
            console.error('Error fetching presets:', error);
            res.status(500).json({
                success: false,
                error: 'Failed to fetch audio presets'
            });
        }
    });

    /**
     * Get preset by ID
     */
    app.get('/api/audio/presets/:id', isAuthenticated, async (req, res) => {
        try {
            const preset = await AudioPreset.getById(req.params.id);

            if (!preset) {
                return res.status(404).json({
                    success: false,
                    error: 'Preset not found'
                });
            }

            res.json(preset);
        } catch (error) {
            console.error('Error fetching preset:', error);
            res.status(500).json({
                success: false,
                error: 'Failed to fetch preset'
            });
        }
    });

    /**
     * Create custom preset
     */
    app.post('/api/audio/presets', isAuthenticated, async (req, res) => {
        try {
            const { name, description, stem_configs } = req.body;

            if (!name || !stem_configs || !Array.isArray(stem_configs)) {
                return res.status(400).json({
                    success: false,
                    error: 'Name and stem_configs are required'
                });
            }

            const preset = await AudioPreset.create({
                name,
                description: description || '',
                stem_configs
            });

            res.json({
                success: true,
                preset
            });
        } catch (error) {
            console.error('Error creating preset:', error);
            res.status(500).json({
                success: false,
                error: 'Failed to create preset'
            });
        }
    });

    // ============================================================================
    // API ROUTES - Stems
    // ============================================================================

    /**
     * Get all stems grouped by category
     */
    app.get('/api/audio/stems', isAuthenticated, async (req, res) => {
        try {
            const stems = await audioService.getAllStemsByCategory();
            res.json(stems);
        } catch (error) {
            console.error('Error fetching stems:', error);
            res.status(500).json({
                success: false,
                error: 'Failed to fetch audio stems'
            });
        }
    });

    /**
     * Get single stem by ID
     */
    app.get('/api/audio/stems/:id', isAuthenticated, async (req, res) => {
        try {
            const stem = await AudioStem.getById(req.params.id);

            if (!stem) {
                return res.status(404).json({
                    success: false,
                    error: 'Stem not found'
                });
            }

            res.json(stem);
        } catch (error) {
            console.error('Error fetching stem:', error);
            res.status(500).json({
                success: false,
                error: 'Failed to fetch stem'
            });
        }
    });

    // ============================================================================
    // API ROUTES - Audio The Generation
    // ============================================================================

    /**
     * Generate audio from configuration
     */
    app.post('/api/audio/generate', isAuthenticated, async (req, res) => {
        try {
            const { config } = req.body;

            if (!config || !config.stems || config.stems.length === 0) {
                return res.status(400).json({
                    success: false,
                    error: 'Audio configuration with at least one stem is required'
                });
            }

            // Processor function for job queue
            const audioProcessor = async (data, updateProgress) => {
                return await audioService.generateAudio(data.config, (progress, message) => {
                    if (updateProgress) {
                        updateProgress(progress, message);
                    }
                });
            };

            // Add to job queue (or process synchronously if queue not available)
            const result = await jobQueueService.addJob(
                'audio',
                'generate',
                { config, userId: req.session.userId },
                audioProcessor
            );

            // Save project if generation completed
            if (result.status === 'completed') {
                try {
                    await Project.create({
                        user_id: req.session.userId,
                        name: result.result.fileName,
                        type: 'audio_only',
                        status: 'completed',
                        audio_preset: config.presetName || null,
                        audio_config: JSON.stringify(config),
                        audio_duration: config.duration,
                        audio_output_path: result.result.outputPath
                    });
                } catch (projectError) {
                    console.error('Error saving project:', projectError);
                    // Continue anyway - audio is still generated
                }
            }

            res.json(result);
        } catch (error) {
            console.error('Error generating audio:', error);
            res.status(500).json({
                success: false,
                error: error.message || 'Failed to generate audio'
            });
        }
    });

    /**
     * Generate audio from preset
     */
    app.post('/api/audio/generate-from-preset', isAuthenticated, async (req, res) => {
        try {
            const { presetId, duration, config } = req.body;

            if (!presetId || !duration) {
                return res.status(400).json({
                    success: false,
                    error: 'Preset ID and duration are required'
                });
            }

            // Processor function
            const audioProcessor = async (data, updateProgress) => {
                return await audioService.generateFromPreset(
                    data.presetId,
                    data.duration,
                    data.config || {},
                    (progress, message) => {
                        if (updateProgress) {
                            updateProgress(progress, message);
                        }
                    }
                );
            };

            const result = await jobQueueService.addJob(
                'audio',
                'generate-preset',
                { presetId, duration, config, userId: req.session.userId },
                audioProcessor
            );

            res.json(result);
        } catch (error) {
            console.error('Error generating from preset:', error);
            res.status(500).json({
                success: false,
                error: error.message || 'Failed to generate audio from preset'
            });
        }
    });

    /**
     * Get audio file info
     */
    app.get('/api/audio/info/:fileName', isAuthenticated, async (req, res) => {
        try {
            const info = await audioService.getAudioInfo(req.params.fileName);
            res.json(info);
        } catch (error) {
            console.error('Error getting audio info:', error);
            res.status(404).json({
                success: false,
                error: 'Audio file not found'
            });
        }
    });

    /**
     * Delete generated audio
     */
    app.delete('/api/audio/:fileName', isAuthenticated, async (req, res) => {
        try {
            await audioService.deleteAudio(req.params.fileName);

            res.json({
                success: true,
                message: 'Audio file deleted'
            });
        } catch (error) {
            console.error('Error deleting audio:', error);
            res.status(500).json({
                success: false,
                error: 'Failed to delete audio file'
            });
        }
    });

    // ============================================================================
    // API ROUTES - Job Status
    // ============================================================================

    /**
     * Get job status
     */
    app.get('/api/audio/job/:jobId', isAuthenticated, async (req, res) => {
        try {
            const status = await jobQueueService.getJobStatus('audio', req.params.jobId);
            res.json(status);
        } catch (error) {
            console.error('Error getting job status:', error);
            res.status(500).json({
                success: false,
                error: 'Failed to get job status'
            });
        }
    });

    /**
     * Get queue info
     */
    app.get('/api/audio/queue-info', isAuthenticated, async (req, res) => {
        try {
            const info = await jobQueueService.getQueueInfo('audio');
            res.json(info);
        } catch (error) {
            console.error('Error getting queue info:', error);
            res.status(500).json({
                success: false,
                available: false
            });
        }
    });

    console.log('✅ Audio routes loaded');
};
