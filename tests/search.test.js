const { test, describe } = require("node:test");
const assert = require("node:assert/strict");
const { load, sleep, FIXTURE_DATA } = require("./helpers/harness");

const search = async (extraData) => {
  const s = load({ data: extraData ? FIXTURE_DATA + extraData : FIXTURE_DATA, config: "CONFIG.ui.loader.minDuration=0;" });
  await sleep(250);
  s.window.PaletteAPI.open();
  const q = (text) => JSON.parse(JSON.stringify(s.window.PaletteAPI.search(text)));
  return { s, q };
};
const titles = (rs) => rs.map((r) => r.titleHtml.replace(/<\/?mark>/g, ""));

describe("full-text search", () => {
  test("finds words that only appear in the body of a writeup, with a highlighted snippet", async () => {
    const { q } = await search();
    const r = q("poisoning");
    assert.deepEqual(titles(r), ["Heap Overflow 101"]);
    assert.match(r[0].snippetHtml, /<mark>poisoning<\/mark>/);
    assert.equal(r[0].tag, "writeup");
  });
  test("searches notes too, at any folder depth", async () => {
    const { q } = await search();
    assert.deepEqual(titles(q("commit_creds")), ["Kernel ROP"]);
    assert.deepEqual(titles(q("safe-linking")), ["Tcache notes"]);
  });
  test("searches projects", async () => {
    const { q } = await search();
    assert.deepEqual(titles(q("bootloader")), ["Tiny OS"]);
  });
  test("every word has to match (AND), in any order", async () => {
    const { q } = await search();
    assert.deepEqual(titles(q("gadget tcache")), ["Heap Overflow 101"]);
    assert.deepEqual(titles(q("tcache zzzzzz")), []);
  });
  test("matches are case-insensitive and highlighted in titles", async () => {
    const { q } = await search();
    const r = q("HEAP");
    assert.equal(titles(r)[0], "Heap Overflow 101");
    assert.match(r[0].titleHtml, /<mark>Heap<\/mark> Overflow 101/);
  });
  test("title matches outrank body-only matches", async () => {
    const { q } = await search();
    assert.equal(titles(q("tcache"))[0], "Tcache notes");
  });
  test("results from the page's own data can't inject HTML", async () => {
    const { q } = await search('\nWRITEUPS.push({slug:"x",title:"<img src=x onerror=alert(1)> evil",tag:"web",date:"2025",excerpt:"e",pills:[],body:"<script>alert(1)</script> evil"});');
    const r = q("evil");
    assert.ok(r.length);
    for (const x of r) assert.ok(!/<img|<script/.test(x.titleHtml + x.snippetHtml));
  });
});

describe("tag filters", () => {
  test("#tag keeps only items with that tag (writeups, projects, and notes by folder)", async () => {
    const { q } = await search();
    assert.deepEqual(titles(q("#pwn")).sort(), ["Heap Overflow 101", "Tcache notes"]);
    assert.deepEqual(titles(q("#web")), ["Blind SQLi"]);
    assert.deepEqual(titles(q("#os")), ["Tiny OS"]);
  });
  test("#tag combines with words", async () => {
    const { q } = await search();
    assert.deepEqual(titles(q("#pwn tcache")).sort(), ["Heap Overflow 101", "Tcache notes"]);
    assert.deepEqual(titles(q("#web tcache")), []);
  });
  test("unknown tag -> no results", async () => {
    const { q } = await search();
    assert.deepEqual(titles(q("#nonexistent")), []);
  });
});

describe("palette UI", () => {
  test("empty query lists pages first and offers clickable tag chips", async () => {
    const { s } = await search();
    const items = [...s.document.querySelectorAll(".palette-item .pi-title")].map((e) => e.textContent);
    assert.equal(items[0], "Home");
    const chips = [...s.document.querySelectorAll(".palette-chip")].map((e) => e.textContent);
    assert.ok(chips.includes("#pwn") && chips.includes("#web"));
  });
  test("clicking a tag chip filters the results", async () => {
    const { s } = await search();
    [...s.document.querySelectorAll(".palette-chip")].find((e) => e.textContent === "#web").click();
    assert.equal(s.document.getElementById("palette-input").value, "#web ");
    assert.deepEqual([...s.document.querySelectorAll(".palette-item .pi-title")].map((e) => e.textContent), ["Blind SQLi"]);
  });
  test("typing renders results, arrows move, Enter opens", async () => {
    const { s } = await search();
    const input = s.document.getElementById("palette-input");
    const key = (k) => input.dispatchEvent(new s.window.KeyboardEvent("keydown", { key: k, bubbles: true }));
    input.value = "tcache";
    input.dispatchEvent(new s.window.Event("input"));
    assert.equal(s.document.querySelectorAll(".palette-item").length, 2);
    key("ArrowDown");
    assert.equal(s.document.querySelectorAll(".palette-item")[1].getAttribute("aria-selected"), "true");
    key("Enter");
    assert.match(s.window.location.hash, /^#\/(writeups|notes)\//);
    assert.ok(!s.document.getElementById("palette-overlay").classList.contains("open"), "palette closed");
  });
  test("no matches shows the configured message with the (escaped) query", async () => {
    const { s } = await search();
    const input = s.document.getElementById("palette-input");
    input.value = "<b>zzz";
    input.dispatchEvent(new s.window.Event("input"));
    assert.match(s.text(".palette-empty"), /No matches for "<b>zzz"/);
    assert.equal(s.document.querySelector(".palette-empty b"), null);
  });
  test("'/' and Ctrl+K open it", async () => {
    const { s } = await search();
    s.window.PaletteAPI.close();
    s.document.dispatchEvent(new s.window.KeyboardEvent("keydown", { key: "/", bubbles: true, cancelable: true }));
    assert.ok(s.document.getElementById("palette-overlay").classList.contains("open"));
  });
});
