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
  "npm start",
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

/* ---------- Language hover glow ---------- */
const langBar = document.getElementById("langBar");
if (langBar) {
  const segments = langBar.querySelectorAll("span[data-lang]");
  const links = document.querySelectorAll(".lang-list a[data-lang]");
  const setActive = (lang) => {
    langBar.classList.toggle("has-active", !!lang);
    segments.forEach((s) => s.classList.toggle("active", s.dataset.lang === lang));
    links.forEach((l) => l.classList.toggle("active", l.dataset.lang === lang));
  };
  [...segments, ...links].forEach((node) => {
    node.addEventListener("mouseenter", () => setActive(node.dataset.lang));
    node.addEventListener("mouseleave", () => setActive(null));
    node.addEventListener("focus", () => setActive(node.dataset.lang));
    node.addEventListener("blur", () => setActive(null));
  });
}

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

document.getElementById("downloadBtn").addEventListener("click", () => openOverlay(downloadModal));
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

/* ---------- Current release + matching VirusTotal reports ---------- */
const RELEASE_API = "https://api.github.com/repos/selfsecuredlab/lyrics-status/releases/latest";
const VIRUSTOTAL_RESULTS_URL = "virustotal-results.json";
const RELEASE_ASSET_PATTERNS = {
  setup: /setup.*\.exe$/i,
  portable: /portable.*\.exe$/i,
};

function getAssetSha256(asset) {
  const digest = String(asset?.digest || "").replace(/^sha256:/i, "");
  return /^[a-f0-9]{64}$/i.test(digest) ? digest.toLowerCase() : "";
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

function setVirusTotalBadge(key, text, reportUrl) {
  const link = document.querySelector(`[data-vt-link="${key}"]`);
  const label = document.querySelector(`[data-vt-summary="${key}"]`);
  if (label) label.textContent = text;
  if (!link) return;

  if (reportUrl) {
    link.href = reportUrl;
    link.removeAttribute("aria-disabled");
    link.removeAttribute("tabindex");
  } else {
    link.removeAttribute("href");
    link.setAttribute("aria-disabled", "true");
    link.setAttribute("tabindex", "-1");
  }
}

function summarizeVirusTotalFile(file) {
  const stats = file?.stats;
  if (file?.status !== "available" || !stats || typeof stats !== "object") return null;

  const count = (value) => {
    const number = Number(value || 0);
    return Number.isFinite(number) && number > 0 ? Math.floor(number) : 0;
  };
  const flagged = count(stats.malicious) + count(stats.suspicious);
  const notFlagged = count(stats.harmless) + count(stats.undetected);
  const noVerdict = count(stats.timeout)
    + count(stats["confirmed-timeout"])
    + count(stats.failure)
    + count(stats["type-unsupported"]);
  const parts = [`${notFlagged} not flagged`, `${flagged} flagged`];
  if (noVerdict > 0) parts.push(`${noVerdict} no verdict`);
  return parts.join(" · ");
}

async function hydrateReleaseAndScanStatus() {
  const summary = document.getElementById("releaseScanSummary");
  const fallbackTag = downloadModal?.dataset.releaseFallback || "v1.1.0";
  let latestTag = fallbackTag;
  let releaseAssets = {};

  try {
    const response = await fetch(RELEASE_API, {
      headers: { Accept: "application/vnd.github+json" },
    });
    if (!response.ok) throw new Error(`Latest release request returned ${response.status}`);

    const release = await response.json();
    if (typeof release.tag_name === "string" && release.tag_name) latestTag = release.tag_name;
    for (const [key, pattern] of Object.entries(RELEASE_ASSET_PATTERNS)) {
      const asset = release.assets?.find((candidate) => pattern.test(candidate.name));
      if (!asset) continue;
      releaseAssets[key] = asset;
      const download = document.querySelector(`[data-download="${key}"]`);
      if (download && isTrustedReleaseUrl(asset.browser_download_url)) {
        download.href = asset.browser_download_url;
      }
    }
  } catch {
    // Keep the checked-in release links available if GitHub's API is unavailable.
  }

  let results = null;
  try {
    const response = await fetch(`${VIRUSTOTAL_RESULTS_URL}?v=${Date.now()}`, { cache: "no-store" });
    if (!response.ok) throw new Error(`VirusTotal cache request returned ${response.status}`);
    results = await response.json();
  } catch {
    // The reports are optional; download links remain usable without the cache.
  }

  const cacheMatchesRelease = results?.release === latestTag;
  let reportsAvailable = 0;
  for (const key of Object.keys(RELEASE_ASSET_PATTERNS)) {
    const cached = results?.files?.[key];
    const releaseHash = getAssetSha256(releaseAssets[key]);
    const rawCachedHash = String(cached?.sha256 || "").toLowerCase();
    const cachedHash = /^[a-f0-9]{64}$/.test(rawCachedHash) ? rawCachedHash : "";
    const matchingHash = cacheMatchesRelease && (!releaseHash || releaseHash === cachedHash);
    const currentHash = releaseHash || (cacheMatchesRelease ? cachedHash : "");
    const reportUrl = currentHash
      ? `https://www.virustotal.com/gui/file/${currentHash}/detection`
      : "";

    if (cacheMatchesRelease && matchingHash) {
      const label = summarizeVirusTotalFile(cached);
      if (label) {
        setVirusTotalBadge(key, label, reportUrl);
        reportsAvailable += 1;
        continue;
      }
    }

    const pendingText = cacheMatchesRelease && cached?.status === "not_found"
      ? "Not analyzed yet"
      : `Scan pending for ${latestTag}`;
    setVirusTotalBadge(key, pendingText, reportUrl);
  }

  if (summary) {
    summary.textContent = reportsAvailable === 2
      ? `VirusTotal results for ${latestTag} · exact file hashes`
      : `VirusTotal scan for ${latestTag} is pending · downloads are available`;
  }
}

void hydrateReleaseAndScanStatus();
