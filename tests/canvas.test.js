const { test, describe } = require("node:test");
const assert = require("node:assert/strict");
const { load, sleep } = require("./helpers/harness");

let hasCanvas = true;
try { require("canvas"); } catch (e) { hasCanvas = false; }
const opts = { skip: hasCanvas ? false : "the optional `canvas` package isn't installed" };

function page(extra = {}) {
  const s = load(Object.assign({ only: ["config.js", "canvas.js"], viewport: { w: 1000, h: 600 } }, extra));
  const w = s.window;
  let hidden = false;
  Object.defineProperty(w.document, "hidden", { get: () => hidden, configurable: true });
  const cv = w.document.getElementById("bgcanvas");
  const ctx = cv.getContext("2d");
  const frames = { n: 0 };
  const clear = ctx.clearRect.bind(ctx);
  ctx.clearRect = (...a) => { frames.n++; return clear(...a); };
  const fills = [];
  const fill = ctx.fillRect.bind(ctx);
  ctx.fillRect = (x, y, wd, h) => { fills.push([x, y, wd, h]); return fill(x, y, wd, h); };
  return { s, w, cv, ctx, frames, fills, setHidden: (v) => { hidden = v; w.document.dispatchEvent(new w.Event("visibilitychange")); }, setHeight: (h) => { w.__vp.h = h; w.dispatchEvent(new w.Event("resize")); } };
}

describe("background canvas", opts, () => {
  test("animates, stops while the tab is hidden, and resumes as ONE loop", async () => {
    const p = page();
    await sleep(500);
    p.frames.n = 0;
    await sleep(1000);
    const base = p.frames.n;
    assert.ok(base > 30, "animating at ~60fps, got " + base);
    p.setHidden(true);
    await sleep(300);
    p.frames.n = 0;
    await sleep(500);
    assert.equal(p.frames.n, 0, "no frames while hidden");
    p.setHidden(false);
    await sleep(300);
    p.frames.n = 0;
    await sleep(1000);
    assert.ok(p.frames.n / base > 0.8 && p.frames.n / base < 1.25, `same speed after returning (ratio ${(p.frames.n / base).toFixed(2)}), not doubled`);
  });

  test("a height-only resize (phone address bar) keeps the clouds; a width change rebuilds", async () => {
    const p = page();
    await sleep(400);
    const w0 = p.cv.width;
    p.setHeight(520);
    await sleep(400);
    assert.equal(p.cv.width, w0);
    assert.equal(p.cv.height, 520 * (w0 / 1000));
    p.w.__vp.w = 800;
    p.w.dispatchEvent(new p.w.Event("resize"));
    await sleep(400);
    assert.notEqual(p.cv.width, w0);
  });

  test("rain splashes land at the bottom of the screen", async () => {
    const p = page();
    await sleep(3500);
    const splashes = p.fills.filter((f) => f[2] <= 3 && f[3] <= 3);
    assert.ok(splashes.length > 0, "splash particles were drawn");
    assert.ok(Math.max(...splashes.map((f) => f[1])) <= 600 + 4);
    assert.ok(Math.max(...splashes.map((f) => f[1])) > 560, "near the floor");
  });

  test("with the footer on screen, rain lands on top of the footer instead (it used to hide behind it)", async () => {
    const p = page();
    const footer = p.w.document.querySelector(".global-footer");
    footer.getClientRects = () => [1];
    footer.getBoundingClientRect = () => ({ top: 430 });
    p.w.dispatchEvent(new p.w.Event("scroll"));
    await sleep(3500);
    const splashes = p.fills.filter((f) => f[2] <= 3 && f[3] <= 3);
    assert.ok(splashes.length > 0, "splashes still happen");
    assert.ok(Math.max(...splashes.map((f) => f[1])) <= 430 + 4, "none below the footer's top edge");
  });

  test("the click ripple reuses a few elements however fast you click", async () => {
    const p = page();
    await sleep(200);
    for (let i = 0; i < 40; i++) p.w.document.dispatchEvent(new p.w.MouseEvent("mousedown", { button: 0, clientX: 5 + i, clientY: 9, bubbles: true }));
    assert.equal(p.w.document.querySelectorAll(".ripple").length, 4);
  });

  test("storm button turns the rain off and back on, and remembers it", async () => {
    const p = page();
    await sleep(200);
    const btn = p.w.document.getElementById("raintoggle");
    btn.click();
    assert.equal(p.w.localStorage.getItem("rain"), "off");
    btn.click();
    assert.equal(p.w.localStorage.getItem("rain"), "on");
  });
});
