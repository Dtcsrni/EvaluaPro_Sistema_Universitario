---
id: SPEC-CLASSROOM-EXPERIENCIA-USUARIO
titulo: Experiencia operativa Classroom y consulta de calificaciones
version: 2.4.0
fecha: 2026-09-30
autor: Codex / Agente IA
modulo: modulo_integraciones_classroom
estado: approved
---

# SPEC-CLASSROOM-EXPERIENCIA-USUARIO: Experiencia operativa Classroom y consulta de calificaciones

## Contexto
Google Classroom es la fuente de actividades, entregas y calificaciones, y el lugar donde el docente crea, recibe, revisa y califica actividades. EvaluaPro conecta la cuenta, sincroniza datos existentes y facilita su consulta para el trabajo docente. La experiencia debe dejar la pantalla Classroom enfocada en conexión, cursos, estado e historial de sincronización; actividades sincronizadas, vínculos de alumnos, evidencias, mapeo de cortes y consulta de notas deben vivir en Calificaciones. EvaluaPro no debe crear actividades Classroom, duplicar entregas ni ofrecer una segunda superficie para calificarlas. Los flujos deben distinguir claramente sincronización, consulta de solo lectura y operaciones que conservan la fuente de verdad externa.

## Requisitos Funcionales
- **REQ-001:** Calificaciones debe permitir filtrar las vinculaciones Classroom por nombre, correo e identidad del alumno Classroom o local.
- **REQ-002:** La lista de vinculaciones debe indicar cuantas filas coinciden con el filtro respecto del total cargado.
- **REQ-003:** La consulta de evidencias sincronizadas debe filtrar por alumno, actividad, calificación o estado.
- **REQ-004:** La consulta de evidencias debe indicar cuantas filas coinciden con el filtro respecto del total cargado.
- **REQ-005:** La sincronizacion backend debe resolver alumnos locales mediante indices en memoria por correo, matricula e id, evitando consultas N+1 a `Alumno` por cada alumno o submission de Classroom.
- **REQ-006:** La validacion externa con Google Classroom real debe tener un formato manual reproducible y un validador que registre credenciales/configuracion presentes, curso real, actividad real, importacion, reimportacion, alumnos vinculados y evidencia sin exponer secretos.
- **REQ-007:** Debe existir un doctor local que valide prerequisitos de configuracion Classroom (client id, secret, redirect URI y llave de cifrado) sin imprimir secretos ni tokens.
- **REQ-008:** La sección Classroom solo presenta conexión OAuth, estado/disponibilidad, selección de curso y materia, acción de sincronización permitida e historial. Sus etiquetas explican que sincronizar importa calificaciones ya asignadas en Classroom.
- **REQ-009:** La sección Classroom no crea actividades o entregas, no ofrece mapeo de alumnos/actividades/cortes y no permite revisar ni asignar calificaciones. El origen y destino de esas acciones se explica cuando corresponda.
- **REQ-010:** Calificaciones concentra evidencias Classroom importadas, consulta de actividades, vínculo de alumnos, asignación de corte/columna y consulta de calificaciones. La vista de Classroom es de solo lectura y enlaza a la actividad de origen cuando se dispone de un enlace seguro.
- **REQ-011:** La sincronización solo transmite identificadores de cursos/actividades y permisos necesarios para importar; usa los servicios API existentes y registra historial. No crea recursos en Classroom ni escribe notas allí.
- **REQ-012:** Los estados de carga, vacío, desconectado, error, sin permiso y sincronización completada tienen texto explícito, acciones contextuales y nombres accesibles; la navegación y controles funcionan con teclado y reflow móvil.
- **REQ-013:** Las pruebas de interfaz verifican separación de responsabilidades, mientras contratos/rutas prueban que GUI y API usan las mismas operaciones y que la lectura de Calificaciones no muta Classroom ni crea entregas.
- **REQ-014:** La vista previa de actividades mapeadas al tercer parcial calcula por alumno la evaluación continua que resultará en EvaluaPro con la misma regla de la lista académica: suma de puntos obtenidos / puntos posibles × 10, y divide el promedio entre dos para mostrar el componente de continua sobre 5. Las calificaciones pendientes se excluyen; las faltas cuentan como cero solo si fueron confirmadas explícitamente por el docente y están vencidas. La GUI permite previsualizar esa selección por API y bloquea la sincronización si la proyección está desactualizada. La API conserva la evidencia pendiente con su auditoría al ejecutar la confirmación; el preview por sí solo no escribe evidencias ni calificaciones.
- **REQ-015:** Al ejecutar una sincronización, Calificaciones debe distinguir el conteo previo de altas/cambios potenciales (`wouldCreate`, `wouldUpdate`) del resultado real (`importadas`, `actualizadas`). Debe conservar la proyección validada, mostrar un aviso de ejecución con los conteos devueltos por la API y releer evidencias. Si la escritura termina pero la relectura falla, debe comunicar ambos hechos sin declarar la relectura exitosa. El contador previo seguirá describiéndose como pendiente de actualizar; el contador posterior usará los resultados reales. El backend debe responder los conteos reales y permitir comprobarlos con la lista de evidencias.

