const cacheName = "poultry-feed-v2";
const appFiles = [
    "./AppIdnex.html",
    "./Feed.html",
    "./Grams.html",
    "./PoultryApp.css",
    "./app.js",
    "./manifest.webmanifest",
    "./app-icon.svg"
];

self.addEventListener("install", (event) => {
    event.waitUntil(caches.open(cacheName).then((cache) => cache.addAll(appFiles)));
    self.skipWaiting();
});

self.addEventListener("activate", (event) => {
    event.waitUntil(
        caches.keys().then((keys) => Promise.all(
            keys.filter((key) => key !== cacheName).map((key) => caches.delete(key))
        ))
    );
    self.clients.claim();
});

self.addEventListener("fetch", (event) => {
    const requestUrl = new URL(event.request.url);
    if (event.request.method !== "GET" || requestUrl.pathname.startsWith("/api/")) return;
    if (requestUrl.origin !== self.location.origin) return;

    event.respondWith(
        fetch(event.request).then((response) => {
            if (response.ok) {
                const copy = response.clone();
                caches.open(cacheName).then((cache) => cache.put(event.request, copy));
            }
            return response;
        }).catch(() => caches.match(event.request))
    );
});