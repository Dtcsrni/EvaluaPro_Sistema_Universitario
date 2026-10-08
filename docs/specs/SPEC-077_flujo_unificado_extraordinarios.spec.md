---
id: SPEC-077
titulo: Flujo unificado de examenes extraordinarios en Calificaciones
version: 1.0.0
fecha: 2026-10-06
autor: EvaluaPro Team
modulo: modulo_analiticas
estado: approved
---

## Contexto

El flujo de examen extraordinario está repartido entre Diseño de Exámenes, Revisión y captura y Resultados por alumno. La elegibilidad y la solicitud docente viven en el detalle de cada alumno, mientras que la generación permite seleccionar alumnos sin mostrar esas condiciones. El docente necesita un recorrido unificado dentro de Calificaciones para identificar elegibles, registrar su solicitud, generar o vincular el examen, seguir la captura y consultar el resultado sin modificar la evaluación ordinaria.

Personas beneficiadas: docentes que administran exámenes Extra y alumnos con calificación final ordinaria reprobatoria que solicitan presentarlo.

## Requisitos Funcionales

- **REQ-001 (Espacio unificado):** Calificaciones ofrece una pestaña Extraordinarios que presenta elegibilidad, solicitud, preparación, seguimiento y resultados en el mismo espacio. Reutiliza navegación y componentes existentes; no agrega una sección de primer nivel.
- **REQ-002 (Elegibilidad vigente):** La elegibilidad requiere que la calificación final vigente esté definida y sea menor que 6. La comparación usa el valor exacto, antes del redondeo para acta. Un final menor que 6 se redondea hacia abajo para acta según SPEC-076; un final de 6 o más no es elegible.
- **REQ-003 (Solicitud explícita):** El docente debe marcar que el alumno solicita presentar Extra. La solicitud conserva versión, auditoría e idempotencia del mecanismo vigente. Un alumno no solicitante no puede seleccionarse para generación.
- **REQ-004 (Historial visible):** El historial y resultados extraordinarios existentes siguen consultables aunque cambie la elegibilidad o se retire la solicitud. La pérdida de elegibilidad bloquea nuevas acciones, pero no oculta ni borra solicitudes, exámenes o resultados históricos.
- **REQ-005 (Generación protegida):** El generador por lote acepta solo alumnos elegibles y con solicitud vigente. El servidor vuelve a validar la final y la solicitud con los IDs canónicos recibidos. Si cualquier alumno es inválido, rechaza todo el lote antes de crear exámenes; no genera una cohorte parcial. Conserva las reglas de plantilla, periodo archivado, preview vigente, lote e idempotencia de SPEC-073.
- **REQ-006 (Preparación y estado):** La pestaña unificada facilita elegir plantilla, seleccionar solicitantes elegibles, cumplir la vista previa requerida y seguir el lote y sus exámenes. Los extraordinarios de periodos archivados siguen usando fuentes archivadas sin reactivarlas.
- **REQ-007 (Aplicación interna):** Los exámenes Extra generados se identifican como extraordinarios y conducen al flujo OMR/revisión existente con contexto suficiente de materia, alumno, lote y folio. Las decisiones de respuestas dudosas continúan requiriendo la revisión humana aplicable; el flujo no inventa respuestas.
- **REQ-008 (Resultado externo):** Se puede seleccionar un PDF fuente local para mostrar su nombre y calcular su SHA-256 en el cliente. El PDF no se transmite ni se conserva como copia nueva en el servidor; se envían solamente los metadatos requeridos por el contrato existente. Folio, lote opcional, aciertos, reactivos evaluables y criterios son datos confirmados por el docente; nunca se infieren del documento. La validación de elegibilidad y solicitud se mantiene en el servidor.
- **REQ-009 (Resultados y aislamiento):** Los resultados internos y externos conservan su clase, folio, lote solo si está documentado, origen y evidencia. Muestran calificación sobre 5, equivalente exacta presentada sobre 10 y estado aprobatorio; es aprobatoria solo si el equivalente exacto supera 6. El resultado Extra no altera parciales, global ni final ordinaria.
- **REQ-010 (PDF compuesto):** La experiencia conserva la identificación compuesta `LOTE-FOLIO` bajo el QR y en el pie de página cuando existe lote, y muestra el folio sin lote inventado para resultados externos sin lote verificable.
- **REQ-011 (Interfaz y accesibilidad):** La vista adapta tablas, formularios, metadatos y estados a 320–584 px y zoom de texto al 200 %, sin recortar datos. La pestaña es operable por teclado, comunica estados con texto, conserva foco visible y presenta errores junto al campo o acción afectados en claro y oscuro.

