const RELEASE_API = 'https://api.github.com/repos/selfsecuredlab/lyrics-status/releases/latest';
const VIRUSTOTAL_RESULTS_URL = 'virustotal-results.json';

const formatBytes = (bytes) => `${(bytes / 1024 / 1024).toFixed(1)} MB`;
const getSha256 = (asset) => String(asset?.digest || '').replace(/^sha256:/i, '');
const shortenHash = (hash) => `${hash.slice(0, 8)}…${hash.slice(-8)}`;
const setText = (selector, value) => {
  const target = document.querySelector(selector);
  if (target) target.textContent = value;
};

const formatAnalysisDate = (value) => {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return new Intl.DateTimeFormat(undefined, {
    dateStyle: 'medium',
    timeStyle: 'short'
  }).format(date);
};

async function hydrateRelease() {
  try {
    const response = await fetch(RELEASE_API, {
      headers: { Accept: 'application/vnd.github+json' }
    });

    if (!response.ok) return;
    const release = await response.json();
    document.documentElement.dataset.latestRelease = release.tag_name || 'v1.0.0';
    const version = String(release.tag_name || 'v1.0.0').replace(/^v/, '');
    const assets = Array.isArray(release.assets) ? release.assets : [];
    const setup = assets.find((asset) => /setup.*\.exe$/i.test(asset.name));
    const portable = assets.find((asset) => /portable.*\.exe$/i.test(asset.name));

    document.querySelector('#release-label').textContent = `Latest release · v${version}`;
    document.querySelector('#download-version').textContent = version;
    document.querySelector('#download-count').textContent = assets
      .reduce((total, asset) => total + Number(asset.download_count || 0), 0)
      .toLocaleString();

    const assetMap = { setup, portable };
    document.querySelectorAll('.download-link').forEach((link) => {
      const asset = assetMap[link.dataset.asset];
      if (asset?.browser_download_url) link.href = asset.browser_download_url;
    });

    Object.entries(assetMap).forEach(([key, asset]) => {
      const size = document.querySelector(`[data-size="${key}"]`);
      if (size && asset?.size) size.textContent = formatBytes(asset.size);

      const hash = getSha256(asset);
      const virusTotalLink = document.querySelector(`[data-vt="${key}"]`);
      const hashLabel = document.querySelector(`[data-hash="${key}"]`);
      if (hash && virusTotalLink) {
        virusTotalLink.href = `https://www.virustotal.com/gui/file/${hash}/detection`;
      }
      if (hash && hashLabel) {
        hashLabel.textContent = shortenHash(hash);
        hashLabel.title = hash;
      }
    });
  } catch {
    // Static release links remain available if GitHub's API cannot be reached.
  }
}

function renderPendingVirusTotal(message = 'Waiting for the latest VirusTotal report') {
  document.querySelectorAll('[data-vt-card]').forEach((card) => {
    const key = card.dataset.vtCard;
    card.dataset.state = 'pending';
    setText(`[data-vt-state="${key}"]`, 'Pending');
    setText(`[data-vt-score="${key}"]`, '—');
    setText(`[data-vt-verdict="${key}"]`, message);
    setText(`[data-vt-not-flagged="${key}"]`, '—');
    setText(`[data-vt-flagged="${key}"]`, '—');
    setText(`[data-vt-no-verdict="${key}"]`, '—');
    const okMeter = document.querySelector(`[data-vt-meter-ok="${key}"]`);
    const hitMeter = document.querySelector(`[data-vt-meter-hit="${key}"]`);
    if (okMeter) okMeter.style.width = '34%';
    if (hitMeter) hitMeter.style.width = '0';
  });

  const overall = document.querySelector('[data-vt-overall]');
  if (overall) overall.dataset.state = 'pending';
  setText('[data-vt-overall-title]', 'VirusTotal results pending');
  setText('[data-vt-updated]', message);
}

