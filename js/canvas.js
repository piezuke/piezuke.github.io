/**
 * ===================================================================
 * piezuke_ — Rain & Lightning Storm Background Canvas Animation
 * ===================================================================
 * Features pixelated procedural volumetric cloud clusters, particle
 * raindrops, hardware/power throttling detection, and an interactive
 * click ripple effect.
 */

(function () {
  const canvas = document.getElementById("bgcanvas");
  if (!canvas || typeof canvas.getContext !== "function") return;
  const ctx = canvas.getContext("2d");
  if (!ctx) return;
  let W,
    H,
    drops = [],
    clouds = [];

  // Device capability check (respect battery saver & reduced motion)
  const nav = typeof navigator !== "undefined" ? navigator : null;
  const prefersReduced =
    typeof window !== "undefined" && typeof window.matchMedia === "function"
      ? window.matchMedia("(prefers-reduced-motion: reduce)").matches
      : false;
  // Fewer particles on weak devices, but only turn the storm off entirely when the
  // user asked for reduced motion (4-core laptops used to lose it by default).
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

  function resize() {
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    W = window.innerWidth;
    H = window.innerHeight;
    canvas.width = Math.round(W * dpr);
    canvas.height = Math.round(H * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    const density = lowPower ? 55000 : 32000;
    const count = Math.min(140, Math.floor((W * H) / density));
    drops = Array.from({ length: count }, () => ({
      x: Math.random() * W,
      y: Math.random() * H,
      len: 28 + Math.random() * 32,
      speed: 18 + Math.random() * 16,
      drift: -0.6 + Math.random() * 1.2,
    }));

    const cloudCount = lowPower ? 5 : 9;
    const cols = 5;
    const rows = 3;
    const cellW = W / cols;
    const cellH = H / rows;
    const P = 16;

    clouds = Array.from({ length: cloudCount }, (_, i) => {
      const r = Math.floor(i / cols);
      const c = i % cols;
      const blocks = [];
      const numBlocks = 5 + Math.floor(Math.random() * 4);
      for (let j = 0; j < numBlocks; j++) {
        blocks.push({
          rx: (Math.random() - 0.5) * 180,
          ry: (Math.random() - 0.5) * 55,
          rw: 60 + Math.random() * 110,
          rh: 28 + Math.random() * 40,
        });
      }
      blocks.forEach((b) => {
        b.rx = Math.floor(b.rx / P) * P;
        b.ry = Math.floor(b.ry / P) * P;
        b.rw = Math.floor(b.rw / P) * P;
        b.rh = Math.floor(b.rh / P) * P;
      });
      return {
        x: c * cellW + Math.random() * cellW * 0.4,
        y: r * cellH + Math.random() * cellH * 0.4,
        blocks: blocks,
        speed: 0.22 + Math.random() * 0.44,
        opacity: 0.03 + Math.random() * 0.05,
      };
    });
  }

  let resizeTimer;
  window.addEventListener("resize", () => {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(resize, 150);
  });
  resize();

  function isLightTheme() {
    return document.documentElement.getAttribute("data-theme") === "light";
  }

  function drawClouds(dt = 1) {
    const isLight = isLightTheme();
    const baseColor = isLight ? "rgba(0,0,0," : "rgba(255,255,255,";
    for (let i = 0; i < clouds.length; i++) {
      const c = clouds[i];
      // Keep the light-theme clouds subtle; the dark-theme alpha washes the
      // white background gray when the translucent blocks overlap.
      const alpha = isLight ? c.opacity * 0.025 + 0.0015 : c.opacity;
      ctx.fillStyle = baseColor + alpha + ")";
      const blocks = c.blocks;
      for (let j = 0; j < blocks.length; j++) {
        const b = blocks[j];
        ctx.fillRect(c.x + b.rx, c.y + b.ry, b.rw, b.rh);
      }
      c.x += c.speed * dt;
      if (c.x > W + 500) {
        c.x = -500;
        c.y = Math.random() * H;
      }
    }
  }

  function drawRain(dt = 1) {
    ctx.clearRect(0, 0, W, H);
    drawClouds(dt);
    ctx.lineWidth = 1.2;
    ctx.strokeStyle = isLightTheme()
      ? "rgba(0,0,0,0.38)"
      : "rgba(255,255,255,0.4)";
    ctx.beginPath();
    for (let i = 0; i < drops.length; i++) {
      const d = drops[i];
      ctx.moveTo(d.x, d.y);
      ctx.lineTo(d.x + d.drift * 3, d.y + d.len);
      d.y += d.speed * dt;
      d.x += d.drift * dt;
      if (d.y > H + d.len) {
        d.y = -d.len - 10;
        d.x = Math.random() * W;
      }
    }
    ctx.stroke();
  }

  let tabVisible = !document.hidden;
  document.addEventListener("visibilitychange", () => {
    tabVisible = !document.hidden;
    if (tabVisible && rainEnabled) loop();
  });

  const raf =
    typeof requestAnimationFrame === "function"
      ? requestAnimationFrame
      : typeof window !== "undefined" && window.requestAnimationFrame
        ? window.requestAnimationFrame.bind(window)
        : (cb) => setTimeout(cb, 16);

  let loopRunning = false;
  let lastFrame = 0;
  const getNow = () =>
    typeof performance !== "undefined" && typeof performance.now === "function"
      ? performance.now()
      : Date.now();
  function loop() {
    if (loopRunning || !rainEnabled) return;
    loopRunning = true;
    lastFrame = getNow();
    function tick(ts) {
      if (!tabVisible || !rainEnabled) {
        loopRunning = false;
        return;
      }
      const delta = Math.min(32, Math.max(8, ts - lastFrame || 16.6)) / 16.6;
      lastFrame = ts;
      drawRain(delta);
      raf(tick);
    }
    raf(tick);
  }
  if (rainEnabled) loop();

  // Storm toggle button
  const raintoggle = document.getElementById("raintoggle");
  const stormOnSVG = `<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 16.2A5 5 0 0 0 18 7h-1.26A8 8 0 1 0 4 15.25"></path><path d="M16 14v6"></path><path d="M8 14v6"></path><path d="M12 16v6"></path></svg>`;
  const stormOffSVG = `<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 16.2A5 5 0 0 0 18 7h-1.26A8 8 0 1 0 4 15.25"></path><path d="M16 14v6"></path><path d="M8 14v6"></path><path d="M12 16v6"></path><line x1="2" y1="2" x2="22" y2="22"></line></svg>`;

  function updateRainToggleUI() {
    if (raintoggle)
      raintoggle.innerHTML = rainEnabled ? stormOnSVG : stormOffSVG;
  }
  updateRainToggleUI();

  if (raintoggle) {
    raintoggle.onclick = () => {
      rainEnabled = !rainEnabled;
      try {
        localStorage.setItem("rain", rainEnabled ? "on" : "off");
      } catch (e) {}
      updateRainToggleUI();
      if (!rainEnabled) ctx.clearRect(0, 0, W, H);
      else loop();
    };
  }

  // Global click ripple effect
  document.addEventListener(
    "mousedown",
    function (e) {
      if (e.button !== 0) return;
      if (
        typeof window !== "undefined" &&
        typeof window.matchMedia === "function" &&
        window.matchMedia("(prefers-reduced-motion: reduce)").matches
      )
        return;
      const ripple = document.createElement("div");
      ripple.className = "ripple";
      ripple.style.left = e.clientX + "px";
      ripple.style.top = e.clientY + "px";
      document.body.appendChild(ripple);
      setTimeout(() => ripple.remove(), 600);
    },
    { passive: true },
  );
})();
