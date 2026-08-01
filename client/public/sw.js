const CACHE = 'attendance-v2';
const URLS = ['/', '/manifest.json'];

// 立即激活新版本，不等待所有标签页关闭
self.addEventListener('install', (e) => {
  self.skipWaiting();
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(URLS)));
});

// 接管所有页面 + 清理旧缓存
self.addEventListener('activate', (e) => {
  e.waitUntil(
    (async () => {
      // 立即接管所有打开的页面
      await self.clients.claim();
      // 删除旧版本缓存
      const keys = await caches.keys();
      await Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)));
    })(),
  );
});

self.addEventListener('fetch', (e) => {
  const url = new URL(e.request.url);
  // 跳过子应用路径，避免拦截排班/收支/进销存/通讯录/API
  if (url.pathname.startsWith('/roster') ||
      url.pathname.startsWith('/finance') ||
      url.pathname.startsWith('/inventory') ||
      url.pathname.startsWith('/contacts') ||
      url.pathname.startsWith('/api') ||
      url.pathname.startsWith('/uploads')) {
    return;
  }
  e.respondWith(
    caches.match(e.request).then((r) => r || fetch(e.request)),
  );
});
