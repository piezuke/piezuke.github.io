# piezuke_ — CTF writeups, projects, notes & timeline

A single-page, black-and-white cyberpunk blog. No build step or framework; the site runs from static HTML, CSS, JavaScript, and assets. `manage.js` is an optional Node.js tool for maintaining Markdown content.

## Deploy to GitHub Pages

1. Create a new repo (or use an existing one), e.g. `piezuke.github.io` for a user site, or any name for a project site.
2. Push everything in this folder to the repo root (keep `index.html` at the top level).
3. In the repo: **Settings → Pages → Source → Deploy from a branch → `main` / `(root)`** → Save.
4. Check **"Enforce HTTPS"** under GitHub Pages settings.
5. Wait ~1 minute, then visit the URL GitHub gives you.

```bash
git init
git branch -M main
git add .
git commit -m "Cyberpunk portfolio & blog - optimized & secured"
git remote add origin https://github.com/<your-username>/<your-repo-name>.git
git push -u origin main
```

If it's a **project site** (not `username.github.io`), your live URL will be `https://username.github.io/repo-name/` — that's fine, all asset links in this project are relative so it works from any subpath.

## Optional: Cloudflare in Front of a Custom Domain

GitHub Pages already serves this site as static assets from its own CDN, with no server-side runtime or database to exhaust, so it already handles most traffic spikes fine on its own. If you point a custom domain at it, putting Cloudflare in front is a reasonable, low-effort extra layer for bot traffic and abusive scraping — it is not a guarantee against every kind of attack, and none of this is required for the site to work:

1. **Add Custom Domain to Cloudflare** (Free Plan):
   - In Cloudflare DNS, add a `CNAME` pointing to `<username>.github.io` with the **Proxy Status: Proxied (Orange Cloud)**.
2. **Enable Bot Fight Mode**:
   - Go to **Security → Bots** → Toggle **Bot Fight Mode** ON. This automatically stops automated scrapers, brute-force bots, and DDoS botnets.
3. **Set Up a Rate Limiting Rule**:
   - Go to **Security → WAF → Rate limiting rules** → Create rule:
     - Name: `General Rate Limit`
     - If incoming requests exceed: `100 requests per 10 seconds` per IP
     - Action: `Managed Challenge` or `Block` for 1 minute.
4. **Enable Under Attack Mode (When Under Heavy Flood)**:
   - Go to **Overview** → Toggle **"Under Attack Mode"** ON to challenge all incoming visits with Cloudflare Turnstile if an active L7 flood occurs.
5. **Edge Caching Rules**:
   - Go to **Caching → Cache Rules** → Create rule: Cache eligibility: _Eligible for cache_ with Edge TTL 1 day. This lets Cloudflare serve most repeat requests from its edge cache instead of round-tripping to GitHub every time, which helps but doesn't eliminate origin traffic entirely.

## Security Hardening Baked Into This Build

- **Content Security Policy (CSP)**: Restricts resource origins to the site, with inline scripts/styles allowed for the current app.
- **Clickjacking Mitigation**: A best-effort frame-busting script runs in `<head>`. A `frame-ancestors` policy must be configured as an HTTP response header by the hosting platform.
- **Referrer Policy**: `strict-origin-when-cross-origin` is set in the document. MIME-sniffing protection also requires an HTTP response header from the host.
- **Zero DOM-XSS**: All user and config variables (`brand`, `tagline`, titles, dates, pills, tags, palette searches, route params) are rigorously sanitized through `escapeHTML()`.
- **Safe URL Filtering**: Contact links use an allowlist; Markdown links and images reject unsafe URL schemes before rendering.
- **Hardened Markdown Parser**: Raw HTML elements are escaped in Markdown bodies, malicious URI schemes in links/images are neutralized, and external links automatically get `rel="noopener noreferrer" target="_blank"`.
- **Reverse Tabnabbing Immune**: All outbound links are locked with `rel="noopener noreferrer"`.
- **Responsible Disclosure**: Includes standard RFC 9116 `.well-known/security.txt`.
- **Scraper & Bot Restriction**: Custom `robots.txt` blocks aggressive AI scrapers and automated vulnerability probes.

## Managing Content (`manage.js`)

