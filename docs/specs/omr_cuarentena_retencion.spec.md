---
id: SPEC-OMR-CUARENTENA-RETENCION
titulo: Política de Cuarentena y Retención de Imágenes OMR
version: 1.0.0
fecha: 2026-07-27
autor: Antigravity / Agente IA
modulo: omr_cuarentena
estado: implemented
---

# SPEC-OMR-CUARENTENA-RETENCION: Política de Cuarentena y Retención de Imágenes OMR

## Contexto

EvaluaPro procesa capturas de exámenes físicos mediante su motor OMR. Cuando una imagen presenta baja confianza, alteraciones, inconsistencia o fallos de calidad, el sistema debe proteger la evidencia física impidiendo la autocalificación o el borrado accidental. Asimismo, la retención prolongada de imágenes OMR en disco local debe gestionarse de forma determinista para equilibrar la privacidad, el almacenamiento y el cumplimiento institucional.

Esta especificación norma la cuarentena protegida para imágenes no confiables y la política de retención temporal post-cierre de curso (+35 días).

## Requisitos Funcionales

- **REQ-001:** Toda captura OMR con señal inestable, alteración o baja confianza (`hardStop = true`, `confianzaPromedioPagina <= 0.30`, `ratioAmbiguas >= 0.85` o `estadoAnalisis === 'rechazado_calidad'`) debe ser clasificada automáticamente en **Cuarentena Protegida**.
- **REQ-002:** Una imagen en Cuarentena Protegida no puede ser eliminada por tareas automáticas ni autocalificada por el backend. Requiere intervención explícita del docente (revisión visual manual, recalibración o descarte motivado).
- **REQ-003:** Las imágenes OMR se conservan localmente durante la vigencia del curso activo más un margen de **35 días naturales** posteriores a la fecha oficial de cierre del periodo académico.
- **REQ-004:** Al cumplirse la fecha límite de retención (+35 días), la aplicación debe presentar una notificación interactiva en la UI docente solicitando seleccionar una acción:
  1. *Eliminar imágenes:* Limpieza segura del disco conservando solo los puntajes y folios auditados.
  2. *Conservar evidencia:* Extensión temporal por 90 días naturales adicionales.
  3. *Exportar archivo:* Empaquetar imágenes en ZIP cifrado para archivo externo antes de limpiar.
- **REQ-005:** Si existe una investigación, apelación o disputa activa sobre un examen o alumno, las imágenes OMR asociadas quedan con **Bloqueo de Purga** y no pueden ser eliminadas bajo ningún flujo automático ni manual hasta la resolución formal de la disputa.
- **REQ-006:** Toda transición en el ciclo de vida de la evidencia OMR (ingreso a cuarentena, revisión manual, extensión de retención, exportación o depuración) debe registrarse en la bitácora local inmutable de auditoría con timestamp, ID de examen y usuario autor.

## Criterios de Aceptación

- **AC-001 (REQ-001):** Una hoja OMR analizada con confianza promedio de 0.25 ingresa inmediatamente al estado `cuarentena` sin asignar puntaje automático.
- **AC-002 (REQ-002):** La API backend rechaza intentos de autocalificación de hojas en estado `cuarentena` devolviendo código HTTP 422 con mensaje accionable de revisión requerida.
- **AC-003 (REQ-003):** El motor de retención calcula correctamente la ventana de expiración agregando 35 días a la fecha de cierre del curso.
- **AC-004 (REQ-004):** Tras expiración de retención, la UI expone el modal de decisión de imágenes (Eliminar, Conservar 90 días, Exportar ZIP) impidiendo purga silenciosa sin consentimiento docente.
- **AC-005 (REQ-005):** Un intento de eliminar una imagen en cuarentena ligada a una disputa activa devuelve un fallo explícito impidiendo la depuración.
- **AC-006 (REQ-006):** Cada acción sobre evidencias OMR genera una entrada auditable en la bitácora local.

## Matriz de Trazabilidad

| ID Requisito | Descripción del Caso | Archivo de Test Vinculado | Estado |
| --- | --- | --- | --- |
| REQ-001 | Aislamiento automático de imágenes de baja confianza en cuarentena | `apps/backend/tests/integracion/evaluaciones.modulo.test.ts` | Implementado |
| REQ-002 | Bloqueo de autocalificación y purga automática en cuarentena | `apps/backend/tests/integracion/evaluaciones.modulo.test.ts` | Implementado |
| REQ-003 | Cálculo de retención (curso activo + 35 días) | `apps/backend/tests/integracion/evaluaciones.modulo.test.ts` | Implementado |
| REQ-004 | Diálogo interactivo post-expiración de 35 días | `tests/gui-responsive/journey-docente-integral.spec.ts` | Implementado |
| REQ-005 | Bloqueo de purga por disputa/investigación activa | `apps/backend/tests/integracion/evaluaciones.modulo.test.ts` | Implementado |
| REQ-006 | Registro de auditoría inmutable de transiciones OMR | `apps/backend/tests/integracion/evaluaciones.modulo.test.ts` | Implementado |
