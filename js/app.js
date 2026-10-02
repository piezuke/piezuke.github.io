/**
 * ===================================================================
 * piezuke_ — Core SPA Application Engine
 * ===================================================================
 * Manages client-side routing, view templates, markdown parsing,
 * obsidian-style nested notes vault, theme toggling, and page behaviors.
 */

/* ========================= CONFIG HELPERS =========================
 * All text, titles and slugs come from config.js. These helpers read it
 * safely (with fallbacks) so a missing key never breaks the page.
 */
function cfg(path, fallback) {
  let o = typeof CONFIG !== "undefined" ? CONFIG : undefined;
  for (const k of String(path).split(".")) {
    if (o == null || typeof o !== "object") return fallback;
    o = o[k];
  }
  return o == null ? fallback : o;
}

// "{n} entries" -> "3 entries".  {year} and {site} are always available.
function fmt(str, vars) {
  const v = Object.assign(
    { year: new Date().getFullYear(), site: cfg("site.name", "") },
    vars || {},
  );
  return String(str == null ? "" : str).replace(/\{(\w+)\}/g, (m, k) =>
    k in v ? v[k] : m,
  );
}
function fmtCount(n, many, one) {
  return fmt(n === 1 && one ? one : many, { n });
}

/* ---- routes / slugs ---- */
const DEFAULT_ROUTES = {
  home: "/",
  writeups: "/writeups",
  projects: "/projects",
  notes: "/notes",
  timeline: "/timeline",
  about: "/me",
};
const PAGE_KEYS = Object.keys(DEFAULT_ROUTES);

