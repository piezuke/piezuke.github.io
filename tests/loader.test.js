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
