const { test, describe } = require("node:test");
const assert = require("node:assert/strict");
const { load, sleep, FIXTURE_DATA, read } = require("./helpers/harness");

// a config that changes a lot, to prove nothing is hard-coded
const OVERRIDE = `
CONFIG.site.brand="ZED"; CONFIG.site.name="zedsite"; CONFIG.site.titleTemplate="[{site}] :: {page}"; CONFIG.site.language="fr";
CONFIG.site.description="custom description"; CONFIG.pages.home.title="ZED HOME";
CONFIG.routes.writeups="/ctf"; CONFIG.routes.projects="/builds"; CONFIG.routes.notes="/vault"; CONFIG.routes.timeline="/journey"; CONFIG.routes.about="/about";
CONFIG.routes.redirects={story:"timeline", me:"about"};
CONFIG.nav.links=[{label:"HOME!",page:"home"},{label:"WRITE",page:"writeups"},{label:"ABOUT!",page:"about"},{label:"Ext",route:"/custom"}];
CONFIG.footer.text="(c) {year} custom footer"; CONFIG.footer.quip="custom quip";
CONFIG.pages.home.hero.title="HELLO"; CONFIG.pages.home.hero.status="custom status";
CONFIG.pages.home.buttons=[{label:"GO CTF",page:"writeups",style:"solid"},{label:"EXT",url:"https://example.com",style:"ghost"}];
CONFIG.pages.home.explore.heading="LOOK AROUND"; CONFIG.pages.home.explore.cards=[{page:"projects",title:"VaultCard",text:"vault text",count:"{n} things",countOne:"{n} thing"}];
CONFIG.pages.home.latest.writeups.heading="NEWEST CTF"; CONFIG.pages.home.latest.projects.show=false;
CONFIG.pages.writeups.heading="CTF HEADING"; CONFIG.pages.writeups.title="CTFs"; CONFIG.pages.writeups.backLabel="<< BACK TO CTFS"; CONFIG.pages.writeups.entries="{n} items";
CONFIG.pages.post.readTime="{n} minutes"; CONFIG.pages.post.suggestedTitle="more stuff"; CONFIG.pages.post.author.name="AUTH";
CONFIG.pages.timeline.heading="MY JOURNEY"; CONFIG.pages.timeline.items=[{date:"D1",title:"T1",body:"B1"}];
CONFIG.pages.about.heading="ABOUT HEADING"; CONFIG.pages.about.bio="custom bio"; CONFIG.pages.about.skills=["only-skill"]; CONFIG.pages.about.socialsHeading="ELSEWHERE";
CONFIG.pages.about.contacts=[{label:"Site",url:"https://x.test/me",icon:"link",handle:"x.test"},{label:"Handle",copy:"abc",icon:"discord",handle:"abc",hint:"tap to copy"}];
CONFIG.pages.notFound.heading="LOST"; CONFIG.pages.notFound.text="custom 404 text"; CONFIG.pages.notFound.title="Lost page";
CONFIG.ui.search.placeholder="custom placeholder"; CONFIG.ui.search.buttonText="find stuff"; CONFIG.ui.search.tags.writeup="CTF"; CONFIG.ui.search.hintOpen="enter!";
CONFIG.music.heading="MY TUNES"; CONFIG.music.emptyText="none yet lol";
CONFIG.pages.notes.vaultTitle="MY VAULT"; CONFIG.ui.a11y.skipLink="JUMP IN";
`;
const T = (s, sel) => s.text(sel);

