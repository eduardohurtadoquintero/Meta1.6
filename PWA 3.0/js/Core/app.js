// app.js - Punto de entrada principal con soporte offline-first
import { db } from '../db.js';
import { syncManager } from './SyncManager.js';
import { ArticleService } from '../services/article-service.js';
import { ErrorHandler } from './error-handler.js';
import { LoadingIndicator } from './loading-indicator.js';
import { NetworkDetector } from '../Utiles/network-detector.js';

let currentUser = {
    uuid: null,
    role: 'author',
    name: 'Miguel Torres'
};

let currentFilter = 'all';

document.addEventListener('DOMContentLoaded', async() => {
    console.log('🚀 Iniciando aplicación offline-first...');

    await syncManager.init();
    await loadCurrentUser();
    setupEventListeners();
    updateUIByRole();
    await loadDataByRole();
    setupSyncListeners();

    console.log('✅ Aplicación lista');
});

async function loadCurrentUser() {
    const savedUser = localStorage.getItem('currentUser');

    if (savedUser) {
        currentUser = JSON.parse(savedUser);
    } else {
        const author = await db.users.where('role').equals('author').first();
        if (author) {
            currentUser = {
                uuid: author.uuid,
                role: author.role,
                name: author.name
            };
            localStorage.setItem('currentUser', JSON.stringify(currentUser));
        }
    }

    const roleSelect = document.getElementById('roleSelect');
    if (roleSelect) {
        roleSelect.value = currentUser.role;
    }
}

function setupEventListeners() {
    const authorForm = document.getElementById('authorUploadForm');
    if (authorForm) {
        authorForm.addEventListener('submit', handleAuthorSubmit);
    }

    const roleSelect = document.getElementById('roleSelect');
    if (roleSelect) {
        roleSelect.addEventListener('change', handleRoleChange);
    }

    document.querySelectorAll('.filter-tab').forEach(tab => {
        tab.addEventListener('click', handleFilterChange);
    });

    const confirmAssign = document.getElementById('confirmAssignReviewers');
    if (confirmAssign) {
        confirmAssign.addEventListener('click', handleConfirmAssignment);
    }
}

function setupSyncListeners() {
    window.addEventListener('network-online', () => {
        updateNetworkStatus('online');
        ErrorHandler.success('📡 Conexión restaurada - Sincronizando...');
    });

    window.addEventListener('network-offline', () => {
        updateNetworkStatus('offline');
        ErrorHandler.warning('📡 Sin conexión - Modo offline activo');
    });

    window.addEventListener('sync-conflict', (e) => {
        const { entityType, entityUuid } = e.detail;
        showConflictNotification(entityType, entityUuid);
    });
}

function updateUIByRole() {
    document.querySelectorAll('[data-role]').forEach(section => {
        const sectionRole = section.getAttribute('data-role');
        section.style.display = sectionRole === currentUser.role ? 'block' : 'none';
    });

    const roleDisplay = document.getElementById('currentRoleDisplay');
    if (roleDisplay) {
        const labels = {
            author: '🎓 Autor',
            editor: '👨‍💼 Editor',
            reviewer: '👩‍🔬 Revisor'
        };
        roleDisplay.textContent = labels[currentUser.role];
    }
}

function updateNetworkStatus(status) {
    const indicator = document.getElementById('offlineIndicator');
    const statusSpan = document.getElementById('networkStatus');

    if (status === 'offline') {
        indicator ? .classList.remove('hidden');
        statusSpan.textContent = '🔴 Offline';
    } else {
        indicator ? .classList.add('hidden');
        statusSpan.textContent = '🟢 Online';
    }
}

async function handleAuthorSubmit(e) {
    e.preventDefault();

    const formData = new FormData(e.target);

    try {
        const result = await ArticleService.createArticle({
            title: formData.get('title'),
            area: formData.get('area'),
            pdfFile: formData.get('pdfFile'),
            abstract: formData.get('abstract'),
            authorId: currentUser.uuid
        });

        if (result.success) {
            e.target.reset();
            await loadAuthorArticles();
        }

    } catch (error) {
        ErrorHandler.error(error.message);
    }
}

