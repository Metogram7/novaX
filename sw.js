const CACHE_NAME = 'nova-browser-v1';
const urlsToCache = [
  './',
  './index.html',
  './style.css',
  './script.js',
  './Gemini_Generated_Image_n3cqe4n3cqe4n3cq.png'
];

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => cache.addAll(urlsToCache))
  );
});

self.addEventListener('fetch', event => {
  event.respondWith(
    caches.match(event.request)
      .then(response => response || fetch(event.request))
  );
});