if ("scrollRestoration" in history) {
  history.scrollRestoration = "manual";
}
window.scrollTo({ top: 0, left: 0, behavior: "instant" });

/* ---------- Header: blur + line once you scroll ---------- */
const header = document.getElementById("siteHeader");
function updateHeader() {
  header.classList.toggle("scrolled", window.scrollY > 24);
}
updateHeader();
window.addEventListener("scroll", updateHeader, { passive: true });

/* ---------- Headline letter wave ---------- */
function waveify(root) {
  let i = 0;
  root.querySelectorAll(".wave-line").forEach((line) => {
    const text = line.textContent.trim();
    const dir = line.dataset.dir === "down" ? "letter letter-down" : "letter";
    line.setAttribute("aria-label", text);
    line.textContent = "";
    text.split(" ").forEach((word, wordIndex, words) => {
      const wordSpan = document.createElement("span");
      wordSpan.className = "wave-word";
      wordSpan.setAttribute("aria-hidden", "true");
      for (const ch of word) {
        const span = document.createElement("span");
        span.className = dir;
        span.style.setProperty("--i", i++);
        span.textContent = ch;
        wordSpan.appendChild(span);
      }
      line.appendChild(wordSpan);
      if (wordIndex < words.length - 1) line.appendChild(document.createTextNode(" "));
    });
  });
}
waveify(document.getElementById("heroHeading"));

/* ---------- Glow dots ---------- */
const GLOW_DOTS = [
  { s: 1.7, l: 77, t: 31, d: 3.0 },
  { s: 3.2, l: 40, t: 57, d: 0.9 },
  { s: 2.8, l: 33, t: 44, d: 3.2 },
  { s: 3.0, l: 78, t: 69, d: 2.5 },
  { s: 1.7, l: 48, t: 58, d: 3.0 },
  { s: 2.1, l: 52, t: 55, d: 1.3 },
  { s: 2.4, l: 22, t: 36, d: 1.9 },
  { s: 2.0, l: 64, t: 24, d: 0.4 },
];
const glow = document.getElementById("glowStage");
if (glow) {
  GLOW_DOTS.forEach(({ s, l, t, d }) => {
    const dot = document.createElement("span");
    dot.className = "glow-dot";
    dot.style.width = `${s}px`;
    dot.style.height = `${s}px`;
    dot.style.left = `${l}%`;
    dot.style.top = `${t}%`;
    dot.style.animationDelay = `${d}s`;
    glow.appendChild(dot);
  });
}

/* ---------- Terminal lines ---------- */
const CODE_LINES = [
  "git clone https://github.com/selfsecuredlab/lyrics-status.git",
  "cd lyrics-status",
  "npm ci",
  "npm run tauri dev",
];
const codeSnippet = document.getElementById("codeSnippet");
if (codeSnippet) {
  const el = (tag, cls, text) => {
    const n = document.createElement(tag);
    if (cls) n.className = cls;
    if (text != null) n.textContent = text;
    return n;
  };
  CODE_LINES.forEach((line, i) => {
    const row = el("span", "code-line");
    const num = el("span", "code-num", String(i + 1));
    num.setAttribute("aria-hidden", "true");
    const prompt = el("span", "code-prompt", "$");
    prompt.setAttribute("aria-hidden", "true");
    const cmdWrap = el("span", "type-line");
    cmdWrap.style.setProperty("--d", `${400 + i * 700}ms`);
    const [cmd, ...args] = line.split(" ");
    cmdWrap.appendChild(el("span", "code-cmd", cmd));
    args.forEach((a) => {
      cmdWrap.appendChild(document.createTextNode(" "));
      cmdWrap.appendChild(el("span", a.startsWith("http") ? "code-url" : "code-arg", a));
    });
    row.append(num, prompt, cmdWrap);
    codeSnippet.appendChild(row);
  });
}

/* ---------- Copy button ---------- */
const copyBtn = document.getElementById("copyBtn");
if (copyBtn) {
  const label = copyBtn.querySelector(".copy-label");
  let timer;
  copyBtn.addEventListener("click", () => {
    navigator.clipboard?.writeText(CODE_LINES.join("\n")).catch(() => {});
    copyBtn.classList.add("copied");
    label.textContent = "Copied!";
    clearTimeout(timer);
    timer = setTimeout(() => {
      copyBtn.classList.remove("copied");
      label.textContent = "Copy";
    }, 2000);
  });
}