function renderVirusTotalFile(key, file) {
  const card = document.querySelector(`[data-vt-card="${key}"]`);
  if (!card) return { available: false, state: 'pending', flagged: 0, notFlagged: 0, noVerdict: 0, analysisDate: null };

  const hash = String(file?.sha256 || '');
  if (hash) {
    const link = document.querySelector(`[data-vt="${key}"]`);
    const hashLabel = document.querySelector(`[data-hash="${key}"]`);
    if (link) link.href = file.reportUrl || `https://www.virustotal.com/gui/file/${hash}/detection`;
    if (hashLabel) {
      hashLabel.textContent = shortenHash(hash);
      hashLabel.title = hash;
    }
  }

  const stats = file?.stats;
  const available = file?.status === 'available' && stats && typeof stats === 'object';
  if (!available) {
    const notFound = file?.status === 'not_found';
    const message = notFound
      ? 'VirusTotal has not analyzed this exact file yet'
      : 'Waiting for the latest analysis results';
    card.dataset.state = 'pending';
    setText(`[data-vt-state="${key}"]`, notFound ? 'Not scanned' : 'Pending');
    setText(`[data-vt-score="${key}"]`, '—');
    setText(`[data-vt-verdict="${key}"]`, message);
    setText(`[data-vt-not-flagged="${key}"]`, '—');
    setText(`[data-vt-flagged="${key}"]`, '—');
    setText(`[data-vt-no-verdict="${key}"]`, '—');
    const okMeter = document.querySelector(`[data-vt-meter-ok="${key}"]`);
    const hitMeter = document.querySelector(`[data-vt-meter-hit="${key}"]`);
    if (okMeter) okMeter.style.width = '18%';
    if (hitMeter) hitMeter.style.width = '0';
    return { available: false, state: 'pending', flagged: 0, notFlagged: 0, noVerdict: 0, analysisDate: null };
  }

  const malicious = Number(stats.malicious || 0);
  const suspicious = Number(stats.suspicious || 0);
  const notFlagged = Number(stats.harmless || 0) + Number(stats.undetected || 0);
  const flagged = malicious + suspicious;
  const noVerdict = Number(stats.timeout || 0)
    + Number(stats['confirmed-timeout'] || 0)
    + Number(stats.failure || 0)
    + Number(stats['type-unsupported'] || 0);
  const state = malicious > 0 ? 'danger' : suspicious > 0 ? 'warning' : 'clear';
  const stateLabel = `${flagged.toLocaleString()} flagged`;
  const verdict = `${notFlagged === 1 ? 'engine did' : 'engines did'} not flag this file`;

  card.dataset.state = state;
  setText(`[data-vt-state="${key}"]`, stateLabel);
  setText(`[data-vt-score="${key}"]`, notFlagged.toLocaleString());
  setText(`[data-vt-verdict="${key}"]`, verdict);
  setText(`[data-vt-not-flagged="${key}"]`, notFlagged.toLocaleString());
  setText(`[data-vt-flagged="${key}"]`, flagged.toLocaleString());
  setText(`[data-vt-no-verdict="${key}"]`, noVerdict.toLocaleString());
  const verdictCount = notFlagged + flagged;
  const okPercent = verdictCount > 0 ? (notFlagged / verdictCount) * 100 : 0;
  const hitPercent = verdictCount > 0 ? (flagged / verdictCount) * 100 : 0;
  const okMeter = document.querySelector(`[data-vt-meter-ok="${key}"]`);
  const hitMeter = document.querySelector(`[data-vt-meter-hit="${key}"]`);
  if (okMeter) okMeter.style.width = `${okPercent}%`;
  if (hitMeter) {
    hitMeter.style.width = `${hitPercent}%`;
    hitMeter.style.minWidth = flagged > 0 ? '4px' : '0';
  }

  return { available: true, state, flagged, notFlagged, noVerdict, analysisDate: file.lastAnalysisDate || null };
}