async function loadAuthorArticles() {
    const container = document.getElementById('authorArticlesList');

    try {
        LoadingIndicator.show('Cargando artículos...');

        const articles = await ArticleService.getArticlesByAuthor(currentUser.uuid);

        if (articles.length === 0) {
            container.innerHTML = `
        <div class="empty-state">
          <p>📭 No has enviado artículos aún.</p>
        </div>
      `;
            return;
        }

        container.innerHTML = articles.map(article => {
                    const syncBadge = getSyncStatusBadge(article.syncStatus);

                    return `
        <div class="article-card">
          <div class="article-header">
            <div class="article-title">
              <strong>${escapeHtml(article.title)}</strong>
              ${getStatusBadge(article.status)}
              ${syncBadge}
            </div>
            <div class="article-actions">
              <button class="btn-icon" onclick="window.downloadArticle('${article.uuid}')">
                📥
              </button>
            </div>
          </div>
          
          <div class="article-meta">
            <span>📂 ${escapeHtml(article.area)}</span>
            <span>📄 ${article.fileName}</span>
            <span>🕐 ${new Date(article.createdAt).toLocaleDateString()}</span>
          </div>
          
          ${article.syncStatus === 'pending' ? `
            <div class="article-status-pending">
              ⏳ Pendiente de sincronización con servidor
            </div>
          ` : ''}
        </div>
      `;
    }).join('');
    
  } catch (error) {
    ErrorHandler.error('Error cargando artículos');
  } finally {
    LoadingIndicator.hide();
  }
}

async function loadDataByRole() {
  const role = currentUser.role;
  
  try {
    if (role === 'author') {
      await loadAuthorArticles();
    } else if (role === 'editor') {
      // await loadEditorArticles();
    } else if (role === 'reviewer') {
      // await loadReviewerArticles();
    }
  } catch (error) {
    ErrorHandler.error('Error cargando datos: ' + error.message);
  }
}

function handleRoleChange(e) {
  const role = e.target.value;
  
  const users = {
    author: { role: 'author', name: 'Miguel Torres' },
    editor: { role: 'editor', name: 'Dr. Carlos Martínez' },
    reviewer: { role: 'reviewer', name: 'Dra. Ana Rodríguez' }
  };
  
  currentUser = {
    ...users[role],
    uuid: currentUser.uuid // Mantener UUID
  };
  
  localStorage.setItem('currentUser', JSON.stringify(currentUser));
  
  updateUIByRole();
  loadDataByRole();
}

function handleFilterChange(e) {
  const status = e.target.dataset.status;
  currentFilter = status;
  
  document.querySelectorAll('.filter-tab').forEach(tab => {
    tab.classList.remove('active');
  });
  e.target.classList.add('active');
  
  // loadEditorArticles();
}

function handleConfirmAssignment() {
  // Implementar
}

function getSyncStatusBadge(status) {
  const badges = {
    synced: '<span class="badge badge-success" title="Sincronizado">☁️</span>',
    pending: '<span class="badge badge-warning" title="Pendiente de sync">⏳</span>',
    conflict: '<span class="badge badge-error" title="Conflicto">⚠️</span>'
  };
  return badges[status] || '';
}

function getStatusBadge(status) {
  const badges = {
    received: '<span class="badge badge-received">📨 Recibido</span>',
    in_review: '<span class="badge badge-in_review">📝 En Revisión</span>',
    reviewed: '<span class="badge badge-reviewed">✅ Revisado</span>'
  };
  return badges[status] || '';
}

function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

function showConflictNotification(entityType, entityUuid) {
  ErrorHandler.warning(`⚠️ Conflicto detectado en ${entityType}. Revisar.`);
}

window.downloadArticle = async (uuid) => {
  ErrorHandler.info('Descarga en desarrollo');
};

// Inicializar NetworkDetector
NetworkDetector.init();