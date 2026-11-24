/**
 * ===================================================================
 * piezuke_ — config.js checker
 * ===================================================================
 * The site never breaks on a bad config (every key has a fallback), which
 * also means a typo is silently ignored. This checks config.js against the
 * known shape and reports problems in the browser console:
 *
 *   - unknown keys, with a "did you mean ...?" suggestion
 *   - values of the wrong type
 *   - invalid values (bad page names, duplicate URL slugs, unknown icons,
 *     unknown {placeholders}, non-numeric durations, ...)
 *
 * Add  ?debug=config  to the address to see the result on the page itself.
 * It only reads CONFIG; it changes nothing.
 */
(function () {
  "use strict";
  if (typeof CONFIG === "undefined") return;

  const S = "",
    N = 0,
    B = false;
  const ANY = "*"; // free-form map: any key, values must match this shape

  const KEYS = {
    site: {
      brand: S, name: S, language: S, url: S, author: S,
      feed: { enabled: B, title: S, description: S },
      description: S, titleTemplate: S,
      avatar: { webp: S, jpg: S },
      favicon: S, ogImage: S,
      themeColors: { dark: S, light: S },
    },
    routes: {
      home: S, writeups: S, projects: S, notes: S, timeline: S, about: S,
      redirects: { [ANY]: S },
    },
    nav: {
      homeLabel: S, menuTitle: S, menuLabel: S,
      links: [{ label: S, page: S, route: S }],
    },
    ui: {
      arrow: S, renderError: S,
      covers: { image: S, position: S },
      search: {
        key: S, buttonText: S, buttonTitle: S, buttonLabel: S, dialogLabel: S,
        placeholder: S, empty: S, hintNavigate: S, hintOpen: S, hintClose: S, tagsLabel: S,
        tags: { page: S, writeup: S, project: S, note: S },
      },
      loader: {
        minDuration: N, pageChangeDuration: N, skipOnBackForward: B,
        waitForImages: B, maxDuration: N, slowAfter: N, slow: S,
        initial: S, labels: [S],
      },
      theme: { label: S, title: S, toLight: S, toDark: S },
      rain: { title: S, label: S, on: S, off: S },
      backToTop: { top: S, bottom: S, label: S },
      code: { copy: S, copied: S, label: S, highlight: B, languageLabel: B },
      a11y: { skipLink: S, navigated: S, loading: S, navLabel: S, controls: S },
      miniPlayer: {
        label: S, linkTitle: S, idleTitle: S, playTitle: S, playLabel: S,
        nextTitle: S, nextLabel: S,
      },
    },
    footer: { quip: S, text: S, ctaHeading: S, ctaText: S, ctaButton: S, navHeading: S, latestHeading: S, socialsHeading: S },
    pages: {
      home: {
        title: S,
        hero: {
          status: S,
          title: S,
          avatarAlt: S,
          avatar: { webp: S, jpg: S },
          roles: [S],
          marquee: [S],
          subtitle: S,
          chips: [S],
        },
        buttons: [{ label: S, page: S, url: S, style: S }],
        explore: {
          heading: S,
          cards: [{ page: S, title: S, text: S, count: S, countOne: S }],
        },
        latest: {
          count: N,
          writeups: { show: B, heading: S, viewAll: S, empty: [{ title: S, text: S }] },
          projects: { show: B, heading: S, viewAll: S, empty: [{ title: S, text: S }] },
        },
      },
      writeups: {
        title: S, heading: S, subtitle: S, entries: S, entriesOne: S,
        filterAll: S, noMatch: S, empty: S, backLabel: S,
      },
      projects: {
        title: S, heading: S, subtitle: S, entries: S, entriesOne: S,
        filterAll: S, noMatch: S, empty: S, backLabel: S,
      },
      post: {
        readTime: S, outlineTitle: S, suggestedTitle: S,
        author: { name: S, tagline: S, avatar: { webp: S, jpg: S } },
        meta: { labels: { [ANY]: S } },
        copyLink: { label: S, copied: S, title: S },
        sectionLink: { title: S, copied: S },
        flags: { enabled: B, hint: S, prefixes: [S], generic: B },
      },
      notes: {
        title: S, vaultTitle: S, expandAll: S, collapseAll: S, expandIcon: S,
        collapseIcon: S, status: S, badge: S, outlineTitle: S, resizerTitle: S,
        emptyBody: S, unnamedFolder: S,
        icons: { note: S, folderOpen: S, folderClosed: S },
      },
      timeline: {
        title: S, eyebrow: S, heading: S, subtitle: S,
        items: [{ date: S, title: S, body: S }],
      },
      about: {
        title: S, eyebrow: S, heading: S, bio: S, interestsHeading: S,
        skills: [S], socialsHeading: S,
        avatar: { webp: S, jpg: S },
        avatarAlt: S,
        captionTitle: S,
        captionRoles: [S],
        contacts: [{ label: S, url: S, copy: S, icon: S, iconSvg: S, handle: S, hint: S, copiedText: S, wide: B }],
      },
      notFound: { title: S, heading: S, text: S },
    },
    music: {
      heading: S, emoji: S, emptyText: S, tracklistHeading: S, noTrack: S, unknownArtist: S,
      status: { idle: S, ready: S, playing: S, paused: S },
      controls: { prev: S, prevTitle: S, playPause: S, playTitle: S, next: S, nextTitle: S },
      playlist: [{ title: S, artist: S, src: S }],
    },
    cursor: S,
  };

  const PAGE_KEYS = ["home", "writeups", "projects", "notes", "timeline", "about"];
  const ICONS = ["github", "twitter", "email", "ctftime", "discord", "link"];
  const CURSORS = ["ring", "on", "native-ring", "os", "off", "native", "system"];
  const BUTTON_STYLES = ["solid", "outline", "ghost"];
  const PLACEHOLDERS = ["year", "site", "page", "n", "query"];
  // text where braces are content, not placeholders
  const SKIP_PLACEHOLDERS = /^(ui\.loader\.labels|pages\.post\.flags)/;

  /* ------------------------------- helpers ------------------------------- */
  const kind = (v) => (Array.isArray(v) ? "array" : v === null ? "null" : typeof v);
  const isObj = (v) => v !== null && typeof v === "object" && !Array.isArray(v);

  function distance(a, b) {
    const m = [];
    for (let i = 0; i <= a.length; i++) m[i] = [i];
    for (let j = 0; j <= b.length; j++) m[0][j] = j;
    for (let i = 1; i <= a.length; i++)
      for (let j = 1; j <= b.length; j++)
        m[i][j] = Math.min(m[i - 1][j] + 1, m[i][j - 1] + 1, m[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
    return m[a.length][b.length];
  }
  function suggest(key, options) {
    let best = null,
      bestD = 99;
    for (const o of options) {
      const d = distance(key.toLowerCase(), o.toLowerCase());
      if (d < bestD) {
        bestD = d;
        best = o;
      }
    }
    return best !== null && bestD <= Math.max(2, Math.floor(key.length / 3)) ? best : null;
  }

  /* --------------------------- structure + types --------------------------- */
  function walk(val, tpl, path, issues) {
    const tk = kind(tpl);
    const vk = kind(val);

    if (tk === "array") {
      if (vk !== "array") return issues.push({ path, message: `should be a list [ ... ], not ${vk}` });
      val.forEach((item, i) => {
        if (tpl.length) walk(item, tpl[0], `${path}[${i}]`, issues);
      });
      return;
    }
    if (tk === "object") {
      if (!isObj(val)) return issues.push({ path, message: `should be an object { ... }, not ${vk}` });
      const known = Object.keys(tpl);
      for (const key of Object.keys(val)) {
        const p = path ? `${path}.${key}` : key;
        if (known.includes(ANY)) {
          walk(val[key], tpl[ANY], p, issues);
        } else if (!(key in tpl)) {
          const hint = suggest(key, known);
          issues.push({ path: p, message: `unknown setting${hint ? ` — did you mean "${hint}"?` : ""}` });
        } else {
          walk(val[key], tpl[key], p, issues);
        }
      }
      return;
    }
    if (vk !== tk) issues.push({ path, message: `should be a ${tk}, not ${vk === "null" ? "null" : "a " + vk}` });
  }

  /* ------------------------------ value checks ------------------------------ */
  function semantic(C, issues) {
    const add = (path, message) => issues.push({ path, message });
    const get = (p) => p.split(".").reduce((o, k) => (o == null ? undefined : o[k]), C);

    // routes
    const R = get("routes");
    if (isObj(R)) {
      const seen = {};
      for (const k of PAGE_KEYS) {
        const v = R[k];
        if (typeof v !== "string") continue;
        if (!/^\/[a-z0-9_-]*$/i.test(v)) add(`routes.${k}`, `"${v}" should look like "/name" (letters, numbers, - and _)`);
        if (k !== "home" && v !== "/") {
          if (seen[v.toLowerCase()]) add(`routes.${k}`, `"${v}" is already used by routes.${seen[v.toLowerCase()]}`);
          seen[v.toLowerCase()] = k;
        }
      }
      if (isObj(R.redirects)) {
        for (const [from, to] of Object.entries(R.redirects)) {
          if (!PAGE_KEYS.includes(to)) add(`routes.redirects.${from}`, `"${to}" is not a page (use one of: ${PAGE_KEYS.join(", ")})`);
          if (seen["/" + from.toLowerCase()]) add(`routes.redirects.${from}`, `"${from}" is a real page slug, so the redirect never applies`);
        }
      }
    }

    // site
    const url = get("site.url");
    if (typeof url === "string" && url) {
      if (!/^https?:\/\/[^\s/]+/i.test(url)) add("site.url", `"${url}" should start with https:// (e.g. "https://you.github.io")`);
      else if (/\/$/.test(url)) add("site.url", "remove the trailing slash");
    }

    // numbers
    for (const p of ["ui.loader.minDuration", "ui.loader.pageChangeDuration", "ui.loader.maxDuration", "ui.loader.slowAfter"]) {
      const v = get(p);
      if (typeof v === "number" && (!isFinite(v) || v < 0 || v > 30000))
        add(p, `${v} is out of range — use milliseconds between 0 and 30000`);
    }
    const lc = get("pages.home.latest.count");
    if (typeof lc === "number" && (lc < 1 || lc > 12)) add("pages.home.latest.count", "use a number between 1 and 12");

    // cursor
    const cur = get("cursor");
    if (typeof cur === "string" && !CURSORS.includes(cur.toLowerCase()))
      add("cursor", `"${cur}" is not a mode — use "ring", "native-ring" or "off"`);

    // nav
    const links = get("nav.links");
    if (Array.isArray(links)) {
      if (!links.length) add("nav.links", "empty — the site would have no navigation");
      links.forEach((l, i) => {
        if (!isObj(l)) return;
        if (!l.label) add(`nav.links[${i}]`, "missing a label");
        if (l.page && !PAGE_KEYS.includes(l.page)) add(`nav.links[${i}].page`, `"${l.page}" is not a page (use one of: ${PAGE_KEYS.join(", ")})`);
        if (!l.page && !l.route) add(`nav.links[${i}]`, 'needs a "page" or a "route"');
        if (l.route && !/^\//.test(l.route)) add(`nav.links[${i}].route`, 'should start with "/"');
      });
    }

    // home page
    const btns = get("pages.home.buttons");
    if (Array.isArray(btns))
      btns.forEach((b, i) => {
        if (!isObj(b)) return;
        if (!b.label) add(`pages.home.buttons[${i}]`, "missing a label");
        if (!b.page && !b.url) add(`pages.home.buttons[${i}]`, 'needs a "page" or a "url"');
        if (b.page && !PAGE_KEYS.includes(b.page)) add(`pages.home.buttons[${i}].page`, `"${b.page}" is not a page`);
        if (b.style && !BUTTON_STYLES.includes(b.style)) add(`pages.home.buttons[${i}].style`, `"${b.style}" — use ${BUTTON_STYLES.join(" | ")}`);
      });
    const cards = get("pages.home.explore.cards");
    if (Array.isArray(cards))
      cards.forEach((c, i) => {
        if (isObj(c) && c.page && !PAGE_KEYS.includes(c.page)) add(`pages.home.explore.cards[${i}].page`, `"${c.page}" is not a page`);
      });
    const chips = get("pages.home.hero.chips");
    if (Array.isArray(chips) && chips.length > 3) add("pages.home.hero.chips", "only the first 3 are shown");

    // about contacts
    const contacts = get("pages.about.contacts");
    if (Array.isArray(contacts))
      contacts.forEach((c, i) => {
        if (!isObj(c)) return;
        const p = `pages.about.contacts[${i}]`;
        if (!c.label) add(p, "missing a label");
        if (c.url == null && c.copy == null) add(p, 'needs a "url" (link) or "copy" (click-to-copy text)');
        if (c.url && !/^(https?:|mailto:|tel:|#|\/)/i.test(c.url)) add(`${p}.url`, "should start with https://, mailto: or tel:");
        if (c.icon && !c.iconSvg && !ICONS.includes(c.icon)) add(`${p}.icon`, `"${c.icon}" — use ${ICONS.join(" | ")}, or supply "iconSvg"`);
      });

    // {placeholders}
    (function scan(v, path) {
      if (typeof v === "string") {
        if (SKIP_PLACEHOLDERS.test(path)) return;
        for (const m of v.matchAll(/\{(\w+)\}/g)) {
          if (!PLACEHOLDERS.includes(m[1])) {
            const hint = suggest(m[1], PLACEHOLDERS);
            add(path, `unknown placeholder {${m[1]}}${hint ? ` — did you mean {${hint}}?` : ""} (available: ${PLACEHOLDERS.map((x) => "{" + x + "}").join(" ")})`);
          }
        }
      } else if (Array.isArray(v)) v.forEach((x, i) => scan(x, `${path}[${i}]`));
      else if (isObj(v)) for (const k of Object.keys(v)) scan(v[k], path ? `${path}.${k}` : k);
    })(C, "");
  }

  /* --------------------------------- run --------------------------------- */
  function checkConfig(config) {
    const issues = [];
    try {
      walk(config, KEYS, "", issues);
      semantic(config, issues);
    } catch (e) {
      issues.push({ path: "(checker)", message: "could not finish checking: " + e.message });
    }
    return issues;
  }

  function show(issues) {
    const box = document.createElement("pre");
    box.style.cssText =
      "position:fixed;left:12px;top:12px;z-index:2147483647;margin:0;padding:12px 16px;max-width:min(94vw,820px);" +
      "max-height:80vh;overflow:auto;font:12px/1.55 monospace;background:#000;color:#0f0;border:1px solid #0f0;" +
      "border-radius:8px;white-space:pre-wrap;opacity:.95";
    box.textContent = issues.length
      ? "config.js — " + issues.length + " issue(s)\n\n" + issues.map((i) => "• " + i.path + "\n    " + i.message).join("\n")
      : "config.js — no problems found ✓";
    document.body.appendChild(box);
    box.addEventListener("click", () => box.remove());
  }

  const issues = checkConfig(CONFIG);
  window.checkConfig = () => checkConfig(CONFIG);
  window.__configIssues = issues;

  if (issues.length && typeof console !== "undefined" && console.groupCollapsed) {
    console.groupCollapsed("%c[config.js] " + issues.length + " issue" + (issues.length === 1 ? "" : "s") + " found", "color:#e8a000;font-weight:bold");
    issues.forEach((i) => console.warn(i.path + ": " + i.message));
    console.info('Add ?debug=config to the address to see this list on the page.');
    console.groupEnd();
  }

  let want = false;
  try {
    want = new URLSearchParams(location.search).get("debug") === "config";
  } catch (e) {}
  if (want) {
    if (document.body) show(issues);
    else document.addEventListener("DOMContentLoaded", () => show(issues));
  }
})();
