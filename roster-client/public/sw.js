const CACHE = 'roster-v2';
const URLS = ['/roster/', '/roster/manifest.json'];

// 立即激活新版本，不等待所有标签页关闭
self.addEventListener('install', (e) => {
  self.skipWaiting();
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(URLS)));
});

// 接管所有页面 + 清理旧缓存
self.addEventListener('activate', (e) => {
  e.waitUntil(
    (async () => {
      await self.clients.claim();
      const keys = await caches.keys();
      await Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)));
    })(),
  );
});

self.addEventListener('fetch', (e) => {
  e.respondWith(
    caches.match(e.request).then((r) => r || fetch(e.request)),
  );
});
