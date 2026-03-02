// review-service.js - Versión completa con todas las funcionalidades
import { db } from '../../db.js';
import { syncManager } from '../Core/SyncManager.js';
import { NetworkDetector } from '../Utiles/network-detector.js';
import { apiClient } from './api-client.js';
import { ErrorHandler } from '../error-handler.js';
import { LoadingIndicator } from '../loading-indicator.js';

export class ReviewService {

    /**
     * Guarda una revisión (borrador o completa)
     */
    static async saveReview(reviewData, status = 'draft') {
        const { articleId, reviewerId, scores, recommendation, comments, confidentialComments } = reviewData;

        // Validaciones
        if (!articleId || !reviewerId) {
            throw new Error('Faltan datos requeridos');
        }

        if (status === 'submitted') {
            if (!recommendation) {
                throw new Error('Debe seleccionar una recomendación');
            }
            if (!comments || comments.length < 100) {
                throw new Error('Los comentarios deben tener al menos 100 caracteres');
            }
        }

        // Buscar revisión existente
        const existingReview = await db.reviews
            .where({ articleId, reviewerId })
            .first();

        const now = Date.now();

        // Construir objeto de revisión
        const review = {
            uuid: existingReview ? .uuid || crypto.randomUUID(),
            articleId,
            reviewerId,
            scores: scores || {
                originality: 3,
                methodology: 3,
                results: 3,
                writing: 3
            },
            recommendation: recommendation || existingReview ? .recommendation || '',
            comments: comments || existingReview ? .comments || '',
            confidentialComments: confidentialComments || existingReview ? .confidentialComments || '',
            status: status,
            createdAt: existingReview ? .createdAt || now,
            submittedAt: status === 'submitted' ? now : existingReview ? .submittedAt,
            lastModified: now,
            syncStatus: 'pending',
            version: (existingReview ? .version || 0) + 1,
        };

        try {
            LoadingIndicator.show(status === 'submitted' ? 'Enviando revisión...' : 'Guardando borrador...');

            // Guardar localmente
            const result = await syncManager.save('reviews', review, {
                priority: status === 'submitted' ? 'high' : 'normal'
            });

            // Si es envío final, verificar estado del artículo
            if (status === 'submitted') {
                await this.checkAndUpdateArticleStatus(articleId);

                // Si hay conexión, intentar sync inmediato
                if (NetworkDetector.isOnline()) {
                    await this.syncReview(review.uuid);
                }
            }

            const message = status === 'submitted' ?
                '✅ Revisión enviada exitosamente' :
                '📝 Borrador guardado';

            ErrorHandler.success(message);

            return {...review, ...result };

        } catch (error) {
            console.error('❌ Error guardando revisión:', error);
            ErrorHandler.error('Error al guardar la revisión');
            throw error;
        } finally {
            LoadingIndicator.hide();
        }
    }

    /**
     * Sincroniza una revisión específica
     */
    static async syncReview(reviewUuid) {
        try {
            const review = await db.reviews.get(reviewUuid);
            if (!review) return;

            const result = await apiClient.syncEntity('reviews', review);

            if (result.success) {
                await db.reviews.update(reviewUuid, {
                    syncStatus: 'synced',
                    remoteId: result.remoteId,
                    lastSynced: Date.now()
                });
            }

            return result;

        } catch (error) {
            console.error('Error sincronizando revisión:', error);
            return { success: false };
        }
    }

    /**
     * Obtiene las revisiones de un artículo
     */
    static async getReviewsByArticle(articleId, includeConfidential = false) {
        try {
            const reviews = await db.reviews
                .where('articleId').equals(articleId)
                .and(r => r.status === 'submitted')
                .reverse()
                .sortBy('submittedAt');

            // Enriquecer con datos del revisor
            const enrichedReviews = await Promise.all(
                reviews.map(async(review) => {
                    const reviewer = await db.reviewers.get(review.reviewerId);

                    // Si no incluye confidenciales, los removemos
                    const reviewData = {...review };
                    if (!includeConfidential) {
                        delete reviewData.confidentialComments;
                    }

                    return {
                        ...reviewData,
                        reviewerName: reviewer ? .name || 'Revisor',
                        reviewerEmail: reviewer ? .email,
                        reviewerExpertise: reviewer ? .expertise || []
                    };
                })
            );

            return enrichedReviews;

        } catch (error) {
            console.error('Error obteniendo revisiones:', error);
            return [];
        }
    }

    /**
     * Obtiene la revisión de un revisor para un artículo
     */
    static async getMyReview(articleId, reviewerId) {
        return await db.reviews
            .where({ articleId, reviewerId })
            .first();
    }

