const { test, describe } = require("node:test");
const assert = require("node:assert/strict");
const { load, sleep, FIXTURE_DATA } = require("./helpers/harness");

const fast = (extra = "") => `CONFIG.ui.loader.minDuration=600; CONFIG.ui.loader.pageChangeDuration=500; ${extra}`;
const isHidden = (s) => s.document.getElementById("loader").classList.contains("hide");
const clickLink = (s, href) => s.document.querySelector(`a[href="${href}"]`).click();

describe("loading screen", () => {
  test("first load stays up for ui.loader.minDuration", async () => {
    const s = load({ data: FIXTURE_DATA, config: fast() });
    await sleep(300);
    assert.equal(isHidden(s), false, "still up at 300ms (min 600)");
    await sleep(500);
    assert.equal(isHidden(s), true, "gone by 800ms");
  });

  test("page changes use pageChangeDuration, not the first-load time", async () => {
    const s = load({ data: FIXTURE_DATA, config: fast() });
    await sleep(900);
    clickLink(s, "#/writeups");
    await sleep(150);
    assert.equal(isHidden(s), false, "loader shown right after a click");
    await sleep(250);
    assert.ok(s.text("#app").includes("Latest Writeups") || s.document.querySelector("#cardgrid"), "new page swapped in behind the loader");
    await sleep(350);
    assert.equal(isHidden(s), true, "gone ~500ms after the click");
  });

  test("minDuration 0 = as short as possible", async () => {
    const s = load({ data: FIXTURE_DATA, config: "CONFIG.ui.loader.minDuration=0;" });
    await sleep(200);
    assert.equal(isHidden(s), true);
  });

  test("Back / Forward (a hash change nobody clicked) skips the loader", async () => {
    const s = load({ data: FIXTURE_DATA, config: fast() });
    await sleep(900);
    s.window.location.hash = "#/timeline";
    await sleep(120);
    assert.equal(isHidden(s), true, "loader never appeared");
    assert.ok(s.text("#app").toLowerCase().includes("journey"), "page swapped instantly");
  });

  test("skipOnBackForward: false keeps the loader for Back / Forward too", async () => {
    const s = load({ data: FIXTURE_DATA, config: fast("CONFIG.ui.loader.skipOnBackForward=false;") });
    await sleep(900);
    s.window.location.hash = "#/timeline";
    await sleep(120);
    assert.equal(isHidden(s), false);
  });

  test("a search-palette jump counts as a click (shows the loader)", async () => {
    const s = load({ data: FIXTURE_DATA, config: fast() });
    await sleep(900);
    s.window.PaletteAPI.open();
    s.document.getElementById("palette-input").value = "heap";
    s.document.getElementById("palette-input").dispatchEvent(new s.window.Event("input"));
    s.document.getElementById("palette-input").dispatchEvent(new s.window.KeyboardEvent("keydown", { key: "Enter", bubbles: true }));
    await sleep(150);
    assert.equal(isHidden(s), false);
    assert.equal(s.window.location.hash, "#/writeups/heap-overflow");
  });

  test("two quick navigations never leave it stuck, and the last one wins", async () => {
    const s = load({ data: FIXTURE_DATA, config: fast() });
    await sleep(900);
    clickLink(s, "#/projects");
    await sleep(150);
    clickLink(s, "#/timeline");
    await sleep(1100);
    assert.equal(isHidden(s), true);
    assert.ok(s.text("#app").toLowerCase().includes("journey"));
  });

  test("screen-reader state follows the loader", async () => {
    const s = load({ data: FIXTURE_DATA, config: fast() });
    const l = s.document.getElementById("loader");
    await sleep(100);
    assert.equal(l.getAttribute("aria-hidden"), null, "announced while visible");
    assert.equal(s.document.getElementById("app").getAttribute("aria-busy"), "true");
    await sleep(800);
    assert.equal(l.getAttribute("aria-hidden"), "true", "hidden from AT afterwards");
    assert.equal(s.document.getElementById("app").getAttribute("aria-busy"), null);
  });
});

describe("loading screen: waits for the page, and says so when it is slow", () => {
  const slowImages = (ms) => `HTMLImageElement.prototype.decode = function () { return new Promise((r) => setTimeout(r, ${ms})); };`;
  const stuckImages = "HTMLImageElement.prototype.decode = function () { return new Promise(() => {}); };";

  test("a page change keeps the loader up until the new page's pictures are ready", async () => {
    const s = load({
      data: FIXTURE_DATA,
      config: `CONFIG.ui.loader.minDuration=0; CONFIG.ui.loader.pageChangeDuration=300; ${slowImages(900)}`,
    });
    await sleep(1400); // first load done
    assert.equal(isHidden(s), true);
    clickLink(s, "#/writeups");
    await sleep(700); // swapped at ~300ms, pictures need until ~1200ms
    assert.equal(isHidden(s), false, "still waiting for pictures");
    await sleep(1100);
    assert.equal(isHidden(s), true, "gone once they are ready");
  });

  test("ui.loader.maxDuration releases the loader even if a picture never loads", async () => {
    const s = load({
      data: FIXTURE_DATA,
      config: `CONFIG.ui.loader.minDuration=0; CONFIG.ui.loader.pageChangeDuration=200; CONFIG.ui.loader.maxDuration=600; ${stuckImages}`,
    });
    await sleep(1000);
    assert.equal(isHidden(s), true, "first load is released by the cap");
    clickLink(s, "#/writeups");
    await sleep(500);
    assert.equal(isHidden(s), false, "waiting");
    await sleep(900);
    assert.equal(isHidden(s), true, "released by the cap");
  });

  test("waitForImages: false only uses the minimum time", async () => {
    const s = load({
      data: FIXTURE_DATA,
      config: `CONFIG.ui.loader.minDuration=0; CONFIG.ui.loader.pageChangeDuration=300; CONFIG.ui.loader.waitForImages=false; ${stuckImages}`,
    });
    await sleep(500);
    clickLink(s, "#/writeups");
    await sleep(700);
    assert.equal(isHidden(s), true);
  });

  test("after ui.loader.slowAfter the loading text changes to ui.loader.slow", async () => {
    const s = load({
      data: FIXTURE_DATA,
      config: 'CONFIG.ui.loader.minDuration=1500; CONFIG.ui.loader.slowAfter=250; CONFIG.ui.loader.slow="still going";',
    });
    await sleep(120);
    assert.notEqual(s.document.getElementById("loaderlabel").textContent.trim(), "still going", "not yet");
    await sleep(350);
    assert.equal(isHidden(s), false);
    assert.equal(s.document.getElementById("loaderlabel").textContent.trim(), "still going");
  });
});

describe("switching tabs starts the new page at the top", () => {
  test("the scroll reset is an instant jump (a smooth glide gets undone by the scroll triggers)", async () => {
    const s = load({
      data: FIXTURE_DATA,
      config: "CONFIG.ui.loader.minDuration=0; CONFIG.ui.loader.pageChangeDuration=0; window.__scrolls = []; window.scrollTo = function (o) { window.__scrolls.push(o); };",
    });
    await sleep(300);
    s.window.__scrolls.length = 0;
    clickLink(s, "#/writeups");
    await sleep(200);
    const tops = s.window.__scrolls.filter((o) => o && typeof o === "object" && o.top === 0);
    assert.ok(tops.length >= 1, "scrolled to the top after the page change");
    assert.ok(tops.every((o) => o.behavior === "instant"), "and did so instantly, not smoothly");
    assert.equal(s.document.documentElement.style.scrollBehavior, "", "the page's own smooth-scroll setting is put back afterwards");
  });
});
