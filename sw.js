/* Taiyabah Home Interface — service worker
   Caches the app shell (page, icons, fonts-free CSS, audio) so a tablet or TV
   left on this page keeps working through a brief Wi-Fi drop, and so it can
   be "installed" from the browser (Add to Home Screen / pin to Smart TV
   launcher) like the companion app. Network-first for index.html so a
   published fix reaches the device quickly; cache-first for the large,
   rarely-changing audio files. */
/* BUMP THIS whenever you replace a cached asset *at the same path* — a new
   Adhan recording over audio/adhan-full.mp3, redrawn icons, an edited
   manifest. Everything below except index.html is served cache-first and is
   never revalidated, so without a bump an existing install keeps serving the
   old file forever and you get a bug report you cannot reproduce. Renaming a
   file to a new path is safe without a bump (new URL, not in the cache).
   index.html is network-first, so page changes need no bump. */
const CACHE = "taiyabah-home-v3";
const SHELL = [
  "./",
  "./index.html",
  "./manifest.webmanifest",
  "./logo-cream.png",
  "./icon-192.png",
  "./icon-512.png",
  "./audio/adhan-full.mp3",
  "./audio/iqamah-short.mp3",
];
/* The four sky backgrounds, cached separately and allowed to fail. They are
   a nice-to-have — the page falls back to the plain gradient without them —
   and addAll() above is atomic, so one missing sky file in SHELL would take
   the whole install down and leave the device with no offline shell at all.
   47KB for the set, so caching them is close to free. */
const SKY = [
  "./sky/night.webp",
  "./sky/dawn.webp",
  "./sky/day.webp",
  "./sky/dusk.webp",
];

self.addEventListener("install", (e) => {
  e.waitUntil((async () => {
    const c = await caches.open(CACHE);
    await c.addAll(SHELL);                                  // all or nothing
    await Promise.allSettled(SKY.map((u) => c.add(u)));     // best effort
  })());
  self.skipWaiting();
});

self.addEventListener("activate", (e) => {
  e.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))
    )
  );
  self.clients.claim();
});

self.addEventListener("fetch", (e) => {
  const url = new URL(e.request.url);
  /* The live broadcast is an endless response. Never put it through the
     cache logic below: caches.match on a stream is pointless, and routing
     an infinite body through a service worker is a known way to have it
     buffer or stall on some browsers. Let it go straight to the network.
     Same for anything cross-origin — none of it is ours to cache. */
  if (url.origin !== self.location.origin) return;
  const isHTML = e.request.mode === "navigate" || url.pathname.endsWith("index.html");
  if (isHTML) {
    e.respondWith(
      fetch(e.request)
        .then((res) => {
          caches.open(CACHE).then((c) => c.put(e.request, res.clone()));
          return res;
        })
        .catch(() => caches.match(e.request).then((r) => r || caches.match("./index.html")))
    );
    return;
  }
  e.respondWith(
    caches.match(e.request).then((cached) => cached || fetch(e.request))
  );
});
