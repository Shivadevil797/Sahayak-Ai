/**
 * Sahayak AI — Guardian Dashboard Logic
 */

// ── Application State ──
const state = {
  currentPage: 1,
  limit: 10,
  totalPages: 1,
  riskFilter: 'ALL',
  categoryFilter: 'ALL',
  searchQuery: '',
  stats: null,
  activeSpeechText: null,
};

// ── Scam Preset Templates ──
const PRESETS = {
  'electricity': {
    text: 'Aapka electricity bill 3 mahine se pending hai. Aaj sham 6 baje tak Rs 4500 UPI se bhejiye nahi toh bijli connection permanently kat jayega. Payment link: bit.ly/elec-pay',
    lang: 'Hindi',
  },
  'digital-arrest': {
    text: 'Dear Citizen, This is Central Bureau of Investigation (CBI) New Delhi. Your Aadhaar number is flagged in money laundering FIR-2024/9912. You are under immediate Digital Arrest. Do not disconnect this call or leave your room. Pay security deposit of Rs 1,00,000 to verify account or police will arrive in 30 minutes.',
    lang: 'Hindi',
  },
  'jio-lottery': {
    text: 'Congratulations! You have won Rs 50,00,000 in Reliance Jio 5G lucky draw contest. Send Rs 4,999 registration fee immediately via GooglePay to claim your prize. Contact Manager at 9876543210.',
    lang: 'English',
  },
  'sbi-kyc': {
    text: 'Dear SBI Customer, Your YONO account has been suspended due to pending KYC update. Click here http://sbi-kyc-verify-net.ru/login to update Aadhaar and PAN immediately to prevent permanent deactivation.',
    lang: 'Hindi',
  },
  'family-clone': {
    text: 'Dadaji, I am in serious trouble in police station. Please do not tell Mummy Papa, they will get very angry. I need Rs 25,000 right now for bail settlement. Send to this UPI ID: police-bail-officer@upi urgently please!',
    lang: 'Hindi',
  },
};

// ── DOM Elements ──
const systemStatusPill = document.getElementById('system-status-pill');
const systemStatusText = document.getElementById('system-status-text');

// Stat Elements
const statTotal = document.getElementById('stat-total-reports');
const statLast24h = document.getElementById('stat-last24h');
const statCritical = document.getElementById('stat-critical-count');
const statCaregivers = document.getElementById('stat-caregivers-count');
const statActiveSeniors = document.getElementById('stat-active-seniors');
const categoryBarsContainer = document.getElementById('category-bars');
const channelTextCount = document.getElementById('channel-text-count');
const channelImageCount = document.getElementById('channel-image-count');
const channelAudioCount = document.getElementById('channel-audio-count');

// Simulator Elements
const simulatorForm = document.getElementById('simulator-form');
const simSeniorPhone = document.getElementById('sim-senior-phone');
const simLanguage = document.getElementById('sim-language');
const simPayload = document.getElementById('sim-payload');
const simSubmitBtn = document.getElementById('sim-submit-btn');
const simClearBtn = document.getElementById('sim-clear-btn');
const analysisOutput = document.getElementById('analysis-output');
const outputRiskBadge = document.getElementById('output-risk-badge');
const outputCategoryPill = document.getElementById('output-category-pill');
const outputExplanation = document.getElementById('output-explanation');
const outputAction = document.getElementById('output-action');
const outputCaregiverStatus = document.getElementById('output-caregiver-status');
const speakExplanationBtn = document.getElementById('speak-explanation-btn');

// Reports Feed Elements
const reportSearchInput = document.getElementById('report-search-input');
const filterRisk = document.getElementById('filter-risk');
const filterCategory = document.getElementById('filter-category');
const refreshReportsBtn = document.getElementById('refresh-reports-btn');
const refreshStatsBtn = document.getElementById('refresh-stats-btn');
const reportsTableBody = document.getElementById('reports-table-body');
const paginationInfo = document.getElementById('pagination-info');
const prevPageBtn = document.getElementById('prev-page-btn');
const nextPageBtn = document.getElementById('next-page-btn');

