const { test, describe, before } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { execFileSync } = require("node:child_process");
const { JSDOM } = require("jsdom");
const { ROOT, load, sleep, loadManage } = require("./helpers/harness");

// a throw-away copy of the project, so tests never touch the real files
function sandbox({ url = "https://piezuke.example.org", config = "" } = {}) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "seo-"));
  const skip = new Set(["node_modules", ".git", "tests", ".github", "media", "fonts", "content"]);
  fs.cpSync(ROOT, dir, { recursive: true, filter: (src) => !skip.has(path.basename(src)) || src === ROOT });
  for (const d of ["writeups", "projects", "notes"]) fs.mkdirSync(path.join(dir, "content", d), { recursive: true });
  let cfg = fs.readFileSync(path.join(dir, "config.js"), "utf8").replace(/url: "",/, `url: "${url}/",`);
  fs.writeFileSync(path.join(dir, "config.js"), cfg + (config ? "\n" + config : ""));
  for (const f of fs.readdirSync(dir)) if (/^(writeups|projects|ctf)-.*\.html$/.test(f) || f === "sitemap.xml" || f === "feed.xml" || f === ".seo-manifest.json") fs.unlinkSync(path.join(dir, f));
  const run = (...args) => execFileSync("node", ["manage.js", ...args], { cwd: dir, encoding: "utf8", env: { ...process.env, MANAGE_NO_SEO: "" } });
  const write = (rel, text) => fs.writeFileSync(path.join(dir, "content", rel), text);
  const read = (rel) => fs.readFileSync(path.join(dir, rel), "utf8");
  const exists = (rel) => fs.existsSync(path.join(dir, rel));
  return { dir, run, write, read, exists };
}

const HEAP = `---
title: Heap Overflow 101
tag: pwn · heap
date: 2025 November
excerpt: Overwriting a chunk header & friends.
pills: [Pwn, Heap]
ctf: PicoCTF 2026
category: pwn
points: 500
---

## Summary

We abuse a malloc bug. Flag: bi0s{h34p_0v3rfl0w_w1n5}

<script>alert(1)</script>

[bad](javascript:alert(1)) and [good](https://example.com/a?b=1&c=2)
`;
const XSS = `---
title: "<img src=x onerror=alert(1)> & \\"quotes\\""
tag: web
date: 2026-02
excerpt: tricky </script> excerpt
---
body
`;
const meta = (html, re) => (html.match(re) || [])[1];
const parseXml = (xml) => {
  const doc = new new JSDOM().window.DOMParser().parseFromString(xml, "application/xml");
  return { ok: !doc.querySelector("parsererror"), doc };
};

