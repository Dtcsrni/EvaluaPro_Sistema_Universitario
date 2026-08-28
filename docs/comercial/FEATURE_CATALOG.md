# Catalogo de Capacidades

> Documento auto-generado. No editar manualmente.
> Fecha de sincronizacion: **2026-08-28**

## Matriz por persona y nivel minimo

| Capacidad | Categoria | Docente (nivel minimo) | Coordinacion (nivel minimo) | Institucional (nivel minimo) | Socio de Canal (nivel minimo) | Estado tecnico | Evidencia |
| --- | --- | --- | --- | --- | --- | --- | --- |
| Monitoreo de salud del sistema (`/salud`) | Plataforma | Docente Esencial | Coordinacion Esencial | Institucional Esencial | Socio Operador | Activa | `tests/salud.test.ts` |
| Metricas Prometheus (`/metrics`) | Plataforma | Docente Impulso | Coordinacion Gestion | Institucional Esencial | Socio Operador | Activa | `apps/backend/src/compartido/observabilidad/metrics.ts` |
| Autenticacion docente y sesion segura (`/autenticacion`) | Seguridad | Docente Esencial | Coordinacion Esencial | Institucional Esencial | Socio Operador | Activa | `tests/integracion/autenticacionSesion.test.ts` |
| Gestion de alumnos (`/alumnos`) | Operacion Academica | Docente Esencial | Coordinacion Esencial | Institucional Esencial | Socio Operador | Activa | `tests/integracion/alumnosEdicion.test.ts` |
| Gestion de periodos y materias (`/periodos`) | Operacion Academica | Docente Esencial | Coordinacion Esencial | Institucional Esencial | Socio Operador | Activa | `tests/integracion/periodosBorradoDuplicados.test.ts` |
| Banco de preguntas y asignacion (`/banco-preguntas`) | Preparacion de Examenes | Docente Esencial | Coordinacion Esencial | Institucional Esencial | Socio Operador | Activa | `tests/integracion/bancoPreguntasAsignarMateria.test.ts` |
| Generacion de examenes PDF (`/examenes`) | Preparacion de Examenes | Docente Esencial | Coordinacion Esencial | Institucional Esencial | Socio Operador | Activa | `tests/integracion/pdfImpresionContrato.test.ts` |
| Vinculacion por QR y entregas (`/entregas`) | Aplicacion y Captura | Docente Esencial | Coordinacion Esencial | Institucional Esencial | Socio Operador | Activa | `tests/integracion/flujoExamen.test.ts` |
| Lectura OMR y validacion de respuestas (`/omr`) | Aplicacion y Captura | Docente Esencial | Coordinacion Esencial | Institucional Esencial | Socio Operador | Activa | `tests/omr.contrato.test.ts` |
| Calificacion global y reglas institucionales (`/calificaciones`) | Calificacion | Docente Esencial | Coordinacion Esencial | Institucional Esencial | Socio Operador | Activa | `tests/calificacion.global.reglas.test.ts` |
| Analiticas y exportables (`/analiticas`) | Calificacion | Docente Impulso | Coordinacion Gestion | Institucional Esencial | Socio Operador | Activa | `tests/analiticas.xlsx.sv.contract.test.ts` |
| Politicas de evaluacion por periodo (`/evaluaciones`) | Calificacion | Docente Impulso | Coordinacion Gestion | Institucional Esencial | Socio Operador | Activa | `tests/integracion/evaluaciones.modulo.test.ts` |
| Integracion con Google Classroom (`/integraciones/classroom`) | Integraciones | Docente Impulso | Coordinacion Gestion | Institucional Esencial | Socio Operador | Activa | `tests/integracion/classroom.pull.test.ts` |
| Sincronizacion local-cloud entre equipos (`/sincronizaciones`) | Operacion Distribuida | Docente Impulso | Coordinacion Gestion | Institucional Esencial | Socio Operador | Activa | `tests/sincronizacion.contrato.test.ts` |
| Papelera y recuperacion de registros (`/papelera`) | Operacion Distribuida | No | Coordinacion Acompanamiento | Institucional Esencial | Socio Operador | Activa | `apps/backend/src/modulos/modulo_papelera` |
| Cumplimiento (ARCO/DSR, retencion y auditoria) (`/compliance`) | Cumplimiento | No | No | Institucional Sector Publico | Socio Operador | Activa | `tests/integracion/compliance.arco.test.ts` |
| Administracion de docentes (`/admin`) | Gobernanza | No | Coordinacion Acompanamiento | Institucional Esencial | Socio Operador | Activa | `apps/backend/src/modulos/modulo_admin_docentes` |

## Aplicacion y Captura

- **Lectura OMR y validacion de respuestas** (`/omr`)
  - Docente: Docente Esencial.
  - Coordinacion: Coordinacion Esencial.
  - Institucional: Institucional Esencial.
  - Socio de Canal: Socio Operador.
  - Estado: activa. Evidencia: `tests/omr.contrato.test.ts`.
- **Vinculacion por QR y entregas** (`/entregas`)
  - Docente: Docente Esencial.
  - Coordinacion: Coordinacion Esencial.
  - Institucional: Institucional Esencial.
  - Socio de Canal: Socio Operador.
  - Estado: activa. Evidencia: `tests/integracion/flujoExamen.test.ts`.

