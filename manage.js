#!/usr/bin/env node

/**
 * ===================================================================
 * piezuke_ content manager & publisher tool
 * ===================================================================
 * Manage writeups, projects, and notes (with folder path support).
 *
 * Usage:
 *   node manage.js               - Interactive CLI menu
 *   node manage.js sync          - Scan content/ and update data.js
 *   node manage.js watch         - Auto-sync data.js on file changes
 *   node manage.js export        - Export current data.js to content/ files
 *   node manage.js list          - List all writeups, projects, notes
 *   node manage.js add note      - Add a new note (prompts for folder path)
 *   node manage.js add writeup   - Add a new writeup
 *   node manage.js add project   - Add a new project
 *   node manage.js ui            - Launch local browser GUI (port 8088)
 *   node manage.js seo           - Regenerate per-post pages, sitemap.xml, feed.xml
 *                                  (also runs automatically after every sync)
 *   node manage.js csp           - Re-hash the inline <script>s into the Content-Security-Policy
 *                                  (index.html, 404.html, _headers). Run it after editing one.
 */

const fs = require("fs");
const path = require("path");
const readline = require("readline");
const http = require("http");
const crypto = require("crypto");

const ROOT_DIR = __dirname;
const CONTENT_DIR = path.join(ROOT_DIR, "content");
const WRITEUPS_DIR = path.join(CONTENT_DIR, "writeups");
const PROJECTS_DIR = path.join(CONTENT_DIR, "projects");
const NOTES_DIR = path.join(CONTENT_DIR, "notes");
const DATA_FILE = path.join(ROOT_DIR, "data.js");
const CONFIG_FILE = path.join(ROOT_DIR, "config.js");
const INDEX_FILE = path.join(ROOT_DIR, "index.html");
const SEO_MANIFEST = path.join(ROOT_DIR, ".seo-manifest.json");

// Ensure content directories exist
function ensureDirs() {
  [CONTENT_DIR, WRITEUPS_DIR, PROJECTS_DIR, NOTES_DIR].forEach((dir) => {
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  });
}

