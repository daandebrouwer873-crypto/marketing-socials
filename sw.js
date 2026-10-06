// Bewaart de app-schil, zodat hij direct opent. Gegevens komen altijd vers van de server.
const CACHE = 'pellens-marketing-680cf6288d33';
const SCHIL = [
  './', 'index.html', 'app.css', 'app.js', 'config.js', 'manifest.json',
  'thema.js', 'thema-start.js',
  'lib/logica.js', 'lib/plan.js', 'lib/opslag.js', 'lib/upload.js', 'lib/spraak.js', 'lib/effecten.js', 'lib/onderwerpen.js', 'lib/iconen.js',
  'icons/icon-192.png', 'icons/monogram.svg',
];

self.addEventListener('install', event => {
  event.waitUntil(caches.open(CACHE).then(c => c.addAll(SCHIL)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys()
      .then(namen => Promise.all(namen.filter(n => n !== CACHE).map(n => caches.delete(n))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener('fetch', event => {
  const url = new URL(event.request.url);
  if (event.request.method !== 'GET' || url.origin !== location.origin || url.pathname.startsWith('/.netlify/')) return;
  // Eerst het netwerk, zodat een nieuwe versie direct zichtbaar is; zonder netwerk de bewaarde schil.
  event.respondWith(
    fetch(event.request)
      .then(antwoord => {
        if (antwoord.ok) {
          const kopie = antwoord.clone();
          caches.open(CACHE).then(c => c.put(event.request, kopie));
        }
        return antwoord;
      })
      .catch(() => caches.match(event.request).then(r => r || caches.match('index.html'))),
  );
});
