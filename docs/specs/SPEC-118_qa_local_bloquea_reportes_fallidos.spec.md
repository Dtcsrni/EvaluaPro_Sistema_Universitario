---
id: SPEC-118
titulo: QA local falla ante reportes de calidad fallidos
version: 1.0.0
fecha: 2026-10-18
autor: Codex
modulo: qa_release
estado: approved
---

## Contexto

> Integrada como componente de release en [SPEC-122](SPEC-122_estabilizacion_release_1_2_8.spec.md); esta ficha conserva la aprobación y el origen del requisito.

La ejecución local de `npm run qa:full` puede devolver código 0 aunque un reporte QA registre `ok: false`. La evidencia actual confirma deriva en el historial de API pública de `modulo_generacion_pdf`; el reporte más reciente no confirma deriva de composición en `modulo_integraciones_classroom`. El chequeo actual usa modo no estricto, mientras `validate-stable-promotion.mjs` rechaza los reportes fallidos. Esto permite que el preflight local parezca exitoso y pospone el fallo hasta la promoción o CI.

## Requisitos Funcionales

- **REQ-001:** El comando integral `qa:full` debe terminar con código distinto de cero si cualquier gate requerido produce un reporte con `ok: false` o un reporte ausente/inválido.
- **REQ-002:** El proceso debe conservar y publicar los reportes diagnósticos aun cuando una etapa falle, y señalar qué gate y ruta de reporte fallaron.
- **REQ-003:** El estado que acepta QA local debe coincidir con la condición que exige `validate-stable-promotion.mjs` para los reportes incluidos en el manifiesto.
- **REQ-004:** Las pruebas deben demostrar un caso verde y un caso fallido donde un reporte requerido `ok: false` impida que `qa:full` termine exitosamente.
- **REQ-005:** Corregir la inferencia de retorno de `recuperarJobsImportacionClassroom` para conservar `Promise<number>`, evitando exponer `Promise<any>`.
- **REQ-006:** Registrar el cambio de firma de `esquemaBodyVacioOpcional` que introdujo Zod 4 en el contrato público PDF con un incremento SemVer compatible con el carácter incompatible de la firma, preservando snapshots anteriores y actualizando los rangos declarados por sus consumidores.

## Criterios de Aceptación

- Una corrida íntegra con todos los reportes requeridos en `ok: true` devuelve código 0.
- Una corrida donde cualquier gate requerido produce `ok: false` devuelve código distinto de cero y conserva su reporte.
- La composición Classroom conserva el retorno público `Promise<number>` y coincide con su historial.
- El contrato PDF registra la firma actual de Zod 4 bajo SemVer mayor por el cambio incompatible de firma; los rangos de dependencias de los consumidores satisfacen el contrato nuevo.
- El manifiesto no puede presentar una QA aprobada si hay artefactos requeridos en fallo.
- La validación local reproduce el rechazo de promoción antes de enviar el candidato a CI/CD.

## Matriz de Trazabilidad

| ID Requisito | Descripción del Caso | Archivo de Test Vinculado | Estado |
| --- | --- | --- | --- |
| REQ-001, REQ-002, REQ-004 | Propagación del fallo QA con conservación del reporte | `scripts/tests/qa-full-runner.test.mjs`; `scripts/tests/ci-workflow-contract.test.mjs` | Implementado; 5/5 y 49/49 pruebas locales aprobadas |
| REQ-003 | Alineación del preflight local con la validación de promoción | `scripts/tests/qa-full-runner.test.mjs`; `scripts/tests/release-stable-promotion.test.mjs` | Implementado; `qa:full` pasó 2 corridas y promoción 59/59 |
| REQ-005, REQ-006 | Versionado de cambios en contratos públicos y firmas | `scripts/tests/module-contract-check.test.mjs` | Implementado; 27/27 pruebas y clean architecture estricta aprobadas |
