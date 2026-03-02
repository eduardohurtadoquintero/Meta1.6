// article-service.js - Gestión de artículos con soporte offline-first
import { db } from '../../db.js';
import { syncManager } from '../Core/SyncManager.js';
import { NetworkDetector } from '../Utiles/network-detector.js';
import { apiClient } from './api-client.js';
import { ErrorHandler } from '../error-handler.js';
import { LoadingIndicator } from '../loading-indicator.js';

export class ArticleService {

    static async createArticle(data) {
        const { title, area, pdfFile, abstract, authorId } = data;

        this.validateFile(pdfFile);

        const article = {
            uuid: crypto.randomUUID(),
            title: title.trim(),
            fileName: pdfFile.name,
            fileBlob: pdfFile,
            fileSize: pdfFile.size,
            area: area,
            abstract: abstract ? .trim() || '',
            authorId: authorId,
            status: 'received',
            assignedReviewers: [],
            createdAt: Date.now(),
            updatedAt: Date.now(),
            syncStatus: 'pending',
            version: 1,
            history: [{
                status: 'received',
                timestamp: Date.now(),
                by: authorId,
                note: 'Artículo enviado por el autor'
            }]
        };

        try {
            LoadingIndicator.show('Guardando artículo...');

            const result = await syncManager.save('articles', article, {
                priority: 'high'
            });

            if (NetworkDetector.isOnline() && result.success) {
                await this.uploadPDF(article.uuid, pdfFile);
            } else {
                await this.queuePDFUpload(article.uuid, pdfFile);
            }

            ErrorHandler.success(`Artículo "${article.title}" guardado localmente`);

            return {...article, ...result };

        } catch (error) {
            console.error('❌ Error creando artículo:', error);
            ErrorHandler.error('Error al guardar el artículo');
            throw error;
        } finally {
            LoadingIndicator.hide();
        }
    }

    static async uploadPDF(articleUuid, file) {
        try {
            const result = await apiClient.uploadFile(articleUuid, file);

            await db.articles.update(articleUuid, {
                fileUrl: result.url,
                fileSynced: true,
                syncStatus: 'synced'
            });

            return result;

        } catch (error) {
            console.error('Error subiendo PDF:', error);

            await db.files.add({
                uuid: crypto.randomUUID(),
                articleUuid,
                fileName: file.name,
                fileType: 'pdf',
                blob: file,
                synced: false,
                createdAt: Date.now()
            });

            return { success: false, queued: true };
        }
    }

    static async queuePDFUpload(articleUuid, file) {
        await db.files.add({
            uuid: crypto.randomUUID(),
            articleUuid,
            fileName: file.name,
            fileType: 'pdf',
            blob: file,
            synced: false,
            createdAt: Date.now()
        });

        await syncManager.enqueueSync('files', articleUuid, 'upload', 'normal');
    }

    static async getArticlesByAuthor(authorId) {
        return await db.articles
            .where('authorId').equals(authorId)
            .reverse()
            .sortBy('createdAt');
    }

    static async getAllArticles(forceRefresh = false) {
        if (forceRefresh && NetworkDetector.isOnline()) {
            await this.refreshArticles();
        }

        return await db.articles.orderBy('createdAt').reverse().toArray();
    }

    static async refreshArticles() {
        try {
            const serverArticles = await apiClient.getArticles();

            for (const article of serverArticles) {
                const local = await db.articles.get(article.uuid);

                if (!local || article.version > local.version) {
                    await db.articles.put({
                        ...article,
                        syncStatus: 'synced'
                    });
                }
            }

            console.log('✅ Artículos refrescados desde servidor');

        } catch (error) {
            console.error('Error refrescando artículos:', error);
        }
    }

    static validateFile(file) {
        if (!file) {
            throw new Error('Debe seleccionar un archivo PDF');
        }

        if (file.type !== 'application/pdf') {
            throw new Error('Solo se permiten archivos PDF');
        }

        if (file.size > 10 * 1024 * 1024) {
            const sizeMB = (file.size / 1024 / 1024).toFixed(2);
            throw new Error(`El archivo excede 10MB (tamaño: ${sizeMB}MB)`);
        }
    }

    static formatFileSize(bytes) {
        if (bytes < 1024) return bytes + ' B';
        if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
        return (bytes / (1024 * 1024)).toFixed(2) + ' MB';
    }
}