const express = require('express');
const bodyParser = require('body-parser');
const sqlite3 = require('sqlite3').verbose();
const tf = require('@tensorflow/tfjs');
const use = require('@tensorflow-models/universal-sentence-encoder');
const PDFDocument = require('pdfkit');
const app = express();
const db = new sqlite3.Database('./data/notes.db');

app.use(bodyParser.json());
app.use(express.static('public', {
  setHeaders: (res, path) => {
    if (path.endsWith('.css')) {
      res.setHeader('Content-Type', 'text/css');
    }
  }
}));

// Charger le modèle USE une fois au démarrage du serveur
let model;

// Function to load the model
async function loadModel() {
  model = await use.load();
  console.log('USE model loaded');
}

// Load the model and then start the server
loadModel().then(() => {
  app.listen(3000, () => {
    console.log('Server running on http://localhost:3000');
  });
});

function removeTags(str) {
  if ((str === null) || (str === ''))
      return false;
  else
      str = str.toString();

  // Regular expression to identify HTML tags in
  // the input string. Replacing the identified
  // HTML tag with a null string.
  return str.replace(/(<([^>]+)>)/ig, '');
}

db.serialize(() => {
  db.run("CREATE TABLE IF NOT EXISTS notes (id INTEGER PRIMARY KEY AUTOINCREMENT, title TEXT, name TEXT, date TEXT, place TEXT, content TEXT, embedding TEXT)");
});

app.get('/api/notes', (req, res) => {
  db.all("SELECT * FROM notes", (err, rows) => {
    if (err) {
      res.status(500).json({ error: err.message });
      return;
    }
    res.json({ notes: rows });
  });
});

app.post('/api/notes', async (req, res) => {
  const { title, name, date, place, content } = req.body;

  db.run("INSERT INTO notes (title, name, date, place, content) VALUES (?, ?, ?, ?, ?)", [title, name, date, place, content], function(err) {
    if (err) {
      res.status(500).json({ error: err.message });
      return;
    }

    // Recalculate embeddings for all notes
    recalculateEmbeddings().then(() => {
      res.json({ id: this.lastID, message: 'Note uploaded successfully!' });
    }).catch(error => {
      res.status(500).json({ error: error.message });
    });
  });
});

app.get('/api/search', async (req, res) => {
  
  const { title, name, place, date } = req.query;
  const q = title;
  const queryEmbedding = (await model.embed([q])).arraySync()[0];
  
  let query = "SELECT * FROM notes WHERE 1=1";
  const params = [];
  if (name) {
      query += " AND LOWER(name) LIKE ?";
      params.push(`%${name.toLowerCase()}%`);
  }
  if (place) {
      query += " AND LOWER(place) LIKE ?";
      params.push(`%${place.toLowerCase()}%`);
  }
  if (date) {
      query += " AND date = ?";
      params.push(date);
  }
  db.all(query, params, (err, rows) => {
    if (err) {
      res.status(500).json({ error: err.message });
      return;
    }

    const similarities = rows.map(row => {
      const noteEmbedding = JSON.parse(row.embedding);
      const similarity = cosineSimilarity(queryEmbedding, noteEmbedding);
      return { ...row, similarity };
    });

    similarities.sort((a, b) => b.similarity - a.similarity);

    res.json({ notes: similarities.slice(0, 10) }); // Return top 10 results
  });
});

async function recalculateEmbeddings() {
  return new Promise((resolve, reject) => {
    db.all("SELECT id, title, name, date, place, content FROM notes", async (err, rows) => {
      if (err) {
        return reject(err);
      }

      const texts = rows.map(row => `${row.title} ${row.name} ${row.date} ${row.place} ${row.content}`);
      const embeddings = await model.embed(texts);
      const embeddingArrays = embeddings.arraySync();

      const updates = rows.map((row, index) => {
        const embeddingString = JSON.stringify(embeddingArrays[index]);
        return new Promise((resolve, reject) => {
          db.run("UPDATE notes SET embedding = ? WHERE id = ?", [embeddingString, row.id], function(err) {
            if (err) {
              return reject(err);
            }
            resolve();
          });
        });
      });

      Promise.all(updates).then(resolve).catch(reject);
    });
  });
}

function cosineSimilarity(vecA, vecB) {
  const dotProduct = vecA.reduce((sum, a, idx) => sum + a * vecB[idx], 0);
  const normA = Math.sqrt(vecA.reduce((sum, a) => sum + a * a, 0));
  const normB = Math.sqrt(vecB.reduce((sum, b) => sum + b * b, 0));
  return dotProduct / (normA * normB);
}


// Route to generate PDF
app.get('/api/notes/:id/pdf', (req, res) => {
    const noteId = req.params.id;

    db.get("SELECT * FROM notes WHERE id = ?", [noteId], (err, row) => {
        if (err || !row) {
            res.status(404).json({ error: "Note not found" });
            return;
        }

        const doc = new PDFDocument();
        res.setHeader('Content-Disposition', `attachment; filename=note_${noteId}.pdf`);
        res.setHeader('Content-Type', 'application/pdf');

        doc.pipe(res);
        doc.fontSize(25).text(row.title, { align: 'center' });
        doc.moveDown();
        doc.fontSize(18).text(`Nom: ${row.name}`);
        doc.text(`Lieu: ${row.place}`);
        doc.text(`Date: ${row.date}`);
        doc.moveDown();
        doc.fontSize(12).text(row.content);
        doc.end();
    });
});