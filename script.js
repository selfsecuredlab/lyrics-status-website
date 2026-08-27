if ("scrollRestoration" in history) {
  history.scrollRestoration = "manual";
}
window.scrollTo({ top: 0, left: 0, behavior: "instant" });

const header = document.getElementById("siteHeader");
const SCROLL_THRESHOLD = 40;

function updateHeader() {
  header.classList.toggle("scrolled", window.scrollY > SCROLL_THRESHOLD);
}

updateHeader();
window.addEventListener("scroll", updateHeader, { passive: true });

const previewImg = document.getElementById("heroPreviewImg");
const lightbox = document.getElementById("lightbox");
const lightboxImg = document.getElementById("lightboxImg");

function openLightbox() {
  lightboxImg.src = previewImg.src;
  lightbox.classList.add("active");
  document.body.style.overflow = "hidden";
}

function closeLightbox() {
  lightbox.classList.remove("active");
  document.body.style.overflow = "";
}

previewImg.addEventListener("click", openLightbox);
lightbox.addEventListener("click", closeLightbox);
document.addEventListener("keydown", (e) => {
  if (e.key === "Escape") {
    closeLightbox();
    closeDownloadModal();
  }
});

const downloadBtn = document.getElementById("downloadBtn");
const downloadModal = document.getElementById("downloadModal");
const modalClose = document.getElementById("modalClose");

function openDownloadModal() {
  downloadModal.classList.add("active");
  document.body.style.overflow = "hidden";
}

function closeDownloadModal() {
  downloadModal.classList.remove("active");
  document.body.style.overflow = "";
}

downloadBtn.addEventListener("click", openDownloadModal);
modalClose.addEventListener("click", closeDownloadModal);
downloadModal.addEventListener("click", (e) => {
  if (e.target === downloadModal) closeDownloadModal();
});

function waveify(root) {
  root.querySelectorAll(".wave-line").forEach((line) => {
    const text = line.textContent;
    const dir = line.dataset.dir === "down" ? "letter-down" : "letter-up";
    const words = text.split(" ");
    line.textContent = "";
    let i = 0;
    words.forEach((word, wordIndex) => {
      const wordSpan = document.createElement("span");
      wordSpan.className = "wave-word";
      for (const ch of word) {
        const span = document.createElement("span");
        span.className = `letter ${dir}`;
        span.style.setProperty("--i", i);
        span.textContent = ch;
        wordSpan.appendChild(span);
        i++;
      }
      line.appendChild(wordSpan);
      if (wordIndex < words.length - 1) {
        line.appendChild(document.createTextNode(" "));
      }
    });
  });
}

waveify(document.getElementById("heroHeading"));

const glow = document.querySelector(".bg-glow");
if (glow) {
  for (let i = 0; i < 6; i++) {
    const dot = document.createElement("span");
    dot.className = "glow-dot";
    const size = 1.5 + Math.random() * 2;
    dot.style.width = `${size}px`;
    dot.style.height = `${size}px`;
    dot.style.left = `${15 + Math.random() * 70}%`;
    dot.style.top = `${20 + Math.random() * 55}%`;
    dot.style.animationDelay = `${Math.random() * 3.5}s`;
    glow.appendChild(dot);
  }
}

[".how-it-works", ".source-section", ".lang-section", ".site-footer"].forEach((selector) => {
  const section = document.querySelector(selector);
  if (!section) return;
  const observer = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          section.classList.add("in-view");
          observer.unobserve(entry.target);
        }
      });
    },
    { threshold: 0.3 }
  );
  observer.observe(section);
});

document.querySelectorAll(".lang-list a[data-lang]").forEach((link) => {
  const segment = document.querySelector(`.lang-bar span[data-lang="${link.dataset.lang}"]`);
  if (!segment) return;
  link.addEventListener("mouseenter", () => segment.classList.add("glowing"));
  link.addEventListener("mouseleave", () => segment.classList.remove("glowing"));
});

const copyBtn = document.getElementById("copyBtn");
const codeSnippet = document.getElementById("codeSnippet");
if (copyBtn && codeSnippet) {
  copyBtn.addEventListener("click", async () => {
    await navigator.clipboard.writeText(codeSnippet.textContent);
    copyBtn.textContent = "Copied!";
    setTimeout(() => {
      copyBtn.textContent = "Copy";
    }, 1500);
  });
}