All blog writeups, portfolio projects, and notes are managed as standard Markdown files in the `content/` directory, compiled into `data.js` via the zero-dependency `manage.js` tool.

```
content/
├── writeups/          # Markdown files for CTF / security writeups
├── projects/          # Markdown files for portfolio projects
└── notes/             # Notes organized by arbitrary folder/subfolder paths
    ├── ctf/
    │   └── pwn/
    │       └── kernel/
    │           └── kernel-exploits.md
    ├── ctf-cheatsheets/
    │   ├── pwn-checklist.md
    │   ├── gdb-cheatsheet.md
    │   └── rop-basics.md
    └── reading/
        ├── os-notes.md
        └── crypto-notes.md
```

### CLI Tool Usage

- **Interactive Menu**: Run `node manage.js` to add writeups, projects, notes, or sync.
- **Add Note (supports any nested subfolder depth)**:
  ```bash
  node manage.js add note
  # Quick positional creation:
  node manage.js add note "Kernel Exploits" "ctf/pwn/kernel"
  # Or via direct flags:
  node manage.js add note --folder "ctf/pwn/kernel" --title "Kernel ROP"
  node manage.js add note --path "ctf/pwn/kernel/modprobe.md" --file ./draft.md
  ```
  _Note file paths define the recursive folder tree in the notes sidebar with collapsible dropdowns._
- **Add Writeup**:
  ```bash
  node manage.js add writeup
  # Or via direct flags:
  node manage.js add writeup --title "CVE-2026-XXXX" --tag "web · auth bypass" --file ./post.md
  ```
- **Add Project**:
  ```bash
  node manage.js add project
  # Or via direct flags:
  node manage.js add project --title "mytool" --tag "rust · tui" --pills "Rust,TUI"
  ```
- **Sync Changes**: `node manage.js sync` (scans `content/` and regenerates `data.js`).
- **Auto-Sync on Save**: `node manage.js watch` (watches `content/` and automatically updates `data.js`).
- **List All Content**: `node manage.js list` (prints indented visual tree of all nested folders and notes).
- **Browser GUI**: `node manage.js ui` (launches a browser-based content editor on `http://127.0.0.1:8088`).

### Notes Vault & Obsidian-Like Features

- **Resizable Sidebar**: Drag the vertical divider handle between the sidebar and content. Persists your preferred width automatically; double-click the divider to reset to default 280px.
- **Arbitrary Subfolder Nesting**: Folders can contain notes, subfolders, sub-subfolders, etc. to any depth.
- **Collapsible Dropdowns**: Click any folder to expand/collapse with animated arrow (`▾`/`▸`), folder icon changes (`📂`/`📁`), and item count badge. Active note automatically auto-expands all its ancestor folders.
- **Global Expand / Collapse Controls**: `⊞` (Expand All) and `⊟` (Collapse All) buttons in the sidebar header.
- **Wiki-links**: Use `[[Note Title]]` in any markdown file to automatically link across any folder depth.

### Persistent Audio Player in Navbar

- Integrated into the right portion of the top navigation bar.
- When audio starts playing, the mini player smoothly expands into the navbar with track title, live status LED, spinning vinyl icon, play/pause, and skip controls.
- Stays active and persistent across all page transitions.

### Manual Edits

- **`config.js`** — **all text on the site, grouped per page** (`site`, `routes`, `nav`, `ui`, `footer`, `pages.home`, `pages.writeups`, `pages.projects`, `pages.post`, `pages.notes`, `pages.timeline`, `pages.about`, `pages.notFound`, `music`, `cursor`). Rename any page's URL slug under `routes`, edit nav labels, tab titles (`site.titleTemplate`), hero text, button labels, empty-state messages, timeline entries, about bio/skills/social links, music labels and the playlist — without touching any other file. Placeholders: `{year}`, `{site}`, `{page}`, `{n}`, `{query}`.
- **`data.js`** — auto-generated from `content/` via `manage.js sync` (can also be edited directly).
- **`js/app.js`** — core SPA router, view templates and markdown parser. It contains no site text: every string is read from `config.js`.
- **`js/player.js`** — audio playback simulation and UI sync (the playlist and its labels are in `config.js` → `music`).
- **`js/canvas.js`** — rain particle density, cloud simulation, and storm parameters.
- **`js/cmdk.js`** — command palette search indexing and shortcuts.
- **`style.css`** — theme tokens, island navbar, typography, notes vault layout, and animations.
- Swap `media/pfp.jpg`, `media/top_dark.webp` / `media/top_light.webp` (back-to-top icons per theme), and `media/loader.mp4` (route-change loading clip) for your own assets — keep the same filenames or update their references in `index.html` and `js/app.js`.
- **Kinetic Cursor** — `js/cursor.js` draws a ring cursor with smooth inertia that grows over clickable things and squeezes on press. Set `cursor` in `config.js` to `"on"` (default) or `"off"` for the normal system cursor; `?cursor=off` in the URL also works. Add `?debug=cursor` to see a click diagnostic panel. It disables on touch devices or when `prefers-reduced-motion` is active.

