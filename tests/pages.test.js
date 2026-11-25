const { test, describe } = require("node:test");
const assert = require("node:assert/strict");
const { load, sleep, FIXTURE_DATA } = require("./helpers/harness");

const ROUTES = ["#/", "#/writeups", "#/projects", "#/notes", "#/notes/kernel-rop", "#/timeline", "#/me", "#/writeups/heap-overflow", "#/projects/tiny-os", "#/nope-404"];

describe("every page renders cleanly", () => {
  for (const hash of ROUTES) {
    test(hash, async () => {
      const s = load({ hash, data: FIXTURE_DATA });
      await sleep(400);
      const app = s.document.getElementById("app").innerHTML;
      assert.ok(app.length > 80, "page has content");
      assert.ok(!/Render Error/.test(app), "no render error shown");
      assert.deepEqual(s.errors(), []);
      const ids = [...s.document.querySelectorAll("[id]")].map((e) => e.id);
      assert.deepEqual([...new Set(ids.filter((v, i) => ids.indexOf(v) !== i))], [], "no duplicate ids");
      s.close();
    });
  }

  test("legacy #/story and #/about still reach their pages", async () => {
    for (const [hash, needle] of [["#/story", "chronological"], ["#/about", "From the author"]]) {
      const s = load({ hash, data: FIXTURE_DATA });
      await sleep(300);
      assert.match(s.document.getElementById("app").textContent.toLowerCase(), new RegExp(needle.toLowerCase()), hash);
      s.close();
    }
  });
});

describe("a nearly empty config never crashes a page", () => {
  for (const hash of ["#/", "#/writeups", "#/writeups/heap-overflow", "#/notes", "#/timeline", "#/me", "#/nope"]) {
    test(hash, async () => {
      const s = load({ hash, data: FIXTURE_DATA, config: "CONFIG = {};" });
      await sleep(300);
      assert.ok(!/Render Error/.test(s.document.getElementById("app").innerHTML));
      assert.deepEqual(s.errors(), []);
      s.close();
    });
  }
});

describe("home page", () => {
  test("shows hero, explore cards and latest items from the config and data", async () => {
    const s = load({ data: FIXTURE_DATA });
    await sleep(300);
    assert.ok(s.document.querySelector(".hero-avatar-img"));
    assert.ok(s.document.querySelectorAll(".explore").length >= 1);
    assert.ok(s.document.querySelector('a.card[href="/writeups/heap-overflow"]'), "latest writeup card links to the post");
    s.close();
  });
});
