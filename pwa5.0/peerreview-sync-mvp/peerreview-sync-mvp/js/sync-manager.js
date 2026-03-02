// Sistema de Sincronización Offline-First
import { db } from '../db.js';
import { ErrorHandler } from './error-handler.js';

// Configuración del servidor (ajustar según entorno)
const API_BASE_URL = window.location.hostname === 'localhost' 
  ? 'http://localhost:3001/api'
  : '/api';

export class SyncManager {
  static isOnline = navigator.onLine;
  static isSyncing = false;
  static syncInterval = null;
  
  /**
   * Inicializa el sistema de sincronización
   */
  static async initialize() {
    console.log('🔄 Inicializando SyncManager...');
    
    // Detectar cambios de conectividad
    window.addEventListener('online', () => this.handleOnline());
    window.addEventListener('offline', () => this.handleOffline());
    
    // Sincronización periódica cada 30 segundos
    this.syncInterval = setInterval(() => {
      if (this.isOnline && !this.isSyncing) {
        this.syncAll();
      }
    }, 30000);
    
    // Sincronización inicial si estamos online
    if (this.isOnline) {
      await this.syncAll();
    }
    
    console.log('✅ SyncManager inicializado');
  }
  
  /**
   * Maneja evento de reconexión
   */
  static async handleOnline() {
    console.log('🟢 Conexión restaurada');
    this.isOnline = true;
    this.updateConnectionStatus(true);
    
    ErrorHandler.success('Conexión restaurada. Sincronizando datos...');
    
    // Sincronizar inmediatamente
    await this.syncAll();
  }
  
  /**
   * Maneja evento de desconexión
   */
  static handleOffline() {
    console.log('🔴 Conexión perdida');
    this.isOnline = false;
    this.updateConnectionStatus(false);
    
    ErrorHandler.warning('Sin conexión. Los cambios se guardarán localmente.');
  }
  
  /**
   * Actualiza indicador visual de conexión
   */
  static updateConnectionStatus(online) {
    const indicator = document.getElementById('offlineIndicator');
    const statusSpan = document.getElementById('networkStatus');
    const syncStatus = document.getElementById('syncStatus');
    
    if (indicator) {
      indicator.classList.toggle('hidden', online);
    }
    
    if (statusSpan) {
      statusSpan.textContent = online ? '🟢 Online' : '🔴 Offline';
    }
    
    if (syncStatus) {
      syncStatus.textContent = online ? '✅ Sincronizado' : '⏸️ Pendiente';
    }
  }
  
  /**
   * Agrega operación a la cola de sincronización
   */
  static async queueOperation(type, entityType, entityId, data) {
    try {
      const operation = {
        type,           // 'create', 'update', 'delete'
        entityType,     // 'article', 'review', etc.
        entityId,
        data,
        timestamp: Date.now(),
        synced: false,
        retries: 0,
        error: null
      };
      
      const id = await db.syncQueue.add(operation);
      console.log(`📝 Operación agregada a cola: ${type} ${entityType} (${id})`);
      
      // Marcar entidad como no sincronizada
      await this.markEntityAsUnsynced(entityType, entityId);
      
      // Intentar sincronizar si estamos online
      if (this.isOnline && !this.isSyncing) {
        await this.syncAll();
      }
      
      return id;
      
    } catch (error) {
      console.error('Error agregando a cola:', error);
      throw error;
    }
  }
  
  /**
   * Marca entidad como no sincronizada
   */
  static async markEntityAsUnsynced(entityType, entityId) {
    const storeName = this.getStoreName(entityType);
    if (!storeName) return;
    
    try {
      await db[storeName].update(entityId, { synced: false });
    } catch (error) {
      console.warn('Error marcando como no sincronizado:', error);
    }
  }
  
  /**
   * Marca entidad como sincronizada
   */
  static async markEntityAsSynced(entityType, entityId) {
    const storeName = this.getStoreName(entityType);
    if (!storeName) return;
    
    try {
      await db[storeName].update(entityId, { synced: true });
    } catch (error) {
      console.warn('Error marcando como sincronizado:', error);
    }
  }
  
