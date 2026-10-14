---
id: SPEC-096
titulo: Captura del primer parcial y campos del libro académico
version: 1.0.0
fecha: 2026-10-13
autor: Erick Vega / Codex
modulo: modulo_analiticas
estado: approved
---

## Contexto

La vista de calificaciones de EvaluaPro no permite registrar manualmente el componente "Exámen 1er Parcial", aunque el libro Excel de Legalidad y Marketing lo define como un campo independiente de 0 a 5. La tabla actual expone solo un resumen y omite componentes que sí tienen columnas nombradas en el Excel. Esto impide reconciliar el registro canónico con la lista que se entrega.

El libro de referencia usa las columnas AJ:BB: tareas y ejercicios del primer parcial (60%), práctica del primer parcial (40%), evaluación continua, examen y total del primer parcial; componentes equivalentes del segundo parcial; examen global, evaluación continua/proyecto y tercer parcial; ponderaciones, calificación final, conversión a base 10 y bono extracurricular. Las columnas F:AI son encabezados genéricos "Columna1" a "Columna30", por lo que no se tratarán como campos académicos con significado hasta tener un mapeo explícito.

## Requisitos Funcionales

- REQ-001: La GUI permitirá capturar "Exámen 1er Parcial" por alumno en escala 0–5, incluidos 0, 5 y valores decimales válidos. El valor se persistirá en el registro canónico usando la ruta/API autorizada de calificaciones manuales, con control de permisos, versión optimista, idempotencia y auditoría ya establecidos. No se creará un resultado OMR, folio ni examen sintético.
- REQ-002: La consulta de calificaciones devolverá y mostrará el componente manual del primer parcial, su procedencia y estado, distinguiéndolo del resultado calculado o importado. El examen del primer parcial no modificará por sí mismo la calificación total del parcial.
- REQ-003: La lista detallada de GUI expondrá, con los mismos nombres y orden lógico que el libro, todas las columnas académicas nombradas AJ:BB, con sus valores canónicos o calculados, escala/unidad y procedencia cuando corresponda. Los campos aún sin evidencia se mostrarán como "Sin dato"; no se inferirán calificaciones. Se excluirán Columna1–Columna30 hasta definir su significado y mapeo.
- REQ-004: Los totales y ponderaciones se derivarán de las reglas canónicas documentadas y deberán reconciliar con las fórmulas del libro de referencia. Los campos calculados serán de solo lectura en GUI. Un valor faltante no se convertirá silenciosamente a cero.
- REQ-005: La exportación XLSX conservará encabezados, orden, fórmulas y formato del libro; reflejará en AM el examen del primer parcial registrado en EvaluaPro y reconciliará los valores presentados en la lista GUI. No se sobrescribirán fórmulas con valores, salvo que el contrato existente de exportación así lo requiera y lo documente.
- REQ-006: La captura de examen del primer parcial permitirá dejar en blanco a quien estuvo ausente. En particular, la captura de este lote no asignará calificación al alumno ausente ni aplicará los bonos manuscritos de +0.25 a Evelyn Aguilar o Néstor Becerril: son datos separados y no forman parte de las calificaciones base del examen.
- REQ-007: Los controles serán accesibles por teclado y lector de pantalla, mantendrán etiquetas, errores asociados y foco visible, soportarán tema claro/oscuro y reflow según WCAG_UI_POLICY.md.

## Criterios de Aceptación

- CA-001: Un docente autorizado puede guardar para un alumno una calificación P1 entre 0 y 5; fuera del rango se rechaza con error validado.
- CA-002: Tras guardar y recargar, API y GUI muestran el mismo valor, fuente, estado y versión. Repetir la misma solicitud idempotente no duplica mutaciones; una versión obsoleta se rechaza sin sobrescribir el dato nuevo.
- CA-003: Un usuario sin permiso no puede escribir. La auditoría identifica actor, alumno, curso, componente y cambio sin exponer secretos.
- CA-004: La fila detallada presenta todas las columnas nombradas AJ:BB en el orden del libro; campos sin fuente se distinguen de cero y las columnas genéricas F:AI no aparecen como datos semánticos.
- CA-005: Los componentes derivados y las ponderaciones de la GUI coinciden con las reglas canónicas y las fórmulas del XLSX en casos con datos completos, faltantes, límites y bono; no se cuentan dos veces.
- CA-006: El XLSX conserva fórmulas y formato de plantilla y muestra AM igual al valor canónico capturado para P1; la fila del alumno ausente sigue vacía.
- CA-007: Se revisan GUI en 320/360 px, zoom 200%, tema claro y oscuro, teclado y lector de pantalla; lint, guard WCAG, build, pruebas dirigidas y auditoría SDD pasan.

## Matriz de Trazabilidad

| ID Requisito | Descripción del Caso | Archivo de Test Vinculado | Estado |
| --- | --- | --- | --- |
| REQ-001, REQ-002 | Validar captura manual, persistencia, consulta y control de versión de calificación/lista | apps/backend/tests/integracion/listaAcademicaContratos.test.ts | Pendiente de aprobación y cobertura |
| REQ-001, REQ-002 | Presentar y guardar componentes en el detalle de calificaciones | apps/frontend/tests/seccionCalificaciones.manualSelector.test.tsx | Pendiente de aprobación y cobertura |
| REQ-003, REQ-004 | Contrato y proyección del resumen/lista académica | apps/backend/tests/listaAcademicaResumen.test.ts | Pendiente de aprobación y cobertura |
| REQ-003, REQ-004 | Visibilidad y orden de campos de la lista de calificaciones | apps/frontend/tests/seccionCalificaciones.resumen.test.tsx | Pendiente de aprobación y cobertura |
| REQ-005 | Reconciliar lista académica y exportación del libro Excel | apps/backend/tests/analiticas.xlsx.sv.contract.test.ts | Pendiente de cobertura |
| REQ-006 | Flujo docente con alumno ausente y captura del primer parcial | apps/backend/tests/integracion/flujoDocenteParcialE2E.test.ts | Pendiente de aprobación y cobertura |
| REQ-007 | Contratos de interacción de la pantalla de calificaciones | apps/frontend/tests/seccionCalificaciones.routing.test.tsx | Pendiente de aprobación y cobertura |