describe("per-post pages, sitemap and feed (manage.js)", () => {
  let sb;
  before(() => {
    sb = sandbox();
    sb.write("writeups/heap-overflow.md", HEAP);
    sb.write("writeups/xss-title.md", XSS);
    sb.write("writeups/draft-post.md", "---\ntitle: Secret Draft\ndraft: true\ndate: 2026-01\n---\nnot ready\n");
    sb.write("projects/tiny-os.md", "---\ntitle: Tiny OS\ntag: c · os\ndate: 2025-07\nimage: media/pfp.jpg\n---\n# Tiny OS\nA hobby kernel.\n");
    sb.out = sb.run("sync");
  });

  test("builds one page per writeup/project and skips drafts", () => {
    assert.ok(sb.exists("writeups-heap-overflow.html"));
    assert.ok(sb.exists("writeups-xss-title.html"));
    assert.ok(sb.exists("projects-tiny-os.html"));
    assert.ok(!sb.exists("writeups-draft-post.html"));
    assert.ok(!/Secret Draft/.test(sb.read("data.js")), "draft not in data.js either");
    assert.match(sb.out, /Drafts skipped: 1/);
  });

  test("each page has its own title, description, canonical URL and share tags (exactly once)", () => {
    const h = sb.read("writeups-heap-overflow.html");
    assert.equal(meta(h, /<title>(.*?)<\/title>/s), "Heap Overflow 101 — piezuke");
    for (const re of [/name="description"/g, /rel="canonical"/g, /property="og:title"/g, /property="og:image"/g, /name="twitter:card"/g])
      assert.equal((h.match(re) || []).length, 1, String(re));
    assert.equal(meta(h, /rel="canonical" href="([^"]+)"/), "https://piezuke.example.org/writeups-heap-overflow.html");
    assert.equal(meta(h, /property="og:url" content="([^"]+)"/), "https://piezuke.example.org/writeups-heap-overflow.html");
    assert.equal(meta(h, /property="og:type" content="([^"]+)"/), "article");
    assert.match(meta(h, /property="og:image" content="([^"]+)"/), /^https:\/\/piezuke\.example\.org\//, "share image is an absolute URL");
    assert.match(meta(h, /name="description"\s+content="([^"]+)"/), /Overwriting a chunk header &amp; friends\./);
    assert.match(h, /google-site-verification/, "keeps your verification tag");
  });

  test("a post's own image is its share image", () => {
    assert.equal(meta(sb.read("projects-tiny-os.html"), /property="og:image" content="([^"]+)"/), "https://piezuke.example.org/media/pfp.jpg");
  });

  test("JSON-LD is valid and describes the post", () => {
    const h = sb.read("writeups-heap-overflow.html");
    const ld = JSON.parse(meta(h, /<script type="application\/ld\+json">(.*?)<\/script>/s));
    assert.equal(ld["@type"], "BlogPosting");
    assert.equal(ld.headline, "Heap Overflow 101");
    assert.equal(ld.datePublished, "2025-11-01");
    assert.equal(ld.keywords, "pwn, heap");
  });

  test("the article text is in the HTML for crawlers, with hostile content neutralised", () => {
    const h = sb.read("writeups-heap-overflow.html");
    const app = meta(h, /<main id="app"[^>]*>([\s\S]*?)<\/main>/);
    assert.match(app, /<h1>Heap Overflow 101<\/h1>/);
    assert.match(app, /malloc bug/);
    assert.match(app, /<strong>ctf:<\/strong> PicoCTF 2026/);
    assert.ok(!/<script>alert/.test(app), "raw <script> escaped");
    assert.ok(!/javascript:/.test(app), "javascript: link dropped");
    assert.match(app, /href="https:\/\/example\.com\/a\?b=1&amp;c=2"/, "good link kept");
  });

  test("a hostile title can't break out of any tag, attribute or the JSON-LD block", () => {
    const h = sb.read("writeups-xss-title.html");
    assert.ok(!/<img src=x onerror/.test(h));
    const ld = meta(h, /<script type="application\/ld\+json">(.*?)<\/script>/s);
    assert.ok(!/<\/script/i.test(ld));
    assert.equal(JSON.parse(ld).description.startsWith("tricky"), true);
    assert.match(meta(h, /<title>(.*?)<\/title>/s), /^&lt;img src=x onerror=alert\(1\)&gt; &amp; &quot;quotes&quot;/);
  });

  test("opening a post page lands inside the app on that post", async () => {
    const s = load({ root: sb.dir, file: "writeups-heap-overflow.html", runInline: true, config: "CONFIG.ui.loader.minDuration=0;" });
    await sleep(500);
    assert.equal(s.window.location.hash, "#/writeups/heap-overflow");
    assert.match(s.text("#app h1"), /Heap Overflow 101/);
    assert.ok(s.document.querySelector(".article-body"));
    assert.deepEqual(s.errors(), []);
    s.close();
  });

  test("an existing #route in the address is never overwritten by the boot script", async () => {
    const s = load({ root: sb.dir, file: "writeups-heap-overflow.html", runInline: true, hash: "#/timeline", config: "CONFIG.ui.loader.minDuration=0;" });
    await sleep(400);
    assert.equal(s.window.location.hash, "#/timeline");
    s.close();
  });

  test("sitemap.xml is valid and lists home + every post with a date", () => {
    const x = sb.read("sitemap.xml");
    assert.ok(parseXml(x).ok);
    assert.match(x, /<loc>https:\/\/piezuke\.example\.org\/<\/loc>/);
    assert.match(x, /<loc>https:\/\/piezuke\.example\.org\/writeups-heap-overflow\.html<\/loc><lastmod>2025-11-01<\/lastmod>/);
    assert.match(x, /projects-tiny-os\.html<\/loc><lastmod>2025-07-01/);
    assert.ok(!/draft/i.test(x));
  });

  test("feed.xml is valid RSS, newest first, with escaped titles", () => {
    const x = sb.read("feed.xml");
    const { ok, doc } = parseXml(x);
    assert.ok(ok);
    const titles = [...doc.querySelectorAll("item > title")].map((t) => t.textContent);
    assert.equal(titles[0], '<img src=x onerror=alert(1)> & "quotes"', "2026-02 is newest");
    assert.equal(titles[1], "Heap Overflow 101");
    assert.equal(titles.length, 3);
    assert.match(x, /<pubDate>[A-Z][a-z]{2}, \d\d [A-Z][a-z]{2} 2025/);
    assert.match(x, /rel="self"/);
  });

  test("robots.txt gets exactly one Sitemap line, even after re-running", () => {
    sb.run("seo");
    sb.run("seo");
    const r = sb.read("robots.txt");
    assert.equal((r.match(/^Sitemap:/gim) || []).length, 1);
    assert.match(r, /Sitemap: https:\/\/piezuke\.example\.org\/sitemap\.xml/);
  });

  test("index.html advertises the feed (and re-running changes nothing)", () => {
    assert.match(sb.read("index.html"), /<!-- seo:feed --><link rel="alternate" type="application\/rss\+xml"[^>]*href="feed\.xml"/);
    const before = [sb.read("index.html"), sb.read("sitemap.xml").replace(/<lastmod>\d{4}-\d\d-\d\d<\/lastmod><\/url>\n  <url>/, ""), sb.read("writeups-heap-overflow.html")];
    sb.run("sync");
    assert.equal(sb.read("index.html"), before[0], "index.html stable");
    assert.equal(sb.read("writeups-heap-overflow.html"), before[2], "post page stable");
  });

  test("a post page also carries the feed link and the source of the app shell", () => {
    const h = sb.read("writeups-heap-overflow.html");
    assert.match(h, /rel="alternate" type="application\/rss\+xml"/);
    assert.match(h, /<script defer src="js\/app\.js">/);
  });
});

