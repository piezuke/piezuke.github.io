const { test, describe } = require("node:test");
const assert = require("node:assert/strict");
const { load, sleep, FIXTURE_DATA } = require("./helpers/harness");

describe("accessibility", () => {
  test("skip link exists, is first in the page, and moves focus to the content", async () => {
    const s = load({ data: FIXTURE_DATA });
    await sleep(250);
    const link = s.document.querySelector("a.skip-link");
    assert.ok(link);
    assert.equal(link.textContent.trim(), "Skip to content");
    const firstFocusable = s.document.querySelector("a[href], button, input");
    assert.equal(firstFocusable, link, "first thing a keyboard user reaches");
    link.click();
    assert.equal(s.document.activeElement.id, "app");
    assert.equal(s.window.location.hash, "#/", "did not change the route");
  });

  test("page changes are announced to screen readers", async () => {
    const s = load({ data: FIXTURE_DATA, config: "CONFIG.ui.loader.pageChangeDuration=200;" });
    await sleep(2300);
    s.document.querySelector('a[href="#/timeline"]').click();
    await sleep(600);
    const note = s.text("#sr-announcer");
    assert.match(note, /^Navigated to /);
    assert.match(note, /Timeline/);
  });

  test("the active nav link has aria-current and the nav is labelled", async () => {
    const s = load({ hash: "#/writeups", data: FIXTURE_DATA });
    await sleep(250);
    const current = s.document.querySelectorAll('nav.links a[aria-current="page"]');
    assert.equal(current.length, 1);
    assert.match(current[0].getAttribute("href"), /writeups/);
    assert.equal(s.document.getElementById("navlinks").getAttribute("aria-label"), "Primary");
  });

  test("decorative and live regions are marked correctly", async () => {
    const s = load({ data: FIXTURE_DATA });
    await sleep(200);
    const d = s.document;
    assert.equal(d.getElementById("bgcanvas").getAttribute("aria-hidden"), "true");
    assert.equal(d.getElementById("sr-announcer").getAttribute("aria-live"), "polite");
    assert.equal(d.getElementById("loader").getAttribute("role"), "status");
    assert.equal(d.getElementById("loaderlabel").getAttribute("aria-hidden"), "true", "random flavour text isn't read out");
  });

  test("every image has alt text and every button a name", async () => {
    for (const hash of ["#/", "#/me", "#/writeups/heap-overflow"]) {
      const s = load({ hash, data: FIXTURE_DATA });
      await sleep(300);
      for (const img of s.document.querySelectorAll("img")) assert.ok(img.hasAttribute("alt"), `${hash}: <img ${img.getAttribute("src")}> needs alt`);
      for (const b of s.document.querySelectorAll("button")) {
        const name = (b.textContent || "").trim() || b.getAttribute("aria-label") || b.getAttribute("title");
        assert.ok(name, `${hash}: button#${b.id}.${b.className} has no accessible name`);
      }
      s.close();
    }
  });

  test("the search box announces itself as a combobox with a listbox of options", async () => {
    const s = load({ data: FIXTURE_DATA });
    await sleep(250);
    s.window.PaletteAPI.open();
    const input = s.document.getElementById("palette-input");
    assert.equal(input.getAttribute("role"), "combobox");
    assert.equal(s.document.getElementById("palette-results").getAttribute("role"), "listbox");
    assert.ok(s.document.querySelector('#palette-results [role="option"][aria-selected="true"]'));
  });
});
