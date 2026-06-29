---
id: SPEC-LISTAS-INSTITUCIONALES-PLANTILLA
titulo: Listas institucionales por plantilla
version: 1.1.0
fecha: 2026-06-29
autor: Codex / Agente IA
modulo: modulo_listas_institucionales
estado: implemented
---

# SPEC-LISTAS-INSTITUCIONALES-PLANTILLA: Listas institucionales por plantilla

## Contexto

Permitir que el docente genere listas institucionales a partir de datos ya hidratados sin amarrar el sistema a una sola escuela. La primera plantilla oficial es CUH control de asistencias, con salida XLSX editable y PDF imprimible.

## Requisitos Funcionales

- REQ-001: El sistema debe exponer un catalogo de plantillas institucionales con `id`, `nombre`, `institucion`, `tipo`, `version` y formatos soportados.
- REQ-002: El sistema debe generar una lista institucional para un `periodoId` y `templateId` usando alumnos activos del periodo.
- REQ-003: La plantilla CUH inicial debe incluir el texto `Centro Universitario Hidalguense A.C.`, `CONTROL DE ASISTENCIAS`, tres bloques de fechas/asistencia, nota institucional y firmas inferiores.
- REQ-004: La salida XLSX debe conservar layout horizontal, celdas combinadas, bordes y alumnos/matriculas en filas deterministas.
- REQ-005: La salida PDF debe ser imprimible y contener los textos institucionales clave.
- REQ-006: La hidratacion debe importar alumnos y calificaciones historicas de los XLSX mayo-junio reales, incluidas columnas de cierre `AL:BA`.
- REQ-007: La UI docente debe permitir descargar XLSX/PDF desde materias activas sin exponer rutas locales ni secretos.

## Criterios de Aceptación

- AC-001 (REQ-001): El endpoint de plantillas lista CUH como `asistencia_cuh_control`.
- AC-002 (REQ-002): Un periodo con alumnos activos genera XLSX y PDF desde el mismo servicio institucional.
- AC-003 (REQ-003): El XLSX generado contiene encabezado CUH, tres bloques, nota institucional y firmas.
- AC-004 (REQ-004): El XLSX generado conserva layout horizontal y alumnos/matriculas en posiciones esperadas.
- AC-005 (REQ-005): El PDF generado tiene bytes no vacios y texto clave extraible.
- AC-006 (REQ-006): Electronica mayo-junio detecta 9 alumnos y calificaciones historicas; Administracion de la Calidad mayo-junio detecta 1 alumno y calificaciones historicas.
- AC-007 (REQ-007): La UI docente muestra descargas XLSX/PDF y llama los endpoints sin exponer rutas locales ni secretos.

## Matriz de Trazabilidad

| ID Requisito | Descripcion del Caso | Archivo de Test Vinculado | Estado |
| --- | --- | --- | --- |
| REQ-001 | Catalogo de plantillas institucionales | apps/backend/tests/integracion/listasInstitucionales.test.ts | Completado |
| REQ-002 | Generacion institucional por periodo | apps/backend/tests/integracion/listasInstitucionales.test.ts | Completado |
| REQ-003 | Layout CUH con encabezado, bloques, nota y firmas | apps/backend/tests/integracion/listasInstitucionales.test.ts | Completado |
| REQ-004 | XLSX horizontal con alumnos y matriculas | apps/backend/tests/integracion/listasInstitucionales.test.ts | Completado |
| REQ-005 | PDF institucional imprimible | apps/backend/tests/integracion/listasInstitucionales.test.ts | Completado |
| REQ-006 | Hidratacion real mayo-junio con calificaciones historicas | apps/backend/tests/integracion/hidratacionCursos.test.ts | Completado |
| REQ-007 | Descarga docente XLSX/PDF desde UI | apps/frontend/tests/seccionPeriodos.listasInstitucionales.test.tsx | Completado |
