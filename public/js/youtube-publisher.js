// YouTube Publisher Client-Side Logic

let channelInfo = null;
let currentProjectId = null;

// Initialize
document.addEventListener('DOMContentLoaded', () => {
    checkYouTubeConnection();
    setupEventListeners();
});

// Check YouTube Connection Status
async function checkYouTubeConnection() {
    try {
        const response = await fetch('/api/youtube/status');
        const data = await response.json();

        if (data.connected) {
            showConnectedState(data.channel);
            loadProjects();
            loadRecentUploads();
            document.getElementById('publisher-panel').style.display = 'block';
        } else {
            showNotConnectedState();
            document.getElementById('publisher-panel').style.display = 'none';
        }
    } catch (error) {
        console.error('Error checking YouTube connection:', error);
        showNotConnectedState();
    }
}

// Show Connected State
function showConnectedState(channel) {
    channelInfo = channel;

    document.getElementById('not-connected-state').style.display = 'none';
    document.getElementById('connected-state').style.display = 'block';

    document.getElementById('channel-thumbnail').src = channel.thumbnailUrl;
    document.getElementById('channel-title').textContent = channel.title;
    document.getElementById('channel-subscribers').textContent = formatNumber(channel.subscriberCount);
    document.getElementById('channel-videos').textContent = formatNumber(channel.videoCount);
}

// Show Not Connected State
function showNotConnectedState() {
    document.getElementById('not-connected-state').style.display = 'block';
    document.getElementById('connected-state').style.display = 'none';
}

// Setup Event Listeners
function setupEventListeners() {
    // Disconnect YouTube
    document.getElementById('disconnect-btn').addEventListener('click', handleDisconnect);

    // Project selection
    document.getElementById('projectSelect').addEventListener('change', handleProjectSelection);

    // Publish form
    document.getElementById('publish-form').addEventListener('submit', handlePublish);

    // Publish another
    document.getElementById('publish-another-btn').addEventListener('click', resetForm);
}

// Load Projects with Video
async function loadProjects() {
    try {
        const response = await fetch('/api/youtube/projects');
        const projects = await response.json();

        const select = document.getElementById('projectSelect');

        if (projects.length === 0) {
            select.innerHTML = '<option value="">No projects with video found. Assemble video first.</option>';
            return;
        }

        select.innerHTML = '<option value="">Select a project...</option>';

        projects.forEach(project => {
            const option = document.createElement('option');
            option.value = project.id;

            const duration = Math.floor(project.audio_duration / 60);
            const statusIcon = project.youtube_video_id ? '✅' : '📹';

            option.textContent = `${statusIcon} ${project.name} (${duration} min)`;
            option.dataset.projectData = JSON.stringify(project);

            select.appendChild(option);
        });
    } catch (error) {
        console.error('Error loading projects:', error);
        showAlert('Failed to load projects', 'danger');
    }
}

// Handle Project Selection
function handleProjectSelection(e) {
    const select = e.target;
    const option = select.options[select.selectedIndex];

    if (!option.dataset.projectData) {
        document.getElementById('video-preview-section').style.display = 'none';
        document.getElementById('metadata-summary').style.display = 'none';
        return;
    }

    const project = JSON.parse(option.dataset.projectData);
    currentProjectId = project.id;

    // Show video preview
    if (project.video_output_path) {
        const videoPath = project.video_output_path.replace(/\\/g, '/');
        const relativePath = videoPath.includes('video-output')
            ? '/video-output/' + videoPath.split('video-output/')[1]
            : videoPath;

        const player = document.getElementById('preview-player');
        player.src = relativePath;

        document.getElementById('preview-duration').textContent = formatDuration(project.audio_duration);
        document.getElementById('preview-size').textContent = '-'; // Will be loaded from metadata

        document.getElementById('video-preview-section').style.display = 'block';
    }

    // Show metadata summary
    if (project.youtube_metadata) {
        const metadata = typeof project.youtube_metadata === 'string'
            ? JSON.parse(project.youtube_metadata)
            : project.youtube_metadata;

        document.getElementById('summary-title').textContent = metadata.title || 'No title';
        document.getElementById('summary-description').textContent = metadata.description || 'No description';

        const tags = metadata.tags || [];
        document.getElementById('summary-tags').textContent = tags.length > 0
            ? tags.slice(0, 5).join(', ') + (tags.length > 5 ? '...' : '')
            : 'No tags';

        const privacyBadge = document.getElementById('summary-privacy');
        privacyBadge.textContent = (metadata.privacy || 'private').toUpperCase();
        privacyBadge.className = 'badge ' + (metadata.privacy === 'public' ? 'bg-success' : 'bg-secondary');

        document.getElementById('metadata-summary').style.display = 'block';
    } else {
        // No metadata - show warning
        document.getElementById('metadata-summary').innerHTML = `
      <div class="alert alert-warning">
        <i class="bi bi-exclamation-triangle"></i> 
        No metadata found for this project.
        <a href="/metadata-editor" target="_blank">Add metadata first</a>
      </div>
    `;
        document.getElementById('metadata-summary').style.display = 'block';
    }
}

