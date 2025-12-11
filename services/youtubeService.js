const { google } = require('googleapis');
const { OAuth2Client } = require('google-auth-library');
const fs = require('fs-extra');
const path = require('path');

class YouTubeService {
    constructor() {
        this.oauth2Client = null;
        this.youtube = null;
        this.isConfigured = false;
    }

    /**
     * Initialize YouTube service with OAuth2 credentials
     */
    initialize(clientId, clientSecret, redirectUri) {
        if (!clientId || !clientSecret || !redirectUri) {
            console.warn('⚠️  YouTube OAuth credentials not configured');
            this.isConfigured = false;
            return;
        }

        try {
            this.oauth2Client = new google.auth.OAuth2(
                clientId,
                clientSecret,
                redirectUri
            );

            this.isConfigured = true;
            console.log('✅ YouTube OAuth2 initialized');
        } catch (error) {
            console.error('❌ Failed to initialize YouTube OAuth:', error.message);
            this.isConfigured = false;
        }
    }

    /**
     * Generate OAuth2 authorization URL
     */
    getAuthUrl(state = null) {
        if (!this.isConfigured) {
            throw new Error('YouTube service not configured');
        }

        const authUrl = this.oauth2Client.generateAuthUrl({
            access_type: 'offline',
            prompt: 'consent', // Force consent screen to get refresh token
            scope: [
                'https://www.googleapis.com/auth/youtube.upload',
                'https://www.googleapis.com/auth/youtube.readonly',
                'https://www.googleapis.com/auth/youtube'
            ],
            state: state || 'state_parameter_passthrough_value'
        });

        return authUrl;
    }

    /**
     * Exchange authorization code for tokens
     */
    async getTokensFromCode(code) {
        if (!this.isConfigured) {
            throw new Error('YouTube service not configured');
        }

        try {
            const { tokens } = await this.oauth2Client.getToken(code);

            console.log('✅ YouTube tokens obtained');

            return {
                accessToken: tokens.access_token,
                refreshToken: tokens.refresh_token,
                expiryDate: tokens.expiry_date,
                scope: tokens.scope,
                tokenType: tokens.token_type
            };
        } catch (error) {
            console.error('❌ Failed to exchange code for tokens:', error);
            throw new Error(`OAuth token exchange failed: ${error.message}`);
        }
    }

    /**
     * Set credentials from stored tokens
     */
    setCredentials(accessToken, refreshToken) {
        if (!this.isConfigured) {
            throw new Error('YouTube service not configured');
        }

        this.oauth2Client.setCredentials({
            access_token: accessToken,
            refresh_token: refreshToken
        });

        this.youtube = google.youtube({
            version: 'v3',
            auth: this.oauth2Client
        });

        console.log('✅ YouTube credentials set');
    }

    /**
     * Refresh access token using refresh token
     */
    async refreshAccessToken(refreshToken) {
        if (!this.isConfigured) {
            throw new Error('YouTube service not configured');
        }

        try {
            this.oauth2Client.setCredentials({
                refresh_token: refreshToken
            });

            const { credentials } = await this.oauth2Client.refreshAccessToken();

            return {
                accessToken: credentials.access_token,
                expiryDate: credentials.expiry_date
            };
        } catch (error) {
            console.error('❌ Token refresh failed:', error);
            throw new Error(`Token refresh failed: ${error.message}`);
        }
    }

