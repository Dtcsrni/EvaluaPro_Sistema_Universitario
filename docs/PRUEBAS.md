# Pruebas automatizadas

## Objetivo
Garantizar que las reglas críticas y los flujos base se mantengan estables con
pruebas repetibles y aisladas.

## Alcance actual
- Unitarias:
  - Cálculo exacto de calificaciones y topes.
  - Exportación CSV (escape de comas y comillas).
  - Variantes y órdenes de preguntas/opciones.
- Contrato y validaciones:
  - Payloads inválidos retornan error 400 con código `VALIDACION`.
- Integración backend:
  - Flujo completo de examen con base de datos en memoria.
  - Aislamiento por docente y autorización por token.
- Integración portal alumno:
  - Sincronización, ingreso, consulta de resultados y PDF.
- Frontend:
  - Render básico de app docente y alumno.
- Smoke:
  - Endpoint `GET /api/salud` del backend.

## Criterio de versión estable
Para considerar una **versión estable más reciente** del proyecto completo, deben pasar todas las suites:

- `npm run test:ci`
- `npm run test:portal`
- `npm run test:frontend`
- `npm run routes:check`
- `npm run docs:check`
- `npm run diagramas:check`

## Confiabilidad y alcance
- Las suites corren sobre MongoDB en memoria y evitan dependencias externas.
- `test:ci` incluye reintentos y un harness estricto para detectar warnings/errores.
- Si se agregan rutas o flujos críticos, se debe acompañar con pruebas de contrato e integración.

## Cómo ejecutar
- Desde la raíz:
  ```bash
  npm run test
  ```
- Portal alumno:
  ```bash
  npm run test:portal
  ```
- Frontend:
  ```bash
  npm run test:frontend
  ```
- Directo en backend:
  ```bash
  npm --prefix apps/backend run test
  ```
- Directo en portal:
  ```bash
  npm --prefix apps/portal_alumno_cloud run test
  ```
- Directo en frontend:
  ```bash
  npm --prefix apps/frontend run test
  ```

## Estructura
- `apps/backend/tests/`: pruebas unitarias y smoke del backend.
- `apps/backend/tests/integracion/`: pruebas de integración y flujo.
- `apps/backend/tests/contrato/`: pruebas de validación de payload.
- `apps/backend/tests/utils/`: helpers para Mongo y tokens.
- `apps/backend/vitest.config.ts`: configuración de pruebas backend.
- `apps/portal_alumno_cloud/tests/`: pruebas del portal alumno.
- `apps/portal_alumno_cloud/vitest.config.ts`: configuración de pruebas portal.
- `apps/frontend/tests/`: pruebas de componentes React.
- `apps/frontend/vitest.config.ts`: configuración de pruebas frontend.

## Notas
- Las pruebas de integración usan MongoDB en memoria.
- El flujo de examen genera PDF local en `data/examenes` durante la prueba.
- El smoke test de salud valida el formato base de respuesta.