// Modals
const reportModal = document.getElementById('report-modal');
const modalReportBody = document.getElementById('modal-report-body');
const closeReportModal = document.getElementById('close-report-modal');
const closeReportModalBtn = document.getElementById('close-report-modal-btn');

const seniorsModal = document.getElementById('seniors-modal');
const openSeniorsBtn = document.getElementById('open-seniors-btn');
const closeSeniorsModal = document.getElementById('close-seniors-modal');
const closeSeniorsModalBtn = document.getElementById('close-seniors-modal-btn');
const seniorsTableBody = document.getElementById('seniors-table-body');
const switchToRegisterBtn = document.getElementById('switch-to-register-btn');

const registerModal = document.getElementById('register-modal');
const openRegisterBtn = document.getElementById('open-register-btn');
const closeRegisterModal = document.getElementById('close-register-modal');
const cancelRegisterModalBtn = document.getElementById('cancel-register-modal-btn');
const registerSeniorForm = document.getElementById('register-senior-form');
const toastContainer = document.getElementById('toast-container');

// ── Toast Utility ──
function showToast(message, type = 'info', duration = 3500) {
  const toast = document.createElement('div');
  toast.className = `toast ${type}`;
  let icon = 'ℹ️';
  if (type === 'success') icon = '✅';
  if (type === 'error') icon = '⚠️';
  toast.innerHTML = `<span>${icon}</span><span>${message}</span>`;
  toastContainer.appendChild(toast);
  setTimeout(() => {
    toast.style.opacity = '0';
    toast.style.transform = 'translateY(10px)';
    setTimeout(() => toast.remove(), 300);
  }, duration);
}

// ── Health Check ──
async function checkSystemHealth() {
  try {
    const res = await fetch('/health');
    const data = await res.json();
    if (data.status === 'UP' && data.database?.connected) {
      systemStatusPill.style.background = 'rgba(16, 185, 129, 0.1)';
      systemStatusPill.style.borderColor = 'rgba(16, 185, 129, 0.3)';
      systemStatusPill.querySelector('.pulse-dot').style.backgroundColor = '#10b981';
      systemStatusText.textContent = `Online • DB Connected (${data.uptime}s)`;
    } else {
      systemStatusPill.style.background = 'rgba(245, 158, 11, 0.1)';
      systemStatusPill.style.borderColor = 'rgba(245, 158, 11, 0.3)';
      systemStatusPill.querySelector('.pulse-dot').style.backgroundColor = '#f59e0b';
      systemStatusText.textContent = 'Degraded • DB Disconnected';
    }
  } catch (err) {
    systemStatusPill.style.background = 'rgba(239, 68, 68, 0.1)';
    systemStatusPill.style.borderColor = 'rgba(239, 68, 68, 0.3)';
    systemStatusPill.querySelector('.pulse-dot').style.backgroundColor = '#ef4444';
    systemStatusText.textContent = 'Offline';
  }
}

// ── Load Stats & Analytics ──
async function loadStats() {
  try {
    const res = await fetch('/api/v1/reports/stats');
    const json = await res.json();
    if (!json.success) throw new Error(json.error?.message || 'Failed to fetch stats');

    const s = json.data;
    state.stats = s;

    statTotal.textContent = s.totalReports.toLocaleString();
    statLast24h.textContent = s.reportsLast24h.toLocaleString();
    statCritical.textContent = (s.byRisk.CRITICAL || 0).toLocaleString();
    statCaregivers.textContent = s.caregiversAlerted.toLocaleString();
    statActiveSeniors.textContent = s.activeSeniors.toLocaleString();

    channelTextCount.textContent = s.byInput.TEXT || 0;
    channelImageCount.textContent = s.byInput.IMAGE || 0;
    channelAudioCount.textContent = s.byInput.AUDIO || 0;

    // Render category progress bars
    renderCategoryBars(s.byCategory, s.totalReports);
  } catch (err) {
    console.error('Error loading stats:', err);
    showToast('Failed to load dashboard metrics', 'error');
  }
}