    /**
     * Upload video to YouTube with resumable upload
     */
    async uploadVideo(videoPath, metadata, progressCallback = null) {
        if (!this.youtube) {
            throw new Error('YouTube client not initialized. Set credentials first.');
        }

        if (!fs.existsSync(videoPath)) {
            throw new Error(`Video file not found: ${videoPath}`);
        }

        const fileSize = fs.statSync(videoPath).size;
        const fileSizeMB = (fileSize / (1024 * 1024)).toFixed(2);

        console.log(`📤 Uploading video: ${path.basename(videoPath)} (${fileSizeMB} MB)`);

        // Prepare request body
        const requestBody = {
            snippet: {
                title: metadata.title || 'Untitled Video',
                description: metadata.description || '',
                tags: metadata.tags || [],
                categoryId: metadata.categoryId || '22', // Default: People & Blogs
                defaultLanguage: 'en',
                defaultAudioLanguage: 'en'
            },
            status: {
                privacyStatus: metadata.privacyStatus || 'private',
                selfDeclaredMadeForKids: false
            }
        };

        try {
            const response = await this.youtube.videos.insert(
                {
                    part: ['snippet', 'status'],
                    requestBody: requestBody,
                    media: {
                        body: fs.createReadStream(videoPath)
                    }
                },
                {
                    // Progress tracking
                    onUploadProgress: (evt) => {
                        const progress = Math.round((evt.bytesRead / fileSize) * 100);
                        const uploadedMB = (evt.bytesRead / (1024 * 1024)).toFixed(2);

                        console.log(`Upload Progress: ${progress}% (${uploadedMB}/${fileSizeMB} MB)`);

                        if (progressCallback) {
                            progressCallback(progress, `Uploading: ${progress}%`, {
                                bytesRead: evt.bytesRead,
                                fileSize: fileSize,
                                uploadedMB: uploadedMB,
                                totalMB: fileSizeMB
                            });
                        }
                    }
                }
            );

            console.log('✅ Video uploaded successfully!');
            console.log(`Video ID: ${response.data.id}`);
            console.log(`Watch URL: https://www.youtube.com/watch?v=${response.data.id}`);

            return {
                success: true,
                videoId: response.data.id,
                url: `https://www.youtube.com/watch?v=${response.data.id}`,
                title: response.data.snippet.title,
                description: response.data.snippet.description,
                privacyStatus: response.data.status.privacyStatus,
                uploadStatus: response.data.status.uploadStatus,
                publishedAt: response.data.snippet.publishedAt
            };

        } catch (error) {
            console.error('❌ Video upload failed:', error);

            // Handle specific errors
            if (error.code === 401) {
                throw new Error('Authentication failed. Please reconnect your YouTube account.');
            } else if (error.code === 403) {
                throw new Error('Insufficient permissions. Please authorize YouTube upload access.');
            } else if (error.code === 400) {
                throw new Error(`Invalid request: ${error.message}`);
            }

            throw new Error(`Upload failed: ${error.message}`);
        }
    }

    /**
     * Get channel information
     */
    async getChannelInfo() {
        if (!this.youtube) {
            throw new Error('YouTube client not initialized');
        }

        try {
            const response = await this.youtube.channels.list({
                part: ['snippet', 'contentDetails', 'statistics'],
                mine: true
            });

            if (!response.data.items || response.data.items.length === 0) {
                throw new Error('No channel found');
            }

            const channel = response.data.items[0];

            return {
                id: channel.id,
                title: channel.snippet.title,
                description: channel.snippet.description,
                customUrl: channel.snippet.customUrl,
                thumbnailUrl: channel.snippet.thumbnails.default.url,
                subscriberCount: channel.statistics.subscriberCount,
                videoCount: channel.statistics.videoCount,
                viewCount: channel.statistics.viewCount
            };
        } catch (error) {
            console.error('❌ Failed to get channel info:', error);
            throw new Error(`Failed to get channel info: ${error.message}`);
        }
    }

    /**
     * Get user's uploaded videos
     */
    async getUploadedVideos(maxResults = 10) {
        if (!this.youtube) {
            throw new Error('YouTube client not initialized');
        }

        try {
            const response = await this.youtube.search.list({
                part: ['snippet'],
                forMine: true,
                type: 'video',
                order: 'date',
                maxResults: maxResults
            });

            return response.data.items.map(item => ({
                videoId: item.id.videoId,
                title: item.snippet.title,
                description: item.snippet.description,
                thumbnailUrl: item.snippet.thumbnails.default.url,
                publishedAt: item.snippet.publishedAt,
                url: `https://www.youtube.com/watch?v=${item.id.videoId}`
            }));
        } catch (error) {
            console.error('❌ Failed to get uploaded videos:', error);
            throw new Error(`Failed to get videos: ${error.message}`);
        }
    }

    /**
     * Update video metadata
     */
    async updateVideo(videoId, metadata) {
        if (!this.youtube) {
            throw new Error('YouTube client not initialized');
        }

        try {
            const response = await this.youtube.videos.update({
                part: ['snippet', 'status'],
                requestBody: {
                    id: videoId,
                    snippet: {
                        title: metadata.title,
                        description: metadata.description,
                        tags: metadata.tags,
                        categoryId: metadata.categoryId || '22'
                    },
                    status: {
                        privacyStatus: metadata.privacyStatus || 'private'
                    }
                }
            });

            console.log(`✅ Video ${videoId} updated successfully`);
            return response.data;
        } catch (error) {
            console.error('❌ Failed to update video:', error);
            throw new Error(`Update failed: ${error.message}`);
        }
    }

    /**
     * Delete video
     */
    async deleteVideo(videoId) {
        if (!this.youtube) {
            throw new Error('YouTube client not initialized');
        }

        try {
            await this.youtube.videos.delete({
                id: videoId
            });

            console.log(`✅ Video ${videoId} deleted successfully`);
            return { success: true };
        } catch (error) {
            console.error('❌ Failed to delete video:', error);
            throw new Error(`Delete failed: ${error.message}`);
        }
    }

    /**
     * Check if service is ready
     */
    isReady() {
        return this.isConfigured && this.youtube !== null;
    }
}

// Singleton instance
const youtubeService = new YouTubeService();

module.exports = youtubeService;
