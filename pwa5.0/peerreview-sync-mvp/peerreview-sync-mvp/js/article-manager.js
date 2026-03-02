import { db } from '../db.js';
import { ErrorHandler } from './error-handler.js';
import { LoadingIndicator } from './loading-indicator.js';
import { SyncManager } from './sync-manager.js';

// Constantes de validación
const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB
const ALLOWED_TYPE = 'application/pdf';

export class ArticleManager {
  
  /**
   * Crea nuevo artículo (subido por AUTOR) con sincronización
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
      authorId: authorId,
      status: 'received',
      assignedReviewers: [],
      synced: false, // No sincronizado inicialmente
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
      LoadingIndicator.show('Guardando artículo...');
      
      // Guardar localmente primero
      await db.articles.add(article);
      console.log('✅ Artículo guardado localmente:', article.id);
      
      // Encolar para sincronización
      const articleForSync = {
        ...article,
        fileBlob: null // No enviar el Blob al servidor en este mock
      };
      
      await SyncManager.queueOperation(
        'create',
        'article',
        article.id,
        articleForSync
      );
      
      ErrorHandler.success('Artículo guardado. Se sincronizará automáticamente.');
      
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
   * Asigna revisores a un artículo (solo editor) con sincronización
   */
  static async assignReviewers(articleId, reviewerIds, editorId) {
    if (reviewerIds.length < 2 || reviewerIds.length > 3) {
      throw new Error('Debe asignar entre 2 y 3 revisores');
    }
    
    try {
      LoadingIndicator.show('Asignando revisores...');
      
      const article = await db.articles.get(articleId);
      const oldReviewers = article.assignedReviewers || [];
      
      // Actualizar artículo localmente
      const updatedData = {
        assignedReviewers: reviewerIds,
        status: 'in_review',
        updatedAt: Date.now(),
        synced: false,
        history: [
          ...article.history,
          {
            status: 'in_review',
            timestamp: Date.now(),
            by: editorId,
            note: `Asignados ${reviewerIds.length} revisores`
          }
        ]
      };
      
      await db.articles.update(articleId, updatedData);
      
      // Encolar para sincronización
      await SyncManager.queueOperation(
        'update',
        'article',
        articleId,
        { ...article, ...updatedData, fileBlob: null }
      );
      
      console.log('✅ Revisores asignados localmente y encolado para sync');
      
    } catch (error) {
      console.error('❌ Error asignando revisores:', error);
      throw new Error('No se pudieron asignar los revisores');
    } finally {
      LoadingIndicator.hide();
    }
  }
  
  /**
   * Elimina artículo (solo autor o editor) con sincronización
   */
  static async deleteArticle(id) {
    try {
      LoadingIndicator.show('Eliminando artículo...');
      
      // Guardar referencia antes de eliminar
      const article = await db.articles.get(id);
      
      if (!article) {
        throw new Error('Artículo no encontrado');
      }
      
      // Eliminar localmente
      await db.articles.delete(id);
      
      // Encolar para sincronización
      await SyncManager.queueOperation(
        'delete',
        'article',
        id,
        null
      );
      
      console.log('✅ Artículo eliminado localmente y encolado para sync');
      
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
   * Cambia estado del artículo (solo editor) con sincronización
   */
  static async changeStatus(articleId, newStatus, editorId, note = '') {
    try {
      const article = await this.getArticleById(articleId);
      if (!article) {
        throw new Error('Artículo no encontrado');
      }
      
      const updatedData = {
        status: newStatus,
        updatedAt: Date.now(),
        synced: false,
        history: [
          ...article.history,
          {
            status: newStatus,
            timestamp: Date.now(),
            by: editorId,
            note: note || `Estado cambiado a ${newStatus}`
          }
        ]
      };
      
      await db.articles.update(articleId, updatedData);
      
      // Encolar para sincronización
      await SyncManager.queueOperation(
        'update',
        'article',
        articleId,
        { ...article, ...updatedData, fileBlob: null }
      );
      
      console.log(`✅ Estado del artículo ${articleId} cambiado localmente y encolado`);
      
    } catch (error) {
      console.error('Error cambiando estado:', error);
      throw error;
    }
  }
}