  /**
   * Obtiene nombre del store según tipo de entidad
   */
  static getStoreName(entityType) {
    const mapping = {
      article: 'articles',
      review: 'reviews',
      user: 'users'
    };
    return mapping[entityType];
  }
  
  /**
   * Sincroniza todas las operaciones pendientes
   */
  static async syncAll() {
    if (!this.isOnline || this.isSyncing) return;
    
    this.isSyncing = true;
    this.updateSyncStatus('syncing');
    
    try {
      console.log('🔄 Iniciando sincronización...');
      
      // Obtener operaciones pendientes
      const pending = await db.syncQueue
        .where('synced').equals(false)
        .and(op => op.retries < 3)
        .sortBy('timestamp');
      
      if (pending.length === 0) {
        console.log('✅ No hay operaciones pendientes');
        this.updateSyncStatus('synced');
        this.isSyncing = false;
        return;
      }
      
      console.log(`📤 Sincronizando ${pending.length} operaciones...`);
      
      let successCount = 0;
      let errorCount = 0;
      
      // Procesar cada operación
      for (const operation of pending) {
        try {
          await this.syncOperation(operation);
          successCount++;
        } catch (error) {
          console.error(`Error sincronizando operación ${operation.id}:`, error);
          errorCount++;
          
          // Incrementar contador de reintentos
          await db.syncQueue.update(operation.id, {
            retries: operation.retries + 1,
            error: error.message
          });
        }
      }
      
      console.log(`✅ Sincronización completada: ${successCount} exitosas, ${errorCount} errores`);
      
      // Actualizar metadata
      await db.syncMetadata.put({
        key: 'lastSync',
        timestamp: Date.now(),
        status: 'success',
        operations: { success: successCount, errors: errorCount }
      });
      
      this.updateSyncStatus('synced');
      
      if (successCount > 0) {
        ErrorHandler.success(`${successCount} operación(es) sincronizada(s)`);
      }
      
      if (errorCount > 0) {
        ErrorHandler.warning(`${errorCount} operación(es) fallaron (se reintentarán)`);
      }
      
    } catch (error) {
      console.error('Error en sincronización:', error);
      this.updateSyncStatus('error');
      ErrorHandler.error('Error en sincronización: ' + error.message);
      
    } finally {
      this.isSyncing = false;
    }
  }
  
