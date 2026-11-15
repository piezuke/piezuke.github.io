const { test, describe } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const crypto = require("node:crypto");
const { execFileSync } = require("node:child_process");
const { ROOT, load, sleep, FIXTURE_DATA } = require("./helpers/harness");

const read = (f) => fs.readFileSync(path.join(ROOT, f), "utf8");
const csp = (html) => html.match(/http-equiv="Content-Security-Policy"\s+content="([^"]+)"/)[1];
const directive = (policy, name) => (policy.match(new RegExp("(?:^|;)\\s*" + name + "\\s+([^;]*)")) || [])[1];

// every inline script the browser would execute (JSON-LD and other data blocks never run)
function inlineScripts(html) {
  const out = [];
  const re = /<script(?![^>]*\bsrc\s*=)([^>]*)>([\s\S]*?)<\/script>/gi;
  let m;
  while ((m = re.exec(html))) {
    const type = (m[1].match(/\btype\s*=\s*["']?([^"'\s>]+)/i) || [])[1];
    if (type && !/^(text\/javascript|application\/javascript|module)$/i.test(type)) continue;
    out.push(m[2]);
  }
  return out;
}
const hashOf = (code) => "'sha256-" + crypto.createHash("sha256").update(code, "utf8").digest("base64") + "'";

function sandbox() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "sec-"));
  const skip = new Set(["node_modules", ".git", "tests", ".github", "media", "fonts", "content"]);
  fs.cpSync(ROOT, dir, { recursive: true, filter: (src) => !skip.has(path.basename(src)) || src === ROOT });
  for (const d of ["writeups", "projects", "notes"]) fs.mkdirSync(path.join(dir, "content", d), { recursive: true });
  // per-post pages are only generated when the site has a public URL
  fs.writeFileSync(path.join(dir, "config.js"), fs.readFileSync(path.join(dir, "config.js"), "utf8").replace(/url: "",/, 'url: "https://piezuke.example.org/",'));
  for (const f of fs.readdirSync(dir)) if (/^(writeups|projects|ctf)-.*\.html$/.test(f)) fs.unlinkSync(path.join(dir, f));
  const run = (...a) => execFileSync("node", ["manage.js", ...a], { cwd: dir, encoding: "utf8" });
  return { dir, run, read: (f) => fs.readFileSync(path.join(dir, f), "utf8") };
}