function renderCategoryBars(byCategory, total) {
  categoryBarsContainer.innerHTML = '';
  const entries = Object.entries(byCategory || {});

  if (entries.length === 0 || total === 0) {
    categoryBarsContainer.innerHTML = '<div style="color: var(--text-dim); font-size: 13px;">No threats detected yet. Run a simulation!</div>';
    return;
  }

  const categoryClassMap = {
    'DIGITAL_ARREST': 'digital-arrest',
    'FAKE_KYC': 'fake-kyc',
    'UPI_FRAUD': 'upi-fraud',
    'LOTTERY': 'lottery',
    'FAMILY_EMERGENCY_CLONE': 'clone',
    'UNKNOWN': 'unknown',
    'NONE': 'unknown',
  };

  entries.forEach(([cat, count]) => {
    const pct = Math.round((count / total) * 100);
    const fillClass = categoryClassMap[cat] || 'unknown';

    const row = document.createElement('div');
    row.className = 'category-row';
    row.innerHTML = `
      <div class="category-meta">
        <span class="category-name">${formatCategoryName(cat)}</span>
        <span class="category-count">${count} (${pct}%)</span>
      </div>
      <div class="bar-track">
        <div class="bar-fill ${fillClass}" style="width: ${pct}%;"></div>
      </div>
    `;
    categoryBarsContainer.appendChild(row);
  });
}

function formatCategoryName(name) {
  return name.replace(/_/g, ' ').toLowerCase().replace(/\b\w/g, (c) => c.toUpperCase());
}

// ── Load Scam Reports Table ──
async function loadReports() {
  reportsTableBody.innerHTML = `
    <tr>
      <td colspan="8" style="text-align: center; color: var(--text-dim); padding: 24px;">
        Refreshing threats database...
      </td>
    </tr>
  `;

  try {
    const params = new URLSearchParams({
      page: state.currentPage,
      limit: state.limit,
      risk_level: state.riskFilter,
      scam_category: state.categoryFilter,
    });

    if (state.searchQuery) {
      params.append('search', state.searchQuery);
    }

    const res = await fetch(`/api/v1/reports?${params.toString()}`);
    const json = await res.json();
    if (!json.success) throw new Error(json.error?.message || 'Failed to fetch reports');

    const { data: reports, pagination } = json;
    state.totalPages = pagination.totalPages;

    paginationInfo.textContent = `Showing page ${pagination.page} of ${pagination.totalPages} (${pagination.totalItems} total logs)`;
    prevPageBtn.disabled = pagination.page <= 1;
    nextPageBtn.disabled = pagination.page >= pagination.totalPages;

    if (reports.length === 0) {
      reportsTableBody.innerHTML = `
        <tr>
          <td colspan="8" style="text-align: center; color: var(--text-dim); padding: 32px;">
            No scam reports match the specified filters.
          </td>
        </tr>
      `;
      return;
    }

    reportsTableBody.innerHTML = '';
    reports.forEach((report) => {
      const tr = document.createElement('tr');

      // Risk badge styling
      const riskLevel = report.risk_level || 'UNKNOWN';
      const riskClass = riskLevel === 'CRITICAL' ? 'critical' : riskLevel === 'SUSPICIOUS' ? 'suspicious' : 'safe';

      // Channel Icon
      let channelIcon = '💬';
      if (report.input_type === 'IMAGE') channelIcon = '🖼️';
      if (report.input_type === 'AUDIO') channelIcon = '🎙️';

      // User details
      const userName = report.user?.name || 'Walk-in / Test User';
      const userPhone = report.user?.phone_number || 'Direct API';

      // Caregiver alert status
      let caregiverBadge = '<span class="caregiver-pill none">None</span>';
      if (report.alert_caregiver) {
        caregiverBadge = '<span class="caregiver-pill alerted">🚨 Alerted</span>';
      }

      // Date formatting
      const dateStr = report.timestamp ? new Date(report.timestamp).toLocaleString('en-IN', {
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      }) : '--';

      tr.innerHTML = `
        <td>
          <div class="senior-meta">
            <span class="senior-name">${escapeHtml(userName)}</span>
            <span class="senior-phone">${escapeHtml(userPhone)}</span>
          </div>
        </td>
        <td>
          <span class="risk-badge ${riskClass}">
            ${riskLevel} (${report.risk_score})
          </span>
        </td>
        <td>
          <span style="font-weight: 500; font-size: 13px;">${formatCategoryName(report.scam_category || 'UNKNOWN')}</span>
        </td>
        <td>
          <span title="${report.input_type}">${channelIcon}</span>
        </td>
        <td>
          <div class="report-snippet" title="${escapeHtml(report.raw_input || '')}">
            ${escapeHtml(report.raw_input || '')}
          </div>
        </td>
        <td>${caregiverBadge}</td>
        <td style="color: var(--text-dim); font-size: 12px; white-space: nowrap;">${dateStr}</td>
        <td style="text-align: right; white-space: nowrap;">
          <button class="btn btn-secondary btn-sm inspect-btn" data-id="${report._id}">Inspect</button>
          <button class="btn btn-outline-danger btn-sm delete-btn" data-id="${report._id}" title="Delete Log">🗑️</button>
        </td>
      `;

      reportsTableBody.appendChild(tr);
    });

    // Attach row button listeners
    document.querySelectorAll('.inspect-btn').forEach((btn) => {
      btn.addEventListener('click', () => openReportDetails(btn.dataset.id));
    });

    document.querySelectorAll('.delete-btn').forEach((btn) => {
      btn.addEventListener('click', () => handleDeleteReport(btn.dataset.id));
    });
  } catch (err) {
    console.error('Error loading reports:', err);
    reportsTableBody.innerHTML = `
      <tr>
        <td colspan="8" style="text-align: center; color: #f87171; padding: 24px;">
          Failed to load reports: ${escapeHtml(err.message)}
        </td>
      </tr>
    `;
  }
}

