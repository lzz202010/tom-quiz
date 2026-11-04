/* Ultimate 离线缓存。CACHE 由 scripts/build_ultimate.py 每次构建自动改写(带版本号的资源变了,旧缓存整体作废)。
   带 ?v= 的脚本/样式/题库:缓存优先(秒开);页面:网络优先,断网用缓存;题图、字体、公式库:缓存优先;
   AI 接口(其他域名)不经过这里。 */
const CACHE = 'ult-261104214120';
self.addEventListener('install', function () { self.skipWaiting(); });
self.addEventListener('activate', function (e) {
  e.waitUntil(caches.keys().then(function (ks) {
    return Promise.all(ks.filter(function (k) { return k.indexOf('ult-') === 0 && k !== CACHE; }).map(function (k) { return caches.delete(k); }));
  }).then(function () { return self.clients.claim(); }));
});
self.addEventListener('fetch', function (e) {
  const r = e.request, u = new URL(r.url);
  if (r.method !== 'GET' || u.origin !== location.origin) return;
  if (/\/ai-key\.js$/.test(u.pathname)) return;              // 本地内置 Key 不进缓存
  e.respondWith(caches.open(CACHE).then(function (c) {
    return c.match(r).then(function (hit) {
      const net = fetch(r.mode === 'navigate' ? new Request(u.href, { cache: 'no-cache', credentials: 'same-origin' }) : r).then(function (res) {
        if (res.ok && res.type === 'basic') c.put(r, res.clone());
        return res;
      }).catch(function () { return hit || Response.error(); });
      return r.mode === 'navigate' ? net.then(function (res) { return res.ok ? res : (hit || res); }) : (hit || net);
    });
  }));
});
