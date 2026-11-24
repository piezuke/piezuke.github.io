#!/usr/bin/env node
"use strict";

const fs = require("fs");
const path = require("path");

const root = process.cwd();
const read = (f) => fs.readFileSync(path.join(root, f), "utf8");
const write = (f, s) => {
  fs.writeFileSync(path.join(root, f), s, "utf8");
  console.log("✔ visually upgraded", f);
};

/* ---------------- 1. style.css ---------------- */
{
  let s = read("style.css");
  const MARKER = "/* === PIEZUKE VISUAL OVERHAUL === */";
  if (!s.includes(MARKER)) {
    s += `

${MARKER}

/* Crisp text rendering & inverted monochrome selection */
html {
  -webkit-font-smoothing: antialiased;
  -moz-osx-font-smoothing: grayscale;
  text-rendering: optimizeLegibility;
}
::selection {
  background: var(--text, #fafafa);
  color: var(--bg, #050505);
}

/* Minimal custom scrollbars */
::-webkit-scrollbar { width: 8px; height: 8px; }
::-webkit-scrollbar-track { background: transparent; }
::-webkit-scrollbar-thumb {
  background: color-mix(in srgb, var(--text, #fff) 18%, transparent);
  border-radius: 999px;
}
::-webkit-scrollbar-thumb:hover {
  background: color-mix(in srgb, var(--text, #fff) 34%, transparent);
}

/* Luminous reading progress bar */
#progress {
  height: 2.5px;
  box-shadow: 0 0 12px color-mix(in srgb, var(--text, #fff) 55%, transparent);
  transition: width 0.08s linear;
}

/* Frosted glass header, command palette & mini-player */
.topnav {
  backdrop-filter: blur(16px) saturate(140%);
  -webkit-backdrop-filter: blur(16px) saturate(140%);
  border-bottom: 1px solid color-mix(in srgb, var(--border, rgba(255,255,255,0.1)) 85%, transparent);
}
nav.links a {
  position: relative;
  transition: color 0.2s ease, opacity 0.2s ease;
}
nav.links a::after {
  content: "";
  position: absolute;
  left: 10%;
  right: 10%;
  bottom: -4px;
  height: 1.5px;
  background: currentColor;
  transform: scaleX(0);
  transform-origin: center;
  transition: transform 0.24s cubic-bezier(0.22, 1, 0.36, 1);
  opacity: 0.85;
}
nav.links a:hover::after,
nav.links a.active::after {
  transform: scaleX(1);
}

#palette {
  backdrop-filter: blur(22px) saturate(140%);
  -webkit-backdrop-filter: blur(22px) saturate(140%);
  box-shadow:
    0 28px 80px rgba(0, 0, 0, 0.55),
    0 0 0 1px color-mix(in srgb, var(--text, #fff) 10%, transparent);
}
.palette-item {
  transition: background-color 0.14s ease, transform 0.14s ease;
}
.palette-item.active {
  transform: translateX(3px);
}

/* Tactile buttons & chips */
.btn, .chip, .ibtn, #cmdk-btn {
  transition:
    transform 0.2s cubic-bezier(0.22, 1, 0.36, 1),
    border-color 0.2s ease,
    background-color 0.2s ease,
    box-shadow 0.2s ease;
}
.btn:hover, .chip:hover, #cmdk-btn:hover {
  transform: translateY(-1.5px);
}
.btn:active, .chip:active, .ibtn:active {
  transform: translateY(0) scale(0.97);
}
.btn.solid:hover {
  box-shadow: 0 10px 28px color-mix(in srgb, var(--text, #fff) 18%, transparent);
}

/* Hero avatar framing & ambient glow */
.hero-avatar {
  perspective: 900px;
}
.hero-avatar-img, .about-img {
  transition: transform 0.35s cubic-bezier(0.22, 1, 0.36, 1), box-shadow 0.35s ease;
  box-shadow:
    0 20px 50px rgba(0, 0, 0, 0.35),
    0 0 0 1px color-mix(in srgb, var(--text, #fff) 14%, transparent);
}
.hero-avatar:hover .hero-avatar-img {
  box-shadow:
    0 26px 64px rgba(0, 0, 0, 0.45),
    0 0 0 1px color-mix(in srgb, var(--text, #fff) 28%, transparent);
}

/* Cards, bento tiles, suggested reads & social tiles */
.card, .explore, .social-tile, .sug-card {
  transition:
    transform 0.28s cubic-bezier(0.22, 1, 0.36, 1),
    border-color 0.25s ease,
    box-shadow 0.28s ease,
    background-color 0.25s ease;
  will-change: transform;
}
.card:hover, .explore:hover, .social-tile:hover, .sug-card:hover {
  transform: translateY(-4px);
  border-color: color-mix(in srgb, var(--text, #fff) 32%, transparent);
  box-shadow: 0 18px 42px rgba(0, 0, 0, 0.28);
}
.card-cover {
  overflow: hidden;
}
.card-cover img {
  transition: transform 0.55s cubic-bezier(0.22, 1, 0.36, 1), filter 0.35s ease;
}
.card:hover .card-cover img {
  transform: scale(1.045);
}
.card-arrow, .social-go {
  display: inline-block;
  transition: transform 0.22s cubic-bezier(0.22, 1, 0.36, 1);
}
.card:hover .card-arrow,
.explore:hover .card-arrow,
.social-tile:hover .social-go {
  transform: translate(3px, -3px);
}

/* Pill badges & post metadata chips */
.pill, .postmeta .pm {
  backdrop-filter: blur(6px);
  transition: border-color 0.2s ease, background-color 0.2s ease;
}
.postmeta .pm:hover {
  border-color: color-mix(in srgb, var(--text, #fff) 30%, transparent);
}

/* Article editorial polish */
.article-body {
  line-height: 1.78;
}
.article-body blockquote {
  border-left: 3px solid color-mix(in srgb, var(--text, #fff) 45%, transparent);
  background: color-mix(in srgb, var(--surface, rgba(255,255,255,0.04)) 80%, transparent);
  padding: 14px 18px;
  border-radius: 0 10px 10px 0;
  margin: 22px 0;
}
.article-body pre {
  border: 1px solid color-mix(in srgb, var(--border-strong, rgba(255,255,255,0.16)) 85%, transparent);
  box-shadow:
    inset 0 1px 0 color-mix(in srgb, var(--text, #fff) 6%, transparent),
    0 12px 32px rgba(0, 0, 0, 0.22);
  border-radius: 12px;
}
.article-body img {
  border-radius: 10px;
  border: 1px solid var(--border, rgba(255,255,255,0.12));
  transition: transform 0.25s ease, box-shadow 0.25s ease;
}
.article-body img:hover {
  box-shadow: 0 14px 36px rgba(0, 0, 0, 0.32);
}

/* CTF Flag spoiler blur reveal */
.spoiler {
  border-radius: 5px;
  padding: 1px 6px;
  transition: filter 0.3s ease, background-color 0.25s ease;
}
.spoiler:not(.revealed):hover {
  filter: blur(3px);
}

/* Sticky TOC outline active rail */
.outline a {
  border-left: 2px solid transparent;
  padding-left: 10px;
  transition: color 0.18s ease, border-color 0.18s ease, transform 0.18s ease;
}
.outline a:hover {
  transform: translateX(2px);
}
.outline a.active {
  border-left-color: var(--text, #fff);
  font-weight: 600;
}

/* Keyboard focus rings */
:focus-visible {
  outline: 2px solid var(--text, #fff);
  outline-offset: 3px;
  border-radius: 4px;
}

@media (prefers-reduced-motion: reduce) {
  .card:hover, .explore:hover, .social-tile:hover, .sug-card:hover,
  .btn:hover, .chip:hover, #cmdk-btn:hover {
    transform: none !important;
  }
  .card:hover .card-cover img { transform: none !important; }
}
`;
    write("style.css", s);
  }
}

