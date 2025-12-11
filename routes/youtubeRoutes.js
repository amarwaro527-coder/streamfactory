// YouTube Routes
// OAuth2 authentication and video upload endpoints

const youtubeService = require('../services/youtubeService');
const jobQueueService = require('../services/jobQueueService');
const Project = require('../models/Project');
const User = require('../models/User');
const path = require('path');
const fs = require('fs-extra');

module.exports = (app, isAuthenticated) => {

    // ============================================================================
    // UI ROUTES
    // ============================================================================

    /**
     * YouTube Publisher Page
     */
    app.get('/youtube-publisher', isAuthenticated, async (req, res) => {
        try {
            const user = await User.findById(req.session.userId);

            res.render('youtube-publisher', {
                title: 'YouTube Publisher',
                active: 'youtube-publisher',
                user: user
            });
        } catch (error) {
            console.error('YouTube publisher page error:', error);
            res.redirect('/dashboard');
        }
    });

    // ============================================================================
    // OAUTH ROUTES
    // ============================================================================

    /**
     * Initiate YouTube OAuth flow
     */
    app.get('/youtube/auth', isAuthenticated, (req, res) => {
        try {
            // Initialize YouTube service with env vars
            const clientId = process.env.GOOGLE_CLIENT_ID;
            const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
            const redirectUri = process.env.GOOGLE_REDIRECT_URI || `${process.env.BASE_URL || 'http://localhost:7576'}/youtube/callback`;

            youtubeService.initialize(clientId, clientSecret, redirectUri);

            // Store user ID in state for callback
            const state = JSON.stringify({ userId: req.session.userId });
            const authUrl = youtubeService.getAuthUrl(state);

            res.redirect(authUrl);
        } catch (error) {
            console.error('YouTube auth error:', error);
            req.flash('error', 'Failed to initiate YouTube connection');
            res.redirect('/youtube-publisher');
        }
    });

    /**
     * YouTube OAuth callback
     */
    app.get('/youtube/callback', async (req, res) => {
        try {
            const { code, state } = req.query;

            if (!code) {
                throw new Error('No authorization code received');
            }

            // Parse state to get user ID
            const stateData = JSON.parse(state || '{}');
            const userId = stateData.userId;

            if (!userId) {
                throw new Error('Invalid state parameter');
            }

            // Exchange code for tokens
            const tokens = await youtubeService.getTokensFromCode(code);

            // Save tokens to user account
            await User.updateYouTubeTokens(userId, tokens.accessToken, tokens.refreshToken);

            console.log('✅ YouTube tokens saved for user:', userId);

            res.redirect('/youtube-publisher?connected=true');
        } catch (error) {
            console.error('YouTube callback error:', error);
            res.redirect('/youtube-publisher?error=' + encodeURIComponent(error.message));
        }
    });

    // ============================================================================
    // API ROUTES
    // ============================================================================

    /**
     * Check YouTube connection status
     */
    app.get('/api/youtube/status', isAuthenticated, async (req, res) => {
        try {
            const user = await User.findById(req.session.userId);

            if (!user.youtube_access_token || !user.youtube_refresh_token) {
                return res.json({ connected: false });
            }

            // Initialize YouTube service
            const clientId = process.env.GOOGLE_CLIENT_ID;
            const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
            const redirectUri = process.env.GOOGLE_REDIRECT_URI || `${process.env.BASE_URL || 'http://localhost:7576'}/youtube/callback`;

            youtubeService.initialize(clientId, clientSecret, redirectUri);
            youtubeService.setCredentials(user.youtube_access_token, user.youtube_refresh_token);

            // Get channel info
            const channel = await youtubeService.getChannelInfo();

            res.json({
                connected: true,
                channel
            });
        } catch (error) {
            console.error('YouTube status error:', error);

            // If token expired, try refresh
            if (error.message.includes('invalid_grant') || error.message.includes('Token has been expired')) {
                try {
                    const user = await User.findById(req.session.userId);
                    const refreshed = await youtubeService.refreshAccessToken(user.youtube_refresh_token);
                    await User.updateYouTubeTokens(req.session.userId, refreshed.accessToken, user.youtube_refresh_token);

                    // Retry
                    youtubeService.setCredentials(refreshed.accessToken, user.youtube_refresh_token);
                    const channel = await youtubeService.getChannelInfo();

                    return res.json({ connected: true, channel });
                } catch (refreshError) {
                    console.error('Token refresh failed:', refreshError);
                }
            }

            res.json({ connected: false });
        }
    });

    /**
     * Get projects with video
     */
    app.get('/api/youtube/projects', isAuthenticated, async (req, res) => {
        try {
            const projects = await Project.findByUser(req.session.userId);

            // Filter projects with video output
            const videoprojects = projects.filter(p => p.video_output_path);

            res.json(videoProjects);
        } catch (error) {
            console.error('Error fetching projects:', error);
            res.status(500).json({
                success: false,
                error: 'Failed to fetch projects'
            });
        }
    });

    /**
     * Publish video to YouTube
     */
    app.post('/api/youtube/publish', isAuthenticated, async (req, res) => {
        try {
            const { projectId } = req.body;

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

            // Verify video exists
            if (!project.video_output_path) {
                return res.status(400).json({
                    success: false,
                    error: 'Project has no video. Assemble video first.'
                });
            }

            const videoPath = path.resolve(project.video_output_path);
            if (!fs.existsSync(videoPath)) {
                return res.status(404).json({
                    success: false,
                    error: 'Video file not found'
                });
            }

            // Parse metadata
            let metadata = {};
            if (project.youtube_metadata) {
                try {
                    metadata = typeof project.youtube_metadata === 'string'
                        ? JSON.parse(project.youtube_metadata)
                        : project.youtube_metadata;
                } catch (err) {
                    console.warn('Failed to parse metadata:', err);
                }
            }

            // Prepare upload metadata
            const uploadMetadata = {
                title: metadata.title || project.name,
                description: metadata.description || '',
                tags: metadata.tags || [],
                categoryId: metadata.category || '22',
                privacyStatus: metadata.privacy || 'private'
            };

            // Get user tokens
            const user = await User.findById(req.session.userId);

            // Upload processor function
            const uploadProcessor = async (data, updateProgress) => {
                // Initialize YouTube service
                const clientId = process.env.GOOGLE_CLIENT_ID;
                const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
                const redirectUri = process.env.GOOGLE_REDIRECT_URI || `${process.env.BASE_URL || 'http://localhost:7576'}/youtube/callback`;

                youtubeService.initialize(clientId, clientSecret, redirectUri);
                youtubeService.setCredentials(user.youtube_access_token, user.youtube_refresh_token);

                // Upload video
                return await youtubeService.uploadVideo(
                    data.videoPath,
                    data.metadata,
                    updateProgress
                );
            };

            // Add to job queue
            const result = await jobQueueService.addJob(
                'youtube',
                'upload',
                {
                    videoPath,
                    metadata: uploadMetadata,
                    userId: req.session.userId,
                    projectId
                },
                uploadProcessor
            );

            // Save YouTube video ID if completed
            if (result.status === 'completed' && result.result.videoId) {
                await Project.update(projectId, {
                    youtube_video_id: result.result.videoId,
                    youtube_status: 'published'
                });
            }

            res.json(result);
        } catch (error) {
            console.error('YouTube publish error:', error);
            res.status(500).json({
                success: false,
                error: error.message || 'Failed to publish video'
            });
        }
    });

    /**
     * Get recent uploads
     */
    app.get('/api/youtube/recent-uploads', isAuthenticated, async (req, res) => {
        try {
            const user = await User.findById(req.session.userId);

            if (!user.youtube_access_token || !user.youtube_refresh_token) {
                return res.json([]);
            }

            // Initialize YouTube service
            const clientId = process.env.GOOGLE_CLIENT_ID;
            const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
            const redirectUri = process.env.GOOGLE_REDIRECT_URI || `${process.env.BASE_URL || 'http://localhost:7576'}/youtube/callback`;

            youtubeService.initialize(clientId, clientSecret, redirectUri);
            youtubeService.setCredentials(user.youtube_access_token, user.youtube_refresh_token);

            const videos = await youtubeService.getUploadedVideos(10);

            res.json(videos);
        } catch (error) {
            console.error('Error fetching recent uploads:', error);
            res.json([]);
        }
    });

    /**
     * Disconnect YouTube account
     */
    app.post('/api/youtube/disconnect', isAuthenticated, async (req, res) => {
        try {
            await User.updateYouTubeTokens(req.session.userId, null, null);

            res.json({ success: true });
        } catch (error) {
            console.error('Disconnect error:', error);
            res.status(500).json({
                success: false,
                error: 'Failed to disconnect'
            });
        }
    });

    console.log('✅ YouTube routes loaded');
};
