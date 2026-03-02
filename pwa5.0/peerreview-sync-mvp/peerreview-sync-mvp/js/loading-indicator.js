// Indicador de carga global

class LoadingIndicator {
  static show(text = 'Cargando...') {
    const indicator = document.getElementById('loadingIndicator');
    const loadingText = document.getElementById('loadingText');
    
    if (loadingText) {
      loadingText.textContent = text;
    }
    
    if (indicator) {
      indicator.classList.remove('hidden');
    }
  }
  
  static hide() {
    const indicator = document.getElementById('loadingIndicator');
    if (indicator) {
      indicator.classList.add('hidden');
    }
  }
}

export { LoadingIndicator };
