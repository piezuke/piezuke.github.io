/**
 * ===================================================================
 * piezuke_ — Core SPA Application Engine
 * ===================================================================
 * Manages client-side routing, view templates, markdown parsing,
 * obsidian-style nested notes vault, theme toggling, and page behaviors.
 */

/* ========================= CONTENT DEFAULTS ========================= */
const TIMELINE = [
  {
    date: "2025 June",
    title: "Started my CS degree(god help)",
    body: "Learnt a bit of linux and started off with CTFs",
  },
  {
    date: "2025 November",
    title: "Joined Bi0s and got started with violating binaries",
    body: "Did my first buffer overflow, assembly and memory got fun, Started off playin CTFs as team",
  },
  {
    date: "2026",
    title: "Present day",
    body: "Welp, im surviving. Sort off.",
  },
];

const ABOUT = {
  tagline: "A lil bit about myself",
  bio: `Hello. Myself PIE. I go by pie-zuke cus some guy(s) have already claimed the name 'PIE' in most platforms. So I can't be niche no more, but feel free to js use PIE. Also its 'zyuk', NOT ZU-KEH. Anyway, Im a CS student at Amrita, and a part of team bi0s under the Binary Exploitation category. Buy me coffee if u see me(unlikely cus I hate touching grass). I occationally take on random side projects which may or maynot include building a wholeahh operating system(I wish I had the motivation). Feel free to try out that music player on the left, except idk if it will be working by the time I post this. Plus I still haven't finished composing even a single tune at the time of writing this. Bluh`,
  skills: [
    "Binary Exploitation",
    "Web (may not be my cup of tea)",
    "OS dev",
    "Game dev",
    "Music Composition",
    "Reversing (still starting out)",
    "Larping",
  ],
  contacts: [
    [
      "GitHub",
      "https://github.com/piezuke",
      '<svg viewBox="0 0 24 24" fill="currentColor" width="22" height="22"><path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z"/></svg>',
    ],
    [
      "Twitter / X",
      "https://twitter.com/piezuke",
      '<svg viewBox="0 0 24 24" fill="currentColor" width="22" height="22"><path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/></svg>',
    ],
    [
      "Email",
      "mailto:piezuke@gmail.com",
      '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" width="22" height="22"><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"></path><polyline points="22,6 12,13 2,6"></polyline></svg>',
    ],
    [
      "CTFtime",
      "https://ctftime.org/user/251840",
      '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" width="22" height="22"><path d="M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1z"></path><line x1="4" y1="22" x2="4" y2="15"></line></svg>',
    ],
  ],
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

function renderContactCard(label, href, icon) {
  const isMail = href.startsWith("mailto:");
  const targetAttr = isMail ? "" : ' target="_blank" rel="noopener noreferrer"';
  return `
    <a href="${sanitizeUrl(href)}" class="contact-card"${targetAttr} aria-label="${escapeHTML(label)}">
      <div class="contact-card-main">
        <span class="contact-card-icon" aria-hidden="true">${icon}</span>
        <span class="contact-card-label">${escapeHTML(label)}</span>
      </div>
      <span class="contact-card-arrow" aria-hidden="true">↗</span>
    </a>
  `;
}

/* ========================= THEME MANAGEMENT ========================= */
function setTheme(t) {
  t = t === "light" ? "light" : "dark";
  const root = document.documentElement;
  root.classList.add("theme-switching");
  root.setAttribute("data-theme", t);
  requestAnimationFrame(() =>
    requestAnimationFrame(() => root.classList.remove("theme-switching")),
  );
  try {
    localStorage.setItem("theme", t);
  } catch (e) {}

  const metaTheme = document.querySelector('meta[name="theme-color"]');
  if (metaTheme)
    metaTheme.setAttribute("content", t === "light" ? "#fafafa" : "#050505");

  const themebtn = document.getElementById("themebtn");
  if (themebtn) {
    themebtn.innerHTML =
      t === "light"
        ? '<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"></path></svg>'
        : '<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="5"></circle><line x1="12" y1="1" x2="12" y2="3"></line><line x1="12" y1="21" x2="12" y2="23"></line><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"></line><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"></line><line x1="1" y1="12" x2="3" y2="12"></line><line x1="21" y1="12" x2="23" y2="12"></line><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"></line><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"></line></svg>';
  }

  const bttImg = document.getElementById("btt-img");
  if (bttImg)
    bttImg.src = t === "light" ? "media/top_dark.webp" : "media/top_light.webp";
}

const savedTheme =
  (function () {
    try {
      const v = localStorage.getItem("theme");
      return v === "light" || v === "dark" ? v : null;
    } catch (e) {
      return null;
    }
  })() || "dark";
setTheme(savedTheme);

const themebtn = document.getElementById("themebtn");
if (themebtn) {
  themebtn.onclick = () => {
    setTheme(
      document.documentElement.getAttribute("data-theme") === "light"
        ? "dark"
        : "light",
    );
  };
}

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

/* ========================= ROUTER ========================= */
const ROUTE_ALIASES = { timeline: "story", about: "me" };

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
  if (segs[1] && ROUTE_ALIASES[segs[1]]) segs[1] = ROUTE_ALIASES[segs[1]];
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
    if (segments[1] && ROUTE_ALIASES[segments[1]]) {
      segments[1] = ROUTE_ALIASES[segments[1]];
    }
    return segments.join("/") || "/";
  };

  document.querySelectorAll("nav.links a").forEach((a) => {
    a.classList.toggle("active", canonicalRoute(a.dataset.route) === rootRoute);
  });

  // Toggle in-notes class to hide global footer during vault view
  document.body.classList.toggle("in-notes", path.startsWith("/notes"));

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
    currentRoutePath.startsWith("/notes") && path.startsWith("/notes");
  currentRoutePath = path;

  if (isBetweenNotes) {
    const parts = path.split("/").filter(Boolean);
    const noteId = parts[1] || "";
    if (document.getElementById("noteswrap")) {
      updateActiveNoteInView(noteId);
      document.title = pageTitle(["notes", noteId]);
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
  const labels = [
    "bluh bluh bluh bluh....",
    "buh buh buh buh....",
    "fweh fweh fweh fweh....",
    "pluh{0MG_pr0ud_0f_y0u_wh0ever_y0ur}",
  ];
  const lbl = document.getElementById("loaderlabel");
  if (lbl) lbl.textContent = labels[Math.floor(Math.random() * labels.length)];
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
  const site = "piezuke";
  const first = parts[0];
  const cap = (s) => s.charAt(0).toUpperCase() + s.slice(1);
  if (!first) return "pieBlog";
  const names = {
    writeups: "Writeups",
    projects: "Projects",
    notes: "Notes",
    story: "Story",
    me: "About",
  };
  if (!names[first]) return `Not found — ${site}`;
  let label = names[first];
  if (parts[1]) {
    const lists = {
      writeups: typeof WRITEUPS !== "undefined" ? WRITEUPS : [],
      projects: typeof PROJECTS !== "undefined" ? PROJECTS : [],
    };
    const item = lists[first] && lists[first].find((x) => x.slug === parts[1]);
    if (item) label = item.title;
    else if (first === "notes") {
      const n = findNote(parts[1]);
      if (n) label = n.title;
    } else label = cap(parts[1]);
  }
  return `${label} — ${site}`;
}

function render(path) {
  try {
    const parts = path.split("/").filter(Boolean);
    let html = "";
    const writeupsList = typeof WRITEUPS !== "undefined" ? WRITEUPS : [];
    const projectsList = typeof PROJECTS !== "undefined" ? PROJECTS : [];

    if (parts.length === 0) html = viewHome();
    else if (parts[0] === "writeups" && parts[1])
      html = viewPost(writeupsList, parts[1], "writeups");
    else if (parts[0] === "writeups")
      html = viewList(
        writeupsList,
        CONFIG.writeupsTitle,
        CONFIG.writeupsSubtitle,
        "writeups",
      );
    else if (parts[0] === "projects" && parts[1])
      html = viewPost(projectsList, parts[1], "projects");
    else if (parts[0] === "projects")
      html = viewList(
        projectsList,
        CONFIG.projectsTitle,
        CONFIG.projectsSubtitle,
        "projects",
      );
    else if (parts[0] === "notes") html = viewNotes(parts[1]);
    else if (parts[0] === "story")
      html = viewTimeline(CONFIG.timelineTitle, CONFIG.timelineSubtitle);
    else if (parts[0] === "me") html = viewAbout();
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
        <h2>Render Error</h2>
        <pre style="background:var(--surface); padding:20px; border-radius:12px; white-space:pre-wrap;">${escapeHTML(err.stack || String(err))}</pre>
      </div>`;
    }
    const l = document.getElementById("loader");
    if (l) l.classList.add("hide");
  }
}

/* ========================= VIEW TEMPLATES ========================= */
function cardHTML(item, base) {
  const tagParts = (item.tag || "")
    .split("·")
    .map((t) => t.trim().toLowerCase())
    .filter(Boolean);
  return `<a class="card reveal-scale" href="#/${escapeHTML(base)}/${escapeHTML(item.slug)}" data-tags="${escapeHTML(tagParts.join(","))}">
    <div class="tag">${escapeHTML(item.tag)}</div>
    <h3>${escapeHTML(item.title)}</h3>
    <p>${escapeHTML(item.excerpt)}</p>
    ${item.pills ? `<div class="pillrow">${item.pills.map((p) => `<span class="pill">${escapeHTML(p)}</span>`).join("")}</div>` : ""}
    <div class="cf"><span>${escapeHTML(item.date)}</span><span class="card-arrow">↗</span></div>
  </a>`;
}

function viewHome() {
  const writeupsList = typeof WRITEUPS !== "undefined" ? WRITEUPS : [];
  const projectsList = typeof PROJECTS !== "undefined" ? PROJECTS : [];

  return `
  <section class="hero wrap">
    <div class="hero-content">
      <div class="hero-text">
        <h1 class="reveal" id="glitch">${escapeHTML(CONFIG.heroTitle)}</h1>
        <p class="reveal hero-subtitle">${escapeHTML(CONFIG.heroSubtitle)}</p>
        <div class="stats reveal">
          <span>${writeupsList.length} writeups</span>
          <span>${projectsList.length} projects</span>
          <span>est. 2007</span>
        </div>
        <div class="cta reveal">
          <a class="btn" href="#/writeups">read writeups →</a>
          <a class="btn" href="#/projects">view projects →</a>
          <a class="btn ghost" href="#/me">about me</a>
        </div>
      </div>
      <div class="hero-avatar reveal">
        <picture>
          <source srcset="media/pfp.webp" type="image/webp">
          <img class="hero-avatar-img" src="media/pfp.jpg" alt="${escapeHTML(CONFIG.brand)}" loading="eager" fetchpriority="high" width="280" height="280">
        </picture>
      </div>
    </div>
  </section>
  ${
    writeupsList.length > 0
      ? `
  <section class="wrap">
    <div class="sechead reveal"><h2>${escapeHTML(CONFIG.writeupsTitle)}</h2><a href="#/writeups">view all →</a></div>
    <div class="grid">${writeupsList
      .slice(0, 2)
      .map((w) => cardHTML(w, "writeups"))
      .join("")}</div>
  </section>`
      : ""
  }
  ${
    projectsList.length > 0
      ? `
  <section class="wrap" style="margin-top:60px;">
    <div class="sechead reveal"><h2>${escapeHTML(CONFIG.projectsTitle)}</h2><a href="#/projects">view all →</a></div>
    <div class="grid">${projectsList
      .slice(0, 2)
      .map((p) => cardHTML(p, "projects"))
      .join("")}</div>
  </section>`
      : ""
  }`;
}

function viewList(arr, title, sub, base) {
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
    <div class="eyebrow reveal">${arr.length} entries</div>
    <h1 class="reveal" style="font-size:clamp(46.9px,7.8vw,81.2px); margin:12px 0 8px;">${escapeHTML(title)}</h1>
    <p class="reveal" style="color:var(--muted); max-width:520px; margin-bottom:28px;">${escapeHTML(sub)}</p>
    ${
      allTags.length > 1
        ? `<div class="filterbar reveal" id="filterbar">
      <button class="chip active" data-filter="all">all</button>
      ${allTags.map((t) => `<button class="chip" data-filter="${escapeHTML(t)}">${escapeHTML(t)}</button>`).join("")}
    </div>`
        : ""
    }
    ${
      arr.length === 0
        ? `<div style="padding:60px 0; color:var(--dim); font-family:var(--mono);">No ${escapeHTML(base)} published yet. Check back soon.</div>`
        : `<div class="grid" id="cardgrid">${arr.map((i) => cardHTML(i, base)).join("")}</div>`
    }
    <p id="filter-empty" class="palette-empty" style="display:none;">Nothing matches that tag.</p>
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

function viewPost(arr, slug, base) {
  const item = arr.find((x) => x.slug === slug);
  if (!item) return view404();
  const { html, outline } = mdToHtmlWithOutline(item.body);
  const wordCount = (item.body || "").split(/\s+/).length;
  const readTime = Math.max(1, Math.round(wordCount / 200));
  const suggestions = arr
    .filter((x) => x.slug !== slug)
    .sort(() => 0.5 - Math.random())
    .slice(0, 2);

  return `
  <div class="wrap" style="padding-top:26px;">
    <a href="#/${escapeHTML(base)}" style="font-family:var(--mono); font-size:18.8px; color:var(--muted);">← back to ${escapeHTML(base)}</a>
    <div class="postlayout">
      ${
        outline.length > 0
          ? `
      <aside class="outline" id="outline">
        <div class="otitle">on this page</div>
        ${outline.map((o) => `<a href="#${escapeHTML(o.id)}" class="${o.depth === 3 ? "h3" : ""}" data-target="${escapeHTML(o.id)}">${escapeHTML(o.text)}</a>`).join("")}
      </aside>`
          : "<div></div>"
      }
      <article>
        <div class="article-head">
          <div class="eyebrow">${escapeHTML(item.tag)}</div>
          <h1>${escapeHTML(item.title)}</h1>
          <div class="metarow"><span>${escapeHTML(item.date)}</span><span>${readTime} min read</span></div>
        </div>
        <div class="article-body" id="articlebody">${html}</div>
      </article>
      <aside class="right-panel">
        <div class="author-card">
          <picture>
            <source srcset="media/pfp.webp" type="image/webp">
            <img src="media/pfp.jpg" alt="${escapeHTML(CONFIG.brand)}" loading="lazy" width="90" height="90" style="width:90px; height:90px; border-radius:50%; margin-bottom:14px; border:2px solid var(--border-strong); object-fit:cover;">
          </picture>
          <div style="font-size:24px; font-weight:800; margin-bottom:6px;">${escapeHTML(CONFIG.brand)}</div>
          <p style="color:var(--muted); font-size:15px; line-height:1.4;">${escapeHTML(ABOUT.tagline)}</p>
        </div>
        ${
          suggestions.length
            ? `<div class="suggestions">
          <div class="otitle" style="color:var(--dim); letter-spacing:.14em; font-size:16.4px; margin-bottom:14px; font-family:var(--mono); text-transform:uppercase;">suggested reads</div>
          ${suggestions
            .map(
              (s) => `
            <a href="#/${escapeHTML(base)}/${escapeHTML(s.slug)}" class="sug-card">
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

function viewTimeline(title, subtitle) {
  return `
  <section class="wrap" style="padding-top:50px;">
    <div class="eyebrow reveal">journey log</div>
    <h1 class="reveal" style="font-size:clamp(46.9px,7.8vw,81.2px); margin:12px 0 8px;">${escapeHTML(title)}</h1>
    ${subtitle ? `<p class="reveal" style="color:var(--muted); max-width:520px; margin-bottom:44px;">${escapeHTML(subtitle)}</p>` : ""}
    <div class="tl">
      ${TIMELINE.map(
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
  const playlist = typeof PLAYLIST !== "undefined" ? PLAYLIST : [];
  return `
  <section class="wrap" style="padding-top:50px;">
    <div class="about-header reveal">
      <picture>
        <source srcset="media/pfp.webp" type="image/webp">
        <img class="about-header-img" src="media/pfp.jpg" alt="${escapeHTML(CONFIG.brand)}" loading="lazy" width="120" height="120">
      </picture>
      <div class="about-header-text">
        <div class="eyebrow">From the author</div>
        <h1>${escapeHTML(ABOUT.tagline)}</h1>
      </div>
    </div>

    <div class="about-grid">
      <aside class="about-sidebar reveal">
        <div class="music-widget" id="music-widget">
          <div class="mw-header">
            <div class="mw-label">
              <span>Music I Madeeee</span>
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
              <div class="mw-title" id="mw-title">${escapeHTML(playlist[0]?.title || "No Track")}</div>
              <div class="mw-artist" id="mw-artist">${escapeHTML(playlist[0]?.artist || "Unknown")}</div>
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
            <button class="mw-btn" id="mw-prev-btn" aria-label="Previous Track" title="Previous">
              <svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor"><path d="M6 6h2v12H6zm3.5 6l8.5 6V6z"/></svg>
            </button>
            <button class="mw-btn mw-play" id="mw-play-btn" aria-label="Play / Pause" title="Play">
              <svg id="mw-play-icon" viewBox="0 0 24 24" width="18" height="18" fill="currentColor"><path d="M8 5v14l11-7z"/></svg>
              <svg id="mw-pause-icon" viewBox="0 0 24 24" width="18" height="18" fill="currentColor" style="display:none;"><path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z"/></svg>
            </button>
            <button class="mw-btn" id="mw-next-btn" aria-label="Next Track" title="Next">
              <svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor"><path d="M6 18l8.5-6L6 6v12zM16 6v12h2V6h-2z"/></svg>
            </button>
          </div>

          <div class="mw-playlist">
            <div class="mw-playlist-head">TRACKLIST</div>
            <div class="mw-tracklist" id="mw-tracklist">
              ${playlist
                .map(
                  (t, idx) => `
                <div class="mw-track-item ${idx === 0 ? "active" : ""}" data-idx="${idx}">
                  <div class="mw-track-left">
                    <span class="mw-track-num">${String(idx + 1).padStart(2, "0")}</span>
                    <span class="mw-track-name">${escapeHTML(t.title)}</span>
                  </div>
                  <span class="mw-track-status">${idx === 0 ? "READY" : ""}</span>
                </div>
              `,
                )
                .join("")}
            </div>
          </div>
        </div>
      </aside>

      <div class="about-main reveal-left">
        <p class="about-bio">${escapeHTML(ABOUT.bio)}</p>

        <div style="margin-top:44px;">
          <div class="about-subhead">Interests</div>
          <div class="pillgrid">
            ${ABOUT.skills.map((s) => `<div class="pill">${escapeHTML(s)}</div>`).join("")}
          </div>
        </div>

        <div style="margin-top:44px;">
          <div class="about-subhead">FIND ME AROUND</div>
          <div class="contactlist">
            ${ABOUT.contacts.map(([label, href, icon]) => renderContactCard(label, href, icon)).join("")}
            <div class="discord-plate" onclick="navigator.clipboard.writeText('piezuke'); const t=this.querySelector('.discord-copy'); t.textContent='Copied!'; setTimeout(()=>t.textContent='Copy', 2000)">
              <div class="discord-icon">
                <svg viewBox="0 0 24 24" fill="currentColor" width="22" height="22"><path d="M20.317 4.3698a19.7913 19.7913 0 00-4.8851-1.5152.0741.0741 0 00-.0785.0371c-.211.3753-.4447.8648-.6083 1.2495-1.8447-.2762-3.68-.2762-5.4868 0-.1636-.3933-.4058-.8742-.6177-1.2495a.077.077 0 00-.0785-.037 19.7363 19.7363 0 00-4.8852 1.515.0699.0699 0 00-.0321.0277C.5334 9.0458-.319 13.5799.0992 18.0578a.0824.0824 0 00.0312.0561c2.0528 1.5076 4.0413 2.4228 5.9929 3.0294a.0777.0777 0 00.0842-.0276c.4616-.6304.8731-1.2952 1.226-1.9942a.076.076 0 00-.0416-.1057c-.6528-.2476-1.2743-.5495-1.8722-.8923a.077.077 0 01-.0076-.1277c.1258-.0943.2517-.1923.3718-.2914a.0743.0743 0 01.0776-.0105c3.9278 1.7933 8.18 1.7933 12.0614 0a.0739.0739 0 01.0785.0095c.1202.099.246.1981.3728.2924a.077.077 0 01-.0066.1276 12.2986 12.2986 0 01-1.873.8914.0766.0766 0 00-.0407.1067c.3604.698.7719 1.3628 1.225 1.9932a.076.076 0 00.0842.0286c1.961-.6067 3.9495-1.5219 6.0023-3.0294a.077.077 0 00.0313-.0552c.5004-5.177-.8382-9.6739-3.5485-13.6604a.061.061 0 00-.0312-.0286zM8.02 15.3312c-1.1825 0-2.1569-1.0857-2.1569-2.419 0-1.3332.9555-2.4189 2.157-2.4189 1.2108 0 2.1757 1.0952 2.1568 2.419 0 1.3332-.9555 2.4189-2.1569 2.4189zm7.9748 0c-1.1825 0-2.1569-1.0857-2.1569-2.419 0-1.3332.9554-2.4189 2.1569-2.4189 1.2108 0 2.1757 1.0952 2.1568 2.419 0 1.3332-.946 2.4189-2.1568 2.4189Z"/></svg>
              </div>
              <div class="discord-info">
                <span class="discord-label">Discord</span>
                <span class="discord-user">piezuke</span>
              </div>
              <div class="discord-copy">Copy</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  </section>
  `;
}

function view404() {
  return `<div class="wrap" style="padding-top:100px;"><h2>${escapeHTML(CONFIG.error404Title || "404 Not Found")}</h2><p>${escapeHTML(CONFIG.error404Text || "Nothing here.")}</p></div>`;
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
      const folderName = node.folder || node.name || "folder";
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
      <a href="#/notes/${escapeHTML(n.id)}" class="notenode ${n.id === activeIdReal ? "active" : ""}">
        <span class="note-icon">📄</span>
        <span class="note-title-text">${escapeHTML(n.title)}</span>
      </a>
    `,
        )
        .join("");

      return `
      <div class="folder-group ${isCollapsed ? "collapsed" : ""}" data-folder-path="${escapeHTML(currentPath)}">
        <div class="folder" onclick="toggleFolder(this)" onkeydown="if(event.key==='Enter'||event.key===' '){event.preventDefault();toggleFolder(this);}" role="button" tabindex="0" aria-expanded="${!isCollapsed}">
          <span class="folder-arrow">▾</span>
          <span class="folder-icon">${isCollapsed ? "📁" : "📂"}</span>
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
  if (icon) icon.textContent = isNowCollapsed ? "📁" : "📂";
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
    if (icon) icon.textContent = expand ? "📂" : "📁";
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
      <div class="folder" style="cursor:default;">ON THIS PAGE</div>
      ${outline.map((o) => `<a href="#${escapeHTML(o.id)}" class="notenode" data-target="${escapeHTML(o.id)}" style="${o.depth === 3 ? "padding-left:24px; font-size:0.9em;" : ""}">${escapeHTML(o.text)}</a>`).join("")}
    </div>`;
}

function viewNotes(activeId) {
  const allNotes = getAllNotes();
  const active = activeId ? findNote(activeId) : allNotes[0] || null;
  const activeIdReal = active ? active.id : "";
  let body = active
    ? active.body
    : "# Select a note\n\nPick something from the sidebar.";

  // Support Obsidian-style [[Wiki Links]]
  body = body.replace(/\[\[([^\]]+)\]\]/g, (m, name) => {
    const target = allNotes.find(
      (n) => n.title.toLowerCase() === name.toLowerCase(),
    );
    return target ? `[${name}](#/notes/${target.id})` : name;
  });

  const { html, outline } = mdToHtmlWithOutline(body);
  const notesTreeData = typeof NOTES_TREE !== "undefined" ? NOTES_TREE : [];

  return `
  <div class="noteswrap" id="noteswrap" style="--notes-sidebar-w: ${getNotesSidebarWidth()}px;">
    <div class="notetree" id="notetree">
      <div class="notetree-header">
        <span class="notetree-header-title">VAULT / NOTES</span>
        <div class="notetree-header-actions">
          <button class="notetree-act-btn" onclick="toggleAllFolders(true)" title="Expand all folders" aria-label="Expand all folders">⊞</button>
          <button class="notetree-act-btn" onclick="toggleAllFolders(false)" title="Collapse all folders" aria-label="Collapse all folders">⊟</button>
        </div>
      </div>
      <div class="notetree-items">
        ${renderNoteTree(notesTreeData, activeIdReal, 0, "")}
      </div>

      <div id="notetree-outline-wrap">
        ${renderNotesOutline(outline)}
      </div>

      <div class="notetree-footer">
        <span class="notetree-footer-status">VAULT / ${allNotes.length} NOTES</span>
        <span class="notetree-footer-badge">READY</span>
      </div>
    </div>
    <div class="notetree-resizer" id="notetree-resizer" role="separator" aria-orientation="vertical" title="Drag to resize sidebar (Double-click to reset)"></div>
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
    : "# Select a note\n\nPick something from the sidebar.";

  body = body.replace(/\[\[([^\]]+)\]\]/g, (m, name) => {
    const target = allNotes.find(
      (n) => n.title.toLowerCase() === name.toLowerCase(),
    );
    return target ? `[${name}](#/notes/${target.id})` : name;
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
      const isTarget = node.getAttribute("href") === `#/notes/${activeIdReal}`;
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
            if (icon) icon.textContent = "📂";
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
      bttBtn.title = "Back to top";
    } else {
      bttBtn.classList.add("pointing-down");
      bttBtn.title = "Scroll to bottom";
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
    bttBtn.title = "Scroll to bottom";
  }
}

function setupReveal() {
  if (typeof IntersectionObserver === "undefined") {
    document
      .querySelectorAll(".reveal, .reveal-left, .reveal-scale")
      .forEach((el) => el.classList.add("in-view"));
    return;
  }
  if (observer) observer.disconnect();
  observer = new IntersectionObserver(
    (entries) => {
      entries.forEach((e) => {
        e.target.classList.toggle("in-view", e.isIntersecting);
      });
    },
    { threshold: 0.15 },
  );
  document
    .querySelectorAll(".reveal, .reveal-left, .reveal-scale")
    .forEach((el) => observer.observe(el));
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
    btn.textContent = "copy";
    btn.setAttribute("aria-label", "Copy code to clipboard");
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
      btn.textContent = "copied ✓";
      btn.classList.add("copied");
      setTimeout(() => {
        btn.textContent = "copy";
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

function afterRender(path) {
  setupOutlineListeners();
  setupReveal();
  setupCodeCopy();
  setupTagFilters();
  if (typeof setupMusicPlayer === "function") setupMusicPlayer();
  initNotesResizer();

  const isPost = /^\/(writeups|projects)\/[^/]+/.test(path);
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
function initConfig() {
  if (typeof CONFIG === "undefined") return;

  const cfgBrand = document.getElementById("cfg-brand");
  if (cfgBrand) cfgBrand.textContent = CONFIG.brand;

  const nav = document.getElementById("navlinks");
  if (nav && Array.isArray(CONFIG.navLinks)) {
    nav.innerHTML = CONFIG.navLinks
      .map(
        (n) =>
          `<a href="#${escapeHTML(n.route)}" data-route="${escapeHTML(n.route)}">${escapeHTML(n.label)}</a>`,
      )
      .join("");
  }

  const fq = document.getElementById("cfg-footer-quip");
  if (fq)
    fq.textContent =
      "Coffee Waaaay better than tea. Ainnobody tellin' me otherwise.";

  const ft = document.getElementById("cfg-footer-text");
  if (ft) ft.textContent = CONFIG.footerText;
}

try {
  initConfig();
} catch (e) {
  console.error("initConfig error:", e);
}

// Launch initial route
navigate();
