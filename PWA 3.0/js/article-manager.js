import { db } from '../db.js';
import { ErrorHandler } from './error-handler.js';
import { LoadingIndicator } from './loading-indicator.js';

// Constantes de validación
const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB
const ALLOWED_TYPE = 'application/pdf';

export class ArticleManager {
  
  /**
   * Crea nuevo artículo (subido por AUTOR)
   * @param {Object} data - {title, area, pdfFile, abstract, authorId}
   * @returns {Promise<Object>} Artículo creado
   */
  static async createArticle(data) {
    const { title, area, pdfFile, abstract, authorId } = data;
    
    // Validar archivo
    this.validateFile(pdfFile);
    
    // Crear artículo
    const article = {
      id: crypto.randomUUID(),
      title: title.trim(),
      fileName: pdfFile.name,
      fileBlob: pdfFile,
      fileSize: pdfFile.size,
      area: area,
      abstract: abstract?.trim() || '',
      authorId: authorId, // ID del autor que lo sube
      status: 'received', // Estados: received, in_review, reviewed, accepted, rejected
      assignedReviewers: [],
      createdAt: Date.now(),
      updatedAt: Date.now(),
      history: [
        {
          status: 'received',
          timestamp: Date.now(),
          by: authorId,
          note: 'Artículo enviado por el autor'
        }
      ],
      versions: []
    };
    
    try {
      LoadingIndicator.show('Enviando artículo...');
      await db.articles.add(article);
      console.log('✅ Artículo creado:', article.id);
      return article;
      
    } catch (error) {
      console.error('❌ Error guardando artículo:', error);
      throw new Error('No se pudo guardar el artículo');
    } finally {
      LoadingIndicator.hide();
    }
  }
  
  /**
   * Valida archivo PDF
   */
  static validateFile(file) {
    if (!file) {
      throw new Error('Debe seleccionar un archivo PDF');
    }
    
    if (file.type !== ALLOWED_TYPE) {
      throw new Error(`Solo se permiten archivos PDF. Tipo recibido: ${file.type}`);
    }
    
    if (file.size > MAX_FILE_SIZE) {
      const sizeMB = (file.size / 1024 / 1024).toFixed(2);
      throw new Error(`El archivo excede 10MB (tamaño: ${sizeMB}MB)`);
    }
    
    if (!file.name.toLowerCase().endsWith('.pdf')) {
      throw new Error('El archivo debe tener extensión .pdf');
    }
  }
  
  /**
   * Obtiene artículos del autor actual
   */
  static async getArticlesByAuthor(authorId) {
    return await db.articles
      .where('authorId').equals(authorId)
      .reverse()
      .sortBy('createdAt');
  }
  
  /**
   * Obtiene todos los artículos (para editor)
   */
  static async getAllArticles() {
    return await db.articles.orderBy('createdAt').reverse().toArray();
  }
  
  /**
   * Obtiene artículos filtrados por estado
   */
  static async getArticlesByStatus(status) {
    if (status === 'all') {
      return await this.getAllArticles();
    }
    return await db.articles.where('status').equals(status).reverse().sortBy('createdAt');
  }
  
  /**
   * Obtiene artículos asignados a un revisor
   */
  static async getArticlesByReviewer(reviewerId) {
    return await db.articles
      .where('assignedReviewers')
      .equals(reviewerId)
      .reverse()
      .sortBy('createdAt');
  }
  
  /**
   * Obtiene artículo por ID
   */
  static async getArticleById(id) {
    return await db.articles.get(id);
  }
  