/* ---------- Reveal sections on scroll ---------- */
document.querySelectorAll("[data-reveal-section]").forEach((section) => {
  const observer = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          section.classList.add("in-view");
          observer.disconnect();
        }
      });
    },
    { threshold: 0.2 }
  );
  observer.observe(section);
});

/* ---------- Popups (download + screenshot) ---------- */
let lastFocus = null;
function openOverlay(el) {
  lastFocus = document.activeElement;
  el.hidden = false;
  requestAnimationFrame(() => el.classList.add("open"));
  document.body.style.overflow = "hidden";
  const focusTarget = el.querySelector("button, a");
  if (focusTarget) focusTarget.focus({ preventScroll: true });
}
function closeOverlay(el) {
  if (el.hidden) return;
  el.classList.remove("open");
  document.body.style.overflow = "";
  setTimeout(() => { el.hidden = true; }, 200);
  if (lastFocus) lastFocus.focus({ preventScroll: true });
}

const lightbox = document.getElementById("lightbox");
const downloadModal = document.getElementById("downloadModal");

document.getElementById("previewBtn").addEventListener("click", () => openOverlay(lightbox));
lightbox.addEventListener("click", () => closeOverlay(lightbox));

function showDownloads() {
  openOverlay(downloadModal);
  ensureAllReleases();
}

document.getElementById("downloadBtn").addEventListener("click", showDownloads);
document.getElementById("previewDownloadBtn").addEventListener("click", showDownloads);
document.getElementById("modalClose").addEventListener("click", () => closeOverlay(downloadModal));
downloadModal.addEventListener("click", (e) => {
  if (e.target === downloadModal) closeOverlay(downloadModal);
});

document.addEventListener("keydown", (e) => {
  if (e.key === "Escape") {
    closeOverlay(lightbox);
    closeOverlay(downloadModal);
  }
});

/* ---------- Current release + per-file VirusTotal reports ---------- */
const RELEASE_API = "https://api.github.com/repos/selfsecuredlab/lyrics-status/releases/latest";
const VIRUSTOTAL_RESULTS_URL = "virustotal-results.json";
const VIRUSTOTAL_RESULTS_PROMISE = (async () => {
  try {
    const response = await fetch(`${VIRUSTOTAL_RESULTS_URL}?v=${Date.now()}`, { cache: "no-store" });
    if (!response.ok) throw new Error(`VirusTotal cache request returned ${response.status}`);
    return await response.json();
  } catch {
    return null;
  }
})();

function getAssetSha256(asset) {
  const digest = String(asset?.digest || "").replace(/^sha256:/i, "");
  return /^[a-f0-9]{64}$/i.test(digest) ? digest.toLowerCase() : "";
}

function getVerifiedVirusTotalFile(results, releaseTag, asset, legacyKey = "") {
  if (!asset || results?.release !== releaseTag) return null;
  const cached = results.files?.[asset.name] || (legacyKey ? results.files?.[legacyKey] : null);
  if (cached?.status !== "available") return null;

  const assetHash = getAssetSha256(asset);
  const cachedHash = String(cached.sha256 || "").toLowerCase();
  if (assetHash) return assetHash === cachedHash ? cached : null;
  return cached.downloadUrl === asset.browser_download_url ? cached : null;
}

function isTrustedReleaseUrl(value) {
  try {
    const url = new URL(value);
    return url.protocol === "https:"
      && url.hostname === "github.com"
      && url.pathname.startsWith("/selfsecuredlab/lyrics-status/releases/download/");
  } catch {
    return false;
  }
}

/* ---------- All versions (every published release) ---------- */
const ALL_RELEASES_API =
  "https://api.github.com/repos/selfsecuredlab/lyrics-status/releases?per_page=100";