// ── Delete Report ──
async function handleDeleteReport(id) {
  if (!confirm('Are you sure you want to delete this scam report?')) return;
  try {
    const res = await fetch(`/api/v1/reports/${id}`, { method: 'DELETE' });
    const json = await res.json();
    if (!json.success) throw new Error(json.error?.message || 'Deletion failed');
    showToast('Report deleted successfully', 'success');
    loadReports();
    loadStats();
  } catch (err) {
    showToast(err.message, 'error');
  }
}

// ── Open Report Details Modal ──
async function openReportDetails(id) {
  modalReportBody.innerHTML = '<div style="text-align: center; padding: 30px; color: var(--text-dim);">Loading report details...</div>';
  reportModal.classList.add('active');

  try {
    const res = await fetch(`/api/v1/reports/${id}`);
    const json = await res.json();
    if (!json.success) throw new Error(json.error?.message || 'Report not found');

    const r = json.data;
    const riskClass = r.risk_level === 'CRITICAL' ? 'critical' : r.risk_level === 'SUSPICIOUS' ? 'suspicious' : 'safe';

    modalReportBody.innerHTML = `
      <div style="display: flex; justify-content: space-between; align-items: center;">
        <span class="risk-badge ${riskClass}">
          ${r.risk_level} • Score: ${r.risk_score}/100
        </span>
        <span style="font-size: 13px; color: var(--text-muted);">
          Confidence: ${Math.round((r.confidence || 0.8) * 100)}%
        </span>
      </div>

      <div class="output-item">
        <span class="output-item-label">Scam Category</span>
        <div style="font-weight: 600; font-size: 15px; color: var(--text-main);">
          ${formatCategoryName(r.scam_category || 'UNKNOWN')}
        </div>
      </div>

      <div class="output-item">
        <span class="output-item-label">Raw Intercepted Payload (${r.input_type || 'TEXT'})</span>
        <div style="padding: 12px; background: var(--bg-tertiary); border: 1px solid var(--border-subtle); border-radius: var(--radius-sm); font-size: 13px; font-family: monospace; white-space: pre-wrap; word-break: break-word;">
          ${escapeHtml(r.raw_input || '')}
        </div>
      </div>

      <div class="output-item">
        <span class="output-item-label">Elder-Friendly Vernacular Guidance</span>
        <div class="explanation-box">${escapeHtml(r.elder_friendly_explanation || '')}</div>
      </div>

      <div class="output-item">
        <span class="output-item-label">Immediate Protective Action</span>
        <div class="action-box">${escapeHtml(r.immediate_action || '')}</div>
      </div>

      <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 12px; padding: 12px; background: rgba(255,255,255,0.02); border-radius: var(--radius-sm);">
        <div>
          <div style="font-size: 11px; text-transform: uppercase; color: var(--text-dim);">Protected Senior</div>
          <div style="font-size: 13.5px; font-weight: 600;">${escapeHtml(r.user?.name || 'Walk-in / Unknown')}</div>
          <div style="font-size: 12px; color: var(--text-muted);">${escapeHtml(r.user?.phone_number || '-')}</div>
        </div>
        <div>
          <div style="font-size: 11px; text-transform: uppercase; color: var(--text-dim);">Designated Caregiver</div>
          <div style="font-size: 13.5px; font-weight: 600;">${escapeHtml(r.user?.caregiver_name || 'None')}</div>
          <div style="font-size: 12px; color: var(--text-muted);">${escapeHtml(r.user?.caregiver_phone || '-')}</div>
        </div>
      </div>

      <div style="display: flex; justify-content: space-between; align-items: center; font-size: 12px; color: var(--text-dim); margin-top: 6px;">
        <span>Caregiver Alert: ${r.alert_caregiver ? '🚨 Yes (Escalated)' : 'No'}</span>
        <span>Detected: ${new Date(r.timestamp).toLocaleString()}</span>
      </div>
    `;
  } catch (err) {
    modalReportBody.innerHTML = `<div style="color: #f87171; text-align: center;">Error loading report: ${escapeHtml(err.message)}</div>`;
  }
}

