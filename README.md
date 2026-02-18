# Sistema de Revisión por Pares - MVP

PWA (Progressive Web App) para gestión de revisión por pares de artículos científicos.

## 📋 Características

- ✅ **Offline-first**: Funciona completamente sin conexión
- ✅ **Instalable**: Se puede instalar como app nativa en móvil y desktop
- ✅ **Persistencia local**: Datos guardados en IndexedDB del navegador
- ✅ **Responsive**: Optimizado para móvil, tablet y desktop
- ✅ **Sin backend**: No requiere servidor, todo funciona localmente

## 🚀 Instalación y Configuración

### Opción 1: Visual Studio Code + Live Server (Recomendado)

1. **Instalar VS Code**
   - Descarga desde: https://code.visualstudio.com/

2. **Instalar extensión Live Server**
   - Abre VS Code
   - Ve a Extensions (Ctrl+Shift+X)
   - Busca "Live Server" de Ritwick Dey
   - Click en Install

3. **Abrir el proyecto**
   - File > Open Folder
   - Selecciona la carpeta `peerreview-mvp`

4. **Ejecutar la app**
   - Click derecho en `index.html`
   - Selecciona "Open with Live Server"
   - Se abrirá automáticamente en http://127.0.0.1:5500

### Opción 2: Python HTTP Server

```bash
cd peerreview-mvp
python3 -m http.server 8000
```

Luego abre: http://localhost:8000

### Opción 3: Node.js Live Server

```bash
cd peerreview-mvp
npx live-server
```

## 📁 Estructura del Proyecto

```
peerreview-mvp/
├── index.html              # Página principal
├── manifest.json           # Configuración PWA
├── sw.js                   # Service Worker (cache offline)
├── db.js                   # Configuración IndexedDB
├── js/
│   ├── app.js              # Lógica principal de la aplicación
│   ├── article-manager.js  # Gestión de artículos
│   ├── error-handler.js    # Manejo de errores y toasts
│   └── loading-indicator.js # Indicadores de carga
└── css/
    ├── main.css            # Estilos principales
    └── components.css      # Componentes (toast, loading, etc)
```

## 🧪 Cómo Probar la Aplicación

### Test 1: Subir un artículo

1. Completa el formulario:
   - **Título**: "Análisis de Algoritmos de Machine Learning"
   - **Área**: Machine Learning
   - **Autor**: Miguel Torres
   - **Email**: miguel.torres@universidad.edu
   - **PDF**: Selecciona cualquier PDF (máx 10MB)

2. Click en "📤 Subir Artículo"

3. Verifica:
   - ✅ Toast verde de confirmación
   - ✅ Formulario se limpia
   - ✅ Artículo aparece en la lista con badge "RECIBIDO"

### Test 2: Verificar persistencia

1. Refresca la página (F5)
2. El artículo debe seguir ahí
3. Abre DevTools (F12) > Application > IndexedDB > PeerReviewDB
4. Verás el artículo con su PDF como Blob

### Test 3: Modo offline

1. DevTools > Network tab
2. Marca checkbox "Offline"
3. Refresca la página (F5)
4. La app sigue funcionando ✅
5. Banner amarillo dice "Sin conexión"

### Test 4: Descargar PDF

1. Click en botón 📥 del artículo
2. El PDF se descarga automáticamente

### Test 5: Eliminar artículo

1. Click en botón 🗑️
2. Confirma la eliminación
3. El artículo desaparece

### Test 6: Filtros

1. Sube varios artículos
2. Click en filtros: "Todos", "Recibidos", etc.
3. Los contadores se actualizan

### Test 7: Cambio de rol

1. Cambia selector de rol a "Revisora" o "Autor"
2. El formulario de subir desaparece (solo editores pueden subir)

## 📱 Instalar como PWA

### Chrome (Desktop):
1. Ícono de instalación en la barra de direcciones
2. Click en "Install" / "Instalar"
3. Se abre en ventana independiente

### Chrome (Android):
1. Menú (⋮) > "Add to Home screen"
2. Confirma
3. Ícono aparece en pantalla de inicio

### Safari (iOS):
1. Botón compartir (cuadrado con flecha)
2. "Add to Home Screen"
3. Confirma

