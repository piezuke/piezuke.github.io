const { test, describe } = require("node:test");
const assert = require("node:assert/strict");
const { load, sleep, FIXTURE_DATA } = require("./helpers/harness");

const theme = (s) => s.document.documentElement.getAttribute("data-theme");

describe("light / dark switch", () => {
  test("clicking flips the theme, saves it, and updates the switch and browser bar colour", async () => {
    const s = load({ data: FIXTURE_DATA, storage: { theme: "dark" } });
    await sleep(250);
    assert.equal(theme(s), "dark");
    const btn = s.document.getElementById("themebtn");
    assert.equal(btn.getAttribute("aria-checked"), "true");
    btn.click();
    assert.equal(theme(s), "light");
    assert.equal(s.window.localStorage.getItem("theme"), "light");
    assert.equal(btn.getAttribute("aria-checked"), "false");
    assert.equal(s.document.querySelector('meta[name="theme-color"]').getAttribute("content"), "#f6f6f6");
    btn.click();
    assert.equal(theme(s), "dark");
    assert.equal(s.document.querySelector('meta[name="theme-color"]').getAttribute("content"), "#050505");
  });

  test("with no saved choice it follows the operating system", async () => {
    const light = load({ data: FIXTURE_DATA, media: { "prefers-color-scheme: dark": false } });
    await sleep(200);
    assert.equal(theme(light), "light");
    const dark = load({ data: FIXTURE_DATA, media: { "prefers-color-scheme: dark": true } });
    await sleep(200);
    assert.equal(theme(dark), "dark");
  });

  test("a saved choice beats the operating system", async () => {
    const s = load({ data: FIXTURE_DATA, storage: { theme: "light" }, media: { "prefers-color-scheme: dark": true } });
    await sleep(200);
    assert.equal(theme(s), "light");
  });

  test("another tab changing the theme is picked up", async () => {
    const s = load({ data: FIXTURE_DATA, storage: { theme: "dark" } });
    await sleep(200);
    s.window.dispatchEvent(Object.assign(new s.window.Event("storage"), { key: "theme", newValue: "light" }));
    assert.equal(theme(s), "light");
  });

  test("the canvas is told about theme changes", async () => {
    const s = load({ data: FIXTURE_DATA, storage: { theme: "dark" } });
    await sleep(200);
    let heard = null;
    s.window.addEventListener("themechange", (e) => (heard = e.detail.theme));
    s.document.getElementById("themebtn").click();
    assert.equal(heard, "light");
  });
});
