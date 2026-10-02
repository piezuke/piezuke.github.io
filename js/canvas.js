/**
 * ===================================================================
 * piezuke_ — Rain & Cloud Background Canvas
 * ===================================================================
 * - Pixel-block clouds are pre-rendered as OPAQUE sprites and then
 *   composited with a single alpha, so overlapping blocks never stack
 *   into muddy patches (the old light-mode bug).
 * - Clouds and rain are tuned separately for dark and light themes and
 *   re-colour instantly when the theme flips (listens for "themechange").
 * - The storm button only toggles rain; clouds keep drifting.
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
    drops = [],
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

  let rainEnabled = !prefersReduced;
  try {
    const saved = localStorage.getItem("rain");
    if (saved) rainEnabled = saved !== "off";
  } catch (e) {}

  /* ---------- theme palettes (pure black & white) ---------- */
  const PALETTE = {
    dark: {
      body: [255, 255, 255],
      shade: [150, 150, 150],
      cloudAlpha: [0.075, 0.125],
      rain: [255, 255, 255],
      rainAlpha: [0.14, 0.23, 0.38], // far, mid, near
      splash: 0.45,
    },
    light: {
      body: [40, 40, 40],
      shade: [0, 0, 0],
      cloudAlpha: [0.07, 0.115],
      rain: [0, 0, 0],
      rainAlpha: [0.12, 0.2, 0.34],
      splash: 0.4,
    },
  };
  const themeName = () =>
    document.documentElement.getAttribute("data-theme") === "light"
      ? "light"
      : "dark";

  /* ---------- rain model ---------- */
  // three depth layers: far (short, slow, faint) .. near (long, fast, bold)
  const LAYERS = [
    { share: 0.42, len: [14, 24], speed: [9, 12], width: 1 },
    { share: 0.36, len: [24, 38], speed: [14, 18], width: 1.2 },
    { share: 0.22, len: [38, 58], speed: [22, 29], width: 1.7, splash: true },
  ];
  let splashes = [];
  let ripples = [];
  let clock = 0;
  let floorY = 0; // where rain lands: bottom of screen, or the top of the footer when it is on screen
  let floorDirty = true;
  let quality = 1; // 1 = full rain; lowered automatically if frames get slow
  let frameSkip = false; // 30fps cadence as a last resort
  let wind = 0.2; // horizontal px per vertical px, eased with gusts

  function pickLayer() {
    let r = Math.random();
    for (let i = 0; i < LAYERS.length; i++) {
      if ((r -= LAYERS[i].share) < 0) return i;
    }
    return 0;
  }
  function newDrop(anywhere) {
    const li = pickLayer();
    const L = LAYERS[li];
    const len = L.len[0] + Math.random() * (L.len[1] - L.len[0]);
    return {
      li,
      len,
      speed: L.speed[0] + Math.random() * (L.speed[1] - L.speed[0]),
      x: Math.random() * (W + 200) - 100,
      y: anywhere ? Math.random() * H : -len - Math.random() * 80,
    };
  }
  function spawnSplash(x, y) {
    if (splashes.length > 90) return;
    const n = 3 + Math.floor(Math.random() * 3);
    for (let i = 0; i < n; i++) {
      splashes.push({
        x,
        y,
        vx: (Math.random() - 0.5) * 3 + wind * 3,
        vy: -(1.6 + Math.random() * 3),
        life: 1,
        size: Math.random() > 0.6 ? 3 : 2,
      });
    }
    if (ripples.length < 24) ripples.push({ x, y, life: 1 });
  }

  /* ---------- cloud sprite ---------- */
  function makeShape() {
    const r = (min, max) => min + Math.floor(Math.random() * (max - min + 1));
    const baseW = r(7, 12) * P;
    const blocks = [];
    // wide flat base with stepped end-caps so the silhouette isn't a plain slab
    blocks.push({ x: 0, y: 0, w: baseW, h: 2 * P });
    blocks.push({ x: -P * r(1, 2), y: P, w: P * 3, h: P });
    blocks.push({ x: baseW - P * 2, y: P, w: P * r(3, 4), h: P });
    // mid tier
    const midW = Math.max(3, Math.round((baseW / P) * (0.55 + Math.random() * 0.2))) * P;
    const midX = r(1, Math.max(1, Math.round((baseW - midW) / P) - 1)) * P;
    blocks.push({ x: midX, y: -P * r(1, 2), w: midW, h: P * 3 });
    // one or two bumps on top
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
    // underside shading, clipped to the silhouette
    g.globalCompositeOperation = "source-atop";
    g.fillStyle = `rgb(${pal.shade.join(",")})`;
    g.fillRect(0, c.height - P, c.width, P);
    // soft top highlight on the body colour (keeps it from looking flat)
    g.globalCompositeOperation = "source-over";
    cloud.sprite = c;
    cloud.paintedFor = themeName();
  }

  function build() {
    const dpr = Math.min(coarse || lowPower ? 1 : 1.25, window.devicePixelRatio || 1);
    W = window.innerWidth;
    H = window.innerHeight;
    builtW = W;
    canvas.width = Math.round(W * dpr);
    canvas.height = Math.round(H * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    const density = lowPower ? 18000 : coarse ? 10000 : 6500;
    const count = Math.min(lowPower ? 90 : coarse ? 130 : 230, Math.floor((W * H) / density));
    drops = Array.from({ length: count }, () => newDrop(true));
    splashes = [];
    ripples = [];
    floorY = H;
    floorDirty = true;

    const total = lowPower ? 6 : Math.max(7, Math.min(12, Math.round(W / 150)));
    const pal = PALETTE[themeName()];
    clouds = Array.from({ length: total }, (_, i) => {
      const depth = Math.random(); // 0 far .. 1 near
      const cloud = {
        shape: makeShape(),
        scale: 1 + depth * 0.9,
        speed: 0.12 + depth * 0.42,
        alpha: pal.cloudAlpha[0] + depth * (pal.cloudAlpha[1] - pal.cloudAlpha[0]),
        depth,
        x: (i / total) * (W + 600) - 300 + Math.random() * 120,
        y: Math.random() * H * 0.92,
      };
      paintSprite(cloud, pal);
      return cloud;
    });
  }

  let resizeTimer;
  let builtW = 0;
  function resizeBitmapOnly() {
    const dpr = canvas.width / Math.max(1, W) || 1;
    H = window.innerHeight;
    canvas.height = Math.round(H * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    floorDirty = true;
  }
  window.addEventListener("resize", () => {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(() => {
      if (Math.abs(window.innerWidth - builtW) > 1) {
        build();
      } else {
        resizeBitmapOnly();
      }
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

  function refreshFloor() {
    floorDirty = false;
    let y = H;
    const f = document.querySelector(".global-footer");
    if (f && f.getClientRects().length) {
      const top = f.getBoundingClientRect().top;
      if (top < H) y = Math.max(0, top);
    }
    floorY = y;
  }
  window.addEventListener("scroll", () => (floorDirty = true), { passive: true });
  window.addEventListener("hashchange", () => {
    floorDirty = true;
    setTimeout(() => (floorDirty = true), 700);
  });

  function drawRain(dt) {
    const pal = PALETTE[themeName()];
    const [r, g, b] = pal.rain;
    if (floorDirty) refreshFloor();
    const n = Math.max(24, Math.round(drops.length * quality));
    if (floorY < 60) {
      clock += dt; // footer fills the screen: nothing to draw
      return;
    }

    // slowly breathing wind with the occasional stronger gust
    clock += dt;
    const target =
      0.2 + 0.1 * Math.sin(clock / 260) + 0.08 * Math.sin(clock / 83) *
      Math.max(0, Math.sin(clock / 700));
    wind += (target - wind) * Math.min(1, 0.04 * dt);

    // streaks: faint tail + brighter head, batched per layer (2 strokes each)
    ctx.lineCap = "butt";
    for (let li = 0; li < LAYERS.length; li++) {
      const a = pal.rainAlpha[li];
      ctx.lineWidth = LAYERS[li].width;
      ctx.strokeStyle = `rgba(${r},${g},${b},${(a * 0.4).toFixed(3)})`;
      ctx.beginPath();
      for (let i = 0; i < n && i < drops.length; i++) {
        const d = drops[i];
        if (d.li !== li) continue;
        ctx.moveTo(d.x, d.y);
        ctx.lineTo(d.x + wind * d.len * 0.55, d.y + d.len * 0.55);
      }
      ctx.stroke();
      ctx.strokeStyle = `rgba(${r},${g},${b},${a.toFixed(3)})`;
      ctx.beginPath();
      for (let i = 0; i < n && i < drops.length; i++) {
        const d = drops[i];
        if (d.li !== li) continue;
        ctx.moveTo(d.x + wind * d.len * 0.55, d.y + d.len * 0.55);
        ctx.lineTo(d.x + wind * d.len, d.y + d.len);
      }
      ctx.stroke();
    }

    // advance drops; near ones splash at the bottom edge
    for (let i = 0; i < n && i < drops.length; i++) {
      const d = drops[i];
      d.y += d.speed * dt;
      d.x += d.speed * wind * dt;
      if (d.y > floorY + d.len * 0.2) {
        if (LAYERS[d.li].splash && d.y - d.speed * dt <= floorY + d.len) {
          spawnSplash(d.x + wind * d.len, floorY - 1);
        }
        drops[i] = newDrop(false);
        if (Math.random() < 0.5) drops[i].x = Math.random() * (W + 200) - 100;
      }
    }

    // splash droplets (square "pixels") and flat ripples
    const sa = pal.splash;
    for (let i = splashes.length - 1; i >= 0; i--) {
      const p = splashes[i];
      p.vy += 0.26 * dt;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.life -= dt / 24;
      if (p.life <= 0 || p.y > floorY + 4) {
        splashes.splice(i, 1);
        continue;
      }
      ctx.fillStyle = `rgba(${r},${g},${b},${(p.life * sa).toFixed(3)})`;
      ctx.fillRect(Math.round(p.x / 2) * 2, Math.round(p.y / 2) * 2, p.size, p.size);
    }
    ctx.lineWidth = 1;
    for (let i = ripples.length - 1; i >= 0; i--) {
      const rp = ripples[i];
      rp.life -= dt / 30;
      if (rp.life <= 0) {
        ripples.splice(i, 1);
        continue;
      }
      const w = 6 + (1 - rp.life) * 26;
      ctx.strokeStyle = `rgba(${r},${g},${b},${(rp.life * sa * 0.7).toFixed(3)})`;
      ctx.beginPath();
      ctx.moveTo(Math.round(rp.x - w), floorY - 0.5);
      ctx.lineTo(Math.round(rp.x + w), floorY - 0.5);
      ctx.stroke();
    }
  }

  function drawFrame(dt) {
    ctx.clearRect(0, 0, W, H);
    drawClouds(dt);
    if (rainEnabled) drawRain(dt);
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

  // Frame-time governor: if the machine can't hold ~45fps, thin the rain a
  // step at a time; as a last resort drop to a 30fps cadence.
  let avgMs = 16.6,
    govFrames = 0;
  function governor(ms) {
    if (frameSkip || ms > 250) return;
    avgMs = avgMs * 0.94 + ms * 0.06;
    if (++govFrames < 90) return;
    govFrames = 0;
    if (avgMs > 24) {
      if (quality > 0.45) quality = Math.max(0.4, quality - 0.2);
      else frameSkip = true;
      avgMs = 16.6;
    }
  }

  function loop() {
    if (animating || !canAnimate()) return;
    animating = true;
    const token = ++loopToken;
    lastFrame = performance.now();
    function tick(ts) {
      if (token !== loopToken) return; // a newer loop took over
      if (!canAnimate()) {
        animating = false;
        return;
      }
      raf(tick);
      const elapsed = ts - lastFrame;
      if (frameSkip && elapsed < 28) return;
      lastFrame = ts;
      governor(elapsed);
      drawFrame(Math.min(40, Math.max(8, elapsed || 16.6)) / 16.6);
    }
    raf(tick);
  }

  function resync() {
    floorDirty = true;
    avgMs = 16.6;
    govFrames = 0;
    lastFrame = performance.now();
  }
  document.addEventListener("visibilitychange", () => {
    tabVisible = !document.hidden;
    if (!tabVisible) {
      // nothing should linger from before the tab was hidden
      splashes = [];
      ripples = [];
      return;
    }
    resync();
    if (animating) {
      // the pending frame callback resumes the loop by itself; just repaint now
      drawFrame(0);
    } else {
      loop();
    }
  });
  // back/forward cache restore
  window.addEventListener("pageshow", (e) => {
    if (e.persisted) {
      resync();
      drawFrame(0);
      loop();
    }
  });

  // Re-colour immediately on theme change (also covers reduced-motion,
  // where there is no loop to pick the change up).
  window.addEventListener("themechange", () => {
    if (!animating) drawFrame(0);
  });

  build();
  drawFrame(0);
  loop();

  /* ---------- storm (rain) toggle ---------- */
  const raintoggle = document.getElementById("raintoggle");
  const svg = (inner) =>
    `<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${inner}</svg>`;
  const cloudPath =
    '<path d="M20 16.2A5 5 0 0 0 18 7h-1.26A8 8 0 1 0 4 15.25"></path><path d="M16 14v6"></path><path d="M8 14v6"></path><path d="M12 16v6"></path>';
  const stormOnSVG = svg(cloudPath);
  const stormOffSVG = svg(
    cloudPath + '<line x1="2" y1="2" x2="22" y2="22"></line>',
  );

  function updateRainToggleUI() {
    if (!raintoggle) return;
    raintoggle.innerHTML = rainEnabled ? stormOnSVG : stormOffSVG;
    raintoggle.setAttribute("aria-pressed", String(rainEnabled));
    const rt = (k, d) => {
      try {
        return CONFIG.ui.rain[k] || d;
      } catch (e) {
        return d;
      }
    };
    raintoggle.title = rainEnabled ? rt("on", "Rain: on") : rt("off", "Rain: off");
  }
  updateRainToggleUI();

  if (raintoggle) {
    raintoggle.onclick = () => {
      rainEnabled = !rainEnabled;
      try {
        localStorage.setItem("rain", rainEnabled ? "on" : "off");
      } catch (e) {}
      if (!rainEnabled) {
        splashes = [];
        ripples = [];
      }
      updateRainToggleUI();
      if (!animating) drawFrame(0);
    };
  }

  /* ---------- click ripple ---------- */
  // A small pool of reusable elements driven by the Web Animations API:
  // rapid clicking never creates/removes nodes or forces layout.
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