## Calificacion

- **Analiticas y exportables** (`/analiticas`)
  - Docente: Docente Impulso.
  - Coordinacion: Coordinacion Gestion.
  - Institucional: Institucional Esencial.
  - Socio de Canal: Socio Operador.
  - Estado: activa. Evidencia: `tests/analiticas.xlsx.sv.contract.test.ts`.
- **Calificacion global y reglas institucionales** (`/calificaciones`)
  - Docente: Docente Esencial.
  - Coordinacion: Coordinacion Esencial.
  - Institucional: Institucional Esencial.
  - Socio de Canal: Socio Operador.
  - Estado: activa. Evidencia: `tests/calificacion.global.reglas.test.ts`.
- **Politicas de evaluacion por periodo** (`/evaluaciones`)
  - Docente: Docente Impulso.
  - Coordinacion: Coordinacion Gestion.
  - Institucional: Institucional Esencial.
  - Socio de Canal: Socio Operador.
  - Estado: activa. Evidencia: `tests/integracion/evaluaciones.modulo.test.ts`.

## Cumplimiento

- **Cumplimiento (ARCO/DSR, retencion y auditoria)** (`/compliance`)
  - Docente: No.
  - Coordinacion: No.
  - Institucional: Institucional Sector Publico.
  - Socio de Canal: Socio Operador.
  - Estado: activa. Evidencia: `tests/integracion/compliance.arco.test.ts`.

## Gobernanza

- **Administracion de docentes** (`/admin`)
  - Docente: No.
  - Coordinacion: Coordinacion Acompanamiento.
  - Institucional: Institucional Esencial.
  - Socio de Canal: Socio Operador.
  - Estado: activa. Evidencia: `apps/backend/src/modulos/modulo_admin_docentes`.

## Integraciones

- **Integracion con Google Classroom** (`/integraciones/classroom`)
  - Docente: Docente Impulso.
  - Coordinacion: Coordinacion Gestion.
  - Institucional: Institucional Esencial.
  - Socio de Canal: Socio Operador.
  - Estado: activa. Evidencia: `tests/integracion/classroom.pull.test.ts`.

## Operacion Academica

- **Gestion de alumnos** (`/alumnos`)
  - Docente: Docente Esencial.
  - Coordinacion: Coordinacion Esencial.
  - Institucional: Institucional Esencial.
  - Socio de Canal: Socio Operador.
  - Estado: activa. Evidencia: `tests/integracion/alumnosEdicion.test.ts`.
- **Gestion de periodos y materias** (`/periodos`)
  - Docente: Docente Esencial.
  - Coordinacion: Coordinacion Esencial.
  - Institucional: Institucional Esencial.
  - Socio de Canal: Socio Operador.
  - Estado: activa. Evidencia: `tests/integracion/periodosBorradoDuplicados.test.ts`.

## Operacion Distribuida

- **Papelera y recuperacion de registros** (`/papelera`)
  - Docente: No.
  - Coordinacion: Coordinacion Acompanamiento.
  - Institucional: Institucional Esencial.
  - Socio de Canal: Socio Operador.
  - Estado: activa. Evidencia: `apps/backend/src/modulos/modulo_papelera`.
- **Sincronizacion local-cloud entre equipos** (`/sincronizaciones`)
  - Docente: Docente Impulso.
  - Coordinacion: Coordinacion Gestion.
  - Institucional: Institucional Esencial.
  - Socio de Canal: Socio Operador.
  - Estado: activa. Evidencia: `tests/sincronizacion.contrato.test.ts`.

## Plataforma

- **Metricas Prometheus** (`/metrics`)
  - Docente: Docente Impulso.
  - Coordinacion: Coordinacion Gestion.
  - Institucional: Institucional Esencial.
  - Socio de Canal: Socio Operador.
  - Estado: activa. Evidencia: `apps/backend/src/compartido/observabilidad/metrics.ts`.
- **Monitoreo de salud del sistema** (`/salud`)
  - Docente: Docente Esencial.
  - Coordinacion: Coordinacion Esencial.
  - Institucional: Institucional Esencial.
  - Socio de Canal: Socio Operador.
  - Estado: activa. Evidencia: `tests/salud.test.ts`.

## Preparacion de Examenes

- **Banco de preguntas y asignacion** (`/banco-preguntas`)
  - Docente: Docente Esencial.
  - Coordinacion: Coordinacion Esencial.
  - Institucional: Institucional Esencial.
  - Socio de Canal: Socio Operador.
  - Estado: activa. Evidencia: `tests/integracion/bancoPreguntasAsignarMateria.test.ts`.
- **Generacion de examenes PDF** (`/examenes`)
  - Docente: Docente Esencial.
  - Coordinacion: Coordinacion Esencial.
  - Institucional: Institucional Esencial.
  - Socio de Canal: Socio Operador.
  - Estado: activa. Evidencia: `tests/integracion/pdfImpresionContrato.test.ts`.

## Seguridad

- **Autenticacion docente y sesion segura** (`/autenticacion`)
  - Docente: Docente Esencial.
  - Coordinacion: Coordinacion Esencial.
  - Institucional: Institucional Esencial.
  - Socio de Canal: Socio Operador.
  - Estado: activa. Evidencia: `tests/integracion/autenticacionSesion.test.ts`.
