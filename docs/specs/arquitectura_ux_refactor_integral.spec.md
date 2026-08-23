---
id: SPEC-ARCH-UX-MODERNIZATION
titulo: Modernización Integral de Arquitectura, Higiene de Código y UX/UI Docente
version: 1.1.1
fecha: 2026-08-21
autor: Antigravity / DeepMind AI
modulo: frontend_app_docente
estado: implemented
---

# SPEC-ARCH-UX-MODERNIZATION: Modernización Integral de Arquitectura, Higiene de Código y UX/UI Docente

## Contexto
El sistema EvaluaPro requiere saneamiento de deuda técnica acumulada en el frontend docente (`AppDocente`, `SeccionCalificaciones`, `SeccionRegistroEntrega`, `SeccionAsistencias`, `SeccionTemarios`), eliminación de importaciones no utilizadas y directivas de linter heredadas, supresión total de estilos en línea en favor de tokens semánticos en `components.css` y optimización ergonómica de la interfaz de usuario (navegación estructurada por flujos, revisión rápida de OMR por teclado, y cabeceras/columnas fijas en tablas de notas).

## Requisitos Funcionales
- **REQ-ARCH-001 (Higiene de Importaciones):** Eliminar importaciones zombi y directivas `/* eslint-disable @typescript-eslint/no-unused-vars */` en `SeccionCalificaciones.tsx` y `SeccionRegistroEntrega.tsx`.
- **REQ-UI-002 (Consistencia de Tokens CSS):** Migrar todas las definiciones de estilos en línea y colores fijos hexadecimales en `SeccionAsistencias.tsx`, `SeccionTemarios.tsx` y el banner de recordatorio en `AppDocente.tsx` hacia clases semánticas en `components.css` compatibles con temas claro y oscuro.
- **REQ-UX-003 (Navegación Fluida por Flujos):** Proveer una barra de navegación enriquecida en `AppDocente.tsx` con agrupación intuitiva de tareas pedagógicas, scroll horizontal suave en resoluciones pequeñas y accesibilidad con teclado.
- **REQ-UX-004 (Sticky Table en Calificaciones):** La matriz de calificaciones en `SeccionCalificaciones.tsx` debe incorporar cabecera pegajosa (`sticky header`) y columna de alumno pegajosa (`sticky column`) para scroll bidireccional sin perder contexto.
- **REQ-UX-005 (Atajos de Teclado en Escaneo OMR):** Proveer soporte para atajos de teclado (`1-5` / `A-E`, `Tab`/`Shift+Tab`, `Enter`) durante la revisión manual de exámenes en `SeccionEscaneo.tsx`.
- **REQ-ARCH-006 (Desacoplamiento de Estado OMR):** Extraer la lógica de borradores y estados de revisión OMR desde `AppDocente.tsx` al custom hook `useOmrWorkflowState.ts`.

## Criterios de Aceptación
- **AC-001 (REQ-ARCH-001):** Linter pasa con cero advertencias y sin exclusiones innecesarias de variables no usadas.
- **AC-002 (REQ-UI-002):** No existen colores hexadecimales fijos (`#e5e7eb`, `#888`, etc.) en Asistencias y Temarios; el renderizado en temas claro y oscuro mantiene contraste legible conforme a `docs/DESIGN.md`.
- **AC-003 (REQ-UX-003):** La navegación permite acceder a todas las vistas sin solapamiento de pestañas en viewports reducidos.
- **AC-004 (REQ-UX-004):** La tabla de calificaciones permite desplazamiento horizontal y vertical conservando los encabezados de reactivos y los nombres de los alumnos.
- **AC-005 (REQ-UX-005):** La selección de respuestas OMR responde a eventos de teclado `KeyDown` cuando el modo de edición está activo.
- **AC-006 (REQ-ARCH-006):** El hook `useOmrWorkflowState` gestiona correctamente la normalización y actualización de borradores OMR con suites de pruebas unitarias/comportamiento en verde.

## Matriz de Trazabilidad

| ID Requisito | Descripción del Caso | Archivo de Test Vinculado | Estado |
| --- | --- | --- | --- |
| REQ-ARCH-001 | Higiene de código y linter sin variables no utilizadas | `apps/frontend/tests/appDocente.dominiosCobertura.test.tsx` | Implementado |
| REQ-UI-002 | Integridad de diseño y tokens CSS sin inline styles | `apps/frontend/tests/ux.quality.test.tsx` | Implementado |
| REQ-UX-003 | Navegación responsiva y cobertura de vistas docentes | `apps/frontend/tests/gui.responsive.contract.test.tsx` | Implementado |
| REQ-UX-004 | Estructura de tabla y accesibilidad de calificaciones | `apps/frontend/tests/seccionCalificaciones.test.tsx` | Implementado |
| REQ-UX-005 | Interacción y revisión de escaneo OMR | `apps/frontend/tests/seccionEscaneo.test.tsx` | Implementado |
| REQ-ARCH-006 | Estado desacoplado de flujo de escaneo OMR | `apps/frontend/tests/useOmrWorkflowState.test.ts` | Implementado |
