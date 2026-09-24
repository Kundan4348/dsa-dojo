// sw.js — precache the shell; network-first for data/ so authored content updates without a release.
const CACHE = 'dojo-v2';
const SHELL = [
  './', './index.html', './manifest.json', './css/app.css',
  './js/app.js', './js/db.js', './js/drill.js', './js/log.js', './js/patterns.js', './js/md.js', './js/hl.js',
  './js/recall.js', './js/contests.js', './js/mock.js', './js/schedule.js',
  './icons/icon.svg', './icons/icon-192.png', './icons/icon-512.png',
  './data/patterns/index.json', './data/contests.json',
];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(SHELL)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (e) => {
  e.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))).then(() => self.clients.claim()));
});

self.addEventListener('fetch', (e) => {
  const url = new URL(e.request.url);
  if (e.request.method !== 'GET' || url.origin !== location.origin) return;
  if (url.pathname.includes('/data/')) {
    // network-first, fall back to cache when offline
    e.respondWith(fetch(e.request).then(res => { const copy = res.clone(); caches.open(CACHE).then(c => c.put(e.request, copy)); return res; }).catch(() => caches.match(e.request)));
    return;
  }
  // shell: cache-first, refresh in background
  e.respondWith(caches.match(e.request).then(hit => {
    const net = fetch(e.request).then(res => { if (res.ok) caches.open(CACHE).then(c => c.put(e.request, res.clone())); return res; }).catch(() => hit);
    return hit || net;
  }));
});