// ── Threat Simulator Execution ──
simulatorForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  const text = simPayload.value.trim();
  const language = simLanguage.value;
  const phoneNumber = simSeniorPhone.value.trim();

  if (!text) {
    showToast('Please enter message text to analyze', 'error');
    return;
  }

  simSubmitBtn.disabled = true;
  simSubmitBtn.innerHTML = '<span>⏳</span> Analyzing with Gemini AI...';

  try {
    const res = await fetch('/api/v1/analyze', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        text,
        language,
        phone_number: phoneNumber || undefined,
      }),
    });

    const json = await res.json();
    if (!json.success) {
      throw new Error(json.error?.message || json.error || 'Analysis failed');
    }

    const d = json.data;
    state.activeSpeechText = d.elder_friendly_explanation;

    // Render results in result box
    const riskLevel = d.risk_level || 'UNKNOWN';
    const riskClass = riskLevel === 'CRITICAL' ? 'critical' : riskLevel === 'SUSPICIOUS' ? 'suspicious' : 'safe';

    outputRiskBadge.className = `risk-badge ${riskClass}`;
    outputRiskBadge.textContent = `${riskLevel} (${d.risk_score}/100)`;
    outputCategoryPill.textContent = `Category: ${formatCategoryName(d.scam_category || 'UNKNOWN')}`;
    outputExplanation.textContent = d.elder_friendly_explanation || 'No explanation provided.';
    outputAction.textContent = d.immediate_action || 'Be cautious.';

    if (d.alert_caregiver || d.risk_score >= 75) {
      outputCaregiverStatus.innerHTML = '🚨 <span style="color: #f87171; font-weight: 600;">Caregiver WhatsApp Alert Dispatched</span>';
    } else {
      outputCaregiverStatus.innerHTML = 'ℹ️ <span style="color: #94a3b8;">Caregiver alert not triggered</span>';
    }

    analysisOutput.style.display = 'block';
    showToast(`Analysis complete: ${riskLevel} threat detected (${d.risk_score}/100)`, 'success');

    // Auto refresh feed & statistics
    loadStats();
    loadReports();
  } catch (err) {
    console.error('Simulator error:', err);
    showToast(`Analysis failed: ${err.message}`, 'error');
  } finally {
    simSubmitBtn.disabled = false;
    simSubmitBtn.innerHTML = '<span>🛡️</span> Run Scam Intelligence Analysis';
  }
});

