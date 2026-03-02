// api-client.js - Cliente HTTP con soporte offline
import { NetworkDetector } from '../Utiles/network-detector.js';

class ApiClient {
    constructor() {
        this.baseUrl = '/api/v1';
        this.timeout = 30000;
    }

    async syncEntity(entityType, entity) {
        if (!NetworkDetector.isOnline()) {
            return { success: false, offline: true };
        }

        try {
            const response = await this.request(
                `/sync/${entityType}`, {
                    method: 'POST',
                    body: JSON.stringify(entity)
                }
            );

            return response;

        } catch (error) {
            if (error.status === 409) {
                return {
                    success: false,
                    conflict: true,
                    remoteVersion: error.remoteVersion
                };
            }

            return { success: false, error: error.message };
        }
    }

    async getChanges(since) {
        if (!NetworkDetector.isOnline()) {
            return [];
        }

        try {
            const response = await this.request(
                `/sync/changes?since=${since}&deviceId=${this.getDeviceId()}`
            );

            return response.changes || [];

        } catch (error) {
            console.error('Error obteniendo cambios:', error);
            return [];
        }
    }

    async syncBatch(operations) {
        if (!NetworkDetector.isOnline()) {
            return { success: false, offline: true };
        }

        try {
            const response = await this.request(
                '/sync/batch', {
                    method: 'POST',
                    body: JSON.stringify({
                        operations,
                        deviceId: this.getDeviceId(),
                        timestamp: Date.now()
                    })
                }
            );

            return response;

        } catch (error) {
            return { success: false, error: error.message };
        }
    }

    async uploadFile(articleUuid, file) {
        if (!NetworkDetector.isOnline()) {
            throw new Error('Offline: No se puede subir archivo ahora');
        }

        const formData = new FormData();
        formData.append('file', file);
        formData.append('articleUuid', articleUuid);

        try {
            const response = await fetch(`${this.baseUrl}/files/upload`, {
                method: 'POST',
                body: formData,
                timeout: this.timeout
            });

            if (!response.ok) {
                throw new Error(`HTTP ${response.status}`);
            }

            return await response.json();

        } catch (error) {
            console.error('Error subiendo archivo:', error);
            throw error;
        }
    }

    async request(endpoint, options = {}) {
        const url = `${this.baseUrl}${endpoint}`;

        const defaultOptions = {
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${this.getToken()}`
            },
            timeout: this.timeout
        };

        try {
            const response = await fetch(url, {...defaultOptions, ...options });

            if (response.status === 409) {
                const data = await response.json();
                const error = new Error('Conflict');
                error.status = 409;
                error.remoteVersion = data.remoteVersion;
                throw error;
            }

            if (!response.ok) {
                throw new Error(`HTTP ${response.status}`);
            }

            return await response.json();

        } catch (error) {
            console.error(`❌ API Error (${endpoint}):`, error);
            throw error;
        }
    }

    getToken() {
        return localStorage.getItem('authToken');
    }

    getDeviceId() {
        return localStorage.getItem('deviceId') || 'unknown';
    }
}

export const apiClient = new ApiClient();