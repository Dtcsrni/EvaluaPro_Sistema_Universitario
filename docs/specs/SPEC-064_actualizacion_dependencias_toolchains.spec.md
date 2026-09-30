---
id: SPEC-064
titulo: Actualizacion de dependencias y toolchains estables
version: 1.0.0
fecha: 2026-09-23
autor: Erick Vega / Codex
modulo: devops_dependencias_toolchains
estado: approved
---

## Contexto

Las dependencias JavaScript y los toolchains de compilacion de EvaluaPro deben
mantenerse en versiones estables actuales sin dejar desalineados los locks, CI,
el runtime local, Prisma SQLite ni el instalador Windows. El usuario autorizo la
migracion completa, incluidos cambios mayores y WiX 7 con aceptacion expresa de
su EULA. Se excluyen versiones prerelease y cambios de datos de usuario.

## Requisitos Funcionales

- **REQ-001:** Actualizar dependencias directas y transitivas de los workspaces
  npm a la version estable mas reciente compatible con la migracion aprobada;
  mantener sincronizados los cuatro package-lock existentes y preservar entradas
  ajenas ya declaradas, incluido `lucide-react`.
- **REQ-002:** Migrar Prisma/SQLite, cliente generado, esquema/configuracion e
  imports requeridos por la version estable seleccionada, sin modificar datos ni
  aplicar migraciones destructivas a bases de usuario.
- **REQ-003:** Alinear Node LTS, npm, .NET SDK y WiX en configuracion local/CI;
  WiX debe aceptar `wix7` explicitamente en el comando de build y conservar los
  chequeos de version y empaquetado.
- **REQ-004:** Corregir incompatibilidades de ESLint, TypeScript, React, OCR y
  herramientas de prueba detectadas en lint, typecheck, compilacion y tests.
- **REQ-005:** Mantener evidencia de versiones y pruebas; no declarar la
  actualizacion completa si un gate obligatorio o build del instalador falla.

## Criterios de Aceptación

- `npm ci` reproduce las dependencias desde los locks sin errores.
- Cada workspace genera/valida el cliente Prisma esperado sin alterar bases de
  datos existentes; las pruebas SQLite de backend y portal pasan.
- Los toolchains reportan las versiones estables fijadas; los workflows usan las
  mismas familias de Node/.NET/WiX y aceptacion WiX explicita.
- Pasan lint, typecheck, pruebas frontend/backend/portal y los contratos del
  instalador; se compilan MSI y Bundle en Windows cuando el entorno lo permite.
- La auditoria SDD y los contratos de pipeline pasan sin rebajar umbrales.

## Matriz de Trazabilidad

| ID Requisito | Descripcion del Caso | Archivo de Test Vinculado | Estado |
| --- | --- | --- | --- |
| REQ-001 | Reproducibilidad de dependencias y consistencia de instalación CI | `scripts/tests/ci-workflow-contract.test.mjs` | Pendiente |
| REQ-002 | Contrato de persistencia SQLite/Prisma en backend | `apps/backend/tests/sincronizacion.test.ts` | Pendiente |
| REQ-002 | Integracion SQLite del portal | `apps/portal_alumno_cloud/tests/integracion/portal.test.ts` | Pendiente |
| REQ-003 | Version/politica WiX y EULA del instalador | `scripts/tests/wix-version-policy.test.mjs` | Pendiente |
| REQ-003 | Build MSI/Bundle Windows | `scripts/tests/wix-bundle-build.test.mjs` | Pendiente |
| REQ-004 | Contrato de configuración de jobs CI para validar workspaces | `scripts/tests/ci-workflow-contract.test.mjs` | Pendiente |
| REQ-005 | Contrato de auditoría SDD | `scripts/tests/sdd-audit.test.mjs` | Pendiente |
