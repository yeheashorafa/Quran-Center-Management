const CACHE_NAME = "mutaqin-offline-shell-v14";
const STATIC_ASSETS = [
  "/offline-shell.html",
  "/manifest.json",
  "/brand/logo-light.png",
  "/icon-192.png",
  "/icon-512.png",
];

const OFFLINE_RESTRICTED_HTML = `
<!DOCTYPE html>
<html lang="ar" dir="rtl">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>غير متصل بالإنترنت | مركز سيد الشهداء حمزة</title>
  <style>
    body {
      font-family: system-ui, -apple-system, sans-serif;
      background-color: #0f172a;
      color: #f8fafc;
      display: flex;
      align-items: center;
      justify-content: center;
      min-height: 100vh;
      margin: 0;
      padding: 1rem;
      box-sizing: border-box;
    }
    .card {
      background-color: #1e293b;
      border: 1px solid #334155;
      border-radius: 1.5rem;
      padding: 2rem;
      max-width: 450px;
      width: 100%;
      text-align: center;
      box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.5);
    }
    .icon {
      font-size: 3rem;
      margin-bottom: 1rem;
    }
    h1 {
      font-size: 1.25rem;
      font-weight: 900;
      color: #f8fafc;
      margin: 0 0 0.5rem 0;
    }
    p {
      font-size: 0.875rem;
      color: #94a3b8;
      line-height: 1.5;
      margin: 0 0 1.5rem 0;
    }
    .actions {
      display: flex;
      flex-direction: column;
      gap: 0.75rem;
    }
    .btn {
      display: block;
      background-color: #047857;
      color: #ffffff;
      font-weight: 800;
      font-size: 0.875rem;
      padding: 0.75rem 1.25rem;
      border-radius: 0.75rem;
      text-decoration: none;
      transition: background-color 0.2s;
    }
    .btn:hover {
      background-color: #065f46;
    }
    .btn-sky {
      background-color: #0369a1;
    }
    .btn-sky:hover {
      background-color: #075985;
    }
  </style>
</head>
<body>
  <div class="card">
    <div class="icon">📡 Network Offline</div>
    <h1>صفحة المدير تتطلب اتصالاً بالإنترنت</h1>
    <p>لوحة تحكم المدير واستخراج التقارير تتطلب اتصالاً مباشراً بالشبكة لضمان أمان البيانات. تتاح خدمة العمل أوفلاين لشاشة التسميع اليومية للشيخ وشاشة تسجيل الاختبارات للمختبر.</p>
    <div class="actions">
      <a href="/offline-shell.html" class="btn">🔑 صفحة الدخول (Offline Shell)</a>
      <a href="/offline-teacher" class="btn">📖 وضع الشيخ (التسميع اليومي)</a>
      <a href="/offline-examiner" class="btn btn-sky">📝 وضع المختبر (الاختبارات الرسمية)</a>
    </div>
    <div style="margin-top: 1.5rem; padding-top: 1rem; border-top: 1px solid #334155; font-size: 11px; color: #94a3b8; text-align: center; line-height: 1.6;">
      🤍 صدقة جارية عن روح الشهداء بإذن الله<br>
      <span style="color: #34d399; font-weight: 700;">أبو فايز الشرفا · أبو أنس الشرفا · أبو المعتصم الزرد</span>
    </div>
  </div>
</body>
</html>
`;

function canCacheRequest(request, response) {
  if (!request || request.method !== "GET") return false;
  try {
    const url = new URL(request.url);
    if (url.protocol !== "http:" && url.protocol !== "https:") return false;
    if (url.origin !== self.location.origin) return false;
    if (url.pathname.startsWith("/manager") || url.pathname.startsWith("/api/")) return false;
  } catch {
    return false;
  }
  if (!response || (!response.ok && response.status !== 304)) return false;
  if (response.type !== "basic" && response.type !== "cors") return false;
  return true;
}

async function safeCachePut(request, responseClone) {
  try {
    if (!canCacheRequest(request, responseClone)) return;
    const cache = await caches.open(CACHE_NAME);
    await cache.put(request, responseClone.clone());
  } catch (error) {
    console.warn("SW cache put skipped:", request.url, error);
  }
}

function isAppPageRequest(request, url) {
  if (request.mode === "navigate") return true;
  if (request.headers.get("RSC") === "1") return true;
  if (url.searchParams.has("_rsc")) return true;
  if (request.headers.get("Accept")?.includes("text/html")) return true;
  return false;
}

async function cachePageAndItsNextAssets(cache, path) {
  try {
    const response = await fetch(path, { redirect: "follow" });
    if (!response || !response.ok) return;

    const html = await response.clone().text();

    await cache.put(
      path,
      new Response(html, {
        headers: { "Content-Type": "text/html; charset=utf-8" },
      })
    );

    const assetMatches = [
      ...html.matchAll(/(?:src|href)=["']([^"']*\/_next\/static\/[^"']+)["']/g),
    ];

    const assetUrls = Array.from(
      new Set(assetMatches.map((match) => new URL(match[1], self.location.origin).toString()))
    );

    await Promise.allSettled(
      assetUrls.map(async (assetUrl) => {
        try {
          const assetResponse = await fetch(assetUrl, { redirect: "follow" });
          if (assetResponse && assetResponse.ok) {
            await cache.put(assetUrl, assetResponse);
          }
        } catch (err) {
          console.warn("SW pre-cache asset failed:", assetUrl, err);
        }
      })
    );
  } catch (err) {
    console.warn("SW pre-cache page failed:", path, err);
  }
}

self.addEventListener("install", (event) => {
  event.waitUntil(
    (async () => {
      const cache = await caches.open(CACHE_NAME);

      // Pre-cache core static assets
      await Promise.all(
        STATIC_ASSETS.map(async (asset) => {
          try {
            const response = await fetch(asset, { redirect: "follow" });
            if (response && (response.ok || response.status === 304)) {
              await cache.put(asset, response);
            }
          } catch (err) {
            console.warn("PWA SW pre-cache asset warning:", asset, err);
          }
        })
      );

      // Cache offline routes and their Next.js JS/CSS chunks dynamically
      await cachePageAndItsNextAssets(cache, "/offline-teacher");
      await cachePageAndItsNextAssets(cache, "/offline-examiner");
      await cachePageAndItsNextAssets(cache, "/offline-manager");
      await cachePageAndItsNextAssets(cache, "/offline-login");
    })()
  );
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys.map((key) => {
          if (key !== CACHE_NAME) {
            console.log("PWA Service Worker removing outdated cache:", key);
            return caches.delete(key);
          }
        })
      );
    })
  );
  self.clients.claim();
});

