/* Bad Salzuflen News — Hintergrund-Helfer für Mitteilungen.
   Zeigt eingehende Mitteilungen an und öffnet beim Antippen den Beitrag. */
self.addEventListener('install', function () { self.skipWaiting(); });
self.addEventListener('activate', function (e) { e.waitUntil(self.clients.claim()); });

self.addEventListener('push', function (e) {
  var d = {};
  try { d = e.data ? e.data.json() : {}; } catch (x) { d = { body: e.data ? e.data.text() : '' }; }
  var opts = {
    body: d.body || 'Neu auf Bad Salzuflen News',
    icon: 'assets/img/icon-192.png',
    badge: 'assets/img/badge-96.png',
    tag: d.tag || 'bsn',
    lang: 'de',
    data: { url: new URL(d.url || 'index.html', self.registration.scope).href }
  };
  if (d.image) opts.image = d.image;
  e.waitUntil(self.registration.showNotification(d.title || 'Bad Salzuflen News', opts));
});

self.addEventListener('notificationclick', function (e) {
  e.notification.close();
  var url = (e.notification.data && e.notification.data.url) || self.registration.scope;
  e.waitUntil(self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then(function (list) {
    for (var i = 0; i < list.length; i++) {
      if ('navigate' in list[i]) return list[i].navigate(url).then(function (c) { return c && c.focus(); });
    }
    return self.clients.openWindow(url);
  }));
});
