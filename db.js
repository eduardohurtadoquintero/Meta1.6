// Configuración de base de datos con Dexie.js
const db = new Dexie('PeerReviewDB');

db.version(1).stores({
  articles: 'id, status, createdAt, *assignedReviewers, area, authorEmail',
  reviewers: 'id, email, *expertise, *assignedArticles',
  reviews: 'id, articleId, reviewerId, status, submittedAt'
});

// Seed de revisores (solo primera vez)
db.on('populate', () => {
  db.reviewers.bulkAdd([
    {
      id: crypto.randomUUID(),
      name: "Dra. Ana Rodríguez",
      email: "ana.rodriguez@universidad.edu",
      expertise: ["AI", "ML"],
      assignedArticles: []
    },
    {
      id: crypto.randomUUID(),
      name: "Dr. Carlos Martínez",
      email: "carlos.martinez@universidad.edu",
      expertise: ["DataScience", "IoT"],
      assignedArticles: []
    },
    {
      id: crypto.randomUUID(),
      name: "Dr. Luis Fernández",
      email: "luis.fernandez@universidad.edu",
      expertise: ["Cybersecurity", "SoftwareEngineering"],
      assignedArticles: []
    },
    {
      id: crypto.randomUUID(),
      name: "Dra. María González",
      email: "maria.gonzalez@universidad.edu",
      expertise: ["AI", "DataScience"],
      assignedArticles: []
    },
    {
      id: crypto.randomUUID(),
      name: "Dr. Roberto Silva",
      email: "roberto.silva@universidad.edu",
      expertise: ["ML", "IoT"],
      assignedArticles: []
    }
  ]);
  
  console.log('✅ Base de datos inicializada con 5 revisores de prueba');
});

export { db };
