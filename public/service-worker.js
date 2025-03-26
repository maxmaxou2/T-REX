// Service Worker

self.addEventListener('install', event => {
  // Cache les fichiers essentiels à l'installation du service worker
  event.waitUntil(
    caches.open('v1').then(cache => {
      return cache.addAll([
        '/',
        '/index.html',
        '/view.html',
        '/styles.css',
        '/script.js',
        '/manifest.json',
        '/icons/icon-192x192.png',
        '/icons/icon-512x512.png'
      ]);
    })
  );
});

self.addEventListener('fetch', event => {
  // Répond avec des ressources mises en cache ou effectue une requête réseau si la ressource n'est pas en cache
  event.respondWith(
    caches.match(event.request).then(response => {
      return response || fetch(event.request);
    })
  );
});

self.addEventListener('fetch', event => {
  if (event.request.method === 'POST' && event.request.url.endsWith('/api/notes')) {
    event.respondWith(
      (async () => {
        try {
          // Essayer d'envoyer la requête si en ligne
          const response = await fetch(event.request);
          return response;
        } catch (error) {
          // Si hors ligne, sauvegarder le document dans IndexedDB
          const clonedRequest = event.request.clone();
          const requestBody = await clonedRequest.json();
          saveToIndexedDB('offline-documents', requestBody);
          return new Response(JSON.stringify({ status: 'saved offline' }), { headers: { 'Content-Type': 'application/json' } });
        }
      })()
    );
  }
});

// Fonction pour sauvegarder des données dans IndexedDB
function saveToIndexedDB(storeName, data) {
  const request = indexedDB.open('documentsDB', 1);

  request.onupgradeneeded = (event) => {
    const db = event.target.result;
    db.createObjectStore(storeName, { autoIncrement: true });
  };

  request.onsuccess = (event) => {
    const db = event.target.result;
    const transaction = db.transaction(storeName, 'readwrite');
    const store = transaction.objectStore(storeName);
    store.add(data);
  };
}

// Écouteur pour la synchronisation en arrière-plan
self.addEventListener('sync', (event) => {
  if (event.tag === 'sync-documents') {
    event.waitUntil(syncDocuments());
  }
});

// Fonction pour synchroniser les documents en local avec le serveur
async function syncDocuments() {
  const documents = await getDocumentsFromIndexedDB('offline-documents');
  for (const doc of documents) {
    try {
      await fetch('/api/notes', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(doc)
      });
      removeDocumentFromIndexedDB('offline-documents', doc.id);
    } catch (error) {
      console.log('Failed to sync document:', error);
    }
  }
}

// Fonction pour récupérer les documents depuis IndexedDB
function getDocumentsFromIndexedDB(storeName) {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open('documentsDB', 1);

    request.onsuccess = (event) => {
      const db = event.target.result;
      const transaction = db.transaction(storeName, 'readonly');
      const store = transaction.objectStore(storeName);
      const documents = [];
      store.openCursor().onsuccess = (event) => {
        const cursor = event.target.result;
        if (cursor) {
          documents.push(cursor.value);
          cursor.continue();
        } else {
          resolve(documents);
        }
      };
    };

    request.onerror = (event) => {
      reject('Failed to retrieve documents:', event);
    };
  });
}

// Fonction pour supprimer un document de IndexedDB
function removeDocumentFromIndexedDB(storeName, id) {
  const request = indexedDB.open('documentsDB', 1);

  request.onsuccess = (event) => {
    const db = event.target.result;
    const transaction = db.transaction(storeName, 'readwrite');
    const store = transaction.objectStore(storeName);
    store.delete(id);
  };
}