// Slugify helper
function slugify(text) {
  return String(text || "")
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, "")
    .replace(/[\s_-]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function safeContentSlug(value) {
  const slug = slugify(value);
  if (!slug) throw new Error("Slug must contain a letter or number");
  return slug;
}

function safeNoteId(value) {
  const id = slugify(value);
  if (!id) throw new Error("Note ID must contain a letter or number");
  return id;
}

function escapeHTML(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

/* ---- Content-Security-Policy: hash every inline <script> instead of allowing 'unsafe-inline' ---- */
const CSP_META_RE = /(http-equiv="Content-Security-Policy"\s+content=")([^"]*)(")/i;

function inlineScriptHashes(html) {
  const out = [];
  const re = /<script(?![^>]*\bsrc\s*=)([^>]*)>([\s\S]*?)<\/script>/gi;
  let m;
  while ((m = re.exec(html))) {
    const type = (m[1].match(/\btype\s*=\s*["']?([^"'\s>]+)/i) || [])[1];
    if (type && !/^(text\/javascript|application\/javascript|module)$/i.test(type)) continue; // JSON-LD etc. never runs
    out.push("'sha256-" + crypto.createHash("sha256").update(m[2], "utf8").digest("base64") + "'");
  }
  return out;
}

function syncCspHashes() {
  const changed = [];
  const read = (f) => fs.readFileSync(f, "utf8");
  const write = (f, txt) => {
    if (read(f) !== txt) {
      fs.writeFileSync(f, txt);
      changed.push(path.basename(f));
    }
  };

  // index.html: keep every directive, replace only script-src
  let html = read(INDEX_FILE);
  const hashes = inlineScriptHashes(html);
  const m = html.match(CSP_META_RE);
  if (!m) throw new Error("index.html has no Content-Security-Policy <meta>");
  const policy = m[2].replace(/script-src[^;]*;/, `script-src 'self'${hashes.length ? " " + hashes.join(" ") : ""};`);
  html = html.replace(CSP_META_RE, (_, a, __, c) => a + policy + c);
  write(INDEX_FILE, html);

  // _headers: same policy + frame-ancestors (only a real header can set that one)
  const headersFile = path.join(ROOT_DIR, "_headers");
  if (fs.existsSync(headersFile)) {
    const h = read(headersFile).replace(/(Content-Security-Policy:\s*)(.+)/, (_, a) => a + policy.trim() + " frame-ancestors 'none';");
    write(headersFile, h);
  }

  // 404.html: a tiny redirect page; it may run its own script and nothing else
  const f404 = path.join(ROOT_DIR, "404.html");
  if (fs.existsSync(f404)) {
    let t = read(f404);
    const h404 = inlineScriptHashes(t);
    const csp404 = `default-src 'none'; script-src ${h404.join(" ") || "'none'"}; base-uri 'none'; form-action 'none';`;
    const tag = `<meta http-equiv="Content-Security-Policy" content="${csp404}" />`;
    t = CSP_META_RE.test(t) ? t.replace(/<meta\s+http-equiv="Content-Security-Policy"[^>]*>/i, tag) : t.replace(/(<meta charset="UTF-8"\s*\/?>)/i, `$1\n        ${tag}`);
    write(f404, t);
  }
  return { hashes, changed };
}

function resolveNotesFolder(folder) {
  const notesRoot = fs.realpathSync(NOTES_DIR);
  const folderPath = path.resolve(notesRoot, String(folder || ""));
  const relative = path.relative(notesRoot, folderPath);
  if (
    relative.startsWith(`..${path.sep}`) ||
    relative === ".." ||
    path.isAbsolute(relative)
  ) {
    throw new Error("Note folders must stay inside the notes directory");
  }

  let current = notesRoot;
  for (const part of relative.split(path.sep).filter(Boolean)) {
    current = path.join(current, part);
    if (fs.existsSync(current) && fs.lstatSync(current).isSymbolicLink()) {
      throw new Error("Note folders cannot use symbolic links");
    }
  }
  return folderPath;
}

// "text with \"quotes\"" -> text with "quotes"   ('it''s' -> it's)
function unquoteYamlScalar(val) {
  const v = String(val);
  if (v.length >= 2 && v.startsWith('"') && v.endsWith('"')) {
    return v
      .slice(1, -1)
      .replace(/\\(["\\n])/g, (m, c) => (c === "n" ? "\n" : c));
  }
  if (v.length >= 2 && v.startsWith("'") && v.endsWith("'")) {
    return v.slice(1, -1).replace(/''/g, "'");
  }
  return v.replace(/^['"]|['"]$/g, "");
}

// Simple YAML frontmatter parser
function parseFrontmatter(raw) {
  const content = String(raw || "");
  if (!content.startsWith("---")) {
    return { meta: {}, body: content.trim() };
  }
  const match = content.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n?([\s\S]*)$/);
  if (!match) {
    return { meta: {}, body: content.trim() };
  }
  const yamlBlock = match[1];
  const body = match[2].trim();
  const meta = {};

  let currentKey = null;
  const lines = yamlBlock.split(/\r?\n/);
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;

    if (
      trimmed.startsWith("- ") &&
      currentKey &&
      Array.isArray(meta[currentKey])
    ) {
      meta[currentKey].push(
        trimmed
          .slice(2)
          .trim()
          .replace(/^['"]|['"]$/g, ""),
      );
      continue;
    }

    const colonIdx = line.indexOf(":");
    if (colonIdx !== -1) {
      const key = line.slice(0, colonIdx).trim();
      let val = line.slice(colonIdx + 1).trim();

      if (!val) {
        meta[key] = [];
        currentKey = key;
        continue;
      }

      currentKey = key;
      if (val.startsWith("[") && val.endsWith("]")) {
        meta[key] = val
          .slice(1, -1)
          .split(",")
          .map((s) => s.trim().replace(/^['"]|['"]$/g, ""))
          .filter(Boolean);
      } else {
        meta[key] = unquoteYamlScalar(val);
      }
    }
  }

  return { meta, body };
}

// YAML frontmatter serializer
function serializeFrontmatter(meta, body) {
  let yaml = "---\n";
  for (const [key, value] of Object.entries(meta)) {
    if (value === undefined || value === null) continue;
    if (Array.isArray(value)) {
      yaml += `${key}:\n`;
      for (const item of value) {
        yaml += `  - ${item}\n`;
      }
    } else {
      const strVal = String(value);
      if (
        strVal.includes(":") ||
        strVal.includes("\n") ||
        strVal.includes('"') ||
        strVal.includes("'")
      ) {
        yaml += `${key}: "${strVal
          .replace(/\\/g, "\\\\")
          .replace(/"/g, '\\"')
          .replace(/\r?\n/g, "\\n")}"\n`;
      } else {
        yaml += `${key}: ${strVal}\n`;
      }
    }
  }
  yaml += "---\n\n";
  return yaml + (body || "").trim() + "\n";
}

// Find all files in a directory recursively
function findFilesRecursive(dir) {
  let results = [];
  if (!fs.existsSync(dir)) return results;
  const list = fs.readdirSync(dir);
  for (const file of list) {
    const fullPath = path.join(dir, file);
    const stat = fs.lstatSync(fullPath);
    if (stat.isSymbolicLink()) continue;
    if (stat && stat.isDirectory()) {
      results = results.concat(findFilesRecursive(fullPath));
    } else if (file.endsWith(".md")) {
      results.push(fullPath);
    }
  }
  return results;
}

// Extract title from markdown heading
function extractHeading(body) {
  const match = body.match(/^#\s+(.+)$/m);
  return match ? match[1].trim() : null;
}

// ---------------------------------------------------------------------------
// ENTRIES (writeups / projects): shared reader
// ---------------------------------------------------------------------------
// Frontmatter keys with a fixed meaning. Any OTHER key (ctf, category, points,
// difficulty, ...) is kept as free-form `meta` and shown in the post header.
const KNOWN_META = new Set([
  "title", "slug", "tag", "date", "excerpt", "pills", "image", "draft", "updated", "id",
]);
const MONTHS = ["jan","feb","mar","apr","may","jun","jul","aug","sep","oct","nov","dec"];

// "2025-06", "2025 June", "June 2025", "2025-06-14"  ->  "2025-06-01" (or null)
function toISODate(value) {
  const str = String(value == null ? "" : value).trim();
  if (!str) return null;
  const pad = (n) => String(n).padStart(2, "0");
  let m = str.match(/^(\d{4})-(\d{1,2})(?:-(\d{1,2}))?/);
  if (m) return `${m[1]}-${pad(+m[2])}-${pad(+(m[3] || 1))}`;
  m = str.match(/^(\d{4})\D+([A-Za-z]{3,})/) || str.match(/^([A-Za-z]{3,})\D+(\d{4})/);
  if (m) {
    const yearFirst = /^\d/.test(m[1]);
    const year = yearFirst ? m[1] : m[2];
    const mon = MONTHS.indexOf((yearFirst ? m[2] : m[1]).slice(0, 3).toLowerCase());
    if (mon >= 0) return `${year}-${pad(mon + 1)}-01`;
  }
  m = str.match(/^(\d{4})$/);
  if (m) return `${m[1]}-01-01`;
  const t = Date.parse(str);
  if (!isNaN(t)) {
    const d = new Date(t);
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  }
  return null;
}

function compareEntriesNewestFirst(a, b) {
  const da = toISODate(a.date),
    db = toISODate(b.date);
  if (da && db && da !== db) return db.localeCompare(da);
  return String(b.date).localeCompare(String(a.date));
}

function isTruthy(v) {
  return /^(true|yes|1|on)$/i.test(String(v == null ? "" : v).trim());
}

function extraMetaFrom(meta) {
  const out = {};
  for (const [k, v] of Object.entries(meta || {})) {
    if (KNOWN_META.has(k)) continue;
    if (!/^[A-Za-z][\w -]{0,30}$/.test(k)) continue;
    const val = Array.isArray(v) ? v.join(", ") : String(v == null ? "" : v);
    const clean = val.trim().slice(0, 200);
    if (clean) out[k.trim()] = clean;
  }
  return out;
}

// "ctf: PicoCTF\ncategory: pwn" (UI textarea) or {ctf:"x"} -> meta object
function parseExtraText(text) {
  const meta = {};
  for (const line of String(text || "").split(/\r?\n/)) {
    const i = line.indexOf(":");
    if (i < 1) continue;
    meta[line.slice(0, i).trim()] = line.slice(i + 1).trim();
  }
  return extraMetaFrom(meta);
}

// --ctf X --category pwn --points 500 --difficulty hard --meta "a=b,c=d" --draft --image x.png
function metaFromFlags(flags) {
  const extra = {};
  for (const k of ["ctf", "category", "points", "difficulty", "solves"]) {
    if (flags[k] && flags[k] !== true) extra[k] = String(flags[k]);
  }
  if (flags.meta && flags.meta !== true) {
    for (const pair of String(flags.meta).split(",")) {
      const i = pair.indexOf("=");
      if (i > 0) extra[pair.slice(0, i).trim()] = pair.slice(i + 1).trim();
    }
  }
  const out = extraMetaFrom(extra);
  if (flags.image && flags.image !== true) out.__image = String(flags.image);
  return out;
}
function applyFlagMeta(meta, flags) {
  const extra = metaFromFlags(flags);
  if (extra.__image) {
    meta.image = extra.__image;
    delete extra.__image;
  }
  Object.assign(meta, extra);
  if (flags.draft) meta.draft = "true";
  return meta;
}

function readEntries(dir, defaultTag) {
  const entries = [];
  let drafts = 0;
  for (const file of findFilesRecursive(dir)) {
    const raw = fs.readFileSync(file, "utf8");
    const { meta, body } = parseFrontmatter(raw);
    if (isTruthy(meta.draft)) {
      drafts++;
      continue;
    }
    const slug = meta.slug || path.basename(file, ".md");
    const title = meta.title || extractHeading(body) || slug;
    let pills = meta.pills || [];
    if (typeof pills === "string")
      pills = pills.split(",").map((s) => s.trim()).filter(Boolean);
    const excerpt =
      meta.excerpt ||
      body.split("\n\n")[0].replace(/^#+\s+/g, "").slice(0, 160) + "...";
    const entry = {
      title,
      tag: meta.tag || defaultTag,
      date: meta.date || new Date().toISOString().slice(0, 7),
      excerpt,
      pills,
      slug,
      body,
    };
    if (meta.image) entry.image = String(meta.image);
    if (meta.updated) entry.updated = String(meta.updated);
    const extra = extraMetaFrom(meta);
    if (Object.keys(extra).length) entry.meta = extra;
    entries.push(entry);
  }
  entries.sort(compareEntriesNewestFirst);
  return { entries, drafts };
}

// frontmatter for an entry that already lives in data.js (used by `export`)
function frontmatterFor(e, slug) {
  const m = {
    title: e.title,
    tag: e.tag,
    date: e.date,
    excerpt: e.excerpt,
    pills: e.pills,
    slug,
  };
  if (e.image) m.image = e.image;
  if (e.updated) m.updated = e.updated;
  if (e.meta) Object.assign(m, e.meta);
  return m;
}

// ---------------------------------------------------------------------------
// SEO: per-post pages, sitemap.xml, feed.xml, robots.txt
// ---------------------------------------------------------------------------
// The site is a hash-routed single page app, which search engines and link
// previews can't see into. So every writeup/project also gets a small static
// page (writeups-<slug>.html) containing the full app shell PLUS its own
// <title>, description, canonical URL, share image and the article text.
// People who open it land straight on that post inside the normal app.

function loadSiteConfig() {
  try {
    const src = fs.readFileSync(CONFIG_FILE, "utf8");
    return new Function(src + "\n;return CONFIG;")();
  } catch (e) {
    return null;
  }
}

const DEFAULT_ROUTE_SLUGS = {
  writeups: "writeups",
  projects: "projects",
};
function routeSlugFor(cfg, page) {
  const raw = cfg && cfg.routes && cfg.routes[page] ? String(cfg.routes[page]) : "/" + DEFAULT_ROUTE_SLUGS[page];
  return raw.replace(/^[#/]+|\/+$/g, "").split("/")[0] || DEFAULT_ROUTE_SLUGS[page];
}
const safeFileName = (s) => String(s).toLowerCase().replace(/[^a-z0-9._-]+/g, "-").replace(/^-+|-+$/g, "") || "post";

function xmlEscape(v) {
  return String(v == null ? "" : v)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}
const attrEscape = xmlEscape;

function fmtTemplate(str, vars) {
  return String(str == null ? "" : str).replace(/\{(\w+)\}/g, (m, k) => (k in vars ? vars[k] : m));
}

// markdown -> safe HTML (same rules as the browser renderer: raw HTML is
// escaped, unsafe URL schemes are dropped)
function renderMarkdownSafe(md) {
  let marked;
  try {
    const mod = require("./marked.min.js");
    marked = mod.marked || mod;
  } catch (e) {
    return `<pre>${xmlEscape(md)}</pre>`;
  }
  const renderer = new marked.Renderer();
  const cleanUrl = (raw, isImage) => {
    const href = String(raw || "").trim().replace(/[\u0000-\u0020\u007f]/g, "");
    const hasScheme = /^[a-z][a-z\d+.-]*:/i.test(href);
    const ok = isImage ? /^https?:/i.test(href) : /^(https?:|mailto:|tel:)/i.test(href);
    return hasScheme && !ok ? "" : href;
  };
  const pick = (a, b, c) => (typeof a === "object" ? [a.href, a.title, a.text] : [a, b, c]);
  renderer.html = (a) => xmlEscape(typeof a === "object" ? a.text : a);
  renderer.link = (a, b, c) => {
    const [href, , text] = pick(a, b, c);
    const h = cleanUrl(href, false);
    return h ? `<a href="${attrEscape(h)}" rel="noopener noreferrer">${text}</a>` : text || "";
  };
  renderer.image = (a, b, c) => {
    const [href, , text] = pick(a, b, c);
    const h = cleanUrl(href, true);
    return h ? `<img src="${attrEscape(h)}" alt="${attrEscape(text || "")}" loading="lazy">` : "";
  };
  try {
    return marked.parse(md, { renderer });
  } catch (e) {
    return `<pre>${xmlEscape(md)}</pre>`;
  }
}

// set (or insert) a <meta> / <link> tag in an HTML <head>
function upsertTag(html, matcher, tag) {
  const re = new RegExp(matcher, "i");
  if (re.test(html)) return html.replace(re, () => tag);
  return html.replace(/<\/head>/i, () => `    ${tag}\n    </head>`);
}
const metaName = (n) => `<meta\\s+name="${n}"[^>]*?/?>`;
const metaProp = (n) => `<meta\\s+property="${n}"[^>]*?/?>`;

function buildStubPage(template, cfg, kind, entry, siteUrl) {
  const site = cfg.site || {};
  const siteName = site.name || "";
  const pageSlug = routeSlugFor(cfg, kind);
  const file = `${pageSlug}-${safeFileName(entry.slug)}.html`;
  const url = `${siteUrl}/${file}`;
  const titleTpl = site.titleTemplate || "{page} — {site}";
  const title = fmtTemplate(titleTpl, { page: entry.title, site: siteName });
  const desc = String(entry.excerpt || site.description || "").replace(/\s+/g, " ").trim().slice(0, 200);
  const imgPath = entry.image || site.ogImage || "";
  const image = imgPath ? (/^https?:/i.test(imgPath) ? imgPath : `${siteUrl}/${imgPath.replace(/^\//, "")}`) : "";
  const iso = toISODate(entry.date);
  const author = site.author || site.brand || siteName;

  let html = template;
  // <title>
  html = html.replace(/<title>[\s\S]*?<\/title>/i, () => `<title>${xmlEscape(title)}</title>`);
  html = upsertTag(html, metaName("description"), `<meta name="description" content="${attrEscape(desc)}" />`);
  html = upsertTag(html, metaProp("og:title"), `<meta property="og:title" content="${attrEscape(title)}" />`);
  html = upsertTag(html, metaProp("og:description"), `<meta property="og:description" content="${attrEscape(desc)}" />`);
  html = upsertTag(html, metaProp("og:type"), `<meta property="og:type" content="article" />`);
  html = upsertTag(html, metaProp("og:url"), `<meta property="og:url" content="${attrEscape(url)}" />`);
  html = upsertTag(html, metaProp("og:site_name"), `<meta property="og:site_name" content="${attrEscape(siteName)}" />`);
  if (image) html = upsertTag(html, metaProp("og:image"), `<meta property="og:image" content="${attrEscape(image)}" />`);
  html = upsertTag(html, metaName("twitter:card"), `<meta name="twitter:card" content="${image ? "summary_large_image" : "summary"}" />`);
  html = upsertTag(html, metaName("twitter:title"), `<meta name="twitter:title" content="${attrEscape(title)}" />`);
  html = upsertTag(html, metaName("twitter:description"), `<meta name="twitter:description" content="${attrEscape(desc)}" />`);
  if (image) html = upsertTag(html, metaName("twitter:image"), `<meta name="twitter:image" content="${attrEscape(image)}" />`);
  html = upsertTag(html, `<link\\s+rel="canonical"[^>]*?/?>`, `<link rel="canonical" href="${attrEscape(url)}" />`);

  const ld = {
    "@context": "https://schema.org",
    "@type": "BlogPosting",
    headline: entry.title,
    description: desc,
    url,
    mainEntityOfPage: url,
    author: { "@type": "Person", name: author },
  };
  if (iso) ld.datePublished = iso;
  if (entry.updated && toISODate(entry.updated)) ld.dateModified = toISODate(entry.updated);
  if (image) ld.image = image;
  if (entry.tag) ld.keywords = String(entry.tag).split("·").map((t) => t.trim()).filter(Boolean).join(", ");
  // JSON inside <script>: make "</script>" and "<!--" impossible
  const ldJson = JSON.stringify(ld).replace(/</g, "\\u003c");
  html = html.replace(/<\/head>/i, () => `    <script type="application/ld+json">${ldJson}</script>\n    </head>`);

  // jump to this post inside the app (only when the URL has no #route yet)
  const route = `#/${pageSlug}/${entry.slug}`;
  // a <meta>, not an inline script, so the Content-Security-Policy can forbid inline scripts;
  // js/app.js reads it and lands on the post when the URL has no #route yet
  const boot = `<meta name="boot-route" content="${attrEscape(route)}" />`;
  html = html.replace(/<head>/i, () => `<head>\n        ${boot}`);

  // article text for crawlers / link scrapers (the app replaces it on load)
  const metaRows = entry.meta
    ? `<ul>${Object.entries(entry.meta).map(([k, v]) => `<li><strong>${xmlEscape(k)}:</strong> ${xmlEscape(v)}</li>`).join("")}</ul>`
    : "";
  const article = `<article class="seo-article"><h1>${xmlEscape(entry.title)}</h1><p>${xmlEscape(entry.date)}${entry.tag ? " · " + xmlEscape(entry.tag) : ""}</p>${metaRows}${renderMarkdownSafe(entry.body || "")}</article>`;
  html = html.replace(/<main id="app"([^>]*)>\s*<\/main>/i, (m, attrs) => `<main id="app"${attrs}>${article}</main>`);

  return { file, url, html, iso, entry, kind, pageSlug };
}

function rfc822(iso) {
  const d = new Date((iso || "") + "T00:00:00Z");
  return isNaN(d) ? null : d.toUTCString();
}

// <link rel="alternate" type="application/rss+xml"> in index.html, between
// markers, only while a feed actually exists (so feed readers can auto-detect it)
function syncFeedLink(feedHref, title) {
  if (!fs.existsSync(INDEX_FILE)) return;
  const html = fs.readFileSync(INDEX_FILE, "utf8");
  let next = html.replace(/[ \t]*<!-- seo:feed -->[\s\S]*?<!-- \/seo:feed -->\r?\n?/g, "");
  if (feedHref) {
    const tag = `        <!-- seo:feed --><link rel="alternate" type="application/rss+xml" title="${attrEscape(title)}" href="${attrEscape(feedHref)}" /><!-- /seo:feed -->\n`;
    next = next.replace(/[ \t]*<\/head>/i, (m) => tag + m);
  }
  if (next !== html) fs.writeFileSync(INDEX_FILE, next, "utf8");
}

function generateSeo(data) {
  if (process.env.MANAGE_NO_SEO) return { skipped: "disabled" };
  const cfg = loadSiteConfig();
  const log = (m) => console.log(`  seo: ${m}`);

  // remove what we generated last time
  let previous = [];
  try {
    previous = JSON.parse(fs.readFileSync(SEO_MANIFEST, "utf8")).files || [];
  } catch (e) {}
  const cleanup = (keep) => {
    for (const f of previous) {
      if (keep.has(f) || /[\\/]/.test(f)) continue;
      try {
        fs.unlinkSync(path.join(ROOT_DIR, f));
      } catch (e) {}
    }
  };

  const siteUrl = cfg && cfg.site && cfg.site.url ? String(cfg.site.url).trim().replace(/\/+$/, "") : "";
  if (!cfg || !siteUrl) {
    syncFeedLink(null);
    cleanup(new Set());
    try {
      fs.unlinkSync(SEO_MANIFEST);
    } catch (e) {}
    return { skipped: "no site.url" };
  }
  if (!/^https?:\/\/[^\s/]+/i.test(siteUrl)) {
    console.warn(`  seo: site.url "${siteUrl}" is not a valid http(s) address — skipped`);
    return { skipped: "bad site.url" };
  }
  if (!fs.existsSync(INDEX_FILE)) return { skipped: "no index.html" };

  const feedCfgEarly = (cfg.site && cfg.site.feed) || {};
  syncFeedLink(
    feedCfgEarly.enabled !== false ? "feed.xml" : null,
    feedCfgEarly.title || (cfg.site && (cfg.site.name || cfg.site.brand)) || "RSS",
  );
  const template = fs.readFileSync(INDEX_FILE, "utf8");
  const pages = [];
  for (const w of data.WRITEUPS || []) pages.push(buildStubPage(template, cfg, "writeups", w, siteUrl));
  for (const p of data.PROJECTS || []) pages.push(buildStubPage(template, cfg, "projects", p, siteUrl));

  // two entries mapping to the same file name would overwrite each other
  const seen = new Map();
  for (const pg of pages) {
    if (seen.has(pg.file)) console.warn(`  seo: "${pg.entry.title}" and "${seen.get(pg.file)}" both map to ${pg.file}`);
    seen.set(pg.file, pg.entry.title);
  }

  const keep = new Set(pages.map((p) => p.file));
  for (const pg of pages) fs.writeFileSync(path.join(ROOT_DIR, pg.file), pg.html, "utf8");
  cleanup(keep);

  // ---- sitemap.xml
  const today = new Date().toISOString().slice(0, 10);
  const urls = [`  <url><loc>${xmlEscape(siteUrl + "/")}</loc><lastmod>${today}</lastmod></url>`];
  for (const pg of pages) {
    const mod = (pg.entry.updated && toISODate(pg.entry.updated)) || pg.iso;
    urls.push(`  <url><loc>${xmlEscape(pg.url)}</loc>${mod ? `<lastmod>${mod}</lastmod>` : ""}</url>`);
  }
  fs.writeFileSync(
    path.join(ROOT_DIR, "sitemap.xml"),
    `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls.join("\n")}\n</urlset>\n`,
    "utf8",
  );

  // ---- feed.xml (RSS 2.0)
  const feedCfg = (cfg.site && cfg.site.feed) || {};
  const feedOn = feedCfg.enabled !== false;
  if (feedOn) {
    const siteName = cfg.site.name || cfg.site.brand || "";
    const items = pages
      .slice()
      .sort((a, b) => String(b.iso || "").localeCompare(String(a.iso || "")))
      .slice(0, 50)
      .map((pg) => {
        const pub = rfc822(pg.iso);
        return [
          "    <item>",
          `      <title>${xmlEscape(pg.entry.title)}</title>`,
          `      <link>${xmlEscape(pg.url)}</link>`,
          `      <guid isPermaLink="true">${xmlEscape(pg.url)}</guid>`,
          pub ? `      <pubDate>${pub}</pubDate>` : "",
          pg.entry.tag ? `      <category>${xmlEscape(pg.entry.tag)}</category>` : "",
          `      <description>${xmlEscape(pg.entry.excerpt || "")}</description>`,
          "    </item>",
        ]
          .filter(Boolean)
          .join("\n");
      });
    const feed = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">
  <channel>
    <title>${xmlEscape(feedCfg.title || siteName)}</title>
    <link>${xmlEscape(siteUrl + "/")}</link>
    <description>${xmlEscape(feedCfg.description || cfg.site.description || "")}</description>
    <language>${xmlEscape(cfg.site.language || "en")}</language>
    <lastBuildDate>${new Date().toUTCString()}</lastBuildDate>
    <atom:link href="${xmlEscape(siteUrl + "/feed.xml")}" rel="self" type="application/rss+xml" />
${items.join("\n")}
  </channel>
</rss>
`;
    fs.writeFileSync(path.join(ROOT_DIR, "feed.xml"), feed, "utf8");
  } else {
    try {
      fs.unlinkSync(path.join(ROOT_DIR, "feed.xml"));
    } catch (e) {}
  }

  // ---- robots.txt: keep exactly one Sitemap line
  const robotsFile = path.join(ROOT_DIR, "robots.txt");
  let robots = fs.existsSync(robotsFile) ? fs.readFileSync(robotsFile, "utf8") : "User-agent: *\nAllow: /\n";
  robots = robots.replace(/^\s*Sitemap:.*\r?\n?/gim, "").replace(/\s+$/, "") + `\n\nSitemap: ${siteUrl}/sitemap.xml\n`;
  fs.writeFileSync(robotsFile, robots, "utf8");

  fs.writeFileSync(SEO_MANIFEST, JSON.stringify({ generatedBy: "manage.js seo", files: [...keep].sort() }, null, 2) + "\n", "utf8");
  log(`${pages.length} post page(s), sitemap.xml${feedOn ? ", feed.xml" : ""}  →  ${siteUrl}`);
  return { pages: pages.length, feed: feedOn, url: siteUrl };
}

// SYNC: Read all files in content/ and write data.js
function syncContent() {
  ensureDirs();

  // 1 + 2. Scan writeups and projects (drafts are skipped)
  const wr = readEntries(WRITEUPS_DIR, "general");
  const pr = readEntries(PROJECTS_DIR, "project");
  const writeups = wr.entries;
  const projects = pr.entries;

  // 3. Scan Notes (file paths define recursive folder structure!)
  const noteFiles = findFilesRecursive(NOTES_DIR);
  const root = { folders: {}, notes: [] };

  for (const file of noteFiles) {
    const relPath = path.relative(NOTES_DIR, file).replace(/\\/g, "/");
    const parts = relPath.split("/");
    const filename = parts.pop();
    const raw = fs.readFileSync(file, "utf8");
    const { meta, body } = parseFrontmatter(raw);
    const id = meta.id || meta.slug || path.basename(filename, ".md");
    const title = meta.title || extractHeading(body) || id;

    const noteObj = { id, title, body };

    let curr = root;
    for (const part of parts) {
      if (!curr.folders[part]) {
        curr.folders[part] = { folder: part, folders: {}, notes: [] };
      }
      curr = curr.folders[part];
    }
    curr.notes.push(noteObj);
  }

  function formatBranch(node) {
    const sortedFolders = Object.values(node.folders)
      .sort((a, b) => a.folder.localeCompare(b.folder))
      .map((f) => {
        const branch = formatBranch(f);
        return {
          folder: f.folder,
          folders: branch.folders,
          notes: f.notes.sort((a, b) => a.title.localeCompare(b.title)),
        };
      });

    return {
      folders: sortedFolders,
      notes: node.notes.sort((a, b) => a.title.localeCompare(b.title)),
    };
  }

  const formatted = formatBranch(root);
  const notesTree = formatted.folders;
  if (formatted.notes.length > 0) {
    notesTree.unshift({
      folder: "general",
      folders: [],
      notes: formatted.notes,
    });
  }

  // Write to data.js
  const output = `// =========================================================
// Generated by manage.js — edit files in content/ or run 'node manage.js'
// =========================================================

const WRITEUPS = ${JSON.stringify(writeups, null, 2)};

const PROJECTS = ${JSON.stringify(projects, null, 2)};

const NOTES_TREE = ${JSON.stringify(notesTree, null, 2)};

if (typeof module !== 'undefined' && module.exports) {
  module.exports = { WRITEUPS, PROJECTS, NOTES_TREE };
}
`;

  fs.writeFileSync(DATA_FILE, output, "utf8");

  let seo = null;
  try {
    seo = generateSeo({ WRITEUPS: writeups, PROJECTS: projects });
  } catch (e) {
    console.warn("  seo: failed —", e.message);
  }

  let allFoldersCount = 0;
  function countFolders(tree) {
    for (const item of tree) {
      allFoldersCount++;
      if (item.folders && item.folders.length > 0) countFolders(item.folders);
    }
  }
  countFolders(notesTree);

  return {
    writeupsCount: writeups.length,
    projectsCount: projects.length,
    notesCount: noteFiles.length,
    foldersCount: allFoldersCount,
    draftsSkipped: wr.drafts + pr.drafts,
    seo,
  };
}

// Helper to read and execute data.js
function loadDataFile() {
  if (!fs.existsSync(DATA_FILE))
    return { WRITEUPS: [], PROJECTS: [], NOTES_TREE: [] };
  const raw = fs.readFileSync(DATA_FILE, "utf8");
  const vm = require("vm");
  const ctx = {};
  vm.createContext(ctx);
  return vm.runInContext(
    raw +
      '\n;({ WRITEUPS: typeof WRITEUPS !== "undefined" ? WRITEUPS : [], PROJECTS: typeof PROJECTS !== "undefined" ? PROJECTS : [], NOTES_TREE: typeof NOTES_TREE !== "undefined" ? NOTES_TREE : [] });',
    ctx,
  );
}

// EXPORT: Extract existing data.js entries into content/ files
function exportFromDataJs() {
  ensureDirs();
  const dataModule = loadDataFile();

  let exportedWriteups = 0;
  for (const w of dataModule.WRITEUPS) {
    const slug = slugify(w.slug || w.title);
    if (!slug) throw new Error("Writeup title or slug must contain a letter or number");
    const dest = path.join(WRITEUPS_DIR, `${slug}.md`);
    if (!fs.existsSync(dest)) {
      const meta = frontmatterFor(w, slug);
      fs.writeFileSync(dest, serializeFrontmatter(meta, w.body), "utf8");
      exportedWriteups++;
    }
  }

  let exportedProjects = 0;
  for (const p of dataModule.PROJECTS) {
    const slug = slugify(p.slug || p.title);
    if (!slug) throw new Error("Project title or slug must contain a letter or number");
    const dest = path.join(PROJECTS_DIR, `${slug}.md`);
    if (!fs.existsSync(dest)) {
      const meta = frontmatterFor(p, slug);
      fs.writeFileSync(dest, serializeFrontmatter(meta, p.body), "utf8");
      exportedProjects++;
    }
  }

  let exportedNotes = 0;
  function exportNotesBranch(branches, currentRelPath = "") {
    for (const item of branches) {
      const folderRelPath = currentRelPath
        ? path.join(currentRelPath, item.folder)
        : item.folder;
      const folderPath = resolveNotesFolder(folderRelPath);
      if (!fs.existsSync(folderPath))
        fs.mkdirSync(folderPath, { recursive: true });

      if (item.notes && Array.isArray(item.notes)) {
        for (const n of item.notes) {
          const noteId = safeNoteId(n.id);
          const dest = path.join(folderPath, `${noteId}.md`);
          if (!fs.existsSync(dest)) {
            const meta = {
              title: n.title,
              id: noteId,
            };
            fs.writeFileSync(dest, serializeFrontmatter(meta, n.body), "utf8");
            exportedNotes++;
          }
        }
      }

      if (item.folders && Array.isArray(item.folders)) {
        exportNotesBranch(item.folders, folderRelPath);
      }
    }
  }

  exportNotesBranch(dataModule.NOTES_TREE || [], "");

  console.log(`\n✓ Export complete:`);
  console.log(`  - Writeups exported: ${exportedWriteups}`);
  console.log(`  - Projects exported: ${exportedProjects}`);
  console.log(`  - Notes exported:    ${exportedNotes}`);
  console.log(`  Files saved in: ${CONTENT_DIR}\n`);
}

// WATCH MODE
function watchContent() {
  ensureDirs();
  console.log(`Watching for changes in ${CONTENT_DIR}...`);
  console.log("Press Ctrl+C to exit.\n");

  let timeout = null;
  const triggerSync = () => {
    if (timeout) clearTimeout(timeout);
    timeout = setTimeout(() => {
      try {
        const stats = syncContent();
        console.log(
          `[${new Date().toLocaleTimeString()}] Synced: ${stats.writeupsCount} writeups, ${stats.projectsCount} projects, ${stats.notesCount} notes across ${stats.foldersCount} folders`,
        );
      } catch (e) {
        console.error("Sync error:", e.message);
      }
    }, 200);
  };

  fs.watch(CONTENT_DIR, { recursive: true }, (event, filename) => {
    if (filename && filename.endsWith(".md")) {
      triggerSync();
    }
  });

  // Initial sync
  triggerSync();
}

// PROMPT HELPER
function ask(rl, question, defaultVal = "") {
  return new Promise((resolve) => {
    const promptText = defaultVal
      ? `${question} [${defaultVal}]: `
      : `${question}: `;
    rl.question(promptText, (answer) => {
      resolve(answer.trim() || defaultVal);
    });
  });
}

function getFolderPaths(dir, base = "") {
  const folders = [];
  if (!fs.existsSync(dir)) return folders;
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const ent of entries) {
    if (ent.isDirectory()) {
      const rel = base ? `${base}/${ent.name}` : ent.name;
      folders.push(rel);
      folders.push(...getFolderPaths(path.join(dir, ent.name), rel));
    }
  }
  return folders;
}

// INTERACTIVE ADD NOTE
async function interactiveAddNote() {
  ensureDirs();
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  console.log("\n--- ADD NEW NOTE ---");
  console.log(
    "Note: File paths determine the recursive folder tree in your notes sidebar!",
  );

  // Show existing folders
  const existingFolders = getFolderPaths(NOTES_DIR);
  if (existingFolders.length > 0) {
    console.log(
      `Existing folder paths:\n  • ${existingFolders.join("\n  • ")}`,
    );
  }

  const folder = await ask(
    rl,
    "Folder path (e.g. ctf/pwn/kernel, reading/papers)",
    existingFolders[0] || "notes",
  );
  const title = await ask(rl, "Note Title");
  const defaultId = slugify(title);
  const id = await ask(rl, "Note ID / filename slug", defaultId);
  const importFile = await ask(
    rl,
    "Import from existing .md file (leave empty to write now)",
    "",
  );

  let body = "";
  if (importFile && fs.existsSync(importFile)) {
    body = fs.readFileSync(importFile, "utf8");
  } else {
    body = `# ${title}\n\nYour note content goes here.\n`;
  }

  const folderPath = resolveNotesFolder(folder);
  const noteId = safeNoteId(id);
  if (!fs.existsSync(folderPath)) fs.mkdirSync(folderPath, { recursive: true });

  const destFile = path.join(folderPath, `${noteId}.md`);
  const meta = { title, id: noteId };
  fs.writeFileSync(destFile, serializeFrontmatter(meta, body), "utf8");

  rl.close();

  const stats = syncContent();
  console.log(`\n✓ Note created: ${destFile}`);
  console.log(
    `✓ Updated data.js: ${stats.notesCount} total notes across ${stats.foldersCount} folders.\n`,
  );
}

// INTERACTIVE ADD WRITEUP
async function interactiveAddWriteup() {
  ensureDirs();
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  console.log("\n--- ADD NEW WRITEUP ---");
  const title = await ask(rl, "Writeup Title");
  const tag = await ask(
    rl,
    "Category / Tag (e.g. web · auth bypass, pwn · rop)",
    "ctf",
  );
  const today = new Date().toISOString().slice(0, 7);
  const date = await ask(rl, "Date (YYYY-MM)", today);
  const pillsStr = await ask(
    rl,
    "Pills/Tags (comma-separated, e.g. Web, JWT, CVE)",
    "CTF",
  );
  const pills = pillsStr
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  const excerpt = await ask(
    rl,
    "Short Excerpt / Summary",
    `Writeup for ${title}.`,
  );
  const defaultSlug = slugify(title);
  const slug = safeContentSlug(
    await ask(rl, "Slug (URL identifier)", defaultSlug),
  );
  console.log("CTF details (all optional — press Enter to skip):");
  const extraAnswers = {
    ctf: await ask(rl, "  CTF / event name", ""),
    category: await ask(rl, "  Category (pwn, web, rev...)", ""),
    points: await ask(rl, "  Points", ""),
    difficulty: await ask(rl, "  Difficulty", ""),
  };
  const importFile = await ask(
    rl,
    "Import from existing .md file (leave empty for template)",
    "",
  );

  let body = "";
  if (importFile && fs.existsSync(importFile)) {
    body = fs.readFileSync(importFile, "utf8");
  } else {
    body = `## Summary\n\nDetailed walkthrough of ${title}.\n\n## Exploitation\n\n\`\`\`bash\n# exploit steps\n\`\`\`\n`;
  }

  const destFile = path.join(WRITEUPS_DIR, `${slug}.md`);
  const meta = { title, tag, date, excerpt, pills, slug, ...extraMetaFrom(extraAnswers) };
  fs.writeFileSync(destFile, serializeFrontmatter(meta, body), "utf8");

  rl.close();

  const stats = syncContent();
  console.log(`\n✓ Writeup created: ${destFile}`);
  console.log(`✓ Updated data.js: ${stats.writeupsCount} total writeups.\n`);
}

// INTERACTIVE ADD PROJECT
async function interactiveAddProject() {
  ensureDirs();
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  console.log("\n--- ADD NEW PROJECT ---");
  const title = await ask(rl, "Project Title");
  const tag = await ask(
    rl,
    "Category / Tag (e.g. rust · tui, go · networking)",
    "project",
  );
  const today = new Date().toISOString().slice(0, 7);
  const date = await ask(rl, "Date (YYYY-MM)", today);
  const pillsStr = await ask(
    rl,
    "Pills/Tech stack (comma-separated, e.g. Rust, CLI, TUI)",
    "CLI",
  );
  const pills = pillsStr
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  const excerpt = await ask(
    rl,
    "Short Excerpt / Summary",
    `Description of ${title}.`,
  );
  const defaultSlug = slugify(title);
  const slug = safeContentSlug(
    await ask(rl, "Slug (URL identifier)", defaultSlug),
  );
  const importFile = await ask(
    rl,
    "Import from existing .md file (leave empty for template)",
    "",
  );

  let body = "";
  if (importFile && fs.existsSync(importFile)) {
    body = fs.readFileSync(importFile, "utf8");
  } else {
    body = `## What it is\n\nOverview of ${title}.\n\n## Features\n\n- Feature 1\n- Feature 2\n`;
  }

  const destFile = path.join(PROJECTS_DIR, `${slug}.md`);
  const meta = { title, tag, date, excerpt, pills, slug };
  fs.writeFileSync(destFile, serializeFrontmatter(meta, body), "utf8");

  rl.close();

  const stats = syncContent();
  console.log(`\n✓ Project created: ${destFile}`);
  console.log(`✓ Updated data.js: ${stats.projectsCount} total projects.\n`);
}

// LIST CONTENT
function listContent() {
  syncContent();
  const data = loadDataFile();

  console.log("\n========================================");
  console.log("       PIEZUKE CONTENT OVERVIEW");
  console.log("========================================");

  console.log(`\n📁 WRITEUPS (${data.WRITEUPS.length}):`);
  if (data.WRITEUPS.length === 0) console.log("   (none)");
  for (const w of data.WRITEUPS) {
    console.log(`   • [${w.date}] ${w.title} (${w.slug}) - ${w.tag}`);
  }

  console.log(`\n🚀 PROJECTS (${data.PROJECTS.length}):`);
  if (data.PROJECTS.length === 0) console.log("   (none)");
  for (const p of data.PROJECTS) {
    console.log(`   • [${p.date}] ${p.title} (${p.slug}) - ${p.tag}`);
  }

  let totalNotes = 0;
  let totalFolders = 0;

  function printBranch(branches, depth = 1) {
    const indent = "   ".repeat(depth);
    for (const item of branches) {
      totalFolders++;
      console.log(`${indent}📂 ${item.folder}/`);
      if (item.folders && item.folders.length > 0) {
        printBranch(item.folders, depth + 1);
      }
      if (item.notes && item.notes.length > 0) {
        for (const n of item.notes) {
          console.log(`${indent}   📄 ${n.title} (id: ${n.id})`);
          totalNotes++;
        }
      }
    }
  }

  console.log(`\n📓 NOTES:`);
  if (!data.NOTES_TREE || data.NOTES_TREE.length === 0) {
    console.log("   (none)");
  } else {
    printBranch(data.NOTES_TREE, 1);
  }
  if (totalNotes === 0) console.log("   (none)");
  console.log(
    `\nTotal: ${data.WRITEUPS.length} writeups, ${data.PROJECTS.length} projects, ${totalNotes} notes across ${totalFolders} folders\n`,
  );
}

// BROWSER WEB GUI (Zero dependencies!)
function launchUI(port = 8088) {
  ensureDirs();
  syncContent();

  const server = http.createServer((req, res) => {
    res.setHeader("X-Content-Type-Options", "nosniff");
    res.setHeader("X-Frame-Options", "DENY");
    res.setHeader("Content-Security-Policy", "frame-ancestors 'none'");
    const url = new URL(req.url, "http://127.0.0.1");

    if (req.method === "POST") {
      const host = (req.headers.host || "").toLowerCase();
      const origin = req.headers.origin;
      const isLocalHost =
        host === `127.0.0.1:${port}` || host === `localhost:${port}`;
      if (
        !isLocalHost ||
        (origin && origin !== `http://${host}`) ||
        (req.headers["sec-fetch-site"] &&
          req.headers["sec-fetch-site"] !== "same-origin" &&
          req.headers["sec-fetch-site"] !== "none")
      ) {
        res.writeHead(403, { "Content-Type": "application/json" });
        return res.end(JSON.stringify({ error: "Local requests only" }));
      }
    }

    // API: GET CONTENT
    if (url.pathname === "/api/content" && req.method === "GET") {
      syncContent();
      const data = loadDataFile();
      res.writeHead(200, { "Content-Type": "application/json" });
      return res.end(JSON.stringify(data));
    }

    // API: SAVE NOTE
    if (url.pathname === "/api/save/note" && req.method === "POST") {
      let body = "";
      req.on("data", (chunk) => (body += chunk));
      req.on("end", () => {
        try {
          const { folder, id, title, content } = JSON.parse(body);
          if (!folder || !id) throw new Error("Folder and ID are required");
          const folderPath = resolveNotesFolder(folder);
          if (!fs.existsSync(folderPath))
            fs.mkdirSync(folderPath, { recursive: true });
          const noteId = safeNoteId(id);
          const dest = path.join(folderPath, `${noteId}.md`);
          const meta = { title: title || noteId, id: noteId };
          fs.writeFileSync(dest, serializeFrontmatter(meta, content), "utf8");
          syncContent();
          res.writeHead(200, { "Content-Type": "application/json" });
          res.end(JSON.stringify({ success: true, file: dest }));
        } catch (e) {
          res.writeHead(400, { "Content-Type": "application/json" });
          res.end(JSON.stringify({ error: e.message }));
        }
      });
      return;
    }

    // API: SAVE WRITEUP / PROJECT
    if (
      (url.pathname === "/api/save/writeup" ||
        url.pathname === "/api/save/project") &&
      req.method === "POST"
    ) {
      const isWriteup = url.pathname.includes("writeup");
      const targetDir = isWriteup ? WRITEUPS_DIR : PROJECTS_DIR;
      let body = "";
      req.on("data", (chunk) => (body += chunk));
      req.on("end", () => {
        try {
          const { title, tag, date, pills, excerpt, slug, content, extra, draft } =
            JSON.parse(body);
          const finalSlug = slugify(slug || title);
          if (!finalSlug) throw new Error("Title or slug required");
          const dest = path.join(targetDir, `${finalSlug}.md`);
          const meta = {
            title: title || finalSlug,
            tag: tag || "general",
            date: date || new Date().toISOString().slice(0, 7),
            excerpt: excerpt || "",
            pills: Array.isArray(pills)
              ? pills
              : (pills || "")
                  .split(",")
                  .map((s) => s.trim())
                  .filter(Boolean),
            slug: finalSlug,
            ...parseExtraText(extra),
          };
          if (draft) meta.draft = "true";
          fs.writeFileSync(dest, serializeFrontmatter(meta, content), "utf8");
          syncContent();
          res.writeHead(200, { "Content-Type": "application/json" });
          res.end(JSON.stringify({ success: true, file: dest }));
        } catch (e) {
          res.writeHead(400, { "Content-Type": "application/json" });
          res.end(JSON.stringify({ error: e.message }));
        }
      });
      return;
    }

    // SERVE WEB GUI HTML
    if (req.method === "GET") {
      res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
      res.end(`<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Piezuke Content Manager</title>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@400;700&family=Jersey+25&display=swap">
<style>
:root {
  --bg: #070707; --bg2: #0e0e0e; --surface: #141414;
  --text: #f0f0f0; --muted: #888; --dim: #555;
  --border: #222; --border-strong: #333;
  --accent: #fff;
  --mono: 'Jersey 25', monospace;
  --sans: 'JetBrains Mono', monospace;
}
* { box-sizing: border-box; margin: 0; padding: 0; }
body { background: var(--bg); color: var(--text); font-family: var(--sans); display: flex; height: 100vh; overflow: hidden; }
header { background: var(--bg2); border-bottom: 1px solid var(--border); padding: 12px 20px; display: flex; align-items: center; justify-content: space-between; }
.logo { font-family: var(--mono); font-size: 22px; font-weight: bold; letter-spacing: 0.05em; }
.tabs { display: flex; gap: 8px; }
.tab-btn { background: transparent; border: 1px solid var(--border); color: var(--muted); padding: 6px 14px; border-radius: 8px; cursor: pointer; font-family: var(--mono); font-size: 15px; }
.tab-btn.active { background: var(--text); color: var(--bg); border-color: var(--text); }
.layout { display: flex; flex: 1; height: calc(100vh - 58px); }
.sidebar { width: 320px; background: var(--bg2); border-right: 1px solid var(--border); overflow-y: auto; padding: 16px; display: flex; flex-direction: column; gap: 14px; }
.editor-panel { flex: 1; display: flex; flex-direction: column; background: var(--bg); overflow-y: auto; padding: 24px 32px; }
.item-card { background: var(--surface); border: 1px solid var(--border); padding: 10px 14px; border-radius: 8px; cursor: pointer; transition: all .2s; }
.item-card:hover, .item-card.active { border-color: var(--text); background: #1a1a1a; }
.item-title { font-family: var(--mono); font-size: 16px; color: var(--text); }
.item-sub { font-size: 11px; color: var(--dim); margin-top: 3px; }
.form-group { margin-bottom: 16px; display: flex; flex-direction: column; gap: 6px; }
label { font-family: var(--mono); font-size: 13px; color: var(--muted); letter-spacing: 0.05em; }
input, textarea { background: var(--surface); border: 1px solid var(--border-strong); color: var(--text); font-family: var(--sans); font-size: 14px; padding: 10px 12px; border-radius: 8px; outline: none; }
input:focus, textarea:focus { border-color: var(--text); }
textarea { height: 340px; resize: vertical; line-height: 1.5; font-family: 'JetBrains Mono', monospace; }
.btn-save { background: var(--text); color: var(--bg); border: none; padding: 12px 24px; border-radius: 8px; cursor: pointer; font-family: var(--mono); font-size: 16px; font-weight: bold; width: fit-content; transition: transform .15s; }
.btn-save:hover { transform: scale(1.02); }
.btn-new { background: var(--surface); border: 1px solid var(--border-strong); color: var(--text); padding: 8px 12px; border-radius: 8px; cursor: pointer; font-family: var(--mono); font-size: 14px; text-align: center; }
.btn-new:hover { border-color: var(--text); }
.status-msg { font-size: 13px; color: #4ade80; margin-left: 12px; opacity: 0; transition: opacity .3s; }
.status-msg.show { opacity: 1; }
</style>
</head>
<body>
<div style="display:flex; flex-direction:column; width:100%; height:100%;">
  <header>
    <div class="logo">PIEZUKE // CONTENT MANAGER</div>
    <div class="tabs">
      <button class="tab-btn active" onclick="switchTab('notes')">NOTES</button>
      <button class="tab-btn" onclick="switchTab('writeups')">WRITEUPS</button>
      <button class="tab-btn" onclick="switchTab('projects')">PROJECTS</button>
    </div>
  </header>
  <div class="layout">
    <div class="sidebar">
      <button class="btn-new" onclick="createNew()">+ NEW ITEM</button>
      <div id="list-container" style="display:flex; flex-direction:column; gap:8px;"></div>
    </div>
    <div class="editor-panel" id="editor-panel">
      <div id="form-container"></div>
    </div>
  </div>
</div>

<script>
function escapeHTML(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

let currentTab = 'notes';
let globalData = { WRITEUPS: [], PROJECTS: [], NOTES_TREE: [] };
let activeItem = null;

async function loadData() {
  const res = await fetch('/api/content');
  globalData = await res.json();
  renderSidebar();
}

function switchTab(tab) {
  currentTab = tab;
  document.querySelectorAll('.tab-btn').forEach(b => b.classList.toggle('active', b.textContent.toLowerCase() === tab));
  activeItem = null;
  renderSidebar();
  renderForm();
}

function renderSidebar() {
  const container = document.getElementById('list-container');
  container.innerHTML = '';

  if (currentTab === 'notes') {
    function renderNotesBranch(branchList, parentPath = '', depth = 0) {
      branchList.forEach(f => {
        const currentPath = parentPath ? (parentPath + '/' + f.folder) : f.folder;
        const pad = depth * 14;

        const fHeader = document.createElement('div');
        fHeader.style.cssText = 'font-family:var(--mono); font-size:12px; color:var(--dim); margin-top:8px; padding-left:' + pad + 'px; display:flex; align-items:center; gap:6px; user-select:none;';
        fHeader.innerHTML = '<span style="opacity:0.6;">📂</span> <span>' + escapeHTML(f.folder) + '/</span>' + (depth > 0 ? ' <span style="font-size:10px; color:var(--muted); opacity:0.6;">(' + escapeHTML(currentPath) + ')</span>' : '');
        container.appendChild(fHeader);

        if (f.folders && f.folders.length > 0) {
          renderNotesBranch(f.folders, currentPath, depth + 1);
        }

        if (f.notes && f.notes.length > 0) {
          f.notes.forEach(n => {
            const card = document.createElement('div');
            card.className = 'item-card' + (activeItem && activeItem.id === n.id ? ' active' : '');
            card.style.marginLeft = (pad + 10) + 'px';
            card.innerHTML = '<div class="item-title">' + escapeHTML(n.title) + '</div><div class="item-sub">path: ' + escapeHTML(currentPath) + '/' + escapeHTML(n.id) + '.md</div>';
            card.onclick = () => {
              activeItem = { ...n, folder: currentPath };
              renderSidebar();
              renderForm();
            };
            container.appendChild(card);
          });
        }
      });
    }

    if (globalData.NOTES_TREE && globalData.NOTES_TREE.length > 0) {
      renderNotesBranch(globalData.NOTES_TREE, '', 0);
    } else {
      const empty = document.createElement('div');
      empty.style.cssText = 'color:var(--dim); font-size:13px; padding:10px;';
      empty.textContent = 'No notes yet. Click "+ NEW ITEM" to create one.';
      container.appendChild(empty);
    }
  } else if (currentTab === 'writeups') {
    globalData.WRITEUPS.forEach(w => {
      const card = document.createElement('div');
      card.className = 'item-card' + (activeItem && activeItem.slug === w.slug ? ' active' : '');
      card.innerHTML = '<div class="item-title">' + escapeHTML(w.title) + '</div><div class="item-sub">' + escapeHTML(w.date) + ' · ' + escapeHTML(w.tag) + '</div>';
      card.onclick = () => { activeItem = w; renderSidebar(); renderForm(); };
      container.appendChild(card);
    });
  } else {
    globalData.PROJECTS.forEach(p => {
      const card = document.createElement('div');
      card.className = 'item-card' + (activeItem && activeItem.slug === p.slug ? ' active' : '');
      card.innerHTML = '<div class="item-title">' + escapeHTML(p.title) + '</div><div class="item-sub">' + escapeHTML(p.date) + ' · ' + escapeHTML(p.tag) + '</div>';
      card.onclick = () => { activeItem = p; renderSidebar(); renderForm(); };
      container.appendChild(card);
    });
  }

  if (!activeItem) renderForm();
}

function createNew() {
  activeItem = { isNew: true };
  renderSidebar();
  renderForm();
}

function renderForm() {
  const container = document.getElementById('form-container');
  if (currentTab === 'notes') {
    const f = activeItem?.folder || 'ctf-cheatsheets';
    const id = activeItem?.id || '';
    const title = activeItem?.title || '';
    const body = activeItem?.body || '# Note Title\\n\\nWrite note here...';

    container.innerHTML = \`
      <h2 style="font-family:var(--mono); margin-bottom:20px; font-size:24px;">\${activeItem?.isNew ? 'NEW NOTE' : 'EDIT NOTE'}</h2>
      <div class="form-group">
        <label>FOLDER PATH (supports nested subfolders, e.g. ctf/pwn/kernel, reading/papers):</label>
        <input type="text" id="note-folder" value="\${escapeHTML(f)}" placeholder="folder/subfolder/more-subfolder">
      </div>
      <div class="form-group">
        <label>NOTE TITLE:</label>
        <input type="text" id="note-title" value="\${escapeHTML(title)}" placeholder="e.g. Heap Exploitation Basics">
      </div>
      <div class="form-group">
        <label>NOTE ID / FILE SLUG (e.g. heap-basics):</label>
        <input type="text" id="note-id" value="\${escapeHTML(id)}" placeholder="my-note-slug">
      </div>
      <div class="form-group">
        <label>MARKDOWN CONTENT:</label>
        <textarea id="note-body">\${escapeHTML(body)}</textarea>
      </div>
      <div style="display:flex; align-items:center;">
        <button class="btn-save" onclick="saveNote()">SAVE & PUBLISH</button>
        <span class="status-msg" id="status-msg">✓ Saved and data.js updated!</span>
      </div>
    \`;
  } else {
    const isW = currentTab === 'writeups';
    const title = activeItem?.title || '';
    const tag = activeItem?.tag || (isW ? 'web · auth' : 'rust · tui');
    const date = activeItem?.date || new Date().toISOString().slice(0, 7);
    const pills = Array.isArray(activeItem?.pills) ? activeItem.pills.join(', ') : (activeItem?.pills || '');
    const excerpt = activeItem?.excerpt || '';
    const slug = activeItem?.slug || '';
    const body = activeItem?.body || '## Summary\\n\\nWrite content here...';
    const extraMeta = activeItem?.meta ? Object.entries(activeItem.meta).map(([k, v]) => k + ': ' + v).join('\\n') : '';

    container.innerHTML = \`
      <h2 style="font-family:var(--mono); margin-bottom:20px; font-size:24px;">\${activeItem?.isNew ? ('NEW ' + currentTab.toUpperCase().slice(0,-1)) : ('EDIT ' + currentTab.toUpperCase().slice(0,-1))}</h2>
      <div class="form-group">
        <label>TITLE:</label>
        <input type="text" id="item-title" value="\${escapeHTML(title)}" placeholder="Title">
      </div>
      <div style="display:grid; grid-template-columns: 1fr 1fr; gap:16px;">
        <div class="form-group">
          <label>TAG / CATEGORY:</label>
          <input type="text" id="item-tag" value="\${escapeHTML(tag)}" placeholder="category · sub">
        </div>
        <div class="form-group">
          <label>DATE (YYYY-MM):</label>
          <input type="text" id="item-date" value="\${escapeHTML(date)}" placeholder="2026-09">
        </div>
      </div>
      <div class="form-group">
        <label>PILLS / BADGES (comma-separated):</label>
        <input type="text" id="item-pills" value="\${escapeHTML(pills)}" placeholder="Go, TLS, CLI">
      </div>
      <div class="form-group">
        <label>SHORT EXCERPT:</label>
        <input type="text" id="item-excerpt" value="\${escapeHTML(excerpt)}" placeholder="1-2 sentences summarizing this post">
      </div>
      <div class="form-group">
        <label>SLUG (URL IDENTIFIER):</label>
        <input type="text" id="item-slug" value="\${escapeHTML(slug)}" placeholder="auto-generated-if-empty">
      </div>
      <div class="form-group">
        <label>EXTRA DETAILS (one "key: value" per line — e.g. ctf, category, points, difficulty):</label>
        <textarea id="item-extra" style="min-height:90px;" placeholder="ctf: PicoCTF 2026&#10;category: pwn&#10;points: 500&#10;difficulty: hard">\${escapeHTML(extraMeta)}</textarea>
      </div>
      <div class="form-group">
        <label><input type="checkbox" id="item-draft" style="width:auto; margin-right:8px;"> DRAFT (keep out of the site until unchecked)</label>
      </div>
      <div class="form-group">
        <label>MARKDOWN CONTENT:</label>
        <textarea id="item-body">\${escapeHTML(body)}</textarea>
      </div>
      <div style="display:flex; align-items:center;">
        <button class="btn-save" onclick="saveItem()">SAVE & PUBLISH</button>
        <span class="status-msg" id="status-msg">✓ Saved and data.js updated!</span>
      </div>
    \`;
  }
}

async function saveNote() {
  const folder = document.getElementById('note-folder').value.trim();
  const title = document.getElementById('note-title').value.trim();
  let id = document.getElementById('note-id').value.trim();
  const content = document.getElementById('note-body').value;
  if (!id) id = title.toLowerCase().replace(/[^\\w\\s-]/g, '').replace(/[\\s_-]+/g, '-');
  if (!folder || !id) { alert('Please provide folder and title/id'); return; }

  const res = await fetch('/api/save/note', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ folder, id, title, content })
  });
  if (res.ok) {
    showStatus();
    await loadData();
  } else {
    alert('Failed to save');
  }
}

async function saveItem() {
  const title = document.getElementById('item-title').value.trim();
  const tag = document.getElementById('item-tag').value.trim();
  const date = document.getElementById('item-date').value.trim();
  const pills = document.getElementById('item-pills').value.trim();
  const excerpt = document.getElementById('item-excerpt').value.trim();
  let slug = document.getElementById('item-slug').value.trim();
  const content = document.getElementById('item-body').value;
  const extra = document.getElementById('item-extra').value;
  const draft = document.getElementById('item-draft').checked;
  if (!slug) slug = title.toLowerCase().replace(/[^\\w\\s-]/g, '').replace(/[\\s_-]+/g, '-');
  if (!title) { alert('Title is required'); return; }

  const endpoint = currentTab === 'writeups' ? '/api/save/writeup' : '/api/save/project';
  const res = await fetch(endpoint, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ title, tag, date, pills, excerpt, slug, content, extra, draft })
  });
  if (res.ok) {
    showStatus();
    await loadData();
  } else {
    alert('Failed to save');
  }
}

function showStatus() {
  const msg = document.getElementById('status-msg');
  if (msg) {
    msg.classList.add('show');
    setTimeout(() => msg.classList.remove('show'), 2500);
  }
}

loadData();
</script>
</body>
</html>`);
    }
  });

  server.listen(port, "127.0.0.1", () => {
    console.log(`\n======================================================`);
    console.log(`  PIEZUKE CONTENT MANAGER RUNNING`);
    console.log(`  Access Web GUI at: http://127.0.0.1:${port}`);
    console.log(`======================================================\n`);
  });
}

// CLI DISPATCHER
async function main() {
  const args = process.argv.slice(2);
  const cmd = args[0] ? args[0].toLowerCase() : "";

  if (cmd === "sync" || cmd === "build") {
    const stats = syncContent();
    console.log(`✓ Synchronized content/ -> data.js:`);
    console.log(`  - Writeups: ${stats.writeupsCount}`);
    console.log(`  - Projects: ${stats.projectsCount}`);
    console.log(
      `  - Notes:    ${stats.notesCount} across ${stats.foldersCount} folders`,
    );
    if (stats.draftsSkipped) console.log(`  - Drafts skipped: ${stats.draftsSkipped}`);
    if (stats.seo && stats.seo.skipped === "no site.url")
      console.log(
        "  - SEO: skipped. Set site.url in config.js (e.g. \"https://you.github.io\") to generate\n    per-post pages, sitemap.xml and feed.xml.",
      );
    return;
  }

  if (cmd === "csp") {
    const r = syncCspHashes();
    console.log(r.changed.length ? `CSP updated in: ${r.changed.join(", ")}` : "CSP already up to date");
    console.log(`  inline scripts allowed by hash: ${r.hashes.length}`);
    return;
  }

  if (cmd === "seo") {
    const data = loadDataFile();
    const res = generateSeo(data);
    if (res.skipped) {
      console.log(
        res.skipped === "no site.url"
          ? 'SEO skipped: set site.url in config.js (e.g. "https://you.github.io") first.'
          : `SEO skipped: ${res.skipped}`,
      );
    }
    return;
  }

  if (cmd === "export") {
    exportFromDataJs();
    return;
  }

  if (cmd === "watch") {
    watchContent();
    return;
  }

  if (cmd === "list" || cmd === "ls") {
    listContent();
    return;
  }

  if (cmd === "ui" || cmd === "gui" || cmd === "serve") {
    const port = parseInt(args[1]) || 8088;
    launchUI(port);
    return;
  }

  if (cmd === "add" || cmd.startsWith("add:")) {
    let type = args[1] || cmd.split(":")[1] || "";
    type = type.toLowerCase();

    // Check for flags: e.g. --file, --path, --title
    const flags = {};
    for (let i = 0; i < args.length; i++) {
      if (args[i].startsWith("--")) {
        const k = args[i].slice(2);
        const v =
          args[i + 1] && !args[i + 1].startsWith("--") ? args[i + 1] : true;
        flags[k] = v;
      }
    }

    if (type === "note") {
      const posTitle =
        !flags.title && args[2] && !args[2].startsWith("--") ? args[2] : null;
      const posFolder =
        !flags.folder && args[3] && !args[3].startsWith("--") ? args[3] : null;
      const posContent =
        !flags.content && args[4] && !args[4].startsWith("--") ? args[4] : null;

      if (flags.path || flags.folder || posTitle) {
        ensureDirs();
        const folder =
          flags.folder ||
          posFolder ||
          (flags.path ? path.dirname(flags.path) : "notes");
        const id =
          flags.id ||
          (flags.path
            ? path.basename(flags.path, ".md")
            : slugify(flags.title || posTitle || "note"));
        const title = flags.title || posTitle || id;
        let body = posContent
          ? `# ${title}\n\n${posContent}\n`
          : `# ${title}\n\n`;
        if (flags.file && fs.existsSync(flags.file)) {
          body = fs.readFileSync(flags.file, "utf8");
        }
        const folderDir = resolveNotesFolder(folder);
        if (!fs.existsSync(folderDir))
          fs.mkdirSync(folderDir, { recursive: true });
        const noteId = safeNoteId(id);
        const dest = path.join(folderDir, `${noteId}.md`);
        fs.writeFileSync(
          dest,
          serializeFrontmatter({ title, id: noteId }, body),
          "utf8",
        );
        syncContent();
        console.log(`✓ Note saved: ${dest}`);
        return;
      }
      await interactiveAddNote();
      return;
    }

    if (type === "writeup") {
      if (flags.title || flags.file) {
        ensureDirs();
        const title = flags.title || "Untitled Writeup";
        const slug = safeContentSlug(flags.slug || title);
        let body = `## ${title}\n\n`;
        if (flags.file && fs.existsSync(flags.file)) {
          body = fs.readFileSync(flags.file, "utf8");
        }
        const meta = {
          title,
          tag: flags.tag || "ctf",
          date: flags.date || new Date().toISOString().slice(0, 7),
          excerpt: flags.excerpt || "",
          pills: flags.pills ? flags.pills.split(",") : ["CTF"],
          slug,
        };
        applyFlagMeta(meta, flags);
        const dest = path.join(WRITEUPS_DIR, `${slug}.md`);
        fs.writeFileSync(dest, serializeFrontmatter(meta, body), "utf8");
        syncContent();
        console.log(`✓ Writeup saved: ${dest}`);
        return;
      }
      await interactiveAddWriteup();
      return;
    }

    if (type === "project") {
      if (flags.title || flags.file) {
        ensureDirs();
        const title = flags.title || "Untitled Project";
        const slug = safeContentSlug(flags.slug || title);
        let body = `## ${title}\n\n`;
        if (flags.file && fs.existsSync(flags.file)) {
          body = fs.readFileSync(flags.file, "utf8");
        }
        const meta = {
          title,
          tag: flags.tag || "project",
          date: flags.date || new Date().toISOString().slice(0, 7),
          excerpt: flags.excerpt || "",
          pills: flags.pills ? flags.pills.split(",") : ["Project"],
          slug,
        };
        applyFlagMeta(meta, flags);
        const dest = path.join(PROJECTS_DIR, `${slug}.md`);
        fs.writeFileSync(dest, serializeFrontmatter(meta, body), "utf8");
        syncContent();
        console.log(`✓ Project saved: ${dest}`);
        return;
      }
      await interactiveAddProject();
      return;
    }

    // If type not specified in 'add', prompt user
    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout,
    });
    console.log("\nWhat would you like to add?");
    console.log("  1) Note (with folder path support)");
    console.log("  2) Writeup");
    console.log("  3) Project");
    const choice = await ask(rl, "Select [1-3]", "1");
    rl.close();

    if (choice === "1" || choice.toLowerCase() === "note")
      await interactiveAddNote();
    else if (choice === "2" || choice.toLowerCase() === "writeup")
      await interactiveAddWriteup();
    else if (choice === "3" || choice.toLowerCase() === "project")
      await interactiveAddProject();
    return;
  }

  // Interactive menu by default if in terminal
  if (process.stdin.isTTY) {
    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout,
    });
    console.log("\n========================================");
    console.log("   PIEZUKE CONTENT MANAGEMENT TOOL");
    console.log("========================================");
    console.log("  1) Add Note (specify folder/path)");
    console.log("  2) Add Writeup");
    console.log("  3) Add Project");
    console.log("  4) Sync content/ -> data.js");
    console.log("  5) Watch content/ (auto-sync)");
    console.log("  6) Export current data.js -> content/");
    console.log("  7) List all content");
    console.log("  8) Launch Web UI (port 8088)");
    console.log("  0) Exit\n");

    const choice = await ask(rl, "Choose an option [1-8]", "1");
    rl.close();

    switch (choice) {
      case "1":
        await interactiveAddNote();
        break;
      case "2":
        await interactiveAddWriteup();
        break;
      case "3":
        await interactiveAddProject();
        break;
      case "4": {
        const stats = syncContent();
        console.log(
          `✓ Synchronized content/ -> data.js (${stats.writeupsCount} writeups, ${stats.projectsCount} projects, ${stats.notesCount} notes)`,
        );
        break;
      }
      case "5":
        watchContent();
        break;
      case "6":
        exportFromDataJs();
        break;
      case "7":
        listContent();
        break;
      case "8":
        launchUI();
        break;
      default:
        console.log("Exited.");
        break;
    }
  } else {
    // Non-interactive help
    console.log(`
Piezuke Content Management Tool

Commands:
  node manage.js sync                     Compile markdown files into data.js
  node manage.js watch                    Watch content/ and auto-sync
  node manage.js export                   Export existing data.js to markdown
  node manage.js list                     List all current content
  node manage.js add note                 Add a note (prompts for folder path)
  node manage.js add writeup              Add a writeup
  node manage.js add project              Add a project
  node manage.js ui                       Launch browser editor (port 8088)

Flags for direct creation:
  node manage.js add note --path "ctf-cheatsheets/pwn.md" --title "Pwn" [--file ./doc.md]
  node manage.js add writeup --title "My Title" --tag "web" [--file ./doc.md]
  node manage.js add project --title "My Tool" --tag "go" [--file ./doc.md]
`);
  }
}

main().catch((err) => {
  console.error("Error:", err);
  process.exit(1);
});
