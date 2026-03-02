import { db } from '../db.js';
import { ArticleManager } from './article-manager.js';
import { SyncManager } from './sync-manager.js';
import { ErrorHandler } from './error-handler.js';
import { LoadingIndicator } from './loading-indicator.js';

let currentUser = {
  id: 'user-author-1',
  role: 'author',
  name: 'Miguel Torres'
};

let currentFilter = 'all';

document.addEventListener('DOMContentLoaded', async () => {
  console.log('🚀 Iniciando aplicación con sincronización...');
  
  // Inicializar SyncManager
  await SyncManager.initialize();
  
  // Registrar Service Worker
  registerServiceWorker();
  
  // Verificar estado
  await checkSystemStatus();
  
  // Setup listeners
  setupEventListeners();
  
  // Actualizar UI según rol
  updateUIByRole();
  
  // Cargar datos
  await loadDataByRole();
  
  // Actualizar stats de sync cada 5 segundos
  setInterval(updateSyncStats, 5000);
  await updateSyncStats();
  
  console.log('✅ Aplicación iniciada');
});

function setupEventListeners() {
  const authorForm = document.getElementById('authorUploadForm');
  if (authorForm) {
    authorForm.addEventListener('submit', handleAuthorSubmit);
  }
  
  const roleSelect = document.getElementById('roleSelect');
  if (roleSelect) {
    roleSelect.addEventListener('change', handleRoleChange);
  }
  
  const forceSyncBtn = document.getElementById('forceSyncBtn');
  if (forceSyncBtn) {
    forceSyncBtn.addEventListener('click', () => SyncManager.forceSyncNow());
  }
  
  const viewQueueBtn = document.getElementById('viewQueueBtn');
  if (viewQueueBtn) {
    viewQueueBtn.addEventListener('click', viewSyncQueue);
  }
}

async function handleAuthorSubmit(e) {
  e.preventDefault();
  
  const formData = new FormData(e.target);
  
  try {
    const article = await ArticleManager.createArticle({
      title: formData.get('title'),
      area: formData.get('area'),
      pdfFile: formData.get('pdfFile'),
      abstract: formData.get('abstract'),
      authorId: currentUser.id
    });
    
    e.target.reset();
    await loadDataByRole();
    await updateSyncStats();
    
  } catch (error) {
    ErrorHandler.error(error.message);
  }
}

function handleRoleChange(e) {
  const role = e.target.value;
  const users = {
    author: { id: 'user-author-1', role: 'author', name: 'Miguel Torres' },
    editor: { id: 'user-editor-1', role: 'editor', name: 'Dr. Carlos' },
    reviewer: { id: 'user-reviewer-1', role: 'reviewer', name: 'Dra. Ana' }
  };
  
  currentUser = users[role];
  updateUIByRole();
  loadDataByRole();
}

function updateUIByRole() {
  const role = currentUser.role;
  
  document.querySelectorAll('[data-role]').forEach(section => {
    const sectionRole = section.getAttribute('data-role');
    section.style.display = sectionRole === role ? 'block' : 'none';
  });
  
  const roleDisplay = document.getElementById('currentRoleDisplay');
  if (roleDisplay) {
    const roleLabels = {
      author: '🎓 Autor',
      editor: '👨‍💼 Editor',
      reviewer: '👩‍🔬 Revisor'
    };
    roleDisplay.textContent = roleLabels[role];
  }
}

async function loadDataByRole() {
  const role = currentUser.role;
  
  try {
    if (role === 'author') {
      await loadAuthorArticles();
    } else if (role === 'editor') {
      await loadEditorArticles();
    } else if (role === 'reviewer') {
      await loadReviewerArticles();
    }
  } catch (error) {
    ErrorHandler.error('Error cargando datos: ' + error.message);
  }
}

