// Video Composer Client-Side Logic

let socket = null;
let currentJobId = null;
let startTime = null;

// Initialize
document.addEventListener('DOMContentLoaded', () => {
    initializeSocketIO();
    loadAvailableVideos();
    loadGeneratedAudio();
    setupEventListeners();
    initializeTooltips();
});

// Socket.IO Connection
function initializeSocketIO() {
    socket = io();

    socket.on('connect', () => {
        console.log('✅ Socket connected');
    });

    socket.on('job:progress', (data) => {
        updateProgress(data.progress, data.message);
    });

    socket.on('job:completed', (data) => {
        handleAssemblyComplete(data.result);
    });

    socket.on('job:failed', (data) => {
        handleAssemblyError(data.error);
    });
}

// Load Available Videos from Gallery
async function loadAvailableVideos() {
    try {
        const response = await fetch('/api/video/available');
        const videos = await response.json();

        const select = document.getElementById('sourceVideo');

        if (videos.length === 0) {
            select.innerHTML = '<option value="">No videos in gallery. Upload videos first.</option>';
            return;
        }

        select.innerHTML = '<option value="">Select a video...</option>';

        videos.forEach(video => {
            const option = document.createElement('option');
            option.value = video.id;
            option.textContent = `${video.title} (${formatDuration(video.duration)})`;
            option.dataset.videoData = JSON.stringify(video);
            select.appendChild(option);
        });
    } catch (error) {
        console.error('Error loading videos:', error);
        showAlert('Failed to load videos from gallery', 'danger');
    }
}

// Load Generated Audio Files
async function loadGeneratedAudio() {
    try {
        const response = await fetch('/api/audio/output-files');
        const audioFiles = await response.json();

        const select = document.getElementById('generatedAudio');

        if (audioFiles.length === 0) {
            select.innerHTML = '<option value="">No generated audio. Generate in Audio Studio first.</option>';
            return;
        }

        select.innerHTML = '<option value="">Select audio...</option>';

        audioFiles.forEach(audio => {
            const option = document.createElement('option');
            option.value = audio.path;
            option.textContent = `${audio.name} (${formatDuration(audio.duration)})`;
            option.dataset.audioData = JSON.stringify(audio);
            select.appendChild(option);
        });
    } catch (error) {
        console.error('Error loading audio:', error);
    }
}

// Setup Event Listeners
function setupEventListeners() {
    // Source video selection
    document.getElementById('sourceVideo').addEventListener('change', handleVideoSelection);

    // Audio source toggle
    document.querySelectorAll('input[name="audioSource"]').forEach(radio => {
        radio.addEventListener('change', handleAudioSourceChange);
    });

    // Loop type selection
    document.querySelectorAll('.loop-type-card').forEach(card => {
        card.addEventListener('click', function () {
            document.querySelectorAll('.loop-type-card').forEach(c => c.classList.remove('selected'));
            this.classList.add('selected');
            document.getElementById('loopType').value = this.dataset.loopType;
        });
    });

    // Select ping-pong by default
    document.querySelector('[data-loop-type="ping-pong"]').classList.add('selected');

    // Form submission
    document.getElementById('video-config-form').addEventListener('submit', handleAssemble);

    // New video button
    document.getElementById('new-video-btn').addEventListener('click', resetForm);
}

// Handle Video Selection
function handleVideoSelection(e) {
    const select = e.target;
    const option = select.options[select.selectedIndex];

    if (!option.dataset.videoData) {
        document.getElementById('video-preview').style.display = 'none';
        return;
    }

    const video = JSON.parse(option.dataset.videoData);

    // Show preview
    const previewSection = document.getElementById('video-preview');
    const player = document.getElementById('preview-player');

    player.src = `/uploads/videos/${video.file_path}`;
    document.getElementById('preview-duration').textContent = formatDuration(video.duration);
    document.getElementById('preview-resolution').textContent = `${video.width || '?'}x${video.height || '?'}`;
    document.getElementById('preview-size').textContent = formatBytes(video.file_size);

    previewSection.style.display = 'block';
}

// Handle Audio Source Change
function handleAudioSourceChange(e) {
    const value = e.target.value;

    if (value === 'generated') {
        document.getElementById('generated-audio-section').style.display = 'block';
        document.getElementById('existing-audio-section').style.display = 'none';
    } else {
        document.getElementById('generated-audio-section').style.display = 'none';
        document.getElementById('existing-audio-section').style.display = 'block';
    }
}

