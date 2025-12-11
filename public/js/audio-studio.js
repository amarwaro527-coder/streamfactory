// Audio Studio Client-Side Logic

// State
let selectedPresetId = null;
let selectedStems = new Map(); // stem_id -> { id, name, volume, category }
let socket = null;
let currentJobId = null;
let startTime = null;

// Initialize
document.addEventListener('DOMContentLoaded', () => {
    initializeSocketIO();
    loadPresets();
    loadStems();
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
        handleGenerationComplete(data.result);
    });

    socket.on('job:failed', (data) => {
        handleGenerationError(data.error);
    });
}

// Load Presets
async function loadPresets() {
    try {
        const response = await fetch('/api/audio/presets');
        const presets = await response.json();

        const container = document.getElementById('presets-container');
        const template = document.getElementById('preset-card-template');

        presets.forEach(preset => {
            const card = template.content.cloneNode(true);
            const cardDiv = card.querySelector('.preset-card');

            cardDiv.dataset.presetId = preset.id;
            card.querySelector('.preset-name').textContent = preset.name;
            card.querySelector('.preset-description').textContent = preset.description;
            card.querySelector('.preset-stems-count').textContent =
                `${preset.stem_configs.length} stems`;

            cardDiv.addEventListener('click', () => selectPreset(preset));

            container.appendChild(card);
        });
    } catch (error) {
        console.error('Error loading presets:', error);
        showAlert('Failed to load presets', 'danger');
    }
}

// Load Stems by Category
async function loadStems() {
    try {
        const response = await fetch('/api/audio/stems');
        const stemsByCategory = await response.json();

        const container = document.getElementById('stems-categories');
        const template = document.getElementById('stem-item-template');

        for (const [category, stems] of Object.entries(stemsByCategory)) {
            const categoryDiv = document.createElement('div');
            categoryDiv.className = 'mb-4';
            categoryDiv.innerHTML = `
        <h6 class="text-uppercase text-muted mb-3">
          <i class="bi bi-folder"></i> ${category}
        </h6>
        <div class="stems-list" data-category="${category}"></div>
      `;

            const stemsList = categoryDiv.querySelector('.stems-list');

            stems.forEach(stem => {
                const stemItem = template.content.cloneNode(true);
                const checkbox = stemItem.querySelector('.stem-checkbox');
                const volumeSlider = stemItem.querySelector('.stem-volume');
                const volumeDisplay = stemItem.querySelector('.stem-volume-display');

                checkbox.dataset.stemId = stem.id;
                checkbox.dataset.stemData = JSON.stringify(stem);
                stemItem.querySelector('.stem-name').textContent = stem.name;

                checkbox.addEventListener('change', (e) => handleStemToggle(e, stem));
                volumeSlider.addEventListener('input', (e) => {
                    const volume = parseFloat(e.target.value);
                    volumeDisplay.textContent = `${Math.round(volume * 100)}%`;
                    updateStemVolume(stem.id, volume);
                });

                stemsList.appendChild(stemItem);
            });

            container.appendChild(categoryDiv);
        }
    } catch (error) {
        console.error('Error loading stems:', error);
        showAlert('Failed to load audio stems', 'danger');
    }
}

// Select Preset
function selectPreset(preset) {
    selectedPresetId = preset.id;
    selectedStems.clear();

    // Visual feedback
    document.querySelectorAll('.preset-card').forEach(card => {
        card.classList.remove('selected');
    });
    document.querySelector(`[data-preset-id="${preset.id}"]`).classList.add('selected');

    // Load preset stems
    preset.stem_configs.forEach(config => {
        // Find stem data
        fetch(`/api/audio/stems/${config.stem_id}`)
            .then(r => r.json())
            .then(stem => {
                selectedStems.set(stem.id, {
                    id: stem.id,
                    name: stem.name,
                    volume: config.volume,
                    category: stem.category
                });
                updateSelectedStemsList();
            });
    });

    // Switch to presets tab if not already
    const presetsTab = new bootstrap.Tab(document.getElementById('presets-tab'));
    presetsTab.show();
}

// Handle Stem Toggle
function handleStemToggle(event, stem) {
    if (event.target.checked) {
        selectedStems.set(stem.id, {
            id: stem.id,
            name: stem.name,
            volume: stem.default_volume || 0.7,
            category: stem.category
        });
    } else {
        selectedStems.delete(stem.id);
    }

    selectedPresetId = null; // Deselect preset when custom mixing
    updateSelectedStemsList();
}

// Update Stem Volume
function updateStemVolume(stemId, volume) {
    if (selectedStems.has(stemId)) {
        const stem = selectedStems.get(stemId);
        stem.volume = volume;
        selectedStems.set(stemId, stem);
        updateSelectedStemsList();
    }
}

