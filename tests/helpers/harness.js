/**
 * Test harness: loads the real index.html in jsdom and runs the real scripts,
 * in the same order index.html lists them (so it can never drift out of sync).
 */
const { JSDOM, VirtualConsole } = require("jsdom");
const fs = require("fs");
const path = require("path");

const ROOT = path.resolve(__dirname, "..", "..");

// every window opened by a test is closed when the file finishes, even if an
// assertion threw first (open windows keep their timers/animation loops alive)
const opened = new Set();
function closeAll() {
  for (const w of opened) {
    try { w.close(); } catch (e) {}
  }
  opened.clear();
}
try {
  require("node:test").after(closeAll);
} catch (e) {}
process.on("exit", closeAll);
const read = (f) => fs.readFileSync(path.join(ROOT, f), "utf8");
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// scripts in the order the page loads them
function scriptsOf(html) {
  // the built site adds ?v=<hash> to every script URL; the files themselves have no query
  return [...html.matchAll(/<script\s+defer\s+src="([^"]+)"/g)].map((m) => m[1].split("?")[0]);
}

// jsdom runs each eval in its own lexical scope; browsers share one for
// top-level const/let across <script> tags. Make them globals to match.
const globalize = (src) => src.replace(/^const /gm, "var ").replace(/^let /gm, "var ");

/**
 * load({
 *   hash: "#/",            page route
 *   search: "",            "?cursor=off" etc
 *   file: "index.html",    or a generated per-post page
 *   config: "",            JS run right after config.js (e.g. CONFIG.site.name='x')
 *   data: null,            replacement for data.js source (fixtures)
 *   only: null,            run only these scripts (names or substrings)
 *   media: {},             matchMedia results by substring
 *   storage: {},           pre-filled localStorage
 *   canvas: false,         keep the real <canvas> 2D context
 * })
 */
function load(opts = {}) {
  const o = Object.assign({ hash: "#/", search: "", file: "index.html", config: "", data: null, only: null, media: {}, storage: {}, root: ROOT, runInline: false }, opts);
  const errors = [];
  const vc = new VirtualConsole();
  vc.on("jsdomError", (e) => {
    if (!/Not implemented/.test(e.message)) errors.push(e.message.split("\n")[0]);
  });
  const logs = [];
  vc.on("log", (m) => logs.push(String(m)));
  vc.on("warn", (m) => logs.push("warn: " + m));

  const html = fs.readFileSync(path.join(o.root, o.file), "utf8");
  const dom = new JSDOM(html.replace(/<script\s+defer\s+src="[^"]+"><\/script>/g, ""), {
    url: "http://localhost/" + (o.file === "index.html" ? "" : o.file) + o.search + o.hash,
    runScripts: "outside-only",
    pretendToBeVisual: true,
    virtualConsole: vc,
  });
  const w = dom.window;
  opened.add(w);
  // window size the scripts see; tests may change w.__vp later (then fire "resize")
  w.__vp = Object.assign({ w: 1024, h: 768 }, o.viewport || {});
  Object.defineProperty(w, "innerWidth", { get: () => w.__vp.w, configurable: true });
  Object.defineProperty(w, "innerHeight", { get: () => w.__vp.h, configurable: true });

  for (const [k, v] of Object.entries(o.storage)) w.localStorage.setItem(k, v);
  w.matchMedia = (q) => {
    let matches = false;
    for (const [k, v] of Object.entries(o.media)) if (q.includes(k)) matches = v;
    return { matches, media: q, addEventListener() {}, removeEventListener() {}, addListener() {}, removeListener() {} };
  };
  w.IntersectionObserver = class {
    observe() {}
    unobserve() {}
    disconnect() {}
  };
  w.Element.prototype.scrollIntoView = function () {
    w.__scrolledTo = this;
  };
  w.Element.prototype.animate = () => ({ cancel() {} });
  w.HTMLMediaElement.prototype.play = () => Promise.resolve();
  w.HTMLMediaElement.prototype.pause = () => {};
  w.scrollTo = () => {};
  w.eval("window.__errors=[];window.addEventListener('error',function(e){window.__errors.push(e.message)})");

  if (o.runInline) {
    // plain inline <script> blocks (theme-before-paint, per-post boot script)
    for (const m of html.matchAll(/<script(?![^>]*\b(?:src|type)=)[^>]*>([\s\S]*?)<\/script>/g)) {
      try { w.eval(m[1]); } catch (e) { errors.push("inline: " + e.message); }
    }
  }
  const order = scriptsOf(html);
  for (const src of order) {
    if (o.only && !o.only.some((n) => src.includes(n))) continue;
    // GSAP & co. need real layout/GPU and only decorate; evaluating ~125 KB of
    // minified code would also skew the loader timing tests. fx.js still loads
    // and must cope with their absence.
    if (!o.withMotion && /(gsap|ScrollTrigger|SplitText)\.min\.js$/.test(src)) continue;
    let code = src === "data.js" && o.data != null ? o.data : fs.readFileSync(path.join(o.root, src), "utf8");
    if (src.endsWith("marked.min.js")) {
      try { w.eval(code); } catch (e) { errors.push(src + ": " + e.message); }
      continue;
    }
    code = globalize(code);
    if (src === "config.js" && o.config) code += "\n" + o.config;
    try {
      w.eval(code);
    } catch (e) {
      errors.push(src + ": " + e.message);
    }
  }
  return {
    window: w,
    document: w.document,
    logs,
    errors: () => errors.concat(w.__errors || []),
    close: () => w.close(),
    text: (sel) => ((w.document.querySelector(sel) || {}).textContent || "").replace(/\s+/g, " ").trim(),
  };
}