// Handle Video Assembly
async function handleAssemble(e) {
    e.preventDefault();

    const sourceVideoId = document.getElementById('sourceVideo').value;
    const audioSource = document.querySelector('input[name="audioSource"]:checked').value;
    const loopType = document.getElementById('loopType').value;
    const outputName = document.getElementById('outputName').value;

    // Validation
    if (!sourceVideoId) {
        showAlert('Please select a source video', 'warning');
        return;
    }

    let audioPath = null;
    if (audioSource === 'generated') {
        audioPath = document.getElementById('generatedAudio').value;
        if (!audioPath) {
            showAlert('Please select or generate audio', 'warning');
            return;
        }
    } else {
        const audioFile = document.getElementById('audioFile').files[0];
        if (!audioFile) {
            showAlert('Please upload an audio file', 'warning');
            return;
        }
        // TODO: Upload audio file first
        showAlert('Audio file upload not implemented yet. Use generated audio.', 'info');
        return;
    }

    // Show progress
    document.getElementById('progress-card').style.display = 'block';
    document.getElementById('result-card').style.display = 'none';
    document.getElementById('assemble-btn').disabled = true;

    startTime = Date.now();
    updateElapsedTime();

    try {
        const response = await fetch('/api/video/assemble', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                videoId: parseInt(sourceVideoId),
                audioPath,
                loopType,
                outputName: outputName || null
            })
        });

        const data = await response.json();

        if (data.status === 'queued') {
            currentJobId = data.jobId;
            socket.emit('subscribe:job', { jobId: data.jobId });
            updateProgress(0, 'Job queued...');
        } else if (data.status === 'completed') {
            handleAssemblyComplete(data.result);
        } else {
            throw new Error(data.message || 'Unknown error');
        }
    } catch (error) {
        handleAssemblyError(error.message);
    }
}

// Update Progress
function updateProgress(progress, message) {
    const progressBar = document.getElementById('progress-bar');
    const progressMessage = document.getElementById('progress-message');

    progressBar.style.width = `${progress}%`;
    progressBar.textContent = `${progress}%`;
    progressMessage.textContent = message;
}

// Update Elapsed Time
function updateElapsedTime() {
    if (!startTime) return;

    const elapsed = Math.floor((Date.now() - startTime) / 1000);
    document.getElementById('progress-time').textContent = `Elapsed: ${elapsed}s`;

    setTimeout(updateElapsedTime, 1000);
}

// Handle Assembly Complete
function handleAssemblyComplete(result) {
    startTime = null;

    document.getElementById('progress-card').style.display = 'none';
    document.getElementById('result-card').style.display = 'block';
    document.getElementById('assemble-btn').disabled = false;

    // Set video source
    const video = document.getElementById('result-video');
    video.src = result.relativePath;

    // Set download link
    const downloadBtn = document.getElementById('download-video-btn');
    downloadBtn.href = result.relativePath;
    downloadBtn.download = result.fileName;

    // Set metadata
    document.getElementById('result-video-size').textContent = formatBytes(result.fileSize);
    document.getElementById('result-video-duration').textContent = formatDuration(result.duration);
    document.getElementById('result-video-time').textContent = `${result.generationTime}s`;

    showAlert('Video assembled successfully!', 'success');
}

// Handle Assembly Error
function handleAssemblyError(error) {
    startTime = null;

    document.getElementById('progress-card').style.display = 'none';
    document.getElementById('assemble-btn').disabled = false;

    showAlert(`Assembly failed: ${error}`, 'danger');
}

// Reset Form
function resetForm() {
    document.getElementById('result-card').style.display = 'none';
    document.getElementById('progress-card').style.display = 'none';
    document.getElementById('assemble-btn').disabled = false;

    // Clear video
    const video = document.getElementById('result-video');
    video.pause();
    video.src = '';

    // Reset form
    document.getElementById('video-config-form').reset();
    document.getElementById('video-preview').style.display = 'none';

    // Reset loop type selection
    document.querySelectorAll('.loop-type-card').forEach(c => c.classList.remove('selected'));
    document.querySelector('[data-loop-type="ping-pong"]').classList.add('selected');
}

// Utilities
function formatBytes(bytes) {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(2) + ' KB';
    if (bytes < 1024 * 1024 * 1024) return (bytes / (1024 * 1024)).toFixed(2) + ' MB';
    return (bytes / (1024 * 1024 * 1024)).toFixed(2) + ' GB';
}

function formatDuration(seconds) {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = Math.floor(seconds % 60);

    if (hours > 0) {
        return `${hours}h ${minutes}m ${secs}s`;
    }
    if (minutes > 0) {
        return `${minutes}m ${secs}s`;
    }
    return `${secs}s`;
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

function initializeTooltips() {
    const tooltipTriggerList = [].slice.call(document.querySelectorAll('[data-bs-toggle="tooltip"]'));
    tooltipTriggerList.map(function (tooltipTriggerEl) {
        return new bootstrap.Tooltip(tooltipTriggerEl);
    });
}
