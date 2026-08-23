---
id: SPEC-002
titulo: Portal de Marketing y Promoción Comercial de EvaluaPro
version: 1.0.0
fecha: 2026-06-23
autor: Antigravity
modulo: marketing
estado: implemented
---

# SPEC-002: Portal de Marketing y Promoción Comercial de EvaluaPro

## Contexto
EvaluaPro es un sistema robusto de evaluación universitaria que conecta el diseño de exámenes en PDF con lectura óptica OMR y analíticas académicas. Para maximizar su adopción, venta y licenciamiento a nivel institucional y de docentes independientes, el sitio de GitHub Pages (`site/`) debe evolucionar desde una página básica de información a un portal comercial premium, de alta conversión visual, responsivo y estético. Para garantizar precisión y dinamismo sin usar imágenes de IA imprecisas, se integrarán réplicas interactivas de alta fidelidad de la interfaz real de la aplicación construidas con puro HTML/CSS en vivo (Live UI Mockups), permitiendo al usuario interactuar en tiempo real con el flujo de calificado de EvaluaPro.

## Requisitos Funcionales
- **REQ-001 (SEO y Semántica):** El portal debe implementar etiquetas semánticas HTML5 completas, metadatos meta (incluyendo OpenGraph para redes sociales), y un único `<h1>` que resuma la propuesta de valor principal de EvaluaPro.
- **REQ-002 (Aesthetics & Theme):** Estilo visual premium con tema oscuro, gradientes dinámicos, glassmorphism, tipografía premium (Sora y IBM Plex Sans), microinteracciones y efectos de hover suaves en tarjetas y botones.
- **REQ-003 (Hero Section & CTAs):** La sección de cabecera debe capturar la atención de inmediato con un titular potente, CTAs claros ("Solicitar demo", "Cotizar licencia") con enlaces a correo electrónico configurados, y una réplica visual destacada del Dashboard principal de EvaluaPro en código HTML/CSS de alta fidelidad.
- **REQ-004 (Mockup de Producto - OMR y Analíticas):** La landing page incorporará representaciones visuales detalladas de alta fidelidad basadas en HTML/CSS que reflejan con exactitud la interfaz y flujos reales del sistema:
  - **Dashboard del Docente:** Diseño estructurado que replica el panel de la app (barra lateral oscura, tarjetas de métricas como "Exámenes Procesados", "Promedio", "Eficacia OMR", y un listado de cursos).
  - **Detección OMR en CSS:** Simulación visual de una sección de hoja de respuestas donde se aprecian las burbujas marcadas con sombreado realista y marcadores de acierto/error (verde/rojo) tal como el motor OMR del software los detecta y superpone.
- **REQ-005 (Tabla de Licencias y Niveles):** Muestra detallada de características por edición (Comunitaria AGPL vs. Comercial/Docente vs. Institucional), con una tarjeta destacada y desglose de soporte técnico y gobernanza de cumplimiento.
- **REQ-006 (Sección FAQ Interactivas):** Sección de preguntas frecuentes implementada con acordeones HTML nativos (`<details>` y `<summary>`) estilizados de forma moderna, que se despliengan fluidamente.
- **REQ-007 (Efectos y JavaScript):** Integración de IntersectionObserver para la revelación gradual de elementos al hacer scroll y animaciones del conteo numérico de métricas.

## Criterios de Aceptación
- **AC-001 (REQ-001, REQ-003):** Se deben mantener los identificadores críticos `id="inicio"`, `id="producto"`, `id="licencias"`, `id="faq"` y los textos exactos "Solicitar demo", "Cotizar licencia" y el correo "armsystechno@gmail.com" para cumplir con el smoke test del pipeline.
- **AC-002 (REQ-002):** El archivo CSS debe incluir estilos para `.hero`, `.pricing`, `.faq`, `.reveal`, y `.btn-primary` requeridos en el smoke test.
- **AC-003 (REQ-007):** El archivo JS debe emplear `IntersectionObserver`, `metric`, y `requestAnimationFrame` de forma funcional y sin errores en consola.
- **AC-004 (REQ-004):** Los mockups en HTML/CSS deben mostrar de forma clara y estática la distribución de una interfaz real de EvaluaPro y la detección de burbujas OMR en verde/rojo.

## Matriz de Trazabilidad

| ID Requisito | Descripción del Caso | Archivo de Test Vinculado | Estado |
| --- | --- | --- | --- |
| REQ-001 | Validación de estructura semántica y tokens requeridos | `scripts/tests/marketing-site.smoke.test.mjs` | Completado |
| REQ-002 | Validación de clases CSS obligatorias | `scripts/tests/marketing-site.smoke.test.mjs` | Completado |
| REQ-003 | Presencia de ID de inicio, llamadas a la acción y mail | `scripts/tests/marketing-site.smoke.test.mjs` | Completado |
| REQ-004 | Inclusión y verificación del carrusel / galería de imágenes | `scripts/tests/marketing-site.smoke.test.mjs` | Completado |
| REQ-005 | Presencia del ID de sección de licencias e información comercial | `scripts/tests/marketing-site.smoke.test.mjs` | Completado |
| REQ-006 | Presencia del ID de FAQ y comportamiento de acordeones | `scripts/tests/marketing-site.smoke.test.mjs` | Completado |
| REQ-007 | Empleo de IntersectionObserver, metric y requestAnimationFrame | `scripts/tests/marketing-site.smoke.test.mjs` | Completado |