// Handle Publish
async function handlePublish(e) {
    e.preventDefault();

    if (!currentProjectId) {
        showAlert('Please select a project', 'warning');
        return;
    }

    // Show progress card
    document.getElementById('upload-progress-card').style.display = 'block';
    document.getElementById('success-card').style.display = 'none';
    document.getElementById('publish-btn').disabled = true;

    updateProgress(0, 'Preparing upload...');

    try {
        const response = await fetch('/api/youtube/publish', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                projectId: currentProjectId
            })
        });

        const data = await response.json();

        if (!response.ok) {
            throw new Error(data.error || 'Upload failed');
        }

        if (data.jobId) {
            // Job queued - track progress via socket
            const socket = io();
            socket.emit('subscribe:job', { jobId: data.jobId });

            socket.on('job:progress', (progress) => {
                updateProgress(progress.progress, progress.message, progress.details);
            });

            socket.on('job:completed', (result) => {
                handleUploadSuccess(result.result);
                socket.disconnect();
            });

            socket.on('job:failed', (error) => {
                handleUploadError(error.error);
                socket.disconnect();
            });
        } else {
            // Direct upload completed
            handleUploadSuccess(data.result);
        }
    } catch (error) {
        handleUploadError(error.message);
    }
}

// Update Progress
function updateProgress(progress, message, details = null) {
    const progressBar = document.getElementById('upload-progress-bar');
    const messageEl = document.getElementById('upload-message');
    const detailsEl = document.getElementById('upload-details');

    progressBar.style.width = `${progress}%`;
    progressBar.textContent = `${progress}%`;
    messageEl.textContent = message;

    if (details) {
        detailsEl.textContent = `${details.uploadedMB} MB / ${details.totalMB} MB`;
    }
}

// Handle Upload Success
function handleUploadSuccess(result) {
    document.getElementById('upload-progress-card').style.display = 'none';
    document.getElementById('success-card').style.display = 'block';
    document.getElementById('publish-btn').disabled = false;

    // Set result details
    document.getElementById('watch-btn').href = result.url;
    document.getElementById('result-video-id').textContent = result.videoId;
    document.getElementById('result-status').textContent = result.privacyStatus.toUpperCase();

    showAlert('🎉 Video published to YouTube successfully!', 'success');

    // Reload recent uploads
    loadRecentUploads();
}

// Handle Upload Error
function handleUploadError(error) {
    document.getElementById('upload-progress-card').style.display = 'none';
    document.getElementById('publish-btn').disabled = false;

    showAlert(`Upload failed: ${error}`, 'danger');
}

// Handle Disconnect
async function handleDisconnect() {
    if (!confirm('Disconnect your YouTube account? You will need to reconnect to publish videos.')) {
        return;
    }

    try {
        const response = await fetch('/api/youtube/disconnect', {
            method: 'POST'
        });

        const data = await response.json();

        if (data.success) {
            showAlert('YouTube account disconnected', 'info');
            checkYouTubeConnection();
        }
    } catch (error) {
        showAlert('Failed to disconnect', 'danger');
    }
}

// Load Recent Uploads
async function loadRecentUploads() {
    try {
        const response = await fetch('/api/youtube/recent-uploads');
        const videos = await response.json();

        const container = document.getElementById('recent-uploads');

        if (videos.length === 0) {
            container.innerHTML = '<p class="text-muted small">No recent uploads</p>';
            return;
        }

        container.innerHTML = videos.map(video => `
      <div class="uploaded-video-item">
        <img src="${video.thumbnailUrl}" alt="${video.title}">
        <div class="uploaded-video-info">
          <div class="uploaded-video-title">${video.title}</div>
          <div class="uploaded-video-date">${formatDate(video.publishedAt)}</div>
        </div>
      </div>
    `).join('');
    } catch (error) {
        console.error('Error loading recent uploads:', error);
    }
}

// Reset Form
function resetForm() {
    document.getElementById('success-card').style.display = 'none';
    document.getElementById('upload-progress-card').style.display = 'none';
    document.getElementById('publish-form').reset();
    document.getElementById('video-preview-section').style.display = 'none';
    document.getElementById('metadata-summary').style.display = 'none';
    currentProjectId = null;
}

// Utilities
function formatNumber(num) {
    if (num >= 1000000) return (num / 1000000).toFixed(1) + 'M';
    if (num >= 1000) return (num / 1000).toFixed(1) + 'K';
    return num;
}

function formatDuration(seconds) {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = Math.floor(seconds % 60);

    if (hours > 0) {
        return `${hours}h ${minutes}m`;
    }
    return `${minutes}m ${secs}s`;
}

function formatDate(dateString) {
    const date = new Date(dateString);
    const now = new Date();
    const diff = now - date;
    const days = Math.floor(diff / (1000 * 60 * 60 * 24));

    if (days === 0) return 'Today';
    if (days === 1) return 'Yesterday';
    if (days < 7) return `${days} days ago`;
    return date.toLocaleDateString();
}

function showAlert(message, type) {
    const alert = document.createElement('div');
    alert.className = `alert alert-${type} alert-dismissible fade show position-fixed top-0 start-50 translate-middle-x mt-3`;
    alert.style.zIndex = '9999';
    alert.role = 'alert';
    alert.innerHTML = `
    ${message}
    <button type="button" class="btn-close" data-bs-dismiss="alert"></button>
  `;

    document.body.appendChild(alert);

    setTimeout(() => {
        alert.remove();
    }, 5000);
}
