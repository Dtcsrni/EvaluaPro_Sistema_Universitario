---
id: SPEC-070
titulo: Politicas docentes de evaluacion por API
version: 1.0.0
fecha: 2026-09-28
autor: Usuario y Codex
modulo: modulo_evaluaciones
estado: approved
---

## Contexto

La API y el SDK anuncian operaciones para administrar politicas de evaluacion, pero el alta devuelve 501 y el router no implementa detalle, versionado ni archivo. El docente debe poder automatizar el mismo ciclo con la persistencia compartida con la GUI. Una politica seleccionada por periodo debe fijar la version exacta usada por sus calculos.

## Requisitos Funcionales

- **REQ-070-POL-01:** Listar politicas predefinidas y propias del docente autenticado; obtener una politica por codigo y version. Aislar las politicas propias por `docenteId`.
- **REQ-070-POL-02:** Crear una politica docente con codigo, familia soportada, parametros tipados y `clientRequestId` UUID. Repetir la misma solicitud devuelve el resultado original; reutilizar la clave con otro payload devuelve conflicto.
- **REQ-070-POL-03:** `PUT` crea una version inmutable siguiente. `DELETE` archiva mediante una nueva version inactiva; ninguna ruta modifica ni elimina versiones anteriores.
- **REQ-070-POL-04:** Registrar cada alta, versionado y archivo en auditoria append-only con actor, codigo, version, clave idempotente, hash y estado anterior/posterior; exponer consulta paginada.
- **REQ-070-POL-05:** Aceptar solo familias `lisc_encuadre` y `sv_excel_contract` con pesos tipados que sumen 1. La configuracion del periodo fija codigo/version; los calculos resuelven esa version y aplican sus parametros. Las formulas no son expresiones ejecutables configurables.
- **REQ-070-POL-06:** Proteger mutaciones con permiso `evaluaciones:gestionar`, validacion estricta y confirmacion/idempotencia en el cliente. Mantener lectura con `evaluaciones:leer`.

## Criterios de Aceptación

- Alta, lectura, versionado, archivo e historial funcionan por API autenticada y respetan el aislamiento docente.
- Reintentos identicos son idempotentes; misma clave con payload diferente responde conflicto.
- Versiones anteriores y auditoria sobreviven al archivo. Un periodo conserva la version exacta que usa para calcular.
- Los pesos configurados cambian los resultados conforme a las formulas soportadas y se conservan en el resumen/auditoria del calculo.
- El contrato OpenAPI, el catálogo CRUD y los wrappers del SDK coinciden con las rutas reales.
- Las pruebas de base, aislamiento, concurrencia, idempotencia, archivo e impacto de cálculo pasan; la migración es aditiva e idempotente.

## Matriz de Trazabilidad

| ID Requisito | Descripción del Caso | Archivo de Test Vinculado | Estado |
| --- | --- | --- | --- |
| REQ-070-POL-01 | Lista, detalle, versionado consultable y aislamiento | `apps/backend/tests/evaluaciones.politicas.api.test.ts` | En progreso |
| REQ-070-POL-02 | Creación, validación, replay idempotente y conflicto | `apps/backend/tests/evaluaciones.politicas.api.test.ts` | En progreso |
| REQ-070-POL-03 | Versión inmutable y archivo lógico | `apps/backend/tests/evaluaciones.politicas.api.test.ts` | En progreso |
| REQ-070-POL-04 | Auditoría append-only y migración | `scripts/tests/migrate-politicas-calificacion-auditoria-sqlite.test.mjs` | En progreso |
| REQ-070-POL-05 | Pesos afectan cálculos; periodo fija código/version | `apps/backend/tests/evaluaciones.politicaLisc.test.ts` | En progreso |
| REQ-070-POL-06 | Cliente exige confirmación y clave estable | `scripts/tests/evaluapro-client.test.mjs` | En progreso |
