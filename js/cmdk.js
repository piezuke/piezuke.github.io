/**
 * ===================================================================
 * piezuke_ — Command Palette (⌘K) & Global Search
 * ===================================================================
 * Searches pages, writeups, projects and every note (at any folder depth) —
 * titles, tags, summaries AND the full text of each post.
 *
 *   dirty heap          every word must appear somewhere (title, tag, text)
 *   #pwn  /  #pwn heap  filter by tag, optionally combined with words
 *
 * Results highlight the match and show a snippet of surrounding text.
 */
(function () {
  "use strict";
  const overlay = document.getElementById("palette-overlay");
  const input = document.getElementById("palette-input");
  const results = document.getElementById("palette-results");
  const openBtn = document.getElementById("cmdk-btn");
  if (!overlay || !input || !results) return;

  const T = (path, d) => (typeof cfg === "function" ? cfg(path, d) : d);
  const esc = (s) =>
    typeof escapeHTML === "function"
      ? escapeHTML(s)
      : String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
  const routeFor = (page, ...rest) =>
    typeof routeOf === "function"
      ? [routeOf(page).replace(/\/$/, ""), ...rest].join("/")
      : "/" + [page, ...rest].join("/");


  let index = null; // built on first open (and rebuilt if content changes)
  let shown = []; // result descriptors currently on screen
  let activeIndex = 0;
  const MAX_RESULTS = 20;
  const KIND_ORDER = { page: 0, writeup: 1, project: 2, note: 3 };

  /* ------------------------------- indexing ------------------------------- */
  // markdown -> plain searchable text (code is kept: people search for gadgets)
  function plain(md) {
    return String(md || "")
      .replace(/```[^\n]*\n?/g, " ")
      .replace(/!\[[^\]]*\]\([^)]*\)/g, " ")
      .replace(/\[\[([^\]|]+)(?:\|[^\]]*)?\]\]/g, "$1")
      .replace(/\[([^\]]*)\]\([^)]*\)/g, "$1")
      .replace(/<[^>]+>/g, " ")
      .replace(/[#>*`~|]+/g, " ") // keep "_" so identifiers like commit_creds stay searchable
      .replace(/\s+/g, " ")
      .trim();
  }
  const splitTags = (s) =>
    String(s || "")
      .split(/[·,]/)
      .map((t) => t.trim().toLowerCase())
      .filter(Boolean);

  function entry(kind, title, route, extra) {
    const e = Object.assign(
      { kind, title: String(title || ""), route, tags: [], excerpt: "", text: "" },
      extra || {},
    );
    e.titleL = e.title.toLowerCase();
    e.excerptL = e.excerpt.toLowerCase();
    e.textL = e.text.toLowerCase();
    return e;
  }

  function walkNotes(tree, trail, out) {
    for (const node of tree || []) {
      const here = node.folder ? trail.concat(String(node.folder).toLowerCase()) : trail;
      for (const n of node.notes || []) {
        out.push(
          entry("note", n.title, routeFor("notes", n.id), {
            tags: here.slice(),
            text: plain(n.body),
          }),
        );
      }
      walkNotes(node.folders, here, out);
    }
  }

  function buildIndex() {
    const list = [];
    if (typeof getNavLinks === "function") {
      getNavLinks().forEach((n) => list.push(entry("page", n.label, n.route)));
    }
    if (typeof WRITEUPS !== "undefined" && Array.isArray(WRITEUPS)) {
      WRITEUPS.forEach((w) =>
        list.push(
          entry("writeup", w.title, routeFor("writeups", w.slug), {
            tags: splitTags(w.tag).concat((w.pills || []).map((p) => String(p).toLowerCase())),
            excerpt: w.excerpt || "",
            text: plain(w.body),
          }),
        ),
      );
    }
    if (typeof PROJECTS !== "undefined" && Array.isArray(PROJECTS)) {
      PROJECTS.forEach((p) =>
        list.push(
          entry("project", p.title, routeFor("projects", p.slug), {
            tags: splitTags(p.tag).concat((p.pills || []).map((x) => String(x).toLowerCase())),
            excerpt: p.excerpt || "",
            text: plain(p.body),
          }),
        ),
      );
    }
    if (typeof NOTES_TREE !== "undefined") walkNotes(NOTES_TREE, [], list);
    list.forEach((e, i) => (e.i = i));
    index = list;
    return list;
  }

  /* -------------------------------- querying -------------------------------- */
  function parseQuery(q) {
    const tags = [];
    const terms = [];
    String(q || "")
      .toLowerCase()
      .split(/\s+/)
      .filter(Boolean)
      .forEach((tok) => {
        if (tok[0] === "#" && tok.length > 1) tags.push(tok.slice(1));
        else if (tok !== "#") terms.push(tok);
      });
    return { tags, terms };
  }

  const wordStart = (hay, term) => new RegExp("(^|[^a-z0-9])" + term.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")).test(hay);

  function scoreEntry(e, tags, terms) {
    for (const tf of tags) if (!e.tags.some((t) => t.includes(tf))) return 0;
    if (!terms.length) return 1;
    let total = 0;
    for (const term of terms) {
      let s = 0;
      if (e.titleL === term) s += 30;
      else if (e.titleL.startsWith(term)) s += 20;
      else if (wordStart(e.titleL, term)) s += 14;
      else if (e.titleL.includes(term)) s += 10;
      if (e.tags.some((t) => t === term)) s += 8;
      else if (e.tags.some((t) => t.includes(term))) s += 5;
      if (e.excerptL.includes(term)) s += 4;
      const at = e.textL.indexOf(term);
      if (at >= 0) {
        s += 2;
        const again = e.textL.indexOf(term, at + term.length);
        if (again >= 0) s += 1;
      }
      if (s === 0) return 0; // every word has to match something
      total += s;
    }
    return total;
  }

  // <mark> every occurrence of the terms in `str` (escaped, safe HTML)
  function markHtml(str, terms) {
    const lower = str.toLowerCase();
    const ranges = [];
    for (const term of terms) {
      if (!term) continue;
      let i = lower.indexOf(term);
      while (i !== -1) {
        ranges.push([i, i + term.length]);
        i = lower.indexOf(term, i + term.length);
      }
    }
    if (!ranges.length) return esc(str);
    ranges.sort((a, b) => a[0] - b[0]);
    const merged = [ranges[0].slice()];
    for (const r of ranges.slice(1)) {
      const last = merged[merged.length - 1];
      if (r[0] <= last[1]) last[1] = Math.max(last[1], r[1]);
      else merged.push(r.slice());
    }
    let out = "";
    let pos = 0;
    for (const [a, b] of merged) {
      out += esc(str.slice(pos, a)) + "<mark>" + esc(str.slice(a, b)) + "</mark>";
      pos = b;
    }
    return out + esc(str.slice(pos));
  }

  function snippetFor(e, terms) {
    if (!terms.length) return "";
    if (terms.every((t) => e.titleL.includes(t))) return ""; // title already shows the match
    for (const field of [e.excerpt, e.text]) {
      const lower = field.toLowerCase();
      const hitTerm = terms.find((t) => lower.includes(t));
      if (!hitTerm) continue;
      const i = lower.indexOf(hitTerm);
      const a = Math.max(0, i - 40);
      const b = Math.min(field.length, i + hitTerm.length + 70);
      return (a > 0 ? "…" : "") + markHtml(field.slice(a, b), terms) + (b < field.length ? "…" : "");
    }
    return "";
  }

  function topTags(n) {
    const freq = new Map();
    for (const e of index) {
      if (e.kind !== "writeup" && e.kind !== "project") continue;
      for (const t of e.tags) freq.set(t, (freq.get(t) || 0) + 1);
    }
    return [...freq.entries()]
      .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
      .slice(0, n)
      .map((x) => x[0]);
  }

  /* -------------------------------- rendering -------------------------------- */
  const tagLabel = (kind) => T("ui.search.tags." + kind, kind);

  function compute(query) {
    const list = index || buildIndex();
    const { tags, terms } = parseQuery(query);
    const out = [];

    const q = String(query || "").trim();
    let scored;
    if (!tags.length && !terms.length) {
      scored = list.map((e) => ({ e, s: 1 }));
    } else {
      scored = [];
      for (const e of list) {
        const s = scoreEntry(e, tags, terms);
        if (s > 0) scored.push({ e, s });
      }
    }
    scored.sort((a, b) => b.s - a.s || (KIND_ORDER[a.e.kind] || 0) - (KIND_ORDER[b.e.kind] || 0) || a.e.i - b.e.i);
    for (const { e } of scored.slice(0, MAX_RESULTS)) {
      out.push({
        type: "route",
        route: e.route,
        titleHtml: markHtml(e.title, terms),
        snippetHtml: q ? snippetFor(e, terms) : "",
        tag: tagLabel(e.kind),
      });
    }
    return { out, tags, terms };
  }

  function renderResults(query) {
    const q = String(query || "");
    const { out } = compute(q);
    shown = out;
    activeIndex = 0;
    input.setAttribute("aria-expanded", String(out.length > 0 && overlay.classList.contains("open")));

    let html = "";
    if (!q.trim() && index) {
      const chips = topTags(8);
      if (chips.length) {
        html +=
          `<div class="palette-tags" role="group" aria-label="${esc(T("ui.search.tagsLabel", "tags"))}">` +
          `<span class="palette-tags-label">${esc(T("ui.search.tagsLabel", "tags"))}</span>` +
          chips
            .map((c) => `<button type="button" class="palette-chip" data-q="#${esc(c)}">#${esc(c)}</button>`)
            .join("") +
          `</div>`;
      }
    }

    if (!out.length) {
      const tpl = T("ui.search.empty", 'No matches for "{query}"');
      html += `<div class="palette-empty">${esc(tpl).replace("{query}", esc(q))}</div>`;
      results.innerHTML = html;
      results.removeAttribute("aria-activedescendant");
      return;
    }

    html += out
      .map(
        (r, i) =>
          `<div class="palette-item${i === 0 ? " active" : ""}" id="pi-${i}" role="option" aria-selected="${i === 0}" data-i="${i}">` +
          `<span class="pi-main"><span class="pi-title">${r.titleHtml}</span>` +
          (r.snippetHtml ? `<span class="pi-snippet">${r.snippetHtml}</span>` : "") +
          `</span><span class="pi-tag">${esc(r.tag)}</span></div>`,
      )
      .join("");
    results.innerHTML = html;
    results.setAttribute("aria-activedescendant", "pi-0");
  }

  function setActive(i) {
    const nodes = [...results.querySelectorAll(".palette-item")];
    if (!nodes.length) return;
    nodes[activeIndex] && nodes[activeIndex].classList.remove("active");
    nodes[activeIndex] && nodes[activeIndex].setAttribute("aria-selected", "false");
    activeIndex = (i + nodes.length) % nodes.length;
    const n = nodes[activeIndex];
    n.classList.add("active");
    n.setAttribute("aria-selected", "true");
    results.setAttribute("aria-activedescendant", n.id);
    n.scrollIntoView({ block: "nearest" });
  }

  function choose(i) {
    const r = shown[i];
    if (!r) return;
    close();
    if (r.type === "route") {
      if (typeof markLinkNav === "function") markLinkNav();
      location.hash = "#" + r.route;
    } else if (typeof r.run === "function") {
      r.run();
    }
  }

  /* ------------------------------- open / close ------------------------------- */
  let lastFocus = null;

  function open() {
    buildIndex();
    lastFocus = document.activeElement;
    overlay.classList.add("open");
    input.value = "";
    renderResults("");
    input.setAttribute("aria-expanded", "true");
    setTimeout(() => input.focus(), 50);
  }
  function close() {
    overlay.classList.remove("open");
    input.setAttribute("aria-expanded", "false");
    if (lastFocus && typeof lastFocus.focus === "function") {
      try {
        lastFocus.focus({ preventScroll: true });
      } catch (e) {}
    }
  }
  const isOpen = () => overlay.classList.contains("open");

  if (openBtn) {
    openBtn.onclick = open;
    openBtn.addEventListener("keydown", (e) => {
      if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        open();
      }
    });
  }
  overlay.addEventListener("click", (e) => {
    if (e.target === overlay) close();
  });

  input.setAttribute("role", "combobox");
  input.setAttribute("aria-controls", "palette-results");
  input.setAttribute("aria-autocomplete", "list");
  input.setAttribute("aria-expanded", "false"); // required by role=combobox; true while the result list is showing
  results.setAttribute("role", "listbox");

  input.addEventListener("input", () => renderResults(input.value));
  input.addEventListener("keydown", (e) => {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActive(activeIndex + 1);
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActive(activeIndex - 1);
    } else if (e.key === "Enter") {
      e.preventDefault();
      choose(activeIndex);
    } else if (e.key === "Escape") {
      close();
    }
  });

  results.addEventListener("click", (e) => {
    const chip = e.target.closest(".palette-chip");
    if (chip) {
      input.value = chip.dataset.q + " ";
      renderResults(input.value);
      input.focus();
      return;
    }
    const item = e.target.closest(".palette-item");
    if (item) choose(parseInt(item.dataset.i, 10));
  });

  document.addEventListener("keydown", (e) => {
    const tag = (e.target.tagName || "").toLowerCase();
    const typing = tag === "input" || tag === "textarea" || e.target.isContentEditable;
    if ((e.key === "k" && (e.metaKey || e.ctrlKey)) || (e.key === "/" && !typing)) {
      e.preventDefault();
      isOpen() ? close() : open();
    } else if (e.key === "Escape" && isOpen()) {
      close();
    }
  });

  window.toggleCmdk = () => (isOpen() ? close() : open());
  window.PaletteAPI = { open, close, search: (q) => compute(q).out };
})();
