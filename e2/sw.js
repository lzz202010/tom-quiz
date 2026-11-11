/* e2 离线缓存:地铁上没信号也能做题、看作文、查生词本。
   · 壳(三页 HTML + 首屏 CSS/JS + 词表)安装时一次缓存,约 0.8 MB
   · 逐年题库 d/*.js、图表 figs/*、标注 ann/* 用到哪年缓存哪年
   · PDF / 其它大文件不进缓存,避免占满手机配额;Range 请求不拦截
   · 页面导航走网络优先,上线后能拿到新页面;断网回退到缓存
   · 改站后 CACHE 要 +1(用 scripts/e2/bump_version.py --bump 一并同步 ?v=) */
const CACHE = 'e2-v16';
const CORE = [
  './', './index.html', './vocab.html', './writing.html',
  './style.css', './favicon.svg', './sw-reg.js',
  './vocab.js', './gloss.js', './data.js', './app.js',
  './gloss-data.js', './words.js', './autocomplete.js', './vocab-page.js',
  './writing-data.js', './writing.js'
];
const CACHEABLE = /\.(?:html|css|js|json|webp|png|jpe?g|gif|svg|woff2?|ico)$/i;
const abs = u => new URL(u, self.registration.scope).href;

/* 静态资源忽略 ?v= 版本参数:缓存里的一份,所有版本都能命中 */
const assetKey = u => { const x = new URL(u); x.searchParams.delete('v'); return x.href; };
/* 导航连 ?y=2025 / ?u= 也忽略,同一页面只存一份 */
const navKey = u => { const x = new URL(u); x.search = ''; return x.href; };

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE)
    .then(c => Promise.allSettled(
      CORE.map(u => c.add(new Request(abs(u), { cache: 'reload' })))))
    .then(() => self.skipWaiting()));
});

self.addEventListener('activate', e => {
  e.waitUntil((async () => {
    const ks = await caches.keys();
    await Promise.all(ks.filter(k => k !== CACHE).map(k => caches.delete(k)));
    /* install 时个别资源若请求失败,激活阶段补回来,避免离线缺文件 */
    const c = await caches.open(CACHE);
    await Promise.allSettled(CORE.map(async u => {
      const key = abs(u);
      if (await c.match(key)) return;
      try { await c.add(new Request(key, { cache: 'reload' })); } catch (_) {}
    }));
    await self.clients.claim();
  })());
});

self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET' || req.headers.has('range')) return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;
  if (!CACHEABLE.test(url.pathname) && !url.pathname.endsWith('/')) return;
  e.respondWith(req.mode === 'navigate' ? nav(req) : asset(req));
});

async function nav(req) {
  const c = await caches.open(CACHE);
  const key = navKey(req.url);
  const fallback = async () => (await c.match(key)) || (await c.match(abs('./index.html')))
    || new Response('离线,且该页面尚未缓存', {
      status: 503, headers: { 'Content-Type': 'text/plain; charset=utf-8' }
    });
  try {
    const res = await fetch(req);
    if (res && res.ok) {
      c.put(key, res.clone()).catch(() => {});
      return res;
    }
    return await fallback();          // 服务端 4xx/5xx 时也别把用户卡在错误页
  } catch (_) {
    return await fallback();
  }
}

async function asset(req) {
  const c = await caches.open(CACHE);
  const key = assetKey(req.url);
  const hit = await c.match(key);
  if (hit) return hit;
  try {
    const res = await fetch(req);
    if (res && res.ok && res.type === 'basic') c.put(key, res.clone()).catch(() => {});
    return res;
  } catch (_) {
    return new Response('', { status: 504, statusText: 'Offline' });
  }
}
