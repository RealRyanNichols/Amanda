// Service worker — offline shell caching for Amanda's Toolkit.
// Bump CACHE_VERSION to force users onto new assets after a deploy.
const CACHE_VERSION = "v3-2026-04-19";
const CACHE_NAME = `amanda-toolkit-${CACHE_VERSION}`;

const PRECACHE = [
  "./",
  "./index.html",
  "./manifest.webmanifest",
  "./css/styles.css",
  "./js/app.js",
  "./js/store.js",
  "./js/util.js",
  "./js/branding.js",
  "./js/auth.js",
  "./js/tools/dashboard.js",
  "./js/tools/brain.js",
  "./js/tools/income.js",
  "./js/tools/booking.js",
  "./js/tools/career.js",
  "./js/tools/academy.js",
  "./js/tools/overload.js",
  "./js/tools/followup.js",
  "./js/tools/life.js",
  "./js/tools/life-seeds.js",
  "./js/tools/rda-seed.js",
  "./js/tools/settings.js",
  "./js/tools/meals.js",
  "./js/tools/social.js",
  "./js/tools/calendar.js",
  "./js/voice.js",
  "./assets/icon.svg",
  "./assets/icon-192.png",
  "./assets/icon-512.png",
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) =>
      // Pre-cache best-effort; don't fail install if a single asset 404s.
      Promise.all(PRECACHE.map((url) => cache.add(url).catch(() => {})))
    ).then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

// Network-first for HTML so she always gets the latest shell when online,
// cache fallback when offline. Cache-first for everything else (CSS/JS/img).
self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET") return;

  const url = new URL(req.url);

  // Never cache the Anthropic API. Always network.
  if (url.hostname === "api.anthropic.com") return;
  // Never cache cross-origin dynamic resources we don't control.
  if (url.origin !== self.location.origin && !url.pathname.startsWith("/assets/pda")) return;

  const acceptsHTML = req.headers.get("accept")?.includes("text/html");
  if (acceptsHTML) {
    event.respondWith(
      fetch(req)
        .then((res) => {
          const copy = res.clone();
          caches.open(CACHE_NAME).then((c) => c.put(req, copy)).catch(() => {});
          return res;
        })
        .catch(() => caches.match(req).then((hit) => hit || caches.match("./index.html")))
    );
    return;
  }

  event.respondWith(
    caches.match(req).then((hit) => {
      if (hit) return hit;
      return fetch(req).then((res) => {
        if (res.ok && res.type === "basic") {
          const copy = res.clone();
          caches.open(CACHE_NAME).then((c) => c.put(req, copy)).catch(() => {});
        }
        return res;
      });
    })
  );
});
