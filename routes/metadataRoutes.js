// Metadata Routes
// API endpoints for AI metadata generation and management

const aiService = require('../services/aiService');
const Project = require('../models/Project');

module.exports = (app, isAuthenticated) => {

    // ============================================================================
    // UI ROUTES
    // ============================================================================

    /**
     * Metadata Editor Page
     */
    app.get('/metadata-editor', isAuthenticated, async (req, res) => {
        try {
            const User = require('../models/User');
            const user = await User.findById(req.session.userId);

            res.render('metadata-editor', {
                title: 'Metadata Generator',
                active: 'metadata-editor',
                user: user
            });
        } catch (error) {
            console.error('Metadata editor page error:', error);
            res.redirect('/dashboard');
        }
    });

    // ============================================================================
    // API ROUTES
    // ============================================================================

    /**
     * Check AI service status
     */
    app.get('/api/metadata/ai-status', isAuthenticated, (req, res) => {
        res.json({
            available: aiService.isReady()
        });
    });

    /**
     * Get user's projects
     */
    app.get('/api/metadata/projects', isAuthenticated, async (req, res) => {
        try {
            const projects = await Project.findByUser(req.session.userId);
            res.json(projects);
        } catch (error) {
            console.error('Error fetching projects:', error);
            res.status(500).json({
                success: false,
                error: 'Failed to fetch projects'
            });
        }
    });

    /**
     * Get project metadata
     */
    app.get('/api/metadata/project/:id', isAuthenticated, async (req, res) => {
        try {
            const project = await Project.findById(req.params.id);

            if (!project) {
                return res.status(404).json({
                    success: false,
                    error: 'Project not found'
                });
            }

            // Verify ownership
            if (project.user_id !== req.session.userId) {
                return res.status(403).json({
                    success: false,
                    error: 'Not authorized'
                });
            }

            // Parse metadata if exists
            let metadata = null;
            if (project.youtube_metadata) {
                try {
                    metadata = typeof project.youtube_metadata === 'string'
                        ? JSON.parse(project.youtube_metadata)
                        : project.youtube_metadata;
                } catch (err) {
                    console.error('Error parsing metadata:', err);
                }
            }

            res.json({
                success: true,
                project,
                metadata
            });
        } catch (error) {
            console.error('Error fetching project metadata:', error);
            res.status(500).json({
                success: false,
                error: 'Failed to fetch project'
            });
        }
    });

    /**
     * Generate metadata with AI
     */
    app.post('/api/metadata/generate', isAuthenticated, async (req, res) => {
        try {
            const { projectId, customInstructions } = req.body;

            if (!projectId) {
                return res.status(400).json({
                    success: false,
                    error: 'Project ID is required'
                });
            }

            // Get project
            const project = await Project.findById(projectId);

            if (!project) {
                return res.status(404).json({
                    success: false,
                    error: 'Project not found'
                });
            }

            // Verify ownership
            if (project.user_id !== req.session.userId) {
                return res.status(403).json({
                    success: false,
                    error: 'Not authorized'
                });
            }

            // Prepare project data for AI
            const projectData = {
                audioPreset: project.audio_preset || 'Ambient Audio',
                duration: project.audio_duration,
                videoType: project.type === 'audio_video' ? 'Looping Video' : 'Audio Only',
                customInstructions: customInstructions || null
            };

            // Generate metadata with AI
            const metadata = await aiService.generateMetadata(projectData);

            res.json({
                success: true,
                metadata
            });
        } catch (error) {
            console.error('Error generating metadata:', error);
            res.status(500).json({
                success: false,
                error: error.message || 'Failed to generate metadata'
            });
        }
    });

    /**
     * Save metadata
     */
    app.post('/api/metadata/save', isAuthenticated, async (req, res) => {
        try {
            const { projectId, metadata } = req.body;

            if (!projectId || !metadata) {
                return res.status(400).json({
                    success: false,
                    error: 'Project ID and metadata are required'
                });
            }

            // Get project
            const project = await Project.findById(projectId);

            if (!project) {
                return res.status(404).json({
                    success: false,
                    error: 'Project not found'
                });
            }

            // Verify ownership
            if (project.user_id !== req.session.userId) {
                return res.status(403).json({
                    success: false,
                    error: 'Not authorized'
                });
            }

            // Update project with metadata
            await Project.update(projectId, {
                youtube_title: metadata.title,
                youtube_description: metadata.description,
                youtube_tags: JSON.stringify(metadata.tags),
                youtube_category: metadata.category || null,
                youtube_privacy: metadata.privacy || 'public',
                youtube_metadata: JSON.stringify(metadata)
            });

            res.json({
                success: true,
                message: 'Metadata saved successfully'
            });
        } catch (error) {
            console.error('Error saving metadata:', error);
            res.status(500).json({
                success: false,
                error: 'Failed to save metadata'
            });
        }
    });

    /**
     * Enhance existing metadata
     */
    app.post('/api/metadata/enhance', isAuthenticated, async (req, res) => {
        try {
            const { projectId, existingMetadata } = req.body;

            if (!projectId || !existingMetadata) {
                return res.status(400).json({
                    success: false,
                    error: 'Project ID and existing metadata are required'
                });
            }

            // Get project
            const project = await Project.findById(projectId);

            if (!project) {
                return res.status(404).json({
                    success: false,
                    error: 'Project not found'
                });
            }

            // Verify ownership
            if (project.user_id !== req.session.userId) {
                return res.status(403).json({
                    success: false,
                    error: 'Not authorized'
                });
            }

            // Prepare project data
            const projectData = {
                audioPreset: project.audio_preset,
                duration: project.audio_duration
            };

            // Enhance metadata
            const enhanced = await aiService.enhanceMetadata(existingMetadata, projectData);

            res.json({
                success: true,
                metadata: enhanced
            });
        } catch (error) {
            console.error('Error enhancing metadata:', error);
            res.status(500).json({
                success: false,
                error: error.message || 'Failed to enhance metadata'
            });
        }
    });

    console.log('✅ Metadata routes loaded');
};