## Criterios de Aceptación
- **AC-001 (REQ-001):** Al buscar en las vinculaciones, la lista visible solo conserva filas que coinciden con datos Classroom o alumno local.
- **AC-002 (REQ-002):** La UI muestra un contador `Mostrando X de Y estudiantes` para la lista cargada.
- **AC-003 (REQ-003):** Al buscar en evidencias, la tabla visible conserva solo las filas coincidentes.
- **AC-004 (REQ-004):** La UI muestra un contador `Mostrando X de Y evidencias` para la consulta cargada.
- **AC-005 (REQ-005):** La importacion persistente de submissions paginadas no ejecuta `Alumno.findOne` ni `Alumno.findById` por submission para resolver o decorar alumnos locales.
- **AC-006 (REQ-006):** Existe un template manual versionado y `release:check:classroom-e2e` rechaza placeholders, pasos incompletos o conteos invalidos; el audit documenta que sin ese JSON completado con datos reales no se puede declarar el gate externo como aprobado.
- **AC-007 (REQ-007):** `classroom:doctor` falla cuando falta configuracion requerida, pasa con valores presentes y llave base64 de 32 bytes, y su salida solo reporta presencia/estado.
- **AC-008 (REQ-008):** Classroom muestra conexión, curso/materia, estado e historial; la sincronización comunica que importa únicamente calificaciones asignadas en el origen.
- **AC-009 (REQ-009):** La ruta no expone controles para crear actividades/entregas, calificar, mapear alumnos o configurar evidencias/cortes.
- **AC-010 (REQ-010):** Calificaciones permite consultar evidencias y actividades sincronizadas, revisar y guardar los vínculos/mapeos locales existentes y consultar notas sin enviar cambios a Classroom.
- **AC-011 (REQ-011):** El payload de sincronización contiene IDs de recursos Classroom existentes; una llamada de lectura/listado no llama endpoints de creación ni escritura de notas.
- **AC-012 (REQ-012):** Estados y controles críticos se verifican con roles/nombres accesibles y pruebas responsive/WCAG disponibles; ningún estado se comunica solo por color.
- **AC-013 (REQ-013):** Pruebas focales cubren la conducta GUI/API compartida y las operaciones externas son de lectura, excepto OAuth y sincronización de importación autorizada.
- **AC-014 (REQ-014):** Con una actividad de 100 puntos, notas asignadas de 90 y 70 para dos alumnos vinculados y una entrega aún sin nota, la API devuelve continua proyectada de 4.5/5 y 3.5/5 respectivamente, excluye al alumno pendiente y no persiste evidencia en preview; la GUI muestra la tabla. Al marcar una falta vencida, la GUI vuelve a solicitar el preview con esa selección y deshabilita sincronizar hasta recibir la proyección nueva. Esta proyección añade el cero y sigue sin persistir evidencia; al confirmar la ejecución, la API guarda una evidencia pendiente auditada y la lista académica la incorpora como cero.
- **AC-015 (REQ-015):** Con un preview de una alta y dos actualizaciones potenciales, la respuesta de ejecución con `importadas: 1` y `actualizadas: 2` se muestra como resultado real, conserva las filas proyectadas, anuncia que la sincronización terminó y vuelve a consultar evidencias. Si esa consulta falla, la UI mantiene un aviso de sincronización completada junto con el error de lectura y no oculta el error ni afirma que la lectura tuvo éxito. La API de integración verifica que los conteos de ejecución coincidan con las evidencias recuperadas tras escribir.

