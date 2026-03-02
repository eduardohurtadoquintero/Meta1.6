// Sistema de Comentarios para Revisiones
import { db } from '../db.js';
import { ErrorHandler } from './error-handler.js';

export class CommentSystem {
  
  /**
   * Renderiza comentarios consolidados de todos los revisores
   * @param {string} articleId - ID del artículo
   * @param {string} viewerRole - Rol del que ve los comentarios (author/editor)
   * @returns {string} HTML con los comentarios
   */
  static async renderComments(articleId, viewerRole = 'author') {
    try {
      const reviews = await db.reviews
        .where('articleId').equals(articleId)
        .and(r => r.status === 'submitted')
        .toArray();
      
      if (reviews.length === 0) {
        return `
          <div class="empty-state">
            <p>No hay revisiones completadas aún.</p>
          </div>
        `;
      }
      
      // Enriquecer con datos del revisor
      const enrichedReviews = await Promise.all(
        reviews.map(async (review) => {
          const reviewer = await db.reviewers.get(review.reviewerId);
          return { ...review, reviewer };
        })
      );
      
      // Generar tabla comparativa
      const comparisonTable = this.generateComparisonTable(enrichedReviews);
      
      // Generar HTML
      let html = '';
      
      // Tabla comparativa de scores
      html += this.renderComparisonTable(comparisonTable, enrichedReviews);
      
      // Comentarios detallados de cada revisor
      html += this.renderDetailedComments(enrichedReviews, viewerRole);
      
      return html;
      
    } catch (error) {
      console.error('Error renderizando comentarios:', error);
      return `<div class="error-message">Error cargando comentarios</div>`;
    }
  }
  
  /**
   * Genera tabla comparativa de scores
   */
  static generateComparisonTable(reviews) {
    const criteria = ['originality', 'methodology', 'results', 'writing'];
    const table = {};
    
    criteria.forEach(criterion => {
      table[criterion] = reviews.map(r => r.scores[criterion]);
    });
    
    // Calcular promedios
    table.averages = {};
    criteria.forEach(criterion => {
      const scores = table[criterion];
      const avg = scores.reduce((sum, val) => sum + val, 0) / scores.length;
      table.averages[criterion] = avg.toFixed(1);
    });
    
    return table;
  }
  
  /**
   * Renderiza tabla HTML con scores comparativos
   */
  static renderComparisonTable(table, reviews) {
    const criteriaLabels = {
      originality: 'Originalidad',
      methodology: 'Metodología',
      results: 'Resultados',
      writing: 'Redacción'
    };
    
    let html = `
      <div class="comparison-section">
        <h4>📊 Tabla Comparativa de Evaluaciones</h4>
        <div class="comparison-table-container">
          <table class="comparison-table">
            <thead>
              <tr>
                <th>Criterio</th>
    `;
    
    // Headers con nombre de revisores
    reviews.forEach((review, index) => {
      html += `<th>Revisor ${index + 1}<br><small>${review.reviewer?.name || 'Anónimo'}</small></th>`;
    });
    html += `<th class="avg-column">Promedio</th></tr></thead><tbody>`;
    
    // Filas con scores
    Object.keys(criteriaLabels).forEach(criterion => {
      html += `<tr><td><strong>${criteriaLabels[criterion]}</strong></td>`;
      
      table[criterion].forEach(score => {
        const scoreClass = score >= 4 ? 'score-high' : score >= 3 ? 'score-medium' : 'score-low';
        html += `<td class="${scoreClass}">${score} ⭐</td>`;
      });
      
      const avgClass = table.averages[criterion] >= 4 ? 'score-high' : 
                       table.averages[criterion] >= 3 ? 'score-medium' : 'score-low';
      html += `<td class="avg-column ${avgClass}"><strong>${table.averages[criterion]} ⭐</strong></td>`;
      html += `</tr>`;
    });
    
    // Fila de recomendación
    html += `<tr><td><strong>Recomendación</strong></td>`;
    reviews.forEach(review => {
      const recIcon = this.getRecommendationIcon(review.recommendation);
      const recText = this.getRecommendationText(review.recommendation);
      html += `<td><span class="recommendation-badge recommendation-${review.recommendation}">${recIcon} ${recText}</span></td>`;
    });
    html += `<td class="avg-column">-</td></tr>`;
    
    html += `</tbody></table></div></div>`;
    
    return html;
  }
  
  /**
   * Renderiza comentarios detallados de cada revisor
   */
  static renderDetailedComments(reviews, viewerRole) {
    let html = `<div class="detailed-comments-section"><h4>💬 Comentarios Detallados</h4>`;
    
    reviews.forEach((review, index) => {
      const reviewerName = review.reviewer?.name || `Revisor ${index + 1}`;
      const reviewDate = new Date(review.submittedAt).toLocaleDateString('es-ES', {
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
                <strong>${reviewerName}</strong>
                <small>${reviewDate}</small>
              </div>
            </div>
            <span class="recommendation-badge recommendation-${review.recommendation}">
              ${this.getRecommendationIcon(review.recommendation)} ${this.getRecommendationText(review.recommendation)}
            </span>
          </div>
          
          <div class="comment-body">
            <h5>Comentarios para el Autor:</h5>
            <p class="comment-text">${this.formatComment(review.comments)}</p>
          </div>
      `;
      
      // Comentarios confidenciales solo para editor
      if (viewerRole === 'editor' && review.confidentialComments) {
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
   * Formatea comentarios (convierte saltos de línea a <br>)
   */
  static formatComment(text) {
    if (!text) return '';
    return text
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/\n/g, '<br>');
  }
  
  /**
   * Obtiene icono según recomendación
   */
  static getRecommendationIcon(recommendation) {
    const icons = {
      accept: '✅',
      minor_changes: '🟡',
      major_changes: '🟠',
      reject: '❌'
    };
    return icons[recommendation] || '❓';
  }
  
  /**
   * Obtiene texto según recomendación
   */
  static getRecommendationText(recommendation) {
    const texts = {
      accept: 'Aceptar',
      minor_changes: 'Cambios Menores',
      major_changes: 'Cambios Mayores',
      reject: 'Rechazar'
    };
    return texts[recommendation] || 'Sin especificar';
  }
  
  /**
   * Abre modal de comentarios
   */
  static async openCommentsDialog(articleId, viewerRole = 'author') {
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
}
