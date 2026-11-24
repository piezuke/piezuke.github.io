/* ===========================================================================
   Service worker: makes repeat visits near-instant and lets the site open offline.

   - VERSION and PRECACHE are filled in by `node build.js` at deploy time. While
     you develop locally nothing registers this file (js/app.js only registers it
     when the page has <meta name="app-build">, which only the built site has).
   - Every asset URL carries a content hash (?v=...), so a cached file can never be
     the wrong version for the page that asked for it.
   - It only ever touches same-origin GET requests. Cross-origin requests, POSTs
     and Range requests (video) go straight to the network untouched.
   =========================================================================== */
const VERSION = "dev";
const PRECACHE = /*PRECACHE*/ [] /*END*/;

const CACHE = "site-" + VERSION;
const NAV_TIMEOUT = 3500; // ms to wait for the network before using the cached page

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(CACHE)
      // "reload": always fetch fresh copies, never what the HTTP cache happens to hold
      .then((cache) => cache.addAll(PRECACHE.map((u) => new Request(u, { cache: "reload" }))))
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k.startsWith("site-") && k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET") return;
  if (req.headers.has("range")) return; // video/audio streaming: let the browser handle it
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return; // never touch other sites
  if (url.pathname.endsWith("/sw.js")) return;

  if (req.mode === "navigate") {
    event.respondWith(pageFirstFromNetwork(req));
  } else {
    event.respondWith(assetFromCache(req));
  }
});

// Pages: always try the network first (so a new deploy shows up at once), fall back to the cache.
async function pageFirstFromNetwork(req) {
  const cache = await caches.open(CACHE);
  const network = fetch(req.url, { cache: "no-cache", credentials: "same-origin" }).then((res) => {
    if (res && res.ok && res.type === "basic") cache.put(req, res.clone());
    return res;
  });
  const slow = new Promise((resolve) => setTimeout(() => resolve(null), NAV_TIMEOUT));
  try {
    const res = await Promise.race([network, slow]);
    if (res) return res;
    const cached = await cache.match(req);
    return cached || (await network);
  } catch (err) {
    const cached = (await cache.match(req)) || (await cache.match(new URL("/index.html", self.location.origin).href));
    return cached || Response.error();
  }
}

// Everything else (scripts, styles, fonts, images): the cache answers instantly.
// The URLs are content-hashed, so a hit is always the right file.
async function assetFromCache(req) {
  const cache = await caches.open(CACHE);
  const hit = await cache.match(req);
  if (hit) return hit;
  const res = await fetch(req);
  if (res && res.ok && res.type === "basic") cache.put(req, res.clone());
  return res;
}
