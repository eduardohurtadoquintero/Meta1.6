# Sistema de Revisión por Pares - MVP v2.0

PWA (Progressive Web App) para gestión de revisión por pares de artículos científicos.

## 🎯 Cambios Principales en v2.0

### **Flujo Actualizado:**
```
✅ ANTES (v1.0):
Editor sube artículo → Editor asigna revisores → Revisores evalúan

✅ AHORA (v2.0):
Autor sube artículo → Editor revisa y asigna revisores → 
Revisores evalúan Y comentan → Autor ve comentarios consolidados
```

### **Nuevas Funcionalidades:**
- ✅ **Autor** puede subir sus propios artículos
- ✅ **Revisores** pueden dar evaluaciones cuantitativas (1-5) y comentarios detallados
- ✅ **Sistema de comentarios** consolidados con tabla comparativa
- ✅ **Comentarios confidenciales** (solo visibles para editor)
- ✅ **Vista consolidada** de múltiples revisiones

---

## 📋 Características

- ✅ **Offline-first**: Funciona completamente sin conexión
- ✅ **Instalable**: Se puede instalar como app nativa
- ✅ **Persistencia local**: Datos guardados en IndexedDB
- ✅ **Responsive**: Optimizado para móvil, tablet y desktop
- ✅ **Sin backend**: No requiere servidor
- ✅ **3 roles diferenciados**: Autor, Editor, Revisor
- ✅ **Sistema de comentarios**: Evaluación estructurada + comentarios libres
- ✅ **Tabla comparativa**: Visualización de múltiples revisiones

---

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
   - Selecciona la carpeta `peerreview-mvp-v2`

4. **Ejecutar la app**
   - Click derecho en `index.html`
   - Selecciona "Open with Live Server"
   - Se abrirá automáticamente en http://127.0.0.1:5500

### Opción 2: Python HTTP Server

```bash
cd peerreview-mvp-v2
python3 -m http.server 8000
```

Luego abre: http://localhost:8000

### Opción 3: Node.js Live Server

```bash
cd peerreview-mvp-v2
npx live-server
```

---

## 📁 Estructura del Proyecto

```
peerreview-mvp-v2/
├── index.html              # Página principal con 3 vistas por rol
├── manifest.json           # Configuración PWA
├── sw.js                   # Service Worker (cache offline)
├── db.js                   # Configuración IndexedDB con usuarios
├── js/
│   ├── app.js              # Lógica principal + manejo de roles
│   ├── article-manager.js  # Gestión de artículos (autor sube)
│   ├── comment-system.js   # NUEVO: Sistema de comentarios consolidados
│   ├── error-handler.js    # Manejo de errores y toasts
│   └── loading-indicator.js # Indicadores de carga
└── css/
    ├── main.css            # Estilos principales + comentarios
    └── components.css      # Componentes (toast, loading, etc)
```

---

## 👥 Roles y Permisos

### **🎓 Autor (Miguel Torres)**
- ✅ Subir nuevos artículos con PDF + resumen
- ✅ Ver mis artículos enviados
- ✅ Ver estado de cada artículo (Recibido, En Revisión, Revisado)
- ✅ Ver comentarios consolidados de revisores
- ✅ Descargar PDF de mi artículo
- ❌ NO puede asignar revisores
- ❌ NO puede ver comentarios confidenciales

### **👨‍💼 Editor (Dr. Carlos Martínez)**
- ✅ Ver todos los artículos recibidos
- ✅ Filtrar por estado (Pendientes, En Revisión, Revisados)
- ✅ Asignar 2-3 revisores a cada artículo
- ✅ Ver comentarios de revisores (incluyendo confidenciales)
- ✅ Descargar PDF de cualquier artículo
- ❌ NO sube artículos (eso lo hace el autor)

### **👩‍🔬 Revisora (Dra. Ana Rodríguez)**
- ✅ Ver artículos asignados
- ✅ Descargar PDF del artículo
- ✅ Completar evaluación estructurada (4 criterios 1-5)
- ✅ Dar recomendación (Aceptar/Cambios Menores/Mayores/Rechazar)
- ✅ Escribir comentarios detallados para el autor
- ✅ Escribir comentarios confidenciales para el editor
- ✅ Guardar borradores
- ❌ NO puede ver revisiones de otros revisores

---

## 🧪 Cómo Probar la Aplicación

### **Test 1: Autor sube artículo**

