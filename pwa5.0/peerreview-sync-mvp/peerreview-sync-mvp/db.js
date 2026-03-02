// Configuración de base de datos con Dexie.js - Versión con Sync

const db = new Dexie('PeerReviewDB_Sync');

db.version(1).stores({
  articles: 'id, status, createdAt, *assignedReviewers, area, authorId, synced',
  reviewers: 'id, email, *expertise, *assignedArticles',
  reviews: 'id, articleId, reviewerId, status, submittedAt, synced',
  users: 'id, email, role, name',
  
  // NUEVO: Cola de sincronización
  syncQueue: '++id, timestamp, type, entityId, synced, retries',
  
  // NUEVO: Metadata de sincronización
  syncMetadata: 'key'
});

// Seed de datos iniciales
db.on('populate', () => {
  
  // Usuarios del sistema
  db.users.bulkAdd([
    {
      id: 'user-author-1',
      email: 'miguel.torres@universidad.edu',
      role: 'author',
      name: 'Miguel Torres'
    },
    {
      id: 'user-editor-1',
      email: 'carlos.martinez@universidad.edu',
      role: 'editor',
      name: 'Dr. Carlos Martínez'
    },
    {
      id: 'user-reviewer-1',
      email: 'ana.rodriguez@universidad.edu',
      role: 'reviewer',
      name: 'Dra. Ana Rodríguez'
    }
  ]);
  
  // Revisores disponibles
  db.reviewers.bulkAdd([
    {
      id: 'reviewer-1',
      name: "Dra. Ana Rodríguez",
      email: "ana.rodriguez@universidad.edu",
      expertise: ["AI", "ML"],
      assignedArticles: []
    },
    {
      id: 'reviewer-2',
      name: "Dr. Luis Fernández",
      email: "luis.fernandez@universidad.edu",
      expertise: ["Cybersecurity", "SoftwareEngineering"],
      assignedArticles: []
    },
    {
      id: 'reviewer-3',
      name: "Dra. María González",
      email: "maria.gonzalez@universidad.edu",
      expertise: ["AI", "DataScience"],
      assignedArticles: []
    },
    {
      id: 'reviewer-4',
      name: "Dr. Roberto Silva",
      email: "roberto.silva@universidad.edu",
      expertise: ["ML", "IoT"],
      assignedArticles: []
    },
    {
      id: 'reviewer-5',
      name: "Dr. Patricia Ruiz",
      email: "patricia.ruiz@universidad.edu",
      expertise: ["DataScience", "IoT"],
      assignedArticles: []
    }
  ]);
  
  // Metadata inicial de sincronización
  db.syncMetadata.add({
    key: 'lastSync',
    timestamp: null,
    status: 'never'
  });
  
  console.log('✅ Base de datos inicializada con usuarios y revisores');
});

export { db };