self.addEventListener("fetch", (event) => {
  const { request } = event;
  let url;
  try {
    url = new URL(request.url);
  } catch {
    return;
  }

  if (url.protocol !== "http:" && url.protocol !== "https:") {
    return;
  }

  // Skip non-GET requests and API endpoints from PWA page cache
  if (request.method !== "GET" || url.pathname.startsWith("/api/")) {
    return;
  }

  // Strictly Network-Only for /manager routes
  if (url.pathname.startsWith("/manager")) {
    event.respondWith(
      (async () => {
        try {
          return await fetch(request);
        } catch {
          return new Response(OFFLINE_RESTRICTED_HTML, {
            headers: { "Content-Type": "text/html; charset=utf-8" },
          });
        }
      })()
    );
    return;
  }

  // Strategy for /offline-shell.html (Cache-First)
  if (url.pathname === "/offline-shell.html") {
    event.respondWith(
      (async () => {
        const cached = await caches.match(request);
        if (cached) return cached;
        try {
          const networkResponse = await fetch(request);
          if (networkResponse && networkResponse.ok) {
            safeCachePut(request, networkResponse.clone());
          }
          return networkResponse;
        } catch {
          return new Response("Offline shell unavailable", { status: 503 });
        }
      })()
    );
    return;
  }

  // Strategy for Next.js Static Chunks (/_next/static/*) -> Cache-First
  if (url.pathname.startsWith("/_next/static/")) {
    event.respondWith(
      (async () => {
        try {
          const cachedResponse = await caches.match(request, { ignoreSearch: true });
          if (cachedResponse) {
            return cachedResponse;
          }
          const networkResponse = await fetch(request);
          if (networkResponse && (networkResponse.ok || networkResponse.status === 304)) {
            safeCachePut(request, networkResponse.clone());
          }
          return networkResponse;
        } catch {
          const fallbackCached = await caches.match(request, { ignoreSearch: true });
          if (fallbackCached) return fallbackCached;

          return new Response("Network Error", {
            status: 408,
            headers: { "Content-Type": "text/plain; charset=utf-8" },
          });
        }
      })()
    );
    return;
  }

  // Strategy for App Shell & Page Navigations
  if (isAppPageRequest(request, url)) {
    event.respondWith(
      (async () => {
        try {
          const networkResponse = await fetch(request);
          if (networkResponse && (networkResponse.ok || networkResponse.status === 304)) {
            safeCachePut(request, networkResponse.clone());
          }
          return networkResponse;
        } catch {
          const cache = await caches.open(CACHE_NAME);

          // Dedicated offline teacher route fallback
          if (url.pathname.startsWith("/offline-teacher") || url.pathname.startsWith("/teacher")) {
            const fallback =
              (await cache.match("/offline-teacher")) ||
              (await cache.match("/teacher")) ||
              (await cache.match("/offline-shell.html"));
            if (fallback) return fallback;
          }

          // Dedicated offline examiner route fallback
          if (url.pathname.startsWith("/offline-examiner") || url.pathname.startsWith("/examiner")) {
            const fallback =
              (await cache.match("/offline-examiner")) ||
              (await cache.match("/examiner")) ||
              (await cache.match("/offline-shell.html"));
            if (fallback) return fallback;
          }

          // Dedicated offline manager route fallback
          if (url.pathname.startsWith("/offline-manager")) {
            const fallback =
              (await cache.match("/offline-manager")) ||
              (await cache.match("/offline-shell.html"));
            if (fallback) return fallback;
          }

          // Primary Offline Fallback for App Shell
          const offlineShellFallback =
            (await cache.match("/offline-shell.html")) ||
            (await cache.match("/offline-login")) ||
            (await cache.match("/login"));
          if (offlineShellFallback) return offlineShellFallback;

          return new Response(OFFLINE_RESTRICTED_HTML, {
            headers: { "Content-Type": "text/html; charset=utf-8" },
          });
        }
      })()
    );
    return;
  }

  // General Strategy for Static Assets (Images, Icons, Fonts)
  event.respondWith(
    (async () => {
      try {
        const cachedResponse = await caches.match(request, { ignoreSearch: true });
        if (cachedResponse) {
          fetch(request)
            .then((networkResponse) => {
              if (networkResponse && (networkResponse.ok || networkResponse.status === 304)) {
                safeCachePut(request, networkResponse.clone());
              }
            })
            .catch(() => {});
          return cachedResponse;
        }

        const networkResponse = await fetch(request);
        if (networkResponse && (networkResponse.ok || networkResponse.status === 304)) {
          safeCachePut(request, networkResponse.clone());
        }
        return networkResponse;
      } catch {
        return new Response("Service Unavailable", {
          status: 503,
          headers: { "Content-Type": "text/plain; charset=utf-8" },
        });
      }
    })()
  );
});
