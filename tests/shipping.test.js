const { test, describe } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { ROOT, read } = require("./helpers/harness");

const CONFIG = new Function(read("config.js") + ";return CONFIG")();
const at = (p) => p.split(".").reduce((o, k) => (o == null ? undefined : o[k]), CONFIG);
const exists = (rel) => fs.existsSync(path.join(ROOT, rel));

describe("config.js really does control the text", () => {
  test("every data-cfg path in index.html exists in config.js", () => {
    const html = read("index.html");
    const paths = new Set();
    for (const m of html.matchAll(/data-cfg="([^"]+)"/g)) paths.add(m[1]);
    for (const m of html.matchAll(/data-cfg-attr="([^"]+)"/g)) for (const pair of m[1].split(";")) paths.add(pair.split(":")[1].trim());
    assert.ok(paths.size > 15, "found the hooks");
    for (const p of paths) assert.notEqual(at(p), undefined, `index.html uses ${p}, which is missing from config.js`);
  });

  test("every data-cfg-href in index.html is a real page key", () => {
    for (const m of read("index.html").matchAll(/data-cfg-href="([^"]+)"/g)) assert.notEqual(CONFIG.routes[m[1]], undefined, m[1]);
  });

  test("every literal cfg(\"path\") the scripts read is defined in config.js", () => {
    const optional = new Set(); // keys that are deliberately left out of the default config
    const missing = [];
    for (const f of fs.readdirSync(path.join(ROOT, "js"))) {
      if (!f.endsWith(".js")) continue;
      for (const m of read("js/" + f).matchAll(/\bcfg\(\s*"([A-Za-z0-9_.]+)"/g)) {
        if (m[1].endsWith(".")) continue; // dynamic, e.g. cfg("routes." + page)
        if (at(m[1]) === undefined && !optional.has(m[1])) missing.push(`js/${f}: ${m[1]}`);
      }
    }
    assert.deepEqual([...new Set(missing)], []);
  });

  test("every page key in nav, routes and the explore cards agrees", () => {
    for (const l of CONFIG.nav.links) if (l.page) assert.notEqual(CONFIG.routes[l.page], undefined, l.label);
    for (const c of CONFIG.pages.home.explore.cards) assert.notEqual(CONFIG.routes[c.page], undefined, c.title);
  });
});

describe("hosting files", () => {
  test("_headers CSP matches the CSP in index.html (plus frame-ancestors)", () => {
    const meta = read("index.html").match(/http-equiv="Content-Security-Policy"\s+content="([^"]+)"/)[1].trim();
    const header = read("_headers").match(/Content-Security-Policy:\s*(.+)/)[1].trim();
    assert.equal(header, meta + " frame-ancestors 'none';");
  });

  test("_headers sets the standard protections", () => {
    const h = read("_headers");
    for (const x of ["X-Content-Type-Options: nosniff", "X-Frame-Options: DENY", "Referrer-Policy:", "Permissions-Policy:"]) assert.ok(h.includes(x), x);
  });

  test("security.txt has a contact and has not expired", () => {
    const t = read(".well-known/security.txt");
    assert.match(t, /^Contact: (mailto:|https:\/\/)\S+/m);
    const exp = new Date(t.match(/^Expires: (\S+)/m)[1]);
    assert.ok(exp > new Date(), "renew the Expires date in .well-known/security.txt");
    assert.ok(exp < new Date(Date.now() + 400 * 864e5), "RFC 9116 recommends under a year");
  });

  test("the deploy workflow tests first and publishes only the site files", () => {
    const y = read(".github/workflows/deploy.yml");
    assert.match(y, /npm ci/);
    assert.match(y, /npm test/);
    assert.match(y, /needs: test/);
    assert.match(y, /path: dist/);
    assert.match(y, /cancel-in-progress: false/, "a running deployment is never cancelled mid-way");
    assert.match(y, /find content -name '\*\.md'/, "guard: an empty content/ never wipes a committed data.js");
    assert.match(y, /actions\/deploy-pages@[0-9a-f]{40} # v4/, "deploy-pages is pinned to a commit");
    assert.match(y, /node build\.js --out dist/, "the site is assembled by build.js (which publishes only website files; see build.test.js)");
    assert.ok(!/cp [^\n]*(?:_headers|content|manage\.js|tests|node_modules|package\.json)/.test(y), "no hand-written copy of private files into the published folder");
  });

  test("package.json: `npm test` runs the suite; the site has no runtime dependencies", () => {
    const p = JSON.parse(read("package.json"));
    assert.match(p.scripts.test, /node --test/);
    assert.equal(p.dependencies, undefined);
  });

  test("everything the workflow copies exists", () => {
    for (const f of ["index.html", "404.html", "style.css", "fonts.css", "config.js", "data.js", "marked.min.js", "robots.txt", "js", "media", "fonts", ".well-known/security.txt"]) assert.ok(exists(f), f);
  });
});

describe("GitHub Pages is case-sensitive", () => {
  // Windows/macOS ignore letter case in file names; GitHub Pages (Linux) does not.
  // A path like "media/Pfp.webp" works on your laptop and 404s once published.
  test("every local file the site refers to exists with exactly that spelling", () => {
    const refs = new Set();
    const local = (u) => u && !/^(https?:|data:|mailto:|tel:|#|\/\/|javascript:)/i.test(u);
    const html = read("index.html") + "\n" + read("404.html");
    for (const m of html.matchAll(/(?<![\w-])(?:src|href)="([^"]+)"/g)) if (local(m[1]) && !m[1].startsWith("#")) refs.add(m[1]);
    for (const f of ["style.css", "fonts.css"]) for (const m of read(f).matchAll(/url\(\s*["']?([^)"']+)["']?\s*\)/g)) if (local(m[1])) refs.add(m[1]);
    const noComments = (t) => t.split("\n").filter((l) => !/^\s*(\/\/|\*|\/\*)/.test(l)).join("\n");
    const strings = [read("config.js"), ...fs.readdirSync(path.join(ROOT, "js")).map((f) => read("js/" + f))].map(noComments).join("\n");
    for (const m of strings.matchAll(/["'`]((?:media|fonts)\/[\w./-]+)["'`]/g)) refs.add(m[1]);
    assert.ok(refs.size > 8, "found the references");
    const bad = [...refs].filter((r) => !r.includes("${") && !r.includes("..") && !r.endsWith(".") && !exists(r.split("?")[0].split("#")[0]));
    assert.deepEqual(bad.filter((b) => !/^\.?\/?#?\/?$/.test(b)), []);
  });
});

describe("the static shell", () => {
  test("loads every script it needs, in a working order", () => {
    const order = [...read("index.html").matchAll(/<script defer src="([^"]+)"/g)].map((m) => m[1]);
    const idx = (n) => order.indexOf(n);
    for (const f of ["config.js", "js/configcheck.js", "data.js", "js/player.js", "js/canvas.js", "js/highlight.js", "js/app.js", "js/cmdk.js"]) assert.ok(idx(f) >= 0, `${f} is not loaded`);
    assert.ok(idx("config.js") < idx("js/app.js") && idx("js/highlight.js") < idx("js/app.js"));
    assert.ok(idx("js/app.js") < idx("js/cmdk.js"), "app -> palette");
    for (const f of order) assert.ok(exists(f), `${f} listed in index.html but missing`);
  });

  test("has a no-JS fallback, a skip link and exactly one description", () => {
    const h = read("index.html");
    assert.match(h, /<noscript><style>#loader\{display:none\}<\/style><\/noscript>/);
    assert.match(h, /class="skip-link"/);
    assert.equal((h.match(/name="description"/g) || []).length, 1);
  });

  test("no leftover references to removed code (old cursor classes, old config keys)", () => {
    const all = [read("style.css"), read("index.html"), ...fs.readdirSync(path.join(ROOT, "js")).map((f) => read("js/" + f))].join("\n");
    for (const dead of [".cc-ring", ".cc-root", "custom-cursor", "CONFIG.navLinks", "CONFIG.heroTitle", "ROUTE_ALIASES"]) assert.ok(!all.includes(dead), dead);
  });
});
