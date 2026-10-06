# piezuke_ — CTF writeups, projects, notes & timeline

A single-page, black-and-white blog with pixel-block clouds, rain, a light/dark switch and a ring cursor. There is **no build step and no framework** — the site is plain HTML, CSS and JavaScript. `manage.js` is an optional Node.js tool that turns Markdown files into site content (and generates the SEO files).

- **Every piece of text lives in `config.js`**, one block per page ([details](#customising-the-site-configjs)).
- Writeups, projects and notes are Markdown files in `content/`, compiled into `data.js` by `manage.js`.
- Built for **GitHub Pages**: static files only, relative asset links (works under `user.github.io/repo/`), and an included Actions workflow that tests, builds and deploys on every push.
- ~170 automated tests (`npm test`) cover the pages, config, cursor, rain, search, SEO output and more.

---

## Quick start

```bash
# preview locally (any static server works)
python3 -m http.server 8000        # then open http://localhost:8000

# write something, then rebuild data.js (+ SEO files)
node manage.js add writeup
node manage.js sync
```

### Before you publish: set `site.url`

In `config.js`, set your site's public address — **no trailing slash, and include the repo name for a GitHub Pages project site**:

| Kind of GitHub Pages site                  | `site.url`                              |
| ------------------------------------------ | --------------------------------------- |
| User / org site (repo `<you>.github.io`)   | `https://piezuke.github.io`             |
| Project site (any other repo name)         | `https://piezuke.github.io/my-repo`     |
| Custom domain                              | `https://piezuke.dev`                   |

Then run `node manage.js sync`. Without it the SEO features below stay off (the site itself works fine). The config checker warns if the address looks wrong.

---

## Search engines & link previews (SEO)

The site is a hash-routed single page app, which Google and Discord/Twitter link previews can't see into (`/#/writeups/my-post` all look like the home page). So when `site.url` is set, `node manage.js sync` also generates:

| File                              | What it is                                                                 |
| --------------------------------- | -------------------------------------------------------------------------- |
| `writeups-<slug>.html`, `projects-<slug>.html` | One static page per post: its own `<title>`, description, canonical URL, share image, `og:`/Twitter tags, JSON-LD (`BlogPosting`) and the article text for crawlers. Opening one lands straight on that post inside the normal app. |
| `sitemap.xml`                     | Home + every post, with dates.                                             |
| `feed.xml`                        | RSS 2.0 feed (newest 50). Auto-discoverable via a `<link>` in `index.html`. |
| `robots.txt`                      | Gets exactly one `Sitemap:` line.                                          |
| `.seo-manifest.json`              | Remembers which pages were generated so deleted posts get cleaned up.      |

- Share a post with the **copy link** button on the post (it copies the post's own page, so previews work). Section `#` links work the same way.
- File names follow `routes` in `config.js` (rename `writeups` → `ctf` and the pages become `ctf-<slug>.html`).
- Drafts (`draft: true`) are never included. Notes don't get their own pages (they're many and personal) — only writeups and projects.
- Turn the feed off with `site.feed.enabled: false`. `node manage.js seo` regenerates just these files.
- Commit the generated files (or let the GitHub Actions workflow build them — see [Deploying](#deploying)).
- To verify: paste a post's page URL into a link-preview checker, or view source and check the `<title>` and `og:` tags.

**On GitHub Pages specifically**
- **Project sites** (`user.github.io/my-repo`): crawlers only read `robots.txt` at the *domain root*, so the `Sitemap:` line in your repo's `robots.txt` is ignored. Submit `https://user.github.io/my-repo/sitemap.xml` directly in Google Search Console (your `google-site-verification` tag in `index.html` is already there). User sites and custom domains are served from the root, so `robots.txt` works as normal.
- GitHub Pages also serves `writeups-foo.html` at `/writeups-foo`; the canonical tag points at the `.html` address so search engines don't treat them as duplicates.
- Link previews are cached by Discord/Twitter/Slack; if a preview looks stale after you edit a post, re-scrape it with their debugger tool.

---

## Writing posts

Writeups and projects are Markdown files with a small frontmatter header:

```markdown
---
title: Heap Overflow 101
tag: pwn · heap          # shown on cards, used by the #tag search filter
date: 2025 November      # "2025-11", "June 2025", "2025-11-14" all work
excerpt: One-line summary used on cards, search and link previews.
pills: [Pwn, Heap]
image: media/my-cover.png   # optional share image for this post
draft: true                 # optional: keep it off the site until you remove this
# anything else becomes a detail chip in the post header:
ctf: PicoCTF 2026
category: pwn
points: 500
difficulty: hard
---

## Summary
...
```

- **CTF details** (`ctf`, `category`, `points`, `difficulty`, `solves`, or any other key) appear as chips under the title. Rename their labels in `config.js` → `pages.post.meta.labels`.
- **Code blocks** are syntax highlighted when you give a language: ` ```c `, ` ```python `, ` ```asm `, ` ```bash `, … Supported: C, C++, Java, Python, JavaScript/TypeScript, shell, x86/ARM assembly, Rust, Go, JSON, diff, SQL, HTML/XML, CSS, YAML (plus aliases like `py`, `sh`, `nasm`, `rs`). Each block shows its language and a copy button. Switch off with `ui.code.highlight`.
- **Flags are blurred** until the reader clicks them, so they can try the challenge first. Anything like `flag{...}`, `bi0s{...}` or `word{long-text}` in a post is covered; tune it in `pages.post.flags`. This is a spoiler guard, not secrecy: the text is still in the page source and `data.js` (and in the pre-rendered per-post pages), so never put a flag for a challenge that is still live in a post.
- **Section links:** hover an `h2`/`h3` and click `#` to copy a link that opens the post scrolled to that section.
- `[[Note Title]]` wiki-links work in notes.

### `manage.js`

| Command                       | What it does                                                            |
| ----------------------------- | ----------------------------------------------------------------------- |
| `node manage.js`              | Interactive menu                                                        |
| `node manage.js sync`         | Scan `content/`, regenerate `data.js` **and** the SEO files             |
| `node manage.js seo`          | Regenerate only the per-post pages, sitemap and feed                    |
| `node manage.js watch`        | Re-sync whenever a file in `content/` changes                           |
| `node manage.js export`       | Write the current `data.js` back out as Markdown files in `content/`    |
| `node manage.js list`         | Print a tree of all content                                             |
| `node manage.js ui`           | Browser editor at `http://127.0.0.1:8088` (has fields for extra details and draft) |
| `node manage.js add writeup`  | e.g. `--title "..." --tag "pwn · heap" --ctf PicoCTF --category pwn --points 500 --difficulty hard` (also `--meta "k=v,k=v"`, `--image`, `--draft`) |
| `node manage.js add project`  | e.g. `--title "mytool" --tag "rust · tui" --pills "Rust,TUI"`           |
| `node manage.js add note`     | e.g. `"Kernel ROP" "ctf/pwn/kernel"` or `--path "ctf/pwn/kernel/modprobe.md" --file ./draft.md` |

A note's file path defines its place in the sidebar's folder tree.

**About drafts:** a draft stays a file in `content/` and is skipped when building, so it never reaches `data.js`, the per-post pages, the sitemap or the published site (the browser editor reads `data.js`, so edit drafts as files). But if your repository is **public**, the draft's `.md` file is still visible on github.com and in git history — for anything you truly can't show yet, keep it outside the repo (or in a private repo/branch) until it's ready.

---

## Customising the site (`config.js`)

`config.js` controls everything visible. Blocks are separate per page, so editing one page never changes another.

| Want to change…                           | Edit                                                     |
| ----------------------------------------- | -------------------------------------------------------- |
| Navbar name, tab titles, description      | `site.brand`, `site.name`, `site.titleTemplate`, `site.description` |
| Public address (enables SEO files)        | `site.url`, `site.author`, `site.feed`                   |
| A page's URL (e.g. `/me` → `/about`)      | `routes.about` (keep old links alive with `routes.redirects`) |
| Nav links and labels                      | `nav.links`                                              |
| **Loading screen timing**                 | `ui.loader.minDuration` (first visit), `ui.loader.pageChangeDuration` (clicking around), `ui.loader.skipOnBackForward` |
| Loading screen messages                   | `ui.loader.initial`, `ui.loader.labels`                  |
| Home hero, typed roles, buttons, cards    | `pages.home`                                             |
| Writeups / Projects headings & messages   | `pages.writeups`, `pages.projects`                       |
| Post header, copy link, flag blur         | `pages.post`                                             |
| Notes vault labels and icons              | `pages.notes`                                            |
| Timeline entries                          | `pages.timeline.items`                                   |
| About bio, interests, social tiles        | `pages.about` (`contacts`: `icon`, `handle`, `copy`)     |
| 404 page                                  | `pages.notFound`                                         |
| Search palette, theme / rain / back-to-top labels | `ui`                                             |
| Screen-reader text                        | `ui.a11y`                                                |
| Code block options                        | `ui.code`                                                |
| Footer lines                              | `footer`                                                 |
| Music labels and playlist                 | `music`                                                  |
| Hidden flag hunt                          | `easterEggs`                                             |
| Cursor style                              | `cursor`                                                 |

**Placeholders** usable inside text: `{year}`, `{site}`, `{page}`, `{n}` (a count) and `{query}` (a search term). Counts have a singular form too (`entries` / `entriesOne`).

**Contact tiles** take `icon: "github" | "twitter" | "email" | "ctftime" | "discord" | "link"` (or your own `iconSvg`). Add `copy: "text"` for a click-to-copy tile, `wide: true` for a full-width tile.

**Config checker.** A typo in `config.js` is otherwise silently ignored (every key has a fallback). `js/configcheck.js` warns in the browser console about unknown keys (with "did you mean…?"), wrong types, duplicate URL slugs, bad page names, unknown icons and unknown `{placeholders}`. Add `?debug=config` to the address to see the list on the page. A test asserts the shipped config produces zero warnings.

> `404.html` is a tiny standalone redirect page and cannot load `config.js`. If you rename a slug, also add the new slug to the `routeNames` list at the top of `404.html`.

---

## Features

### Loading screen
A video + loading bar covers the first load and every page change. `ui.loader.minDuration` (default 2000 ms) is the **minimum** on first load; `ui.loader.pageChangeDuration` (default 600 ms) applies when clicking to another page. The new page is rendered behind it, so nothing pops in, and a second navigation restarts the timer instead of stacking. The browser's **Back/Forward** buttons skip it entirely (`skipOnBackForward`). Moving between notes never shows it. It's announced to screen readers as "Loading".

### Light / dark mode
A sliding sun/moon switch. It follows your operating system until you click it, then remembers your choice and stays in sync across tabs. Browsers that support it get a circular reveal animation (`prefers-reduced-motion` gets an instant flip). A tiny inline script sets the theme before first paint, so there's no flash. Everything stays pure black & white.

### Background: clouds and rain (`js/canvas.js`)
- **Clouds** are blocky pixel clouds at several depths, drawn as solid sprites and faded as a whole, so overlaps never go muddy. They re-colour instantly on a theme change.
- **Rain** has three depth layers, a slowly gusting wind, and pixel splashes and ripples where the nearest drops land — on the bottom of the screen, or on the **top edge of the footer** when it's in view. The storm button (bottom-left) turns rain on/off and remembers it.
- **Self-tuning:** a frame-time governor thins the rain below ~45 fps (and as a last resort drops to 30 fps). It renders at a capped resolution, pauses in background tabs, repaints cleanly on return, and only rebuilds when the window *width* changes (so phone address bars don't make it flicker). Static under `prefers-reduced-motion`.

### Search palette (`Ctrl/⌘ + K` or `/`)
Searches pages, writeups, projects and **every note at any folder depth — including the full text** of each. Results highlight the match and show a snippet.
- `heap overflow` — every word must match somewhere (title, tag, summary or text).
- `#pwn` — filter by tag; combine with words: `#pwn tcache`. Clickable tag chips show when the box is empty.
- Identifiers work too: `commit_creds`, `safe-linking`.
- Arrow keys / Enter / Esc. Announced as a combobox with a listbox of options.

### Cursor (`js/cursor.js`)
A bold ring that trails the mouse with a little inertia, swells over anything clickable and squeezes on press; a click also sends out a ripple (a few reusable elements, so rapid clicking never adds or removes page elements). Set `cursor` in `config.js`, or test with `?cursor=…` in the address:

| Value           | What you get                                                                       |
| --------------- | ---------------------------------------------------------------------------------- |
| `"ring"`        | The ring drawn by the page, with inertia (default).                                |
| `"native-ring"` | The same ring drawn **as the operating-system cursor**. Nothing is hidden or faked, so no hidden cursor can flash back on a click. No trailing inertia. |
| `"off"`         | The normal system cursor.                                                          |

It only runs for a real mouse or pen — never on touch screens or under `prefers-reduced-motion`. Pressing a link or button never starts a native drag or text selection (some systems paint their own cursor with a "+" badge during those).

### Home page
Hero (optional status pill, big name, typing role line, subtitle, optional floating badges, buttons, profile picture), Explore cards with live counts, and latest writeups/projects with friendly empty states. All in `pages.home`; blank values (`status: ""`, `chips: []`) hide that element.

### Notes vault (Obsidian-style)
Resizable sidebar (drag the divider; double-click to reset; width is remembered), nested folders with animated arrows and counts, expand/collapse-all, auto-opening the active note's folders, `[[wiki-links]]`, and a per-note outline.

### Persistent music player
Lives in the navbar and stays active across page changes. Tracks and labels are in `config.js` → `music` (an empty playlist shows a "dropping soon" placeholder on the About page).

### Flag hunt
There are flags hidden around the site (config: `easterEggs`). Found one? Press `/` and paste it into the search box; type `flags` there for progress and hints. Progress is stored in your browser only. All flags, hints and messages are editable; set `easterEggs.enabled: false` to remove the whole thing.

### Accessibility
Skip-to-content link, labelled navigation with `aria-current`, page changes announced to screen readers, the loader marked busy/hidden correctly, blurred flags reachable and revealable by keyboard, visible focus rings for keyboard use only, alt text on every image, and reduced-motion respected throughout. Text for all of it is in `ui.a11y`.

### Mobile & touch
No browser tap-highlight box; buttons, cards and links get a proper pressed state instead. Controls are at least 44 px, taps respond instantly, the menu closes on an outside tap or Esc, layout respects phone notches and dynamic viewport heights. Long-pressing UI elements doesn't select text or open image menus.

---

## Files

```
index.html          page shell, security meta, theme-before-paint script, skip link
config.js           ALL site text, titles, URL slugs, nav, about/timeline, music, flag hunt, cursor
data.js             writeups, projects, notes (generated by manage.js)
style.css           design tokens, layout, theme switch, cursor, code colours, touch & mobile rules
fonts.css, fonts/   self-hosted web fonts (no Google Fonts request)
marked.min.js       self-hosted Markdown parser
js/
├── app.js          router, views, notes vault, Markdown rendering, loader, theme, post features
├── canvas.js       clouds, rain, splashes, click ripple, frame governor
├── cursor.js       ring cursor (ring / native-ring / off)
├── cmdk.js         search palette: full-text, tag filters, snippets, plug-in hook
├── highlight.js    dependency-free syntax highlighter
├── configcheck.js  config.js checker (console + ?debug=config)
├── eggs.js         flag hunt
└── player.js       persistent audio player
manage.js           content CLI + local editor + SEO generator
404.html            standalone redirect / 404 page
robots.txt          crawler policy (+ Sitemap line once site.url is set)
media/              pfp.webp/.jpg, loader.mp4, top_dark/top_light (.webp/.png)
content/            your Markdown source files
_headers            for Cloudflare Pages / Netlify only (GitHub Pages ignores it; not published)
.well-known/        security.txt  (renew the Expires date once a year)
.github/workflows/  deploy.yml    (test, build, publish)
tests/              the test suite (npm test)
package.json        test scripts only — the site itself has no dependencies
---- generated by `manage.js sync` when site.url is set ----
writeups-*.html, projects-*.html, sitemap.xml, feed.xml, .seo-manifest.json
```

Swap `media/pfp.*` (avatar), `media/top_*` (back-to-top icon per theme) and `media/loader.mp4` (loading clip) for your own — keep the same filenames (avatar paths can also be changed in `site.avatar`).

---

## Testing

The same suite runs automatically on every push and pull request (GitHub Actions) and must pass before a deploy.

```bash
npm install     # once (installs jsdom; `canvas` is optional and only used for the rain tests)
npm test
```

The suite loads the real `index.html` and scripts in jsdom and checks, among other things: every page and route (including a nearly empty config), that changing config text and URL slugs is followed everywhere, the config checker, the loader timings (first load, page change, Back/Forward, rapid clicks), the light/dark switch, cursor modes and click handling, rain landing on the footer and tab-switch behaviour, syntax highlighting, flag blurring, section links and share links, full-text search and tag filters, the flag hunt, accessibility wiring, and the whole SEO pipeline (run against a scratch copy of the project, including hostile titles and bodies). A shipping test also checks that every config path the code reads exists in `config.js`, that `_headers` matches the page's CSP, and that `security.txt` hasn't expired.

---

## Deploying (GitHub Pages)

### Option A — GitHub Actions (recommended)

1. Create the repo and push everything (keep `index.html` at the top level).
2. **Settings → Pages → Build and deployment → Source: _GitHub Actions_.**
3. Push to `main`. The workflow (`.github/workflows/deploy.yml`) then:
   - runs `npm ci` and `npm test` (pull requests get the tests too, but never deploy);
   - rebuilds `data.js`, the per-post pages, `sitemap.xml` and `feed.xml` from `content/` (and leaves a committed `data.js` alone if `content/` has no Markdown files);
   - copies **only the website files** into a `dist/` folder and publishes that — never `content/`, `manage.js`, `tests/`, `package.json` or `_headers`.
4. Tick **Enforce HTTPS**. For a custom domain, set it under *Settings → Pages* (no `CNAME` file needed with Actions) and use it as `site.url`.

```bash
git init && git branch -M main && git add . && git commit -m "Initial site"
git remote add origin https://github.com/<you>/<repo>.git
git push -u origin main
```

A deploy takes about a minute; progress shows under the repo's **Actions** tab. If it fails with *"Pages is not configured"*, step 2 hasn't been done.

### Option B — "Deploy from a branch" (Jekyll)

*Settings → Pages → Source: Deploy from a branch → `main` / `(root)`.* Run `node manage.js sync` yourself and **commit the generated files** (`data.js`, `writeups-*.html`, `projects-*.html`, `sitemap.xml`, `feed.xml`). `_config.yml` keeps Jekyll from publishing `content/`, `tests/` and the tooling (without it, Jekyll would turn every Markdown file that has frontmatter into a web page — including drafts) and includes `.well-known/`.

### What GitHub Pages can't do (and what to do about it)

| Limitation | Effect here |
| ---------- | ----------- |
| **No custom response headers** | `X-Frame-Options`, `frame-ancestors`, HSTS tuning etc. can't be set. The site uses the in-page equivalents (a CSP `<meta>`, referrer-policy `<meta>`, a best-effort frame-busting script). `_headers` is for Cloudflare Pages/Netlify and is **not** published by the workflow. To get real headers on GitHub Pages, put Cloudflare in front and copy the values from `_headers` into *Rules → Transform Rules → Modify Response Header*. |
| **~10-minute cache** | GitHub's CDN caches files for about 10 minutes, so a brand-new post (or edited `data.js`) can take that long to appear for people who already loaded the site. Hard-refresh to check. |
| **Case-sensitive file names** | Windows and macOS ignore letter case, GitHub Pages doesn't: `media/Pfp.webp` loads on your laptop and 404s online. `npm test` checks that every file the site refers to exists with exactly that spelling, and generated post-page names are always lower-case. |
| **Root-only well-known files** | On a *project site* (`user.github.io/my-repo`), `/robots.txt` and `/.well-known/security.txt` are served from your repo's sub-path, where crawlers and security researchers don't look. They work properly on user/org sites and custom domains. |
| **No server code** | Everything is static — search, the flag hunt and progress tracking all run in the browser (progress lives in `localStorage`). |
| **Soft limits** | Published site ≤ 1 GB and roughly 100 GB/month of bandwidth (GitHub also rate-limits branch-based builds to about 10/hour). Keep `media/` lean — the loader clip is the biggest file. |

### Optional: Cloudflare in front of a custom domain

GitHub Pages already serves from a CDN, so traffic spikes are usually fine. With a custom domain you can add: a proxied `CNAME` to `<username>.github.io`; **Bot Fight Mode**; a rate-limit rule (e.g. 100 requests / 10 s per IP → Managed Challenge); **Under Attack Mode** only during an active flood; a cache rule with a 1-day edge TTL; and the security headers from `_headers`.

### Other hosts

Cloudflare Pages / Netlify work with no build command (or `node manage.js sync`) and the repo root as the output folder; they pick up `_headers` automatically.

---

## Troubleshooting

**A stray shape (like a "+") flashes when clicking.** The page never draws one, so this comes from outside the site's code — usually the operating system's cursor theme or a browser extension (mouse-gesture, click-highlighter, dictionary/translate pop-ups). In this order:
1. Try `yoursite/?cursor=native-ring`. If it's gone, keep `cursor: "native-ring"` in `config.js`.
2. Try `yoursite/?cursor=off`. If a shape still appears around the normal arrow, it isn't the site's cursor.
3. Try an incognito window with extensions disabled.
4. Add `?debug=cursor` and click until it appears; a green panel lists what's under the pointer and what the page changed. Screenshot it.

**Link previews / Google show the home page for a post.** Set `site.url` in `config.js`, run `node manage.js sync`, publish the generated files, and share the post's **copy link** address. Previews are cached by Discord/Twitter for a while — use their debugger tools to refresh.

**Colours look wrong after a reload (greenish dark grey).** A dark-mode extension or the browser's "force dark" flag is re-tinting the page. The site includes the `darkreader-lock` meta tag; otherwise exclude the site in the extension, or set `chrome://flags/#enable-force-dark` to Default.

**A setting seems to be ignored.** Open the browser console (or add `?debug=config`): the config checker lists typos and invalid values.

**I published a post but it isn't there.** GitHub Pages caches for ~10 minutes — wait, then hard-refresh (Ctrl/Cmd+Shift+R). With Option A, check the **Actions** tab: a failing test blocks the deploy. With Option B, make sure you ran `node manage.js sync` and committed `data.js`.

**Images or fonts work locally but 404 on GitHub.** File-name case: the repo has `Pfp.webp` but the config says `pfp.webp` (or vice-versa). Rename so they match exactly; `npm test` catches this.

**The sitemap isn't picked up (project site).** See [SEO on GitHub Pages](#search-engines--link-previews-seo) — submit it in Search Console.

**The loading screen is too short or too long.** Change `ui.loader.minDuration` / `ui.loader.pageChangeDuration` (milliseconds).

**A renamed page 404s.** Add the new slug to `routeNames` in `404.html`.

**`npm test` fails on the rain tests.** They need the optional `canvas` package; without it they're skipped, not failed.

---

## Security notes

- **Content Security Policy** (meta tag, mirrored in `_headers`) limits scripts, styles, fonts, media and connections to the site itself. Inline scripts and styles are allowed because the app uses them; images allow `data:` and `https:`.
- **Response headers:** GitHub Pages can't set them, so the site relies on in-page equivalents (CSP `<meta>`, referrer-policy `<meta>`, a best-effort frame-busting script). `_headers` holds the full set (`X-Content-Type-Options`, `X-Frame-Options`/`frame-ancestors`, `Permissions-Policy`, …) for Cloudflare Pages/Netlify, or to copy into Cloudflare Transform Rules if you front GitHub Pages with Cloudflare.
- **XSS:** every config value, title, date, tag, search term, route parameter and highlighted code token goes through `escapeHTML()`; the static per-post pages escape the same way and JSON-LD can't close its `<script>` block. Tests feed hostile titles and bodies through the whole pipeline.
- **URLs:** contact and button links are allow-listed to `http(s):`, relative paths, `#` and `mailto:`; Markdown links and images reject unsafe schemes.
- **Markdown:** raw HTML in bodies is escaped; external links get `rel="noopener noreferrer" target="_blank"`.
- **Drafts:** never written to `data.js`, the generated pages or the published site (the workflow doesn't publish `content/`). In a *public* repo the draft file itself is still visible on GitHub — see [About drafts](#managejs).
- **Reporting:** `.well-known/security.txt` (RFC 9116) is included — keep its `Expires` date current (a test fails when it lapses). It is only discoverable on user/org sites and custom domains, not on `user.github.io/repo` project sites.
- **Crawlers:** `robots.txt` blocks several AI scrapers.
