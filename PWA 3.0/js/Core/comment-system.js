// comment-system.js - Sistema de comentarios consolidados con soporte offline
import { db } from '../../db.js';
import { ReviewService } from '../Services/review-service.js';
import { ErrorHandler } from '../error-handler.js';

export class CommentSystem {

    /**
     * Abre el diálogo de comentarios para un artículo
     */
    static async openCommentsDialog(articleId, viewerRole) {
        const dialog = document.getElementById('viewCommentsDialog');
        const container = document.getElementById('consolidatedComments');
        const titleSpan = document.getElementById('commentsArticleTitle');

        try {
            // Obtener artículo
            const article = await db.articles.get(articleId);
            if (!article) {
                ErrorHandler.error('Artículo no encontrado');
                return;
            }

            titleSpan.textContent = article.title;

            // Renderizar comentarios
            const commentsHTML = await this.renderComments(articleId, viewerRole);
            container.innerHTML = commentsHTML;

            dialog.showModal();

        } catch (error) {
            ErrorHandler.error('Error abriendo comentarios: ' + error.message);
        }
    }

    /**
     * Renderiza comentarios consolidados
     */
    static async renderComments(articleId, viewerRole) {
        try {
            const includeConfidential = (viewerRole === 'editor');
            const reviews = await ReviewService.getReviewsByArticle(articleId, includeConfidential);

            if (reviews.length === 0) {
                return `
          <div class="empty-state">
            <p>📭 No hay revisiones completadas aún.</p>
          </div>
        `;
            }

            // Generar tabla comparativa
            const comparisonHTML = this.renderComparisonTable(reviews);

            // Generar comentarios detallados
            const detailedHTML = this.renderDetailedComments(reviews, includeConfidential);

            // Generar promedios
            const averagesHTML = await this.renderAverages(articleId);

            return `
        ${averagesHTML}
        ${comparisonHTML}
        ${detailedHTML}
      `;

        } catch (error) {
            console.error('Error renderizando comentarios:', error);
            return `<div class="error-message">Error cargando comentarios</div>`;
        }
    }

    /**
     * Renderiza tabla comparativa
     */
    static renderComparisonTable(reviews) {
        const criteriaLabels = {
            originality: 'Originalidad',
            methodology: 'Metodología',
            results: 'Resultados',
            writing: 'Redacción'
        };

        let html = `
      <div class="comparison-section">
        <h4>📊 Tabla Comparativa</h4>
        <div class="comparison-table-container">
          <table class="comparison-table">
            <thead>
              <tr>
                <th>Criterio</th>
    `;

        reviews.forEach((review, index) => {
            html += `<th>Revisor ${index + 1}<br><small>${review.reviewerName}</small></th>`;
        });

        html += `</tr></thead><tbody>`;

        // Filas de scores
        Object.entries(criteriaLabels).forEach(([key, label]) => {
            html += `<tr><td><strong>${label}</strong></td>`;

            reviews.forEach(review => {
                const score = review.scores ? .[key] || 0;
                const scoreClass = score >= 4 ? 'score-high' : score >= 3 ? 'score-medium' : 'score-low';
                html += `<td class="${scoreClass}">${score} ⭐</td>`;
            });

            html += `</tr>`;
        });

        // Fila de recomendaciones
        html += `<tr><td><strong>Recomendación</strong></td>`;
        reviews.forEach(review => {
            const recClass = `recommendation-${review.recommendation}`;
            const recText = this.getRecommendationText(review.recommendation);
            html += `<td><span class="recommendation-badge ${recClass}">${recText}</span></td>`;
        });
        html += `</tr>`;

        html += `</tbody></table></div></div>`;

        return html;
    }

    /**
     * Renderiza promedios
     */
    static async renderAverages(articleId) {
        const averages = await ReviewService.calculateAverages(articleId);

        if (!averages) return '';

        return `
      <div class="averages-section">
        <h4>📈 Promedios</h4>
        <div class="averages-grid">
          <div class="average-item">
            <span class="average-label">Originalidad:</span>
            <span class="average-value">${averages.originality} ⭐</span>
          </div>
          <div class="average-item">
            <span class="average-label">Metodología:</span>
            <span class="average-value">${averages.methodology} ⭐</span>
          </div>
          <div class="average-item">
            <span class="average-label">Resultados:</span>
            <span class="average-value">${averages.results} ⭐</span>
          </div>
          <div class="average-item">
            <span class="average-label">Redacción:</span>
            <span class="average-value">${averages.writing} ⭐</span>
          </div>
          <div class="average-item total">
            <span class="average-label">PROMEDIO TOTAL:</span>
            <span class="average-value">${averages.overall} ⭐</span>
          </div>
        </div>
      </div>
    `;
    }

    /**
     * Renderiza comentarios detallados
     */
    static renderDetailedComments(reviews, includeConfidential) {
        let html = `<div class="detailed-comments-section"><h4>💬 Comentarios Detallados</h4>`;

        reviews.forEach((review, index) => {
            const date = new Date(review.submittedAt).toLocaleDateString('es-ES', {
                year: 'numeric',
                month: 'long',
                day: 'numeric'
            });

            html += `
        <div class="comment-card">
          <div class="comment-header">
            <div class="reviewer-info">
              <span class="reviewer-avatar">👤</span>
              <div>
                <strong>${review.reviewerName}</strong>
                <small>${date}</small>
              </div>
            </div>
            <span class="recommendation-badge recommendation-${review.recommendation}">
              ${this.getRecommendationText(review.recommendation)}
            </span>
          </div>
          
          <div class="comment-body">
            <h5>Comentarios para el Autor:</h5>
            <p class="comment-text">${this.formatComment(review.comments)}</p>
          </div>
      `;

            if (includeConfidential && review.confidentialComments) {
                html += `
          <div class="confidential-comments">
            <h5>🔒 Comentarios Confidenciales (solo editor):</h5>
            <p class="comment-text">${this.formatComment(review.confidentialComments)}</p>
          </div>
        `;
            }

            html += `</div>`;
        });

        html += `</div>`;
        return html;
    }

    /**
     * Formatea comentarios
     */
    static formatComment(text) {
        if (!text) return '<em>Sin comentarios</em>';
        return text
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/\n/g, '<br>');
    }

    /**
     * Obtiene texto de recomendación
     */
    static getRecommendationText(recommendation) {
        const texts = {
            accept: '✅ Aceptar',
            minor_changes: '🟡 Cambios Menores',
            major_changes: '🟠 Cambios Mayores',
            reject: '❌ Rechazar'
        };
        return texts[recommendation] || '❓ Sin especificar';
    }
}

// Hacer disponible globalmente
window.CommentSystem = CommentSystem;