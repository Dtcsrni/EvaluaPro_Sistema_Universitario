---
id: SPEC-002
titulo: Sitio público de EvaluaPro
version: 2.1.0
fecha: 2026-10-10
autor: Codex
modulo: marketing
estado: approved
---

# SPEC-002: Sitio público de EvaluaPro

## Contexto

El sitio público debe ayudar a docentes a decidir si EvaluaPro corresponde a su flujo, instalarlo desde la release publicada y encontrar instrucciones de uso y respaldo. El repositorio puede contener código o versiones que todavía no se han publicado como instalador. El sitio debe describir únicamente el perfil mantenido para distribución (`docente-local`) y no convertir especificaciones, datos ilustrativos o planes futuros en promesas comerciales.

## Requisitos Funcionales

- **REQ-001 (Mensaje verificable):** Explicar que `docente-local` es una aplicación docente local para Windows con SQLite, gestión académica, generación de exámenes, lectura OMR y revisión del docente.
- **REQ-002 (Estado de publicación):** Los CTA de descarga deben apuntar a GitHub Releases. La página no debe fijar la versión de `main` como release pública ni presentar una descarga o una integración externa como activada automáticamente.
- **REQ-003 (Trazabilidad del producto):** La navegación debe llevar a guías de instalación, respaldos/migración, centro documental, licencia y reportes de problemas; no debe ofrecer un manual de usuario.
- **REQ-004 (Datos ilustrativos):** Toda vista esquemática debe identificarse como ilustrativa. No presentar nombres, resultados, precisión, métricas, testimonios, SLA, instituciones o precios inventados como evidencia real.
- **REQ-005 (Integraciones):** Informar que Classroom, el portal y servicios remotos requieren configuración o despliegue adicionales.
- **REQ-006 (Accesibilidad):** Mantener un único `<h1>`, navegación etiquetada, enlaces internos válidos, uso por teclado y contenido visible cuando JavaScript no se ejecute. Respetar `prefers-reduced-motion`.
- **REQ-007 (Preguntas frecuentes):** Usar acordeones nativos `<details>`/`<summary>` y explicar descarga, operación local, respaldo, OMR y soporte.
- **REQ-008 (Documentación pública):** No ofrecer ni enlazar un manual de usuario desde la página pública.

## Criterios de Aceptación

- **AC-001:** El smoke test confirma los títulos, secciones, CTA, destino de Releases y el perfil `docente-local`.
- **AC-002:** El test valida que exista un solo `<h1>` y que cada enlace interno apunte a un ID real.
- **AC-003:** El test falla si reaparecen las afirmaciones obsoletas de v1.1.1, precisión OMR total, sincronización automática, respuesta garantizada o SLA 24/7.
- **AC-004:** El CSS mantiene soporte responsivo y movimiento reducido. En móvil, muestra navegación y descarga cuando JavaScript no se ejecuta; solo oculta el menú después de que el script marca `html.has-js`.
- **AC-005:** El JavaScript activa el botón móvil, anuncia `aria-expanded` y admite `Escape`; el contenido y los enlaces permanecen utilizables si falta JavaScript o `IntersectionObserver`.
- **AC-006:** README, centro documental y sitio público no enlazan ni anuncian un manual de usuario.
- **AC-008:** El smoke test rechaza referencias al manual de usuario en la landing page.

## Matriz de Trazabilidad

| ID Requisito | Descripción del Caso | Archivo de Test Vinculado | Estado |
| --- | --- | --- | --- |
| REQ-001, REQ-002, REQ-003 | Mensaje, CTA y enlaces del sitio público | `scripts/tests/marketing-site.smoke.test.mjs` | Completado |
| REQ-004, REQ-005 | Sin afirmaciones no sustentadas ni disponibilidad automática de integraciones | `scripts/tests/marketing-site.smoke.test.mjs` | Completado |
| REQ-006 | H1 único, navegación por anclas, estilos de movimiento reducido y enlaces visibles en móvil sin JavaScript | `scripts/tests/marketing-site.smoke.test.mjs` | Completado |
| REQ-007 | FAQ nativa y navegación móvil | `scripts/tests/marketing-site.smoke.test.mjs` | Completado |
| REQ-008 | La landing page no enlaza el manual de usuario | `scripts/tests/marketing-site.smoke.test.mjs` | Completado |
