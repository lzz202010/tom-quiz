/* 离线缓存:静态资源优先走缓存(秒开),页面与脚本后台更新 */
const CACHE = 'gzb-v2';
self.addEventListener('install', function () { self.skipWaiting(); });
self.addEventListener('activate', function (e) {
  e.waitUntil(caches.keys().then(function (ks) {
    return Promise.all(ks.filter(function (k) { return k !== CACHE; }).map(function (k) { return caches.delete(k); }));
  }).then(function () { return self.clients.claim(); }));
});
self.addEventListener('fetch', function (e) {
  const r = e.request, u = new URL(r.url);
  if (r.method !== 'GET' || u.origin !== location.origin) return;
  e.respondWith(caches.open(CACHE).then(function (c) {
    return c.match(r).then(function (hit) {
      // 页面本身每次都向服务器确认(no-cache),否则浏览器的启发式缓存可能给出旧页面、引用旧版本的脚本
      const net = fetch(r.mode === 'navigate' ? new Request(u.href, { cache: 'no-cache', credentials: 'same-origin' }) : r).then(function (res) {
        if (res.ok) c.put(r, res.clone());
        return res;
      }).catch(function () { return hit || Response.error(); });
      // 页面导航优先走网络(失败回退缓存);其余先用缓存、后台刷新
      return r.mode === 'navigate' ? net : (hit || net);
    });
  }));
});
