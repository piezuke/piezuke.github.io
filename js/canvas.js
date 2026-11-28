/**
 * ===================================================================
 * piezuke_ — Halftone / Screentone Cloud Background Canvas
 * ===================================================================
 * - 10–16 halftone clouds distributed across a jittered 2D sky grid
 *   so the full viewport is evenly populated from top to bottom.
 * - High-visibility palettes tuned for both dark and light modes.
 * - prefers-reduced-motion => one static frame, no animation loop.
 */

(function () {
  const canvas = document.getElementById("bgcanvas");
  if (!canvas || typeof canvas.getContext !== "function") return;
  const ctx = canvas.getContext("2d", { alpha: true });
  if (!ctx) return;

  let W = 0,
    H = 0,
    clouds = [];

  const nav = typeof navigator !== "undefined" ? navigator : null;
  const mq = (q) =>
    typeof window.matchMedia === "function" ? window.matchMedia(q) : null;
  const reducedMQ = mq("(prefers-reduced-motion: reduce)");
  const prefersReduced = Boolean(reducedMQ && reducedMQ.matches);
  const coarse = Boolean(
    mq("(pointer: coarse)") && mq("(pointer: coarse)").matches,
  );
  const lowPower = Boolean(
    (nav && nav.hardwareConcurrency && nav.hardwareConcurrency <= 2) ||
      (nav && nav.deviceMemory && nav.deviceMemory <= 2) ||
      prefersReduced,
  );

  /* ---------- high-visibility theme palettes ---------- */
  const PALETTE = {
    dark: {
      dot: [255, 255, 255],
      shade: [180, 180, 180],
      alpha: [0.2, 0.34],
    },
    light: {
      dot: [0, 0, 0],
      shade: [35, 35, 35],
      alpha: [0.38, 0.62],
    },
  };
  const themeName = () =>
    document.documentElement.getAttribute("data-theme") === "light"
      ? "light"
      : "dark";

  /* ---------- cloud silhouette ---------- */
  function makeCloudShape() {
    const w = 280 + Math.floor(Math.random() * 150);
    const h = 115 + Math.floor(Math.random() * 55);
    const puffs = [];

    const baseCount = 5 + Math.floor(Math.random() * 2);
    for (let i = 0; i < baseCount; i++) {
      const t = i / (baseCount - 1);
      puffs.push({
        x: w * (0.16 + t * 0.68) + (Math.random() - 0.5) * 14,
        y: h * (0.64 + (Math.random() - 0.5) * 0.06),
        rx: w * (0.17 + Math.random() * 0.05),
        ry: h * (0.28 + Math.random() * 0.08),
      });
    }

    const topCount = 3 + Math.floor(Math.random() * 2);
    for (let i = 0; i < topCount; i++) {
      const t = (i + 0.5) / topCount;
      const arch = 1 - Math.abs(t - 0.5) * 1.1;
      puffs.push({
        x: w * (0.22 + t * 0.56) + (Math.random() - 0.5) * 16,
        y: h * (0.44 - arch * 0.14 + (Math.random() - 0.5) * 0.06),
        rx: w * (0.15 + arch * 0.06),
        ry: h * (0.26 + arch * 0.12),
      });
    }

    return { w, h, puffs };
  }

  function sampleDensity(shape, x, y) {
    let d = 0;
    const puffs = shape.puffs;
    for (let i = 0; i < puffs.length; i++) {
      const p = puffs[i];
      const dx = (x - p.x) / p.rx;
      const dy = (y - p.y) / p.ry;
      const dist2 = dx * dx + dy * dy;
      if (dist2 < 1) {
        const f = 1 - dist2;
        d += f * f * 1.2;
      }
    }
    const bottomFade =
      y > shape.h * 0.74
        ? Math.max(0, 1 - (y - shape.h * 0.74) / (shape.h * 0.18))
        : 1;
    return Math.min(1.35, d * bottomFade);
  }

  /* ---------- halftone screentone sprite renderer ---------- */
  function paintHalftoneSprite(cloud, pal) {
    const { w, h } = cloud.shape;
    const c = cloud.sprite || document.createElement("canvas");
    c.width = w;
    c.height = h;
    const g = c.getContext("2d");
    g.clearRect(0, 0, w, h);

    const step = 7;
    const maxR = step * 0.46;
    const [dr, dg, db] = pal.dot;
    const [sr, sg, sb] = pal.shade;

    for (let row = 0, y = step * 0.5; y < h; row++, y += step) {
      const offsetX = (row % 2) * (step * 0.5);
      const isUnderside = y > h * 0.58;
      g.fillStyle = isUnderside
        ? `rgb(${sr},${sg},${sb})`
        : `rgb(${dr},${dg},${db})`;

      for (let x = offsetX + step * 0.5; x < w; x += step) {
        const density = sampleDensity(cloud.shape, x, y);
        if (density < 0.1) continue;

        const r = Math.min(maxR, Math.pow(Math.min(1, density), 0.65) * maxR);
        if (r < 0.6) continue;

        g.beginPath();
        g.arc(x, y, r, 0, Math.PI * 2);
        g.fill();
      }
    }

    cloud.sprite = c;
    cloud.paintedFor = themeName();
  }

  let resizeTimer;
  let builtW = 0;

  function build() {
    const dpr = Math.min(
      coarse || lowPower ? 1 : 1.5,
      window.devicePixelRatio || 1,
    );
    W = window.innerWidth;
    H = window.innerHeight;
    builtW = W;
    canvas.width = Math.round(W * dpr);
    canvas.height = Math.round(H * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    // 2D jittered grid: spreads clouds evenly across the entire sky
    const cols = lowPower ? 3 : Math.max(3, Math.min(5, Math.round(W / 320)));
    const rows = lowPower ? 3 : Math.max(3, Math.min(4, Math.round(H / 240)));
    const total = cols * rows;
    const cellW = (W + 360) / cols;
    const cellH = (H * 0.94) / rows;
    const pal = PALETTE[themeName()];

    clouds = [];
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        const depth = Math.random(); // 0 far .. 1 near
        const cloud = {
          shape: makeCloudShape(),
          scale: 0.72 + depth * 0.58,
          speed: 0.14 + depth * 0.36,
          alpha: pal.alpha[0] + depth * (pal.alpha[1] - pal.alpha[0]),
          depth,
          row: r,
          rows,
          x: c * cellW - 180 + (Math.random() - 0.5) * cellW * 0.55,
          y: r * cellH + (Math.random() - 0.25) * cellH * 0.5,
        };
        paintHalftoneSprite(cloud, pal);
        clouds.push(cloud);
      }
    }
    // Draw far clouds behind near clouds
    clouds.sort((a, b) => a.depth - b.depth);
  }

  function resizeBitmapOnly() {
    const dpr = canvas.width / Math.max(1, W) || 1;
    H = window.innerHeight;
    canvas.height = Math.round(H * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }

  window.addEventListener("resize", () => {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(() => {
      if (Math.abs(window.innerWidth - builtW) > 1) build();
      else resizeBitmapOnly();
      if (!animating) drawFrame(0);
    }, 150);
  });

  /* ---------- drawing ---------- */
  function drawClouds(dt) {
    const theme = themeName();
    const pal = PALETTE[theme];
    ctx.imageSmoothingEnabled = true;

    for (let i = 0; i < clouds.length; i++) {
      const c = clouds[i];
      if (c.paintedFor !== theme) {
        paintHalftoneSprite(c, pal);
        c.alpha = pal.alpha[0] + c.depth * (pal.alpha[1] - pal.alpha[0]);
      }
      const w = c.shape.w * c.scale;
      const h = c.shape.h * c.scale;
      ctx.globalAlpha = c.alpha;
      ctx.drawImage(c.sprite, c.x, c.y, w, h);
      c.x += c.speed * dt;
      if (c.x > W + 80) {
        const cellH = (H * 0.94) / c.rows;
        c.x = -w - 80;
        c.y = c.row * cellH + (Math.random() - 0.25) * cellH * 0.5;
      }
    }
    ctx.globalAlpha = 1;
  }

  function drawFrame(dt) {
    ctx.clearRect(0, 0, W, H);
    drawClouds(dt);
  }

  /* ---------- loop ---------- */
  const raf =
    typeof requestAnimationFrame === "function"
      ? requestAnimationFrame
      : (cb) => setTimeout(() => cb(Date.now()), 16);

  let animating = false;
  let loopToken = 0;
  let tabVisible = !document.hidden;
  let lastFrame = 0;
  const canAnimate = () => tabVisible && !prefersReduced;

  function loop() {
    if (animating || !canAnimate()) return;
    animating = true;
    const token = ++loopToken;
    lastFrame = performance.now();
    function tick(ts) {
      if (token !== loopToken) return;
      if (!canAnimate()) {
        animating = false;
        return;
      }
      raf(tick);
      const elapsed = ts - lastFrame;
      lastFrame = ts;
      drawFrame(Math.min(40, Math.max(8, elapsed || 16.6)) / 16.6);
    }
    raf(tick);
  }

  document.addEventListener("visibilitychange", () => {
    tabVisible = !document.hidden;
    if (!tabVisible) return;
    lastFrame = performance.now();
    if (animating) drawFrame(0);
    else loop();
  });

  window.addEventListener("pageshow", (e) => {
    if (e.persisted) {
      lastFrame = performance.now();
      drawFrame(0);
      loop();
    }
  });

  window.addEventListener("themechange", () => {
    if (!animating) drawFrame(0);
  });

  build();
  drawFrame(0);
  loop();

  /* ---------- click ripple ---------- */
  const ripplePool = [];
  let rippleIdx = 0;
  if (typeof document !== "undefined" && document.body) {
    for (let i = 0; i < 4; i++) {
      const el = document.createElement("div");
      el.className = "ripple";
      el.setAttribute("aria-hidden", "true");
      document.body.appendChild(el);
      ripplePool.push(el);
    }
  }
  function fireRipple(x, y) {
    const el = ripplePool[rippleIdx];
    if (!el) return;
    rippleIdx = (rippleIdx + 1) % ripplePool.length;
    if (el._anim) el._anim.cancel();
    el._anim = el.animate(
      [
        { transform: "translate3d(" + x + "px," + y + "px,0) scale(0.45)", opacity: 0.7 },
        { transform: "translate3d(" + x + "px," + y + "px,0) scale(2.2)", opacity: 0 },
      ],
      {
        duration: 520,
        easing: "cubic-bezier(0.16, 0.84, 0.44, 1)",
      },
    );
  }
  document.addEventListener(
    "mousedown",
    function (e) {
      if (e.button !== 0) return;
      if (reducedMQ && reducedMQ.matches) return;
      if (typeof Element === "undefined" || !Element.prototype.animate) return;
      fireRipple(e.clientX, e.clientY);
    },
    { passive: true },
  );
})();
