---
id: SPEC-113
titulo: Aislamiento de temporales en prueba de importacion de instantanea
version: 1.0.0
fecha: 2026-10-17
autor: Codex
modulo: modulo_sincronizacion_nube_tests
estado: approved
---

## Contexto

La primera corrida completa manual de CI sobre `main` SHA `64b5ce8f17585287f919c63d65f83632f41fefcb` (#1469) falló en `apps/backend/tests/sincronizacion.snapshot.test.ts`, caso `no reemplaza la SQLite si el lease se pierde antes del intercambio`. Las aserciones funcionales de que los datos existentes se preservan pasaron; falló la comprobación final que enumera todo `os.tmpdir()` y exige que no exista ningún directorio con el prefijo compartido `evaluapro-local-snapshot-`. El runner encontró un directorio de ese prefijo (`evaluapro-local-snapshot-SKVS7B`).

La comprobación actual observa temporales ajenos a la invocación y no demuestra qué operación creó el directorio encontrado. La corrección debe permitir verificar la limpieza de la carpeta exacta creada por la importación fallida, sin modificar el comportamiento de rutas de API ni eliminar temporales pertenecientes a operaciones concurrentes.

## Requisitos Funcionales

- **REQ-001:** La prueba de lease perdido comprobará la limpieza del directorio temporal creado por esa invocación, sin enumerar ni exigir vacío el directorio temporal global del sistema.
- **REQ-002:** La prueba podrá dirigir la preparación a un directorio temporal aislado mediante una dependencia interna de prueba o mecanismo equivalente. La ruta temporal no se aceptará desde DTOs, query strings, cabeceras ni entrada de usuario; producción conservará el directorio temporal predeterminado del sistema.
- **REQ-003:** Si el lease se pierde antes del intercambio, la importación seguirá rechazando la operación, conservará los datos de SQLite anteriores y eliminará únicamente sus propios archivos temporales.
- **REQ-004:** Una regresión concurrente mantendrá viva una segunda carpeta temporal de snapshot mientras falla la primera importación; la primera deberá limpiar su propia carpeta y dejar intacta la carpeta de la segunda operación.
- **REQ-005:** Las pruebas no usarán reintentos, esperas arbitrarias, limpieza global ni aserciones dependientes del orden de otros archivos de test.
- **REQ-006:** La validación final conservará todos los tests y límites CI; una corrida fallida no se convertirá en éxito por una corrida posterior. La estabilidad se acreditará con dos corridas completas consecutivas de `force_full_ci=true` en el mismo SHA después de integrar el arreglo.

## Criterios de Aceptación

- La prueba de lease perdido pasa aislada y bajo ejecución paralela con la regresión concurrente.
- El caso verifica la ausencia de su propio directorio temporal, preserva la base de datos previa y demuestra que no elimina la carpeta temporal de la operación concurrente.
- La superficie API no permite que una petición externa seleccione una ruta local temporal.
- Las suites backend, cobertura, CI completo, E2E funcional y validación UX/UI aplicables pasan sin retries y sin tests omitidos que el plan haya marcado como requeridos.
- Se completan dos corridas completas consecutivas en verde sobre el mismo SHA antes de promover la versión estable.

## Matriz de Trazabilidad

| ID Requisito | Descripción del Caso | Archivo de Test Vinculado | Estado |
| --- | --- | --- | --- |
| REQ-001, REQ-002 | Enrutamiento de temporales a un root interno de prueba y limpieza de la ruta propia | `apps/backend/tests/sincronizacion.snapshot.test.ts` | Validado localmente (8/8 con hook diagnóstico de 30 s) |
| REQ-003, REQ-004 | Lease perdido preserva SQLite y no elimina el temporal de otra importación activa | `apps/backend/tests/sincronizacion.snapshot.test.ts` | Validado localmente (8/8 con hook diagnóstico de 30 s) |
| REQ-005, REQ-006 | Sin retries ni omisiones; corridas completas secuenciales en el SHA candidato | `scripts/tests/ci-workflow-contract.test.mjs` | Pendiente de CI completo |