1. Selector de rol → **Autor (Miguel Torres)**
2. Completa el formulario:
   - **Título**: "Deep Learning para Diagnóstico Médico"
   - **Área**: Inteligencia Artificial
   - **PDF**: Selecciona un PDF (máx 10MB)
   - **Resumen** (opcional): "Aplicación de redes neuronales..."
3. Click en **"📤 Enviar Artículo"**
4. Verifica:
   - ✅ Toast verde "Artículo enviado exitosamente"
   - ✅ Aparece en "Mis Artículos Enviados" con badge "📨 RECIBIDO"
   - ✅ Muestra "⏳ Pendiente de asignación de revisores"

### **Test 2: Editor asigna revisores**

1. Selector de rol → **Editor (Dr. Carlos)**
2. Ve a "Artículos Recibidos para Revisión"
3. Click en botón **👥** del artículo
4. En el modal, selecciona 2-3 revisores (checkboxes)
5. Click en **"Confirmar Asignación"**
6. Verifica:
   - ✅ Toast verde "Revisores asignados exitosamente"
   - ✅ Badge cambia a "📝 EN REVISIÓN"
   - ✅ Muestra "Revisores asignados: 2"

### **Test 3: Revisor completa evaluación**

1. Selector de rol → **Revisor (Dra. Ana)**
2. Ve a "Artículos Asignados para Revisar"
3. Click en botón **✍️ Revisar**
4. En el modal:
   - Mueve sliders (1-5) para cada criterio
   - Selecciona recomendación
   - Escribe comentarios (mínimo 100 caracteres)
   - Opcionalmente: comentarios confidenciales
5. Click en **"📨 Enviar Revisión"**
6. Verifica:
   - ✅ Toast verde "Revisión enviada"
   - ✅ Badge cambia a "✅ COMPLETADA"
   - ✅ Botón cambia a **👁️ Ver mi revisión**

### **Test 4: Ver comentarios consolidados**

1. Selector de rol → **Editor** o **Autor**
2. Si hay 2+ revisiones completadas, aparece botón **💬**
3. Click en **💬 Ver Comentarios**
4. Verifica:
   - ✅ Tabla comparativa con scores de todos los revisores
   - ✅ Promedios calculados por criterio
   - ✅ Recomendaciones de cada revisor
   - ✅ Comentarios detallados de cada revisor
   - ✅ (Solo editor) Comentarios confidenciales en amarillo

### **Test 5: Modo offline**

1. DevTools (F12) > Network tab
2. Marca checkbox **Offline**
3. Refresca la página (F5)
4. Verifica:
   - ✅ La app sigue funcionando
   - ✅ Banner amarillo "📡 Sin conexión"
   - ✅ Puedes subir artículos (se guardan localmente)
   - ✅ Puedes completar revisiones

### **Test 6: Persistencia de datos**

1. Sube un artículo como Autor
2. Cierra el navegador completamente
3. Abre la app de nuevo
4. Verifica:
   - ✅ El artículo sigue ahí
   - ✅ Todos los datos persisten en IndexedDB

---

## 🔄 Flujo Completo del Sistema

```
1️⃣ AUTOR SUBE ARTÍCULO
   └─> Estado: "Recibido"

2️⃣ EDITOR REVISA Y ASIGNA REVISORES (2-3)
   └─> Estado: "En Revisión"

3️⃣ REVISORES COMPLETAN EVALUACIONES
   ├─> Revisor 1: Scores + Comentarios
   ├─> Revisor 2: Scores + Comentarios
   └─> (Opcional) Revisor 3: Scores + Comentarios

4️⃣ ESTADO CAMBIA A "REVISADO"
   └─> Sistema consolida automáticamente

5️⃣ EDITOR Y AUTOR VEN COMENTARIOS CONSOLIDADOS
   ├─> Tabla comparativa de scores
   ├─> Promedios por criterio
   └─> Todos los comentarios organizados

6️⃣ EDITOR TOMA DECISIÓN FINAL
   └─> Estado: "Aceptado" o "Rechazado"
```

---

## 🛠️ Tecnologías Utilizadas

- **Frontend**: HTML5, CSS3, Vanilla JavaScript (ES6+)
- **PWA**: Service Worker, Cache API, Web App Manifest
- **Persistencia**: IndexedDB vía Dexie.js (50KB)
- **Dependencias**: Solo Dexie.js desde CDN
- **Sin frameworks**: No React, Vue, Angular
- **Sin build tools**: No webpack, babel, etc.

---

