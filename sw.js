// ============================================
// SGE-NG SERVICE WORKER
// Responsável por: Cache offline, intercetação
// de requests e funcionamento sem internet
// ============================================

const CACHE_NAME = 'sge-ng-cache-v1';
const DATA_CACHE_NAME = 'sge-ng-data-cache-v1';

// Ficheiros essenciais que devem ser cacheados para funcionamento offline
const STATIC_ASSETS = [
  '/',
  '/index.html',
  '/css/styles.css',
  '/manifest.json',
  // Core JS
  '/js/core/utils.js',
  '/js/core/crypto.js',
  '/js/core/firebase-config.js',
  '/js/core/db-service.js',
  '/js/core/sync-service.js',
  '/js/core/security-engine.js',
  '/js/core/recovery-engine.js',
  '/js/core/auth-service.js',
  '/js/core/router.js',
  '/js/core/app.js',
  // UI
  '/js/ui/components.js',
  '/js/ui/sidebar.js',
  '/js/ui/notifications.js',
  '/js/ui/charts.js',
  // Módulos
  '/js/modules/setup-wizard.js',
  '/js/modules/dashboard.js',
  // CDN essenciais (serão cacheados na primeira visita)
];

// URLs de CDN que devem ser cacheados
const CDN_URLS = [
  'https://cdn.tailwindcss.com',
  'https://cdn.jsdelivr.net/npm/chart.js@4.4.7/dist/chart.umd.min.js',
  'https://cdn.jsdelivr.net/npm/xlsx@0.18.5/dist/xlsx.full.min.js',
  'https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js',
];

// ============================================
// EVENTO: INSTALL
// Cachear todos os recursos estáticos
// ============================================
self.addEventListener('install', (event) => {
  console.log('[SW] A instalar Service Worker...');
  event.waitUntil(
    caches.open(CACHE_NAME)
    .then((cache) => {
      console.log('[SW] A cachear recursos estáticos...');
      // Cache dos ficheiros locais (ignorar falhas individuais)
      const cachePromises = STATIC_ASSETS.map(url => {
        return cache.add(url).catch(err => {
          console.warn(`[SW] Falha ao cachear: ${url}`, err.message);
        });
      });
      return Promise.all(cachePromises);
    })
    .then(() => {
      console.log('[SW] Instalação concluída');
      return self.skipWaiting();
    })
  );
});

// ============================================
// EVENTO: ACTIVATE
// Limpar caches antigos
// ============================================
self.addEventListener('activate', (event) => {
  console.log('[SW] A ativar Service Worker...');
  event.waitUntil(
    caches.keys()
    .then((cacheNames) => {
      return Promise.all(
        cacheNames
        .filter(name => name !== CACHE_NAME && name !== DATA_CACHE_NAME)
        .map(name => {
          console.log(`[SW] A remover cache antigo: ${name}`);
          return caches.delete(name);
        })
      );
    })
    .then(() => {
      console.log('[SW] Ativação concluída');
      return self.clients.claim();
    })
  );
});

// ============================================
// EVENTO: FETCH
// Estratégia: Network First com fallback para Cache
// Para API/Firebase: Network Only (dados geridos por IndexedDB)
// Para assets estáticos: Cache First com Network fallback
// ============================================
self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);
  
  // Ignorar requests que não são GET
  if (event.request.method !== 'GET') return;
  
  // Ignorar requests do Firebase (geridos pelo SDK + IndexedDB)
  if (url.hostname.includes('firebaseio.com') ||
    url.hostname.includes('googleapis.com') ||
    url.hostname.includes('firestore.googleapis.com') ||
    url.hostname.includes('firebasestorage.googleapis.com') ||
    url.hostname.includes('gstatic.com')) {
    
    // Para scripts do Firebase SDK, usar Cache First
    if (url.hostname.includes('gstatic.com')) {
      event.respondWith(
        caches.match(event.request)
        .then(response => {
          if (response) return response;
          return fetch(event.request)
            .then(networkResponse => {
              if (networkResponse && networkResponse.status === 200) {
                const cloned = networkResponse.clone();
                caches.open(CACHE_NAME).then(cache => {
                  cache.put(event.request, cloned);
                });
              }
              return networkResponse;
            })
            .catch(() => {
              return caches.match(event.request);
            });
        })
      );
      return;
    }
    return;
  }
  
  // Para CDNs conhecidos: Cache First, depois Network
  if (CDN_URLS.some(cdn => event.request.url.startsWith(cdn)) ||
    url.hostname.includes('cdn.')) {
    event.respondWith(
      caches.match(event.request)
      .then(response => {
        if (response) return response;
        return fetch(event.request)
          .then(networkResponse => {
            if (networkResponse && networkResponse.status === 200) {
              const cloned = networkResponse.clone();
              caches.open(CACHE_NAME).then(cache => {
                cache.put(event.request, cloned);
              });
            }
            return networkResponse;
          });
      })
    );
    return;
  }
  
  // Para ficheiros da aplicação: Network First, fallback Cache
  event.respondWith(
    fetch(event.request)
    .then((networkResponse) => {
      // Se a resposta é válida, guardar no cache e devolver
      if (networkResponse && networkResponse.status === 200) {
        const cloned = networkResponse.clone();
        caches.open(CACHE_NAME).then((cache) => {
          cache.put(event.request, cloned);
        });
      }
      return networkResponse;
    })
    .catch(() => {
      // Sem internet - tentar o cache
      return caches.match(event.request)
        .then((cachedResponse) => {
          if (cachedResponse) return cachedResponse;
          // Se é uma navegação, devolver o index.html cacheado (SPA)
          if (event.request.mode === 'navigate') {
            return caches.match('/index.html');
          }
          return new Response('Offline', {
            status: 503,
            statusText: 'Sem Ligação à Internet'
          });
        });
    })
  );
});

// ============================================
// EVENTO: MESSAGE
// Comunicação com a aplicação principal
// ============================================
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
  
  if (event.data && event.data.type === 'CLEAR_CACHE') {
    caches.keys().then(names => {
      names.forEach(name => caches.delete(name));
    });
  }
  
  if (event.data && event.data.type === 'CACHE_URLS') {
    const urls = event.data.urls || [];
    caches.open(CACHE_NAME).then(cache => {
      urls.forEach(url => {
        cache.add(url).catch(() => {});
      });
    });
  }
});

// ============================================
// EVENTO: SYNC (Background Sync)
// Sincronizar dados pendentes quando a internet voltar
// ============================================
self.addEventListener('sync', (event) => {
  if (event.tag === 'sge-sync-pending') {
    console.log('[SW] Background sync ativado');
    event.waitUntil(
      // Notificar a aplicação para sincronizar
      self.clients.matchAll().then(clients => {
        clients.forEach(client => {
          client.postMessage({
            type: 'SYNC_REQUESTED',
            timestamp: Date.now()
          });
        });
      })
    );
  }
});