---
id: SPEC-143
titulo: Deteccion OCR del bono de guia de estudio
version: 1.0.0
fecha: 2026-11-09
autor: Codex / EvaluaPro Team
modulo: modulo_calificacion
estado: implemented
---

## Contexto

El bono manuscrito de guía de estudio (+0.25 sobre 5) debe provenir de la marca
ubicada en la zona de calificación del examen. No se debe aceptar un valor de bono
arbitrario enviado por cliente. El docente debe poder revisar y retirar el bono.

## Requisitos Funcionales

- **REQ-001:** En exámenes parciales y globales con nota base menor que 5, el backend
  alineará la captura con QR/fiduciales de página y leerá la zona delimitada por el
  mapa OMR de la plantilla.
- **REQ-002:** Aplicar automáticamente +0.25 solo cuando dos preprocesamientos OCR
  independientes reconozcan `+0.25` y ambos tengan confianza mínima de 80/100.
- **REQ-003:** Una lectura dudosa no agrega el bono automáticamente. La vista previa
  muestra motivo, confianza y recorte; el docente puede confirmar manualmente solo
  con recorte disponible o retirar un bono detectado.
- **REQ-004:** El bono no puede exceder la nota de examen 5.00, no aplica a
  extraordinarios ni a una nota base máxima.
- **REQ-005:** La API conserva compatibilidad con `bonoSolicitado`, pero ignora su
  valor. La decisión y evidencia se auditan en `omrAuditoria` sin guardar la imagen
  base64 en esa auditoría.
- **REQ-006:** La vista previa no crea calificación ni limpia la cola de capturas.

## Criterios de Aceptación

- Dos coincidencias OCR con confianza >= 80 producen `detectado`; cualquier
  coincidencia parcial produce `requiere_revision`; ausencia de coincidencias produce
  `no_detectado`.
- Sin geometría fiable, captura, zona o OCR, no se aplica el bono automáticamente.
- Guardar vuelve a ejecutar OCR en el servidor y conserva la exclusión/confirmación
  explícita del docente.
- La interfaz presenta el recorte y estado antes de permitir confirmar una marca
  dudosa.

## Matriz de Trazabilidad

| Requisito | Implementación | Validación |
| --- | --- | --- |
| REQ-001/002 | `detectorBonoGuiaEstudio.ts` | `calificacion.bonoGuiaEstudio.test.ts` |
| REQ-003/006 | `SeccionCalificar.tsx`, `AppDocente.tsx` | `seccionCalificar.test.tsx` |
| REQ-004/005 | `controladorCalificacion.ts`, `validacionesCalificacion.ts` | `calificacion.bonoGuiaEstudio.test.ts` |

## Verificación

- Pruebas focalizadas: backend 4/4 y frontend 13/13.
- Build backend/frontend, typecheck y guard WCAG: correctos.
- La instalación activa muestra v1.2.14, pero su `/api/version` todavía identifica OMR v4; esta candidata no se ha aplicado al runtime local.
- `test:ci` completo no pudo concluir en el clon disponible: faltan `apps/portal_alumno_cloud`, `apps/backend/scripts/omr-qr-preprint-check.js`, `apps/frontend/public/portal-sw.js` y `apps/frontend/public/manifest-docente.webmanifest`. Los fallos de suites corresponden a esos archivos ausentes.