// Clear Simulator
simClearBtn.addEventListener('click', () => {
  simPayload.value = '';
  analysisOutput.style.display = 'none';
  state.activeSpeechText = null;
});

// Web Speech API Voice Readout
speakExplanationBtn.addEventListener('click', () => {
  if (!state.activeSpeechText) {
    showToast('No explanation available to speak', 'info');
    return;
  }

  if (!('speechSynthesis' in window)) {
    showToast('Speech synthesis not supported in this browser', 'error');
    return;
  }

  window.speechSynthesis.cancel();
  const utterance = new SpeechSynthesisUtterance(state.activeSpeechText);
  utterance.rate = 0.9; // Slightly slower for elderly comprehension
  utterance.pitch = 1.0;

  // Attempt to select vernacular voice
  const voices = window.speechSynthesis.getVoices();
  const selectedLang = simLanguage.value.toLowerCase();
  const langMatch = voices.find((v) =>
    (selectedLang.includes('hindi') && (v.lang.startsWith('hi') || v.name.includes('Hindi'))) ||
    (selectedLang.includes('english') && v.lang.startsWith('en-IN'))
  );

  if (langMatch) {
    utterance.voice = langMatch;
  }

  window.speechSynthesis.speak(utterance);
  showToast('🔊 Speaking vernacular explanation...', 'info');
});

// ── Preset Buttons ──
document.querySelectorAll('.preset-chip').forEach((btn) => {
  btn.addEventListener('click', () => {
    const key = btn.dataset.preset;
    const preset = PRESETS[key];
    if (preset) {
      simPayload.value = preset.text;
      simLanguage.value = preset.lang;
      simPayload.focus();
      showToast(`Loaded "${btn.textContent.trim()}" preset`, 'info', 2000);
    }
  });
});

