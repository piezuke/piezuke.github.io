/**
 * ===================================================================
 * Motion layer  (GSAP + ScrollTrigger + SplitText, self-hosted in js/)
 * ===================================================================
 *  - hero: split-text name, staggered intro, parallax, reactive dot-matrix field
 *  - scroll-velocity marquee, staggered card / row reveals
 *  - heading mask reveals, footer wordmark
 *  - page-change curtain wipe, sliding nav pill
 *  - soft light under the pointer + tile spotlight (both follow the pointer exactly), nav progress line
 *
 * app.js calls FX.run(path) after every page render. Everything is skipped
 * under prefers-reduced-motion, and the site works without any of it.
 */
(function () {
  "use strict";
  const mm = (q) => (typeof window.matchMedia === "function" ? window.matchMedia(q) : null);
  const matches = (q) => Boolean(mm(q) && mm(q).matches);
  const reduced = matches("(prefers-reduced-motion: reduce)");
  const hoverOK = matches("(hover: hover)");
  const nav0 = typeof navigator !== "undefined" ? navigator : {};
  const lowPower = Boolean(
    (nav0.hardwareConcurrency && nav0.hardwareConcurrency <= 2) || (nav0.deviceMemory && nav0.deviceMemory <= 2),
  );

  const G = window.gsap;
  const ST = window.ScrollTrigger;
  const SP = window.SplitText;
  const canAnimate = Boolean(G) && !reduced;
  if (G) {
    try {
      G.registerPlugin(...[ST, SP].filter(Boolean));
    } catch (e) {}
  }

  const $app = () => document.getElementById("app");
  const q = (root, sel) => Array.prototype.slice.call(root.querySelectorAll(sel));

  /* ---------------------------------------------------------------- */
  /*  small helpers                                                    */
  /* ---------------------------------------------------------------- */
  function afterLoader(cb) {
    const l = document.getElementById("loader");
    if (!l || l.classList.contains("hide")) return cb();
    let done = false;
    const fin = () => {
      if (done) return;
      done = true;
      mo.disconnect();
      cb();
    };
    const mo = new MutationObserver(() => l.classList.contains("hide") && fin());
    mo.observe(l, { attributes: true, attributeFilter: ["class"] });
    setTimeout(fin, 2500);
  }

  function split(el, type) {
    if (!SP || !el) return null;
    try {
      return SP.create(el, { type: type || "words,chars", mask: "chars" });
    } catch (e) {
      return null;
    }
  }

  /* ---------------------------------------------------------------- */
  /*  Canvas 2D: reactive dot-matrix field behind the hero             */
  /* ---------------------------------------------------------------- */
  // soft edges drawn into the canvas (same shapes the old CSS masks had)
  const smooth = (a, b, v) => Math.min(1, Math.max(0, (v - a) / (b - a)));
  const heroFade = (x, y, W, H) => {
    const dx = (x / W - 0.6) / 0.75;
    const dy = (y / H - 0.45) / 0.7;
    return 1 - smooth(0.2, 0.78, Math.sqrt(dx * dx + dy * dy));
  };
  const footerFade = (x, y, W, H) => smooth(0.25, 0.8, y / H);

  let glStop = null;
  function startDots(cv, hero, opts) {
    opts = opts || {};
    if (lowPower || !cv) return null;
    const c2 = cv.getContext ? cv.getContext("2d") : null;
    if (!c2) return null;
    hero.classList.add("has-fx");

    const GAP = 24;
    const dpr = 1; // squares need no retina resolution; the canvas is scaled up with pixelated rendering
    let W = 0, H = 0, cols = 0, rows = 0;
    let raf = 0;
    let visible = true;
    const t0 = performance.now();
    const m = { x: -999, y: -999, s: 0, on: false };
    const ripples = [];
    let shown = false;

    const size = () => {
      const r = hero.getBoundingClientRect();
      W = Math.max(2, r.width);
      H = Math.max(2, r.height);
      cv.width = Math.round(W * dpr);
      cv.height = Math.round(H * dpr);
      c2.setTransform(dpr, 0, 0, dpr, 0, 0);
      cols = Math.ceil(W / GAP) + 1;
      rows = Math.ceil(H / GAP) + 1;
    };
    size();
    const ro = typeof ResizeObserver === "function" ? new ResizeObserver(size) : null;
    if (ro) ro.observe(hero);

    let last = 0;
    const frame = (now) => {
      raf = 0;
      if (!cv.isConnected || !visible || document.hidden) return;
      // calm ambient wave: 30 fps is plenty; full rate only while the cursor or a ripple is active
      const busy = m.s > 0.02 || ripples.length > 0;
      if (!busy && now - last < 30) {
        raf = requestAnimationFrame(frame);
        return;
      }
      last = now;
      const t = performance.now() - t0;
      const light = document.documentElement.getAttribute("data-theme") === "light";
      c2.clearRect(0, 0, W, H);
      c2.fillStyle = light ? "#000" : "#fff";
      m.s += ((m.on ? 1 : 0) - m.s) * 0.08;
      for (let k = ripples.length - 1; k >= 0; k--) if (t - ripples[k].t > 1900) ripples.splice(k, 1);

      for (let j = 0; j < rows; j++) {
        for (let i = 0; i < cols; i++) {
          let x = i * GAP;
          let y = j * GAP;
          // slow ambient wave
          const a = Math.sin(i * 0.27 + t * 0.0008) + Math.sin(j * 0.33 - t * 0.0011) + Math.sin((i + j) * 0.16 + t * 0.0006);
          let v = (a + 3) / 6;
          v *= v;
          let s = GAP * (0.07 + 0.36 * v);
          let al = 0.17 + 0.42 * v;

          // cursor: dots swell and are pushed away
          if (m.s > 0.01) {
            const dx = x - m.x, dy = y - m.y;
            const d2 = dx * dx + dy * dy;
            const f = Math.exp(-d2 / 18000) * m.s;
            if (f > 0.01) {
              const d = Math.sqrt(d2) || 1;
              x += (dx / d) * f * 14;
              y += (dy / d) * f * 14;
              s += GAP * 0.55 * f;
              al += 0.6 * f;
            }
          }
          // click ripples: an expanding ring of big dots
          for (let k = 0; k < ripples.length; k++) {
            const rp = ripples[k];
            const age = (t - rp.t) / 1000;
            const d = Math.hypot(x - rp.x, y - rp.y);
            const q = d - age * 460;
            const f = Math.exp(-(q * q) / 1500) * Math.max(0, 1 - age / 1.9);
            if (f > 0.01) {
              s += GAP * 0.7 * f;
              al += 0.7 * f;
            }
          }
          // keep the text side calmer
          if (opts.calm !== false) al *= 0.3 + 0.7 * Math.min(1, x / (W * 0.62));
          if (opts.alpha) al *= opts.alpha;
          if (opts.fade) al *= opts.fade(x, y, W, H);
          if (al < 0.03 || s < 0.6) continue;
          c2.globalAlpha = Math.min(1, al);
          c2.fillRect(x - s / 2, y - s / 2, s, s);
        }
      }
      c2.globalAlpha = 1;
      raf = requestAnimationFrame(frame);
    };
    const kick = () => {
      if (!raf) raf = requestAnimationFrame(frame);
    };

    const rel = (e) => {
      const r = hero.getBoundingClientRect();
      return { x: e.clientX - r.left, y: e.clientY - r.top };
    };
    const onMove = (e) => {
      const p = rel(e);
      m.x = p.x;
      m.y = p.y;
      m.on = true;
    };
    const onLeave = () => (m.on = false);
    const onDown = (e) => {
      if (e.target.closest && e.target.closest("a, button, input")) return;
      const p = rel(e);
      ripples.push({ x: p.x, y: p.y, t: performance.now() - t0 });
    };
    hero.addEventListener("pointermove", onMove, { passive: true });
    hero.addEventListener("pointerleave", onLeave, { passive: true });
    hero.addEventListener("pointerdown", onDown, { passive: true });

    let io = null;
    if (typeof IntersectionObserver === "function") {
      io = new IntersectionObserver((es) => {
        visible = es[0].isIntersecting;
        if (visible && opts.rippleOnShow && !shown) {
          shown = true;
          ripples.push({ x: W * 0.5, y: H * 0.7, t: performance.now() - t0 });
        }
        if (visible) kick();
      });
      io.observe(hero);
    }
    const onVis = () => !document.hidden && kick();
    document.addEventListener("visibilitychange", onVis);

    // one ripple on arrival so it never looks static
    if (opts.arrival !== false) ripples.push({ x: W * 0.78, y: H * 0.45, t: 400 });
    kick();

    return () => {
      visible = false;
      if (raf) cancelAnimationFrame(raf);
      if (io) io.disconnect();
      if (ro) ro.disconnect();
      document.removeEventListener("visibilitychange", onVis);
    };
  }

  /* ---------------------------------------------------------------- */
  /*  page curtain                                                     */
  /* ---------------------------------------------------------------- */
  let curtain = null;
  function wipe() {
    if (!canAnimate) return;
    const ld = document.getElementById("loader");
    if (ld && !ld.classList.contains("hide")) return; // the loading screen already covers this swap
    if (!curtain) {
      curtain = document.createElement("div");
      curtain.id = "curtain";
      curtain.setAttribute("aria-hidden", "true");
      curtain.innerHTML = "<i></i><i></i>";
      document.body.appendChild(curtain);
    }
    const panels = curtain.children;
    G.killTweensOf(panels);
    G.set(curtain, { display: "block" });
    G.set(panels, { yPercent: 0 });
    G.to(panels, {
      yPercent: -101,
      duration: 0.75,
      ease: "expo.inOut",
      stagger: 0.07,
      onComplete: () => G.set(curtain, { display: "none" }),
    });
  }

  /* ---------------------------------------------------------------- */
  /*  nav pill                                                         */
  /* ---------------------------------------------------------------- */
  function navPill(instant) {
    const links = document.getElementById("navlinks");
    if (!links || !canAnimate) return;
    let pill = links.querySelector(".nav-pill");
    if (!pill) {
      pill = document.createElement("span");
      pill.className = "nav-pill";
      pill.setAttribute("aria-hidden", "true");
      links.insertBefore(pill, links.firstChild);
      document.documentElement.classList.add("fx-nav");
    }
    function place(a, now) {
      const p = links.querySelector(".nav-pill");
      if (!p) return;
      if (!a || window.innerWidth <= 860) {
        G.set(p, { opacity: 0 });
        return;
      }
      const l = links.getBoundingClientRect();
      const r = a.getBoundingClientRect();
      const vars = { x: r.left - l.left, y: r.top - l.top, width: r.width, height: r.height, opacity: 1 };
      if (now) G.set(p, vars);
      else G.to(p, Object.assign({ duration: 0.55, ease: "expo.out", overwrite: true }, vars));
      links.querySelectorAll("a").forEach((x) => x.classList.toggle("under", x === a));
    }
    navPill.place = place;
    place(links.querySelector("a.active"), instant);
  }
  window.addEventListener("resize", () => {
    if (navPill.place) {
      const l = document.getElementById("navlinks");
      navPill.place(l && l.querySelector("a.active"), true);
    }
  });

  /* ---------------------------------------------------------------- */
  /*  per-page build                                                   */
  /* ---------------------------------------------------------------- */
  let ctx = null;
  let first = true;

  function cleanup() {
    if (glStop) {
      glStop();
      glStop = null;
    }
    if (ctx) {
      try {
        ctx.revert();
      } catch (e) {}
      ctx = null;
    }
  }

  function heroBuild(hero, isFirst) {
    const title = hero.querySelector("#glitch, .hero-title");
    const bits = q(hero, ".hero-status, .hero-role, .hero-subtitle, .cta, .fx-bit");
    const av = hero.querySelector(".hero-avatar");
    const img = hero.querySelector(".hero-avatar-img");
    [title, av].concat(bits).forEach((el) => el && el.classList.remove("reveal", "reveal-scale", "in-view"));

    const tl = G.timeline({ paused: true, defaults: { ease: "expo.out" } });
    const sp = split(title, "chars");
    if (sp && sp.chars && sp.chars.length) {
      G.set(sp.chars, { yPercent: 118, rotate: 7 });
      tl.to(sp.chars, { yPercent: 0, rotate: 0, duration: 1.25, stagger: 0.05 }, 0);
    } else if (title) {
      G.set(title, { y: 40, opacity: 0 });
      tl.to(title, { y: 0, opacity: 1, duration: 1 }, 0);
    }
    bits.forEach((el, i) => {
      G.set(el, { y: 26, opacity: 0 });
      tl.to(el, { y: 0, opacity: 1, duration: 0.9, clearProps: "transform,opacity" }, 0.3 + i * 0.1);
    });
    if (av) {
      G.set(av, { opacity: 0, scale: 0.94 });
      tl.to(av, { opacity: 1, scale: 1, duration: 1.1 }, 0.15);
    }
    if (img) {
      G.set(img, { clipPath: "inset(100% 0% 0% 0%)", scale: 1.22 });
      tl.to(img, { clipPath: "inset(0% 0% 0% 0%)", scale: 1, duration: 1.4, ease: "expo.inOut" }, 0.1);
    }
    // stats strip: fade up, numbers count from 0
    q(hero, ".hero-stats > div").forEach((el, i) => {
      G.set(el, { y: 22, opacity: 0 });
      tl.to(el, { y: 0, opacity: 1, duration: 0.8, clearProps: "transform,opacity" }, 0.75 + i * 0.09);
      const num = el.querySelector("b");
      const to = num ? parseInt(num.getAttribute("data-count"), 10) : NaN;
      if (num && to > 0) {
        const o = { v: 0 };
        num.textContent = "00";
        tl.to(o, { v: to, duration: 1.4, ease: "power3.out", onUpdate: () => (num.textContent = String(Math.round(o.v)).padStart(2, "0")) }, 0.85 + i * 0.09);
      }
    });
    if (isFirst) afterLoader(() => tl.play());
    else tl.play();

    // scroll parallax
    const text = hero.querySelector(".hero-text");
    if (ST && text)
      G.to(text, {
        yPercent: -9,
        opacity: 0.15,
        ease: "none",
        scrollTrigger: { trigger: hero, start: "top top", end: "bottom top", scrub: true },
      });
    if (ST && av)
      G.to(av, {
        yPercent: -14,
        ease: "none",
        scrollTrigger: { trigger: hero, start: "top top", end: "bottom top", scrub: true },
      });

    glStop = startDots(hero.querySelector(".hero-fx"), hero, { fade: heroFade });
  }

  function marqueeBuild(root) {
    const mq = root.querySelector(".marquee");
    const track = mq && mq.querySelector(".marquee-track");
    if (!track) return;
    mq.classList.add("gsap-on");
    G.to(track, { xPercent: -50, duration: 40, ease: "none", repeat: -1 });
  }

  function revealBuild(root) {
    const items = q(root, ".card, .explore, .empty-card, .ab-tile, .ab-row");
    if (!items.length || !ST) return;
    items.forEach((el) => el.classList.remove("reveal", "reveal-scale", "reveal-left", "in-view"));
    G.set(items, { opacity: 0, y: 54, transition: "none" });
    ST.batch(items, {
      start: "top 93%",
      once: true,
      onEnter: (batch) =>
        G.to(batch, {
          opacity: 1,
          y: 0,
          duration: 0.95,
          ease: "power3.out",
          stagger: 0.09,
          overwrite: true,
          clearProps: "opacity,transform,transition",
          onComplete: () => batch.forEach((e) => e.classList.add("in-view")),
        }),
    });
    // safety net: anything already on screen that never got revealed
    setTimeout(() => {
      items.forEach((e) => {
        if (!e.isConnected) return;
        if (e.style.opacity === "0" && e.getBoundingClientRect().top < window.innerHeight) {
          G.to(e, { opacity: 1, y: 0, duration: 0.4, clearProps: "opacity,transform,transition" });
          e.classList.add("in-view");
        }
      });
    }, 3200);
  }

  function headingBuild(root) {
    q(root, ".sechead h2, .page-title, .article-head h1, .about-h").forEach((h) => {
      h.classList.remove("reveal", "in-view");
      const sp = split(h, "words,chars");
      if (!sp || !sp.chars || !sp.chars.length) return;
      G.set(sp.chars, { yPercent: 112 });
      const go = () => G.to(sp.chars, { yPercent: 0, duration: 1, stagger: 0.025, ease: "expo.out", overwrite: true });
      if (ST) ST.create({ trigger: h, start: "top 92%", once: true, onEnter: go });
      else go();
      setTimeout(() => h.isConnected && h.getBoundingClientRect().top < window.innerHeight && go(), 3200);
    });
  }

  /* About page: portrait panel with its own dot field, photo wipes in */
  function aboutBuild(root, isFirst) {
    const panel = root.querySelector(".about-portrait");
    if (!panel) return;
    const photo = panel.querySelector(".about-photo");
    const img = panel.querySelector(".about-img");
    const cap = panel.querySelector(".about-cap");
    const bio = root.querySelector(".about-bio");
    const eyebrow = root.querySelector(".about-body .eyebrow");
    const tl = G.timeline({ paused: true, defaults: { ease: "expo.out" } });
    if (photo) {
      G.set(photo, { clipPath: "inset(100% 0% 0% 0%)" });
      tl.to(photo, { clipPath: "inset(0% 0% 0% 0%)", duration: 1.2, ease: "expo.inOut" }, 0);
    }
    if (img) {
      G.set(img, { scale: 1.2 });
      tl.to(img, { scale: 1, duration: 1.4 }, 0);
    }
    [cap, eyebrow, bio].forEach((el, i) => {
      if (!el) return;
      G.set(el, { y: 22, opacity: 0 });
      tl.to(el, { y: 0, opacity: 1, duration: 0.9, clearProps: "transform,opacity" }, 0.35 + i * 0.12);
    });
    if (isFirst) afterLoader(() => tl.play());
    else tl.play();
    glStop = startDots(panel.querySelector(".hero-fx"), panel, { calm: false, alpha: 0.9 });
  }

  function build(root, isFirst) {
    if (!isFirst) wipe();
    const hero = root.querySelector(".hero");
    if (hero) heroBuild(hero, isFirst);
    aboutBuild(root, isFirst);
    marqueeBuild(root);
    revealBuild(root);
    headingBuild(root);
  }

  function run() {
    if (!canAnimate) return;
    const root = $app();
    if (!root) return;
    cleanup();
    const isFirst = first;
    first = false;
    ctx = G.context(() => build(root, isFirst), root);
    navPill(isFirst);
    if (ST) requestAnimationFrame(() => ST.refresh());
  }

  window.FX = { run };

  /* ---------------------------------------------------------------- */
  /*  small hover effects (no GSAP needed)                             */
  /* ---------------------------------------------------------------- */
  if (hoverOK && !reduced) {
    /* soft light under the pointer: one fixed layer, moved straight to the pointer (no easing) */
    const glow = document.createElement("div");
    glow.className = "cursor-glow";
    glow.setAttribute("aria-hidden", "true");
    document.body.appendChild(glow);
    let graf = 0, gx = 0, gy = 0;
    document.addEventListener(
      "pointermove",
      (e) => {
        gx = e.clientX;
        gy = e.clientY;
        glow.classList.add("on");
        if (graf) return;
        graf = requestAnimationFrame(() => {
          graf = 0;
          glow.style.transform = "translate3d(" + (gx - 320) + "px," + (gy - 320) + "px,0)";
        });
      },
      { passive: true },
    );
    document.documentElement.addEventListener("pointerleave", () => glow.classList.remove("on"));

    /* spotlight on tiles: follows the pointer exactly, no easing */
    let raf = 0, tx = null, px = 0, py = 0;
    document.addEventListener(
      "pointermove",
      (e) => {
        const t = e.target && e.target.closest ? e.target.closest(".card, .explore, .ab-tile") : null;
        if (!t) return;
        tx = t;
        px = e.clientX;
        py = e.clientY;
        if (raf) return;
        raf = requestAnimationFrame(() => {
          raf = 0;
          const r = tx.getBoundingClientRect();
          tx.style.setProperty("--mx", px - r.left + "px");
          tx.style.setProperty("--my", py - r.top + "px");
        });
      },
      { passive: true },
    );
  }

  /* lock page scroll while the mobile menu sheet is open */
  const navLinks = document.getElementById("navlinks");
  if (navLinks && typeof MutationObserver === "function") {
    new MutationObserver(() => document.documentElement.classList.toggle("nav-open", navLinks.classList.contains("open"))).observe(
      navLinks,
      { attributes: true, attributeFilter: ["class"] },
    );
  }

  /* nav stays put; it only gets a firmer look and a progress line while scrolling */
  const nav = document.querySelector("header.topnav");
  if (nav) {
    let ticking = false;
    window.addEventListener(
      "scroll",
      () => {
        if (ticking) return;
        ticking = true;
        requestAnimationFrame(() => {
          ticking = false;
          const y = window.scrollY || 0;
          const max = (document.documentElement.scrollHeight || 0) - window.innerHeight;
          nav.style.setProperty("--np", max > 40 ? Math.min(1, Math.max(0, y / max)).toFixed(3) : "0");
          nav.classList.toggle("scrolled", y > 24);
        });
      },
      { passive: true },
    );
  }

  /* the first page was already rendered by app.js before this file ran */
  try {
    const fcv = document.querySelector(".footer-fx");
    const fhost = document.querySelector(".global-footer");
    if (!reduced && fcv && fhost) startDots(fcv, fhost, { calm: false, arrival: false, rippleOnShow: true, alpha: 0.55, fade: footerFade });
    const root = $app();
    if (root && root.children.length) run();
  } catch (e) {}
})();
