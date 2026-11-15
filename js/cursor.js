/**
 * ===================================================================
 * piezuke_ — ring cursor  (rebuilt from scratch)
 * ===================================================================
 * Looks and feels like the original: a bold ring that trails the mouse with
 * a little inertia, swells over anything clickable and squeezes on press.
 *
 * Modes  (config.js -> cursor, or ?cursor=… in the address bar to test):
 *   "ring"         the ring above, drawn by the page (default)
 *   "native-ring"  the same ring drawn AS the operating-system cursor.
 *                  Nothing is hidden and nothing is faked, so there is no
 *                  "hidden cursor" that could ever flash back on a click.
 *                  (No trailing inertia — the OS draws it.)
 *   "off"          the normal system cursor
 *
 * Design rules that keep clicks clean:
 *   - ONE element, ONE transform. No wrapper layers, nothing is added to or
 *     removed from the page on click.
 *   - Pressing a link/button never starts a native drag or text selection
 *     (that is when some systems paint their own cursor with a "+" badge).
 *   - Only a real mouse or pen drives it. Touch screens never see it.
 *   - Skipped entirely under prefers-reduced-motion.
 */
(function () {
  "use strict";

  /* ---------------------------- environment ---------------------------- */
  const html = document.documentElement;
  const mm = (q) => (typeof window.matchMedia === "function" ? window.matchMedia(q) : null);
  const fine = mm("(hover: hover) and (pointer: fine)");
  const reduced = mm("(prefers-reduced-motion: reduce)");
  if (!fine || !fine.matches || (reduced && reduced.matches)) return;

  function getMode() {
    let m = "";
    try {
      m = (new URLSearchParams(window.location.search).get("cursor") || "").toLowerCase();
    } catch (e) {}
    if (!m && typeof CONFIG !== "undefined" && CONFIG.cursor) m = String(CONFIG.cursor).toLowerCase();
    if (m === "off" || m === "system" || m === "native") return "off";
    if (m === "native-ring" || m === "os") return "native-ring";
    return "ring"; // "ring", "on", or anything else
  }
  const mode = getMode();
  if (mode === "off") return;

  /* ------------------------------ selectors ----------------------------- */
  const CLICKABLE =
    'a, button, [role="button"], [role="switch"], [onclick], summary, label, ' +
    ".chip, .pill, .card, .explore, .tile, .social-tile, .notenode, .folder, " +
    ".contact-card, .code-copy, .mw-btn, .mini-btn, .palette-item, .ibtn, .burger, .btt-btn";
  const PRESSABLE =
    'a, button, [role="button"], [role="switch"], [onclick], summary, ' +
    ".chip, .card, .explore, .tile, .social-tile, .notenode, .folder, " +
    ".code-copy, .mw-btn, .mini-btn, .palette-item, .ibtn, .burger, .btt-btn";
  const TEXT_FIELD = 'input, textarea, select, [contenteditable="true"]';
  const OWN_CURSOR = ".notetree-resizer"; // keeps the browser's resize cursor
  const el = (t) => (t && t.closest ? t : null);

  /* ---------------- press guards (both modes) ---------------- */
  document.addEventListener("mousedown", (e) => {
    if (e.button !== 0) return;
    const t = el(e.target);
    if (!t || t.closest(TEXT_FIELD) || t.closest(OWN_CURSOR)) return;
    if (t.closest(PRESSABLE)) e.preventDefault(); // no drag / selection starts here
  });
  document.addEventListener("dragstart", (e) => {
    const t = el(e.target);
    if (t && t.closest(TEXT_FIELD)) return;
    e.preventDefault();
  });

  /* ===================================================================
   * MODE: native-ring  — the ring as the OS cursor
   * =================================================================== */
  if (mode === "native-ring") {
    const svg = (size, r, stroke, color, fill) =>
      "data:image/svg+xml," +
      encodeURIComponent(
        `<svg xmlns='http://www.w3.org/2000/svg' width='${size}' height='${size}' viewBox='0 0 ${size} ${size}'>` +
          `<circle cx='${size / 2}' cy='${size / 2}' r='${r}' fill='${fill}' stroke='${color}' stroke-width='${stroke}'/></svg>`,
      );
    const cur = (size, r, color, fill, fallback) =>
      `url("${svg(size, r, 2.5, color, fill)}") ${size / 2} ${size / 2}, ${fallback}`;

    const sets = {
      dark: { c: "#fafafa", f: "rgba(250,250,250,0.14)" },
      light: { c: "#050505", f: "rgba(5,5,5,0.12)" },
    };
    let css = "";
    for (const [theme, v] of Object.entries(sets)) {
      const scope = theme === "light" ? 'html[data-theme="light"].rc-native' : "html.rc-native";
      const bump = theme === "light" ? "" : ""; // dark rules come first, light ones override
      css +=
        `${scope}, ${scope} * { cursor: ${cur(24, 10.5, v.c, "none", "auto")} !important; }\n` +
        `${scope} :is(${CLICKABLE}) { cursor: ${cur(32, 14, v.c, v.f, "pointer")} !important; }\n` +
        `${scope} :is(${PRESSABLE}):active { cursor: ${cur(20, 8, v.c, v.f, "pointer")} !important; }\n` +
        `${scope} :is(${TEXT_FIELD}) { cursor: text !important; }\n` +
        `${scope} ${OWN_CURSOR}, ${scope} ${OWN_CURSOR} * { cursor: col-resize !important; }\n` +
        bump;
    }
    const style = document.createElement("style");
    style.id = "rc-native-css";
    style.textContent = css;
    document.head.appendChild(style);
    html.classList.add("rc-native");
    return;
  }

  /* ===================================================================
   * MODE: ring  — the page-drawn ring
   * =================================================================== */
  const ring = document.createElement("div");
  ring.className = "rc";
  ring.setAttribute("aria-hidden", "true");
  document.body.appendChild(ring);
  html.classList.add("rc-on");

  let tx = -100,
    ty = -100, // where the mouse is
    x = -100,
    y = -100, // where the ring is (always on the pointer)
    s = 1; // current scale
  let hover = false,
    down = false,
    shown = false,
    first = true,
    raf = 0;

  const paint = () => {
    ring.style.transform = "translate3d(" + x + "px," + y + "px,0) scale(" + s.toFixed(3) + ")";
  };

  function step() {
    raf = 0;
    x = tx; // locked to the pointer: no trailing, no inertia
    y = ty;
    const goal = (hover ? 1.75 : 1) * (down ? 0.85 : 1); // swell on hover, squeeze on press
    s += (goal - s) * 0.4; // quick and steady, never overshoots
    paint();
    if (Math.abs(tx - x) > 0.1 || Math.abs(ty - y) > 0.1 || Math.abs(goal - s) > 0.005) {
      raf = requestAnimationFrame(step);
    } else {
      x = tx;
      y = ty;
      s = goal;
      paint();
    }
  }
  const wake = () => {
    if (!raf) raf = requestAnimationFrame(step);
  };

  const show = () => {
    if (!shown) {
      shown = true;
      ring.classList.add("on");
    }
  };
  const hide = () => {
    shown = false;
    down = false;
    ring.classList.remove("on", "is-down");
  };
  const release = () => {
    if (!down) return;
    down = false;
    ring.classList.remove("is-down");
    wake();
  };

  function classify(target) {
    const t = el(target);
    const native = !!(t && (t.closest(TEXT_FIELD) || t.closest(OWN_CURSOR)));
    const h = !native && !!(t && t.closest(CLICKABLE));
    ring.classList.toggle("is-native", native); // real cursor shows over text fields
    if (h !== hover) {
      hover = h;
      ring.classList.toggle("is-hover", h);
    }
    wake();
  }

  window.addEventListener(
    "pointermove",
    (e) => {
      if (e.pointerType === "touch") return;
      tx = e.clientX;
      ty = e.clientY;
      if (first) {
        first = false;
        x = tx;
        y = ty;
        paint();
      }
      show();
      classify(e.target);
    },
    { passive: true },
  );
  window.addEventListener("pointerdown", (e) => {
    if (e.pointerType === "touch" || e.button !== 0) return;
    down = true;
    ring.classList.add("is-down");
    wake();
  });
  window.addEventListener("pointerup", release);
  window.addEventListener("pointercancel", release);
  window.addEventListener("dragend", release);
  window.addEventListener("contextmenu", release);
  window.addEventListener("blur", release);

  html.addEventListener("mouseleave", hide);
  html.addEventListener("mouseenter", (e) => {
    tx = x = e.clientX;
    ty = y = e.clientY;
    paint();
    show();
  });
  document.addEventListener("visibilitychange", () => {
    if (document.hidden) hide();
  });

  // keep hover right when the page moves under a still mouse (scroll, route change)
  let pending = 0;
  const recheck = () => {
    pending = 0;
    if (shown) classify(document.elementFromPoint(tx, ty));
  };
  const schedule = () => {
    if (!pending) pending = requestAnimationFrame(recheck);
  };
  window.addEventListener("scroll", schedule, { passive: true });
  window.addEventListener("hashchange", () => {
    setTimeout(schedule, 120);
    setTimeout(schedule, 700);
  });

  /* ---------------- optional click diagnostic ----------------
   * Open the site with  ?debug=cursor , click until something odd shows, and
   * screenshot the green panel: it lists what is under the pointer, what the
   * page changed in the next 600 ms, the cursor style applied, and the click
   * count (2+ = rapid clicking). If the odd shape is visible and the panel
   * shows nothing new, it is not coming from the page.
   */
  (function debugPanel() {
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
      let t = (n.tagName || "?").toLowerCase();
      if (n.id) t += "#" + n.id;
      if (n.classList && n.classList.length) t += "." + [...n.classList].slice(0, 3).join(".");
      return t;
    };
    let seq = 0;
    window.addEventListener(
      "mousedown",
      (e) => {
        const id = ++seq;
        const under = document.elementsFromPoint(e.clientX, e.clientY).slice(0, 5).map(name);
        const events = [];
        const mo = new MutationObserver((list) => {
          for (const m of list) {
            if (events.length > 8) break;
            if (m.target && m.target.closest && m.target.closest(".rc")) continue;
            if (m.type === "childList") {
              m.addedNodes.forEach((n) => events.push("+ " + name(n)));
              m.removedNodes.forEach((n) => events.push("- " + name(n)));
            } else events.push("~ " + name(m.target) + " [" + m.attributeName + "]");
          }
        });
        mo.observe(html, {
          childList: true,
          subtree: true,
          attributes: true,
          attributeFilter: ["class", "style", "open", "hidden"],
        });
        const top = document.elementFromPoint(e.clientX, e.clientY);
        const cs = top ? getComputedStyle(top).cursor.slice(0, 40) : "?";
        setTimeout(() => {
          mo.disconnect();
          if (id !== seq) return;
          box.textContent =
            "click #" + id + "  count=" + e.detail + "\n" +
            "under pointer: " + under.join("  >  ") + "\n" +
            "computed cursor: " + cs + "\n" +
            "page changes in 600ms: " + (events.length ? events.join(" | ") : "none");
        }, 600);
      },
      true,
    );
  })();
})();
