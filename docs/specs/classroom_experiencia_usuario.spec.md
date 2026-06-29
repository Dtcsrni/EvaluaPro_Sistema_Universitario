---
id: SPEC-CLASSROOM-EXPERIENCIA-USUARIO
titulo: Experiencia operativa Classroom para grupos grandes
version: 1.1.0
fecha: 2026-06-27
autor: Codex / Agente IA
modulo: modulo_integraciones_classroom
estado: implemented
---

# SPEC-CLASSROOM-EXPERIENCIA-USUARIO: Experiencia operativa Classroom para grupos grandes

## Contexto
Un docente que ya trabaja con Google Classroom necesita importar calificaciones y revisar mapeos sin inspeccionar listas largas manualmente. Para que Classroom sea utilizable en grupos reales, la interfaz debe permitir localizar alumnos y submissions por nombre, correo, matricula, estado o estrategia de match antes de guardar mapeos o ejecutar importaciones. El backend debe resolver alumnos locales con los datos del curso ya cargados, sin consultas por cada fila de Classroom, para que el preview y la importacion mantengan latencia razonable en grupos grandes.

## Requisitos Funcionales
- **REQ-001:** La pantalla Classroom debe permitir filtrar el roster de alumnos Classroom por nombre, correo, estrategia de match y alumno local asociado.
- **REQ-002:** La pantalla Classroom debe indicar cuantas filas de mapeo se muestran respecto del total cargado.
- **REQ-003:** El preview/resultado de importacion Classroom debe permitir filtrar submissions por alumno Classroom, alumno local, correo, estado de captura, estrategia de match o id de submission.
- **REQ-004:** El preview/resultado debe indicar cuantas submissions se muestran respecto del total devuelto por el backend.
- **REQ-005:** La sincronizacion backend debe resolver alumnos locales mediante indices en memoria por correo, matricula e id, evitando consultas N+1 a `Alumno` por cada alumno o submission de Classroom.
- **REQ-006:** La validacion externa con Google Classroom real debe tener un formato manual reproducible y un validador que registre credenciales/configuracion presentes, curso real, actividad real, importacion, reimportacion, alumnos vinculados y evidencia sin exponer secretos.
- **REQ-007:** Debe existir un doctor local que valide prerequisitos de configuracion Classroom (client id, secret, redirect URI y llave de cifrado) sin imprimir secretos ni tokens.

## Criterios de Aceptación
- **AC-001 (REQ-001):** Al escribir una busqueda en el mapeo de alumnos, la lista visible solo conserva filas que coinciden con datos Classroom o alumno local.
- **AC-002 (REQ-002):** La UI muestra un contador `Mostrando X de Y alumnos` para el roster cargado.
- **AC-003 (REQ-003):** Al escribir una busqueda en el preview, la lista visible solo conserva submissions coincidentes.
- **AC-004 (REQ-004):** La UI muestra un contador `Mostrando X de Y submissions` por actividad.
- **AC-005 (REQ-005):** La importacion persistente de submissions paginadas no ejecuta `Alumno.findOne` ni `Alumno.findById` por submission para resolver o decorar alumnos locales.
- **AC-006 (REQ-006):** Existe un template manual versionado y `release:check:classroom-e2e` rechaza placeholders, pasos incompletos o conteos invalidos; el audit documenta que sin ese JSON completado con datos reales no se puede declarar el gate externo como aprobado.
- **AC-007 (REQ-007):** `classroom:doctor` falla cuando falta configuracion requerida, pasa con valores presentes y llave base64 de 32 bytes, y su salida solo reporta presencia/estado.

## Matriz de Trazabilidad

| ID Requisito | Descripcion del Caso | Archivo de Test Vinculado | Estado |
| --- | --- | --- | --- |
| REQ-001 | Filtro de roster Classroom por busqueda | apps/frontend/tests/centroClassroom.behavior.test.tsx | Completado |
| REQ-002 | Conteo visible de filas del roster | apps/frontend/tests/centroClassroom.behavior.test.tsx | Completado |
| REQ-003 | Filtro de submissions de preview por busqueda | apps/frontend/tests/centroClassroom.behavior.test.tsx | Completado |
| REQ-004 | Conteo visible de submissions por actividad | apps/frontend/tests/centroClassroom.behavior.test.tsx | Completado |
| REQ-005 | Resolucion backend de alumnos sin N+1 por submission | apps/backend/tests/integracion/classroom.audit.test.ts | Completado |
| REQ-006 | Formato y validador de evidencia externa Google Classroom real | scripts/tests/classroom-e2e-evidence.test.mjs | Completado |
| REQ-007 | Doctor no sensible de configuracion Classroom | scripts/tests/classroom-doctor.test.mjs | Completado |