## Criterios de Aceptación

1. El docente puede recorrer solicitud, generación, revisión y consulta desde Calificaciones > Extraordinarios.
2. Con final 5.99 el alumno es elegible; con final 6.00 no lo es. La regla usa la final exacta, independientemente del valor para acta.
3. Sin solicitud explícita no se habilita selección ni generación. Retirar una solicitud no oculta resultados o exámenes previos.
4. El servidor rechaza una generación si un alumno seleccionado no pertenece a la materia/periodo, no tiene final menor que 6 o carece de solicitud vigente; si uno falla, no se crea ningún examen del lote.
5. Los periodos y plantillas archivados mantienen los requisitos actuales de selección, preview, historial e inmutabilidad.
6. Los reintentos con la misma clave y payload recuperan la misma operación sin duplicados; las claves reutilizadas con payload diferente siguen en conflicto.
7. La selección local de PDF llena nombre y SHA-256 reproducibles sin transmitir los bytes del archivo. El docente debe confirmar manualmente folio, lote, calificación/denominador y criterios.
8. El umbral usa equivalencia exacta: 6.00 es no aprobatoria; solo un valor mayor que 6 es aprobatorio. La persistencia no cambia calificaciones ordinarias.
9. Los resultados existentes son visibles cuando ya no hay elegibilidad o solicitud, pero no se habilita una nueva solicitud/generación/alta no permitida.
10. El identificador compuesto lote-folio se mantiene legible bajo el QR y en el pie del PDF generado.
11. Las pantallas conservan contenido y controles a 320, 360 y 584 px, al 200 % de zoom, con teclado y en ambos temas; nombres accesibles, foco y mensajes de error son verificables.

## Matriz de Trazabilidad

| ID Requisito | Descripción del Caso | Archivo de Test Vinculado | Estado |
| --- | --- | --- | --- |
| REQ-001, REQ-002, REQ-003, REQ-004, REQ-009 | Panel unificado, límite exacto 5.99/6.00, solicitud explícita e historial visible | `apps/frontend/tests/extraordinariosCalificaciones.test.tsx`; `apps/frontend/tests/seccionCalificaciones.resumen.test.tsx` | Focalizadas PASS; bundle instalado y servido; recorrido visual manual pendiente |
| REQ-005, REQ-006 | Generación extraordinaria por lote, rechazo atómico, cambios de elegibilidad e invariantes de periodo | `apps/backend/tests/integracion/flujoExamen.test.ts`; `apps/backend/tests/examenExtraordinario.rules.test.ts`; `apps/frontend/tests/plantillasExtraordinarioArchivado.test.tsx` | Focalizadas PASS; suite backend completa tiene fallo OMR no relacionado |
| REQ-007, REQ-010 | Revisión OMR Extra y código compuesto del examen/PDF | `apps/frontend/tests/plantillas.refactor.test.tsx`; `apps/backend/tests/pdf.extraordinario.dosHojas.test.ts` | Focalizadas PASS |
| REQ-008 | Selección local, SHA-256, confirmación manual y payload sin bytes de archivo | `apps/frontend/tests/extraordinariosCalificaciones.test.tsx`; `apps/backend/tests/integracion/listaAcademicaContratos.test.ts` | Focalizadas PASS |
| REQ-011 | Responsive, semántica, foco, temas y legibilidad | `apps/frontend/tests/gui.responsive.contract.test.tsx`; `scripts/wcag-guard.mjs` | Contratos y WCAG PASS; bundle instalado; revisión manual de teclado/zoom/temas pendiente |
