/**
 * ===================================================================
 * piezuke_ — Cloud Background Canvas
 * ===================================================================
 * - Pixel-block clouds are pre-rendered as OPAQUE sprites and then
 *   composited with a single alpha, so overlapping blocks never stack
 *   into muddy patches.
 * - Clouds are tuned separately for dark and light themes and
 *   re-colour instantly when the theme flips (listens for "themechange").
 * - prefers-reduced-motion => one static frame, no animation loop.
 */

(function () {
  const canvas = document.getElementById("bgcanvas");
  if (!canvas || typeof canvas.getContext !== "function") return;
  const ctx = canvas.getContext("2d", { alpha: true });
  if (!ctx) return;

  const P = 16; // pixel grid size for the blocky look
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

  /* ---------- theme palettes (pure black & white) ---------- */
  const PALETTE = {
    dark: {
      body: [255, 255, 255],
      shade: [150, 150, 150],
      cloudAlpha: [0.075, 0.125],
    },
    light: {
      body: [40, 40, 40],
      shade: [0, 0, 0],
      cloudAlpha: [0.07, 0.115],
    },
  };
  const themeName = () =>
    document.documentElement.getAttribute("data-theme") === "light"
      ? "light"
      : "dark";

  /* ---------- cloud sprite ---------- */
  function makeShape() {
    const r = (min, max) => min + Math.floor(Math.random() * (max - min + 1));
    const baseW = r(7, 12) * P;
    const blocks = [];
    blocks.push({ x: 0, y: 0, w: baseW, h: 2 * P });
    blocks.push({ x: -P * r(1, 2), y: P, w: P * 3, h: P });
    blocks.push({ x: baseW - P * 2, y: P, w: P * r(3, 4), h: P });
    const midW =
      Math.max(3, Math.round((baseW / P) * (0.55 + Math.random() * 0.2))) * P;
    const midX = r(1, Math.max(1, Math.round((baseW - midW) / P) - 1)) * P;
    blocks.push({ x: midX, y: -P * r(1, 2), w: midW, h: P * 3 });
    const bumps = r(1, 2);
    for (let i = 0; i < bumps; i++) {
      const w = r(2, 4) * P;
      const x = midX + r(0, Math.max(0, Math.round((midW - w) / P))) * P;
      blocks.push({ x, y: -P * r(2, 4), w, h: P * 3 });
    }
    let minX = 0,
      minY = 0,
      maxX = 0,
      maxY = 0;
    blocks.forEach((b) => {
      minX = Math.min(minX, b.x);
      minY = Math.min(minY, b.y);
      maxX = Math.max(maxX, b.x + b.w);
      maxY = Math.max(maxY, b.y + b.h);
    });
    blocks.forEach((b) => {
      b.x -= minX;
      b.y -= minY;
    });
    return { blocks, w: maxX - minX, h: maxY - minY };
  }

  function paintSprite(cloud, pal) {
    const c = cloud.sprite || document.createElement("canvas");
    c.width = cloud.shape.w;
    c.height = cloud.shape.h;
    const g = c.getContext("2d");
    g.clearRect(0, 0, c.width, c.height);
    g.fillStyle = `rgb(${pal.body.join(",")})`;
    cloud.shape.blocks.forEach((b) => g.fillRect(b.x, b.y, b.w, b.h));
    g.globalCompositeOperation = "source-atop";
    g.fillStyle = `rgb(${pal.shade.join(",")})`;
    g.fillRect(0, c.height - P, c.width, P);
    g.globalCompositeOperation = "source-over";
    cloud.sprite = c;
    cloud.paintedFor = themeName();
  }

  let resizeTimer;
  let builtW = 0;

  function build() {
    const dpr = Math.min(
      coarse || lowPower ? 1 : 1.25,
      window.devicePixelRatio || 1,
    );
    W = window.innerWidth;
    H = window.innerHeight;
    builtW = W;
    canvas.width = Math.round(W * dpr);
    canvas.height = Math.round(H * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    const total = lowPower ? 6 : Math.max(7, Math.min(12, Math.round(W / 150)));
    const pal = PALETTE[themeName()];
    clouds = Array.from({ length: total }, (_, i) => {
      const depth = Math.random();
      const cloud = {
        shape: makeShape(),
        scale: 1 + depth * 0.9,
        speed: 0.12 + depth * 0.42,
        alpha:
          pal.cloudAlpha[0] + depth * (pal.cloudAlpha[1] - pal.cloudAlpha[0]),
        depth,
        x: (i / total) * (W + 600) - 300 + Math.random() * 120,
        y: Math.random() * H * 0.92,
      };
      paintSprite(cloud, pal);
      return cloud;
    });
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
    ctx.imageSmoothingEnabled = false;
    for (let i = 0; i < clouds.length; i++) {
      const c = clouds[i];
      if (c.paintedFor !== theme) {
        paintSprite(c, pal);
        c.alpha =
          pal.cloudAlpha[0] + c.depth * (pal.cloudAlpha[1] - pal.cloudAlpha[0]);
      }
      const w = c.shape.w * c.scale;
      const h = c.shape.h * c.scale;
      ctx.globalAlpha = c.alpha;
      ctx.drawImage(c.sprite, Math.round(c.x), Math.round(c.y), w, h);
      c.x += c.speed * dt;
      if (c.x > W + 40) {
        c.x = -w - 40;
        c.y = Math.random() * H * 0.92;
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
  const RIPPLE_FRAMES = [
    { transform: "translate(-50%, -50%) scale(0.2)", opacity: 0.7 },
    { transform: "translate(-50%, -50%) scale(2.6)", opacity: 0 },
  ];
  function fireRipple(x, y) {
    let el = ripplePool[rippleIdx];
    if (!el) {
      el = document.createElement("div");
      el.className = "ripple";
      el.setAttribute("aria-hidden", "true");
      document.body.appendChild(el);
      ripplePool[rippleIdx] = el;
    }
    rippleIdx = (rippleIdx + 1) % 4;
    el.style.left = x + "px";
    el.style.top = y + "px";
    if (el._anim) el._anim.cancel();
    el._anim = el.animate(RIPPLE_FRAMES, {
      duration: 600,
      easing: "cubic-bezier(0.16, 0.84, 0.44, 1)",
    });
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
