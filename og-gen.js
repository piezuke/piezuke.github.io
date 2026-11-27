const fs = require("fs");
const path = require("path");

let createCanvas, Image, GlobalFonts;
try {
  ({ createCanvas, Image, GlobalFonts } = require("@napi-rs/canvas"));
} catch {
  try { ({ createCanvas, Image } = require("canvas")); } catch { createCanvas = null; }
}

if (GlobalFonts) {
  for (const f of [
    ["fonts/jetbrains-mono-latin-400-normal.woff2", "JetBrains Mono"],
    ["fonts/jersey-25-latin-400-normal.woff2", "Jersey 25"],
  ]) {
    const p = path.join(__dirname, f[0]);
    if (fs.existsSync(p)) {
      try { GlobalFonts.registerFromPath(p, f[1]); } catch {}
    }
  }
}

const MONO = '"JetBrains Mono", "DejaVu Sans Mono", monospace';

function wrapText(ctx, text, maxWidth, maxLines) {
  const words = String(text || "").trim().split(/\s+/).filter(Boolean);
  const lines = [];
  let line = "";
  for (const w of words) {
    const test = line ? `${line} ${w}` : w;
    if (ctx.measureText(test).width > maxWidth && line) {
      lines.push(line);
      line = w;
      if (lines.length === maxLines - 1) break;
    } else {
      line = test;
    }
  }
  if (line) lines.push(line);
  if (lines.length === maxLines && words.length > lines.join(" ").split(" ").length) {
    lines[maxLines - 1] = lines[maxLines - 1].replace(/\s*\S*$/, "") + "…";
  }
  return lines;
}

function drawPixelBrackets(ctx, x, y, w, h, len = 14, thick = 4, color = "#ffffff") {
  ctx.fillStyle = color;
  ctx.fillRect(x, y, len, thick); ctx.fillRect(x, y, thick, len);
  ctx.fillRect(x + w - len, y, len, thick); ctx.fillRect(x + w - thick, y, thick, len);
  ctx.fillRect(x, y + h - thick, len, thick); ctx.fillRect(x, y + h - len, thick, len);
  ctx.fillRect(x + w - len, y + h - thick, len, thick); ctx.fillRect(x + w - thick, y + h - len, thick, len);
}