// Update Selected Stems List
function updateSelectedStemsList() {
    const container = document.getElementById('selected-stems-list');
    const count = document.getElementById('stem-count');

    count.textContent = selectedStems.size;

    if (selectedStems.size === 0) {
        container.innerHTML = `
      <p class="text-muted text-center">
        <i class="bi bi-arrow-left"></i> Select a preset or choose stems
      </p>
    `;
        return;
    }

    container.innerHTML = '';

    selectedStems.forEach((stem, id) => {
        const div = document.createElement('div');
        div.className = 'stem-item mb-2';
        div.innerHTML = `
      <div class="d-flex justify-content-between align-items-center">
        <div>
          <strong>${stem.name}</strong>
          <br>
          <small class="text-muted">${stem.category}</small>
        </div>
        <div class="text-end">
          <span class="badge bg-primary">${Math.round(stem.volume * 100)}%</span>
        </div>
      </div>
    `;
        container.appendChild(div);
    });
}

// Setup Event Listeners
function setupEventListeners() {
    // Config sliders
    const sliders = ['duration', 'volatility', 'spatialDrift', 'density'];
    sliders.forEach(id => {
        const slider = document.getElementById(id);
        const display = document.getElementById(`${id}-display`);

        slider.addEventListener('input', (e) => {
            let value = parseFloat(e.target.value);

            if (id === 'duration') {
                // Format duration
                const hours = Math.floor(value / 3600);
                const minutes = Math.floor((value % 3600) / 60);
                display.textContent = hours > 0
                    ? `${hours}h ${minutes}m`
                    : `${minutes} minutes`;
            } else {
                display.textContent = value.toFixed(1);
            }
        });
    });

    // Form submission
    document.getElementById('audio-config-form').addEventListener('submit', handleGenerate);

    // New audio button
    document.getElementById('new-audio-btn').addEventListener('click', resetForm);
}

// Handle Audio Generation
async function handleGenerate(e) {
    e.preventDefault();

    if (selectedStems.size === 0) {
        showAlert('Please select at least one audio stem', 'warning');
        return;
    }

    const config = {
        stems: Array.from(selectedStems.values()).map(stem => ({
            id: stem.id,
            volume: stem.volume
        })),
        duration: parseInt(document.getElementById('duration').value),
        volatility: parseFloat(document.getElementById('volatility').value),
        density: parseFloat(document.getElementById('density').value),
        spatialDrift: parseFloat(document.getElementById('spatialDrift').value)
    };

    // Show progress
    document.getElementById('progress-card').style.display = 'block';
    document.getElementById('result-card').style.display = 'none';
    document.getElementById('generate-btn').disabled = true;

    startTime = Date.now();
    updateElapsedTime();

    try {
        const response = await fetch('/api/audio/generate', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ config })
        });

        const data = await response.json();

        if (data.status === 'queued') {
            // Job queued - wait for Socket.io updates
            currentJobId = data.jobId;
            socket.emit('subscribe:job', { jobId: data.jobId });
            updateProgress(0, 'Job queued, waiting to start...');
        } else if (data.status === 'completed') {
            // Synchronous completion
            handleGenerationComplete(data.result);
        } else {
            throw new Error(data.message || 'Unknown error');
        }
    } catch (error) {
        handleGenerationError(error.message);
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

// Handle Generation Complete
function handleGenerationComplete(result) {
    startTime = null;

    document.getElementById('progress-card').style.display = 'none';
    document.getElementById('result-card').style.display = 'block';
    document.getElementById('generate-btn').disabled = false;

    // Set audio source
    const audio = document.getElementById('result-audio');
    audio.src = result.relativePath;

    // Set download link
    const downloadBtn = document.getElementById('download-btn');
    downloadBtn.href = result.relativePath;
    downloadBtn.download = result.fileName;

    // Set metadata
    document.getElementById('result-size').textContent = formatBytes(result.fileSize);
    document.getElementById('result-duration').textContent = formatDuration(result.duration);
    document.getElementById('result-time').textContent = `${result.generationTime}s`;

    showAlert('Audio generated successfully!', 'success');
}

// Handle Generation Error
function handleGenerationError(error) {
    startTime = null;

    document.getElementById('progress-card').style.display = 'none';
    document.getElementById('generate-btn').disabled = false;

    showAlert(`Generation failed: ${error}`, 'danger');
}

// Reset Form
function resetForm() {
    document.getElementById('result-card').style.display = 'none';
    document.getElementById('progress-card').style.display = 'none';
    document.getElementById('generate-btn').disabled = false;

    // Clear audio
    const audio = document.getElementById('result-audio');
    audio.pause();
    audio.src = '';
}

// Utilities
function formatBytes(bytes) {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(2) + ' KB';
    return (bytes / (1024 * 1024)).toFixed(2) + ' MB';
}

function formatDuration(seconds) {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    return hours > 0 ? `${hours}h ${minutes}m` : `${minutes}m`;
}

function showAlert(message, type) {
    // Create alert element
    const alert = document.createElement('div');
    alert.className = `alert alert-${type} alert-dismissible fade show position-fixed top-0 start-50 translate-middle-x mt-3`;
    alert.style.zIndex = '9999';
    alert.role = 'alert';
    alert.innerHTML = `
    ${message}
    <button type="button" class="btn-close" data-bs-dismiss="alert"></button>
  `;

    document.body.appendChild(alert);

    // Auto dismiss after 5 seconds
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
