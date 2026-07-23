const CACHE_NAME = "qcm-pwa-v5";
const STATIC_ASSETS = [
  "/",
  "/login",
  "/teacher",
  "/examiner",
  "/manifest.json",
  "/brand/logo.png",
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
    <h1>هذه الصفحة تتطلب اتصالاً بالإنترنت</h1>
    <p>لوحة تحكم المدير، استخراج تقارير PDF/Excel وإدارة الحلقات غير متاحة في وضع العمل بدون إنترنت. تتاح خدمة العمل بدون إنترنت حصرياً لشاشة التسميع اليومية للشيخ وشاشة تسجيل الاختبارات الرسمية للمختبر.</p>
    <div class="actions">
      <a href="/teacher" class="btn">📖 وضع الشيخ (التسميع اليومي)</a>
      <a href="/examiner" class="btn btn-sky">📝 وضع المختبر (الاختبارات الرسمية)</a>
    </div>
  </div>
</body>
</html>
`;

function isCacheable(request, response, url) {
  if (!request || request.method !== "GET") return false;
  if (url.protocol !== "http:" && url.protocol !== "https:") return false;
  if (url.origin !== self.location.origin) return false;
  if (!response || response.status !== 200) return false;
  if (response.type !== "basic" && response.type !== "cors") return false;
  return true;
}

async function safeCachePut(request, response) {
  try {
    const url = new URL(request.url);
    if (!isCacheable(request, response, url)) return;

    const cache = await caches.open(CACHE_NAME);
    await cache.put(request, response.clone());
  } catch (error) {
    console.warn("SW cache put skipped:", request.url, error);
  }
}

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(STATIC_ASSETS).catch((err) => {
        console.warn("PWA Service Worker pre-cache warning:", err);
      });
    })
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
  const url = new URL(request.url);

  // Early filter: skip unsupported protocols (chrome-extension://, moz-extension://, devtools://, data:, blob:, etc.)
  if (url.protocol !== "http:" && url.protocol !== "https:") {
    return;
  }

  // Skip non-GET requests and API calls
  if (request.method !== "GET" || url.pathname.startsWith("/api/")) {
    return;
  }

  // Strategy for Next.js Static JS/CSS Chunks: Network-First to avoid stale assets
  if (url.pathname.startsWith("/_next/static/")) {
    event.respondWith(
      fetch(request)
        .then((networkResponse) => {
          if (networkResponse && networkResponse.status === 200) {
            safeCachePut(request, networkResponse);
          }
          return networkResponse;
        })
        .catch(() => caches.match(request))
    );
    return;
  }

  // Strategy for static shell pages & public assets
  event.respondWith(
    caches.match(request).then((cachedResponse) => {
      if (cachedResponse) {
        // Refresh cache in background when online
        fetch(request)
          .then((networkResponse) => {
            if (networkResponse && networkResponse.status === 200) {
              safeCachePut(request, networkResponse);
            }
          })
          .catch(() => {});
        return cachedResponse;
      }

      return fetch(request)
        .then((networkResponse) => {
          if (networkResponse && networkResponse.status === 200) {
            safeCachePut(request, networkResponse);
          }
          return networkResponse;
        })
        .catch(() => {
          // Navigation Fallback when offline
          if (request.mode === "navigate") {
            if (url.pathname.startsWith("/teacher")) {
              return caches.match("/teacher") || caches.match("/");
            }
            if (url.pathname.startsWith("/examiner")) {
              return caches.match("/examiner") || caches.match("/");
            }
            if (url.pathname.startsWith("/login")) {
              return caches.match("/login") || caches.match("/");
            }
            if (url.pathname.startsWith("/manager")) {
              return caches.match(request).then((cached) => {
                if (cached) return cached;
                return new Response(OFFLINE_RESTRICTED_HTML, {
                  headers: { "Content-Type": "text/html; charset=utf-8" },
                });
              });
            }
            return caches.match("/teacher") || caches.match("/examiner") || caches.match("/login");
          }
        });
    })
  );
});