## ⚙️ Configuración Avanzada

### Cambiar revisores precargados

Edita `db.js` en la sección `db.on('populate')`:

```javascript
db.reviewers.bulkAdd([
  {
    id: 'reviewer-6',
    name: "Dr. Nuevo Revisor",
    email: "nuevo@universidad.edu",
    expertise: ["AI", "ML"],
    assignedArticles: []
  }
]);
```

### Cambiar límite de tamaño de PDF

Edita `js/article-manager.js`:

```javascript
const MAX_FILE_SIZE = 20 * 1024 * 1024; // Cambiar a 20MB
```

### Agregar nuevas áreas temáticas

Edita `index.html` en el `<select id="authorArea">`:

```html
<option value="Blockchain">Blockchain</option>
<option value="Quantum">Computación Cuántica</option>
```

---

## 🐛 Troubleshooting

### "Dexie is not defined"
❌ Estás abriendo con file://  
✅ Usa servidor local (Live Server, Python, etc.)

### Service Worker no se registra
❌ No funciona en file://  
✅ Requiere http://localhost o https://

### Los estilos no se aplican
1. Verifica archivos CSS en `/css/`
2. Hard refresh: Ctrl+Shift+R
3. Limpia cache del navegador

### IndexedDB no guarda
1. DevTools > Console (busca errores)
2. Limpia DB: DevTools > Application > IndexedDB > Delete database
3. Refresca la página

### No veo botón de comentarios
✅ El artículo debe tener 2+ revisiones completadas
✅ Cambia a rol Editor o Autor para ver el botón 💬

---

## 🔒 Seguridad y Privacidad

- ⚠️ **No usar en producción sin modificaciones**
- ⚠️ No hay autenticación real (simulación con selector de roles)
- ⚠️ Datos locales al navegador/dispositivo
- ⚠️ No hay sincronización entre dispositivos
- ✅ Los PDFs nunca salen del dispositivo
- ✅ IndexedDB aislado por origen
- ✅ Comentarios confidenciales solo visibles para editor

---

## 🚧 Limitaciones del MVP v2.0

**Este MVP NO incluye:**
- ❌ Autenticación real con usuarios y contraseñas
- ❌ Backend/base de datos en servidor
- ❌ Sincronización multi-dispositivo
- ❌ Notificaciones push o por email
- ❌ Revisión anónima (doble ciego)
- ❌ Sistema de certificados para revisores
- ❌ Estadísticas avanzadas o dashboards
- ❌ Gestión de conflictos de interés
- ❌ Historial completo de versiones del artículo
- ❌ Exportación a PDF de comentarios consolidados

---

## 📊 Comparación v1.0 vs v2.0

| Aspecto | v1.0 | v2.0 |
|---------|------|------|
| **Quien sube artículo** | Editor | **Autor** ✅ |
| **Sistema de comentarios** | No | **Sí** ✅ |
| **Evaluación estructurada** | No | **4 criterios + recomendación** ✅ |
| **Tabla comparativa** | No | **Sí, con promedios** ✅ |
| **Comentarios confidenciales** | No | **Sí (editor only)** ✅ |
| **Borradores de revisión** | Sí | **Sí, mejorado** ✅ |
| **Roles diferenciados** | Básico | **3 roles completos** ✅ |

---

## 📅 Roadmap Futuro

### Sprint 5 (Post-MVP)
- [ ] Autenticación real con Firebase Auth
- [ ] Sistema de versiones del artículo
- [ ] Response letter del autor
- [ ] Comparación visual entre versiones

### Sprint 6
- [ ] Backend con Node.js + PostgreSQL
- [ ] Sincronización multi-dispositivo
- [ ] Notificaciones por email

### Sprint 7
- [ ] Revisión anónima (doble ciego)
- [ ] Gestión de conflictos de interés
- [ ] Dashboard de estadísticas

---

## 🤝 Contribuciones

Este es un proyecto educativo desarrollado con metodología ISA/IA (Ingeniería de Software Asistida por IA).

---

## 📄 Licencia

MIT License - Proyecto educativo

---

## 👤 Autor

Desarrollado como parte del ejercicio de ISA/IA para sistema de revisión por pares - Versión 2.0 actualizada.

---

**¿Necesitas ayuda?** Consulta este README o revisa los comentarios en el código.

## 🎉 ¡A probar!

La app está lista para usar. Simplemente abre `index.html` con Live Server y comienza a explorar los 3 roles diferentes.
