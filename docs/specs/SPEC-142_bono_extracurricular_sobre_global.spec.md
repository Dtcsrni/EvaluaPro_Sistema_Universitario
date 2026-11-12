---
id: SPEC-142
titulo: Bono extracurricular sobre el global del tercer parcial
version: 1.1.0
fecha: 2026-11-10
autor: Codex / EvaluaPro Team
modulo: modulo_analiticas
estado: implemented
---

## Contexto

El docente necesita registrar el bono extracurricular por alumno y comprobar su
impacto antes de actualizar la lista académica. La nota base y sus componentes
deben conservarse; el bono solo puede afectar el global del tercer parcial.

## Requisitos Funcionales

- **REQ-001:** El docente confirma el bono por alumno; la solicitud solo admite `0` para retirarlo o `0.5` puntos.
- **REQ-002:** El bono afecta únicamente la calificación global del tercer parcial; conserva P1, P2 y los componentes base.
- **REQ-003:** Solo se aplica cuando existe global base aprobatorio (`>= 6`) y el resultado se limita a 10; si el global es reprobatorio, ya es 10 o no existe, no se agrega.
- **REQ-004:** La vista previa explica base, bono solicitado/aplicado, tope y nota final antes de guardar.
- **REQ-005:** La exportación XLSX muestra el bono como valor en BB y el global resultante en AV; no lo vuelve a sumar en fórmulas de P1/P2/P3.
- **REQ-006:** La persistencia usa el recurso académico y la auditoría existentes, con identidad idempotente y control de concurrencia; no escribe secretos ni altera Classroom.

## Criterios de Aceptación

1. Las solicitudes distintas de `0` y `0.5` se rechazan.
2. Un global base de 9.75 con bono 0.5 termina en 10 y reporta 0.25 aplicado.
3. Global menor que 6, igual a 10 o ausente conserva su valor y reporta bono aplicado 0.
4. P1, P2 y los datos base no cambian al aplicar o retirar el bono.
5. La GUI y la lectura API muestran la misma vista previa y resultado persistido.
6. El XLSX muestra BB y AV según la regla, sin sumar dos veces el bono.

## Trazabilidad

## Matriz de Trazabilidad

| ID Requisito | Descripción del Caso | Archivo de Test Vinculado | Estado |
| --- | --- | --- | --- |
| REQ-001/006 | Validación, persistencia idempotente y auditoría | `apps/backend/tests/integracion/listaAcademicaContratos.test.ts` | Completado |
| REQ-002/003 | Elegibilidad, aplicación global-only y tope 10 | `apps/backend/tests/bonoExtracurricular.test.ts` | Completado |
| REQ-004 | Preview y confirmación de docente | `apps/frontend/tests/seccionCalificaciones.resumen.test.tsx` | Completado |
| REQ-005 | Exportación del bono y global calculado | `apps/backend/tests/analiticas.xlsx.sv.contract.test.ts` | Completado |
