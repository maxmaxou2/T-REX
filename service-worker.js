// Enregistrement du service worker et demande de permission pour la synchronisation en arrière-plan
if ('serviceWorker' in navigator && 'SyncManager' in window) {
    navigator.serviceWorker.register('/service-worker.js').then((registration) => {
      console.log('Service Worker registered with scope:', registration.scope);
    }).catch((error) => {
      console.log('Service Worker registration failed:', error);
    });
  }
  
  // Gestion de l'enregistrement du document lorsque l'utilisateur clique sur le bouton de soumission
  document.getElementById('submit-button').addEventListener('click', async () => {
    const documentContent = document.getElementById('document-content').value;
    const isOnline = navigator.onLine;
  
    if (isOnline) {
      // Si l'utilisateur est en ligne, essayer de soumettre le document directement
      try {
        await fetch('/submit-document', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({ content: documentContent })
        });
        console.log('Document submitted successfully.');
      } catch (error) {
        console.log('Failed to submit document:', error);
      }
    } else {
      // Si l'utilisateur est hors ligne, enregistrer un synchronisation en arrière-plan
      navigator.serviceWorker.ready.then((registration) => {
        registration.sync.register('sync-documents');
      });
    }
  });
  
  // Service Worker
  self.addEventListener('install', (event) => {
    // Étapes d'installation du service worker
    console.log('Service Worker installing.');
  });
  
  self.addEventListener('activate', (event) => {
    // Étapes d'activation du service worker
    console.log('Service Worker activating.');
  });
  
  self.addEventListener('fetch', (event) => {
    if (event.request.method === 'POST' && event.request.url.endsWith('/submit-document')) {
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
            return new Response(JSON.stringify({status: 'saved offline'}), {headers: {'Content-Type': 'application/json'}});
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
        await fetch('/submit-document', {
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
  