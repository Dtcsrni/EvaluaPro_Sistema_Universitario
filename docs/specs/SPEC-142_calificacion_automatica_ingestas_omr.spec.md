---
id: SPEC-142
titulo: Calificación automática al completar una ingesta OMR
version: 1.0.0
fecha: 2026-11-08
autor: Codex
modulo: modulo_escaneo_omr
estado: implemented
---

## Contexto

La ingesta PDF valida el QR, separa páginas por examen y ejecuta el motor OMR,
pero se detiene antes del caso de uso canónico que calcula y guarda la nota. La
calificación automática debe ocurrir dentro de EvaluaPro al concluir una ingesta,
con los mismos controles, clave, variante, persistencia y auditoría de la ruta
docente de calificación.

## Requisitos Funcionales

- **REQ-001:** Una ingesta solo calificará automáticamente cuando cada página
  evaluable del examen aparezca exactamente una vez, el QR firmado coincida con
  el examen/página y referencia local, el alumno esté asociado, el mapa OMR y la
  variante tengan un conjunto completo y único de reactivos, y cada página pase
  la política automática vigente.
- **REQ-002:** La nota se calculará y persistirá con el caso de uso canónico de
  EvaluaPro, incluyendo la validación de clave, variante, reglas, auditoría y
  persistencia de respuestas. La operación de carga requiere los permisos
  `omr:analizar` y `calificaciones:calificar`.
- **REQ-003:** Omisiones, marcas ambiguas, múltiples o tachadas se representan
  con `opcion: null` y cuentan como incorrectas si se aprueban los controles
  globales. Respuestas ambiguas con opción, respuestas sin estado verificable,
  identidad conflictiva, baja calidad/confianza, cobertura incompleta, QR
  ilegible tras rescates, duplicados o páginas faltantes bloquean la
  escritura y quedan visibles para revisión.
- **REQ-004:** Un examen que ya tenga calificación no se sobrescribe. Las
  escrituras automáticas usan una clave UUID estable por examen, con hash del
  payload, para recuperar resultados tras reintento y rechazar payloads distintos.
- **REQ-005:** El estado de calificación automática (guardada, ya existente,
  revisión requerida o error) y su resultado/resumen quedan en el job y se
  muestran en la GUI junto al progreso de la ingesta.
- **REQ-006:** Las capturas enviadas por `/omr/jobs` y los PDF de `/omr/ingestas`
  usan el mismo caso de uso canónico de autocalificación. Una rotación o rescate
  geométrico se acepta si el motor normaliza la página y verifica el QR exacto,
  el conjunto completo de reactivos y los umbrales OMR; el rescate por sí solo
  no obliga a revisión ni rebaja los controles de identidad/calidad.

## Criterios de Aceptación

- **AC-001:** Un lote sintético completo, con QR válido y páginas OMR dentro de
  los umbrales, produce una sola fila canónica de `Calificacion`, calculada con
  la clave oficial, y la GUI/API reporta el ID y el resultado guardado.
- **AC-002:** Repetir la misma ingesta o recuperar una escritura incierta devuelve
  la misma calificación; una clave reutilizada con respuestas distintas produce
  conflicto y no crea otra nota.
- **AC-003:** Un lote incompleto, duplicado, con QR no exacto, sin alumno, fuera
  de umbrales, con respuesta ambigua que conserva una opción o con estado/opción
  inconsistente no escribe calificación y reporta el motivo. Los estados nulos
  reconocidos de AC-004 sí son respuestas clasificables como incorrectas.
- **AC-004:** Las respuestas `sin_marca`, `ambigua`, `doble_marca` y `tachada`
  con opción nula cuentan cero cuando las verificaciones globales sí pasan.
- **AC-005:** La autorización de ruta exige ambos permisos; los contratos API,
  pruebas y GUI describen la persistencia automática y los casos pendientes.

## Matriz de Trazabilidad

| Requisito | Prueba | Estado |
| --- | --- | --- |
| REQ-001, REQ-003 | `omrJobsWorkflow.test.ts`: página incompleta no crea calificación; QR fuera de lote permanece revisión | Aprobado en integración sintética focalizada |
| REQ-002, AC-001 | `omrJobsWorkflow.test.ts`: `calificarGrupoIngestaOmr` llama al calificador canónico, persiste una nota y devuelve el ID | Aprobado; 1/1 |
| REQ-004, AC-002 | La integración repite el paquete y comprueba `already_recorded`, mismo ID y una sola fila; el contrato existente de `/calificaciones/calificar` cubre conflicto de clave/payload | Aprobado en integración |
| REQ-003, AC-003, AC-004 | `omr.politicaAutoCalificacion.test.ts`: cuatro estados sin opción cuentan cero; estados con opción o señal débil son hard-stop | Aprobado; 10/10 |
| REQ-005, AC-005 | OpenAPI declara ambos permisos y campos automáticos; `plantillasOmrWorkflow.test.tsx` muestra guardado/revisión | Aprobado; contrato API y 24/24 GUI |
