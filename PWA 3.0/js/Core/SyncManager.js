import { db } from '../../db.js';
import { ApiClient } from '../services/api-client.js';
import { ConflictResolver } from './conflict-resolver.js';
import { NetworkDetector } from '../Utiles/network-detector.js';

class SyncManager {
    constructor() {
        this.isSyncing = false;
        this.syncQueue = [];
        this.retryDelay = 5000; // 5 segundos
        this.maxRetries = 3;
        this.pendingOperations = new Map();
    }

    /**
     * Inicializa el gestor de sincronización
     */
    async init() {
        console.log('🔄 Inicializando SyncManager...');

        // Escuchar cambios de red
        NetworkDetector.onOnline(() => this.handleOnline());
        NetworkDetector.onOffline(() => this.handleOffline());

        // Registrar para background sync
        await this.registerBackgroundSync();

        // Intentar sync inicial si hay conexión
        if (NetworkDetector.isOnline()) {
            await this.sync();
        }
    }

    /**
     * Guarda una entidad con estrategia offline-first
     */
    async save(entityType, data, options = {}) {
        const { skipSync = false, priority = 'normal' } = options;

        // Generar UUID si no tiene
        if (!data.uuid) {
            data.uuid = crypto.randomUUID();
        }

        // Añadir metadatos de sync
        const entity = {
            ...data,
            syncStatus: 'pending',
            lastModified: Date.now(),
            deviceId: this.getDeviceId(),
            version: data.version || 1
        };

        try {
            // 1. Guardar LOCALMENTE primero (siempre)
            await db[entityType].put(entity);
            console.log(`✅ Guardado local: ${entityType} (${entity.uuid})`);

            // 2. Si no estamos offline y no se pide skip, intentar sync inmediato
            if (NetworkDetector.isOnline() && !skipSync) {
                await this.syncEntity(entityType, entity);
            } else {
                // 3. Encolar para sync posterior
                await this.enqueueSync(entityType, entity.uuid, 'save', priority);
            }

            return { success: true, uuid: entity.uuid, local: true };

        } catch (error) {
            console.error('❌ Error guardando localmente:', error);

            // Fallback: guardar en cola de reintentos
            await this.enqueueSync(entityType, entity.uuid, 'save', priority, 1);

            return {
                success: false,
                error: error.message,
                uuid: entity.uuid
            };
        }
    }

    /**
     * Encola una operación para sincronización posterior
     */
    async enqueueSync(entityType, entityUuid, operation, priority = 'normal', retryCount = 0) {
        const queueItem = {
            entityType,
            entityUuid,
            operation,
            priority,
            status: 'pending',
            retryCount,
            createdAt: Date.now(),
            maxRetries: this.maxRetries
        };

        await db.syncQueue.add(queueItem);

        // Si hay conexión, intentar procesar cola
        if (NetworkDetector.isOnline()) {
            setTimeout(() => this.processQueue(), 1000);
        }
    }

    /**
     * Procesa la cola de sincronización
     */
    async processQueue() {
        if (this.isSyncing) {
            console.log('⏳ Ya hay una sincronización en curso');
            return;
        }

        this.isSyncing = true;

        try {
            // Obtener operaciones pendientes (prioritarias primero)
            const pending = await db.syncQueue
                .where('status').equals('pending')
                .toArray();

            // Agrupar por prioridad
            const highPriority = pending.filter(p => p.priority === 'high');
            const normalPriority = pending.filter(p => p.priority === 'normal');
            const lowPriority = pending.filter(p => p.priority === 'low');

            const operations = [...highPriority, ...normalPriority, ...lowPriority];

            for (const op of operations) {
                await this.processSyncOperation(op);
            }

        } catch (error) {
            console.error('❌ Error procesando cola:', error);
        } finally {
            this.isSyncing = false;
        }
    }

    /**
     * Procesa una operación específica de sync
     */
    async processSyncOperation(op) {
        try {
            // Marcar como procesando
            await db.syncQueue.update(op.id, { status: 'processing' });

            // Obtener entidad actual
            const entity = await db[op.entityType].get(op.entityUuid);

            if (!entity) {
                // Entidad eliminada, marcar como completada
                await db.syncQueue.update(op.id, { status: 'completed' });
                return;
            }

            // Intentar sync con servidor
            const result = await ApiClient.syncEntity(op.entityType, entity);

            if (result.success) {
                // Actualizar estado local
                await db[op.entityType].update(op.entityUuid, {
                    syncStatus: 'synced',
                    remoteId: result.remoteId,
                    lastSynced: Date.now()
                });

                await db.syncQueue.update(op.id, { status: 'completed' });

            } else if (result.conflict) {
                // Hay conflicto, resolver
                await this.handleConflict(op, entity, result.remoteVersion);
            } else {
                // Error temporal, reintentar
                await this.handleRetry(op);
            }

        } catch (error) {
            console.error(`❌ Error en sync operation ${op.id}:`, error);
            await this.handleRetry(op);
        }
    }

