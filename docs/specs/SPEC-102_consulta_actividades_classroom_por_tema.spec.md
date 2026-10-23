---
id: SPEC-102
titulo: Consulta y análisis de actividades de Google Classroom por tema
version: 0.1.0
fecha: 2026-10-23
autor: Codex / EvaluaPro
modulo: modulo_integraciones_classroom
estado: approved
---

## Contexto

La vista actual de Classroom en Calificaciones está orientada a sincronizar
calificaciones y no expone de forma suficiente el contenido ni el calendario de
las actividades para preparar una evaluación. En Google Classroom, el tema del
curso agrupa actividades; para el examen de segundo parcial, el tema confirmado
por la persona docente es «Segundo Parcial». La consulta debe ocurrir desde
EvaluaPro con la cuenta docente vinculada, conservar la fuente y facilitar una
revisión fiel del material asignado.

Esta especificación cubre lectura, visualización y análisis docente de
actividades. No modifica Classroom, no importa ni publica calificaciones y no
incluye respuestas ni entregas individuales de estudiantes.

## Objetivo

Permitir que la persona docente consulte y revise desde EvaluaPro las actividades
de un curso de Classroom, las filtre por tema y vea las fechas y metadatos
necesarios para identificar, interpretar y usar esas actividades como fuentes de
contenido académico.

## Requisitos Funcionales

- **REQ-001 (Listado por curso y tema):** La persona docente selecciona
  explícitamente un curso y puede filtrar las actividades por tema de Classroom.
  El filtro compara el identificador de tema y muestra su nombre; no infiere el
  tema a partir del título de la actividad. Si un curso no define temas, las
  actividades se presentan bajo «Sin tema».
- **REQ-002 (Contenido y metadatos):** Cada actividad consultada expone el título
  y descripción completos; nombre del curso y tema; tipo de actividad; estado
  (publicada, borrador, eliminada o desconocido según los datos disponibles);
  fecha programada de publicación, fecha de entrega, puntos máximos, tipo de
  calificación/categoría y periodo de calificación cuando existan; materiales
  adjuntos con su tipo, nombre y enlace disponible; enlace original válido a la
  actividad; y fechas de creación y última modificación cuando la fuente las
  entregue. Los campos ausentes se identifican explícitamente como no
  proporcionados, nunca se sustituyen por datos inferidos. No se descargan
  documentos enlazados sin el scope y consentimiento que requiera esa fuente.
- **REQ-003 (Fechas y zona horaria):** Las fechas de publicación/creación,
  modificación, publicación programada y entrega se conservan con su valor de
  origen. `dueDate` y `dueTime` de Classroom se interpretan según el contrato de
  la API (UTC), y se muestran con la zona de visualización configurada para la
  persona docente; la etiqueta identifica esa zona. Si no existe configuración,
  la UI muestra UTC o solicita elegir una zona antes de convertir. Si solo
  existe fecha sin hora, se muestra como fecha; si no existe fecha límite, se
  indica «Sin fecha de entrega». No se convierte una fecha sin hora en hora
  límite. La UI no afirma que la zona elegida sea la zona original del curso.
- **REQ-004 (Listado exhaustivo y fallos parciales):** La consulta respeta la
  paginación de Classroom, evita duplicar actividades y deja claro si el
  resultado está completo, parcial o falló. Los errores de permisos, conexión o
  cuota no se muestran como lista vacía. La interfaz conserva filtros y datos ya
  recibidos cuando una página posterior falla e indica cómo reintentar.
- **REQ-005 (Solo lectura y enlace a fuente):** La consulta solo usa operaciones
  de lectura. El enlace externo se presenta únicamente si es HTTPS y pertenece
  al dominio permitido de Classroom; se abre de forma segura. EvaluaPro no edita,
  publica, despublica, elimina ni cambia fechas, tema, puntaje o materiales.
- **REQ-006 (Privacidad y alcance):** Para esta vista no se solicitan ni exponen
  roster, entregas, comentarios privados o calificaciones individuales. La
  actividad se presenta como material del curso, no como evidencia de que un
  estudiante entregó o completó el trabajo.
- **REQ-007 (Análisis de parcial):** La vista permite revisar juntas todas las
  actividades del tema seleccionado, incluyendo su descripción, materiales y
  fechas. La clasificación de las actividades del examen se confirma por tema
  seleccionado y contexto del curso; EvaluaPro no reasigna temas ni considera
  automáticamente cualquier actividad de otro tema como parte del parcial.
