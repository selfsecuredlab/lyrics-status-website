const RELEASE_API = 'https://api.github.com/repos/selfsecuredlab/lyrics-status/releases/latest';

const formatBytes = (bytes) => `${(bytes / 1024 / 1024).toFixed(1)} MB`;
const getSha256 = (asset) => String(asset?.digest || '').replace(/^sha256:/i, '');
const shortenHash = (hash) => `${hash.slice(0, 8)}…${hash.slice(-8)}`;

async function hydrateRelease() {
  try {
    const response = await fetch(RELEASE_API, {
      headers: { Accept: 'application/vnd.github+json' }
    });

    if (!response.ok) return;
    const release = await response.json();
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

hydrateRelease();
setupThemes();
setupLyricPreview();
