const { test, describe } = require("node:test");
const assert = require("node:assert/strict");
const { loadManage } = require("./helpers/harness");
const M = loadManage();

describe("frontmatter", () => {
  test("survives a round trip for awkward text (quotes, backslashes, colons, newlines, HTML)", () => {
    for (const t of ['He said "hi" & left', 'C:\\path\\to "file"', "line1\nline2", "it's: a title", "plain", "trailing backslash \\", "<img src=x onerror=alert(1)>"]) {
      assert.equal(M.parseFrontmatter(M.serializeFrontmatter({ title: t, tag: "x" }, "body")).meta.title, t, JSON.stringify(t));
    }
  });
  test("lists, extra fields and the body come through", () => {
    const { meta, body } = M.parseFrontmatter(M.serializeFrontmatter({ title: "T", pills: ["a", "b"], ctf: "X", points: "5" }, "hello\n\nworld"));
    assert.deepEqual([...meta.pills], ["a", "b"]);
    assert.equal(meta.ctf, "X");
    assert.equal(body.trim(), "hello\n\nworld");
  });
});

describe("dates", () => {
  const cases = { "2025-06": "2025-06-01", "2025 June": "2025-06-01", "June 2025": "2025-06-01", "2025-06-14": "2025-06-14", "2025-6-4": "2025-06-04", "2025": "2025-01-01", "Nov 2024": "2024-11-01", "garbage": null, "": null };
  for (const [input, want] of Object.entries(cases)) test(JSON.stringify(input), () => assert.equal(M.toISODate(input), want));

  test("posts sort newest first even when months are written as words", () => {
    const sorted = [{ date: "2025 June" }, { date: "2025 November" }, { date: "2024 December" }, { date: "2025-07" }].sort(M.compareEntriesNewestFirst).map((e) => e.date);
    assert.deepEqual(sorted, ["2025 November", "2025-07", "2025 June", "2024 December"]);
  });
});

describe("extra metadata", () => {
  test("keeps unknown frontmatter fields, drops reserved/invalid/empty ones, trims length", () => {
    const out = M.extraMetaFrom({ title: "x", tag: "y", ctf: "PicoCTF", points: 500, "bad key!": "x", empty: "  ", long: "z".repeat(500), pills: ["a"], image: "pic.png", thumbnail: "thumb.png" });
    assert.deepEqual(Object.keys(out).sort(), ["ctf", "long", "points"]);
    assert.equal(out.points, "500");
    assert.equal(out.long.length, 200);
  });
  test("the editor's 'key: value' lines are parsed", () => {
    assert.deepEqual({ ...M.parseExtraText("ctf: PicoCTF 2026\ncategory: pwn\nnonsense\npoints: 500") }, { ctf: "PicoCTF 2026", category: "pwn", points: "500" });
  });
});

describe("markdown for the static pages", () => {
  test("escapes raw HTML and drops unsafe links and images", () => {
    const html = M.renderMarkdownSafe('<script>alert(1)</script>\n\n[x](javascript:alert(1)) ![i](data:text/html,x) [ok](https://a.b/c)\n\n<img src=x onerror=alert(1)>');
    assert.ok(!/<script|<img src=x|javascript:|data:text/.test(html), html);
    assert.match(html, /href="https:\/\/a\.b\/c"/);
  });
});