## Matriz de Trazabilidad

| ID Requisito | Descripcion del Caso | Archivo de Test Vinculado | Estado |
| --- | --- | --- | --- |
| REQ-001 | Filtro de vinculaciones Classroom en Calificaciones | apps/frontend/tests/classroomEnCalificaciones.test.tsx | En validación |
| REQ-002 | Conteo visible de estudiantes vinculables | apps/frontend/tests/classroomEnCalificaciones.test.tsx | En validación |
| REQ-003 | Filtro de evidencias Classroom consultadas | apps/frontend/tests/classroomEnCalificaciones.test.tsx | En validación |
| REQ-004 | Conteo visible de evidencias filtradas | apps/frontend/tests/classroomEnCalificaciones.test.tsx | En validación |
| REQ-005 | Resolucion backend de alumnos sin N+1 por submission | apps/backend/tests/integracion/classroom.audit.test.ts | Completado |
| REQ-006 | Formato y validador de evidencia externa Google Classroom real | scripts/tests/classroom-e2e-evidence.test.mjs | Completado |
| REQ-007 | Doctor no sensible de configuracion Classroom | scripts/tests/classroom-doctor.test.mjs | Completado |
| REQ-008 | Pantalla de conexión, curso, estado e historial | apps/frontend/tests/seccionClassroom.test.tsx | En validación |
| REQ-009 | Ausencia de acciones duplicadas de Classroom | apps/frontend/tests/seccionClassroom.test.tsx | En validación |
| REQ-010 | Consulta de evidencias y mapeos en Calificaciones | apps/frontend/tests/classroomEnCalificaciones.test.tsx | En validación |
| REQ-011 | Sin escritura de actividades/entregas/notas externas | apps/backend/tests/integracion/classroom.v2.test.ts | En validación |
| REQ-012 | Estados, semántica accesible y experiencia responsive | apps/frontend/tests/seccionClassroom.test.tsx | En validación |
| REQ-013 | Paridad entre consulta GUI y API | apps/frontend/tests/classroomEnCalificaciones.test.tsx | En validación |
| REQ-014 | Proyección de continua C3 consistente entre API y lista académica; confirmación explícita de faltas vencidas | apps/backend/tests/integracion/classroom.v2.test.ts, apps/frontend/tests/classroomEnCalificaciones.test.tsx | Completado local |
| REQ-015 | Resultado real de sincronización, mensaje persistente y relectura distinguible del éxito de escritura | apps/backend/tests/integracion/classroom.v2.test.ts, apps/frontend/tests/classroomEnCalificaciones.test.tsx | Completado local |

## Decisiones de experiencia

- **Fuente de verdad:** Classroom conserva la autoría, recepción, revisión y calificación de actividades. EvaluaPro conserva vínculos, metadatos de evidencia y mapeos académicos locales.
- **Navegación:** Classroom es el centro de conexión y sincronización. Calificaciones es el espacio para explorar lo sincronizado y asociarlo al flujo local de evaluación.
- **Operaciones externas:** OAuth y sincronización entrante usan los endpoints Classroom existentes. La lectura desde Calificaciones no escribe de vuelta en Google.
- **Pendiente de evidencia:** la paridad de endpoints no implica equivalencia de datos real de Google; el gate externo requiere el procedimiento reproducible existente y credenciales reales, sin ejecutarlo durante este rediseño.
