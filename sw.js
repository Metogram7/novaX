const CACHE_NAME = 'nova-cache-v3';
const filesToCache = [
  '/',
  '/index.html',
  '/style.css',
  '/script.js',
  '/Gemini_Generated_Image_n3cqe4n3cqe4n3cq.png'
];

// Kurulum
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(filesToCache);
    })
  );
});

// Aktifleştirme & Temizleme
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.map(key => {
        if (key !== CACHE_NAME) return caches.delete(key);
      }))
    )
  );
});

// Fetch (İstek Yakalama)
self.addEventListener('fetch', (event) => {
  event.respondWith(
    caches.match(event.request).then((response) => {
      return response || fetch(event.request);
    })
  );
});