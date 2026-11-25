const { test, describe } = require("node:test");
const assert = require("node:assert/strict");
const { load, sleep, FIXTURE_DATA } = require("./helpers/harness");

const POST = "#/writeups/heap-overflow";
const post = async (extra = {}) => {
  const s = load(Object.assign({ hash: POST, data: FIXTURE_DATA }, extra));
  await sleep(400);
  return s;
};

describe("code blocks", () => {
  test("are syntax highlighted and labelled with their language", async () => {
    const s = await post();
    const pre = s.document.querySelector(".article-body pre");
    assert.equal(pre.getAttribute("data-lang"), "c");
    assert.ok(pre.querySelector(".hl-p"), "preprocessor line coloured");
    assert.ok(pre.querySelector(".hl-t"), "type coloured");
    assert.match(pre.textContent, /#include <stdio.h>/, "text unchanged");
  });
  test("highlighting and labels can be switched off in config.js", async () => {
    const s = await post({ config: "CONFIG.ui.code.highlight=false; CONFIG.ui.code.languageLabel=false;" });
    const pre = s.document.querySelector(".article-body pre");
    assert.equal(pre.querySelector('[class^="hl-"]'), null);
    assert.equal(pre.getAttribute("data-lang"), null);
  });
  test("the copy button still copies the plain code", async () => {
    const s = await post();
    assert.ok(s.document.querySelector(".article-body pre .code-copy"));
  });
});

describe("flags in writeups are blurred until clicked", () => {
  test("a flag is wrapped, hinted, and reveals on click", async () => {
    const s = await post();
    const sp = s.document.querySelectorAll(".spoiler");
    assert.equal(sp.length, 1);
    assert.equal(sp[0].textContent, "bi0s{h34p_0v3rfl0w_w1n5}");
    assert.equal(sp[0].getAttribute("role"), "button");
    assert.equal(sp[0].getAttribute("aria-expanded"), "false");
    assert.equal(sp[0].title, "click to reveal");
    sp[0].click();
    assert.ok(sp[0].classList.contains("revealed"));
    assert.equal(sp[0].getAttribute("aria-expanded"), "true");
  });
  test("works from the keyboard", async () => {
    const s = await post();
    const sp = s.document.querySelector(".spoiler");
    sp.dispatchEvent(new s.window.KeyboardEvent("keydown", { key: "Enter", bubbles: true, cancelable: true }));
    assert.ok(sp.classList.contains("revealed"));
  });
  test("ordinary code and braces are not blurred", async () => {
    const s = await post();
    assert.ok(!s.document.querySelector("pre .spoiler"), "int main(){ return 0; } is untouched");
  });
  test("can be disabled in config.js", async () => {
    const s = await post({ config: "CONFIG.pages.post.flags.enabled=false;" });
    assert.equal(s.document.querySelectorAll(".spoiler").length, 0);
  });
});

describe("post header", () => {
  test("shows CTF details from the frontmatter, with friendly labels from config", async () => {
    const s = await post();
    const pills = [...s.document.querySelectorAll(".postmeta .pm")].map((e) => e.textContent);
    assert.deepEqual(pills, ["CTFPicoCTF 2026", "Categorypwn", "Points500"]);
  });
  test("a post with no extra details has no empty meta row", async () => {
    const s = await post({ hash: "#/writeups/web-sqli" });
    assert.equal(s.document.querySelector(".postmeta"), null);
  });
  test("labels can be renamed in config.js", async () => {
    const s = await post({ config: 'CONFIG.pages.post.meta.labels.ctf="Event name";' });
    assert.match(s.text(".postmeta"), /Event name/);
  });
});

describe("sharing", () => {
  const withClipboard = (s) => {
    const copied = [];
    Object.defineProperty(s.window.navigator, "clipboard", { value: { writeText: async (t) => copied.push(t) }, configurable: true });
    return copied;
  };
  test("'copy link' copies the post's own address when site.url is set (rich previews)", async () => {
    const s = await post({ config: 'CONFIG.site.url="https://example.org";' });
    const copied = withClipboard(s);
    s.document.getElementById("sharebtn").click();
    await sleep(50);
    assert.deepEqual(copied, ["https://example.org/writeups/heap-overflow"]);
    assert.equal(s.text("#sharebtn"), "link copied ✓");
  });
  test("...and the current page + route when it isn't", async () => {
    const s = await post({ config: 'CONFIG.site.url="";' });
    const copied = withClipboard(s);
    s.document.getElementById("sharebtn").click();
    await sleep(50);
    assert.deepEqual(copied, ["http://localhost/writeups/heap-overflow"]);
  });
  test("every h2/h3 gets a '#' that copies a link to that section", async () => {
    const s = await post({ config: 'CONFIG.site.url="https://example.org";' });
    const copied = withClipboard(s);
    const heads = s.document.querySelectorAll(".article-body h2[id], .article-body h3[id]");
    assert.ok(heads.length >= 3);
    for (const h of heads) assert.ok(h.querySelector(".h-link"), h.textContent);
    const h = s.document.querySelector(".article-body h2[id]");
    h.querySelector(".h-link").click();
    await sleep(50);
    assert.equal(copied[0], `https://example.org/writeups/heap-overflow?h=${h.id}`);
  });
  test("opening a section link scrolls to that section", async () => {
    const probe = await post();
    const id = probe.document.querySelector(".article-body h2[id]").id;
    const s = load({ hash: `${POST}?h=${id}`, data: FIXTURE_DATA });
    await sleep(500);
    assert.equal(s.window.__scrolledTo && s.window.__scrolledTo.id, id);
  });
  test("a bogus ?h= value is ignored safely", async () => {
    const s = load({ hash: `${POST}?h=%22%3E%3Cimg%20src=x%3E`, data: FIXTURE_DATA });
    await sleep(400);
    assert.deepEqual(s.errors(), []);
    assert.ok(s.document.querySelector(".article-body"));
  });
});