  /**
   * Asigna revisores a un artículo (solo editor)
   */
  static async assignReviewers(articleId, reviewerIds, editorId) {
    if (reviewerIds.length < 2 || reviewerIds.length > 3) {
      throw new Error('Debe asignar entre 2 y 3 revisores');
    }
    
    try {
      LoadingIndicator.show('Asignando revisores...');
      
      await db.transaction('rw', [db.articles, db.reviewers], async () => {
        // Actualizar artículo
        const article = await db.articles.get(articleId);
        const oldReviewers = article.assignedReviewers || [];
        
        await db.articles.update(articleId, {
          assignedReviewers: reviewerIds,
          status: 'in_review',
          updatedAt: Date.now(),
          history: [
            ...article.history,
            {
              status: 'in_review',
              timestamp: Date.now(),
              by: editorId,
              note: `Asignados ${reviewerIds.length} revisores`
            }
          ]
        });
        
        // Actualizar revisores (remover viejos)
        for (const rid of oldReviewers) {
          if (!reviewerIds.includes(rid)) {
            const reviewer = await db.reviewers.get(rid);
            if (reviewer) {
              await db.reviewers.update(rid, {
                assignedArticles: reviewer.assignedArticles.filter(id => id !== articleId)
              });
            }
          }
        }
        
        // Actualizar revisores (agregar nuevos)
        for (const rid of reviewerIds) {
          if (!oldReviewers.includes(rid)) {
            const reviewer = await db.reviewers.get(rid);
            if (reviewer) {
              await db.reviewers.update(rid, {
                assignedArticles: [...(reviewer.assignedArticles || []), articleId]
              });
            }
          }
        }
      });
      
      console.log('✅ Revisores asignados a artículo:', articleId);
      
    } catch (error) {
      console.error('❌ Error asignando revisores:', error);
      throw new Error('No se pudieron asignar los revisores');
    } finally {
      LoadingIndicator.hide();
    }
  }
  
  /**
   * Elimina artículo (solo autor o editor)
   */
  static async deleteArticle(id) {
    try {
      LoadingIndicator.show('Eliminando artículo...');
      
      // Eliminar revisiones asociadas
      await db.reviews.where('articleId').equals(id).delete();
      
      // Eliminar artículo
      await db.articles.delete(id);
      
      console.log('✅ Artículo eliminado:', id);
      
    } catch (error) {
      console.error('❌ Error eliminando artículo:', error);
      throw new Error('No se pudo eliminar el artículo');
    } finally {
      LoadingIndicator.hide();
    }
  }
  
  /**
   * Cuenta artículos por estado
   */
  static async countByStatus() {
    const all = await db.articles.count();
    const received = await db.articles.where('status').equals('received').count();
    const in_review = await db.articles.where('status').equals('in_review').count();
    const reviewed = await db.articles.where('status').equals('reviewed').count();
    
    return { all, received, in_review, reviewed };
  }
  
  /**
   * Formatea tamaño de archivo
   */
  static formatFileSize(bytes) {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / (1024 * 1024)).toFixed(2) + ' MB';
  }
  
  /**
   * Descarga PDF del artículo
   */
  static async downloadPDF(articleId) {
    try {
      const article = await this.getArticleById(articleId);
      if (!article || !article.fileBlob) {
        throw new Error('Artículo o PDF no encontrado');
      }
      
      const url = URL.createObjectURL(article.fileBlob);
      const a = document.createElement('a');
      a.href = url;
      a.download = article.fileName;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      
      ErrorHandler.success('PDF descargado exitosamente');
    } catch (error) {
      ErrorHandler.error('Error al descargar PDF: ' + error.message);
    }
  }
  
  /**
   * Cambia estado del artículo (solo editor)
   */
  static async changeStatus(articleId, newStatus, editorId, note = '') {
    try {
      const article = await this.getArticleById(articleId);
      if (!article) {
        throw new Error('Artículo no encontrado');
      }
      
      await db.articles.update(articleId, {
        status: newStatus,
        updatedAt: Date.now(),
        history: [
          ...article.history,
          {
            status: newStatus,
            timestamp: Date.now(),
            by: editorId,
            note: note || `Estado cambiado a ${newStatus}`
          }
        ]
      });
      
      console.log(`✅ Estado del artículo ${articleId} cambiado a ${newStatus}`);
      
    } catch (error) {
      console.error('Error cambiando estado:', error);
      throw error;
    }
  }
}
