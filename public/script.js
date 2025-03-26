document.addEventListener('DOMContentLoaded', () => {
  if (window.location.pathname === '/view.html') {
    fetchNotes();
    document.getElementById('search-button').addEventListener('click', searchNotes);
  } else {
    setupForm();
  }
});

async function fetchNotes() {
  const response = await fetch('/api/notes');
  const data = await response.json();
  const notesList = document.getElementById('notes-list');
  notesList.innerHTML = data.notes.map(note => {
    console.log(note)
    content = note.content.trim();
    const contentPreview = content.length > 30 ? content.substring(0, 30) + '...' : content;

    return `
      <li class="note">
      <a href="/api/notes/${note.id}/pdf" target="_blank">
        <h3>${note.title}</h3>
        <div class="note-details">
          <p><strong>Nom:</strong> ${note.name}</p>
          <p><strong>Lieu:</strong> ${note.place}</p>
          <p><strong>Date:</strong> ${note.date}</p>
        </div>
        <p class="content-preview">${contentPreview}</p>
      </a>
      </li>
    `;
  }).join('');
}

async function searchNotes() {
  const title = document.getElementById('search-title').value.toLowerCase();
  const name = document.getElementById('search-name').value.toLowerCase();
  const place = document.getElementById('search-place').value.toLowerCase();
  const date = document.getElementById('search-date').value;

  const response = await fetch(`/api/search?title=${encodeURIComponent(title)}&name=${encodeURIComponent(name)}&place=${encodeURIComponent(place)}&date=${encodeURIComponent(date)}`);
  const data = await response.json();
  const notesList = document.getElementById('notes-list');

  notesList.innerHTML = data.notes.map(note => {
    content = note.content.trim();
    const contentPreview = content.length > 30 ? content.substring(0, 30) + '...' : content;

    return `
      <li class="note">
       
      <a href="/api/notes/${note.id}/pdf" target="_blank">
        <h3>${note.title}</h3>
        <div class="note-details">
          <p><strong>Nom:</strong> ${note.name}</p>
          <p><strong>Lieu:</strong> ${note.place}</p>
          <p><strong>Date:</strong> ${note.date}</p>
        </div>
        <p class="content-preview">${contentPreview}</p>
      </a>
      </li>
    `;
  }).join('');
}

function setupForm() {
  document.getElementById('textForm').addEventListener('submit', async event => {
      event.preventDefault();
      const title = document.getElementById('title').value;
      const name = document.getElementById('name').value;
      const place = document.getElementById('place').value;
      const date = document.getElementById('date').value;
      const content = CKEDITOR.instances.content.getData();
      await fetch('/api/notes', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ title, name, date, place, content })
      });
      form.reset();
      alert('Note saved');
  });
}

// // Enregistrement du service worker et demande de permission pour la synchronisation en arrière-plan
// if ('serviceWorker' in navigator && 'SyncManager' in window) {
//   navigator.serviceWorker.register('/service-worker.js').then((registration) => {
//     console.log('Service Worker registered with scope:', registration.scope);
//   }).catch((error) => {
//     console.log('Service Worker registration failed:', error);
//   });
// }

// // Gestion de l'enregistrement du document lorsque l'utilisateur clique sur le bouton de soumission
// document.getElementById('submit-button').addEventListener('click', async () => {
//   const documentContent = document.getElementById('document-content').value;
//   const isOnline = navigator.onLine;

//   if (isOnline) {
//     // Si l'utilisateur est en ligne, essayer de soumettre le document directement
//     try {
//       await fetch('/api/notes', {
//         method: 'POST',
//         headers: {
//           'Content-Type': 'application/json'
//         },
//         body: JSON.stringify({ content: documentContent })
//       });
//       console.log('Document submitted successfully.');
//     } catch (error) {
//       console.log('Failed to submit document:', error);
//     }
//   } else {
//     // Si l'utilisateur est hors ligne, enregistrer une synchronisation en arrière-plan
//     navigator.serviceWorker.ready.then((registration) => {
//       registration.sync.register('sync-documents');
//     });
//   }
// });