## 🛠️ Tecnologías Utilizadas

- **Frontend**: HTML5, CSS3, Vanilla JavaScript (ES6+)
- **PWA**: Service Worker, Cache API, Web App Manifest
- **Persistencia**: IndexedDB vía Dexie.js (50KB)
- **Dependencias**: Solo Dexie.js desde CDN
- **Sin frameworks**: React, Vue, Angular, etc.
- **Sin build tools**: No webpack, babel, etc.

## ⚙️ Configuración

### Cambiar versión del cache (Service Worker)

Edita `sw.js`:
```javascript
const CACHE_NAME = 'peerreview-v1.1'; // Cambia la versión
```

### Agregar más revisores

Edita `db.js` en la sección `db.on('populate')`:
```javascript
{
  id: crypto.randomUUID(),
  name: "Dr. Nuevo Revisor",
  email: "nuevo@universidad.edu",
  expertise: ["AI", "ML"],
  assignedArticles: []
}
```

### Cambiar límite de tamaño de PDF

Edita `js/article-manager.js`:
```javascript
const MAX_FILE_SIZE = 20 * 1024 * 1024; // 20MB
```

## 🐛 Troubleshooting

### "Dexie is not defined"
❌ Estás abriendo con file://  
✅ Usa servidor local (Live Server, Python, etc.)

### Service Worker no se registra
❌ No funciona en file://  
✅ Requiere http://localhost o https://

### Los estilos no se aplican
1. Verifica que los archivos CSS estén en `/css/`
2. Hard refresh: Ctrl+Shift+R (Windows) o Cmd+Shift+R (Mac)

### IndexedDB no guarda
1. DevTools > Console (busca errores)
2. Limpia IndexedDB: DevTools > Application > IndexedDB > Delete database
3. Refresca la página

### "Cannot use import statement"
✅ Verifica que los `<script>` tengan `type="module"`

## 📊 Datos de Prueba

Al iniciar por primera vez, se crean automáticamente 5 revisores:

1. Dra. Ana Rodríguez (AI, ML)
2. Dr. Carlos Martínez (DataScience, IoT)
3. Dr. Luis Fernández (Cybersecurity, SoftwareEngineering)
4. Dra. María González (AI, DataScience)
5. Dr. Roberto Silva (ML, IoT)

## 🔒 Seguridad y Privacidad

- ⚠️ **No usar en producción sin modificaciones**
- ⚠️ No hay autenticación real (simulación con roles)
- ⚠️ Todos los datos son locales al navegador/dispositivo
- ⚠️ No hay sincronización entre dispositivos
- ✅ Los PDFs nunca salen del dispositivo
- ✅ IndexedDB aislado por origen (mismo dominio)

## 🚧 Limitaciones del MVP

**Este MVP NO incluye:**
- ❌ Asignación automática de revisores
- ❌ Notificaciones push o por email
- ❌ Backend/base de datos en servidor
- ❌ Autenticación real con usuarios
- ❌ Sincronización multi-dispositivo
- ❌ Gestión de conflictos de interés
- ❌ Sistema de certificados para revisores
- ❌ Estadísticas avanzadas o reportes

**Estas features están planificadas para sprints posteriores (post-MVP).**

## 📅 Roadmap

### ✅ Sprint 1 (Completado)
- Dashboard de estados
- Subir artículos
- Descargar PDFs
- Eliminar artículos
- Filtros básicos

### 🔜 Sprint 2 (Siguiente)
- Asignar revisores a artículos
- Cambiar estados manualmente
- Ver historial de cambios

### 🔜 Sprint 3
- Formulario de revisión estructurada
- Guardar borradores de revisión
- Ver revisiones enviadas

### 🔜 Sprint 4
- Consolidación de comentarios
- Subir versiones revisadas
- Response letter del autor

## 🤝 Contribuciones

Este es un proyecto educativo desarrollado con metodología ISA/IA (Ingeniería de Software Asistida por IA).

## 📄 Licencia

MIT License - Proyecto educativo

## 👤 Autor

Desarrollado como parte del ejercicio de ISA/IA para sistema de revisión por pares.

---

**¿Necesitas ayuda?** Abre un issue o consulta la documentación de cada componente en los comentarios del código.
"# Meta1.6" 
