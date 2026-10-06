const { test, describe } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const { load, sleep, FIXTURE_DATA, read } = require("./helpers/harness");

const page = async (extra = {}) => {
  const s = load(Object.assign({ data: FIXTURE_DATA, config: "CONFIG.ui.loader.minDuration=0;" }, extra));
  await sleep(250);
  return s;
};
const FLAGS = () => Object.fromEntries(new Function(read("config.js") + ";return CONFIG")().easterEggs.flags.map((f) => [f.id, f.flag]));
const found = (s) => [...s.window.__flagHunt.found()].sort();
const key = (s, k) => s.document.dispatchEvent(new s.window.KeyboardEvent("keydown", { key: k, bubbles: true }));
const toast = (s) => s.text(".egg-toast");
const providerHits = (s, q) => JSON.parse(JSON.stringify(s.window.PaletteProviders.flatMap((fn) => fn(q))));

describe("flag hunt", () => {
  test("the console flag is printed to the developer console", async () => {
    const s = await page();
    assert.ok(s.logs.join("\n").includes(FLAGS().console));
  });

  test("Konami code awards a flag and shows a toast with progress", async () => {
    const s = await page();
    for (const k of ["ArrowUp", "ArrowUp", "ArrowDown", "ArrowDown", "ArrowLeft", "ArrowRight", "ArrowLeft", "ArrowRight", "b", "a"]) key(s, k);
    assert.deepEqual(found(s), ["konami"]);
    assert.match(toast(s), /flag found/);
    assert.ok(toast(s).includes(FLAGS().konami));
    assert.match(toast(s), /1\/6 flags/);
  });

  test("a wrong key in the middle resets the code", async () => {
    const s = await page();
    for (const k of ["ArrowUp", "ArrowUp", "ArrowDown", "x", "ArrowDown", "ArrowLeft", "ArrowRight", "ArrowLeft", "ArrowRight", "b", "a"]) key(s, k);
    assert.deepEqual(found(s), []);
  });

  test("typing the code into the search box doesn't count", async () => {
    const s = await page();
    s.window.PaletteAPI.open();
    const input = s.document.getElementById("palette-input");
    for (const k of ["ArrowUp", "ArrowUp", "ArrowDown", "ArrowDown", "ArrowLeft", "ArrowRight", "ArrowLeft", "ArrowRight", "b", "a"])
      input.dispatchEvent(new s.window.KeyboardEvent("keydown", { key: k, bubbles: true }));
    assert.deepEqual(found(s), []);
  });

  test("clicking the avatar 7 times quickly awards a flag; 6 doesn't", async () => {
    const s = await page();
    const img = s.document.querySelector(".hero-avatar-img");
    for (let i = 0; i < 6; i++) img.click();
    assert.deepEqual(found(s), []);
    img.click();
    assert.deepEqual(found(s), ["avatar"]);
  });

  test("search-box commands answer, and the sandwich one awards a flag", async () => {
    const s = await page();
    const hit = providerHits(s, "whoami");
    assert.equal(hit.length, 1);
    assert.match(hit[0].snippet, /curious human/);
    s.window.PaletteAPI.open();
    const input = s.document.getElementById("palette-input");
    input.value = "sudo make me a sandwich";
    input.dispatchEvent(new s.window.Event("input"));
    input.dispatchEvent(new s.window.KeyboardEvent("keydown", { key: "Enter", bubbles: true }));
    assert.deepEqual(found(s), ["command"]);
  });

  test("commands match loosely on case and spacing", async () => {
    const s = await page();
    assert.equal(providerHits(s, "  SUDO   Make me a SANDWICH ").length, 1);
  });

  test("pasting any flag into the search box claims it; a fake one is rejected", async () => {
    const s = await page();
    const submit = (text) => {
      s.window.PaletteAPI.open();
      const input = s.document.getElementById("palette-input");
      input.value = text;
      input.dispatchEvent(new s.window.Event("input"));
      input.dispatchEvent(new s.window.KeyboardEvent("keydown", { key: "Enter", bubbles: true }));
    };
    submit(FLAGS().source);
    assert.deepEqual(found(s), ["source"]);
    submit(FLAGS().source);
    assert.match(toast(s), /already have/);
    submit("pluh{totally_made_up}");
    assert.match(toast(s), /not a flag I know/);
    assert.deepEqual(found(s), ["source"]);
  });

  test("'flags' shows progress; unfound flags show a hint, found ones show the flag", async () => {
    const s = await page({ storage: { "pie-flags": '["konami"]' } });
    const hits = providerHits(s, "flags");
    assert.match(hits[0].title, /1\/6 flags found/);
    const konami = hits.find((h) => h.title.includes("konami"));
    assert.ok(konami.snippet.includes(FLAGS().konami));
    const avatar = hits.find((h) => h.title.includes("avatar"));
    assert.match(avatar.snippet, /^hint: poke/);
    assert.ok(!avatar.snippet.includes(FLAGS().avatar), "hints never leak the flag");
  });

  test("progress is remembered between visits", async () => {
    const s = await page({ storage: { "pie-flags": '["avatar","konami"]' } });
    assert.deepEqual(found(s), ["avatar", "konami"]);
  });

  test("a flag shown on the loading screen is awarded", async () => {
    const s = await page();
    s.document.getElementById("loaderlabel").textContent = FLAGS().loader;
    await sleep(50);
    assert.ok(found(s).includes("loader"));
  });

  test("the hidden source flag really is in index.html (base64) and matches config.js", () => {
    const b64 = [...read("index.html").matchAll(/<!--\s*([A-Za-z0-9+/=]{16,})\s*-->/g)].map((m) => Buffer.from(m[1], "base64").toString());
    assert.ok(b64.includes(FLAGS().source), "config.js and index.html disagree about the source flag");
  });

  test("can be switched off completely", async () => {
    const s = await page({ config: "CONFIG.easterEggs.enabled=false;" });
    assert.equal(s.window.__flagHunt, undefined);
    assert.ok(!s.logs.join("").includes("flag #1"));
  });
});
