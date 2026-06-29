---
id: SPEC-HIDRATACION-CURSO-INICIADO
titulo: Hidratacion de curso iniciado desde XLSX y DOCX
version: 1.2.0
fecha: 2026-06-27
autor: Codex / Agente IA
modulo: modulo_hidratacion_cursos
estado: implemented
---

# SPEC-HIDRATACION-CURSO-INICIADO: Hidratacion de curso iniciado desde XLSX y DOCX

## Contexto
Un docente puede adoptar EvaluaPro cuando el curso ya esta avanzado. Para aportar desde el primer dia, el sistema necesita recibir listas y documentos existentes, mostrar una vista previa entendible, importar alumnos sin duplicarlos y registrar evidencias historicas reutilizables para preparar un examen global.

## Requisitos Funcionales
- **REQ-001:** El backend debe exponer una vista previa multipart para archivos `.xlsx` y `.docx` asociados a un `periodoId`.
- **REQ-002:** La vista previa XLSX debe detectar hoja, fila de encabezado, columnas base de alumno y filas importables.
- **REQ-003:** La importacion XLSX debe hacer upsert idempotente de alumnos por `periodoId + matricula`, sin borrar registros existentes.
- **REQ-004:** La importacion debe registrar evidencias historicas desde columnas numericas del XLSX cuando existan.
- **REQ-005:** La vista previa DOCX debe extraer texto, hash, conteo de reactivos y clasificar documentos como encuadre, parcial externo, global externo o temario/documento de apoyo.
- **REQ-006:** La importacion DOCX debe registrar evidencia de curso con hash y metadata, sin duplicar el mismo archivo importado.
- **REQ-007:** La importacion de DOCX de primer y segundo parcial debe poblar el banco de preguntas del periodo con reactivos, opciones y respuesta correcta cuando el documento incluya clave de respuesta detectable.

## Criterios de Aceptación
- **AC-001 (REQ-001):** `POST /api/hidratacion-cursos/preview` responde con `archivos[]`, `planImportacion` y hashes SHA-256.
- **AC-002 (REQ-002):** Un XLSX con encabezados `Nombre del alumno`, `Id. del alumno`, `Correo Alumno` produce alumnos detectados y mapeo de columnas.
- **AC-003 (REQ-003):** `POST /api/hidratacion-cursos/importar` crea alumnos en la primera ejecucion y los actualiza/omite sin duplicarlos en ejecuciones posteriores.
- **AC-004 (REQ-004):** Las columnas numericas del XLSX se registran como evidencias con metadata de archivo y columna origen.
- **AC-005 (REQ-005):** Un DOCX de parcial reporta reactivos detectados y tipo `parcial_externo`; un DOCX de examen global reporta reactivos detectados y tipo `global_externo`; un encuadre reporta tipo `encuadre`.
- **AC-006 (REQ-006):** Reimportar el mismo DOCX no crea evidencia documental duplicada.
- **AC-007 (REQ-007):** Un DOCX de primer o segundo parcial con reactivos numerados, opciones `A-D` y clave `Respuesta correcta: <letra>` crea preguntas idempotentes en `BancoPregunta`, versiones y opciones; reimportar el mismo archivo no duplica reactivos.

## Matriz de Trazabilidad

| ID Requisito | Descripcion del Caso | Archivo de Test Vinculado | Estado |
| --- | --- | --- | --- |
| REQ-001 | Preview multipart XLSX/DOCX | apps/backend/tests/integracion/hidratacionCursos.test.ts | Completado |
| REQ-002 | Deteccion de encabezados y alumnos XLSX | apps/backend/tests/integracion/hidratacionCursos.test.ts | Completado |
| REQ-003 | Upsert idempotente de alumnos | apps/backend/tests/integracion/hidratacionCursos.test.ts | Completado |
| REQ-004 | Evidencias historicas desde columnas numericas | apps/backend/tests/integracion/hidratacionCursos.test.ts | Completado |
| REQ-005 | Clasificacion DOCX de parcial, global, encuadre y material | apps/backend/tests/integracion/hidratacionCursos.test.ts | Completado |
| REQ-006 | Dedupe documental por hash | apps/backend/tests/integracion/hidratacionCursos.test.ts | Completado |
| REQ-007 | Banco de preguntas desde DOCX de parcial/global con respuestas | apps/backend/tests/integracion/hidratacionCursos.test.ts | Completado |
