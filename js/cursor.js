(function () {
  function prefersReduced() {
    return (
      typeof window.matchMedia === "function" &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches
    );
  }
  function hasFinePointer() {
    return (
      typeof window.matchMedia === "function" &&
      window.matchMedia("(hover: hover) and (pointer: fine)").matches
    );
  }

  if (!hasFinePointer() || prefersReduced()) return;

  const CURSOR_ALIASES = {
    ring: "reticle",
    "dot-ring": "reticle",
    trail: "reticle",
    block: "terminal-block",
    pixel: "pixel-block",
    glitch: "glitch-trail",
    trace: "trace-ping",
    ping: "trace-ping",
    hex: "hex-addr",
  };

  const VALID_CURSORS = [
    "reticle",
    "terminal-block",
    "glitch-trail",
    "pixel-block",
    "hex-addr",
    "scope",
    "trace-ping",
    "off",
  ];

  function resolveCursor() {
    try {
      const fromUrl = new URLSearchParams(window.location.search).get("cursor");
      if (fromUrl) {
        const norm =
          CURSOR_ALIASES[fromUrl.toLowerCase()] || fromUrl.toLowerCase();
        if (VALID_CURSORS.includes(norm)) return norm;
      }
    } catch (e) {}
    if (typeof CONFIG !== "undefined" && CONFIG.cursor) {
      const c = String(CONFIG.cursor).toLowerCase();
      const norm = CURSOR_ALIASES[c] || c;
      if (VALID_CURSORS.includes(norm)) return norm;
    }
    return "reticle";
  }

  const cursorStyle = resolveCursor();
  if (cursorStyle === "off") return;

  const html = document.documentElement;
  html.classList.add("custom-cursor");

  const root = document.createElement("div");
  root.className = "cc-root";
  root.setAttribute("aria-hidden", "true");

  // Cursor DOM shapes
  if (cursorStyle === "terminal-block") {
    root.insertAdjacentHTML("beforeend", '<div class="cc-block"></div>');
  } else if (cursorStyle === "glitch-trail") {
    root.insertAdjacentHTML(
      "beforeend",
      '<div class="cc-ghost cc-ghost-3"></div><div class="cc-ghost cc-ghost-2"></div>' +
        '<div class="cc-ghost cc-ghost-1"></div><div class="cc-glitch-core"></div>',
    );
  } else if (cursorStyle === "pixel-block") {
    root.insertAdjacentHTML(
      "beforeend",
      '<div class="cc-pixel cc-pixel-3"></div><div class="cc-pixel cc-pixel-2"></div>' +
        '<div class="cc-pixel cc-pixel-1"></div><div class="cc-pixel-core"></div>',
    );
  } else if (cursorStyle === "hex-addr") {
    root.insertAdjacentHTML(
      "beforeend",
      '<div class="cc-hex-dot"></div><div class="cc-hex-tag"><span class="cc-hex-text">0x0000</span></div>',
    );
  } else if (cursorStyle === "scope") {
    root.insertAdjacentHTML(
      "beforeend",
      '<div class="cc-scope-h"></div><div class="cc-scope-v"></div>' +
        '<div class="cc-scope-dot"></div><div class="cc-scope-tick cc-scope-tl"></div>' +
        '<div class="cc-scope-tick cc-scope-tr"></div>',
    );
  } else if (cursorStyle === "trace-ping") {
    root.insertAdjacentHTML(
      "beforeend",
      '<canvas class="cc-trace-canvas"></canvas><div class="cc-trace-dot"></div>',
    );
  } else {
    // Bold kinetic circular ring (pure circle, zero distortion)
    root.insertAdjacentHTML("beforeend", '<div class="cc-ring"></div>');
  }

  document.body.appendChild(root);

  const ring = root.querySelector(".cc-ring");
  const block = root.querySelector(".cc-block");
  const glitchCore = root.querySelector(".cc-glitch-core");
  const ghosts = [
    root.querySelector(".cc-ghost-1"),
    root.querySelector(".cc-ghost-2"),
    root.querySelector(".cc-ghost-3"),
  ];
  const pixelCore = root.querySelector(".cc-pixel-core");
  const pixelDoms = [
    root.querySelector(".cc-pixel-1"),
    root.querySelector(".cc-pixel-2"),
    root.querySelector(".cc-pixel-3"),
  ];
  const hexDot = root.querySelector(".cc-hex-dot");
  const hexTag = root.querySelector(".cc-hex-tag");
  const hexText = root.querySelector(".cc-hex-text");
  const scopeH = root.querySelector(".cc-scope-h");
  const scopeV = root.querySelector(".cc-scope-v");
  const scopeDot = root.querySelector(".cc-scope-dot");
  const traceCanvas = root.querySelector(".cc-trace-canvas");
  const traceDot = root.querySelector(".cc-trace-dot");

  const NATIVE_TEXT = 'input, textarea, select, [contenteditable="true"]';
  const NATIVE_OTHER = ".notetree-resizer";
  const INTERACTIVE =
    'a, button, [role="button"], [onclick], .chip, .pill, .card, ' +
    ".notenode, .folder, .contact-card, .mw-btn, .mini-btn, .code-copy, label, summary";

  let mx = window.innerWidth / 2,
    my = window.innerHeight / 2;
  let curX = mx,
    curY = my;
  let currentScale = 1.0;
  let isHovered = false;
  let isMouseDown = false;
  let visible = false;
  let isLoopRunning = false;

  const legacyTrail = [];
  const TRAIL_LEN = 8;
  const usesLegacyTrail = ["glitch-trail", "pixel-block", "trace-ping"].includes(
    cursorStyle,
  );

  function show() {
    if (!visible) {
      visible = true;
      root.classList.add("visible");
    }
  }

  function place(el, x, y) {
    if (el) el.style.transform = "translate3d(" + x + "px," + y + "px,0)";
  }

  function placePixel(el, x, y) {
    if (!el) return;
    const g = 8;
    el.style.transform =
      "translate3d(" +
      Math.round(x / g) * g +
      "px," +
      Math.round(y / g) * g +
      "px,0)";
  }

  function wakeLoop() {
    if (!isLoopRunning) {
      isLoopRunning = true;
      requestAnimationFrame(mainLoop);
    }
  }

  function mainLoop() {
    // 1. Silky kinetic follow physics (pure smooth inertia, no shape distortion)
    const ease = 0.22;
    curX += (mx - curX) * ease;
    curY += (my - curY) * ease;

    // 2. Smooth scale transitions (expand on hover, compress on click)
    const targetScale = isHovered ? 1.75 : 1.0;
    const clickFactor = isMouseDown ? 0.85 : 1.0;
    currentScale += (targetScale * clickFactor - currentScale) * 0.18;

    // Bold circular ring (pure circle, zero deformation)
    if (ring) {
      ring.style.transform = `translate3d(${curX}px, ${curY}px, 0) scale(${currentScale.toFixed(3)})`;
    }

    // Place alternative cursor variants if chosen
    place(block, curX, curY);
    place(glitchCore, curX, curY);
    placePixel(pixelCore, curX, curY);
    place(hexDot, curX, curY);
    place(hexTag, curX, curY);
    if (scopeH) scopeH.style.top = curY + "px";
    if (scopeV) scopeV.style.left = curX + "px";
    place(scopeDot, curX, curY);
    place(traceDot, curX, curY);

    // Check if motion has settled
    const distToTarget = Math.hypot(mx - curX, my - curY);
    const isScaling =
      Math.abs(currentScale - targetScale * clickFactor) > 0.005;

    if (distToTarget > 0.1 || isScaling) {
      requestAnimationFrame(mainLoop);
    } else {
      isLoopRunning = false;
      curX = mx;
      curY = my;
      if (ring) {
        ring.style.transform = `translate3d(${curX}px, ${curY}px, 0) scale(${currentScale.toFixed(3)})`;
      }
    }
  }

  // Event Listeners
  window.addEventListener(
    "mousemove",
    function (e) {
      mx = e.clientX;
      my = e.clientY;
      show();
      wakeLoop();

      if (hexText) {
        const addr = (((mx & 0xfff) << 12) | (my & 0xfff)) >>> 0;
        hexText.textContent =
          "0x" + addr.toString(16).toUpperCase().padStart(6, "0");
      }

      // Legacy DOM trail (for glitch-trail & pixel-block cursors)
      if (usesLegacyTrail) {
        legacyTrail.unshift({ x: mx, y: my });
        if (legacyTrail.length > TRAIL_LEN) legacyTrail.length = TRAIL_LEN;
        const ghostSteps = [2, 4, 6];
        ghosts.forEach((g, i) => {
          const p =
            legacyTrail[ghostSteps[i]] || legacyTrail[legacyTrail.length - 1];
          if (p) place(g, p.x, p.y);
        });
        pixelDoms.forEach((g, i) => {
          const p =
            legacyTrail[ghostSteps[i]] || legacyTrail[legacyTrail.length - 1];
          if (p) placePixel(g, p.x, p.y);
        });
      }

      const t = e.target && e.target.closest ? e.target : null;
      const isNative = t && (t.closest(NATIVE_TEXT) || t.closest(NATIVE_OTHER));
      root.classList.toggle("native", !!isNative);

      if (!isNative) {
        const hit = t && t.closest(INTERACTIVE);
        isHovered = !!hit;
        root.classList.toggle("hover", isHovered);
        if (hexText && hit) {
          const href = hit.getAttribute && hit.getAttribute("href");
          hexText.textContent = href
            ? href.replace(/^#/, "")
            : "<" + hit.tagName.toLowerCase() + ">";
        }
      } else {
        isHovered = false;
        root.classList.remove("hover");
      }
    },
    { passive: true },
  );

  window.addEventListener("mousedown", function (e) {
    if (e.button === 0) {
      isMouseDown = true;
      root.classList.add("down");
      wakeLoop();
    }
  });

  window.addEventListener("mouseup", function () {
    isMouseDown = false;
    root.classList.remove("down");
    wakeLoop();
  });

  document.addEventListener("mouseleave", function () {
    visible = false;
    root.classList.remove("visible");
  });
  document.addEventListener("mouseenter", show);

  if (cursorStyle === "glitch-trail" && glitchCore) {
    setInterval(function () {
      const jx = (Math.random() - 0.5) * 5;
      const jy = (Math.random() - 0.5) * 5;
      glitchCore.style.marginLeft = jx + "px";
      glitchCore.style.marginTop = jy + "px";
    }, 140);
  }

  if (cursorStyle === "scope") {
    setInterval(function () {
      root.classList.add("flicker");
      setTimeout(function () {
        root.classList.remove("flicker");
      }, 70);
    }, 2200);
  }

  if (cursorStyle === "trace-ping" && traceCanvas) {
    const pctx = traceCanvas.getContext("2d");
    let tdpr = Math.min(2, window.devicePixelRatio || 1);
    function resizeTrace() {
      traceCanvas.width = window.innerWidth * tdpr;
      traceCanvas.height = window.innerHeight * tdpr;
      traceCanvas.style.width = window.innerWidth + "px";
      traceCanvas.style.height = window.innerHeight + "px";
      pctx.setTransform(tdpr, 0, 0, tdpr, 0, 0);
    }
    resizeTrace();
    window.addEventListener("resize", resizeTrace, { passive: true });

    let lastMoveAt = performance.now();
    let pinged = false;
    const pings = [];
    window.addEventListener(
      "mousemove",
      function () {
        lastMoveAt = performance.now();
        pinged = false;
      },
      { passive: true },
    );

    (function raf() {
      const now = performance.now();
      pctx.clearRect(0, 0, window.innerWidth, window.innerHeight);
      const accent =
        getComputedStyle(document.documentElement)
          .getPropertyValue("--text")
          .trim() || "#fff";

      if (legacyTrail.length > 1) {
        for (let i = 0; i < legacyTrail.length - 1; i++) {
          const a = legacyTrail[i],
            b2 = legacyTrail[i + 1];
          pctx.globalAlpha = Math.max(0, 0.5 - i * 0.06);
          pctx.strokeStyle = accent;
          pctx.lineWidth = 1;
          pctx.beginPath();
          pctx.moveTo(a.x, a.y);
          pctx.lineTo(b2.x, b2.y);
          pctx.stroke();
        }
      }

      if (!pinged && now - lastMoveAt > 350) {
        pinged = true;
        pings.push({ x: mx, y: my, start: now });
      }
      for (let i = pings.length - 1; i >= 0; i--) {
        const pg = pings[i];
        const t2 = (now - pg.start) / 900;
        if (t2 >= 1) {
          pings.splice(i, 1);
          continue;
        }
        pctx.globalAlpha = 1 - t2;
        pctx.strokeStyle = accent;
        pctx.lineWidth = 1;
        pctx.beginPath();
        pctx.arc(pg.x, pg.y, 4 + t2 * 22, 0, Math.PI * 2);
        pctx.stroke();
      }
      pctx.globalAlpha = 1;
      requestAnimationFrame(raf);
    })();
  }
})();
