/**
 * ===================================================================
 * piezuke_ — Command Palette (⌘K) & Global Search
 * ===================================================================
 * Instant fuzzy search across pages, writeups, projects, and all notes
 * at any directory depth. Keyboard accessible with arrow navigation.
 */

(function () {
  const overlay = document.getElementById("palette-overlay");
  const input = document.getElementById("palette-input");
  const results = document.getElementById("palette-results");
  const openBtn = document.getElementById("cmdk-btn");

  let items = null;
  let activeIndex = 0;

  function buildIndex() {
    items = [];
    if (typeof CONFIG !== "undefined" && Array.isArray(CONFIG.navLinks)) {
      CONFIG.navLinks.forEach((n) =>
        items.push({ title: n.label, tag: "page", route: n.route }),
      );
    }
    if (typeof WRITEUPS !== "undefined" && Array.isArray(WRITEUPS)) {
      WRITEUPS.forEach((w) =>
        items.push({
          title: w.title,
          tag: "writeup",
          route: `/writeups/${w.slug}`,
        }),
      );
    }
    if (typeof PROJECTS !== "undefined" && Array.isArray(PROJECTS)) {
      PROJECTS.forEach((p) =>
        items.push({
          title: p.title,
          tag: "project",
          route: `/projects/${p.slug}`,
        }),
      );
    }
    if (typeof getAllNotes === "function") {
      getAllNotes().forEach((n) =>
        items.push({ title: n.title, tag: "note", route: `/notes/${n.id}` }),
      );
    }
    return items;
  }

  function renderResults(query) {
    const q = (query || "").trim().toLowerCase();
    const list = items || buildIndex();
    const filtered = q
      ? list.filter(
          (i) =>
            (i.title || "").toLowerCase().includes(q) ||
            (i.tag || "").toLowerCase().includes(q),
        )
      : list;

    activeIndex = 0;
    if (filtered.length === 0) {
      const safeQ =
        typeof escapeHTML === "function" ? escapeHTML(query) : query;
      results.innerHTML = `<div class="palette-empty">No matches for "${safeQ}"</div>`;
      return;
    }

    results.innerHTML = filtered
      .map((i, idx) => {
        const safeTitle =
          typeof escapeHTML === "function" ? escapeHTML(i.title) : i.title;
        const safeTag =
          typeof escapeHTML === "function" ? escapeHTML(i.tag) : i.tag;
        const safeRoute =
          typeof escapeHTML === "function" ? escapeHTML(i.route) : i.route;
        return `
        <div class="palette-item${idx === 0 ? " active" : ""}" data-route="${safeRoute}">
          <span>${safeTitle}</span><span class="pi-tag">${safeTag}</span>
        </div>`;
      })
      .join("");
  }

  function move(delta) {
    const nodes = [...results.querySelectorAll(".palette-item")];
    if (nodes.length === 0) return;
    nodes[activeIndex]?.classList.remove("active");
    activeIndex = (activeIndex + delta + nodes.length) % nodes.length;
    nodes[activeIndex]?.classList.add("active");
    nodes[activeIndex]?.scrollIntoView({ block: "nearest" });
  }

  function openSelected() {
    const active = results.querySelector(".palette-item.active");
    if (active) go(active.dataset.route);
  }

  function go(route) {
    if (route) location.hash = "#" + route;
    close();
  }

  let lastFocus = null;

  function open() {
    buildIndex();
    lastFocus = document.activeElement;
    overlay.classList.add("open");
    if (input) {
      input.value = "";
      renderResults("");
      setTimeout(() => input.focus(), 50);
    }
  }

  function close() {
    overlay.classList.remove("open");
    if (lastFocus && typeof lastFocus.focus === "function") {
      try {
        lastFocus.focus({ preventScroll: true });
      } catch (e) {}
    }
  }

  if (openBtn) {
    openBtn.onclick = open;
    openBtn.addEventListener("keydown", (e) => {
      if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        open();
      }
    });
  }

  if (overlay) {
    overlay.addEventListener("click", (e) => {
      if (e.target === overlay) close();
    });
  }

  if (input) {
    input.addEventListener("input", () => renderResults(input.value));
    input.addEventListener("keydown", (e) => {
      if (e.key === "ArrowDown") {
        e.preventDefault();
        move(1);
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        move(-1);
      } else if (e.key === "Enter") {
        e.preventDefault();
        openSelected();
      } else if (e.key === "Escape") {
        close();
      }
    });
  }

  if (results) {
    results.addEventListener("click", (e) => {
      const item = e.target.closest(".palette-item");
      if (item) go(item.dataset.route);
    });
  }

  document.addEventListener("keydown", (e) => {
    const tag = (e.target.tagName || "").toLowerCase();
    const typing =
      tag === "input" || tag === "textarea" || e.target.isContentEditable;
    if (
      (e.key === "k" && (e.metaKey || e.ctrlKey)) ||
      (e.key === "/" && !typing)
    ) {
      e.preventDefault();
      overlay.classList.contains("open") ? close() : open();
    } else if (e.key === "Escape" && overlay.classList.contains("open")) {
      close();
    }
  });

  // Expose toggle globally if needed
  window.toggleCmdk = () =>
    overlay.classList.contains("open") ? close() : open();
})();
