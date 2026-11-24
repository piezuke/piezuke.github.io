#!/usr/bin/env node
"use strict";

const fs = require("fs");
const path = require("path");

const root = process.cwd();
const read = (f) => fs.readFileSync(path.join(root, f), "utf8");
const write = (f, s) => {
  fs.writeFileSync(path.join(root, f), s, "utf8");
  console.log("✔ patched", f);
};

/* ---------------- 1. style.css ---------------- */
{
  let s = read("style.css");

  // Strip the old responsive+terminal block if it was added earlier
  const oldMarker = "/* === PIEZUKE RESPONSIVE & INTERACTIVE OVERHAUL === */";
  const oldIdx = s.indexOf(oldMarker);
  if (oldIdx !== -1) s = s.slice(0, oldIdx).trimEnd();

  const newMarker = "/* === PIEZUKE FULL RESPONSIVE SYSTEM === */";
  const newIdx = s.indexOf(newMarker);
  if (newIdx !== -1) s = s.slice(0, newIdx).trimEnd();

  s += `

${newMarker}

/* ---- 1. Box-sizing, overflow lock & fluid base ---- */
*, *::before, *::after {
  box-sizing: border-box;
}
html, body {
  max-width: 100%;
  overflow-x: clip;
}
body {
  font-size: clamp(14.5px, 0.45vw + 13px, 16.5px);
  padding-bottom: env(safe-area-inset-bottom, 0px);
}
img, video, svg, canvas, picture {
  max-width: 100%;
}
.wrap {
  width: min(100%, 1180px);
  padding-left: clamp(14px, 4vw, 36px);
  padding-right: clamp(14px, 4vw, 36px);
  margin-left: auto;
  margin-right: auto;
}

/* Critical CSS Grid fix: prevent long <pre>/URLs/hex from expanding grid tracks */
.postlayout > *,
.hero-content > *,
.about2 > *,
.noteswrap > *,
.grid > *,
.explore-grid > *,
.footer-main > *,
.footer-cols > *,
.social-grid > *,
article,
.article-head,
.article-body,
.right-panel,
.noteMain {
  min-width: 0;
  max-width: 100%;
}

/* ---- 2. Fluid Typography (fits cleanly from 320px to 4K) ---- */
#glitch,
.hero h1 {
  font-size: clamp(2.25rem, 6.8vw, 5rem) !important;
  line-height: 0.98 !important;
  letter-spacing: -0.02em;
  overflow-wrap: anywhere;
}
.hero-role {
  font-size: clamp(0.9rem, 1.5vw, 1.15rem) !important;
  max-width: 100%;
  overflow-wrap: break-word;
}
.hero-subtitle {
  font-size: clamp(0.92rem, 1.15vw, 1.08rem) !important;
  line-height: 1.6;
  max-width: 56ch;
}
.page-title,
.about-h,
.tl-title {
  font-size: clamp(1.9rem, 5.2vw, 3.8rem) !important;
  line-height: 1.06 !important;
  overflow-wrap: anywhere;
}
.sechead {
  gap: 12px;
  flex-wrap: wrap;
}
.sechead h2 {
  font-size: clamp(1.3rem, 2.4vw, 1.9rem) !important;
}
.card h3,
.explore h3 {
  font-size: clamp(1.08rem, 1.5vw, 1.32rem) !important;
  line-height: 1.28;
  overflow-wrap: anywhere;
}
.card p,
.explore p {
  font-size: clamp(0.88rem, 1vw, 0.96rem) !important;
  line-height: 1.55;
}

/* ---- 3. Writeup / Article Mobile Bulletproofing ---- */
.article-head h1 {
  font-size: clamp(1.65rem, 4.2vw, 2.85rem) !important;
  line-height: 1.14 !important;
  overflow-wrap: anywhere;
}
.article-head .eyebrow {
  overflow-wrap: anywhere;
  line-height: 1.45;
}
.metarow {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 8px 14px;
  font-size: clamp(0.8rem, 1vw, 0.92rem);
}
.postmeta {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  max-width: 100%;
}
.postmeta .pm {
  max-width: 100%;
  white-space: normal;
  overflow-wrap: anywhere;
  font-size: clamp(0.76rem, 0.95vw, 0.86rem);
}
.article-body {
  font-size: clamp(0.94rem, 0.6vw + 0.82rem, 1.04rem) !important;
  line-height: 1.75;
  overflow-wrap: break-word;
  word-wrap: break-word;
}
.article-body h1 { font-size: clamp(1.45rem, 2.8vw, 2.1rem); line-height: 1.2; overflow-wrap: anywhere; }
.article-body h2 { font-size: clamp(1.22rem, 2.1vw, 1.6rem); line-height: 1.25; overflow-wrap: anywhere; }
.article-body h3 { font-size: clamp(1.05rem, 1.5vw, 1.26rem); line-height: 1.3; overflow-wrap: anywhere; }

/* Inline code wraps safely (fixes long hex like 0xffffffffffffffbd on mobile) */
.article-body :not(pre) > code {
  overflow-wrap: anywhere;
  word-break: break-word;
  font-size: 0.88em;
}

/* Fenced code blocks scroll horizontally INSIDE the box, never stretching the page */
.article-body pre {
  width: 100%;
  max-width: 100%;
  overflow-x: auto;
  -webkit-overflow-scrolling: touch;
  padding: clamp(12px, 2.5vw, 18px);
  font-size: clamp(11.5px, 0.6vw + 10px, 13.5px);
  line-height: 1.55;
}
.article-body pre code {
  white-space: pre;
  word-break: normal;
  overflow-wrap: normal;
}

/* Images & tables inside writeups */
.article-body img,
.article-cover img {
  display: block;
  width: auto;
  max-width: 100%;
  height: auto;
}
.article-body table {
  display: block;
  width: 100%;
  max-width: 100%;
  overflow-x: auto;
  -webkit-overflow-scrolling: touch;
  border-collapse: collapse;
}
.article-body blockquote {
  max-width: 100%;
  overflow-wrap: break-word;
}
.article-body ul,
.article-body ol {
  padding-left: clamp(18px, 3vw, 26px);
}

/* Filter chips bar wraps cleanly */
.filterbar {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

/* ---- 4. Tablet Breakpoint (<= 1080px) ---- */
@media (max-width: 1080px) {
  .postlayout {
    grid-template-columns: minmax(0, 190px) minmax(0, 1fr) !important;
    gap: 24px !important;
  }
  .right-panel {
    grid-column: 1 / -1;
    position: static !important;
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(240px, 1fr));
    gap: 16px;
    margin-top: 12px;
  }
  .about2 {
    grid-template-columns: minmax(0, 290px) minmax(0, 1fr) !important;
    gap: 28px !important;
  }
}

/* ---- 5. Mobile & Small Tablet Breakpoint (<= 860px) ---- */
@media (max-width: 860px) {
  .topnav {
    padding-left: 14px !important;
    padding-right: 14px !important;
    gap: 8px !important;
  }
  .cmdk-text {
    display: none !important;
  }
  #cmdk-btn {
    padding: 6px 10px !important;
  }
  .mini-player {
    max-width: 160px;
  }

  /* Home */
  .hero {
    padding-top: 28px !important;
  }
  .hero-content {
    grid-template-columns: minmax(0, 1fr) !important;
    flex-direction: column-reverse !important;
    text-align: center;
    gap: 24px !important;
  }
  .hero-text {
    display: flex;
    flex-direction: column;
    align-items: center;
  }
  .hero-avatar {
    margin: 0 auto;
    max-width: min(240px, 64vw);
  }
  .hero-avatar-img {
    width: 100% !important;
    height: auto !important;
    aspect-ratio: 1 / 1;
  }
  .cta {
    justify-content: center;
    flex-wrap: wrap;
    gap: 10px !important;
  }
  .hero-stats {
    grid-template-columns: repeat(2, minmax(0, 1fr)) !important;
    gap: 10px !important;
  }

  /* Grids */
  .explore-grid,
  .grid,
  .grid-featured {
    grid-template-columns: minmax(0, 1fr) !important;
    gap: 14px !important;
  }

  /* Writeups / Posts */
  .postlayout {
    grid-template-columns: minmax(0, 1fr) !important;
    gap: 22px !important;
  }
  .postlayout > .outline {
    display: none !important;
  }
  .right-panel {
    grid-template-columns: minmax(0, 1fr) !important;
  }
  .post-pager {
    grid-template-columns: minmax(0, 1fr) !important;
  }
  .post-pager-link.next {
    text-align: left;
  }

  /* About */
  .about2 {
    grid-template-columns: minmax(0, 1fr) !important;
    gap: 24px !important;
  }
  .about-side {
    position: static !important;
    max-width: 420px;
    width: 100%;
    margin: 0 auto;
  }
  .about-img {
    width: 100% !important;
    height: auto !important;
  }

  /* Notes Vault */
  .noteswrap {
    display: flex !important;
    flex-direction: column !important;
    height: auto !important;
    min-height: calc(100dvh - 64px);
  }
  .notetree {
    width: 100% !important;
    max-height: 38vh;
    overflow-y: auto;
    border-right: none !important;
    border-bottom: 1px solid var(--border, rgba(255,255,255,0.12));
  }
  .notetree-resizer {
    display: none !important;
  }
  .noteMain {
    width: 100% !important;
    padding: 18px 14px !important;
  }

  /* Timeline */
  .tl {
    padding-left: 18px !important;
  }
  .tlitem {
    padding-left: 14px !important;
  }

  /* Footer */
  .footer-main {
    grid-template-columns: minmax(0, 1fr) !important;
    flex-direction: column !important;
    gap: 24px !important;
  }
  .footer-cols {
    grid-template-columns: repeat(auto-fit, minmax(140px, 1fr)) !important;
    gap: 18px !important;
  }
  .footer-bar {
    flex-direction: column !important;
    align-items: flex-start !important;
    gap: 8px !important;
  }
}

/* ---- 6. Narrow Phones (<= 480px) ---- */
@media (max-width: 480px) {
  .mini-info {
    display: none !important;
  }
  .mini-player {
    max-width: none;
  }
  .social-grid {
    grid-template-columns: minmax(0, 1fr) !important;
  }
  .cta .btn {
    width: 100%;
    justify-content: center;
    text-align: center;
  }
  .article-body pre {
    font-size: 12px;
    padding: 12px;
  }
  .bottom-left-controls {
    left: 12px !important;
    bottom: 14px !important;
    transform: scale(0.9);
    transform-origin: bottom left;
  }
  #btt-btn {
    right: 12px !important;
    bottom: 14px !important;
    transform: scale(0.84);
    transform-origin: bottom right;
  }
  #palette {
    width: calc(100vw - 20px) !important;
    max-height: 80dvh !important;
  }
}

/* ---- 7. Mobile Floating TOC Pill & Drawer ---- */
#mob-toc-btn {
  display: none;
  position: fixed;
  right: 14px;
  bottom: 80px;
  z-index: 900;
  font-family: var(--mono, monospace);
  font-size: 12.5px;
  padding: 8px 13px;
  border-radius: 999px;
  background: var(--surface, rgba(16,16,16,0.92));
  color: var(--text, #fafafa);
  border: 1px solid var(--border-strong, rgba(255,255,255,0.22));
  backdrop-filter: blur(12px);
  box-shadow: 0 10px 26px rgba(0,0,0,0.35);
  cursor: pointer;
}
@media (max-width: 860px) {
  #mob-toc-btn.visible { display: inline-flex; align-items: center; gap: 6px; }
}
#mob-toc-drawer {
  position: fixed;
  inset: 0;
  z-index: 9996;
  background: rgba(0,0,0,0.65);
  backdrop-filter: blur(5px);
  display: none;
  align-items: flex-end;
  justify-content: center;
}
#mob-toc-drawer.open { display: flex; }
.mob-toc-sheet {
  width: 100%;
  max-width: 520px;
  max-height: 68dvh;
  overflow-y: auto;
  background: var(--bg, #0a0a0a);
  color: var(--text, #fafafa);
  border-top: 1px solid var(--border-strong, rgba(255,255,255,0.2));
  border-radius: 16px 16px 0 0;
  padding: 18px 20px calc(20px + env(safe-area-inset-bottom, 0px));
  font-family: var(--mono, monospace);
}
.mob-toc-sheet h4 {
  margin: 0 0 12px;
  font-size: 12px;
  letter-spacing: 0.12em;
  text-transform: uppercase;
  color: var(--dim, #888);
}
.mob-toc-sheet a {
  display: block;
  padding: 9px 10px;
  border-radius: 8px;
  color: var(--text, #fafafa);
  text-decoration: none;
  font-size: 14px;
}
.mob-toc-sheet a.h3 {
  padding-left: 24px;
  font-size: 13px;
  color: var(--muted, #aaa);
}
.mob-toc-sheet a:hover {
  background: var(--surface, rgba(255,255,255,0.08));
}
`;
  write("style.css", s);
}

