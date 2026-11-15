#!/usr/bin/env node
/**
 * build.js - turns the repo into the folder that gets published (default: ./dist)
 *
 *   node build.js [--out dist] [--no-minify]
 *
 * What it does
 *   1. copies only the files that belong on the website (never content/, manage.js, tests...)
 *   2. minifies style.css, fonts.css, config.js and js/*.js            (smaller + faster to parse)
 *   3. adds a content hash to every script/stylesheet URL in every page  (style.css?v=3f9a1c2e)
 *      so a changed file is fetched at once and an unchanged one stays cached
 *   4. writes sw.js (service worker) with the precache list and a build id
 *   5. checks its own output: every referenced file exists, every script parses
 *
 * Nothing in the source files is modified. Run `node manage.js sync` first if your
 * data.js / per-post pages need rebuilding (the deploy workflow does that for you).
 */
"use strict";

const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
const vm = require("vm");

const sha = (buf, n = 8) => crypto.createHash("sha256").update(buf).digest("hex").slice(0, n);
const rel = (p) => p.split(path.sep).join("/");

function walk(dir, base = dir) {
  const out = [];
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) out.push(...walk(p, base));
    else out.push(rel(path.relative(base, p)));
  }
  return out.sort();
}

function build(opts = {}) {
  const ROOT = path.resolve(opts.root || __dirname); // the project to build (tests build a copy)
  const out = path.resolve(opts.out || path.join(ROOT, "dist"));
  const minify = opts.minify !== false;
  const log = opts.log || (() => {});
  const esbuild = minify ? require("esbuild") : null;

  fs.rmSync(out, { recursive: true, force: true });
  fs.mkdirSync(out, { recursive: true });

  /* ---- 1. copy only what belongs on the website ---- */
  const required = ["index.html", "404.html", "style.css", "fonts.css", "config.js", "data.js", "marked.min.js"];
  for (const f of required) {
    if (!fs.existsSync(path.join(ROOT, f))) throw new Error(`build: missing ${f}`);
    fs.copyFileSync(path.join(ROOT, f), path.join(out, f));
  }
  if (fs.existsSync(path.join(ROOT, "robots.txt"))) fs.copyFileSync(path.join(ROOT, "robots.txt"), path.join(out, "robots.txt"));
  for (const d of ["js", "media", "fonts", ".well-known"]) {
    if (fs.existsSync(path.join(ROOT, d))) fs.cpSync(path.join(ROOT, d), path.join(out, d), { recursive: true });
  }
  for (const f of fs.readdirSync(ROOT)) {
    if (/\.(html|xml)$/.test(f) && !fs.existsSync(path.join(out, f))) fs.copyFileSync(path.join(ROOT, f), path.join(out, f)); // per-post pages, sitemap, feed
  }
  fs.writeFileSync(path.join(out, ".nojekyll"), "");

  /* ---- 2. minify ---- */
  const ours = ["style.css", "fonts.css", "config.js", ...fs.readdirSync(path.join(out, "js")).filter((f) => f.endsWith(".js") && !f.endsWith(".min.js")).map((f) => "js/" + f)];
  const sizes = [];
  if (minify) {
    for (const f of ours) {
      const p = path.join(out, f);
      const src = fs.readFileSync(p, "utf8");
      const res = esbuild.transformSync(src, { loader: f.endsWith(".css") ? "css" : "js", minify: true, legalComments: "none", target: "es2020", sourcefile: f });
      fs.writeFileSync(p, res.code);
      sizes.push([f, Buffer.byteLength(src), Buffer.byteLength(res.code)]);
    }
  }

  /* ---- 3. content-hash every script/stylesheet URL ---- */
  const versioned = new Map(); // "js/app.js" -> "3f9a1c2e"
  for (const f of ["style.css", "fonts.css", "config.js", "data.js", "marked.min.js", ...walk(path.join(out, "js")).map((x) => "js/" + x)]) {
    versioned.set(f, sha(fs.readFileSync(path.join(out, f))));
  }
  const pages = fs.readdirSync(out).filter((f) => f.endsWith(".html"));
  // build id = hash of everything that will be published (so any change makes a new cache)
  const buildId = sha(walk(out).map((f) => f + ":" + sha(fs.readFileSync(path.join(out, f)))).join("\n"), 12);
  for (const page of pages) {
    const p = path.join(out, page);
    let html = fs.readFileSync(p, "utf8");
    html = html.replace(/(\s(?:src|href)=")([^"#?]+)(")/g, (m, a, url, c) => {
      const key = url.replace(/^\.\//, "");
      return versioned.has(key) ? `${a}${key}?v=${versioned.get(key)}${c}` : m;
    });
    if (page !== "404.html") {
      const meta = `<meta name="app-build" content="${buildId}" />`;
      html = /<meta charset="UTF-8"\s*\/?>/i.test(html) ? html.replace(/(<meta charset="UTF-8"\s*\/?>)/i, `$1\n        ${meta}`) : html.replace(/<head>/i, `<head>\n        ${meta}`);
    }
    fs.writeFileSync(p, html);
  }

  /* ---- 4. service worker ---- */
  const v = (f) => `${f}?v=${versioned.get(f)}`;
  const precache = [
    "./",
    "index.html",
    v("style.css"),
    v("fonts.css"),
    v("config.js"),
    v("data.js"),
    v("marked.min.js"),
    ...walk(path.join(out, "js")).map((x) => v("js/" + x)),
    ...walk(path.join(out, "fonts")).filter((f) => f.endsWith(".woff2") && !/italic/.test(f)).map((f) => "fonts/" + f),
    ...["media/pfp.webp"].filter((f) => fs.existsSync(path.join(out, f))),
  ];
  let sw = fs.readFileSync(path.join(ROOT, "sw.js"), "utf8");
  sw = sw.replace(/const VERSION = "[^"]*";/, `const VERSION = "${buildId}";`).replace(/\/\*PRECACHE\*\/[\s\S]*?\/\*END\*\//, `/*PRECACHE*/ ${JSON.stringify(precache)} /*END*/`);
  if (minify) sw = esbuild.transformSync(sw, { loader: "js", minify: true, legalComments: "none", target: "es2020" }).code;
  fs.writeFileSync(path.join(out, "sw.js"), sw);

  /* ---- 5. check our own output ---- */
  const problems = [];
  for (const f of walk(out).filter((x) => x.endsWith(".js"))) {
    try {
      new vm.Script(fs.readFileSync(path.join(out, f), "utf8"), { filename: f });
    } catch (e) {
      problems.push(`${f} does not parse: ${e.message}`);
    }
  }
  for (const page of pages) {
    const html = fs.readFileSync(path.join(out, page), "utf8");
    for (const m of html.matchAll(/\s(?:src|href)="([^"#]+)"/g)) {
      const url = m[1];
      if (/^(?:[a-z]+:|\/\/|\/)/i.test(url) || !/\.(?:js|css|woff2|webp|png|jpe?g|mp4|svg|ico|xml|txt|json)(?:\?|$)/i.test(url)) continue;
      const file = url.split("?")[0];
      if (!fs.existsSync(path.join(out, file))) problems.push(`${page} refers to ${file}, which is not in the build`);
      const q = url.match(/\?v=([0-9a-f]{8})$/);
      if (q && versioned.has(file) && versioned.get(file) !== q[1]) problems.push(`${page}: stale hash for ${file}`);
    }
  }
  for (const u of precache) {
    const file = u.split("?")[0];
    if (file !== "./" && !fs.existsSync(path.join(out, file))) problems.push(`sw.js precaches ${file}, which is not in the build`);
  }
  if (problems.length) throw new Error("build check failed:\n  - " + problems.join("\n  - "));

  const total = walk(out).reduce((n, f) => n + fs.statSync(path.join(out, f)).size, 0);
  log(`built ${walk(out).length} files (${(total / 1024).toFixed(0)} KB) into ${path.relative(process.cwd(), out) || "."}   build id ${buildId}`);
  if (minify) {
    const before = sizes.reduce((n, s) => n + s[1], 0);
    const after = sizes.reduce((n, s) => n + s[2], 0);
    log(`minified ${sizes.length} files: ${(before / 1024).toFixed(0)} KB -> ${(after / 1024).toFixed(0)} KB`);
  }
  return { out, buildId, precache, versioned, pages, sizes };
}

module.exports = { build };

if (require.main === module) {
  const a = process.argv.slice(2);
  const oi = a.indexOf("--out");
  try {
    build({ out: oi >= 0 ? a[oi + 1] : undefined, minify: !a.includes("--no-minify"), log: console.log });
  } catch (e) {
    console.error(e.message);
    process.exit(1);
  }
}