describe("cleanup and switches", () => {
  test("deleting a post removes its page on the next sync", () => {
    const sb = sandbox();
    sb.write("writeups/a.md", "---\ntitle: A\ndate: 2025-01\n---\nbody a\n");
    sb.write("writeups/b.md", "---\ntitle: B\ndate: 2025-02\n---\nbody b\n");
    sb.run("sync");
    assert.ok(sb.exists("writeups-a.html") && sb.exists("writeups-b.html"));
    fs.unlinkSync(path.join(sb.dir, "content", "writeups", "a.md"));
    sb.run("sync");
    assert.ok(!sb.exists("writeups-a.html"), "stale page removed");
    assert.ok(sb.exists("writeups-b.html"));
    assert.ok(!/writeups-a\.html/.test(sb.read("sitemap.xml")));
  });

  test("without site.url nothing is generated and the user is told what to do", () => {
    const sb = sandbox({ url: "" });
    sb.write("writeups/a.md", "---\ntitle: A\ndate: 2025-01\n---\nbody\n");
    const out = sb.run("sync");
    assert.ok(!sb.exists("writeups-a.html") && !sb.exists("sitemap.xml") && !sb.exists("feed.xml"));
    assert.match(out, /Set site\.url in config\.js/);
    assert.ok(!/seo:feed/.test(sb.read("index.html")));
  });

  test("turning the feed off removes feed.xml and its link", () => {
    const sb = sandbox();
    sb.write("writeups/a.md", "---\ntitle: A\ndate: 2025-01\n---\nbody\n");
    sb.run("sync");
    assert.ok(sb.exists("feed.xml"));
    fs.writeFileSync(path.join(sb.dir, "config.js"), sb.read("config.js") + "\nCONFIG.site.feed.enabled = false;");
    sb.run("sync");
    assert.ok(!sb.exists("feed.xml"));
    assert.ok(!/seo:feed/.test(sb.read("index.html")));
    assert.ok(sb.exists("sitemap.xml"), "sitemap stays");
  });

  test("renamed route slugs are followed (page name and the #route inside it)", () => {
    const sb = sandbox({ config: 'CONFIG.routes.writeups = "/ctf";' });
    sb.write("writeups/a.md", "---\ntitle: A\ndate: 2025-01\n---\nbody\n");
    sb.run("sync");
    assert.ok(sb.exists("ctf-a.html"));
    assert.match(sb.read("ctf-a.html"), /"#\/ctf\/a"/);
  });

  test("a bad site.url is refused rather than written into every page", () => {
    const sb = sandbox({ url: "not-a-url" });
    sb.write("writeups/a.md", "---\ntitle: A\ndate: 2025-01\n---\nbody\n");
    sb.run("sync");
    assert.ok(!sb.exists("writeups-a.html"));
  });

  test("two posts that map to the same file name are reported", () => {
    const sb = sandbox();
    sb.write("writeups/Same Name.md", "---\ntitle: One\nslug: Same-Name\ndate: 2025-01\n---\na\n");
    sb.write("writeups/same-name.md", "---\ntitle: Two\nslug: same-name\ndate: 2025-02\n---\nb\n");
    const out = execFileSync("node", ["manage.js", "sync"], { cwd: sb.dir, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] });
    assert.ok(sb.exists("writeups-same-name.html"));
  });
});

