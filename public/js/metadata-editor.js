// Metadata Editor Client-Side Logic

let tags = [];
let currentProjectId = null;

// Initialize
document.addEventListener('DOMContentLoaded', () => {
    loadProjects();
    checkAIStatus();
    setupEventListeners();
    setupRealTimePreview();
});

// Load Projects
async function loadProjects() {
    try {
        const response = await fetch('/api/metadata/projects');
        const projects = await response.json();

        const select = document.getElementById('projectSelect');

        if (projects.length === 0) {
            select.innerHTML = '<option value="">No projects found. Create audio/video first.</option>';
            return;
        }

        select.innerHTML = '<option value="">Select a project...</option>';

        projects.forEach(project => {
            const option = document.createElement('option');
            option.value = project.id;

            const duration = Math.floor(project.audio_duration / 60);
            const type = project.type === 'audio_only' ? '🎵' : '🎬';

            option.textContent = `${type} ${project.name} (${duration} min)`;
            option.dataset.projectData = JSON.stringify(project);

            select.appendChild(option);
        });

        // Auto-select if only one project
        if (projects.length === 1) {
            select.value = projects[0].id;
            loadProjectMetadata(projects[0].id);
        }
    } catch (error) {
        console.error('Error loading projects:', error);
        showAlert('Failed to load projects', 'danger');
    }
}

// Check AI Status
async function checkAIStatus() {
    try {
        const response = await fetch('/api/metadata/ai-status');
        const data = await response.json();

        if (data.available) {
            document.getElementById('ai-available').style.display = 'block';
            document.getElementById('ai-unavailable').style.display = 'none';
            document.getElementById('ai-generate-btn').disabled = false;
        } else {
            document.getElementById('ai-available').style.display = 'none';
            document.getElementById('ai-unavailable').style.display = 'block';
            document.getElementById('ai-generate-btn').disabled = true;
        }
    } catch (error) {
        console.error('Error checking AI status:', error);
        document.getElementById('ai-generate-btn').disabled = true;
    }
}

// Setup Event Listeners
function setupEventListeners() {
    // Project selection
    document.getElementById('projectSelect').addEventListener('change', (e) => {
        const projectId = e.target.value;
        if (projectId) {
            currentProjectId = projectId;
            loadProjectMetadata(projectId);
        }
    });

    // AI Generate
    document.getElementById('ai-generate-btn').addEventListener('click', handleAIGenerate);

    // Tag management
    document.getElementById('add-tag-btn').addEventListener('click', addTag);
    document.getElementById('tagInput').addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
            e.preventDefault();
            addTag();
        }
    });

    // Form submission
    document.getElementById('metadata-form').addEventListener('submit', handleSaveMetadata);

    // Clear button
    document.getElementById('clear-btn').addEventListener('click', clearForm);
}

// Setup Real-Time Preview
function setupRealTimePreview() {
    // Title preview
    document.getElementById('metaTitle').addEventListener('input', (e) => {
        const count = e.target.value.length;
        document.getElementById('title-char-count').textContent = `(${count}/100)`;
        document.getElementById('preview-title').textContent = e.target.value || 'Your title will appear here';
    });

    // Description preview
    document.getElementById('metaDescription').addEventListener('input', (e) => {
        const count = e.target.value.length;
        document.getElementById('desc-char-count').textContent = `(${count}/5000)`;

        const preview = e.target.value || 'Your description will appear here...';
        document.getElementById('preview-desc').textContent = preview;
    });
}

// Load Project Metadata
async function loadProjectMetadata(projectId) {
    try {
        const response = await fetch(`/api/metadata/project/${projectId}`);
        const data = await response.json();

        if (data.metadata) {
            // Load existing metadata
            document.getElementById('metaTitle').value = data.metadata.title || '';
            document.getElementById('metaDescription').value = data.metadata.description || '';

            if (data.metadata.tags) {
                tags = typeof data.metadata.tags === 'string'
                    ? JSON.parse(data.metadata.tags)
                    : data.metadata.tags;
                renderTags();
            }

            if (data.metadata.category) {
                document.getElementById('metaCategory').value = data.metadata.category;
            }

            if (data.metadata.privacy) {
                const privacyInput = document.querySelector(`input[name="privacy"][value="${data.metadata.privacy}"]`);
                if (privacyInput) privacyInput.checked = true;
            }

            // Trigger preview updates
            document.getElementById('metaTitle').dispatchEvent(new Event('input'));
            document.getElementById('metaDescription').dispatchEvent(new Event('input'));
        }
    } catch (error) {
        console.error('Error loading project metadata:', error);
    }
}

