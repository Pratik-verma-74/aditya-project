const V = 'esa-v9';
const SHELL = ['./', './index.html', './manifest.json', './offline.html', './icons/icon-192.png', './icons/icon-512.png', './icons/maskable-512.png'];

self.addEventListener('install', e => {
  self.skipWaiting();
  e.waitUntil(
    caches.open(V).then(c => {
      return Promise.allSettled(
        SHELL.map(url => c.add(url).catch(err => console.warn('Cache add failed for', url, err)))
      );
    })
  );
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => k.startsWith('esa-') && k !== V).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('message', e => {
  if (e.data === 'SKIP_WAITING') self.skipWaiting();
});

// Push notification handler — shows notification even when app/browser tab is closed
self.addEventListener('push', e => {
  let title = 'Exam Saathi Aditya';
  let body = 'Aaj ka study target shuru karein. Apni checklist complete karein.';
  let data = {};
  try {
    if (e.data) {
      const payload = e.data.json();
      title = payload.title || title;
      body = payload.body || body;
      data = payload.data || {};
    }
  } catch (err) {
    // If not JSON, use as plain text body
    try { body = e.data.text() || body; } catch (er) {}
  }
  e.waitUntil(
    self.registration.showNotification(title, {
      body,
      icon: './icons/icon-192.png',
      badge: './icons/icon-192.png',
      vibrate: [200, 100, 200],
      tag: 'exam-saathi-reminder',
      renotify: true,
      data
    })
  );
});

// When user taps the notification, open the app
self.addEventListener('notificationclick', e => {
  e.notification.close();
  e.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then(list => {
      for (const c of list) {
        if (c.url.includes('index.html') || c.url.endsWith('/')) {
          return c.focus();
        }
      }
      return clients.openWindow('./');
    })
  );
});

self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET' || req.headers.has('range')) return;
  const url = new URL(req.url);
  if (url.origin !== location.origin) return; // external sites / PDFs go straight to the network

  if (req.mode === 'navigate') {
    e.respondWith(
      fetch(req)
        .then(res => {
          if (res && res.ok) { const copy = res.clone(); caches.open(V).then(c => c.put('./index.html', copy)); }
          return res;
        })
        .catch(() => caches.match('./index.html').then(r => r || caches.match('./offline.html')))
    );
    return;
  }

  e.respondWith(
    caches.match(req).then(cached => {
      const net = fetch(req).then(res => {
        if (res && res.ok) { const copy = res.clone(); caches.open(V).then(c => c.put(req, copy)); }
        return res;
      }).catch(() => cached);
      return cached || net;
    })
  );
});
