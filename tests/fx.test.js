const { test, describe } = require("node:test");
const assert = require("node:assert/strict");
const { load, sleep, FIXTURE_DATA, scriptsOf, read } = require("./helpers/harness");

describe("motion layer (js/fx.js)", () => {
  test("loads after the libraries it uses, and only self-hosted ones", () => {
    const order = scriptsOf(read("index.html"));
    const idx = (n) => order.findIndex((s) => s.endsWith(n));
    for (const lib of ["gsap.min.js", "ScrollTrigger.min.js", "SplitText.min.js"]) {
      assert.ok(idx(lib) >= 0, lib + " is loaded");
      assert.ok(idx(lib) < idx("js/fx.js"), lib + " comes before fx.js");
      assert.ok(order[idx(lib)].startsWith("js/"), lib + " is served from this site (CSP: script-src 'self')");
    }
  });

  test("without GSAP the site still renders normally (no hidden content, no errors)", async () => {
    const s = load({ data: FIXTURE_DATA, config: "CONFIG.ui.loader.minDuration=0;" });
    await sleep(300);
    assert.equal(typeof s.window.FX.run, "function");
    assert.doesNotThrow(() => s.window.FX.run("/"));
    const hidden = [...s.document.querySelectorAll(".card, .explore, .hero-text > *")].filter((e) => e.style.opacity === "0");
    assert.equal(hidden.length, 0, "nothing was left invisible by the motion layer");
    assert.deepEqual(s.errors(), []);
  });

  test("the hero carries a canvas for the dot-field and it is hidden from screen readers", async () => {
    const s = load({ data: FIXTURE_DATA, config: "CONFIG.ui.loader.minDuration=0;" });
    await sleep(200);
    const cv = s.document.querySelector("#bgcanvas");
    assert.ok(cv, "hero canvas exists");
    assert.equal(cv.getAttribute("aria-hidden"), "true");
  });
});

describe("footer", () => {
  test("is built from config: call-to-action with the email contact and three link columns", async () => {
    const s = load({ data: FIXTURE_DATA, config: "CONFIG.ui.loader.minDuration=0;" });
    await sleep(300);
    const d = s.document;
    const cta = d.querySelector("#footer-cta");
    assert.match(cta.textContent, /Say hi\./);
    assert.match(cta.querySelector("a.btn").getAttribute("href"), /^mailto:/, "button opens the email contact");
    const cols = [...d.querySelectorAll(".footer-col")];
    assert.equal(cols.length, 3);
    const navCount = s.window.CONFIG.nav.links.length;
    assert.equal(cols[0].querySelectorAll("a").length, navCount, "one link per nav entry");
    assert.ok(cols[1].querySelectorAll("a").length >= 1, "latest writeups are listed");
    assert.ok(cols[2].querySelector("[data-copy]"), "copy-to-clipboard contacts work in the footer too");
    assert.equal(d.querySelector("#footer-top"), null, "no back-to-top button in the footer (the floating one is enough)");
    assert.equal(d.querySelector("#footer-mark"), null, "no giant wordmark");
    assert.deepEqual(s.errors(), []);
  });

  test("no email contact means no call-to-action button", async () => {
    const s = load({
      data: FIXTURE_DATA,
      config: 'CONFIG.ui.loader.minDuration=0; CONFIG.pages.about.contacts = CONFIG.pages.about.contacts.filter(c => c.icon !== "email");',
    });
    await sleep(300);
    assert.equal(s.document.querySelector("#footer-cta a.btn"), null);
  });
});
