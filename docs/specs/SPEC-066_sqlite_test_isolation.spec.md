---
id: SPEC-066
titulo: Aislamiento seguro de SQLite en pruebas de integración
version: 1.1.0
fecha: 2026-09-24
autor: Codex / Agente IA
modulo: pruebas_backend
estado: approved
---

## Contexto

Las pruebas de integración crean y limpian datos de SQLite. El preparador no debe ejecutar migraciones destructivas sobre una base de datos ajena ni eliminar un directorio configurado externamente.

## Requisitos Funcionales

- REQ-001: Crear un directorio exclusivo de pruebas bajo el temporal del sistema y marcar su propiedad explícitamente.
- REQ-002: Rechazar `db push` y la limpieza si el directorio no fue creado y marcado por el proceso de pruebas.
- REQ-003: Aplicar el esquema sin `--accept-data-loss`; ante una operación con pérdida de datos, la prueba debe fallar.
- REQ-004: El helper SQLite del portal valida propiedad del directorio temporal antes de preparar, limpiar o eliminar la base.

## Criterios de Aceptación

- AC-001: Las pruebas de integración usan una base nueva en un directorio temporal propio.
- AC-002: Una ruta de datos configurada externamente no se modifica ni se elimina.
- AC-003: El preparador no invoca Prisma con autorización de pérdida de datos.

## Matriz de Trazabilidad

| ID Requisito | Descripción del Caso | Archivo de Test Vinculado | Estado |
| --- | --- | --- | --- |
| REQ-001 | Aislamiento de SQLite temporal | `apps/backend/tests/integracion/listasInstitucionales.test.ts` | Pendiente de validación |
| REQ-002 | Rechazo de directorio ajeno | `apps/backend/tests/utils/mongo.ts` | Pendiente de validación |
| REQ-003 | Prisma sin aceptación de pérdida de datos | `apps/backend/tests/utils/mongo.ts` | Pendiente de validación |
| REQ-004 | Aislamiento y protección de base temporal del portal | `apps/portal_alumno_cloud/tests/utils/mongo.ts` | Pendiente de validación |
