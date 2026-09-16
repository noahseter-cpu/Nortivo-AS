const SHELL = "noah-shell-v1";
self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(SHELL)
      .then((cache) =>
        cache.addAll([
          "/",
          "/favicon.svg",
          "/fonts/manrope-regular.ttf",
          "/fonts/manrope-semibold.ttf",
          "/fonts/manrope-bold.ttf",
        ]),
      ),
  );
  self.skipWaiting();
});
self.addEventListener("activate", (event) => {
  event.waitUntil(
    Promise.all([
      caches
        .keys()
        .then((keys) =>
          Promise.all(
            keys
              .filter((k) => k.startsWith("noah-shell-") && k !== SHELL)
              .map((k) => caches.delete(k)),
          ),
        ),
      self.clients.claim(),
    ]),
  );
});
self.addEventListener("fetch", (event) => {
  const url = new URL(event.request.url);
  if (
    event.request.method !== "GET" ||
    url.origin !== self.location.origin ||
    url.pathname.startsWith("/api/") ||
    url.pathname.includes("/__")
  )
    return;
  if (event.request.mode === "navigate") {
    event.respondWith(
      fetch(event.request)
        .then((response) => {
          if (
            response.ok &&
            response.headers.get("content-type")?.includes("text/html")
          ) {
            const copy = response.clone();
            caches.open(SHELL).then((c) => c.put("/", copy));
          }
          return response;
        })
        .catch(() => caches.match("/").then((r) => r ?? Response.error())),
    );
    return;
  }
  if (/\.(js|css|ttf|woff2|svg)$/.test(url.pathname)) {
    event.respondWith(
      caches.match(event.request).then(
        (cached) =>
          cached ??
          fetch(event.request).then((response) => {
            if (response.ok) {
              const copy = response.clone();
              caches.open(SHELL).then((c) => c.put(event.request, copy));
            }
            return response;
          }),
      ),
    );
  }
});
self.addEventListener("message", (event) => {
  if (
    event.data?.type === "CACHE_SHELL_ASSETS" &&
    Array.isArray(event.data.urls)
  ) {
    const urls = event.data.urls
      .filter((u) => {
        try {
          const url = new URL(u, self.location.origin);
          return (
            url.origin === self.location.origin &&
            /\.(js|css|ttf)$/.test(url.pathname)
          );
        } catch {
          return false;
        }
      })
      .slice(0, 100);
    event.waitUntil(
      caches
        .open(SHELL)
        .then((cache) => Promise.allSettled(urls.map((u) => cache.add(u)))),
    );
  }
});
