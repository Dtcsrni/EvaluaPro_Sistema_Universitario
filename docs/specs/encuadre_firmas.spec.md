---
id: SPEC-002
titulo: Automatizacion de Reglas de Encuadre y Firma Digital Institucional
version: 1.1.0
fecha: 2026-06-23
autor: Antigravity
modulo: modulo_evaluaciones
estado: implemented
---

# SPEC-002: Automatizacion de Reglas de Encuadre y Firma Digital Institucional

## Contexto
El Centro Universitario Hidalguense (CUH) tiene normativas academicas oficiales sobre la ponderacion de examenes,
las inasistencias y el redondeo de calificaciones.
Este desarrollo automatiza estas reglas y proporciona un flujo local y 100% gratuito para la firma digital
de conformidad del encuadre oficial, utilizando `pdf-lib` y tokens seguros enviados por correo institucional.

**Hallazgo adicional (v1.1.0):** La estructura del encuadre es fija (misma distribucion de bloques, mismo texto
reglamentario), pero los **datos institucionales** (nombre de la institucion, lema y logo) y los
**metadatos de la asignatura** (clave, nombre, horas, creditos, objetivo) cambian por periodo y materia.
El servicio debe ser completamente parametrizable para soportar cualquier institucion, no solo CUH.

## Requisitos Funcionales
- **REQ-001:** El sistema debe registrar y persistir los encuadres academicos y sus correspondientes firmas por periodo (Prisma).
- **REQ-002:** El backend debe generar un PDF de encuadre con `pdf-lib` replicando el formato oficial "ENCUADRE LISC.docx":
  - Tabla "Formato de Asignatura" (Instituto, Programa Educativo, Periodo, Area, Clave, Asignatura, Horas, Creditos, Eje de Formacion, Objetivo General).
  - Seccion "Encuadre." con texto verbatim del reglamento (ponderaciones, evaluacion continua, redondeo, faltas).
  - Area de firma del docente y tabla de firmas digitales en pagina 2.
- **REQ-003:** El sistema debe enviar notificaciones por correo institucional con tokens seguros y unicos.
- **REQ-004:** El backend debe estampar la firma digital (Fecha, IP, Hash) en el PDF sin corromperlo.
- **REQ-005:** La regla de asistencia debe detectar >= 4 inasistencias y penalizar/restringir derechos.
- **REQ-006:** El calculo de calificaciones debe aplicar los pesos configurados y el redondeo institucional (< 6.0 floor; >= 6.0 half-up).
- **REQ-007:** El servicio PDF debe ser completamente parametrizable:
  - `institucionNombre` (default: "Centro Universitario Hidalguense")
  - `institucionLema` (default: "La sabiduria es nuestra fuerza")
  - `logoPngBuffer` (PNG o JPEG opcional; si no se provee, solo se muestra el texto)
  - Todos los campos de la tabla de asignatura (clave, asignatura, horas, creditos, eje, objetivo)
  - Todas las ponderaciones de evaluacion (configurables por periodo)

## Criterios de Aceptación
- **AC-001 (REQ-002):** El PDF generado contiene la tabla "Formato de Asignatura" con todos los metadatos de la asignatura.
- **AC-002 (REQ-004):** Estampar una firma actualiza el PDF con "FIRMADO" + metadatos sin corromperse.
- **AC-003 (REQ-005):** Con >= 4 faltas se restringen calificaciones/derechos del alumno.
- **AC-004 (REQ-006):** Redondeo exacto: `6.5->7`, `6.4->6`, `5.9->5`, `5.4->5`.
- **AC-005 (REQ-007):** El PDF generado refleja el `institucionNombre`, `institucionLema` y logo provistos en los params; si no se proveen, usa los defaults de CUH.

## Matriz de Trazabilidad

| ID Requisito | Descripcion | Archivo de Test | Estado |
| --- | --- | --- | --- |
| REQ-001 | Persistencia de EncuadreAcademico y FirmaEncuadre | `apps/backend/tests/servicioEncuadrePdf.test.ts` | Completado |
| REQ-002 | Generar PDF con Formato de Asignatura (replica DOCX) | `apps/backend/tests/servicioEncuadrePdf.test.ts` | Completado |
| REQ-003 | Envio de tokens por correo a firmantes | `apps/backend/tests/servicioEncuadrePdf.test.ts` | Completado |
| REQ-004 | Estampar firma digital con pdf-lib en fila del firmante | `apps/backend/tests/servicioEncuadrePdf.test.ts` | Completado |
| REQ-005 | Validacion de limite de inasistencias (>= 4 faltas) | `apps/backend/tests/evaluaciones.politicaLisc.test.ts` | Completado |
| REQ-006 | Redondeo institucional (< 6.0 floor, >= 6.0 half-up) | `apps/backend/tests/evaluaciones.politicaLisc.test.ts` | Completado |
| REQ-007 | Datos institucionales parametrizables (nombre, lema, logo) | `apps/backend/tests/servicioEncuadrePdf.test.ts` | Completado |