function routeOf(page) {
  const raw = String(cfg("routes." + page, DEFAULT_ROUTES[page] || "/")).trim();
  const clean = raw.replace(/^[#/]+|\/+$/g, "");
  return clean ? "/" + clean : "/";
}
function slugOf(page) {
  return routeOf(page).split("/")[1] || "";
}
// "#/writeups/my-post"
function hrefFor(page, ...rest) {
  const base = routeOf(page);
  const tail = rest.filter((x) => x != null && x !== "").join("/");
  if (base === "/") return "#/" + tail;
  return "#" + base + (tail ? "/" + tail : "");
}
function pageForSlug(slug) {
  if (!slug) return "home";
  for (const k of PAGE_KEYS) if (k !== "home" && slugOf(k) === slug) return k;
  const rd = cfg("routes.redirects", {});
  if (rd && rd[slug] && PAGE_KEYS.includes(rd[slug])) return rd[slug];
  return null;
}
function isNotesPath(p) {
  return (p || "").split("/")[1] === slugOf("notes");
}
function getNavLinks() {
  return cfg("nav.links", []).map((l) => ({
    label: l.label,
    route: l.route || routeOf(l.page),
  }));
}
function pageList(page) {
  if (page === "writeups") return typeof WRITEUPS !== "undefined" ? WRITEUPS : [];
  if (page === "projects") return typeof PROJECTS !== "undefined" ? PROJECTS : [];
  return [];
}
function avatarSrc(kind) {
  return cfg("site.avatar." + kind, "media/pfp." + kind);
}

/* ---- icon set for contact tiles (use  icon: "name"  in config) ---- */
const ICONS = {
  github: "<svg viewBox=\"0 0 24 24\" fill=\"currentColor\" width=\"22\" height=\"22\"><path d=\"M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z\"/></svg>",
  twitter: "<svg viewBox=\"0 0 24 24\" fill=\"currentColor\" width=\"22\" height=\"22\"><path d=\"M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z\"/></svg>",
  email: "<svg viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\" width=\"22\" height=\"22\"><path d=\"M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z\"></path><polyline points=\"22,6 12,13 2,6\"></polyline></svg>",
  ctftime: "<svg viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\" width=\"22\" height=\"22\"><path d=\"M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1z\"></path><line x1=\"4\" y1=\"22\" x2=\"4\" y2=\"15\"></line></svg>",
  discord: "<svg viewBox=\"0 0 24 24\" fill=\"currentColor\"><path d=\"M20.317 4.37a19.79 19.79 0 0 0-4.885-1.515.074.074 0 0 0-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 0 0-5.487 0 12.64 12.64 0 0 0-.617-1.25.077.077 0 0 0-.079-.037A19.74 19.74 0 0 0 3.677 4.37a.07.07 0 0 0-.032.027C.533 9.046-.32 13.58.099 18.057a.082.082 0 0 0 .031.057 19.9 19.9 0 0 0 5.993 3.03.078.078 0 0 0 .084-.028 14.2 14.2 0 0 0 1.226-1.994.076.076 0 0 0-.041-.106 13.1 13.1 0 0 1-1.872-.892.077.077 0 0 1-.008-.128c.126-.094.252-.192.372-.292a.074.074 0 0 1 .077-.01c3.928 1.793 8.18 1.793 12.062 0a.074.074 0 0 1 .078.01c.12.1.246.198.373.292a.077.077 0 0 1-.006.127 12.3 12.3 0 0 1-1.873.892.077.077 0 0 0-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 0 0 .084.028 19.84 19.84 0 0 0 6.002-3.03.077.077 0 0 0 .032-.054c.5-5.177-.838-9.674-3.549-13.66a.06.06 0 0 0-.031-.03zM8.02 15.33c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.956-2.419 2.157-2.419 1.21 0 2.176 1.095 2.157 2.42 0 1.333-.956 2.418-2.157 2.418zm7.975 0c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.955-2.419 2.157-2.419 1.21 0 2.176 1.095 2.157 2.42 0 1.333-.946 2.418-2.157 2.418z\"/></svg>",
  link: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" width="22" height="22"><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"></path><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"></path></svg>',
};

/* ========================= SANITIZATION & HELPERS ========================= */
const app = document.getElementById("app");

function escapeHTML(str) {
  if (str == null) return "";
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function sanitizeUrl(url) {
  if (!url) return "#";
  const u = String(url).trim();
  if (/^(?:https?:\/\/|\/|#|mailto:)/i.test(u)) {
    return escapeHTML(u);
  }
  return "#";
}

function contactHandle(href) {
  const h = String(href || "");
  if (h.startsWith("mailto:")) return h.slice(7);
  try {
    const u = new URL(h);
    const parts = u.pathname.split("/").filter(Boolean);
    return parts.length ? "@" + parts[parts.length - 1] : u.hostname;
  } catch (e) {
    return h;
  }
}

function contactTile(c) {
  const label = c.label || "";
  const handle = c.handle != null ? c.handle : c.url ? contactHandle(c.url) : "";
  const icon = c.iconSvg || ICONS[c.icon] || ICONS.link;
  const cls = "social-tile" + (c.wide ? " wide" : "");
  const inner = (go) => `
      <span class="social-ic" aria-hidden="true">${icon}</span>
      <span class="social-meta">
        <span class="social-label">${escapeHTML(label)}</span>
        <span class="social-handle">${escapeHTML(handle)}</span>
      </span>
      <span class="social-go" aria-hidden="true">${escapeHTML(go)}</span>`;
  const aria = `${escapeHTML(label)}: ${escapeHTML(handle)}`;

  if (c.copy != null) {
    return `<button type="button" class="${cls}" data-copy="${escapeHTML(c.copy)}" data-copied="${escapeHTML(c.copiedText || "copied ✓")}" aria-label="${aria}">${inner(c.hint || "click to copy")}</button>`;
  }
  const href = c.url || "#";
  const isMail = href.startsWith("mailto:");
  const targetAttr = isMail ? "" : ' target="_blank" rel="noopener noreferrer"';
  return `<a href="${sanitizeUrl(href)}" class="${cls}"${targetAttr} aria-label="${aria}">${inner(cfg("ui.arrow", "↗"))}</a>`;
}

// Copy-to-clipboard tiles (e.g. Discord). Works without inline handlers.
function setupCopyTiles() {
  document.querySelectorAll("[data-copy]").forEach((el) => {
    if (el.dataset.bound) return;
    el.dataset.bound = "1";
    el.addEventListener("click", async () => {
      const text = el.dataset.copy;
      try {
        await navigator.clipboard.writeText(text);
      } catch (e) {
        const ta = document.createElement("textarea");
        ta.value = text;
        ta.style.position = "fixed";
        ta.style.opacity = "0";
        document.body.appendChild(ta);
        ta.select();
        try {
          document.execCommand("copy");
        } catch (err) {}
        ta.remove();
      }
      const go = el.querySelector(".social-go");
      if (!go) return;
      const prev = el.dataset.hint || (el.dataset.hint = go.textContent);
      go.textContent = el.dataset.copied || "copied ✓";
      el.classList.add("copied");
      clearTimeout(el._t);
      el._t = setTimeout(() => {
        go.textContent = prev;
        el.classList.remove("copied");
      }, 1600);
    });
  });
}

function socialsHTML() {
  const list = cfg("pages.about.contacts", []);
  return `<div class="social-grid">${list.map(contactTile).join("")}</div>`;
}

/* ========================= THEME MANAGEMENT =========================
 * - Defaults to the visitor's OS preference until they pick a side.
 * - Once they click the switch, their choice is saved and wins.
 * - Follows OS changes live (only while no choice is saved).
 * - Syncs across open tabs.
 * - Circular reveal via the View Transitions API where supported;
 *   plain instant flip everywhere else / with reduced motion.
 * - Fires a "themechange" event so the canvas can re-colour at once.
 */
const darkMQ =
  typeof window.matchMedia === "function"
    ? window.matchMedia("(prefers-color-scheme: dark)")
    : null;

function readStoredTheme() {
  try {
    const v = localStorage.getItem("theme");
    return v === "light" || v === "dark" ? v : null;
  } catch (e) {
    return null;
  }
}

function systemTheme() {
  return darkMQ && !darkMQ.matches ? "light" : "dark";
}

function currentTheme() {
  return document.documentElement.getAttribute("data-theme") === "light"
    ? "light"
    : "dark";
}

const THEME_ICON_SUN =
  '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="4.2"></circle><path d="M12 2.5v2.4M12 19.1v2.4M2.5 12h2.4M19.1 12h2.4M5.3 5.3l1.7 1.7M17 17l1.7 1.7M5.3 18.7L7 17M17 7l1.7-1.7"></path></svg>';
const THEME_ICON_MOON =
  '<svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor" aria-hidden="true"><path d="M20.5 14.2A8.6 8.6 0 0 1 9.8 3.5a.6.6 0 0 0-.8-.7A9.6 9.6 0 1 0 21.2 15a.6.6 0 0 0-.7-.8z"></path></svg>';

function mountThemeSwitch() {
  const btn = document.getElementById("themebtn");
  if (!btn || btn.dataset.mounted) return;
  btn.dataset.mounted = "1";
  btn.className = "theme-switch";
  btn.setAttribute("role", "switch");
  btn.setAttribute("type", "button");
  btn.innerHTML =
    '<span class="ts-bg ts-bg-sun" aria-hidden="true">' +
    THEME_ICON_SUN +
    '</span><span class="ts-bg ts-bg-moon" aria-hidden="true">' +
    THEME_ICON_MOON +
    '</span><span class="ts-knob" aria-hidden="true"><span class="ts-ic ts-sun">' +
    THEME_ICON_SUN +
    '</span><span class="ts-ic ts-moon">' +
    THEME_ICON_MOON +
    "</span></span>";
}

function paintTheme(t) {
  const root = document.documentElement;
  root.setAttribute("data-theme", t);
  root.style.colorScheme = t;

  const meta = document.querySelector('meta[name="theme-color"]');
  if (meta) {
    const tc = cfg("site.themeColors", { dark: "#050505", light: "#f6f6f6" });
    meta.setAttribute("content", tc[t] || (t === "light" ? "#f6f6f6" : "#050505"));
  }

  const btn = document.getElementById("themebtn");
  if (btn) {
    btn.setAttribute("aria-checked", String(t === "dark"));
    btn.setAttribute("aria-label", cfg("ui.theme.label", "Dark mode"));
    btn.title =
      t === "dark"
        ? cfg("ui.theme.toLight", "Switch to light mode")
        : cfg("ui.theme.toDark", "Switch to dark mode");
  }

  const bttImg = document.getElementById("btt-img");
  if (bttImg)
    bttImg.src = t === "light" ? "media/top_dark.webp" : "media/top_light.webp";

  window.dispatchEvent(new CustomEvent("themechange", { detail: { theme: t } }));
}

/**
 * setTheme(t, { persist, origin })
 *  persist: save the choice (default true)
 *  origin:  {x, y} for the circular reveal
 */
function setTheme(t, opts) {
  t = t === "light" ? "light" : "dark";
  const { persist = true, origin = null } = opts || {};
  const root = document.documentElement;

  if (persist) {
    try {
      localStorage.setItem("theme", t);
    } catch (e) {}
  }
  if (t === currentTheme() && root.dataset.themeReady) {
    paintTheme(t);
    return;
  }

  const reduce =
    typeof window.matchMedia === "function" &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const canVT =
    !reduce &&
    origin &&
    typeof document.startViewTransition === "function" &&
    root.dataset.themeReady;

  const flip = () => {
    root.classList.add("theme-switching");
    paintTheme(t);
  };
  const done = () =>
    requestAnimationFrame(() =>
      requestAnimationFrame(() => root.classList.remove("theme-switching")),
    );

  if (!canVT) {
    flip();
    done();
    return;
  }

  try {
    const vt = document.startViewTransition(flip);
    vt.ready
      .then(() => {
        const { x, y } = origin;
        const r = Math.hypot(
          Math.max(x, window.innerWidth - x),
          Math.max(y, window.innerHeight - y),
        );
        root.animate(
          {
            clipPath: [
              `circle(0px at ${x}px ${y}px)`,
              `circle(${r}px at ${x}px ${y}px)`,
            ],
          },
          {
            duration: 520,
            easing: "cubic-bezier(0.16, 0.84, 0.44, 1)",
            pseudoElement: "::view-transition-new(root)",
          },
        );
      })
      .catch(() => {});
    vt.finished.then(done, done);
  } catch (e) {
    flip();
    done();
  }
}

mountThemeSwitch();
setTheme(readStoredTheme() || systemTheme(), { persist: false });
document.documentElement.dataset.themeReady = "1";

(function bindThemeSwitch() {
  const btn = document.getElementById("themebtn");
  if (btn) {
    btn.addEventListener("click", () => {
      const r = btn.getBoundingClientRect();
      setTheme(currentTheme() === "dark" ? "light" : "dark", {
        origin: { x: r.left + r.width / 2, y: r.top + r.height / 2 },
      });
    });
  }

  // Follow the OS only while the visitor hasn't made a choice.
  const onSystemChange = () => {
    if (!readStoredTheme()) setTheme(systemTheme(), { persist: false });
  };
  if (darkMQ) {
    if (darkMQ.addEventListener) darkMQ.addEventListener("change", onSystemChange);
    else if (darkMQ.addListener) darkMQ.addListener(onSystemChange);
  }

  // Keep multiple tabs in step.
  window.addEventListener("storage", (e) => {
    if (e.key === "theme") {
      setTheme(e.newValue === "light" || e.newValue === "dark" ? e.newValue : systemTheme(), {
        persist: false,
      });
    }
  });
})();

const burgerbtn = document.getElementById("burgerbtn");
if (burgerbtn) {
  burgerbtn.onclick = () => {
    const nav = document.getElementById("navlinks");
    if (nav) {
      const isOpen = nav.classList.toggle("open");
      burgerbtn.setAttribute("aria-expanded", String(isOpen));
    }
  };
}

// Mobile menu: tap outside or press Esc to close it.
document.addEventListener("click", (e) => {
  const nav = document.getElementById("navlinks");
  if (!nav || !nav.classList.contains("open")) return;
  if (e.target.closest("#navlinks") || e.target.closest("#burgerbtn")) return;
  nav.classList.remove("open");
  if (burgerbtn) burgerbtn.setAttribute("aria-expanded", "false");
});
document.addEventListener("keydown", (e) => {
  if (e.key !== "Escape") return;
  const nav = document.getElementById("navlinks");
  if (nav && nav.classList.contains("open")) {
    nav.classList.remove("open");
    if (burgerbtn) burgerbtn.setAttribute("aria-expanded", "false");
  }
});

/* ========================= ROUTER ========================= */

function parseHash() {
  const loc =
    typeof window !== "undefined" && window.location
      ? window.location
      : typeof location !== "undefined"
        ? location
        : null;
  const h = (loc && loc.hash ? loc.hash : "").replace(/^#/, "") || "/";
  const [rawPath, sub] = h.split("?");
  const segs = rawPath.split("/");
  if (segs[1]) {
    const pg = pageForSlug(segs[1]);
    if (pg && pg !== "home") segs[1] = slugOf(pg);
  }
  return { path: segs.join("/") || "/", sub };
}

window.addEventListener("hashchange", () => navigate());
let isInitialLoad = true;
let currentRoutePath = "";

function navigate() {
  const navlinks = document.getElementById("navlinks");
  if (navlinks) navlinks.classList.remove("open");
  if (burgerbtn) burgerbtn.setAttribute("aria-expanded", "false");

  const { path } = parseHash();
  const rootRoute = path.split("/")[1] ? "/" + path.split("/")[1] : "/";
  const canonicalRoute = (route) => {
    const segments = route.split("/");
    if (segments[1]) {
      const pg = pageForSlug(segments[1]);
      if (pg && pg !== "home") segments[1] = slugOf(pg);
    }
    return segments.join("/") || "/";
  };

  document.querySelectorAll("nav.links a").forEach((a) => {
    a.classList.toggle("active", canonicalRoute(a.dataset.route) === rootRoute);
  });

  // Toggle in-notes class to hide global footer during vault view
  document.body.classList.toggle("in-notes", isNotesPath(path));

  if (isInitialLoad) {
    isInitialLoad = false;
    currentRoutePath = path;
    render(path);
    window.scrollTo({ top: 0 });
    const l = document.getElementById("loader");
    const vid = document.getElementById("loader-video");
    if (vid) {
      try {
        vid.currentTime = 0;
        vid.play().catch(() => {});
      } catch (e) {}
    }
    setTimeout(() => {
      if (l) l.classList.add("hide");
      if (vid) {
        try {
          vid.pause();
        } catch (e) {}
      }
    }, 240);
    return;
  }

  // Seamless zero-loader navigation when switching between notes
  const isBetweenNotes =
    isNotesPath(currentRoutePath) && isNotesPath(path);
  currentRoutePath = path;

  if (isBetweenNotes) {
    const parts = path.split("/").filter(Boolean);
    const noteId = parts[1] || "";
    if (document.getElementById("noteswrap")) {
      updateActiveNoteInView(noteId);
      document.title = pageTitle([slugOf("notes"), noteId]);
      if (window.innerWidth <= 800) {
        const noteMain = document.getElementById("noteMain");
        if (noteMain) noteMain.scrollIntoView({ behavior: "smooth" });
        else window.scrollTo({ top: 0 });
      } else {
        window.scrollTo({ top: 0 });
      }
      return;
    } else {
      render(path);
      window.scrollTo({ top: 0 });
      return;
    }
  }

  showLoader(() => {
    render(path);
    window.scrollTo({ top: 0 });
  });
}

function showLoader(cb) {
  const l = document.getElementById("loader");
  const vid = document.getElementById("loader-video");
  const labels = cfg("ui.loader.labels", []);
  const lbl = document.getElementById("loaderlabel");
  if (lbl && labels.length)
    lbl.textContent = labels[Math.floor(Math.random() * labels.length)];
  if (l) l.classList.remove("hide");
  if (vid) {
    try {
      vid.currentTime = 0;
      vid.play().catch(() => {});
    } catch (e) {}
  }

  setTimeout(() => {
    cb();
    setTimeout(() => {
      if (l) l.classList.add("hide");
      if (vid) {
        try {
          vid.pause();
        } catch (e) {}
      }
    }, 120);
  }, 480);
}

let isFirstRender = true;

function pageTitle(parts) {
  // home: used as-is
  if (!parts[0]) return cfg("pages.home.title", cfg("site.name", "")) || cfg("site.brand", "");
  const tpl = cfg("site.titleTemplate", "{page} — {site}");
  const page = pageForSlug(parts[0]);
  if (!page || page === "home")
    return fmt(tpl, { page: cfg("pages.notFound.title", "Not found") });
  let label = cfg("pages." + page + ".title", page);
  if (parts[1]) {
    const item = pageList(page).find((x) => x.slug === parts[1]);
    if (item) label = item.title;
    else if (page === "notes") {
      const n = findNote(parts[1]);
      if (n) label = n.title;
    } else label = parts[1].charAt(0).toUpperCase() + parts[1].slice(1);
  }
  return fmt(tpl, { page: label });
}

function render(path) {
  try {
    const parts = path.split("/").filter(Boolean);
    let html = "";
    const page = parts.length ? pageForSlug(parts[0]) : "home";

    if (page === "home") html = viewHome();
    else if ((page === "writeups" || page === "projects") && parts[1])
      html = viewPost(pageList(page), parts[1], page);
    else if (page === "writeups" || page === "projects")
      html = viewList(pageList(page), page);
    else if (page === "notes") html = viewNotes(parts[1]);
    else if (page === "timeline") html = viewTimeline();
    else if (page === "about") html = viewAbout();
    else html = view404();

    if (app) app.innerHTML = `<div class="fade-route">${html}</div>`;
    document.title = pageTitle(parts);
    afterRender(path);
    if (!isFirstRender && app) {
      try {
        app.focus({ preventScroll: true });
      } catch (e) {}
    }
    isFirstRender = false;
  } catch (err) {
    console.error("Render error:", err);
    if (app) {
      app.innerHTML = `<div class="wrap" style="padding-top:100px; color:red;">
        <h2>${escapeHTML(cfg("ui.renderError", "Render Error"))}</h2>
        <pre style="background:var(--surface); padding:20px; border-radius:12px; white-space:pre-wrap;">${escapeHTML(err.stack || String(err))}</pre>
      </div>`;
    }
    const l = document.getElementById("loader");
    if (l) l.classList.add("hide");
  }
}

/* ========================= VIEW TEMPLATES ========================= */
function cardHTML(item, page) {
  const tagParts = (item.tag || "")
    .split("·")
    .map((t) => t.trim().toLowerCase())
    .filter(Boolean);
  return `<a class="card reveal-scale" href="${escapeHTML(hrefFor(page, item.slug))}" data-tags="${escapeHTML(tagParts.join(","))}">
    <div class="tag">${escapeHTML(item.tag)}</div>
    <h3>${escapeHTML(item.title)}</h3>
    <p>${escapeHTML(item.excerpt)}</p>
    ${item.pills ? `<div class="pillrow">${item.pills.map((p) => `<span class="pill">${escapeHTML(p)}</span>`).join("")}</div>` : ""}
    <div class="cf"><span>${escapeHTML(item.date)}</span><span class="card-arrow">${escapeHTML(cfg("ui.arrow", "↗"))}</span></div>
  </a>`;
}

function viewHome() {
  const H = cfg("pages.home", {});
  const hero = H.hero || {};
  const notesCount = getAllNotes().length;
  const counts = {
    writeups: pageList("writeups").length,
    projects: pageList("projects").length,
    notes: notesCount,
    timeline: cfg("pages.timeline.items", []).length,
  };
  const arrow = escapeHTML(cfg("ui.arrow", "↗"));
  const chips = Array.isArray(hero.chips) ? hero.chips : [];
  const avatarAlt = hero.avatarAlt != null ? hero.avatarAlt : cfg("site.brand", "");
  const heroTitle = hero.title != null ? hero.title : cfg("site.brand", "");

  const btnClass = { solid: "btn solid", outline: "btn", ghost: "btn ghost" };
  const buttons = (H.buttons || [])
    .map((b) => {
      const href = b.url ? sanitizeUrl(b.url) : escapeHTML(b.page ? hrefFor(b.page) : "#/");
      const ext = b.url && !/^#/.test(b.url) ? ' target="_blank" rel="noopener noreferrer"' : "";
      return `<a class="${btnClass[b.style] || "btn"}" href="${href}"${ext}>${escapeHTML(b.label)}</a>`;
    })
    .join("");

  const exploreCards = ((H.explore && H.explore.cards) || [])
    .map((c) => {
      const n = counts[c.page] != null ? counts[c.page] : 0;
      return `<a class="explore reveal-scale" href="${escapeHTML(hrefFor(c.page))}"><div class="ex-top"><span>${escapeHTML(fmtCount(n, c.count || "{n}", c.countOne))}</span><span class="card-arrow">${arrow}</span></div><h3>${escapeHTML(c.title)}</h3><p>${escapeHTML(c.text)}</p></a>`;
    })
    .join("");

  const latest = H.latest || {};
  const latestBlock = (page) => {
    const L = latest[page];
    if (!L || L.show === false) return "";
    const list = pageList(page);
    const how = Math.max(1, parseInt(latest.count, 10) || 2);
    const empties = (L.empty || [])
      .map((e) => `<div class="empty-card reveal-scale"><b>${escapeHTML(e.title)}</b>${escapeHTML(e.text)}</div>`)
      .join("");
    return `
  <section class="wrap tight">
    <div class="sechead reveal"><h2>${escapeHTML(L.heading)}</h2><a href="${escapeHTML(hrefFor(page))}">${escapeHTML(L.viewAll || "")}</a></div>
    ${
      list.length
        ? `<div class="grid">${list.slice(0, how).map((w) => cardHTML(w, page)).join("")}</div>`
        : `<div class="grid">${empties}</div>`
    }
  </section>`;
  };

  return `
  <section class="hero wrap">
    <div class="hero-content">
      <div class="hero-text">
        ${hero.status ? `<div class="hero-status reveal">${escapeHTML(hero.status)}</div>` : ""}
        <h1 class="reveal" id="glitch">${escapeHTML(heroTitle)}</h1>
        <div class="hero-role reveal" id="hero-role" aria-live="off"><span class="prompt">&gt;</span><span id="hero-role-text"></span><span class="caret" aria-hidden="true"></span></div>
        ${hero.subtitle ? `<p class="reveal hero-subtitle">${escapeHTML(hero.subtitle)}</p>` : ""}
        ${buttons ? `<div class="cta reveal">${buttons}</div>` : ""}
      </div>
      <div class="hero-avatar reveal-scale">
        <picture>
          <source srcset="${escapeHTML(avatarSrc("webp"))}" type="image/webp">
          <img class="hero-avatar-img" src="${escapeHTML(avatarSrc("jpg"))}" alt="${escapeHTML(avatarAlt)}" loading="eager" fetchpriority="high" width="420" height="420">
        </picture>
        ${chips.slice(0, 3).map((c) => `<span class="hero-chip" aria-hidden="true">${escapeHTML(c)}</span>`).join("")}
      </div>
    </div>
  </section>

  ${
    exploreCards
      ? `<section class="wrap tight">
    <div class="sechead reveal"><h2>${escapeHTML((H.explore && H.explore.heading) || "")}</h2></div>
    <div class="explore-grid">${exploreCards}</div>
  </section>`
      : ""
  }

  ${latestBlock("writeups")}
  ${latestBlock("projects")}
`;
}

function viewList(arr, page) {
  const P = cfg("pages." + page, {});
  const allTags = [
    ...new Set(
      arr.flatMap((i) =>
        (i.tag || "")
          .split("·")
          .map((t) => t.trim().toLowerCase())
          .filter(Boolean),
      ),
    ),
  ];
  return `
  <section class="wrap" style="padding-top:50px;">
    <div class="eyebrow reveal">${escapeHTML(fmtCount(arr.length, P.entries || "{n}", P.entriesOne))}</div>
    <h1 class="reveal" style="font-size:clamp(46.9px,7.8vw,81.2px); margin:12px 0 8px;">${escapeHTML(P.heading)}</h1>
    <p class="reveal" style="color:var(--muted); max-width:520px; margin-bottom:28px;">${escapeHTML(P.subtitle)}</p>
    ${
      allTags.length > 1
        ? `<div class="filterbar reveal" id="filterbar">
      <button class="chip active" data-filter="all">${escapeHTML(P.filterAll || "all")}</button>
      ${allTags.map((t) => `<button class="chip" data-filter="${escapeHTML(t)}">${escapeHTML(t)}</button>`).join("")}
    </div>`
        : ""
    }
    ${
      arr.length === 0
        ? `<div style="padding:60px 0; color:var(--dim); font-family:var(--mono);">${escapeHTML(P.empty)}</div>`
        : `<div class="grid" id="cardgrid">${arr.map((i) => cardHTML(i, page)).join("")}</div>`
    }
    <p id="filter-empty" class="palette-empty" style="display:none;">${escapeHTML(P.noMatch)}</p>
  </section>
  `;
}

function mdToHtmlWithOutline(md) {
  if (typeof marked === "undefined") {
    return { html: escapeHTML(md), outline: [] };
  }
  const tokens = marked.lexer(md);
  const outline = [];
  let counter = 0;
  tokens.forEach((t) => {
    if (t.type === "heading" && (t.depth === 2 || t.depth === 3)) {
      counter++;
      const id =
        "h-" +
        counter +
        "-" +
        t.text
          .toLowerCase()
          .replace(/[^a-z0-9]+/g, "-")
          .replace(/(^-|-$)/g, "");
      t.id = id;
      outline.push({ id, text: t.text, depth: t.depth });
    }
  });

  const renderer = new marked.Renderer();
  const sanitizeMarkdownUrl = (raw, isImage = false) => {
    const href = String(raw || "")
      .trim()
      .replace(/[\u0000-\u0020\u007f]/g, "");
    const hasScheme = /^[a-z][a-z\d+.-]*:/i.test(href);
    const allowedScheme = isImage
      ? /^https?:/i.test(href)
      : /^(https?:|mailto:|tel:)/i.test(href);
    return hasScheme && !allowedScheme ? "" : href;
  };

  renderer.html = (arg) => {
    const text = typeof arg === "object" ? arg.text : arg;
    return escapeHTML(text);
  };

  // Headings are consumed in document order, so hand out outline ids in the same
  // order. (Matching by text broke on duplicate headings and headings with `code`.)
  let headingCursor = 0;
  renderer.heading = function (arg1, arg2) {
    const isObj = typeof arg1 === "object";
    const level = isObj ? arg1.depth : arg2;
    const text = isObj
      ? this && this.parser && arg1.tokens
        ? this.parser.parseInline(arg1.tokens)
        : escapeHTML(arg1.text)
      : arg1;
    let idAttr = "";
    if (level === 2 || level === 3) {
      const o = outline[headingCursor++];
      if (o) idAttr = ` id="${o.id}"`;
    }
    return `<h${level}${idAttr}>${text}</h${level}>`;
  };

  renderer.link = (arg1, arg2, arg3) => {
    const href = typeof arg1 === "object" ? arg1.href : arg1;
    const title = typeof arg1 === "object" ? arg1.title : arg2;
    const text = typeof arg1 === "object" ? arg1.text : arg3;
    const cleanHref = sanitizeMarkdownUrl(href);
    if (!cleanHref) return text || "";
    const isExternal = /^(https?:)?\/\//i.test(cleanHref);
    const relAttr = isExternal
      ? ' rel="noopener noreferrer" target="_blank"'
      : "";
    const titleAttr = title ? ` title="${escapeHTML(title)}"` : "";
    return `<a href="${escapeHTML(cleanHref)}"${titleAttr}${relAttr}>${text}</a>`;
  };

  renderer.image = (arg1, arg2, arg3) => {
    const href = typeof arg1 === "object" ? arg1.href : arg1;
    const title = typeof arg1 === "object" ? arg1.title : arg2;
    const text = typeof arg1 === "object" ? arg1.text : arg3;
    const cleanHref = sanitizeMarkdownUrl(href, true);
    if (!cleanHref) return "";
    const titleAttr = title ? ` title="${escapeHTML(title)}"` : "";
    return `<img src="${escapeHTML(cleanHref)}" alt="${escapeHTML(text || "")}"${titleAttr} loading="lazy" decoding="async">`;
  };

  const html = marked.parser(tokens, { renderer });
  return { html, outline };
}

function viewPost(arr, slug, page) {
  const item = arr.find((x) => x.slug === slug);
  if (!item) return view404();
  const P = cfg("pages." + page, {});
  const PO = cfg("pages.post", {});
  const { html, outline } = mdToHtmlWithOutline(item.body);
  const wordCount = (item.body || "").split(/\s+/).length;
  const readTime = Math.max(1, Math.round(wordCount / 200));
  const suggestions = arr
    .filter((x) => x.slug !== slug)
    .sort(() => 0.5 - Math.random())
    .slice(0, 2);
  const authorName = (PO.author && PO.author.name) || cfg("site.brand", "");
  const authorTag = (PO.author && PO.author.tagline) || cfg("pages.about.heading", "");

  return `
  <div class="wrap" style="padding-top:26px;">
    <a href="${escapeHTML(hrefFor(page))}" style="font-family:var(--mono); font-size:18.8px; color:var(--muted);">${escapeHTML(P.backLabel)}</a>
    <div class="postlayout">
      ${
        outline.length > 0
          ? `
      <aside class="outline" id="outline">
        <div class="otitle">${escapeHTML(PO.outlineTitle)}</div>
        ${outline.map((o) => `<a href="#${escapeHTML(o.id)}" class="${o.depth === 3 ? "h3" : ""}" data-target="${escapeHTML(o.id)}">${escapeHTML(o.text)}</a>`).join("")}
      </aside>`
          : "<div></div>"
      }
      <article>
        <div class="article-head">
          <div class="eyebrow">${escapeHTML(item.tag)}</div>
          <h1>${escapeHTML(item.title)}</h1>
          <div class="metarow"><span>${escapeHTML(item.date)}</span><span>${escapeHTML(fmt(PO.readTime || "{n} min read", { n: readTime }))}</span></div>
        </div>
        <div class="article-body" id="articlebody">${html}</div>
      </article>
      <aside class="right-panel">
        <div class="author-card">
          <picture>
            <source srcset="${escapeHTML(avatarSrc("webp"))}" type="image/webp">
            <img src="${escapeHTML(avatarSrc("jpg"))}" alt="${escapeHTML(authorName)}" loading="lazy" width="90" height="90" style="width:90px; height:90px; border-radius:50%; margin-bottom:14px; border:2px solid var(--border-strong); object-fit:cover;">
          </picture>
          <div style="font-size:24px; font-weight:800; margin-bottom:6px;">${escapeHTML(authorName)}</div>
          <p style="color:var(--muted); font-size:15px; line-height:1.4;">${escapeHTML(authorTag)}</p>
        </div>
        ${
          suggestions.length
            ? `<div class="suggestions">
          <div class="otitle" style="color:var(--dim); letter-spacing:.14em; font-size:16.4px; margin-bottom:14px; font-family:var(--mono); text-transform:uppercase;">${escapeHTML(PO.suggestedTitle)}</div>
          ${suggestions
            .map(
              (s) => `
            <a href="${escapeHTML(hrefFor(page, s.slug))}" class="sug-card">
              <h4>${escapeHTML(s.title)}</h4>
              <p>${escapeHTML(s.date)}</p>
            </a>
          `,
            )
            .join("")}
        </div>`
            : ""
        }
      </aside>
    </div>
  </div>
  `;
}

function viewTimeline() {
  const T = cfg("pages.timeline", {});
  return `
  <section class="wrap" style="padding-top:50px;">
    <div class="eyebrow reveal">${escapeHTML(T.eyebrow)}</div>
    <h1 class="reveal" style="font-size:clamp(46.9px,7.8vw,81.2px); margin:12px 0 8px;">${escapeHTML(T.heading)}</h1>
    ${T.subtitle ? `<p class="reveal" style="color:var(--muted); max-width:520px; margin-bottom:44px;">${escapeHTML(T.subtitle)}</p>` : ""}
    <div class="tl">
      ${(T.items || []).map(
        (t) => `<div class="tlitem reveal-left">
        <div class="tldate">${escapeHTML(t.date)}</div>
        <h3>${escapeHTML(t.title)}</h3>
        <p>${escapeHTML(t.body)}</p>
      </div>`,
      ).join("")}
    </div>
  </section>
  `;
}

function viewAbout() {
  const A = cfg("pages.about", {});
  const M = cfg("music", {});
  const MC = M.controls || {};
  const ST = M.status || {};
  const playlist = typeof PLAYLIST !== "undefined" ? PLAYLIST : [];
  const musicHeading = escapeHTML(M.heading);
  const avatarAlt = cfg("site.brand", "");
  return `
  <section class="wrap" style="padding-top:50px;">
    <div class="about-header reveal">
      <picture>
        <source srcset="${escapeHTML(avatarSrc("webp"))}" type="image/webp">
        <img class="about-header-img" src="${escapeHTML(avatarSrc("jpg"))}" alt="${escapeHTML(avatarAlt)}" loading="lazy" width="120" height="120">
      </picture>
      <div class="about-header-text">
        <div class="eyebrow">${escapeHTML(A.eyebrow)}</div>
        <h1>${escapeHTML(A.heading)}</h1>
      </div>
    </div>

    <div class="about-grid">
      <aside class="about-sidebar reveal">
        ${playlist.length === 0 ? `<div class="empty-music">${escapeHTML(M.emoji || "")} ${musicHeading}<br><span style="font-size:15px">${escapeHTML(M.emptyText)}</span></div>` : `<div class="music-widget" id="music-widget">
          <div class="mw-header">
            <div class="mw-label">
              <span>${musicHeading}</span>
            </div>
            <div class="mw-bars" id="mw-bars"></div>
          </div>

          <div class="mw-track-info">
            <div class="mw-art">
              <svg class="mw-art-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8">
                <circle cx="12" cy="12" r="10"></circle>
                <circle cx="12" cy="12" r="3"></circle>
                <line x1="12" y1="2" x2="12" y2="5"></line>
                <line x1="12" y1="19" x2="12" y2="22"></line>
              </svg>
            </div>
            <div class="mw-meta">
              <div class="mw-title" id="mw-title">${escapeHTML(playlist[0]?.title || M.noTrack)}</div>
              <div class="mw-artist" id="mw-artist">${escapeHTML(playlist[0]?.artist || M.unknownArtist)}</div>
            </div>
          </div>

          <div class="mw-progress-wrap">
            <div class="mw-timeline" id="mw-timeline">
              <div class="mw-progress-bar" id="mw-progress-bar"></div>
            </div>
            <div class="mw-time-row">
              <span id="mw-current-time">0:00</span>
              <span id="mw-total-time">0:00</span>
            </div>
          </div>

          <div class="mw-controls">
            <button class="mw-btn" id="mw-prev-btn" aria-label="${escapeHTML(MC.prev)}" title="${escapeHTML(MC.prevTitle)}">
              <svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor"><path d="M6 6h2v12H6zm3.5 6l8.5 6V6z"/></svg>
            </button>
            <button class="mw-btn mw-play" id="mw-play-btn" aria-label="${escapeHTML(MC.playPause)}" title="${escapeHTML(MC.playTitle)}">
              <svg id="mw-play-icon" viewBox="0 0 24 24" width="18" height="18" fill="currentColor"><path d="M8 5v14l11-7z"/></svg>
              <svg id="mw-pause-icon" viewBox="0 0 24 24" width="18" height="18" fill="currentColor" style="display:none;"><path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z"/></svg>
            </button>
            <button class="mw-btn" id="mw-next-btn" aria-label="${escapeHTML(MC.next)}" title="${escapeHTML(MC.nextTitle)}">
              <svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor"><path d="M6 18l8.5-6L6 6v12zM16 6v12h2V6h-2z"/></svg>
            </button>
          </div>

          <div class="mw-playlist">
            <div class="mw-playlist-head">${escapeHTML(M.tracklistHeading)}</div>
            <div class="mw-tracklist" id="mw-tracklist">
              ${playlist
                .map(
                  (t, idx) => `
                <div class="mw-track-item ${idx === 0 ? "active" : ""}" data-idx="${idx}">
                  <div class="mw-track-left">
                    <span class="mw-track-num">${String(idx + 1).padStart(2, "0")}</span>
                    <span class="mw-track-name">${escapeHTML(t.title)}</span>
                  </div>
                  <span class="mw-track-status">${idx === 0 ? escapeHTML(ST.ready || "") : ""}</span>
                </div>
              `,
                )
                .join("")}
            </div>
          </div>
        </div>`}
      </aside>

      <div class="about-main reveal-left" style="grid-column:auto;">
        <p class="about-bio">${escapeHTML(A.bio)}</p>

        <div class="about-block">
          <div class="about-subhead">${escapeHTML(A.interestsHeading)}</div>
          <div class="pillgrid">
            ${(A.skills || []).map((s) => `<div class="pill">${escapeHTML(s)}</div>`).join("")}
          </div>
        </div>

        <div class="about-block">
          <div class="about-subhead">${escapeHTML(A.socialsHeading)}</div>
          ${socialsHTML()}
        </div>
      </div>
    </div>
  </section>
  `;
}

function view404() {
  const N = cfg("pages.notFound", {});
  return `<div class="wrap" style="padding-top:100px;"><h2>${escapeHTML(N.heading || "404 Not Found")}</h2><p>${escapeHTML(N.text || "")}</p></div>`;
}

/* ========================= NOTES VAULT ========================= */
function getAllNotes(
  tree = typeof NOTES_TREE !== "undefined" ? NOTES_TREE : [],
) {
  let list = [];
  if (!tree || !Array.isArray(tree)) return list;
  for (const node of tree) {
    if (node.notes && Array.isArray(node.notes)) {
      list.push(...node.notes);
    }
    if (node.folders && Array.isArray(node.folders)) {
      list.push(...getAllNotes(node.folders));
    }
  }
  return list;
}

function findNote(id) {
  return getAllNotes().find((n) => n.id === id) || null;
}

const userFolderStates = {}; // folderPath -> boolean (true: collapsed, false: expanded)

function getNotesSidebarWidth() {
  try {
    const w = parseInt(localStorage.getItem("piezuke_notes_sidebar_w"), 10);
    if (!isNaN(w) && w >= 180 && w <= 750) return w;
  } catch (e) {}
  return 280;
}

function countNotesInNode(node) {
  let count = node.notes && Array.isArray(node.notes) ? node.notes.length : 0;
  if (node.folders && Array.isArray(node.folders)) {
    for (const f of node.folders) count += countNotesInNode(f);
  }
  return count;
}

function renderNoteTree(nodes, activeIdReal, depth = 0, parentPath = "") {
  if (!nodes || !Array.isArray(nodes)) return "";
  return nodes
    .map((node) => {
      const folderName = node.folder || node.name || cfg("pages.notes.unnamedFolder", "folder");
      const subfolders = node.folders || [];
      const notes = node.notes || [];
      const currentPath = parentPath
        ? parentPath + "/" + folderName
        : folderName;
      const totalNotesCount = countNotesInNode(node);

      const containsActive = (function checkActive(n) {
        if (n.notes && n.notes.some((note) => note.id === activeIdReal))
          return true;
        if (n.folders && n.folders.some(checkActive)) return true;
        return false;
      })(node);

      const isCollapsed = containsActive
        ? false
        : userFolderStates[currentPath] !== undefined
          ? userFolderStates[currentPath]
          : false;
      const subfoldersHtml = renderNoteTree(
        subfolders,
        activeIdReal,
        depth + 1,
        currentPath,
      );
      const notesHtml = notes
        .map(
          (n) => `
      <a href="${escapeHTML(hrefFor("notes", n.id))}" class="notenode ${n.id === activeIdReal ? "active" : ""}">
        <span class="note-icon">${escapeHTML(cfg("pages.notes.icons.note", "📄"))}</span>
        <span class="note-title-text">${escapeHTML(n.title)}</span>
      </a>
    `,
        )
        .join("");

      return `
      <div class="folder-group ${isCollapsed ? "collapsed" : ""}" data-folder-path="${escapeHTML(currentPath)}">
        <div class="folder" onclick="toggleFolder(this)" onkeydown="if(event.key==='Enter'||event.key===' '){event.preventDefault();toggleFolder(this);}" role="button" tabindex="0" aria-expanded="${!isCollapsed}">
          <span class="folder-arrow">▾</span>
          <span class="folder-icon">${escapeHTML(isCollapsed ? cfg("pages.notes.icons.folderClosed", "📁") : cfg("pages.notes.icons.folderOpen", "📂"))}</span>
          <span class="folder-name">${escapeHTML(folderName)}</span>
          ${totalNotesCount > 0 ? `<span class="folder-badge">${totalNotesCount}</span>` : ""}
        </div>
        <div class="folder-children">
          ${subfoldersHtml}
          ${notesHtml}
        </div>
      </div>
    `;
    })
    .join("");
}

function toggleFolder(el) {
  const group = el.closest(".folder-group");
  if (!group) return;
  const path = group.dataset.folderPath || "";
  const isNowCollapsed = !group.classList.contains("collapsed");
  group.classList.toggle("collapsed", isNowCollapsed);
  el.setAttribute("aria-expanded", !isNowCollapsed);
  const icon = group.querySelector(":scope > .folder .folder-icon");
  if (icon) icon.textContent = isNowCollapsed ? cfg("pages.notes.icons.folderClosed", "📁") : cfg("pages.notes.icons.folderOpen", "📂");
  userFolderStates[path] = isNowCollapsed;
}

function toggleAllFolders(expand) {
  const groups = document.querySelectorAll(".notetree .folder-group");
  groups.forEach((g) => {
    g.classList.toggle("collapsed", !expand);
    const path = g.dataset.folderPath || "";
    userFolderStates[path] = !expand;
    const btn = g.querySelector(":scope > .folder");
    if (btn) btn.setAttribute("aria-expanded", String(expand));
    const icon = g.querySelector(":scope > .folder .folder-icon");
    if (icon) icon.textContent = expand ? cfg("pages.notes.icons.folderOpen", "📂") : cfg("pages.notes.icons.folderClosed", "📁");
  });
}

function initNotesResizer() {
  const resizer = document.getElementById("notetree-resizer");
  const wrap = document.getElementById("noteswrap");
  if (!resizer || !wrap) return;

  const currentW = getNotesSidebarWidth();
  wrap.style.setProperty("--notes-sidebar-w", currentW + "px");

  let isDragging = false;
  let startX = 0;
  let startW = currentW;

  const onPointerDown = (e) => {
    isDragging = true;
    startX = e.clientX;
    const tree = document.getElementById("notetree");
    startW = tree ? tree.getBoundingClientRect().width : getNotesSidebarWidth();
    document.body.classList.add("resizing-sidebar");
    resizer.classList.add("active");
    try {
      resizer.setPointerCapture(e.pointerId);
    } catch (err) {}
    e.preventDefault();
  };

  const onPointerMove = (e) => {
    if (!isDragging) return;
    const delta = e.clientX - startX;
    const minW = 180;
    const maxW = Math.min(window.innerWidth * 0.65, 750);
    const newW = Math.max(minW, Math.min(maxW, Math.round(startW + delta)));
    wrap.style.setProperty("--notes-sidebar-w", newW + "px");
    try {
      localStorage.setItem("piezuke_notes_sidebar_w", newW);
    } catch (err) {}
  };

  const onPointerUp = (e) => {
    if (!isDragging) return;
    isDragging = false;
    document.body.classList.remove("resizing-sidebar");
    resizer.classList.remove("active");
    try {
      resizer.releasePointerCapture(e.pointerId);
    } catch (err) {}
  };

  resizer.addEventListener("pointerdown", onPointerDown);
  resizer.addEventListener("pointermove", onPointerMove);
  resizer.addEventListener("pointerup", onPointerUp);
  resizer.addEventListener("pointercancel", onPointerUp);

  resizer.addEventListener("dblclick", () => {
    wrap.style.setProperty("--notes-sidebar-w", "280px");
    try {
      localStorage.removeItem("piezuke_notes_sidebar_w");
    } catch (err) {}
  });
}

function renderNotesOutline(outline) {
  if (!outline || outline.length === 0) return "";
  return `
    <div style="margin-top:40px; border-top:1px solid var(--border); padding-top:20px;" class="outline">
      <div class="folder" style="cursor:default;">${escapeHTML(cfg("pages.notes.outlineTitle", ""))}</div>
      ${outline.map((o) => `<a href="#${escapeHTML(o.id)}" class="notenode" data-target="${escapeHTML(o.id)}" style="${o.depth === 3 ? "padding-left:24px; font-size:0.9em;" : ""}">${escapeHTML(o.text)}</a>`).join("")}
    </div>`;
}

function viewNotes(activeId) {
  const allNotes = getAllNotes();
  const active = activeId ? findNote(activeId) : allNotes[0] || null;
  const activeIdReal = active ? active.id : "";
  let body = active
    ? active.body
    : cfg("pages.notes.emptyBody", "");

  // Support Obsidian-style [[Wiki Links]]
  body = body.replace(/\[\[([^\]]+)\]\]/g, (m, name) => {
    const target = allNotes.find(
      (n) => n.title.toLowerCase() === name.toLowerCase(),
    );
    return target ? `[${name}](${hrefFor("notes", target.id)})` : name;
  });

  const { html, outline } = mdToHtmlWithOutline(body);
  const notesTreeData = typeof NOTES_TREE !== "undefined" ? NOTES_TREE : [];

  return `
  <div class="noteswrap" id="noteswrap" style="--notes-sidebar-w: ${getNotesSidebarWidth()}px;">
    <div class="notetree" id="notetree">
      <div class="notetree-header">
        <span class="notetree-header-title">${escapeHTML(cfg("pages.notes.vaultTitle", ""))}</span>
        <div class="notetree-header-actions">
          <button class="notetree-act-btn" onclick="toggleAllFolders(true)" title="${escapeHTML(cfg("pages.notes.expandAll", ""))}" aria-label="${escapeHTML(cfg("pages.notes.expandAll", ""))}">${escapeHTML(cfg("pages.notes.expandIcon", "⊞"))}</button>
          <button class="notetree-act-btn" onclick="toggleAllFolders(false)" title="${escapeHTML(cfg("pages.notes.collapseAll", ""))}" aria-label="${escapeHTML(cfg("pages.notes.collapseAll", ""))}">${escapeHTML(cfg("pages.notes.collapseIcon", "⊟"))}</button>
        </div>
      </div>
      <div class="notetree-items">
        ${renderNoteTree(notesTreeData, activeIdReal, 0, "")}
      </div>

      <div id="notetree-outline-wrap">
        ${renderNotesOutline(outline)}
      </div>

      <div class="notetree-footer">
        <span class="notetree-footer-status">${escapeHTML(fmt(cfg("pages.notes.status", "{n}"), { n: allNotes.length }))}</span>
        <span class="notetree-footer-badge">${escapeHTML(cfg("pages.notes.badge", ""))}</span>
      </div>
    </div>
    <div class="notetree-resizer" id="notetree-resizer" role="separator" aria-orientation="vertical" title="${escapeHTML(cfg("pages.notes.resizerTitle", ""))}"></div>
    <div class="noteMain" id="noteMain">
      <div class="article-body reveal in-view">${html}</div>
    </div>
  </div>`;
}

function updateActiveNoteInView(activeId) {
  const allNotes = getAllNotes();
  const active = activeId ? findNote(activeId) : allNotes[0] || null;
  const activeIdReal = active ? active.id : "";
  let body = active
    ? active.body
    : cfg("pages.notes.emptyBody", "");

  body = body.replace(/\[\[([^\]]+)\]\]/g, (m, name) => {
    const target = allNotes.find(
      (n) => n.title.toLowerCase() === name.toLowerCase(),
    );
    return target ? `[${name}](${hrefFor("notes", target.id)})` : name;
  });

  const { html, outline } = mdToHtmlWithOutline(body);

  // 1. Update Note Content with smooth instant transition
  const noteMain =
    document.getElementById("noteMain") || document.querySelector(".noteMain");
  if (noteMain) {
    noteMain.innerHTML = `<div class="article-body reveal in-view fade-note">${html}</div>`;
  }

  // 2. Update Outline in Sidebar
  const outlineWrap = document.getElementById("notetree-outline-wrap");
  if (outlineWrap) {
    outlineWrap.innerHTML = renderNotesOutline(outline);
  }

  // 3. Update Active Note Link & Expand Parent Folders in Sidebar
  const tree = document.getElementById("notetree");
  if (tree) {
    tree.querySelectorAll(".notetree-items .notenode").forEach((node) => {
      const isTarget = node.getAttribute("href") === hrefFor("notes", activeIdReal);
      node.classList.toggle("active", isTarget);
      if (isTarget) {
        let parent = node.closest(".folder-group");
        while (parent) {
          if (parent.classList.contains("collapsed")) {
            parent.classList.remove("collapsed");
            const p = parent.dataset.folderPath || "";
            userFolderStates[p] = false;
            const btn = parent.querySelector(":scope > .folder");
            if (btn) btn.setAttribute("aria-expanded", "true");
            const icon = parent.querySelector(":scope > .folder .folder-icon");
            if (icon) icon.textContent = cfg("pages.notes.icons.folderOpen", "📂");
          }
          parent = parent.parentElement
            ? parent.parentElement.closest(".folder-group")
            : null;
        }
        try {
          node.scrollIntoView({ block: "nearest", behavior: "smooth" });
        } catch (e) {}
      }
    });
  }

  // 4. Re-bind listeners for code copy, outline links, and reveal animations
  setupOutlineListeners();
  setupCodeCopy();
  setupReveal();
}

/* ========================= POST-RENDER BEHAVIORS ========================= */
let observer;

const bttBtn = document.getElementById("btt-btn");
if (bttBtn) {
  let bttScrollTicking = false;
  function updateBttBtn() {
    if (window.scrollY > 300) {
      bttBtn.classList.remove("pointing-down");
      bttBtn.title = cfg("ui.backToTop.top", "Back to top");
    } else {
      bttBtn.classList.add("pointing-down");
      bttBtn.title = cfg("ui.backToTop.bottom", "Scroll to bottom");
    }
    bttScrollTicking = false;
  }

  window.addEventListener(
    "scroll",
    () => {
      if (!bttScrollTicking) {
        bttScrollTicking = true;
        requestAnimationFrame(updateBttBtn);
      }
    },
    { passive: true },
  );

  bttBtn.onclick = () => {
    if (window.scrollY > 300) {
      window.scrollTo({ top: 0, behavior: "smooth" });
    } else {
      window.scrollTo({ top: document.body.scrollHeight, behavior: "smooth" });
    }
  };

  bttBtn.addEventListener("keydown", (e) => {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      bttBtn.click();
    }
  });

  if (window.scrollY <= 300) {
    bttBtn.classList.add("pointing-down");
    bttBtn.title = cfg("ui.backToTop.bottom", "Scroll to bottom");
  }
}

function setupReveal() {
  const els = document.querySelectorAll(".reveal, .reveal-left, .reveal-scale");
  if (typeof IntersectionObserver === "undefined") {
    els.forEach((el) => el.classList.add("in-view"));
    return;
  }
  if (observer) observer.disconnect();
  observer = new IntersectionObserver(
    (entries) => {
      entries.forEach((e) => {
        if (e.isIntersecting) {
          e.target.classList.add("in-view");
          observer.unobserve(e.target); // reveal once; avoids flicker + stuck-hidden tall blocks
        }
      });
    },
    { threshold: 0.05, rootMargin: "0px 0px -6% 0px" },
  );
  els.forEach((el) => observer.observe(el));
}

let scrollHandler = null;
let progressTicking = false;

function setupProgress(articleId) {
  const bar = document.getElementById("progress");
  if (scrollHandler) window.removeEventListener("scroll", scrollHandler);
  if (!bar) return;
  if (!articleId) {
    bar.style.display = "none";
    return;
  }
  bar.style.display = "block";
  const article = document.getElementById(articleId);
  if (!article) return;

  const headings = Array.from(article.querySelectorAll("h2[id], h3[id]"));
  const outlineLinks = Array.from(document.querySelectorAll(".outline a"));

  function updateProgress() {
    const rect = article.getBoundingClientRect();
    const total = article.offsetHeight - window.innerHeight + 200;
    const scrolled = -rect.top + 200;
    const pct = Math.min(100, Math.max(0, (scrolled / total) * 100));
    bar.style.width = pct + "%";

    let currentId = null;
    for (let i = 0; i < headings.length; i++) {
      if (headings[i].getBoundingClientRect().top < 120)
        currentId = headings[i].id;
    }
    for (let i = 0; i < outlineLinks.length; i++) {
      outlineLinks[i].classList.toggle(
        "active",
        outlineLinks[i].dataset.target === currentId,
      );
    }
    progressTicking = false;
  }

  scrollHandler = () => {
    if (!progressTicking) {
      progressTicking = true;
      requestAnimationFrame(updateProgress);
    }
  };
  window.addEventListener("scroll", scrollHandler, { passive: true });
  updateProgress();
}

function setupCodeCopy() {
  document.querySelectorAll(".article-body pre").forEach((pre) => {
    if (pre.querySelector(".code-copy")) return;
    const btn = document.createElement("button");
    btn.className = "code-copy";
    btn.type = "button";
    btn.textContent = cfg("ui.code.copy", "copy");
    btn.setAttribute("aria-label", cfg("ui.code.label", "Copy code to clipboard"));
    btn.onclick = async () => {
      const code = pre.querySelector("code");
      const text = code ? code.innerText : pre.innerText;
      try {
        await navigator.clipboard.writeText(text);
      } catch (e) {
        const ta = document.createElement("textarea");
        ta.value = text;
        document.body.appendChild(ta);
        ta.select();
        try {
          document.execCommand("copy");
        } catch (err) {}
        ta.remove();
      }
      btn.textContent = cfg("ui.code.copied", "copied ✓");
      btn.classList.add("copied");
      setTimeout(() => {
        btn.textContent = cfg("ui.code.copy", "copy");
        btn.classList.remove("copied");
      }, 1400);
    };
    pre.appendChild(btn);
  });
}

function setupTagFilters() {
  const bar = document.getElementById("filterbar");
  if (!bar) return;
  const grid = document.getElementById("cardgrid");
  const empty = document.getElementById("filter-empty");
  bar.addEventListener("click", (e) => {
    const chip = e.target.closest(".chip");
    if (!chip) return;
    bar.querySelectorAll(".chip").forEach((c) => c.classList.remove("active"));
    chip.classList.add("active");
    const filter = chip.dataset.filter;
    let visible = 0;
    if (grid) {
      grid.querySelectorAll(".card").forEach((card) => {
        const tags = (card.dataset.tags || "").split(",");
        const show = filter === "all" || tags.includes(filter);
        card.classList.toggle("hidden-by-filter", !show);
        if (show) visible++;
      });
    }
    if (empty) empty.style.display = visible === 0 ? "block" : "none";
  });
}

function setupOutlineListeners() {
  document.querySelectorAll(".outline a").forEach((a) => {
    a.onclick = (e) => {
      e.preventDefault();
      const targetId = a.dataset.target;
      if (targetId && /^[a-zA-Z0-9_-]+$/.test(targetId)) {
        const target = document.getElementById(targetId);
        if (target) target.scrollIntoView({ behavior: "smooth" });
      }
    };
  });
}

let glitchInterval = null;
let roleTimer = null;

function setupHeroRoles() {
  if (roleTimer) {
    clearTimeout(roleTimer);
    roleTimer = null;
  }
  const el = document.getElementById("hero-role-text");
  const roles = cfg("pages.home.hero.roles", []);
  if (!el || !roles.length) return;
  const reduce =
    typeof window.matchMedia === "function" &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  if (reduce) {
    el.textContent = roles[0];
    return;
  }
  let ri = 0,
    ci = 0,
    del = false;
  (function tick() {
    if (!document.body.contains(el)) return;
    const word = roles[ri];
    ci += del ? -1 : 1;
    el.textContent = word.slice(0, ci);
    let wait = del ? 28 : 65;
    if (!del && ci === word.length) {
      del = true;
      wait = 1700;
    } else if (del && ci === 0) {
      del = false;
      ri = (ri + 1) % roles.length;
      wait = 350;
    }
    roleTimer = setTimeout(tick, wait);
  })();
}

function afterRender(path) {
  setupOutlineListeners();
  setupReveal();
  setupCodeCopy();
  setupTagFilters();
  if (typeof setupMusicPlayer === "function") setupMusicPlayer();
  initNotesResizer();
  setupCopyTiles();
  setupHeroRoles();

  const seg = path.split("/").filter(Boolean);
  const isPost =
    seg.length > 1 &&
    (seg[0] === slugOf("writeups") || seg[0] === slugOf("projects"));
  setupProgress(isPost ? "articlebody" : null);

  // Glitch flicker on home hero title
  if (glitchInterval) {
    clearInterval(glitchInterval);
    glitchInterval = null;
  }
  const g = document.getElementById("glitch");
  if (g) {
    glitchInterval = setInterval(() => {
      if (Math.random() > 0.92) {
        g.style.textShadow = `2px 0 var(--muted), -2px 0 var(--text)`;
        setTimeout(() => {
          if (g) g.style.textShadow = "none";
        }, 90);
      }
    }, 1200);
  }
}

/* ========================= SITE INIT ========================= */
// Applies text from config to the static HTML shell (index.html):
//   data-cfg="path"                -> element text
//   data-cfg-attr="attr:path;..."  -> attributes (title, aria-label, placeholder...)
//   data-cfg-href="pageKey"        -> link to that page's route
function applyStaticConfig() {
  document.querySelectorAll("[data-cfg]").forEach((el) => {
    const v = cfg(el.getAttribute("data-cfg"));
    if (typeof v === "string") el.textContent = fmt(v);
  });
  document.querySelectorAll("[data-cfg-attr]").forEach((el) => {
    el.getAttribute("data-cfg-attr")
      .split(";")
      .forEach((pair) => {
        const i = pair.indexOf(":");
        if (i < 0) return;
        const v = cfg(pair.slice(i + 1).trim());
        if (typeof v === "string") el.setAttribute(pair.slice(0, i).trim(), fmt(v));
      });
  });
  document.querySelectorAll("[data-cfg-href]").forEach((el) => {
    el.setAttribute("href", "#" + routeOf(el.getAttribute("data-cfg-href")));
  });
}

function initConfig() {
  if (typeof CONFIG === "undefined") return;

  const lang = cfg("site.language", "");
  if (lang) document.documentElement.lang = lang;

  const setAttr = (sel, attr, val) => {
    const el = document.querySelector(sel);
    if (el && val != null && val !== "") el.setAttribute(attr, val);
  };
  setAttr('meta[name="description"]', "content", cfg("site.description"));
  setAttr('meta[property="og:description"]', "content", cfg("site.description"));
  setAttr('meta[property="og:title"]', "content", cfg("pages.home.title"));
  setAttr('meta[property="og:image"]', "content", cfg("site.ogImage"));
  setAttr('link[rel="icon"]', "href", cfg("site.favicon"));

  const cfgBrand = document.getElementById("cfg-brand");
  if (cfgBrand) cfgBrand.textContent = cfg("site.brand", "");

  const nav = document.getElementById("navlinks");
  if (nav) {
    nav.innerHTML = getNavLinks()
      .map(
        (n) =>
          `<a href="#${escapeHTML(n.route)}" data-route="${escapeHTML(n.route)}">${escapeHTML(n.label)}</a>`,
      )
      .join("");
  }

  applyStaticConfig();

  const fq = document.getElementById("cfg-footer-quip");
  if (fq) fq.textContent = fmt(cfg("footer.quip", ""));
  const ft = document.getElementById("cfg-footer-text");
  if (ft) ft.textContent = fmt(cfg("footer.text", ""));
}

try {
  initConfig();
} catch (e) {
  console.error("initConfig error:", e);
}

// Launch initial route
navigate();