/* ---------------- 2. js/app.js (subtle 3D avatar tilt) ---------------- */
{
  let s = read("js/app.js");
  if (!s.includes("initAvatarTilt")) {
    s += `

/* ========================= VISUAL UPGRADE: SUBTLE 3D AVATAR TILT ========================= */
(function initAvatarTilt() {
  const reduced =
    typeof window.matchMedia === "function" &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  if (reduced) return;

  document.addEventListener(
    "pointermove",
    (e) => {
      if (e.pointerType === "touch") return;
      const box = e.target && e.target.closest ? e.target.closest(".hero-avatar") : null;
      if (!box) return;
      const img = box.querySelector(".hero-avatar-img");
      if (!img) return;
      const r = box.getBoundingClientRect();
      const dx = (e.clientX - (r.left + r.width / 2)) / (r.width / 2);
      const dy = (e.clientY - (r.top + r.height / 2)) / (r.height / 2);
      img.style.transform = \`rotateX(\${(-dy * 7).toFixed(2)}deg) rotateY(\${(dx * 7).toFixed(2)}deg) scale(1.02)\`;
    },
    { passive: true },
  );

  document.addEventListener(
    "pointerout",
    (e) => {
      const box = e.target && e.target.closest ? e.target.closest(".hero-avatar") : null;
      if (!box || box.contains(e.relatedTarget)) return;
      const img = box.querySelector(".hero-avatar-img");
      if (img) img.style.transform = "";
    },
    { passive: true },
  );
})();
`;
    write("js/app.js", s);
  }
}

console.log("\n✨ Visual overhaul applied! Run: node build.js && npx serve dist");