  /**
   * Sincroniza una operación individual
   */
  static async syncOperation(operation) {
    const { type, entityType, entityId, data } = operation;
    
    console.log(`  ↗️ Sincronizando: ${type} ${entityType} ${entityId}`);
    
    let endpoint = '';
    let method = '';
    let body = null;
    
    // Determinar endpoint y método según operación
    switch (entityType) {
      case 'article':
        endpoint = type === 'create' ? '/articles' : `/articles/${entityId}`;
        method = type === 'create' ? 'POST' : type === 'update' ? 'PUT' : 'DELETE';
        body = type !== 'delete' ? data : null;
        break;
        
      case 'review':
        endpoint = type === 'create' ? '/reviews' : `/reviews/${entityId}`;
        method = type === 'create' ? 'POST' : type === 'update' ? 'PUT' : 'DELETE';
        body = type !== 'delete' ? data : null;
        break;
        
      default:
        throw new Error(`Tipo de entidad no soportado: ${entityType}`);
    }
    
    // Hacer request al servidor
    const response = await fetch(`${API_BASE_URL}${endpoint}`, {
      method,
      headers: {
        'Content-Type': 'application/json',
        // TODO: Agregar JWT token cuando tengas autenticación
        // 'Authorization': `Bearer ${token}`
      },
      body: body ? JSON.stringify(body) : undefined
    });
    
    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.error || `HTTP ${response.status}`);
    }
    
    const result = await response.json();
    
    // Manejar respuesta del servidor
    await this.handleSyncResponse(operation, result);
    
    // Marcar operación como sincronizada
    await db.syncQueue.update(operation.id, {
      synced: true,
      error: null
    });
    
    // Marcar entidad como sincronizada
    await this.markEntityAsSynced(entityType, entityId);
    
    console.log(`  ✅ Sincronizado: ${type} ${entityType} ${entityId}`);
  }
  
  /**
   * Maneja respuesta del servidor y actualiza datos locales
   */
  static async handleSyncResponse(operation, serverData) {
    const { entityType, entityId } = operation;
    
    // Verificar si hay conflictos
    const localEntity = await this.getLocalEntity(entityType, entityId);
    
    if (!localEntity) return; // Entidad eliminada localmente
    
    // Detectar conflicto: si el servidor tiene datos más recientes
    if (serverData.updatedAt && localEntity.updatedAt) {
      const serverTime = new Date(serverData.updatedAt).getTime();
      const localTime = localEntity.updatedAt;
      
      if (serverTime > localTime) {
        console.warn(`⚠️ Conflicto detectado en ${entityType} ${entityId}`);
        await this.resolveConflict(entityType, entityId, localEntity, serverData);
      }
    }
  }
  
  /**
   * Obtiene entidad local
   */
  static async getLocalEntity(entityType, entityId) {
    const storeName = this.getStoreName(entityType);
    if (!storeName) return null;
    
    return await db[storeName].get(entityId);
  }
  
  /**
   * Resuelve conflictos entre datos locales y del servidor
   */
  static async resolveConflict(entityType, entityId, localData, serverData) {
    console.log(`🔄 Resolviendo conflicto: ${entityType} ${entityId}`);
    
    // ESTRATEGIA: Last-Write-Wins (el servidor gana)
    // Puedes implementar estrategias más sofisticadas aquí
    
    const storeName = this.getStoreName(entityType);
    if (!storeName) return;
    
    // Actualizar datos locales con los del servidor
    await db[storeName].update(entityId, {
      ...serverData,
      synced: true,
      conflictResolved: true,
      conflictResolvedAt: Date.now()
    });
    
    console.log(`✅ Conflicto resuelto: servidor prevalece`);
    
    // Notificar al usuario
    ErrorHandler.warning(`Conflicto resuelto: se usó la versión del servidor para ${entityType}`);
  }
  
  /**
   * Actualiza indicador visual de estado de sincronización
   */
  static updateSyncStatus(status) {
    const syncStatus = document.getElementById('syncStatus');
    if (!syncStatus) return;
    
    const statusMap = {
      syncing: '🔄 Sincronizando...',
      synced: '✅ Sincronizado',
      error: '❌ Error',
      pending: '⏳ Pendiente'
    };
    
    syncStatus.textContent = statusMap[status] || status;
    syncStatus.className = `sync-status sync-${status}`;
  }
  
  /**
   * Obtiene estadísticas de sincronización
   */
  static async getSyncStats() {
    const pending = await db.syncQueue.where('synced').equals(false).count();
    const failed = await db.syncQueue.where('retries').above(0).count();
    const total = await db.syncQueue.count();
    
    const lastSync = await db.syncMetadata.get('lastSync');
    
    return {
      pending,
      failed,
      total,
      lastSync: lastSync?.timestamp || null,
      isOnline: this.isOnline,
      isSyncing: this.isSyncing
    };
  }
  
  /**
   * Fuerza sincronización manual
   */
  static async forceSyncNow() {
    if (!this.isOnline) {
      ErrorHandler.error('No hay conexión a internet');
      return;
    }
    
    if (this.isSyncing) {
      ErrorHandler.info('Ya hay una sincronización en progreso');
      return;
    }
    
    ErrorHandler.info('Iniciando sincronización manual...');
    await this.syncAll();
  }
  
  /**
   * Limpia operaciones sincronizadas antiguas (más de 7 días)
   */
  static async cleanupOldOperations() {
    const sevenDaysAgo = Date.now() - (7 * 24 * 60 * 60 * 1000);
    
    const deleted = await db.syncQueue
      .where('synced').equals(true)
      .and(op => op.timestamp < sevenDaysAgo)
      .delete();
    
    console.log(`🧹 Limpiadas ${deleted} operaciones antiguas`);
  }
  
  /**
   * Detiene el sistema de sincronización
   */
  static shutdown() {
    if (this.syncInterval) {
      clearInterval(this.syncInterval);
      this.syncInterval = null;
    }
    console.log('🛑 SyncManager detenido');
  }
}