/* ---------------- 2. js/app.js (Trash terminal, keep Mobile TOC & Hex Scramble) ---------------- */
{
  let s = read("js/app.js");

  // Fix inline font-size on Timeline and Post back-link if still present
  s = s.replace(
    'style="font-size:clamp(46.9px,7.8vw,81.2px); margin:12px 0 8px;"',
    'class="reveal tl-title" style="margin:12px 0 8px;"'
  );
  s = s.replace(
    'style="font-family:var(--mono); font-size:18.8px; color:var(--muted);"',
    'style="font-family:var(--mono); font-size:clamp(13px,1.5vw,16px); color:var(--muted);"'
  );

  // Remove the previous terminal+extras block cleanly
  const oldBlock = "/* ========================= INTERACTIVE EXTRAS: HEX SCRAMBLE, MOBILE TOC, MINI TERMINAL ========================= */";
  const oldIdx = s.indexOf(oldBlock);
  if (oldIdx !== -1) s = s.slice(0, oldIdx).trimEnd();

  const cleanBlock = "/* ========================= MOBILE TOC & HERO SCRAMBLE ========================= */";
  const cleanIdx = s.indexOf(cleanBlock);
  if (cleanIdx !== -1) s = s.slice(0, cleanIdx).trimEnd();

  s += `

${cleanBlock}
(function initMobileTocAndScramble() {
  const reduced =
    typeof window.matchMedia === "function" &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  /* ---- 1. Subtle Hex-Decode Scramble on Hero Title Hover ---- */
  const CHARS = "0123456789ABCDEF#$%&@*";
  function scrambleEl(el) {
    if (reduced || !el || el.dataset.scrambling === "1") return;
    const orig = el.dataset.origText || el.textContent;
    el.dataset.origText = orig;
    el.dataset.scrambling = "1";
    let frame = 0;
    const total = Math.max(12, orig.length * 3);
    const id = setInterval(() => {
      const locked = Math.floor((frame / total) * orig.length);
      let out = "";
      for (let i = 0; i < orig.length; i++) {
        if (orig[i] === " " || i < locked) out += orig[i];
        else out += CHARS[Math.floor(Math.random() * CHARS.length)];
      }
      el.textContent = out;
      if (++frame > total) {
        clearInterval(id);
        el.textContent = orig;
        el.dataset.scrambling = "0";
      }
    }, 28);
  }
  document.addEventListener("pointerenter", (e) => {
    const t = e.target;
    if (t && t.id === "glitch") scrambleEl(t);
  }, true);

  /* ---- 2. Mobile Floating TOC Pill & Drawer ---- */
  function syncMobileToc() {
    let btn = document.getElementById("mob-toc-btn");
    let drawer = document.getElementById("mob-toc-drawer");
    const outlineLinks = Array.from(document.querySelectorAll(".postlayout > .outline a"));

    if (!outlineLinks.length) {
      if (btn) btn.classList.remove("visible");
      if (drawer) drawer.classList.remove("open");
      return;
    }
    if (!btn) {
      btn = document.createElement("button");
      btn.id = "mob-toc-btn";
      btn.type = "button";
      btn.textContent = "≡ TOC";
      btn.setAttribute("aria-label", "Table of contents");
      document.body.appendChild(btn);
    }
    if (!drawer) {
      drawer = document.createElement("div");
      drawer.id = "mob-toc-drawer";
      drawer.innerHTML = '<div class="mob-toc-sheet" role="dialog" aria-label="On this page"><h4>On this page</h4><div id="mob-toc-list"></div></div>';
      drawer.addEventListener("click", (e) => {
        if (e.target === drawer) drawer.classList.remove("open");
      });
      document.body.appendChild(drawer);
    }
    const list = drawer.querySelector("#mob-toc-list");
    list.innerHTML = outlineLinks
      .map((a) => \`<a href="#\${a.dataset.target}" class="\${a.className}" data-target="\${a.dataset.target}">\${escapeHTML(a.textContent)}</a>\`)
      .join("");
    list.querySelectorAll("a").forEach((a) => {
      a.onclick = (e) => {
        e.preventDefault();
        drawer.classList.remove("open");
        const target = document.getElementById(a.dataset.target);
        if (target) target.scrollIntoView({ behavior: "smooth" });
      };
    });
    btn.onclick = () => drawer.classList.add("open");
    btn.classList.add("visible");
  }

  const appEl = document.getElementById("app");
  if (appEl && typeof MutationObserver !== "undefined") {
    new MutationObserver(() => syncMobileToc()).observe(appEl, { childList: true });
    syncMobileToc();
  }
})();
`;
  write("js/app.js", s);
}

console.log("\n✔ Terminal trashed & all pages (including Securinets writeup) fixed for mobile!");
console.log("Run: node build.js && npx serve dist");
