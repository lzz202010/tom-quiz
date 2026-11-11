/* e2 离线注册:三个入口(真题 / 作文 / 生词本)任意一页打开都会装壳。
   原先只在 app.js 注册,直接打开 writing.html / vocab.html 没有离线能力。 */
(function () {
  if (!('serviceWorker' in navigator)) return;
  if (location.protocol === 'file:') return;
  window.addEventListener('load', function () {
    navigator.serviceWorker.register('sw.js').catch(function () {});
  });
})();
