// sw.js - Service Worker con soporte mejorado para offline-first
const CACHE_NAME = 'peerreview-v3.0';
const API_CACHE_NAME = 'peerreview-api-v3.0';
const PDF_CACHE_NAME = 'peerreview-pdfs-v3.0';

const STATIC_ASSETS = [
    '/',
    '/index.html',
    '/manifest.json',
    '/db.js',
    '/js/core/app.js',
    '/js/core/sync-manager.js',
    '/js/core/conflict-resolver.js',
    '/js/core/comment-system.js',
    '/js/services/article-service.js',
    '/js/services/review-service.js',
    '/js/services/api-client.js',
    '/js/utils/network-detector.js',
    '/js/utils/uuid-generator.js',
    '/js/error-handler.js',
    '/js/loading-indicator.js',
    '/css/main.css',
    '/css/components.css',
    'https://unpkg.com/dexie@3.2.4/dist/dexie.min.js'
];

// Instalación
self.addEventListener('install', (event) => {
    console.log('[SW] Instalando v3.0...');
    event.waitUntil(
        Promise.all([
            caches.open(CACHE_NAME).then(cache => cache.addAll(STATIC_ASSETS)),
            self.skipWaiting()
        ])
    );
});

// Activación
self.addEventListener('activate', (event) => {
    console.log('[SW] Activando...');
    event.waitUntil(
        Promise.all([
            caches.keys().then(cacheNames => {
                return Promise.all(
                    cacheNames
                    .filter(name => name !== CACHE_NAME &&
                        name !== API_CACHE_NAME &&
                        name !== PDF_CACHE_NAME)
                    .map(name => caches.delete(name))
                );
            }),
            self.clients.claim()
        ])
    );
});

// Estrategias de cache
self.addEventListener('fetch', (event) => {
    const url = new URL(event.request.url);

    // Estrategia para API requests
    if (url.pathname.startsWith('/api/')) {
        event.respondWith(handleAPIRequest(event.request));
        return;
    }

    // Estrategia para PDFs
    if (url.pathname.endsWith('.pdf') || url.pathname.includes('/files/')) {
        event.respondWith(handlePDFRequest(event.request));
        return;
    }

    // Estrategia para assets estáticos
    if (url.origin === self.location.origin) {
        event.respondWith(handleStaticRequest(event.request));
        return;
    }

    // Por defecto: network-first
    event.respondWith(networkFirst(event.request));
});

// Manejo de API requests
async function handleAPIRequest(request) {
    try {
        // Intentar red primero
        const response = await fetch(request.clone());

        // Cachear respuesta exitosa
        if (response.ok) {
            const cache = await caches.open(API_CACHE_NAME);
            cache.put(request, response.clone());
        }

        return response;

    } catch (error) {
        // Fallback a cache
        const cached = await caches.match(request);
        if (cached) {
            return cached;
        }

        // Si es GET, devolver datos por defecto
        if (request.method === 'GET') {
            return new Response(JSON.stringify({
                offline: true,
                message: 'Datos no disponibles offline'
            }), {
                headers: { 'Content-Type': 'application/json' }
            });
        }

        // Para mutaciones offline, guardar para background sync
        if (request.method !== 'GET') {
            await queueOfflineRequest(request);
            return new Response(JSON.stringify({
                queued: true,
                message: 'Operación guardada para sincronización offline'
            }), {
                headers: { 'Content-Type': 'application/json' }
            });
        }

        throw error;
    }
}

// Manejo de PDFs
async function handlePDFRequest(request) {
    // Cache-first para PDFs
    const cached = await caches.match(request);
    if (cached) {
        return cached;
    }

    try {
        const response = await fetch(request);
        if (response.ok) {
            const cache = await caches.open(PDF_CACHE_NAME);
            cache.put(request, response.clone());
        }
        return response;
    } catch (error) {
        return new Response('PDF no disponible offline', { status: 404 });
    }
}

// Manejo de assets estáticos
async function handleStaticRequest(request) {
    const cached = await caches.match(request);
    if (cached) {
        return cached;
    }

    try {
        const response = await fetch(request);
        if (response.ok) {
            const cache = await caches.open(CACHE_NAME);
            cache.put(request, response.clone());
        }
        return response;
    } catch (error) {
        return new Response('Recurso no disponible', { status: 404 });
    }
}

// Estrategia network-first
async function networkFirst(request) {
    try {
        return await fetch(request);
    } catch (error) {
        const cached = await caches.match(request);
        return cached || new Response('Offline', { status: 503 });
    }
}

// Cola para requests offline
async function queueOfflineRequest(request) {
    const db = await openOfflineDB();
    const tx = db.transaction('offlineQueue', 'readwrite');
    const store = tx.objectStore('offlineQueue');

    await store.add({
        id: crypto.randomUUID(),
        url: request.url,
        method: request.method,
        headers: Array.from(request.headers.entries()),
        body: await request.clone().text(),
        timestamp: Date.now()
    });

    // Registrar para background sync
    await self.registration.sync.register('sync-offline');
}

// Background sync
self.addEventListener('sync', (event) => {
    if (event.tag === 'sync-offline') {
        event.waitUntil(processOfflineQueue());
    }
});

async function processOfflineQueue() {
    const db = await openOfflineDB();
    const tx = db.transaction('offlineQueue', 'readonly');
    const store = tx.objectStore('offlineQueue');
    const requests = await store.getAll();

    for (const req of requests) {
        try {
            const response = await fetch(req.url, {
                method: req.method,
                headers: new Headers(req.headers),
                body: req.body
            });

            if (response.ok) {
                const deleteTx = db.transaction('offlineQueue', 'readwrite');
                const deleteStore = deleteTx.objectStore('offlineQueue');
                await deleteStore.delete(req.id);
            }
        } catch (error) {
            console.error('Error procesando request offline:', error);
        }
    }
}

// Abrir IndexedDB para cola offline
async function openOfflineDB() {
    return new Promise((resolve, reject) => {
        const request = indexedDB.open('OfflineQueueDB', 1);

        request.onupgradeneeded = (event) => {
            const db = event.target.result;
            db.createObjectStore('offlineQueue', { keyPath: 'id' });
        };

        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
    });
}