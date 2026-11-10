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
