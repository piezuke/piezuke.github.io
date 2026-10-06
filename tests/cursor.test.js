const { test, describe } = require("node:test");
const assert = require("node:assert/strict");
const { load, sleep, FIXTURE_DATA } = require("./helpers/harness");

const FINE = { "hover: hover": true };

function cursorPage(opts = {}) {
  const s = load(Object.assign({ only: ["config.js", "cursor.js"], media: FINE }, opts));
  const d = s.document;
  d.body.insertAdjacentHTML("beforeend", '<a id="l" class="card" href="#/x">link</a><p id="p">text</p><input id="i"><div class="notetree-resizer" id="rz"></div>');
  d.elementFromPoint = () => d.getElementById("l");
  d.elementsFromPoint = () => [d.getElementById("l")];
  return s;
}
const fire = (s, target, type, o = {}) => {
  const e = new s.window.MouseEvent(type, Object.assign({ bubbles: true, cancelable: true, clientX: 50, clientY: 60, button: 0 }, o));
  e.pointerType = "mouse";
  target.dispatchEvent(e);
  return e;
};
const el = (s, id) => s.document.getElementById(id);
const ring = (s) => s.document.querySelector(".rc");

describe("ring cursor", () => {
  test("is a single element and hides the system cursor", () => {
    const s = cursorPage();
    assert.equal(s.document.querySelectorAll(".rc").length, 1);
    assert.ok(s.document.documentElement.classList.contains("rc-on"));
    assert.deepEqual(s.errors(), []);
  });

  test("swells over clickable things and squeezes on press", () => {
    const s = cursorPage();
    fire(s, el(s, "l"), "pointermove");
    assert.ok(ring(s).classList.contains("on") && ring(s).classList.contains("is-hover"));
    fire(s, el(s, "l"), "pointerdown");
    assert.ok(ring(s).classList.contains("is-down"));
    fire(s, el(s, "l"), "pointerup");
    assert.ok(!ring(s).classList.contains("is-down"));
    fire(s, el(s, "p"), "pointermove");
    assert.ok(!ring(s).classList.contains("is-hover"), "plain text isn't clickable");
  });

  test("a right-click or lost mouse-up can't leave it stuck pressed", () => {
    const s = cursorPage();
    fire(s, el(s, "l"), "pointerdown");
    s.window.dispatchEvent(new s.window.Event("contextmenu"));
    assert.ok(!ring(s).classList.contains("is-down"));
    fire(s, el(s, "l"), "pointerdown");
    s.window.dispatchEvent(new s.window.Event("blur"));
    assert.ok(!ring(s).classList.contains("is-down"));
  });

  test("lets the real cursor through over text fields and the sidebar resizer", () => {
    const s = cursorPage();
    fire(s, el(s, "i"), "pointermove");
    assert.ok(ring(s).classList.contains("is-native") && !ring(s).classList.contains("is-hover"));
    fire(s, el(s, "rz"), "pointermove");
    assert.ok(ring(s).classList.contains("is-native"));
    fire(s, el(s, "p"), "pointermove");
    assert.ok(!ring(s).classList.contains("is-native"));
  });

  test("pressing a link never starts a native drag or text selection; normal text stays selectable", () => {
    const s = cursorPage();
    assert.ok(fire(s, el(s, "l"), "mousedown").defaultPrevented, "link press cancelled");
    assert.ok(fire(s, el(s, "l"), "dragstart").defaultPrevented, "link drag cancelled");
    assert.ok(!fire(s, el(s, "p"), "mousedown").defaultPrevented, "text press untouched");
    assert.ok(!fire(s, el(s, "i"), "mousedown").defaultPrevented, "input press untouched");
    assert.ok(!fire(s, el(s, "i"), "dragstart").defaultPrevented, "input drag allowed");
  });

  test("rapid clicking adds and removes nothing in the page", () => {
    const s = cursorPage();
    const before = s.document.body.children.length;
    for (let i = 0; i < 60; i++) {
      fire(s, el(s, "l"), "pointerdown");
      fire(s, el(s, "l"), "pointerup");
    }
    assert.equal(s.document.body.children.length, before);
  });

  test("the ring trails the mouse and settles exactly on it, then swells to 1.75x on hover", async () => {
    const s = cursorPage();
    fire(s, el(s, "p"), "pointermove", { clientX: 300, clientY: 200 });
    await sleep(900);
    assert.match(ring(s).style.transform, /translate3d\(300px,\s*200px,\s*0\)/);
    fire(s, el(s, "l"), "pointermove", { clientX: 300, clientY: 200 });
    await sleep(900);
    assert.match(ring(s).style.transform, /scale\(1\.750\)/);
  });

  test("hides when the mouse leaves the window", () => {
    const s = cursorPage();
    fire(s, el(s, "p"), "pointermove");
    s.document.documentElement.dispatchEvent(new s.window.MouseEvent("mouseleave"));
    assert.ok(!ring(s).classList.contains("on"));
  });
});

describe("cursor modes", () => {
  test("native-ring: the OS cursor is the ring, nothing is hidden", () => {
    const s = cursorPage({ search: "?cursor=native-ring" });
    assert.equal(s.document.querySelector(".rc"), null);
    assert.ok(!s.document.documentElement.classList.contains("rc-on"));
    assert.ok(s.document.documentElement.classList.contains("rc-native"));
    const css = s.document.getElementById("rc-native-css").textContent;
    assert.ok((css.match(/data:image\/svg\+xml/g) || []).length >= 6, "normal/hover/press x dark/light");
    assert.match(css, /html\[data-theme="light"\]\.rc-native/);
    assert.ok(!/cursor:\s*none/.test(css), "never uses cursor:none");
  });

  test("native-ring can be chosen in config.js too", () => {
    const s = cursorPage({ config: "CONFIG.cursor='native-ring';" });
    assert.ok(s.document.getElementById("rc-native-css"));
  });

  test("off / touch / reduced-motion install nothing", () => {
    for (const s of [
      cursorPage({ search: "?cursor=off" }),
      cursorPage({ config: "CONFIG.cursor='off';" }),
      cursorPage({ media: { "hover: hover": false } }),
      cursorPage({ media: Object.assign({ "reduce": true }, FINE) }),
    ]) {
      assert.equal(s.document.querySelector(".rc"), null);
      assert.equal(s.document.getElementById("rc-native-css"), null);
    }
  });

  test("the old config value 'on' still means ring", () => {
    assert.ok(cursorPage({ config: "CONFIG.cursor='on';" }).document.querySelector(".rc"));
  });
});