// small fixtures used across tests
const FIXTURE_DATA = `
var WRITEUPS = [
  { slug: "heap-overflow", title: "Heap Overflow 101", tag: "pwn · heap", date: "2025 November",
    excerpt: "Overwriting a chunk header.", pills: ["Pwn"], meta: { ctf: "PicoCTF 2026", category: "pwn", points: "500" },
    body: "## Summary\\n\\nWe abuse a malloc bug. Flag: bi0s{h34p_0v3rfl0w_w1n5}\\n\\n\`\`\`c\\n#include <stdio.h>\\nint main(){ return 0; }\\n\`\`\`\\n\\n## Exploit\\n\\nUse tcache poisoning with a ROP gadget.\\n\\n### Details\\n\\nmore text" },
  { slug: "web-sqli", title: "Blind SQLi", tag: "web", date: "2025 June", excerpt: "Time based.", pills: [], body: "## Intro\\n\\nunion select payload" }
];
var PROJECTS = [
  { slug: "tiny-os", title: "Tiny OS", tag: "c · os", date: "2025 July", excerpt: "A hobby kernel.", pills: ["C"], body: "# Tiny OS\\n\\nA hobby kernel with a bootloader." }
];
var NOTES_TREE = [
  { folder: "general", notes: [ { id: "kernel-rop", title: "Kernel ROP", body: "# Kernel ROP\\n\\nuse commit_creds and prepare_kernel_cred" } ], folders: [
    { folder: "pwn", notes: [ { id: "tcache", title: "Tcache notes", body: "# Tcache\\n\\nsafe-linking mitigation" } ], folders: [] } ] }
];
`;

module.exports = { load, sleep, ROOT, read, FIXTURE_DATA, scriptsOf, closeAll };

// manage.js runs main() on load, so read its helpers without running the CLI
function loadManage() {
  const src = fs.readFileSync(path.join(ROOT, "manage.js"), "utf8").replace(/^#!.*\n/, "").replace(/\nmain\(\)[\s\S]*$/, "");
  const m = {};
  new Function("require", "module", "process", "__dirname", src + ";module.exports={parseFrontmatter,serializeFrontmatter,toISODate,extraMetaFrom,parseExtraText,compareEntriesNewestFirst,renderMarkdownSafe,readEntries,safeFileName,routeSlugFor}")(
    require("node:module").createRequire(path.join(ROOT, "manage.js")), m, process, ROOT,
  );
  return m.exports;
}
module.exports.loadManage = loadManage;