async function hydrateVirusTotal() {
  try {
    const response = await fetch(`${VIRUSTOTAL_RESULTS_URL}?v=${Date.now()}`, { cache: 'no-store' });
    if (!response.ok) throw new Error(`VirusTotal result cache returned ${response.status}`);
    const results = await response.json();
    const latestRelease = document.documentElement.dataset.latestRelease;

    if (latestRelease && results.release && latestRelease !== results.release) {
      renderPendingVirusTotal(`Analysis for ${latestRelease} is still pending`);
      setText('[data-vt-release]', `Release ${latestRelease}`);
      return;
    }

    const setup = renderVirusTotalFile('setup', results.files?.setup);
    const portable = renderVirusTotalFile('portable', results.files?.portable);
    const reports = [setup, portable];
    const availableReports = reports.filter((report) => report.available);
    const flagged = availableReports.reduce((sum, report) => sum + report.flagged, 0);
    const notFlagged = availableReports.reduce((sum, report) => sum + report.notFlagged, 0);
    const hasDanger = reports.some((report) => report.state === 'danger');
    const hasWarning = reports.some((report) => report.state === 'warning');
    const overall = document.querySelector('[data-vt-overall]');

    if (availableReports.length === 0) {
      if (overall) overall.dataset.state = 'pending';
      setText('[data-vt-overall-title]', 'VirusTotal results pending');
      setText('[data-vt-updated]', 'Open either full report for the latest details');
    } else {
      const state = hasDanger ? 'danger' : hasWarning ? 'warning' : 'clear';
      if (overall) overall.dataset.state = availableReports.length < 2 && flagged === 0 ? 'pending' : state;
      setText(
        '[data-vt-overall-title]',
        `${notFlagged.toLocaleString()} not flagged · ${flagged.toLocaleString()} flagged`
      );
      const newestAnalysis = reports
        .map((report) => report.analysisDate)
        .filter(Boolean)
        .sort((left, right) => new Date(right) - new Date(left))[0];
      setText('[data-vt-updated]', newestAnalysis ? `Latest analysis · ${formatAnalysisDate(newestAnalysis)}` : 'Cached VirusTotal analysis');
    }

    setText('[data-vt-release]', `Release ${results.release || latestRelease || 'v1.0.0'}`);
  } catch {
    renderPendingVirusTotal('Open the full reports for live details');
  }
}

function setupThemes() {
  const buttons = [...document.querySelectorAll('[data-theme-choice]')];
  const savedTheme = localStorage.getItem('lyricsstatus-site-theme');

  if (savedTheme && buttons.some((button) => button.dataset.themeChoice === savedTheme)) {
    document.documentElement.dataset.theme = savedTheme;
  }

  const syncButtons = () => {
    buttons.forEach((button) => {
      const active = button.dataset.themeChoice === document.documentElement.dataset.theme;
      button.classList.toggle('active', active);
      button.setAttribute('aria-pressed', String(active));
    });
  };

  buttons.forEach((button) => {
    button.addEventListener('click', () => {
      const theme = button.dataset.themeChoice;
      document.documentElement.dataset.theme = theme;
      localStorage.setItem('lyricsstatus-site-theme', theme);
      syncButtons();
    });
  });

  syncButtons();
}

function setupLyricPreview() {
  const lines = [
    'Floating on my lowkey vibe',
    'You could bet that, never gotta sweat that',
    'If you be the cash, I’ll be the rubber band',
    'That isn’t you, so baby bring it in closely'
  ];
  const targets = [...document.querySelectorAll('.live-lyric')];
  let index = 0;

  window.setInterval(() => {
    targets.forEach((target) => target.classList.add('changing'));
    window.setTimeout(() => {
      index = (index + 1) % lines.length;
      targets.forEach((target) => {
        target.textContent = lines[index];
        target.classList.remove('changing');
      });
    }, 180);
  }, 3200);
}

setupThemes();
setupLyricPreview();
hydrateRelease().finally(hydrateVirusTotal);
