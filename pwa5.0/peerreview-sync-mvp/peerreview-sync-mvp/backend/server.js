// Backend Mock para Sincronización - Express Simple
// Ejecutar con: node backend/server.js

const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');

const app = express();
const PORT = 3001;

// Middleware
app.use(cors());
app.use(bodyParser.json({ limit: '50mb' }));
app.use((req, res, next) => {
  console.log(`${new Date().toISOString()} - ${req.method} ${req.path}`);
  next();
});

// Base de datos en memoria (simplificada para demo)
const db = {
  articles: new Map(),
  reviews: new Map()
};

// ============================================
// HEALTH CHECK
// ============================================
app.get('/health', (req, res) => {
  res.json({ 
    status: 'ok', 
    timestamp: new Date().toISOString(),
    database: {
      articles: db.articles.size,
      reviews: db.reviews.size
    }
  });
});

// ============================================
// ARTICLES ENDPOINTS
// ============================================

// GET /api/articles - Listar artículos
app.get('/api/articles', (req, res) => {
  const articles = Array.from(db.articles.values());
  res.json(articles);
});

// GET /api/articles/:id - Obtener artículo
app.get('/api/articles/:id', (req, res) => {
  const { id } = req.params;
  const article = db.articles.get(id);
  
  if (!article) {
    return res.status(404).json({ error: 'Article not found' });
  }
  
  res.json(article);
});

// POST /api/articles - Crear artículo
app.post('/api/articles', (req, res) => {
  const article = {
    ...req.body,
    synced: true,
    syncedAt: new Date().toISOString(),
    updatedAt: Date.now()
  };
  
  db.articles.set(article.id, article);
  
  console.log(`✅ Artículo creado: ${article.id} - "${article.title}"`);
  
  res.status(201).json(article);
});

// PUT /api/articles/:id - Actualizar artículo
app.put('/api/articles/:id', (req, res) => {
  const { id } = req.params;
  const existing = db.articles.get(id);
  
  if (!existing) {
    return res.status(404).json({ error: 'Article not found' });
  }
  
  const updated = {
    ...existing,
    ...req.body,
    id, // No cambiar ID
    synced: true,
    syncedAt: new Date().toISOString(),
    updatedAt: Date.now()
  };
  
  db.articles.set(id, updated);
  
  console.log(`✅ Artículo actualizado: ${id}`);
  
  res.json(updated);
});

// DELETE /api/articles/:id - Eliminar artículo
app.delete('/api/articles/:id', (req, res) => {
  const { id } = req.params;
  
  if (!db.articles.has(id)) {
    return res.status(404).json({ error: 'Article not found' });
  }
  
  db.articles.delete(id);
  
  console.log(`✅ Artículo eliminado: ${id}`);
  
  res.json({ success: true, id });
});

// ============================================
// REVIEWS ENDPOINTS
// ============================================

// GET /api/reviews - Listar revisiones
app.get('/api/reviews', (req, res) => {
  const { articleId } = req.query;
  
  let reviews = Array.from(db.reviews.values());
  
  if (articleId) {
    reviews = reviews.filter(r => r.articleId === articleId);
  }
  
  res.json(reviews);
});

// GET /api/reviews/:id - Obtener revisión
app.get('/api/reviews/:id', (req, res) => {
  const { id } = req.params;
  const review = db.reviews.get(id);
  
  if (!review) {
    return res.status(404).json({ error: 'Review not found' });
  }
  
  res.json(review);
});

// POST /api/reviews - Crear revisión
app.post('/api/reviews', (req, res) => {
  const review = {
    ...req.body,
    synced: true,
    syncedAt: new Date().toISOString(),
    updatedAt: Date.now()
  };
  
  db.reviews.set(review.id, review);
  
  console.log(`✅ Revisión creada: ${review.id} - Artículo: ${review.articleId}`);
  
  res.status(201).json(review);
});

// PUT /api/reviews/:id - Actualizar revisión
app.put('/api/reviews/:id', (req, res) => {
  const { id } = req.params;
  const existing = db.reviews.get(id);
  
  if (!existing) {
    return res.status(404).json({ error: 'Review not found' });
  }
  
  const updated = {
    ...existing,
    ...req.body,
    id,
    synced: true,
    syncedAt: new Date().toISOString(),
    updatedAt: Date.now()
  };
  
  db.reviews.set(id, updated);
  
  console.log(`✅ Revisión actualizada: ${id}`);
  
  res.json(updated);
});

// DELETE /api/reviews/:id - Eliminar revisión
app.delete('/api/reviews/:id', (req, res) => {
  const { id } = req.params;
  
  if (!db.reviews.has(id)) {
    return res.status(404).json({ error: 'Review not found' });
  }
  
  db.reviews.delete(id);
  
  console.log(`✅ Revisión eliminada: ${id}`);
  
  res.json({ success: true, id });
});

// ============================================
// SYNC ENDPOINTS (específicos)
// ============================================

// POST /api/sync/batch - Sincronización por lotes
app.post('/api/sync/batch', (req, res) => {
  const { operations } = req.body;
  
  if (!Array.isArray(operations)) {
    return res.status(400).json({ error: 'operations must be an array' });
  }
  
  const results = [];
  
  for (const op of operations) {
    try {
      // Procesar operación según tipo
      let result;
      
      if (op.entityType === 'article') {
        if (op.type === 'create') {
          db.articles.set(op.data.id, op.data);
          result = { success: true, id: op.data.id };
        } else if (op.type === 'update') {
          db.articles.set(op.entityId, op.data);
          result = { success: true, id: op.entityId };
        }
      } else if (op.entityType === 'review') {
        if (op.type === 'create') {
          db.reviews.set(op.data.id, op.data);
          result = { success: true, id: op.data.id };
        } else if (op.type === 'update') {
          db.reviews.set(op.entityId, op.data);
          result = { success: true, id: op.entityId };
        }
      }
      
      results.push({ operation: op.id, result });
      
    } catch (error) {
      results.push({ operation: op.id, error: error.message });
    }
  }
  
  console.log(`✅ Sincronización por lotes: ${operations.length} operaciones`);
  
  res.json({ results, timestamp: new Date().toISOString() });
});

// ============================================
// ERROR HANDLER
// ============================================
app.use((err, req, res, next) => {
  console.error('Error:', err);
  res.status(500).json({ 
    error: 'Internal server error',
    message: err.message 
  });
});

// ============================================
// START SERVER
// ============================================
app.listen(PORT, () => {
  console.log('='.repeat(60));
  console.log('🚀 Servidor Mock de Sincronización Iniciado');
  console.log('='.repeat(60));
  console.log(`📡 URL: http://localhost:${PORT}`);
  console.log(`📊 Health: http://localhost:${PORT}/health`);
  console.log(`📝 Articles: http://localhost:${PORT}/api/articles`);
  console.log(`✍️  Reviews: http://localhost:${PORT}/api/reviews`);
  console.log('='.repeat(60));
  console.log('💡 Tip: Usa Ctrl+C para detener el servidor');
  console.log('='.repeat(60));
});

// Manejo de cierre graceful
process.on('SIGINT', () => {
  console.log('\n👋 Cerrando servidor...');
  process.exit(0);
});