async function loadAuthorArticles() {
  const container = document.getElementById('authorArticlesList');
  
  try {
    LoadingIndicator.show('Cargando artículos...');
    
    const articles = await ArticleManager.getArticlesByAuthor(currentUser.id);
    
    if (articles.length === 0) {
      container.innerHTML = '<div class="empty-state"><p>📭 No has enviado artículos</p></div>';
      return;
    }
    
    container.innerHTML = articles.map(article => `
      <div class="article-card">
        <div class="article-header">
          <div class="article-title">
            <strong>${escapeHtml(article.title)}</strong>
            ${getStatusBadge(article.status)}
            ${getSyncBadge(article.synced)}
          </div>
          <div class="article-actions">
            <button class="btn-icon" onclick="window.downloadArticlePDF('${article.id}')" title="Descargar">
              📥
            </button>
          </div>
        </div>
        <div class="article-meta">
          <span>📂 ${escapeHtml(article.area)}</span>
          <span>📄 ${escapeHtml(article.fileName)}</span>
          <span>🕐 ${new Date(article.createdAt).toLocaleDateString('es-ES')}</span>
        </div>
      </div>
    `).join('');
    
  } catch (error) {
    ErrorHandler.error('Error: ' + error.message);
  } finally {
    LoadingIndicator.hide();
  }
}

async function loadEditorArticles() {
  const container = document.getElementById('editorArticlesList');
  
  try {
    const articles = await ArticleManager.getAllArticles();
    
    if (articles.length === 0) {
      container.innerHTML = '<div class="empty-state"><p>📭 No hay artículos</p></div>';
      return;
    }
    
    container.innerHTML = articles.map(article => `
      <div class="article-card">
        <div class="article-header">
          <div class="article-title">
            <strong>${escapeHtml(article.title)}</strong>
            ${getStatusBadge(article.status)}
            ${getSyncBadge(article.synced)}
          </div>
        </div>
        <div class="article-meta">
          <span>📂 ${escapeHtml(article.area)}</span>
          <span>👤 ${escapeHtml(article.authorId)}</span>
        </div>
      </div>
    `).join('');
    
  } finally {
    LoadingIndicator.hide();
  }
}

async function loadReviewerArticles() {
  const container = document.getElementById('reviewerArticlesList');
  container.innerHTML = '<div class="empty-state"><p>📭 No hay artículos asignados</p></div>';
}

function getSyncBadge(synced) {
  if (synced) {
    return '<span class="article-sync-badge article-synced">✅ Sync</span>';
  }
  return '<span class="article-sync-badge article-unsynced">⏳ Pendiente</span>';
}

function getStatusBadge(status) {
  const badges = {
    received: '<span class="badge badge-received">📨 Recibido</span>',
    in_review: '<span class="badge badge-in_review">📝 En Revisión</span>',
    reviewed: '<span class="badge badge-reviewed">✅ Revisado</span>'
  };
  return badges[status] || '';
}

async function updateSyncStats() {
  try {
    const stats = await SyncManager.getSyncStats();
    
    const pendingSpan = document.getElementById('pendingSync');
    if (pendingSpan) {
      pendingSpan.textContent = stats.pending;
      pendingSpan.style.color = stats.pending > 0 ? '#f59e0b' : '#10b981';
    }
    
    const lastSyncSpan = document.getElementById('lastSyncTime');
    if (lastSyncSpan && stats.lastSync) {
      const date = new Date(stats.lastSync);
      lastSyncSpan.textContent = date.toLocaleTimeString('es-ES');
    }
    
  } catch (error) {
    console.error('Error actualizando stats:', error);
  }
}

async function viewSyncQueue() {
  try {
    const queue = await db.syncQueue.toArray();
    console.log('📋 Cola de sincronización:', queue);
    ErrorHandler.info(`${queue.length} operación(es) en cola. Ver consola (F12)`);
  } catch (error) {
    ErrorHandler.error('Error: ' + error.message);
  }
}

window.downloadArticlePDF = async (id) => {
  await ArticleManager.downloadPDF(id);
};

function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

function registerServiceWorker() {
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('/sw.js')
      .then(() => {
        document.getElementById('swStatus').textContent = '✅ Activo';
      })
      .catch(() => {
        document.getElementById('swStatus').textContent = '❌ Error';
      });
  }
}

async function checkSystemStatus() {
  if (window.matchMedia('(display-mode: standalone)').matches) {
    document.getElementById('pwaStatus').textContent = '✅ Sí';
  }
  
  try {
    await db.open();
    document.getElementById('dbStatus').textContent = '✅ Conectado';
  } catch (error) {
    document.getElementById('dbStatus').textContent = '❌ Error';
  }
}