describe("Content-Security-Policy", () => {
  test("scripts: only this site and hashed inline scripts; no 'unsafe-inline', no eval, no wildcards", () => {
    const src = directive(csp(read("index.html")), "script-src");
    assert.match(src, /'self'/);
    for (const bad of ["'unsafe-inline'", "'unsafe-eval'", "https:", "http:", "*", "data:", "blob:"]) assert.ok(!src.split(/\s+/).includes(bad), `script-src must not contain ${bad}`);
  });

  test("the other directives lock down plugins, frames, base URL, forms and workers", () => {
    const p = csp(read("index.html"));
    assert.equal(directive(p, "default-src"), "'self'");
    assert.equal(directive(p, "object-src"), "'none'");
    assert.equal(directive(p, "frame-src"), "'none'");
    assert.equal(directive(p, "base-uri"), "'self'");
    assert.equal(directive(p, "form-action"), "'self'");
    assert.equal(directive(p, "worker-src"), "'self'");
    assert.equal(directive(p, "connect-src"), "'self'");
    assert.ok(/upgrade-insecure-requests/.test(p));
  });

  for (const file of ["index.html", "404.html"]) {
    test(`${file}: every inline script is allowed by hash, and no stale hashes are left over`, () => {
      const html = read(file);
      const hashes = (directive(csp(html), "script-src").match(/'sha256-[^']+'/g) || []).sort();
      const expected = inlineScripts(html).map(hashOf).sort();
      assert.deepEqual(hashes, expected, "run  node manage.js csp  after editing an inline <script>");
    });
  }

  test("404.html may do nothing but run its own script", () => {
    const p = csp(read("404.html"));
    assert.equal(directive(p, "default-src"), "'none'");
    assert.equal(directive(p, "base-uri"), "'none'");
  });

  test("`node manage.js csp` finds everything already in sync", () => {
    const sb = sandbox();
    assert.match(sb.run("csp"), /already up to date/);
  });

  test("editing the inline script and running `csp` re-hashes it everywhere", () => {
    const sb = sandbox();
    const before = sb.read("index.html");
    fs.writeFileSync(path.join(sb.dir, "index.html"), before.replace("var theme =", "var theme2 = 0; var theme ="));
    const out = sb.run("csp");
    assert.match(out, /CSP updated in: .*index\.html/);
    const after = sb.read("index.html");
    assert.ok(directive(csp(after), "script-src").includes(hashOf(inlineScripts(after)[0])));
    assert.ok(sb.read("_headers").includes(hashOf(inlineScripts(after)[0])), "_headers gets the same policy");
  });
});

describe("no inline event handlers (they would need 'unsafe-inline')", () => {
  const files = ["index.html", "404.html", ...fs.readdirSync(path.join(ROOT, "js")).filter((f) => f.endsWith(".js") && !f.endsWith(".min.js")).map((f) => "js/" + f)];
  for (const f of files) {
    test(f, () => {
      const hit = read(f).match(/\son(?:click|dblclick|keydown|keyup|keypress|load|error|mouse\w+|focus|blur|change|input|submit|toggle|pointer\w+)\s*=\s*["']/i);
      assert.equal(hit, null, hit && `inline handler: ${hit[0]}`);
    });
  }

  test("the notes sidebar still works through delegated listeners (click and keyboard)", async () => {
    const s = load({ data: FIXTURE_DATA, hash: "#/notes", config: "CONFIG.ui.loader.minDuration=0;" });
    await sleep(400);
    const folder = s.document.querySelector(".notetree .folder");
    assert.ok(folder, "a folder row exists");
    assert.equal(folder.getAttribute("onclick"), null);
    const group = folder.closest(".folder-group");
    const was = group.classList.contains("collapsed");
    folder.click();
    assert.equal(group.classList.contains("collapsed"), !was, "click toggles");
    folder.dispatchEvent(new s.window.KeyboardEvent("keydown", { key: "Enter", bubbles: true, cancelable: true }));
    assert.equal(group.classList.contains("collapsed"), was, "Enter toggles back");
    const all = s.document.querySelector('[data-act="collapse-all"]');
    all.click();
    assert.ok([...s.document.querySelectorAll(".notetree .folder-group")].every((g) => g.classList.contains("collapsed")), "collapse all");
    assert.deepEqual(s.errors(), []);
  });
});

describe("generated post pages stay CSP-clean", () => {
  const MD = "---\ntitle: Heap Overflow 101\ndate: 2025 November\n---\nbody <script>alert(1)</script> [x](javascript:alert(1))\n";

  test("no new inline script: the route comes from a <meta>, and every inline script is hashed", () => {
    const sb = sandbox();
    fs.writeFileSync(path.join(sb.dir, "content", "writeups", "heap.md"), MD);
    sb.run("sync");
    const page = sb.read("writeups-heap.html");
    assert.match(page, /<meta name="boot-route" content="#\/writeups\/heap" \/>/);
    assert.ok(!/replaceState/.test(page), "the old inline boot script is gone");
    const allowed = directive(csp(page), "script-src");
    for (const code of inlineScripts(page)) assert.ok(allowed.includes(hashOf(code)), "inline script not covered by the page's CSP");
    assert.ok(!/<script>alert/.test(page), "post text can't inject a script");
    assert.ok(!/javascript:/i.test(page.match(/<main id="app"[\s\S]*?<\/main>/)[0]));
  });

  test("a hostile boot-route is ignored (only #/safe/paths are accepted)", async () => {
    const sb = sandbox();
    fs.writeFileSync(path.join(sb.dir, "content", "writeups", "heap.md"), MD);
    sb.run("sync");
    for (const bad of ["javascript:alert(1)", "//evil.example/x", "#/a b", "#/\"><img src=x onerror=alert(1)>", "https://evil.example"]) {
      const page = sb.read("writeups-heap.html").replace(/<meta name="boot-route" content="[^"]*" \/>/, `<meta name="boot-route" content="${bad.replace(/"/g, "&quot;")}" />`);
      fs.writeFileSync(path.join(sb.dir, "hostile.html"), page);
      const s = load({ root: sb.dir, file: "hostile.html", runInline: true, config: "CONFIG.ui.loader.minDuration=0;" });
      await sleep(200);
      assert.ok(!/evil|alert|javascript/i.test(s.window.location.href), `ignored: ${bad}`);
      s.close();
    }
  });
});