    /**
     * Maneja conflictos de sincronización
     */
    async handleConflict(op, localEntity, remoteEntity) {
        const resolver = new ConflictResolver();
        const resolution = await resolver.resolve(
            op.entityType,
            localEntity,
            remoteEntity
        );

        if (resolution.strategy === 'auto') {
            // Resolución automática
            const merged = resolution.merged;
            merged.syncStatus = 'pending';
            merged.version = Math.max(localEntity.version, remoteEntity.version) + 1;

            await db[op.entityType].put(merged);
            await this.enqueueSync(op.entityType, merged.uuid, 'save', 'high');

            // Registrar conflicto resuelto
            await db.conflicts.add({
                entityType: op.entityType,
                entityUuid: op.entityUuid,
                resolution: 'auto',
                resolvedAt: Date.now()
            });

        } else {
            // Requiere resolución manual
            await db.conflicts.add({
                entityType: op.entityType,
                entityUuid: op.entityUuid,
                localVersion: localEntity,
                remoteVersion: remoteEntity,
                status: 'pending',
                createdAt: Date.now()
            });

            // Notificar a UI
            this.notifyConflict(op.entityType, op.entityUuid);
        }
    }

    /**
     * Maneja reintentos
     */
    async handleRetry(op) {
        if (op.retryCount < op.maxRetries) {
            await db.syncQueue.update(op.id, {
                status: 'pending',
                retryCount: op.retryCount + 1,
                lastRetry: Date.now()
            });

            // Programar reintento con backoff exponencial
            const delay = this.retryDelay * Math.pow(2, op.retryCount);
            setTimeout(() => this.processQueue(), delay);
        } else {
            // Máximos reintentos alcanzados, marcar como fallido
            await db.syncQueue.update(op.id, {
                status: 'failed',
                failedAt: Date.now()
            });

            console.error(`❌ Sync falló después de ${op.maxRetries} intentos:`, op);
        }
    }

    /**
     * Maneja evento online
     */
    async handleOnline() {
        console.log('📡 Conexión restaurada - Iniciando sync...');

        // Mostrar notificación
        window.dispatchEvent(new CustomEvent('network-online'));

        // Procesar cola
        await this.processQueue();

        // Sincronizar cambios del servidor
        await this.pullChanges();
    }

    /**
     * Maneja evento offline
     */
    handleOffline() {
        console.log('📡 Sin conexión - Modo offline');
        window.dispatchEvent(new CustomEvent('network-offline'));
    }

    /**
     * Obtiene cambios del servidor
     */
    async pullChanges() {
        try {
            const lastSync = await this.getLastSyncTime();
            const changes = await ApiClient.getChanges(lastSync);

            for (const change of changes) {
                await this.applyRemoteChange(change);
            }

            await this.updateLastSyncTime();

        } catch (error) {
            console.error('❌ Error pulling changes:', error);
        }
    }

    /**
     * Aplica cambio remoto localmente
     */
    async applyRemoteChange(change) {
        const local = await db[change.entityType].get(change.entity.uuid);

        if (!local) {
            // Nuevo, guardar
            await db[change.entityType].put({
                ...change.entity,
                syncStatus: 'synced'
            });
        } else if (change.entity.version > local.version) {
            // Más nuevo, actualizar
            await db[change.entityType].update(change.entity.uuid, {
                ...change.entity,
                syncStatus: 'synced'
            });
        }
        // Si local es más nuevo, ya se sincronizará después
    }

    /**
     * Registra background sync
     */
    async registerBackgroundSync() {
        if ('serviceWorker' in navigator && 'SyncManager' in window) {
            try {
                const registration = await navigator.serviceWorker.ready;
                await registration.sync.register('sync-articles');
                console.log('✅ Background sync registrado');
            } catch (error) {
                console.error('❌ Error registrando background sync:', error);
            }
        }
    }

    /**
     * Obtiene ID del dispositivo
     */
    getDeviceId() {
        let deviceId = localStorage.getItem('deviceId');
        if (!deviceId) {
            deviceId = crypto.randomUUID();
            localStorage.setItem('deviceId', deviceId);
        }
        return deviceId;
    }

    /**
     * Obtiene última sincronización
     */
    async getLastSyncTime() {
        const lastSync = localStorage.getItem('lastSync');
        return lastSync ? parseInt(lastSync) : 0;
    }

    /**
     * Actualiza última sincronización
     */
    async updateLastSyncTime() {
        localStorage.setItem('lastSync', Date.now().toString());
    }

    /**
     * Notifica conflicto a UI
     */
    notifyConflict(entityType, entityUuid) {
        window.dispatchEvent(new CustomEvent('sync-conflict', {
            detail: { entityType, entityUuid }
        }));
    }
}

// Singleton
export const syncManager = new SyncManager();