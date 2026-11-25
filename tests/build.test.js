const { test, describe } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const crypto = require("node:crypto");
const vm = require("node:vm");
const { ROOT, load, sleep } = require("./helpers/harness");
const { build } = require("../build");

const tmp = (n) => fs.mkdtempSync(path.join(os.tmpdir(), n));
const sha8 = (buf) => crypto.createHash("sha256").update(buf).digest("hex").slice(0, 8);
const list = (dir, base = dir) =>
  fs.readdirSync(dir, { withFileTypes: true }).flatMap((e) => (e.isDirectory() ? list(path.join(dir, e.name), base) : [path.relative(base, path.join(dir, e.name)).split(path.sep).join("/")]));

describe("build.js: what gets published", () => {
  const out = tmp("dist-");
  const r = build({ out });
  const files = list(out);

  test("only website files are published: no content, tooling, tests or workflow files", () => {
    for (const bad of ["manage.js", "build.js", "package.json", "package-lock.json", "README.md", "sw.js.map"]) assert.ok(!files.includes(bad), `${bad} must not be published`);
    assert.ok(!files.some((f) => /^(content|tests|node_modules|\.github)\//.test(f)));
    for (const need of ["index.html", "404.html", "style.css", "config.js", "data.js", "sw.js", "robots.txt", ".nojekyll"]) assert.ok(files.includes(need), `${need} is published`);
    assert.ok(files.some((f) => f.startsWith("js/") && f.endsWith(".js")));
  });

  test("our CSS and JS are minified (and still parse); vendor *.min.js files are left alone", () => {
    for (const f of ["style.css", "config.js", "js/app.js", "js/fx.js"]) {
      assert.ok(fs.statSync(path.join(out, f)).size < fs.statSync(path.join(ROOT, f)).size * 0.85, `${f} is at least 15% smaller`);
    }
    for (const f of ["js/gsap.min.js", "js/ScrollTrigger.min.js", "js/SplitText.min.js"]) assert.equal(fs.readFileSync(path.join(out, f), "utf8"), fs.readFileSync(path.join(ROOT, f), "utf8"), `${f} is vendor code, left as shipped`);
    const marked = fs.readFileSync(path.join(out, "marked.min.js"), "utf8");
    assert.ok(marked.length < fs.readFileSync(path.join(ROOT, "marked.min.js"), "utf8").length, "marked.min.js is squeezed a bit more");
    assert.match(marked, /marked v[\d.]+/, "...with its licence banner kept");
    assert.match(fs.readFileSync(path.join(out, "config.js"), "utf8"), /\bCONFIG\b/, "the shared top-level names survive minification");
  });

  test("every script and stylesheet URL carries the hash of that file's content", () => {
    const html = fs.readFileSync(path.join(out, "index.html"), "utf8");
    const refs = [...html.matchAll(/\s(?:src|href)="([^"?#]+\.(?:js|css))\?v=([0-9a-f]{8})"/g)];
    assert.ok(refs.length >= 12, "scripts and styles are versioned");
    for (const [, file, hash] of refs) assert.equal(hash, sha8(fs.readFileSync(path.join(out, file))), `${file}?v= matches its content`);
    assert.ok(!/\s(?:src|href)="(?:style\.css|config\.js|js\/app\.js)"/.test(html), "no unversioned reference is left");
  });

  test("the service worker's build id matches the page's, and everything it precaches exists", () => {
    const html = fs.readFileSync(path.join(out, "index.html"), "utf8");
    const id = html.match(/<meta name="app-build" content="([0-9a-f]{12})"/)[1];
    const sw = fs.readFileSync(path.join(out, "sw.js"), "utf8");
    assert.ok(sw.includes(`"${id}"`), "same build id");
    assert.ok(!/__[A-Z]+__|\/\*PRECACHE\*\/\s*\[\s*\]/.test(sw), "placeholders are filled in");
    assert.ok(r.precache.length > 15);
    for (const u of r.precache) if (u !== "./") assert.ok(fs.existsSync(path.join(out, u.split("?")[0])), `${u} exists`);
    assert.ok(!r.precache.some((u) => /\.mp4/.test(u)), "the loader video is streamed, not precached");
    assert.ok(!/<meta name="app-build"/.test(fs.readFileSync(path.join(out, "404.html"), "utf8")), "the 404 redirect page is not controlled by the worker");
  });

  test("fonts.css is merged into style.css: no separate render-blocking request", () => {
    const html = fs.readFileSync(path.join(out, "index.html"), "utf8");
    assert.ok(!/fonts\.css/.test(html), "no link to fonts.css");
    assert.ok(!files.includes("fonts.css"));
    assert.ok((fs.readFileSync(path.join(out, "style.css"), "utf8").match(/@font-face/g) || []).length >= 4, "the @font-face rules are now inside style.css");
    assert.ok(!r.precache.some((u) => /fonts\.css/.test(u)));
    assert.match(fs.readFileSync(path.join(ROOT, "index.html"), "utf8"), /href="fonts\.css"/, "(the source still has it, for development)");
  });

  test("the inline script is untouched, so the page's CSP hash is still valid", () => {
    const built = fs.readFileSync(path.join(out, "index.html"), "utf8");
    const code = (h) => h.match(/<script>([\s\S]*?)<\/script>/)[1];
    assert.equal(code(built), code(fs.readFileSync(path.join(ROOT, "index.html"), "utf8")));
  });
});

describe("build.js: change detection (what makes visitors re-download)", () => {
  test("editing one file changes that file's hash and the build id, and nothing else", () => {
    const copy = tmp("proj-");
    const skip = new Set(["node_modules", ".git", "tests", "dist"]);
    fs.cpSync(ROOT, copy, { recursive: true, filter: (s) => !skip.has(path.basename(s)) || s === ROOT });
    const a = build({ root: copy, out: path.join(copy, "dist-a") });
    fs.appendFileSync(path.join(copy, "js", "fx.js"), "\n/* changed */ window.__x = 1;\n");
    const b = build({ root: copy, out: path.join(copy, "dist-b") });
    assert.notEqual(a.buildId, b.buildId, "a new build id means a new cache");
    for (const [file, hash] of a.versioned) {
      if (file === "js/fx.js") assert.notEqual(hash, b.versioned.get(file));
      else assert.equal(hash, b.versioned.get(file), `${file} keeps its URL, so visitors keep their cached copy`);
    }
  });
});

describe("build.js: the built page runs", () => {
  test("an unminified build of the site boots with no errors (hash URLs, build meta and all)", async () => {
    const out = tmp("run-");
    build({ out, minify: false });
    const s = load({ root: out, file: "index.html", config: "CONFIG.ui.loader.minDuration=0;" });
    await sleep(400);
    assert.ok(s.document.querySelector('meta[name="app-build"]'));
    assert.ok(s.document.querySelector(".hero"), "the home page rendered");
    assert.deepEqual(s.errors(), []);
    s.close();
  });
});

describe("GitHub Actions workflow hardening", () => {
  const wf = fs.readFileSync(path.join(ROOT, ".github", "workflows", "deploy.yml"), "utf8");

  test("every action is pinned to a full commit SHA", () => {
    const uses = [...wf.matchAll(/^\s*-?\s*uses:\s*(\S+)/gm)].map((m) => m[1]);
    assert.ok(uses.length >= 5);
    for (const u of uses) assert.match(u, /^[\w.-]+\/[\w.-]+@[0-9a-f]{40}$/, `${u} must be pinned to a 40-character commit SHA`);
  });

  test("least privilege: read-only by default, only the deploy job may publish", () => {
    assert.match(wf, /^permissions:\s*\n\s+contents: read\s*$/m);
    const testJob = wf.slice(wf.indexOf("  test:"), wf.indexOf("  deploy:"));
    assert.ok(!/pages: write|id-token: write/.test(testJob), "the test job cannot publish");
    const deployJob = wf.slice(wf.indexOf("  deploy:"));
    assert.match(deployJob, /pages: write/);
    assert.match(deployJob, /id-token: write/);
    assert.ok(!/pull_request_target/.test(wf), "never run untrusted PR code with secrets");
  });

  test("installs without running dependency scripts; checkout does not keep the token; jobs have timeouts", () => {
    assert.ok(!/npm ci(?! --ignore-scripts)/.test(wf), "npm ci always uses --ignore-scripts");
    assert.equal((wf.match(/persist-credentials: false/g) || []).length, 2);
    assert.equal((wf.match(/timeout-minutes:/g) || []).length, 2);
    assert.match(wf, /node build\.js --out dist/);
  });

  test("Dependabot keeps actions and npm packages current", () => {
    const d = fs.readFileSync(path.join(ROOT, ".github", "dependabot.yml"), "utf8");
    assert.match(d, /package-ecosystem: github-actions/);
    assert.match(d, /package-ecosystem: npm/);
  });
});

describe("service worker (sw.js)", () => {
  const source = fs.readFileSync(path.join(ROOT, "sw.js"), "utf8");

  function env(precache = []) {
    const handlers = {};
    const store = new Map();
    const net = { calls: [], offline: false };
    const respond = (url) => {
      const r = new Response("net:" + url, { status: 200 });
      Object.defineProperty(r, "type", { value: "basic" });
      return r;
    };
    const fetchMock = async (input) => {
      const url = typeof input === "string" ? input : input.url;
      net.calls.push(url);
      if (net.offline) throw new TypeError("offline");
      return respond(url);
    };
    const key = (r) => (typeof r === "string" ? r : r.url);
    const caches = {
      open: async (name) => {
        if (!store.has(name)) store.set(name, new Map());
        const m = store.get(name);
        return {
          match: async (r) => (m.has(key(r)) ? m.get(key(r)).clone() : undefined),
          put: async (r, res) => void m.set(key(r), res),
          addAll: async (rs) => { for (const r of rs) m.set(r.url, await fetchMock(r)); },
        };
      },
      keys: async () => [...store.keys()],
      delete: async (n) => store.delete(n),
    };
    const self = { location: { origin: "https://site.test" }, registration: { scope: "https://site.test/app/" }, clients: { claim: async () => {} }, skipWaiting: async () => {}, addEventListener: (t, fn) => (handlers[t] = fn) };
    // in a browser a relative URL resolves against the worker's own URL
    class BrowserRequest {
      constructor(u, o = {}) {
        this.url = new URL(u, "https://site.test/app/sw.js").href;
        this.cache = o.cache;
      }
    }
    vm.runInNewContext(source.replace(/\/\*PRECACHE\*\/[\s\S]*?\/\*END\*\//, `/*PRECACHE*/ ${JSON.stringify(precache)} /*END*/`), { self, caches, fetch: fetchMock, Request: BrowserRequest, Response, URL, setTimeout, clearTimeout, Promise });
    const req = (url, o = {}) => ({ url, method: o.method || "GET", mode: o.mode || "no-cors", headers: new Headers(o.headers || {}) });
    const fire = async (r) => {
      let p;
      await handlers.fetch({ request: r, respondWith: (x) => (p = x) });
      return p === undefined ? undefined : await p;
    };
    return { handlers, store, net, req, fire };
  }

  test("only same-origin GET requests are ever touched (other sites, POST and Range go straight to the network)", async () => {
    const e = env();
    assert.equal(await e.fire(e.req("https://other.test/x.js")), undefined, "cross-origin");
    assert.equal(await e.fire(e.req("https://site.test/app/x", { method: "POST" })), undefined, "POST");
    assert.equal(await e.fire(e.req("https://site.test/app/media/loader.mp4", { headers: { range: "bytes=0-" } })), undefined, "Range (video)");
    assert.equal(await e.fire(e.req("https://site.test/app/sw.js")), undefined, "the worker never caches itself");
    assert.equal(e.net.calls.length, 0);
  });

  test("assets: fetched once, then answered from the cache with no network request", async () => {
    const e = env();
    const url = "https://site.test/app/js/app.js?v=abc12345";
    assert.equal(await (await e.fire(e.req(url))).text(), "net:" + url);
    assert.equal(e.net.calls.length, 1);
    assert.equal(await (await e.fire(e.req(url))).text(), "net:" + url);
    assert.equal(e.net.calls.length, 1, "second time came from the cache");
    await e.fire(e.req("https://site.test/app/js/app.js?v=ffffffff"));
    assert.equal(e.net.calls.length, 2, "a new hash is a new file");
  });

  test("pages: network first (so a new deploy shows at once), cached copy when offline, index.html as the last resort", async () => {
    const e = env();
    const page = "https://site.test/app/writeups-heap.html";
    assert.match(await (await e.fire(e.req(page, { mode: "navigate" }))).text(), /^net:/);
    e.net.offline = true;
    assert.match(await (await e.fire(e.req(page, { mode: "navigate" }))).text(), /^net:/, "offline: the cached copy of that page");
    // a page that was never cached falls back to index.html
    const shell = await e.store.get([...e.store.keys()][0]);
    shell.set("https://site.test/app/index.html", new Response("shell"));
    shell.set("https://site.test/index.html", new Response("shell"));
    assert.equal(await (await e.fire(e.req("https://site.test/app/never-seen.html", { mode: "navigate" }))).text(), "shell");
  });

  test("install precaches the list with cache:reload; activate removes old versions", async () => {
    const e = env(["./", "index.html", "style.css?v=1"]);
    let done;
    await e.handlers.install({ waitUntil: (p) => (done = p) });
    await done;
    const name = [...e.store.keys()][0];
    assert.match(name, /^site-/);
    assert.equal(e.store.get(name).size, 3);
    assert.ok(e.net.calls.includes("https://site.test/app/style.css?v=1"), "relative URLs resolve against the worker");
    e.store.set("site-old", new Map());
    e.store.set("someone-elses", new Map());
    await e.handlers.activate({ waitUntil: (p) => (done = p) });
    await done;
    assert.ok(!e.store.has("site-old"), "stale site cache deleted");
    assert.ok(e.store.has("someone-elses"), "caches we do not own are left alone");
  });
});
