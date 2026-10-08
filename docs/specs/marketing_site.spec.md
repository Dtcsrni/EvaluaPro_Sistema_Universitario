---
id: SPEC-002
titulo: Sitio público de EvaluaPro
version: 2.0.0
fecha: 2026-10-08
autor: Codex
modulo: marketing
estado: implemented
---

# SPEC-002: Sitio público de EvaluaPro

## Contexto

El sitio público debe ayudar a docentes a decidir si EvaluaPro corresponde a su flujo, instalarlo desde la release publicada y encontrar instrucciones de uso y respaldo. El repositorio puede contener código o versiones que todavía no se han publicado como instalador. El sitio debe describir únicamente el perfil mantenido para distribución (`docente-local`) y no convertir especificaciones, datos ilustrativos o planes futuros en promesas comerciales.

## Requisitos Funcionales

- **REQ-001 (Mensaje verificable):** Explicar que `docente-local` es una aplicación docente local para Windows con SQLite, gestión académica, generación de exámenes, lectura OMR y revisión del docente.
- **REQ-002 (Estado de publicación):** Los CTA de descarga deben apuntar a GitHub Releases. La página no debe fijar la versión de `main` como release pública ni presentar una descarga o una integración externa como activada automáticamente.
- **REQ-003 (Trazabilidad del producto):** La navegación debe llevar a guías de instalación, manual docente, respaldos/migración, licencia y reportes de problemas.
- **REQ-004 (Datos ilustrativos):** Toda vista esquemática debe identificarse como ilustrativa. No presentar nombres, resultados, precisión, métricas, testimonios, SLA, instituciones o precios inventados como evidencia real.
- **REQ-005 (Integraciones):** Informar que Classroom, el portal y servicios remotos requieren configuración o despliegue adicionales.
- **REQ-006 (Accesibilidad):** Mantener un único `<h1>`, navegación etiquetada, enlaces internos válidos, uso por teclado y contenido visible cuando JavaScript no se ejecute. Respetar `prefers-reduced-motion`.
- **REQ-007 (Preguntas frecuentes):** Usar acordeones nativos `<details>`/`<summary>` y explicar descarga, operación local, respaldo, OMR y soporte.

## Criterios de Aceptación

- **AC-001:** El smoke test confirma los títulos, secciones, CTA, destino de Releases y el perfil `docente-local`.
- **AC-002:** El test valida que exista un solo `<h1>` y que cada enlace interno apunte a un ID real.
- **AC-003:** El test falla si reaparecen las afirmaciones obsoletas de v1.1.1, precisión OMR total, sincronización automática, respuesta garantizada o SLA 24/7.
- **AC-004:** El CSS mantiene soporte responsivo, preferencia de movimiento reducido y contenido visible como mejora progresiva.
- **AC-005:** El JavaScript permite abrir/cerrar el menú móvil, anuncia `aria-expanded` y admite `Escape`; si falta `IntersectionObserver`, el contenido permanece visible.

## Matriz de Trazabilidad

| ID Requisito | Descripción del Caso | Archivo de Test Vinculado | Estado |
| --- | --- | --- | --- |
| REQ-001, REQ-002, REQ-003 | Mensaje, CTA y enlaces del sitio público | `scripts/tests/marketing-site.smoke.test.mjs` | Completado |
| REQ-004, REQ-005 | Sin afirmaciones no sustentadas ni disponibilidad automática de integraciones | `scripts/tests/marketing-site.smoke.test.mjs` | Completado |
| REQ-006 | H1 único, navegación por anclas y estilos de movimiento reducido | `scripts/tests/marketing-site.smoke.test.mjs` | Completado |
| REQ-007 | FAQ nativa y navegación móvil | `scripts/tests/marketing-site.smoke.test.mjs` | Completado |