// First match wins; anything unmatched (signatures, update manifests) is skipped.
const ASSET_PLATFORMS = [
  { test: /setup.*\.exe$/i, label: "Windows Installer", os: "windows" },
  { test: /portable.*\.exe$/i, label: "Windows Portable", os: "windows" },
  { test: /\.msi$/i, label: "Windows (MSI)", os: "windows" },
  { test: /\.dmg$/i, label: "Universal DMG", os: "macos" },
  { test: /\.app\.tar\.gz$/i, label: "App archive", os: "macos" },
  { test: /\.AppImage$/i, label: "Linux (AppImage)", os: "linux" },
  { test: /\.deb$/i, label: "Debian / Ubuntu (.deb)", os: "linux" },
  { test: /\.rpm$/i, label: "Fedora / RHEL (.rpm)", os: "linux" },
  { test: /\.exe$/i, label: "Windows", os: "windows" },
];

function classifyAsset(name) {
  return ASSET_PLATFORMS.find((platform) => platform.test.test(String(name || ""))) || null;
}

function formatBytes(value) {
  const n = Number(value);
  if (!Number.isFinite(n) || n <= 0) return "";
  const units = ["B", "KB", "MB", "GB"];
  let i = 0;
  let v = n;
  while (v >= 1024 && i < units.length - 1) {
    v /= 1024;
    i += 1;
  }
  return `${v.toFixed(v < 10 && i > 0 ? 1 : 0)} ${units[i]}`;
}

function makeTextElement(tag, className, text) {
  const element = document.createElement(tag);
  if (className) element.className = className;
  if (text != null) element.textContent = text;
  return element;
}

function makeVirusTotalLink(asset, releaseTag, results) {
  const cached = getVerifiedVirusTotalFile(results, releaseTag, asset);
  const hash = getAssetSha256(asset) || String(cached?.sha256 || "");
  const reportUrl = hash ? `https://www.virustotal.com/gui/file/${hash}/detection` : "";
  const stats = cached?.stats;
  const flagged = Number(stats?.malicious || 0) + Number(stats?.suspicious || 0);
  const scanLabel = cached ? (flagged ? `${flagged} flagged · report` : "No flagged engines · report") : "Scan pending";
  const link = makeTextElement(cached ? "a" : "span", `download-scan${cached ? (flagged ? " has-flags" : "") : " pending"}`, scanLabel);
  if (cached) {
    const reportedUrl = typeof cached.reportUrl === "string"
      && cached.reportUrl.startsWith("https://www.virustotal.com/gui/file/")
      ? cached.reportUrl
      : reportUrl;
    link.href = reportedUrl;
    link.target = "_blank";
    link.rel = "noopener noreferrer";
    link.title = summarizeVirusTotalFile(cached) || "Open the VirusTotal file report";
    link.setAttribute("aria-label", `VirusTotal report for ${asset.name}`);
  } else {
    link.title = `VirusTotal scan pending for ${releaseTag}`;
  }
  return link;
}

function summarizeVirusTotalFile(file) {
  const stats = file?.stats;
  if (file?.status !== "available" || !stats || typeof stats !== "object") return "";
  const count = (value) => {
    const number = Number(value || 0);
    return Number.isFinite(number) && number > 0 ? Math.floor(number) : 0;
  };
  const flagged = count(stats.malicious) + count(stats.suspicious);
  const notFlagged = count(stats.harmless) + count(stats.undetected);
  return `${notFlagged} not flagged · ${flagged} flagged`;
}

