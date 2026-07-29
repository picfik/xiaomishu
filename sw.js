const CACHE_VERSION = '20260729-3';
const CACHE = `life-pwa-pro-${CACHE_VERSION}`;
const ASSETS = ['./', './index.html', './style.css', './app.js', './sync.js', './reminder.js', './github.js', './manifest.json', './icon-192.png', './icon-512.png'];

self.addEventListener('install', e => {
    e.waitUntil(
        caches.open(CACHE).then(cache => cache.addAll(ASSETS)).then(() => self.skipWaiting())
    );
});

self.addEventListener('activate', e => {
    e.waitUntil(
        caches.keys().then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k))))
    ).then(() => self.clients.claim());
});

self.addEventListener('message', e => {
    if (e.data && e.data.type === 'SKIP_WAITING') {
        self.skipWaiting();
    }
});

self.addEventListener('fetch', e => {
    const { request } = e;
    if (request.method !== 'GET') return;

    const isHTML = request.mode === 'navigate' || request.destination === 'document';

    if (isHTML) {
        e.respondWith(
            fetch(request).then(res => {
                const copy = res.clone();
                caches.open(CACHE).then(cache => cache.put('./index.html', copy));
                return res;
            }).catch(() => caches.match('./index.html'))
        );
        return;
    }

    e.respondWith(
        caches.match(request).then(cached => {
            const network = fetch(request).then(res => {
                if (res && res.ok) {
                    const copy = res.clone();
                    caches.open(CACHE).then(cache => cache.put(request, copy));
                }
                return res;
            }).catch(() => cached);
            return cached || network;
        })
    );
});

// 通知点击 → 打开应用
self.addEventListener('notificationclick', e => {
    e.notification.close();
    e.waitUntil(
        clients.matchAll({ type: 'window' }).then(list => {
            for (const c of list) { if ('focus' in c) return c.focus(); }
            if (clients.openWindow) return clients.openWindow('./');
        })
    );
});
