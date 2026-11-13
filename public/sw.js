/*
 * Marites PH service worker (Phase 11).
 *  - /_next/static/*: cache-first (file names change when content changes).
 *  - Pages people need at the office: public guides, business guides, offices,
 *    the planner, the updates feed, and saved plans / My documents. Network-first
 *    (4 s timeout); successful same-origin GET HTML is kept; offline, the last
 *    copy is shown, else the offline page.
 *  - Never cached: admin, account, login, auth, API, CPA review, query strings.
 *  - Personal pages (plans, my-documents) are cleared on sign-out and account
 *    deletion by the server's Clear-Site-Data header.
 * Bump VERSION to drop old caches on the next visit.
 */
const VERSION = "v1";
const STATIC = `static-${VERSION}`;
const PAGES = `pages-${VERSION}`;
const OFFLINE = ["/en/offline", "/fil/offline"];
const CACHEABLE = /^\/(en|fil)(\/?$|\/(ids|business|offices|lakad|ano-ng-bago|plans|my-documents|cpas)(\/|$))/;
const NEVER = /^\/(en|fil)\/(admin|account|login|cpa)(\/|$)|^\/(api|auth)\//;

self.addEventListener("install", (event) => {
  event.waitUntil(caches.open(PAGES).then((c) => c.addAll(OFFLINE)).then(() => self.skipWaiting()));
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== STATIC && k !== PAGES).map((k) => caches.delete(k)))).then(() => self.clients.claim()),
  );
});

function offlinePage(path) {
  return caches.match(path.startsWith("/fil") ? "/fil/offline" : "/en/offline");
}

function timeout(ms) {
  return new Promise((_, reject) => setTimeout(() => reject(new Error("timeout")), ms));
}

self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;

  if (url.pathname.startsWith("/_next/static/")) {
    event.respondWith(
      caches.open(STATIC).then(async (cache) => {
        const hit = await cache.match(req);
        if (hit) return hit;
        const res = await fetch(req);
        if (res.ok) cache.put(req, res.clone());
        return res;
      }),
    );
    return;
  }

  if (req.mode !== "navigate") return;
  const path = url.pathname;
  if (NEVER.test(path)) return;
  const cacheable = CACHEABLE.test(path) && !url.search;

  event.respondWith(
    (async () => {
      try {
        const res = await Promise.race([fetch(req), timeout(4000)]);
        if (cacheable && res.ok && res.type === "basic" && (res.headers.get("content-type") || "").includes("text/html")) {
          const cache = await caches.open(PAGES);
          cache.put(path, res.clone());
        }
        return res;
      } catch {
        if (cacheable) {
          const hit = await caches.match(path);
          if (hit) return hit;
        }
        return (await offlinePage(path)) || new Response("Offline", { status: 503, headers: { "content-type": "text/plain" } });
      }
    })(),
  );
});