## Performance Optimizations

- **Clean Developer Typography**: Using crisp, native `JetBrains Mono` and system monospace across all UI elements and code blocks.
- **Retina WebP Assets**: Generated optimized WebP versions of all raster graphics (`pfp.webp`, `top_dark.webp`, `top_light.webp`) with picture fallbacks.
- **FastStart Route Loader**: Re-encoded video with CRF 26 and `+faststart` atom (46% smaller).
- **Self-Hosted Markdown**: Zero render-blocking external CDN scripts (`marked.min.js` deferred locally).
- **Smooth Canvas Rain**: Fluid 60fps/120fps native `requestAnimationFrame` loop with delta-time scaling and high-velocity rain streaks, paused automatically in background tabs.
- **Zero Layout Thrashing**: Scroll listeners run via `requestAnimationFrame` with `{ passive: true }`.

## Files

```
index.html       — clean semantic HTML skeleton and asset preloads
style.css        — modular stylesheet with tokens, responsive layout & themes
js/
├── app.js       — core SPA router, views, notes vault & markdown renderer
├── player.js    — persistent audio player & bidirectional sync
├── canvas.js    — rain, lightning & procedural cloud canvas animation
└── cmdk.js      — ⌘K command palette & global fuzzy search indexer
config.js        — ALL site text, titles, URL slugs, nav, about/timeline content, music labels
data.js          — writeups, projects, notes content
marked.min.js    — self-hosted fast markdown parser
js/cursor.js     — bold kinetic ring cursor with hover expansion
fonts.css / fonts/ — self-hosted webfonts (no Google Fonts request at runtime)
media/loader.mp4       — route-change loading clip (faststart optimized)
media/pfp.webp / pfp.jpg — your photo (retina WebP + JPG fallback)
media/top_dark.webp / top_light.webp (and .png) — back-to-top icon per theme
robots.txt       — search engine crawling policy and bot filters
.well-known/security.txt — RFC 9116 security contact policy (edit the placeholder contact/domain before deploying)
```


## Customising the site (config.js)

Everything visible is controlled from `config.js`, one block per page so pages never share text:

| Want to change…                         | Edit                                            |
| --------------------------------------- | ----------------------------------------------- |
| Name in navbar / tab titles             | `site.brand`, `site.name`, `site.titleTemplate` |
| A page's URL (e.g. `/me` → `/about`)    | `routes.about` (old links via `routes.redirects`) |
| Nav links and labels                    | `nav.links`                                     |
| Home hero, buttons, explore cards       | `pages.home`                                    |
| Writeups / Projects heading & messages  | `pages.writeups`, `pages.projects`              |
| "Back to…", read time, suggested reads  | `pages.post`, `pages.writeups.backLabel`        |
| Notes vault labels and icons            | `pages.notes`                                   |
| Timeline entries                        | `pages.timeline.items`                          |
| About bio, interests, social tiles      | `pages.about` (`contacts`: `icon`, `handle`, `copy`) |
| 404 page                                | `pages.notFound`                                |
| Search palette, loader, theme/rain tips | `ui`                                            |
| Footer lines                            | `footer`                                        |
| Music labels + playlist                 | `music`                                         |

> `404.html` is a tiny standalone redirect page and cannot load `config.js`. If you rename a slug in `routes`, add the new slug to the `routeNames` list at the top of `404.html` too.