// ── Manage Seniors Directory ──
async function loadSeniors() {
  seniorsTableBody.innerHTML = '<tr><td colspan="5" style="text-align: center;">Loading senior citizens...</td></tr>';
  try {
    const res = await fetch('/api/v1/seniors');
    const json = await res.json();
    if (!json.success) throw new Error(json.error || 'Failed to fetch seniors');

    const seniors = json.data;
    if (seniors.length === 0) {
      seniorsTableBody.innerHTML = '<tr><td colspan="5" style="text-align: center; color: var(--text-dim);">No seniors registered yet. Click "Add Senior" to enroll.</td></tr>';
      return;
    }

    seniorsTableBody.innerHTML = '';
    seniors.forEach((s) => {
      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td style="font-weight: 600;">${escapeHtml(s.name)}</td>
        <td style="font-family: monospace;">${escapeHtml(s.phone_number)}</td>
        <td><span class="panel-badge">${escapeHtml(s.preferred_language)}</span></td>
        <td>${escapeHtml(s.caregiver_name || '-')}</td>
        <td style="font-family: monospace; color: #818cf8;">${escapeHtml(s.caregiver_phone)}</td>
      `;
      seniorsTableBody.appendChild(tr);
    });
  } catch (err) {
    seniorsTableBody.innerHTML = `<tr><td colspan="5" style="color: #f87171; text-align: center;">${escapeHtml(err.message)}</td></tr>`;
  }
}

// Register New Senior Citizen
registerSeniorForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  const name = document.getElementById('reg-name').value.trim();
  const phone_number = document.getElementById('reg-phone').value.trim();
  const preferred_language = document.getElementById('reg-lang').value;
  const caregiver_name = document.getElementById('reg-caregiver-name').value.trim();
  const caregiver_phone = document.getElementById('reg-caregiver-phone').value.trim();

  const saveBtn = document.getElementById('save-senior-btn');
  saveBtn.disabled = true;
  saveBtn.textContent = 'Enrolling...';

  try {
    const res = await fetch('/api/v1/seniors', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name,
        phone_number,
        preferred_language,
        caregiver_name,
        caregiver_phone,
      }),
    });

    const json = await res.json();
    if (!json.success) {
      throw new Error(json.error?.message || json.error || 'Registration failed');
    }

    showToast(`Senior citizen ${name} enrolled successfully!`, 'success');
    registerModal.classList.remove('active');
    registerSeniorForm.reset();
    loadStats();
  } catch (err) {
    showToast(err.message, 'error');
  } finally {
    saveBtn.disabled = false;
    saveBtn.textContent = 'Register Senior';
  }
});

// ── Modals Trigger & Close ──
openSeniorsBtn.addEventListener('click', () => {
  loadSeniors();
  seniorsModal.classList.add('active');
});

closeSeniorsModal.addEventListener('click', () => seniorsModal.classList.remove('active'));
closeSeniorsModalBtn.addEventListener('click', () => seniorsModal.classList.remove('active'));

openRegisterBtn.addEventListener('click', () => registerModal.classList.add('active'));
closeRegisterModal.addEventListener('click', () => registerModal.classList.remove('active'));
cancelRegisterModalBtn.addEventListener('click', () => registerModal.classList.remove('active'));

switchToRegisterBtn.addEventListener('click', () => {
  seniorsModal.classList.remove('active');
  registerModal.classList.add('active');
});

closeReportModal.addEventListener('click', () => reportModal.classList.remove('active'));
closeReportModalBtn.addEventListener('click', () => reportModal.classList.remove('active'));

// Close modal when clicking outside
window.addEventListener('click', (e) => {
  if (e.target === reportModal) reportModal.classList.remove('active');
  if (e.target === seniorsModal) seniorsModal.classList.remove('active');
  if (e.target === registerModal) registerModal.classList.remove('active');
});

// ── Filter & Search Handlers ──
let searchTimeout = null;
reportSearchInput.addEventListener('input', () => {
  clearTimeout(searchTimeout);
  searchTimeout = setTimeout(() => {
    state.searchQuery = reportSearchInput.value.trim();
    state.currentPage = 1;
    loadReports();
  }, 350);
});

filterRisk.addEventListener('change', () => {
  state.riskFilter = filterRisk.value;
  state.currentPage = 1;
  loadReports();
});

filterCategory.addEventListener('change', () => {
  state.categoryFilter = filterCategory.value;
  state.currentPage = 1;
  loadReports();
});

refreshReportsBtn.addEventListener('click', () => {
  loadReports();
  showToast('Refreshed scam reports feed', 'info', 1500);
});

refreshStatsBtn.addEventListener('click', () => {
  loadStats();
  showToast('Refreshed analytics metrics', 'info', 1500);
});

prevPageBtn.addEventListener('click', () => {
  if (state.currentPage > 1) {
    state.currentPage--;
    loadReports();
  }
});

nextPageBtn.addEventListener('click', () => {
  if (state.currentPage < state.totalPages) {
    state.currentPage++;
    loadReports();
  }
});

// ── Helpers ──
function escapeHtml(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

// ── Initialize App ──
function init() {
  checkSystemHealth();
  loadStats();
  loadReports();

  // Periodic health check & auto telemetry every 30s
  setInterval(() => {
    checkSystemHealth();
  }, 30000);
}

document.addEventListener('DOMContentLoaded', init);