- **REQ-008 (Accesibilidad y formatos):** El listado y el detalle son operables
  con teclado y lector de pantalla; fechas, estados y errores no dependen solo
  del color. Texto extenso y enlaces se presentan sin truncar la información
  esencial, con expansión accesible cuando sea necesario.

## Criterios de Aceptación

1. Para un curso con varios temas, elegir «Segundo Parcial» muestra solo sus
   actividades y muestra claramente el curso y tema seleccionados.
2. Se puede consultar íntegramente título, descripción, materiales y enlace de
   cada actividad junto con tipo, estado, puntos y fechas proporcionadas por
   Classroom.
3. Se prueban fechas con hora, solo fecha, sin fecha límite y cambios de fecha;
   la representación aplica y etiqueta la zona configurada para la persona
   docente o UTC y no inventa horas ni atribuye una zona al curso sin evidencia.
4. Una lista paginada recupera todas las actividades una sola vez; una falla de
   página produce estado parcial/error visible y no se confunde con cero
   actividades.
5. La GUI no presenta acciones de escritura sobre Classroom ni consulta entregas
   o notas de estudiantes para esta vista.
6. Enlaces externos inválidos o de hosts no permitidos no se vuelven clicables.
7. La prueba de GUI comprueba teclado, nombres accesibles, contenido extenso,
   estado de carga, vacío, error y resultado parcial.
8. Las pruebas de contrato/servicio verifican la correspondencia de campos
   Google Classroom → API → GUI y los campos opcionales ausentes.

## Matriz de Trazabilidad

| Requisito | Evidencia prevista |
| --- | --- |
| REQ-001 | `apps/backend/tests/servicioClassroomGoogle.test.ts`; `apps/frontend/tests/classroomEnCalificaciones.test.tsx` |
| REQ-002 | `apps/backend/tests/servicioClassroomGoogle.test.ts`; `apps/backend/tests/integracion/classroom.v2.test.ts`; `apps/frontend/tests/classroomEnCalificaciones.test.tsx` |
| REQ-003 | `apps/backend/tests/servicioClassroomGoogle.test.ts`; `apps/frontend/tests/classroomEnCalificaciones.test.tsx` |
| REQ-004 | `apps/backend/tests/servicioClassroomGoogle.test.ts`; `apps/backend/tests/integracion/classroom.v2.test.ts`; `apps/frontend/tests/classroomEnCalificaciones.test.tsx` |
| REQ-005 | `apps/backend/tests/servicioClassroomGoogle.test.ts`; `apps/frontend/tests/classroomEnCalificaciones.test.tsx` |
| REQ-006 | `apps/backend/tests/servicioClassroomGoogle.test.ts`; `apps/frontend/tests/classroomEnCalificaciones.test.tsx` |
| REQ-007 | `apps/backend/tests/integracion/classroom.v2.test.ts`; `apps/frontend/tests/classroomEnCalificaciones.test.tsx` |
| REQ-008 | `apps/frontend/tests/classroomEnCalificaciones.test.tsx`; `npm run guard:wcag` |

## Dependencias y límites

- Complementa SPEC-046, que sigue siendo la fuente de requisitos para importar y
  mapear calificaciones Classroom.
- Se deberán revisar permisos OAuth vigentes y usar solo los scopes necesarios
  para leer cursos, temas, actividades y materiales. Si un dato requiere un scope
  adicional, se documentará y se solicitará consentimiento mediante el flujo
  normal de vinculación docente.
- No se define aquí la generación del banco de preguntas ni del examen; esta
  vista aporta fuentes verificables para ese flujo.
- Estado `approved`: la persona docente solicitó el análisis de las actividades
  del tema «Segundo Parcial» e indicó que se expongan fechas y los datos
  necesarios. Este alcance guía la implementación y sus pruebas conforme al
  proceso SDD del repositorio.

## Referencias técnicas primarias

- Google Classroom API, recurso `CourseWork` (campos de actividad, `dueDate`,
  `dueTime`, `scheduledTime`, `materials`, `topicId`, estado y puntos):
  <https://developers.google.com/workspace/classroom/reference/rest/v1/courses.courseWork>
- Google Classroom API, recurso `Topic` (identificador y nombre de tema):
  <https://developers.google.com/workspace/classroom/reference/rest/v1/courses.topics>
- Google Classroom API, recurso `Course` (metadatos del curso):
  <https://developers.google.com/workspace/classroom/reference/rest/v1/courses>