    /**
     * Obtiene artículos asignados a un revisor
     */
    static async getAssignedArticles(reviewerId) {
        try {
            const articles = await db.articles
                .where('assignedReviewers')
                .equals(reviewerId)
                .reverse()
                .sortBy('createdAt');

            // Añadir estado de revisión
            const articlesWithStatus = await Promise.all(
                articles.map(async(article) => {
                    const review = await db.reviews
                        .where({ articleId: article.uuid, reviewerId })
                        .first();

                    return {
                        ...article,
                        reviewStatus: review ? .status || 'pending',
                        reviewUuid: review ? .uuid,
                        isDraft: review ? .status === 'draft',
                        isSubmitted: review ? .status === 'submitted'
                    };
                })
            );

            return articlesWithStatus;

        } catch (error) {
            console.error('Error obteniendo artículos asignados:', error);
            return [];
        }
    }

    /**
     * Verifica si todas las revisiones están completas
     */
    static async checkAndUpdateArticleStatus(articleId) {
        try {
            const article = await db.articles.get(articleId);
            if (!article) return;

            const submittedReviews = await db.reviews
                .where('articleId').equals(articleId)
                .and(r => r.status === 'submitted')
                .count();

            const totalReviewers = article.assignedReviewers ? .length || 0;

            // Si hay al menos 2 revisiones o todas las asignadas, actualizar estado
            if ((submittedReviews >= 2 || submittedReviews === totalReviewers) &&
                article.status !== 'reviewed') {

                await db.articles.update(articleId, {
                    status: 'reviewed',
                    updatedAt: Date.now(),
                    syncStatus: 'pending',
                    history: [
                        ...(article.history || []),
                        {
                            status: 'reviewed',
                            timestamp: Date.now(),
                            note: `${submittedReviews} de ${totalReviewers} revisiones completadas`
                        }
                    ]
                });

                // Encolar para sync
                await syncManager.enqueueSync('articles', articleId, 'update', 'high');

                // Disparar evento
                window.dispatchEvent(new CustomEvent('article-reviewed', {
                    detail: { articleId, reviewsCount: submittedReviews }
                }));

                return true;
            }

            return false;

        } catch (error) {
            console.error('Error actualizando estado del artículo:', error);
            return false;
        }
    }

    /**
     * Calcula promedios de scores
     */
    static async calculateAverages(articleId) {
        const reviews = await this.getReviewsByArticle(articleId, false);

        if (reviews.length === 0) {
            return null;
        }

        const criteria = ['originality', 'methodology', 'results', 'writing'];
        const averages = {};
        let totalSum = 0;
        let totalCount = 0;

        criteria.forEach(criterion => {
            const sum = reviews.reduce((acc, review) => {
                const score = review.scores ? .[criterion] || 0;
                if (score > 0) {
                    totalSum += score;
                    totalCount++;
                }
                return acc + score;
            }, 0);

            averages[criterion] = (sum / reviews.length).toFixed(1);
        });

        // Promedio general
        averages.overall = (totalSum / totalCount).toFixed(1);

        return averages;
    }

    /**
     * Obtiene estadísticas del revisor
     */
    static async getReviewerStats(reviewerId) {
        const myReviews = await db.reviews
            .where('reviewerId').equals(reviewerId)
            .toArray();

        const completed = myReviews.filter(r => r.status === 'submitted').length;
        const drafts = myReviews.filter(r => r.status === 'draft').length;

        // Artículos asignados pendientes
        const assigned = await db.articles
            .where('assignedReviewers')
            .equals(reviewerId)
            .count();

        const pending = assigned - completed;

        // Tiempo promedio de respuesta
        const completedWithTime = myReviews.filter(r => r.submittedAt && r.createdAt);
        let avgResponseTime = 0;

        if (completedWithTime.length > 0) {
            const totalTime = completedWithTime.reduce((sum, r) => {
                return sum + (r.submittedAt - r.createdAt);
            }, 0);
            avgResponseTime = totalTime / completedWithTime.length / (1000 * 60 * 60 * 24);
        }

        return {
            total: myReviews.length,
            completed,
            drafts,
            pending,
            assigned,
            avgResponseTime: avgResponseTime.toFixed(1)
        };
    }

    /**
     * Elimina un borrador
     */
    static async deleteDraft(reviewUuid) {
        try {
            const review = await db.reviews.get(reviewUuid);

            if (!review || review.status !== 'draft') {
                throw new Error('No se puede eliminar esta revisión');
            }

            await db.reviews.delete(reviewUuid);

            // Encolar eliminación para sync
            await syncManager.enqueueSync('reviews', reviewUuid, 'delete', 'normal');

            ErrorHandler.success('Borrador eliminado');

            return true;

        } catch (error) {
            ErrorHandler.error('Error eliminando borrador');
            return false;
        }
    }
}