function generateOgCard(outPath, opts = {}) {
  if (!createCanvas) return false;
  const {
    badge = "PIEBLOG",
    title = "piezuke",
    desc = "",
    date = "",
    route = "~/",
    tags = [],
    metaRows = [],
    sublines = [],
    avatarPath = "",
  } = opts;

  const W = 1200, H = 630;
  const pad = 16;
  const topBarH = 44;
  const footH = 46;
  const sideX = 804;

  const canvas = createCanvas(W, H);
  const ctx = canvas.getContext("2d");

  // 1. Background + dense dot grid
  ctx.fillStyle = "#060606";
  ctx.fillRect(0, 0, W, H);

  ctx.fillStyle = "#191919";
  for (let y = 12; y < H; y += 16) {
    for (let x = 12; x < W; x += 16) {
      ctx.fillRect(x, y, 2, 2);
    }
  }

  // Right-panel subtle tint
  const bodyTop = pad + topBarH;
  const footY = H - pad - footH;
  ctx.fillStyle = "rgba(255,255,255,0.03)";
  ctx.fillRect(sideX, bodyTop, W - pad - sideX, footY - bodyTop);

  // 2. Outer frame + pixel corner brackets
  ctx.strokeStyle = "#2d2d2d";
  ctx.lineWidth = 2;
  ctx.strokeRect(pad, pad, W - pad * 2, H - pad * 2);
  drawPixelBrackets(ctx, pad - 2, pad - 2, W - pad * 2 + 4, H - pad * 2 + 4, 16, 4, "#ffffff");

  // 3. Top HUD bar
  ctx.fillStyle = "#0e0e0e";
  ctx.fillRect(pad + 1, pad + 1, W - pad * 2 - 2, topBarH - 1);
  ctx.fillStyle = "#2d2d2d";
  ctx.fillRect(pad, bodyTop, W - pad * 2, 2);

  // Window dots
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(pad + 16, pad + 17, 10, 10);
  ctx.fillStyle = "#666666";
  ctx.fillRect(pad + 34, pad + 17, 10, 10);
  ctx.fillRect(pad + 52, pad + 17, 10, 10);

  ctx.font = `bold 18px ${MONO}`;
  ctx.fillStyle = "#e0e0e0";
  ctx.fillText(`piezuke@blog:${route}`, pad + 78, pad + 28);

  ctx.textAlign = "right";
  ctx.fillStyle = "#888888";
  ctx.fillText("LIVE // MONO", W - pad - 18, pad + 28);
  ctx.textAlign = "left";

  // Vertical divider
  ctx.fillStyle = "#2d2d2d";
  ctx.fillRect(sideX, bodyTop, 2, footY - bodyTop);

  // 4. LEFT COLUMN (tight, edge-to-edge)
  const leftX = pad + 28;
  const mainW = sideX - leftX - 28;

  // Badge + Date
  const badgeTxt = ` ${String(badge).toUpperCase()} `;
  ctx.font = `bold 18px ${MONO}`;
  const bw = ctx.measureText(badgeTxt).width + 16;
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(leftX, bodyTop + 24, bw, 32);
  ctx.fillStyle = "#050505";
  ctx.fillText(badgeTxt, leftX + 8, bodyTop + 46);

  if (date) {
    ctx.fillStyle = "#909090";
    ctx.font = `18px ${MONO}`;
    ctx.fillText(`// ${date}`, leftX + bw + 14, bodyTop + 46);
  }

  // Title (large & punchy)
  ctx.fillStyle = "#ffffff";
  ctx.font = `bold 56px ${MONO}`;
  const titleLines = wrapText(ctx, title, mainW, 3);
  let y = bodyTop + 124;
  for (const l of titleLines) {
    ctx.fillText(l, leftX, y);
    y += 66;
  }

  // Bordered excerpt box filling the middle cleanly
  const tagsY = footY - 52;
  const boxTop = y - 12;
  const boxH = Math.max(104, tagsY - boxTop - 20);
  ctx.fillStyle = "rgba(14,14,14,0.88)";
  ctx.fillRect(leftX, boxTop, mainW, boxH);
  ctx.strokeStyle = "#2b2b2b";
  ctx.lineWidth = 2;
  ctx.strokeRect(leftX, boxTop, mainW, boxH);
  // White left accent bar on the excerpt box
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(leftX, boxTop, 4, boxH);

  let dy = boxTop + 38;
  if (desc) {
    ctx.fillStyle = "#d0d0d0";
    ctx.font = `22px ${MONO}`;
    const maxDescLines = sublines.length ? 3 : Math.max(2, Math.floor((boxH - 28) / 34));
    const descLines = wrapText(ctx, desc, mainW - 36, maxDescLines);
    for (const l of descLines) {
      ctx.fillText(l, leftX + 20, dy);
      dy += 32;
    }
  }
  if (sublines.length) {
    dy += 8;
    ctx.fillStyle = "#242424";
    ctx.fillRect(leftX + 20, dy - 16, mainW - 40, 1);
    ctx.font = `18px ${MONO}`;
    for (const s of sublines) {
      if (dy > boxTop + boxH - 14) break;
      ctx.fillStyle = "#ffffff";
      ctx.fillText(">", leftX + 20, dy + 8);
      ctx.fillStyle = "#9a9a9a";
      const txt = String(s).length > 52 ? String(s).slice(0, 51) + "…" : String(s);
      ctx.fillText(txt, leftX + 40, dy + 8);
      dy += 30;
    }
  }

  // Tag pills pinned neatly above footer
  const cleanTags = (Array.isArray(tags) ? tags : [])
    .map((t) => String(t || "").trim())
    .filter(Boolean)
    .slice(0, 6);

  if (cleanTags.length) {
    let tx = leftX;
    ctx.font = `bold 17px ${MONO}`;
    for (const tag of cleanTags) {
      const label = `#${tag.toLowerCase().replace(/^#/, "")}`;
      const tw = ctx.measureText(label).width + 20;
      if (tx + tw > sideX - 24) break;
      ctx.fillStyle = "#121212";
      ctx.fillRect(tx, tagsY, tw, 32);
      ctx.strokeStyle = "#444444";
      ctx.lineWidth = 2;
      ctx.strokeRect(tx, tagsY, tw, 32);
      ctx.fillStyle = "#e5e5e5";
      ctx.fillText(label, tx + 10, tagsY + 22);
      tx += tw + 10;
    }
  }

  // 5. RIGHT SIDEBAR (compact & filled)
  const sPad = sideX + 24;
  const sW = W - pad - 24 - sPad;

  const avSize = 108;
  const avY = bodyTop + 24;
  if (avatarPath && fs.existsSync(avatarPath)) {
    try {
      const img = new Image();
      img.src = fs.readFileSync(avatarPath);
      ctx.drawImage(img, sPad, avY, avSize, avSize);
      ctx.strokeStyle = "#ffffff";
      ctx.lineWidth = 2;
      ctx.strokeRect(sPad, avY, avSize, avSize);
    } catch {}
  }

  ctx.fillStyle = "#ffffff";
  ctx.font = `bold 26px ${MONO}`;
  ctx.fillText("piezuke", sPad + avSize + 16, avY + 36);
  ctx.fillStyle = "#9a9a9a";
  ctx.font = `16px ${MONO}`;
  ctx.fillText("@piezuke", sPad + avSize + 16, avY + 64);
  ctx.fillStyle = "#707070";
  ctx.fillText("SEC // CODE", sPad + avSize + 16, avY + 90);

  // Divider
  ctx.fillStyle = "#2b2b2b";
  ctx.fillRect(sPad, avY + avSize + 20, sW, 2);

  // Metadata rows
  let my = avY + avSize + 56;
  for (const [k, v] of metaRows.slice(0, 5)) {
    ctx.font = `16px ${MONO}`;
    ctx.fillStyle = "#777777";
    ctx.fillText(String(k).toUpperCase(), sPad, my);

    ctx.font = `bold 17px ${MONO}`;
    ctx.fillStyle = "#f0f0f0";
    ctx.textAlign = "right";
    const val = String(v || "-");
    ctx.fillText(val.length > 16 ? val.slice(0, 15) + "…" : val, sPad + sW, my);
    ctx.textAlign = "left";

    ctx.fillStyle = "#222222";
    ctx.fillRect(sPad, my + 14, sW, 1);
    my += 44;
  }

  // Pixel barcode strip pinned at bottom of sidebar
  const barY = footY - 52;
  const pattern = [6, 2, 8, 2, 4, 4, 10, 2, 6, 2, 4, 8, 4, 2, 10, 2, 6, 4, 2, 8, 4, 6, 2, 4];
  let bx = sPad;
  ctx.fillStyle = "#4a4a4a";
  for (let i = 0; i < pattern.length && bx < sPad + sW - 6; i++) {
    const bw2 = pattern[i];
    if (i % 2 === 0) ctx.fillRect(bx, barY, bw2, 32);
    bx += bw2 + 3;
  }

  // 6. Bottom Footer Bar
  ctx.fillStyle = "#0e0e0e";
  ctx.fillRect(pad + 1, footY, W - pad * 2 - 2, footH - 1);
  ctx.fillStyle = "#2d2d2d";
  ctx.fillRect(pad, footY, W - pad * 2, 2);

  // Pixel diamond sprite
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(pad + 22, footY + 15, 6, 16);
  ctx.fillRect(pad + 19, footY + 18, 12, 10);
  ctx.fillRect(pad + 16, footY + 21, 18, 4);

  ctx.font = `bold 18px ${MONO}`;
  ctx.fillStyle = "#ececec";
  ctx.fillText("https://piezuke.github.io", pad + 44, footY + 29);

  ctx.textAlign = "right";
  ctx.fillStyle = "#808080";
  ctx.fillText("WRITEUPS // PROJECTS // NOTES", W - pad - 18, footY + 29);
  ctx.textAlign = "left";

  fs.mkdirSync(path.dirname(outPath), { recursive: true });
  fs.writeFileSync(outPath, canvas.toBuffer("image/png"));
  return true;
}

module.exports = { generateOgCard };
