// Service worker de "Mi Tienda de Barrio": permite instalarla y usarla sin internet.
const CACHE = 'mi-tienda-v3';
const CORE = ['./tienda-barrio.html', './manifest.webmanifest', './icons/icon-192.png', './icons/icon-512.png', './icons/icon-maskable-512.png', './catalogo-referencia.json'];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(CORE)));
  self.skipWaiting();
});

self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))));
  self.clients.claim();
});

const save = (req, res) => { if (res.ok) { const copy = res.clone(); caches.open(CACHE).then(c => c.put(req, copy)); } return res; };

self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin === self.location.origin) {
    // Primero internet (para recibir actualizaciones); sin conexión, lo guardado.
    // 'no-cache' pide siempre al servidor si hay versión nueva (las mejoras llegan apenas se publican).
    e.respondWith(fetch(req.url, { cache: 'no-cache', credentials: 'same-origin' }).then(res => save(req, res))
      .catch(() => caches.match(req, { ignoreSearch: true })));
  } else if (url.hostname === 'unpkg.com') {
    // Lector de códigos para iPhone: se guarda la primera vez que se descarga.
    e.respondWith(caches.match(req).then(hit => hit || fetch(req).then(res => save(req, res))));
  }
});
