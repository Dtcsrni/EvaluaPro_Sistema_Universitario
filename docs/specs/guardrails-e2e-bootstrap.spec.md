---
id: SPEC-GUARDRAILS-BOOTSTRAP
titulo: Guardrails de Bootstrap SQLite, Conectividad API y Servidor Estático
version: 1.0.0
fecha: 2026-08-25
autor: Antigravity
modulo: frontend_backend_bootstrap
estado: implemented
---

## Contexto

Evitar discrepancias entre las pruebas unitarias en memoria (JSDOM/mocks) y la ejecución real en navegadores locales, asegurando:
1. **Auto-inicialización transparente de SQLite:** El backend debe inicializar el esquema relacional automáticamente si la base de datos física está vacía.
2. **Conectividad API Libre de CORS:** El frontend debe utilizar rutas relativas (`/api`) de forma predeterminada para comunicarse a través del proxy del puerto 4173.
3. **Servidor Estático Dinámico:** `serve-docente-static.mjs` debe resolver dinámicamente los archivos del disco para nunca entregar HTML ante peticiones de scripts `.js` con nuevos hashes.

## Requisitos Funcionales

- REQ-001 (Backend Bootstrap): Al invocar `conectarSqlite()`, el backend verificará la existencia de la tabla `docentes`. Si no existe, ejecutará la sincronización del esquema sin intervención manual.
- REQ-002 (Frontend Base API): `clienteApi.ts` tendrá como valor por defecto `/api`, evitando llamadas directas a `http://localhost:4000/api` que causen problemas de resolución IPv6 (`::1`) en Windows.
- REQ-003 (Static Server Live Resolution): `serve-docente-static.mjs` resolverá archivos directamente en disco (`fs.existsSync(absolutePath)`), devolviendo el `Content-Type` correcto para assets recién compilados.
- REQ-004 (Persistencia de Sesión): `SeccionAutenticacion.tsx` dispondrá de la casilla *"Mantener sesión iniciada en este equipo"*, guardando en `localStorage` o `sessionStorage` según la preferencia del usuario.

## Criterios de Aceptación

- El endpoint `/api/salud/` debe responder `200 OK` con `db.estado: 1` (`conectado`).
- La creación de tablas en una base de datos nueva no debe requerir comandos manuales en la terminal.
- 55/55 suites de pruebas unitarias de frontend pasando en verde.
- Scripts JS servidos con cabecera `Content-Type: text/javascript; charset=utf-8` verificado en `npm run test:smoke:live`.

## Matriz de Trazabilidad

| ID Requisito | Descripción del Caso | Archivo de Test Vinculado | Estado |
| --- | --- | --- | --- |
| REQ-001 | Backend bootstrap y salud SQLite | `apps/backend/tests/salud.test.ts` | Implementado |
| REQ-002 | Frontend base API y proxy | `apps/frontend/tests/clienteApi.test.tsx` | Implementado |
| REQ-003 | Servidor estático y resolución en disco | `scripts/testing/smoke-live-docente.mjs` | Implementado |
| REQ-004 | Persistencia de sesión en cliente | `apps/frontend/tests/seccionAutenticacion.test.tsx` | Implementado |