function renderLatestDownloads(release, assets, results) {
  const container = document.getElementById("latestDownloads");
  if (!container) return;
  const platformOrder = ["windows", "macos", "linux"];
  const platformNames = { windows: "Windows", macos: "macOS", linux: "Linux" };
  const platformNotes = {
    windows: "Windows 10 or newer",
    macos: "Intel + Apple silicon",
    linux: "Choose your package",
  };
  const buildPriority = {
    "Windows Installer": 0,
    "Windows Portable": 1,
    "Windows (MSI)": 2,
    "Universal DMG": 0,
    "App archive": 1,
    "Linux (AppImage)": 0,
    "Debian / Ubuntu (.deb)": 1,
    "Fedora / RHEL (.rpm)": 2,
  };
  const groups = new Map(platformOrder.map((os) => [os, []]));
  assets.forEach(({ asset, platform }) => groups.get(platform.os)?.push({ asset, platform }));
  const fragment = document.createDocumentFragment();
  let count = 0;

  for (const os of platformOrder) {
    const builds = groups.get(os);
    if (!builds?.length) continue;
    builds.sort((a, b) => (buildPriority[a.platform.label] ?? 9) - (buildPriority[b.platform.label] ?? 9));
    const card = makeTextElement("section", `download-platform os-${os}`);
    card.setAttribute("aria-label", `${platformNames[os]} downloads`);
    const heading = makeTextElement("div", "download-platform-heading");
    const mark = makeTextElement("span", "download-platform-mark", os === "windows" ? "Win" : os === "macos" ? "Mac" : "Linux");
    mark.setAttribute("aria-hidden", "true");
    const headingCopy = makeTextElement("div", "download-platform-copy");
    headingCopy.append(
      makeTextElement("h4", "download-platform-name", platformNames[os]),
      makeTextElement("p", "download-platform-note", platformNotes[os]),
    );
    heading.append(mark, headingCopy);
    card.appendChild(heading);

    const buildList = makeTextElement("div", "download-build-list");
    builds.forEach(({ asset, platform }, index) => {
      count += 1;
      const row = makeTextElement("div", `download-build${index === 0 ? " download-build--featured" : ""}`);
      const link = makeTextElement("a", "download-build-link");
      link.href = asset.browser_download_url;
      link.rel = "noopener noreferrer";
      link.setAttribute("aria-label", `Download ${platform.label}, ${formatBytes(asset.size) || "file size unavailable"}`);
      const details = makeTextElement("span", "download-build-details");
      details.append(
        makeTextElement("strong", "download-build-name", platform.label),
        makeTextElement("small", "download-build-size", formatBytes(asset.size) || "Release file"),
      );
      const action = makeTextElement("span", "download-build-action", "Download");
      action.appendChild(makeTextElement("span", "download-arrow", "↗"));
      link.append(details, action);
      row.append(link, makeVirusTotalLink(asset, release.tag_name, results));
      buildList.appendChild(row);
    });
    card.appendChild(buildList);
    fragment.appendChild(card);
  }

  if (!count) {
    container.replaceChildren(makeTextElement("p", "download-loading", "No compatible downloads were found for this release."));
    return;
  }
  container.replaceChildren(fragment);
  const version = document.getElementById("releaseVersion");
  if (version) version.textContent = release.tag_name || "Latest";
  const summary = document.getElementById("releaseScanSummary");
  if (summary) {
    const platforms = platformOrder.filter((os) => groups.get(os)?.length).map((os) => platformNames[os]);
    summary.textContent = `${count} downloads for ${platforms.join(", ")} · VirusTotal reports linked per file when available`;
  }
}

async function hydrateLatestDownloads() {
  const container = document.getElementById("latestDownloads");
  const summary = document.getElementById("releaseScanSummary");
  const resultsPromise = VIRUSTOTAL_RESULTS_PROMISE;
  try {
    const response = await fetch(RELEASE_API, { headers: { Accept: "application/vnd.github+json" } });
    if (!response.ok) throw new Error(`Latest release request returned ${response.status}`);
    const release = await response.json();
    const assets = (Array.isArray(release.assets) ? release.assets : [])
      .map((asset) => ({ asset, platform: classifyAsset(asset.name) }))
      .filter(({ asset, platform }) => platform && isTrustedReleaseUrl(asset.browser_download_url));
    renderLatestDownloads(release, assets, await resultsPromise);
  } catch {
    if (container) {
      const link = makeTextElement("a", "download-fallback", "Browse the latest downloads on GitHub ↗");
      link.href = "https://github.com/selfsecuredlab/lyrics-status/releases/latest";
      link.target = "_blank";
      link.rel = "noopener noreferrer";
      container.replaceChildren(link);
    }
    if (summary) summary.textContent = "Release details are unavailable right now.";
  }
}

void hydrateLatestDownloads();

let allReleasesLoaded = false;
function ensureAllReleases() {
  if (allReleasesLoaded) return;
  allReleasesLoaded = true;
  void renderAllReleases();
}