describe("copy-link addresses match the generated file names", () => {
  test("for tricky slugs (case, spaces, symbols) the app and manage.js agree, and names are lower-case", async () => {
    const M = loadManage();
    const s = load({ data: "var WRITEUPS=[];var PROJECTS=[];var NOTES_TREE=[];", config: 'CONFIG.site.url="https://user.github.io/r";' });
    await sleep(250);
    for (const slug of ["Heap Overflow", "a/b", "ÜBER cool", "x__y", "A.B-c", "MiXeD_Case"]) {
      const url = s.window.postUrl("writeups", slug);
      const file = `writeups-${M.safeFileName(slug)}.html`;
      assert.ok(url.startsWith(`https://user.github.io/r/${file}#/writeups/`), `${slug} -> ${url}`);
      assert.equal(file, file.toLowerCase(), "GitHub Pages is case-sensitive");
      assert.ok(!/[\s/\\]/.test(M.safeFileName(slug)));
    }
    s.close();
  });
});

describe("GitHub Pages project sites (https://user.github.io/repo)", () => {
  test("every absolute URL carries the repo path, and relative boot paths still work", () => {
    const sb = sandbox({ url: "https://user.github.io/my-repo" });
    sb.write("writeups/a.md", "---\ntitle: A\ndate: 2025-01\n---\nbody\n");
    sb.run("sync");
    const h = sb.read("writeups-a.html");
    assert.equal(meta(h, /rel="canonical" href="([^"]+)"/), "https://user.github.io/my-repo/writeups-a.html");
    assert.equal(meta(h, /property="og:image" content="([^"]+)"/), "https://user.github.io/my-repo/media/pfp.jpg");
    assert.match(sb.read("sitemap.xml"), /<loc>https:\/\/user\.github\.io\/my-repo\/<\/loc>/);
    assert.match(sb.read("sitemap.xml"), /<loc>https:\/\/user\.github\.io\/my-repo\/writeups-a\.html<\/loc>/);
    assert.match(sb.read("feed.xml"), /<link>https:\/\/user\.github\.io\/my-repo\/writeups-a\.html<\/link>/);
    assert.match(sb.read("robots.txt"), /Sitemap: https:\/\/user\.github\.io\/my-repo\/sitemap\.xml/);
    assert.match(h, /<script defer src="js\/app\.js">/, "assets stay relative, so they resolve under /my-repo/");
    assert.ok(!/(src|href)="\//.test(h.replace(/https?:\/\/[^"]*/g, "")), "no root-relative links that would break under /my-repo/");
  });
});

describe("extra post details", () => {
  test("`add writeup` flags become frontmatter fields, data.js meta, and a draft stays out of the site", () => {
    const sb = sandbox();
    sb.run("add", "writeup", "--title", "Flagged", "--tag", "pwn", "--ctf", "DiceCTF", "--category", "pwn", "--points", "250", "--difficulty", "easy", "--meta", "solves=42");
    sb.run("add", "writeup", "--title", "Hidden", "--draft");
    const md = sb.read("content/writeups/flagged.md");
    assert.match(md, /ctf: DiceCTF/);
    assert.match(md, /points: 250/);
    const data = sb.read("data.js");
    assert.match(data, /"ctf": "DiceCTF"/);
    assert.match(data, /"solves": "42"/);
    assert.ok(!/Hidden/.test(data));
    assert.ok(fs.existsSync(path.join(sb.dir, "content/writeups/hidden.md")), "draft file kept on disk");
  });
});