describe("config.js controls every piece of text and every URL slug", () => {
  test("home page + shell", async () => {
    const s = load({ data: FIXTURE_DATA, config: OVERRIDE });
    await sleep(350);
    const d = s.document;
    assert.equal(d.title, "ZED HOME");
    assert.equal(d.documentElement.lang, "fr");
    assert.equal(T(s, "#cfg-brand"), "ZED");
    assert.deepEqual([...d.querySelectorAll("nav.links a")].map((a) => a.textContent + "=" + a.getAttribute("href")), ["HOME!=#/", "WRITE=#/ctf", "ABOUT!=#/about", "Ext=#/custom"]);
    const app = T(s, "#app");
    assert.ok(app.includes("HELLO") && app.includes("custom status"));
    assert.deepEqual([...d.querySelectorAll(".cta a")].map((a) => a.getAttribute("href")), ["#/ctf", "https://example.com"]);
    assert.ok(app.includes("LOOK AROUND") && app.includes("VaultCard") && /1 thing\b/.test(app), "explore singular count");
    assert.ok(app.includes("NEWEST CTF") && !app.includes("Latest Projects"));
    assert.equal(d.querySelector("a.card").getAttribute("href"), "#/ctf/heap-overflow", "card link follows the new slug");
    assert.match(T(s, ".global-footer"), /custom footer/);
    assert.match(T(s, ".global-footer"), /\d{4}/, "{year} filled in");
    assert.ok(T(s, "#cmdk-btn").includes("find stuff"));
    assert.equal(d.getElementById("palette-input").placeholder, "custom placeholder");
    assert.equal(d.querySelector('meta[name="description"]').content, "custom description");
    assert.equal(T(s, ".skip-link"), "JUMP IN");
    s.close();
  });

  const pages = [
    ["#/ctf", (s) => { assert.equal(s.document.title, "[zedsite] :: CTFs"); assert.ok(T(s, "#app").includes("CTF HEADING") && T(s, "#app").includes("2 items")); }],
    ["#/ctf/heap-overflow", (s) => { assert.equal(s.document.title, "[zedsite] :: Heap Overflow 101"); const a = T(s, "#app"); assert.ok(a.includes("<< BACK TO CTFS") && a.includes("minutes") && a.includes("more stuff") && a.includes("AUTH")); }],
    ["#/vault", (s) => { assert.ok(T(s, "#app").includes("MY VAULT")); assert.ok(s.document.body.classList.contains("in-notes")); assert.ok(s.document.querySelector('a.notenode[href="#/vault/kernel-rop"]')); }],
    ["#/journey", (s) => { assert.ok(T(s, "#app").includes("MY JOURNEY") && T(s, "#app").includes("T1")); }],
    ["#/story", (s) => assert.ok(T(s, "#app").includes("MY JOURNEY"), "legacy slug redirects")],
    ["#/me", (s) => assert.ok(T(s, "#app").includes("ABOUT HEADING"), "legacy slug redirects")],
    ["#/about", (s) => { const a = T(s, "#app"); assert.ok(a.includes("custom bio") && a.includes("only-skill") && a.includes("ELSEWHERE") && a.includes("tap to copy") && a.includes("MY TUNES") && a.includes("none yet lol")); assert.equal(s.document.querySelectorAll(".social-tile").length, 2); }],
    ["#/zzz", (s) => { assert.ok(T(s, "#app").includes("LOST") && T(s, "#app").includes("custom 404 text")); assert.equal(s.document.title, "[zedsite] :: Lost page"); }],
  ];
  for (const [hash, check] of pages) {
    test(hash, async () => {
      const s = load({ hash, data: FIXTURE_DATA, config: OVERRIDE });
      await sleep(350);
      check(s);
      assert.deepEqual(s.errors(), []);
      s.close();
    });
  }
});

describe("config checker", () => {
  const checker = (cfgPatch) => {
    const s = load({ only: ["config.js", "configcheck.js"], config: cfgPatch || "" });
    const issues = JSON.parse(JSON.stringify(s.window.checkConfig())); // copy out of the jsdom realm
    s.close();
    return issues;
  };

  test("the shipped config.js has zero issues (keeps the checker's template in sync)", () => {
    assert.deepEqual(checker(), []);
  });

  test("catches unknown keys with a suggestion, wrong types and bad values", () => {
    const paths = checker(`
      CONFIG.ui.loader.minDuration = "fast";
      CONFIG.pages.home.hero.typo_key = 1;
      CONFIG.pages.home.hero.subtitel = "x";
      CONFIG.routes.about = "/me/x";
      CONFIG.nav.links[1].page = "projectz";
      CONFIG.cursor = "rnig";
      CONFIG.footer.text = "© {yeer}";
      CONFIG.site.url = "piezuke.github.io/";
      CONFIG.pages.about.contacts[0].icon = "gitub";
    `);
    const by = Object.fromEntries(paths.map((i) => [i.path, i.message]));
    assert.match(by["ui.loader.minDuration"], /number/);
    assert.match(by["pages.home.hero.typo_key"], /unknown/);
    assert.match(by["pages.home.hero.subtitel"], /did you mean "subtitle"/);
    assert.match(by["routes.about"], /should look like/);
    assert.match(by["nav.links[1].page"], /not a page/);
    assert.match(by["cursor"], /not a mode/);
    assert.match(by["footer.text"], /did you mean \{year\}/);
    assert.match(by["site.url"], /https:\/\//);
    assert.match(by["pages.about.contacts[0].icon"], /github/);
  });

  test("flags duplicate URL slugs and bad redirects", () => {
    const issues = checker(`CONFIG.routes.writeups = "/me"; CONFIG.routes.redirects = { story: "timelin" };`);
    assert.ok(issues.some((i) => /already used/.test(i.message)));
    assert.ok(issues.some((i) => /not a page/.test(i.message)));
  });

  test("accepts GitHub Pages user, project and custom-domain addresses; flags a trailing slash", () => {
    for (const ok of ["https://piezuke.github.io", "https://piezuke.github.io/my-repo", "https://piezuke.dev"])
      assert.deepEqual(checker(`CONFIG.site.url = "${ok}";`), [], ok);
    assert.ok(checker('CONFIG.site.url = "https://piezuke.github.io/";').some((i) => /trailing slash/.test(i.message)));
  });

});

describe("canonical address", () => {
  test("the home page declares it when site.url is set, and not otherwise", async () => {
    const on = load({ data: FIXTURE_DATA, config: 'CONFIG.site.url="https://example.org";' });
    await sleep(250);
    assert.equal(on.document.querySelector('link[rel="canonical"]').getAttribute("href"), "https://example.org/");
    assert.equal(on.document.querySelector('meta[property="og:url"]').getAttribute("content"), "https://example.org/");
    const off = load({ data: FIXTURE_DATA });
    await sleep(250);
    assert.equal(off.document.querySelector('link[rel="canonical"]'), null);
  });
});