async function renderAllReleases() {
  const list = document.getElementById("allReleases");
  if (!list) return;

  let releases = [];
  try {
    const response = await fetch(ALL_RELEASES_API, {
      headers: { Accept: "application/vnd.github+json" },
    });
    if (!response.ok) throw new Error(`Releases request returned ${response.status}`);
    releases = await response.json();
  } catch {
    list.innerHTML =
      '<p class="all-releases-empty">Couldn\'t load the release list right now — use the GitHub link below.</p>';
    return;
  }

  const published = Array.isArray(releases) ? releases.filter((release) => !release.draft) : [];
  if (!published.length) {
    list.innerHTML = '<p class="all-releases-empty">No releases published yet.</p>';
    return;
  }

  const fragment = document.createDocumentFragment();

  for (const release of published) {
    const row = document.createElement("div");
    row.className = "release-row";

    const head = document.createElement("div");
    head.className = "release-head";

    const tag = document.createElement("span");
    tag.className = "release-tag";
    tag.textContent = release.tag_name || release.name || "release";
    head.appendChild(tag);

    if (release.prerelease) {
      const pre = document.createElement("span");
      pre.className = "release-pre";
      pre.textContent = "pre-release";
      head.appendChild(pre);
    }

    const date = document.createElement("span");
    date.className = "release-date";
    if (release.published_at) {
      date.textContent = new Date(release.published_at).toLocaleDateString(undefined, {
        year: "numeric",
        month: "short",
        day: "numeric",
      });
    }
    head.appendChild(date);
    row.appendChild(head);

    const downloads = (Array.isArray(release.assets) ? release.assets : [])
      .map((asset) => ({ asset, platform: classifyAsset(asset.name) }))
      .filter((entry) => entry.platform && isTrustedReleaseUrl(entry.asset.browser_download_url));

    if (downloads.length) {
      const assets = document.createElement("div");
      assets.className = "release-assets";
      for (const { asset, platform } of downloads) {
        const link = document.createElement("a");
        link.className = `release-asset os-${platform.os}`;
        link.href = asset.browser_download_url;
        link.rel = "noopener noreferrer";
        const size = formatBytes(asset.size);
        const labelSpan = document.createElement("span");
        labelSpan.className = "release-asset-label";
        labelSpan.textContent = platform.label;
        link.appendChild(labelSpan);
        if (size) {
          const sizeSpan = document.createElement("span");
          sizeSpan.className = "release-asset-size";
          sizeSpan.textContent = size;
          link.appendChild(sizeSpan);
        }
        assets.appendChild(link);

        const cached = getVerifiedVirusTotalFile(
          await VIRUSTOTAL_RESULTS_PROMISE,
          release.tag_name,
          asset,
        );
        const vtLink = document.createElement(cached ? "a" : "span");
        vtLink.className = `release-asset-vt${cached ? "" : " pending"}`;
        vtLink.textContent = cached ? "VT report" : "VT pending";
        if (cached) {
          vtLink.href = cached.reportUrl
            || `https://www.virustotal.com/gui/file/${cached.sha256}/detection`;
          vtLink.target = "_blank";
          vtLink.rel = "noopener noreferrer";
          vtLink.setAttribute("aria-label", `VirusTotal report for ${asset.name}`);
        } else if (release.tag_name === (await VIRUSTOTAL_RESULTS_PROMISE)?.release) {
          vtLink.title = "This release asset is not in the current VirusTotal results yet";
        } else {
          continue;
        }
        assets.appendChild(vtLink);
      }
      row.appendChild(assets);
    } else {
      const assets = document.createElement("div");
      assets.className = "release-assets";
      const link = document.createElement("a");
      link.className = "release-asset os-generic";
      link.href =
        typeof release.html_url === "string" && release.html_url.startsWith("https://github.com/")
          ? release.html_url
          : "https://github.com/selfsecuredlab/lyrics-status/releases";
      link.target = "_blank";
      link.rel = "noopener noreferrer";
      link.textContent = "View on GitHub";
      assets.appendChild(link);
      row.appendChild(assets);
    }

    fragment.appendChild(row);
  }

  list.innerHTML = "";
  list.appendChild(fragment);
}
