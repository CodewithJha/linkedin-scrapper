// DOM Elements
const statusDot = document.getElementById('status-dot');
const statusLabel = document.getElementById('status-label');
const modeBadge = document.getElementById('mode-badge');
const jobsCount = document.getElementById('jobs-count');
const lastRunTime = document.getElementById('last-run-time');
const totalSessions = document.getElementById('total-sessions');
const sessionsPerDay = document.getElementById('sessions-per-day');
const gapHours = document.getElementById('gap-hours');
const currentSearch = document.getElementById('current-search');
const filesList = document.getElementById('files-list');
const filesSubtitle = document.getElementById('files-subtitle');
const runBtn = document.getElementById('run-btn');
const toast = document.getElementById('toast');

let isRunning = false;

// Toast notification
function showToast(message, type = 'success') {
  toast.textContent = message;
  toast.className = `toast ${type} show`;
  setTimeout(() => {
    toast.classList.remove('show');
  }, 3500);
}

// Format relative time
function formatRelativeTime(dateStr) {
  if (!dateStr) return '--';
  const date = new Date(dateStr);
  const now = new Date();
  const diffMs = now - date;
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMins < 1) return 'Just now';
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays === 1) return 'Yesterday';
  return date.toLocaleDateString();
}

// Format file size
function formatSize(bytes) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

// Update status display
function updateStatus(data) {
  isRunning = data.running;

  // Status indicator
  statusDot.className = `live-dot ${isRunning ? 'busy' : ''}`;
  statusLabel.textContent = isRunning ? 'Running...' : 'Online';

  // Jobs count - show today's total jobs, not just last session
  if (data.jobsToday !== undefined && data.jobsToday > 0) {
    jobsCount.textContent = data.jobsToday;
  } else if (data.lastRun) {
    jobsCount.textContent = data.lastRun.count || '0';
  } else {
    jobsCount.textContent = '0';
  }
  
  // Last run time
  if (data.lastRun) {
    lastRunTime.textContent = formatRelativeTime(data.lastRun.at);
  } else {
    lastRunTime.textContent = '--';
  }

  // Sessions today - use actual backend count
  totalSessions.textContent = data.sessionsToday > 0 ? data.sessionsToday : '0';

  // Schedule info
  if (data.schedule) {
    sessionsPerDay.textContent = `${data.schedule.sessionsPerDay} session${data.schedule.sessionsPerDay === 1 ? '' : 's'}`;
    gapHours.textContent = `${data.schedule.minGapHours}-${data.schedule.maxGapHours} hours`;

    // Update mode badge to reflect daily schedule when applicable
    if (
      data.schedule.sessionsPerDay === 1 &&
      data.schedule.minGapHours === 24 &&
      data.schedule.maxGapHours === 24
    ) {
      modeBadge.textContent = 'Daily • 1× / 24h';
    } else {
      modeBadge.textContent = 'Auto';
    }
  }

  // Current search
  if (data.scraping) {
    currentSearch.textContent = `"${data.scraping.keywords}" in ${data.scraping.location}`;
  }

  // Update button state
  runBtn.disabled = isRunning;
  if (isRunning) {
    runBtn.innerHTML = `
      <span class="spinner"></span>
      Running...
    `;
  } else {
    runBtn.innerHTML = `
      <svg class="btn-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
        <polygon points="5 3 19 12 5 21 5 3"></polygon>
      </svg>
      Run Session Now
    `;
  }
}

// Render files list
function renderFiles(files) {
  if (!files || files.length === 0) {
    filesSubtitle.textContent = 'No exports yet';
    filesList.innerHTML = `
      <div class="empty-state">
        <div class="empty-state-icon">📂</div>
        <p class="empty-state-text">No exports yet. Run a session to generate CSV files.</p>
      </div>
    `;
    return;
  }

  filesSubtitle.textContent = `${files.length} file${files.length > 1 ? 's' : ''} available`;

  filesList.innerHTML = files
    .map((f) => {
      const date = new Date(f.modified);
      const dateStr = date.toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      });

      return `
        <div class="file-item">
          <div class="file-info">
            <div class="file-icon">📄</div>
            <div class="file-details">
              <span class="file-name">${f.name}</span>
              <span class="file-meta">${formatSize(f.size)} • ${dateStr}</span>
            </div>
          </div>
          <a href="${f.url}" class="file-download" download>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
              <polyline points="7 10 12 15 17 10"></polyline>
              <line x1="12" y1="15" x2="12" y2="3"></line>
            </svg>
            Download
          </a>
        </div>
      `;
    })
    .join('');
}

// Fetch status
async function fetchStatus() {
  try {
    const res = await fetch('/api/status');
    if (!res.ok) throw new Error('Failed to fetch status');
    const data = await res.json();
    updateStatus(data);
  } catch (err) {
    statusDot.className = 'live-dot busy';
    statusLabel.textContent = 'Offline';
    console.error('Status fetch error:', err);
  }
}

// Fetch files
async function fetchFiles() {
  try {
    const res = await fetch('/api/files');
    if (!res.ok) throw new Error('Failed to fetch files');
    const data = await res.json();
    renderFiles(data.files || []);
  } catch (err) {
    filesSubtitle.textContent = 'Error loading files';
    console.error('Files fetch error:', err);
  }
}

// Run session
async function runSession() {
  if (isRunning) return;

  const keywords = document.getElementById('keywords').value.trim();
  const location = document.getElementById('location').value.trim();
  const results = document.getElementById('results').value.trim();

  const body = {};
  if (keywords) body.keywords = keywords;
  if (location) body.location = location;
  if (results) body.resultsPerSession = Number(results);

  runBtn.disabled = true;
  runBtn.innerHTML = `
    <span class="spinner"></span>
    Starting...
  `;

  try {
    const res = await fetch('/api/run', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    });

    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      throw new Error(data.message || 'Run failed');
    }

    const result = await res.json();
    showToast(`✓ Scraped ${result.count || 0} jobs successfully!`, 'success');
  } catch (err) {
    showToast(err.message || 'Failed to run session', 'error');
  } finally {
    await fetchStatus();
    await fetchFiles();
  }
}

// Event listeners
runBtn.addEventListener('click', runSession);

// Initial load
async function init() {
  await Promise.all([fetchStatus(), fetchFiles()]);
}

init();

// Refresh every 15 seconds
setInterval(async () => {
  await Promise.all([fetchStatus(), fetchFiles()]);
}, 15000);
