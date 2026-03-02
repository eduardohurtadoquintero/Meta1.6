// db.js - Configuración de IndexedDB con soporte para sync
import Dexie from 'https://unpkg.com/dexie@3.2.4/dist/dexie.min.js';

const db = new Dexie('PeerReviewDB_v3');

db.version(1).stores({
    articles: 'uuid, id, status, createdAt, authorId, syncStatus, lastModified',
    reviewers: 'uuid, id, email, expertise, syncStatus',
    reviews: 'uuid, id, articleId, reviewerId, status, syncStatus, lastModified',
    users: 'uuid, id, email, role, syncStatus',
    syncQueue: '++id, entityType, entityUuid, operation, status, createdAt',
    conflicts: '++id, entityType, entityUuid, status, createdAt',
    files: 'uuid, fileName, fileType, articleId, synced'
});

db.on('populate', () => {
    db.users.bulkAdd([{
            uuid: crypto.randomUUID(),
            id: 1,
            email: 'miguel.torres@universidad.edu',
            role: 'author',
            name: 'Miguel Torres',
            syncStatus: 'synced'
        },
        {
            uuid: crypto.randomUUID(),
            id: 2,
            email: 'carlos.martinez@universidad.edu',
            role: 'editor',
            name: 'Dr. Carlos Martínez',
            syncStatus: 'synced'
        },
        {
            uuid: crypto.randomUUID(),
            id: 3,
            email: 'ana.rodriguez@universidad.edu',
            role: 'reviewer',
            name: 'Dra. Ana Rodríguez',
            syncStatus: 'synced'
        }
    ]);

    db.reviewers.bulkAdd([{
            uuid: crypto.randomUUID(),
            id: 'reviewer-1',
            name: "Dra. Ana Rodríguez",
            email: "ana.rodriguez@universidad.edu",
            expertise: ["AI", "ML"],
            assignedArticles: [],
            syncStatus: 'synced'
        },
        {
            uuid: crypto.randomUUID(),
            id: 'reviewer-2',
            name: "Dr. Luis Fernández",
            email: "luis.fernandez@universidad.edu",
            expertise: ["Cybersecurity", "SoftwareEngineering"],
            assignedArticles: [],
            syncStatus: 'synced'
        },
        {
            uuid: crypto.randomUUID(),
            id: 'reviewer-3',
            name: "Dra. María González",
            email: "maria.gonzalez@universidad.edu",
            expertise: ["AI", "DataScience"],
            assignedArticles: [],
            syncStatus: 'synced'
        }
    ]);

    console.log('✅ Base de datos inicializada con soporte offline-first');
});

export { db };