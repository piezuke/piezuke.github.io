/**
 * piezuke_ — kinetic ring cursor
 * The original ring: eased follow, grows over clickable things, squeezes on press.
 *
 * Click-bug hardening (the stray "+" some browsers drew on press):
 *  - the native cursor is replaced by a transparent image cursor in CSS
 *    (more reliable than `cursor: none`, which can flash the system cursor)
 *  - pressing a link/button never starts a native drag or text selection
 *    (the OS paints its own cursor, with a "+" / link badge, during those)
 *  - the click ripple is skipped while this cursor is active
 * Disable with CONFIG.cursor = "off" or ?cursor=off.
 */
(function () {
  const mq = (q) =>
    typeof window.matchMedia === "function" ? window.matchMedia(q) : null;
  const fine = mq("(hover: hover) and (pointer: fine)");
  const reduced = mq("(prefers-reduced-motion: reduce)");
  if (!fine || !fine.matches || (reduced && reduced.matches)) return;

  try {
    const q = new URLSearchParams(window.location.search).get("cursor");
    if (q && q.toLowerCase() === "off") return;
  } catch (e) {}
  if (
    typeof CONFIG !== "undefined" &&
    CONFIG.cursor &&
    String(CONFIG.cursor).toLowerCase() === "off"
  )
    return;

  const INTERACTIVE =
    'a, button, [role="button"], [role="switch"], [onclick], .chip, .pill, .card, ' +
    ".notenode, .folder, .contact-card, .mw-btn, .mini-btn, .code-copy, label, summary";
  const PRESSABLE =
    'a, button, [role="button"], [role="switch"], [onclick], .chip, .card, ' +
    ".notenode, .folder, .mw-btn, .mini-btn, .code-copy, summary";
  const NATIVE_TEXT = 'input, textarea, select, [contenteditable="true"]';
  const NATIVE_OTHER = ".notetree-resizer";

  const html = document.documentElement;
  html.classList.add("custom-cursor");

  const root = document.createElement("div");
  root.className = "cc-root";
  root.setAttribute("aria-hidden", "true");
  root.innerHTML = '<div class="cc-ring"></div>';
  document.body.appendChild(root);
  const ring = root.querySelector(".cc-ring");

  let mx = window.innerWidth / 2,
    my = window.innerHeight / 2;
  let curX = mx,
    curY = my;
  let currentScale = 1.0;
  let isHovered = false;
  let isMouseDown = false;
  let visible = false;
  let isLoopRunning = false;
  let firstMove = true;

  function show() {
    if (!visible) {
      visible = true;
      root.classList.add("visible");
    }
  }
  function draw() {
    ring.style.transform =
      "translate3d(" +
      curX +
      "px, " +
      curY +
      "px, 0) scale(" +
      currentScale.toFixed(3) +
      ")";
  }
  function wakeLoop() {
    if (!isLoopRunning) {
      isLoopRunning = true;
      requestAnimationFrame(mainLoop);
    }
  }
  function mainLoop() {
    // silky kinetic follow (pure inertia, no distortion)
    const ease = 0.22;
    curX += (mx - curX) * ease;
    curY += (my - curY) * ease;

    // expand on hover, compress on click
    const targetScale = isHovered ? 1.75 : 1.0;
    const clickFactor = isMouseDown ? 0.85 : 1.0;
    currentScale += (targetScale * clickFactor - currentScale) * 0.18;
    draw();

    const dist = Math.hypot(mx - curX, my - curY);
    const scaling = Math.abs(currentScale - targetScale * clickFactor) > 0.005;
    if (dist > 0.1 || scaling) {
      requestAnimationFrame(mainLoop);
    } else {
      isLoopRunning = false;
      curX = mx;
      curY = my;
      draw();
    }
  }

  function applyHover(el) {
    const t = el && el.closest ? el : null;
    const isNative = t && (t.closest(NATIVE_TEXT) || t.closest(NATIVE_OTHER));
    root.classList.toggle("native", !!isNative);
    if (!isNative) {
      isHovered = !!(t && t.closest(INTERACTIVE));
      root.classList.toggle("hover", isHovered);
    } else {
      isHovered = false;
      root.classList.remove("hover");
    }
    wakeLoop();
  }

  window.addEventListener(
    "mousemove",
    function (e) {
      mx = e.clientX;
      my = e.clientY;
      if (firstMove) {
        firstMove = false;
        curX = mx;
        curY = my;
      }
      show();
      wakeLoop();
      applyHover(e.target);
    },
    { passive: true },
  );

  window.addEventListener("mousedown", function (e) {
    if (e.button !== 0) return;
    isMouseDown = true;
    root.classList.add("down");
    wakeLoop();
    // Stop the browser from starting a native drag / text-selection on press
    const t = e.target && e.target.closest ? e.target : null;
    if (t && !t.closest(NATIVE_TEXT) && !t.closest(NATIVE_OTHER)) {
      if (t.closest(PRESSABLE)) e.preventDefault();
    }
  });
  window.addEventListener("mouseup", function () {
    isMouseDown = false;
    root.classList.remove("down");
    wakeLoop();
  });
  window.addEventListener("blur", function () {
    isMouseDown = false;
    root.classList.remove("down");
    wakeLoop();
  });

  document.addEventListener("dragstart", function (e) {
    const t = e.target && e.target.closest ? e.target : null;
    if (t && t.closest(NATIVE_TEXT)) return;
    e.preventDefault();
  });

  // mouseleave/mouseenter don't fire on `document`; use the root element.
  html.addEventListener("mouseleave", function () {
    visible = false;
    root.classList.remove("visible");
  });
  html.addEventListener("mouseenter", function (e) {
    curX = mx = e.clientX;
    curY = my = e.clientY;
    show();
    wakeLoop();
  });

  // Keep the hover state right when content changes under a still mouse
  let pending = 0;
  function recheck() {
    pending = 0;
    if (visible) applyHover(document.elementFromPoint(mx, my));
  }
  function schedule() {
    if (!pending) pending = requestAnimationFrame(recheck);
  }
  window.addEventListener("scroll", schedule, { passive: true });
  window.addEventListener("hashchange", function () {
    setTimeout(schedule, 120);
    setTimeout(schedule, 700);
  });

  /* ---------------- optional click diagnostic ----------------
   * Open the site with  ?debug=cursor  and click around. A panel at the
   * bottom shows, for the latest click: what is under the pointer, what the
   * page changed in the next 600 ms, the cursor style the browser applies,
   * and the click count (2+ = rapid clicking). If a stray shape appears
   * and the panel shows nothing new, it is not coming from the page.
   */
  (function () {
    let on = false;
    try {
      on = new URLSearchParams(window.location.search).get("debug") === "cursor";
    } catch (e) {}
    if (!on) return;

    const box = document.createElement("pre");
    box.style.cssText =
      "position:fixed;left:50%;bottom:10px;transform:translateX(-50%);z-index:2147483647;" +
      "margin:0;padding:10px 14px;max-width:min(92vw,760px);font:12px/1.5 monospace;" +
      "background:#000;color:#0f0;border:1px solid #0f0;border-radius:8px;" +
      "pointer-events:none;white-space:pre-wrap;opacity:.92";
    box.textContent = "cursor debug: click something…";
    document.body.appendChild(box);

    const name = (n) => {
      if (!n) return "(none)";
      if (n.nodeType === 3) return "#text";
      let s = (n.tagName || "?").toLowerCase();
      if (n.id) s += "#" + n.id;
      if (n.classList && n.classList.length) s += "." + [...n.classList].slice(0, 3).join(".");
      return s;
    };
    let seq = 0;
    window.addEventListener(
      "mousedown",
      (e) => {
        seq++;
        const id = seq;
        const under = document.elementsFromPoint(e.clientX, e.clientY).slice(0, 5).map(name);
        const events = [];
        const mo = new MutationObserver((list) => {
          for (const m of list) {
            if (events.length > 8) break;
            if (m.target && m.target.closest && m.target.closest(".cc-root")) continue;
            if (m.type === "childList") {
              m.addedNodes.forEach((n) => events.push("+ " + name(n)));
              m.removedNodes.forEach((n) => events.push("- " + name(n)));
            } else if (m.type === "attributes") {
              events.push("~ " + name(m.target) + " [" + m.attributeName + "]");
            }
          }
        });
        mo.observe(document.documentElement, {
          childList: true,
          subtree: true,
          attributes: true,
          attributeFilter: ["class", "style", "open", "hidden"],
        });
        const top = document.elementFromPoint(e.clientX, e.clientY);
        const cur = top ? getComputedStyle(top).cursor.slice(0, 40) : "?";
        setTimeout(() => {
          mo.disconnect();
          if (id !== seq) return;
          box.textContent =
            "click #" + id + "  detail(click count)=" + e.detail + "\n" +
            "under pointer: " + under.join("  >  ") + "\n" +
            "computed cursor: " + cur + "\n" +
            "selection: " + JSON.stringify(String(getSelection()).slice(0, 30)) + "\n" +
            "page changes in 600ms: " + (events.length ? events.join(" | ") : "none");
        }, 600);
      },
      true,
    );
  })();
})();