// Handle AI Generate
async function handleAIGenerate() {
    if (!currentProjectId) {
        showAlert('Please select a project first', 'warning');
        return;
    }

    const select = document.getElementById('projectSelect');
    const option = select.options[select.selectedIndex];
    const projectData = JSON.parse(option.dataset.projectData);

    const customInstructions = document.getElementById('customInstructions').value;

    // Disable button and show loading
    const btn = document.getElementById('ai-generate-btn');
    const originalText = btn.innerHTML;
    btn.disabled = true;
    btn.innerHTML = '<span class="spinner-border spinner-border-sm me-2"></span>Generating...';

    try {
        const response = await fetch('/api/metadata/generate', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                projectId: currentProjectId,
                customInstructions
            })
        });

        const data = await response.json();

        if (data.success) {
            // Fill form with AI-generated metadata
            document.getElementById('metaTitle').value = data.metadata.title;
            document.getElementById('metaDescription').value = data.metadata.description;

            tags = data.metadata.tags;
            renderTags();

            // Trigger preview updates
            document.getElementById('metaTitle').dispatchEvent(new Event('input'));
            document.getElementById('metaDescription').dispatchEvent(new Event('input'));

            showAlert('✨ Metadata generated successfully! You can customize it before saving.', 'success');
        } else {
            throw new Error(data.error || 'Failed to generate metadata');
        }
    } catch (error) {
        console.error('AI generation error:', error);
        showAlert(`Failed to generate metadata: ${error.message}`, 'danger');
    } finally {
        btn.disabled = false;
        btn.innerHTML = originalText;
    }
}

// Tag Management
function addTag() {
    const input = document.getElementById('tagInput');
    const tag = input.value.trim();

    if (!tag) return;

    if (tags.includes(tag)) {
        showAlert('Tag already added', 'warning');
        return;
    }

    if (tags.length >= 30) {
        showAlert('Maximum 30 tags allowed', 'warning');
        return;
    }

    tags.push(tag);
    input.value = '';
    renderTags();
}

function removeTag(tag) {
    tags = tags.filter(t => t !== tag);
    renderTags();
}

function renderTags() {
    const container = document.getElementById('tags-display');
    const count = document.getElementById('tags-count');
    const hiddenInput = document.getElementById('metaTags');

    count.textContent = `(${tags.length} tags)`;
    hiddenInput.value = JSON.stringify(tags);

    if (tags.length === 0) {
        container.innerHTML = '<span class="text-muted small">No tags added yet</span>';
        document.getElementById('preview-tags').innerHTML = '<small class="text-muted">No tags</small>';
        return;
    }

    container.innerHTML = tags.map(tag => `
    <span class="tag-badge">
      ${tag}
      <span class="remove-tag" onclick="removeTag('${tag}')">×</span>
    </span>
  `).join('');

    // Preview tags (first 5)
    const previewTags = tags.slice(0, 5).map(tag =>
        `<span class="badge bg-secondary me-1">${tag}</span>`
    ).join('');

    const moreText = tags.length > 5 ? ` +${tags.length - 5} more` : '';
    document.getElementById('preview-tags').innerHTML = previewTags + (moreText ? `<small class="text-muted">${moreText}</small>` : '');
}

// Handle Save Metadata
async function handleSaveMetadata(e) {
    e.preventDefault();

    if (!currentProjectId) {
        showAlert('Please select a project', 'warning');
        return;
    }

    const title = document.getElementById('metaTitle').value;
    const description = document.getElementById('metaDescription').value;
    const category = document.getElementById('metaCategory').value;
    const privacy = document.querySelector('input[name="privacy"]:checked').value;

    if (!title) {
        showAlert('Title is required', 'warning');
        return;
    }

    const metadata = {
        title,
        description,
        tags,
        category,
        privacy
    };

    try {
        const response = await fetch('/api/metadata/save', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                projectId: currentProjectId,
                metadata
            })
        });

        const data = await response.json();

        if (data.success) {
            showAlert('✅ Metadata saved successfully!', 'success');
        } else {
            throw new Error(data.error || 'Failed to save');
        }
    } catch (error) {
        console.error('Save error:', error);
        showAlert(`Failed to save metadata: ${error.message}`, 'danger');
    }
}

// Clear Form
function clearForm() {
    if (!confirm('Clear all fields? This cannot be undone.')) {
        return;
    }

    document.getElementById('metaTitle').value = '';
    document.getElementById('metaDescription').value = '';
    document.getElementById('customInstructions').value = '';
    document.getElementById('metaCategory').value = '';
    document.querySelector('input[name="privacy"][value="public"]').checked = true;

    tags = [];
    renderTags();

    // Clear previews
    document.getElementById('preview-title').textContent = 'Your title will appear here';
    document.getElementById('preview-desc').textContent = 'Your description will appear here...';
    document.getElementById('title-char-count').textContent = '(0/100)';
    document.getElementById('desc-char-count').textContent = '(0/5000)';
}

// Utilities
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

// Make removeTag globally available
window.removeTag = removeTag;
