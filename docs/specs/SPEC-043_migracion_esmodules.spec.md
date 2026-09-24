---
id: SPEC-043
titulo: Migración de CommonJS a ES modules
version: 1.0.0
fecha: 2026-09-10
autor: EvaluaPro Team
modulo: arquitectura_runtime
estado: implemented
---

# SPEC-043 — Migración de CommonJS a ES modules

- Estado: implementándose
- Fecha: 2026-09-09

## Contexto

El backend y el portal deben ejecutar sus módulos propios con el estándar ESM
de Node.js para mantener imports explícitos, resolución predecible y una única
convención de runtime.

## Objetivo

Modernizar los runtimes TypeScript del backend docente y del portal alumno para
usar ES modules nativos de Node.js, eliminando `module: CommonJS`, `require()`
y `module.exports` en código de aplicación y configuración propia.

## Requisitos Funcionales

- `apps/backend` y `apps/portal_alumno_cloud`: `type: module`, `NodeNext` y
  rutas ESM explícitas.
- Configuración propia de ESLint y Playwright.
- Imports ESM de dependencias que ofrecen condición `import`.

## Alcance

## Fuera de alcance

- Archivos generados por Prisma y código distribuido por dependencias.
- Cambios funcionales de negocio, OMR, PDF o persistencia.

## Criterios de Aceptación

1. TypeScript compila en modo `NodeNext` para backend y portal.
2. Las pruebas unitarias de las superficies modificadas pasan.
3. ESLint carga su configuración ESM sin archivos `.cjs` propios.
4. No quedan usos de `require()` o `module.exports` en las rutas de aplicación
   y configuración migradas.
5. Los scripts de producción conservan sus comandos y contratos observables.

## Matriz de Trazabilidad

| ID Requisito | Descripción del Caso | Archivo de Test Vinculado | Estado |
| --- | --- | --- | --- |
| REQ-001 | Compilación ESM del backend y portal | `apps/backend/tests/configuracion.test.ts` | Completado |
| REQ-002 | Pruebas de las superficies migradas | `apps/backend/tests/pdf.paridad.test.ts` | Completado |
| REQ-003 | Carga de configuración ESLint/Playwright | `apps/backend/tests/infraestructura.test.ts` | Completado |
| REQ-004 | Ausencia de CommonJS en rutas migradas | `apps/backend/tests/configuracion.entorno.test.ts` | Completado |
| REQ-005 | Conservación de contratos de scripts | `apps/backend/tests/omr.contrato.test.ts` | Completado |
