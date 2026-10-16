---
id: SPEC-103
titulo: Estabilidad reproducible de cobertura backend bajo instrumentación
version: 1.0.0
fecha: 2026-10-14
autor: Codex
modulo: backend_coverage_ci
estado: approved
---

## Contexto

La validación completa de 1.2.8 en CI Checks #1399, SHA `6097ebf477d5d3e17af37e3d922ad83d4ab3dbdf`, completó lint, tipado, pruebas backend normales, portal, contratos, frontend y seguridad. La ejecución normal aprobó los 11 casos de `tests/integracion/flujoExamen.test.ts` en 89.542 s; entre ellos, los tres que luego agotaron timeout tardaron 16.780 s, 14.379 s y 53.904 s. En cobertura instrumentada, `backend-integracion-n-z-03` agotó sus tres intentos: dos casos excedieron 60 s y uno 240 s. El intento final duró 548.91 s y terminó con 23/26 pruebas aprobadas. El runner organizó 57 lotes con concurrencia 3; `flujoExamen.test.ts` comparte lote con tres archivos, mientras otros lotes corren en paralelo. La diferencia entre la ejecución normal y la instrumentada apunta a una degradación de rendimiento bajo cobertura/concurrencia, pero no demuestra aún cuál de esos factores la causa ni descarta un problema propio de esos recorridos. El worktree actual no contiene Vitest, por lo que hace falta comparar el lote aislado con el plan actual y conservar duración por caso e intento. No se permite ocultar pruebas, bajar umbrales ni tratar un reintento como éxito estable.

La corrida completa #38672717462, SHA `4641e17e92afe103d55c5643219f367ea39359c8`, identificó otro lote crítico: `backend-root-31` agrupó `tests/pdf.layout.visual.guard.test.ts` con dos suites PDF mientras corría con concurrencia global 3. El caso de capacidad/QR agotó 60 s en dos intentos; el mismo lote también tuvo un timeout de 900 s en un caso de layout y pasó en el tercer intento. El artefacto `backend-coverage-diagnostics` atribuye el rechazo a recuperación inestable, no a umbrales de cobertura. El siguiente candidato ejecutará la suite visual PDF como lote exclusivo, después de drenar los workers ordinarios y con un worker Vitest, conservando la suite completa y sus límites actuales.

## Requisitos Funcionales

- **REQ-001:** La cobertura completa conservará todas las suites incluidas y todos los umbrales configurados; no añadirá exclusiones ni reemplazará ejecución completa por cobertura diferencial.
- **REQ-002:** El plan y scheduler podrán ejecutar un lote de integración intensivo de forma aislada y exclusiva cuando la evidencia comparativa muestre contención; ningún otro proceso de cobertura correrá simultáneamente durante esa etapa exclusiva.
- **REQ-003:** El runner registrará para cada lote/intent el nombre, inicio, duración, código de salida, tests fallidos y motivo (fallo de aserción, timeout o error de infraestructura), y distinguirá un intento recuperado de una ejecución estable.
- **REQ-004:** Los timeouts serán explícitos para los casos realmente lentos y estarán respaldados por la medición aislada. No se aumentarán límites globales ni se harán reintentos silenciosos para encubrir lentitud o falla determinista.
- **REQ-005:** Las pruebas del scheduler verificarán que el lote exclusivo no se solape con otros workers, que los lotes ordinarios conserven su concurrencia configurada y que cualquier fallo final mantenga código de salida no cero y diagnóstico utilizable.
- **REQ-006:** La conclusión estable requiere que el gate completo de cobertura backend termine sin fallos ni timeouts en ejecuciones consecutivas del mismo SHA, con el merge global de reportes y umbrales intactos.

## Criterios de Aceptación

- Una comparación del lote problemático bajo concurrencia existente y ejecución aislada documenta tiempos por caso y demuestra la causa raíz; si el aislamiento no resuelve los timeouts, se corrige el trabajo de prueba/producción en el alcance de una spec aprobada adicional.
- La suite `tests/integracion/flujoExamen.test.ts` termina con todos sus casos aprobados y sin exceder los límites calibrados para la ejecución aislada.
- El contrato del runner comprueba exclusividad real del scheduler y preserva la selección completa, las tres oportunidades de recuperación existentes y el reporte final de fallos.
- La cobertura backend completa pasa dos veces consecutivas en CI, sin suites omitidas, umbrales reducidos, lotes fallidos recuperados ni timeouts.
- La conclusión del run de cobertura, los tiempos por lote y el artefacto de diagnóstico pertenecen al SHA exacto candidato; pruebas normales aprobadas no sustituyen a la cobertura.

## Matriz de Trazabilidad

| ID Requisito | Descripción del Caso | Archivo de Test Vinculado | Estado |
| --- | --- | --- | --- |
| REQ-001, REQ-002, REQ-005 | Plan, concurrencia, barrera exclusiva y preservación de todas las suites intensivas PDF e integración | `scripts/tests/backend-coverage-batches.test.mjs` | En implementación |
| REQ-003, REQ-004 | Resumen por lote/intento, timeout y salida diagnóstica | `scripts/tests/backend-coverage-batches.test.mjs` | En implementación |
| REQ-006 | Flujo de generación de examen con instrumentación | `apps/backend/tests/integracion/flujoExamen.test.ts`; `scripts/tests/backend-coverage-batches.test.mjs` | En implementación |

