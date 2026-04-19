const CACHE_NAME = 'rin-player-cache-v5';

// キャッシュするローカルファイル
const ASSETS =[
  './index.html',
  './manifest.json',
  './character.png'
];

// インストール時にファイルをキャッシュ
self.addEventListener('install', (e) => {
  self.skipWaiting();
  e.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      // ファイルが存在しない場合（character.pngなど）でもエラーで止めないための処理
      return Promise.allSettled(ASSETS.map(url => cache.add(url)));
    })
  );
});

// 古いキャッシュを削除
self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key))
      );
    })
  );
});

// ネットワークリクエストの傍受
self.addEventListener('fetch', (e) => {
  // YouTube APIなどの外部通信はキャッシュから読まず、そのままネットワークへ通す
  if (!e.request.url.startsWith(self.location.origin)) {
    return;
  }
  
  // ローカルファイルはキャッシュ優先、なければネットワークから取得
  e.respondWith(
    caches.match(e.request).then((res) => res || fetch(e.request))
  );
});
