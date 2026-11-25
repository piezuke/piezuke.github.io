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
    s.document.querySelector('a[href="/timeline"]').click();
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

describe("accessibility: issues found by Lighthouse / axe", () => {
  const boot = async (hash = "#/") => {
    const s = load({ data: FIXTURE_DATA, hash, config: "CONFIG.ui.loader.minDuration=0;" });
    await sleep(400);
    return s;
  };
  const input = (s) => s.document.getElementById("palette-input");

  test("the search box is a combobox with the aria-expanded it requires, kept in step with the result list", async () => {
    const s = await boot();
    assert.equal(input(s).getAttribute("role"), "combobox");
    assert.equal(input(s).getAttribute("aria-expanded"), "false", "closed palette");
    s.window.PaletteAPI.open();
    assert.equal(input(s).getAttribute("aria-expanded"), "true", "open, list showing");
    input(s).value = "zzzzqqqq-no-match";
    input(s).dispatchEvent(new s.window.Event("input"));
    assert.equal(input(s).getAttribute("aria-expanded"), "false", "no results = collapsed");
    input(s).value = "tcache";
    input(s).dispatchEvent(new s.window.Event("input"));
    assert.equal(input(s).getAttribute("aria-expanded"), "true");
    s.window.PaletteAPI.close();
    assert.equal(input(s).getAttribute("aria-expanded"), "false", "closed again");
  });

  test("every element with an ARIA role has the attributes that role requires (the Lighthouse 'aria-required-attr' audit)", async () => {
    const REQUIRED = { combobox: ["aria-expanded"], checkbox: ["aria-checked"], switch: ["aria-checked"], radio: ["aria-checked"], slider: ["aria-valuenow"], scrollbar: ["aria-valuenow", "aria-controls"], heading: ["aria-level"], meter: ["aria-valuenow"] };
    for (const hash of ["#/", "#/writeups", "#/me", "#/notes", "#/timeline"]) {
      const s = await boot(hash);
      s.window.PaletteAPI.open();
      for (const el of s.document.querySelectorAll("[role]")) {
        const role = el.getAttribute("role");
        const need = [...(REQUIRED[role] || []), ...(role === "separator" && el.hasAttribute("tabindex") ? ["aria-valuenow"] : [])];
        for (const attr of need) assert.ok(el.hasAttribute(attr), `${hash}: <${el.tagName.toLowerCase()} role="${role}"> is missing ${attr}`);
      }
      s.close();
    }
  });

  test("the logo link's accessible name contains its visible text (WCAG 2.5.3 Label in Name)", async () => {
    const s = await boot();
    const logo = s.document.querySelector("a.brand");
    const name = logo.getAttribute("aria-label").toLowerCase();
    assert.ok(name.includes(logo.textContent.trim().toLowerCase()), `"${name}" must contain "${logo.textContent.trim()}"`);
    assert.match(name, /home/, "...and still says where it goes");
  });

  test("a copy-to-clipboard contact tile is named after everything written on it", async () => {
    const s = await boot("#/me");
    const tile = s.document.querySelector("button.social-tile[data-copy]");
    const name = tile.getAttribute("aria-label").toLowerCase();
    for (const part of [".social-label", ".social-handle", ".social-go"]) assert.ok(name.includes(tile.querySelector(part).textContent.trim().toLowerCase()), `name "${name}" includes ${part}`);
  });

  test("heading order: list pages and the timeline go h1 -> level 2 (no skipped level); home cards stay under their h2", async () => {
    const s = await boot("#/writeups");
    const cards = [...s.document.querySelectorAll(".card h3")];
    assert.ok(cards.length >= 2);
    for (const h of cards) assert.equal(h.getAttribute("aria-level"), "2", "card titles on a list page are exposed as level 2");
    s.close();
    const t = await boot("#/timeline");
    for (const h of t.document.querySelectorAll(".tlitem h3")) assert.equal(h.getAttribute("aria-level"), "2");
    t.close();
    const home = await boot("#/");
    assert.ok(home.document.querySelector(".sechead h2"), "home has an h2 above its cards");
    for (const h of home.document.querySelectorAll(".card h3")) assert.equal(h.getAttribute("aria-level"), null, "under an h2, a plain h3 is correct");
  });

  test("links that say the same thing go to different places only if they sound different (the two 'view all' links)", async () => {
    const s = await boot("#/");
    const links = [...s.document.querySelectorAll(".sechead a")];
    assert.ok(links.length >= 2);
    const names = links.map((a) => a.textContent.replace(/\s+/g, " ").trim());
    assert.equal(new Set(names).size, names.length, `link names must be unique: ${names.join(" | ")}`);
    for (const a of links) assert.match(a.textContent, /view all/, "the visible text is still part of the name");
  });

  test("the floating theme / weather buttons sit inside a labelled landmark (axe 'region')", async () => {
    const s = await boot();
    const box = s.document.querySelector(".bottom-left-controls");
    assert.equal(box.tagName, "ASIDE");
    assert.ok(box.getAttribute("aria-label").trim().length > 2);
    assert.ok(box.contains(s.document.getElementById("themebtn")));
  });

  test("the loading bar animates transform (runs on the GPU), not margin-left (forces layout every frame)", () => {
    const css = require("node:fs").readFileSync(require("node:path").join(__dirname, "..", "style.css"), "utf8");
    const frames = css.match(/@keyframes load \{[\s\S]*?\n\}/)[0];
    assert.match(frames, /transform:\s*translateX/);
    assert.ok(!/margin-left/.test(frames));
  });
});
