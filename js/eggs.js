/**
 * ===================================================================
 * piezuke_ — hidden flag hunt
 * ===================================================================
 * Everything (flags, hints, messages, commands) is configured in
 * config.js -> easterEggs. Progress is kept in this browser only.
 *
 * Ways to find a flag:
 *   - console   printed in the browser console
 *   - konami    ↑ ↑ ↓ ↓ ← → ← → B A
 *   - avatar    click the profile picture N times quickly
 *   - command   type commands into the search box ("help" lists some)
 *   - source    hidden (base64) in a comment in index.html
 *   - loader    shows up on the loading screen sooner or later
 * Any flag can be pasted into the search box to claim it; "flags" there shows
 * progress and hints.
 */
(function () {
  "use strict";
  if (typeof cfg !== "function" || typeof fmt !== "function") return;
  const E = cfg("easterEggs", null);
  if (!E || E.enabled === false) return;

  const flags = Array.isArray(E.flags) ? E.flags.filter((f) => f && f.id && f.flag) : [];
  if (!flags.length) return;
  const T = E.toast || {};
  const L = E.labels || {};
  const KEY = E.storageKey || "pie-flags";

  /* ------------------------------ progress ------------------------------ */
  let found = new Set();
  try {
    const raw = JSON.parse(localStorage.getItem(KEY) || "[]");
    if (Array.isArray(raw)) found = new Set(raw.filter((id) => flags.some((f) => f.id === id)));
  } catch (e) {}
  const save = () => {
    try {
      localStorage.setItem(KEY, JSON.stringify([...found]));
    } catch (e) {}
  };
  const byId = (id) => flags.find((f) => f.id === id);
  const byValue = (v) => flags.find((f) => f.flag === v);
  const counts = () => ({ found: found.size, total: flags.length });

  /* -------------------------------- toast -------------------------------- */
  let toastEl = null;
  let toastTimer = 0;
  function toast(text, ms) {
    if (!text) return;
    if (!toastEl) {
      toastEl = document.createElement("div");
      toastEl.className = "egg-toast";
      toastEl.setAttribute("role", "status");
      toastEl.setAttribute("aria-live", "polite");
      document.body.appendChild(toastEl);
    }
    toastEl.textContent = text;
    toastEl.classList.add("show");
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => toastEl.classList.remove("show"), ms || 4200);
  }

  function award(id) {
    const f = byId(id);
    if (!f) return false;
    if (found.has(id)) {
      toast(fmt(T.again || "you already have that one"));
      return false;
    }
    found.add(id);
    save();
    const c = counts();
    const msg =
      fmt(T.found || "flag found → {flag}", { flag: f.flag }) +
      "   ·   " +
      (c.found === c.total
        ? fmt(T.all || "all {total} flags", c)
        : fmt(T.progress || "{found}/{total} flags", c));
    toast(msg, 6000);
    return true;
  }

  /* ------------------------------ 1. console ------------------------------ */
  try {
    const cf = byId("console");
    if (Array.isArray(E.consoleArt) && E.consoleArt.length)
      console.log("%c" + E.consoleArt.join("\n"), "color:#888;font-family:monospace;font-size:12px");
    if (E.consoleMessage)
      console.log(
        "%c" + String(E.consoleMessage).replace("{flag}", cf ? cf.flag : ""),
        "color:#aaa;font-family:monospace;font-size:12px",
      );
  } catch (e) {}

  /* ------------------------------ 2. konami ------------------------------ */
  const SEQ = ["arrowup", "arrowup", "arrowdown", "arrowdown", "arrowleft", "arrowright", "arrowleft", "arrowright", "b", "a"];
  let pos = 0;
  document.addEventListener("keydown", (e) => {
    const t = e.target;
    if (t && (t.isContentEditable || /^(input|textarea|select)$/i.test(t.tagName || ""))) return;
    const k = String(e.key || "").toLowerCase();
    if (k === SEQ[pos]) {
      pos++;
      if (pos === SEQ.length) {
        pos = 0;
        award("konami");
      }
    } else {
      pos = k === SEQ[0] ? 1 : 0;
    }
  });

  /* ------------------------------ 3. avatar ------------------------------ */
  const need = Math.max(2, parseInt((byId("avatar") || {}).clicks, 10) || 7);
  let hits = [];
  document.addEventListener("click", (e) => {
    const img = e.target && e.target.closest ? e.target.closest(".hero-avatar-img, .hero-avatar") : null;
    if (!img) return;
    const now = Date.now();
    hits = hits.filter((t) => now - t < 5000);
    hits.push(now);
    if (hits.length >= need) {
      hits = [];
      award("avatar");
    }
  });

  /* ------------------------------ 4. loader ------------------------------ */
  const loaderLabel = document.getElementById("loaderlabel");
  function checkLoaderText() {
    if (!loaderLabel) return;
    const txt = loaderLabel.textContent || "";
    for (const f of flags) if (txt.indexOf(f.flag) !== -1) award(f.id);
  }
  if (loaderLabel && typeof MutationObserver === "function") {
    new MutationObserver(checkLoaderText).observe(loaderLabel, {
      childList: true,
      characterData: true,
      subtree: true,
    });
    checkLoaderText();
  }

  /* ------------------- 5. search-box commands & submissions ------------------- */
  const norm = (s) => String(s || "").trim().toLowerCase().replace(/\s+/g, " ");
  const commands = Array.isArray(E.commands) ? E.commands : [];

  function provider(query) {
    const raw = String(query || "").trim();
    if (!raw) return [];
    const q = norm(raw);
    const out = [];

    // a flag pasted in?
    const hit = byValue(raw);
    if (hit || /^[A-Za-z0-9_]{1,24}\{[^{}\s]{1,200}\}$/.test(raw)) {
      out.push({
        title: fmt(L.submit || "submit this flag"),
        snippet: raw,
        tag: L.flagTag || "flag",
        run() {
          const f = byValue(raw);
          if (f) award(f.id);
          else toast(fmt(T.wrong || "not a flag I know"));
        },
      });
      return out;
    }

    // progress + hints
    if (q === "flags") {
      const c = counts();
      out.push({
        title: fmt(L.flagsTitle || "{found}/{total} flags found", c),
        tag: L.flagTag || "flag",
        run() {
          toast(fmt(T.progress || "{found}/{total} flags", c));
        },
      });
      for (const f of flags) {
        const ok = found.has(f.id);
        out.push({
          title: (ok ? (L.foundMark || "✓") + " " + f.id : "? " + f.id),
          snippet: ok ? f.flag : (L.hintPrefix || "hint") + ": " + (f.hint || ""),
          tag: L.flagTag || "flag",
          run() {
            toast(ok ? f.flag : (L.hintPrefix || "hint") + ": " + (f.hint || ""));
          },
        });
      }
      return out;
    }

    for (const c of commands) {
      if (norm(c.input) === q) {
        out.push({
          title: "$ " + c.input,
          snippet: c.output,
          tag: L.commandTag || "cmd",
          run() {
            toast(c.output);
            if (c.flag) award(c.flag);
          },
        });
      }
    }
    return out;
  }

  window.PaletteProviders = window.PaletteProviders || [];
  window.PaletteProviders.push(provider);

  // exposed for tests / curious people
  window.__flagHunt = { award, counts, found: () => [...found] };
})();
