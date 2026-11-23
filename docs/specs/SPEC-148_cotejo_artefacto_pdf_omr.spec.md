---
id: SPEC-148
titulo: Cotejo de artefactos PDF OMR por huella registrada
version: 1.0.0
fecha: 2026-10-23
autor: Codex
modulo: modulo_escaneo_omr
estado: approved
---

## Contexto

La consulta de cotejo puede rechazar el PDF original de un lote aunque sus bytes coincidan con el SHA-256 del artefacto generado y registrado. La ruta actual filtra primero los lotes por validez criptográfica de sus QR con las claves vigentes; una clave rotada puede invalidar QR históricos y bloquear una coincidencia por huella que ya identifica el artefacto exacto.

## Requisitos Funcionales

- **RF-001:** Si la huella SHA-256 del PDF de referencia coincide con el artefacto de un lote del docente y coinciden las páginas registradas, las páginas del PDF y el total de exámenes del lote, localizar ese lote aunque la clave vigente no valide una firma QR histórica.
- **RF-002:** Si la huella exacta no coincide, conservar el cotejo QR firmado existente y exigir coincidencia completa de todas las páginas.
- **RF-003:** El cotejo es de solo lectura; no crea jobs ni modifica calificaciones.

## Criterios de Aceptación

- El PDF exacto registrado coincide aun cuando una firma QR histórica no sea aceptada por la clave vigente.
- Un PDF de otro lote o una referencia parcial sigue sin coincidencia.
- El cotejo no cambia el conteo de jobs ni de calificaciones.

## Matriz de Trazabilidad

| ID Requisito | Descripción del Caso | Archivo de Test Vinculado | Estado |
| --- | --- | --- | --- |
| RF-001 | Coincide por hash exacto con firma QR histórica no validable | `apps/backend/tests/integracion/omrJobsWorkflow.test.ts` | Implementado |
| RF-002 | Rechaza PDF ajeno y referencia parcial | `apps/backend/tests/integracion/omrJobsWorkflow.test.ts` | Implementado |
| RF-003 | No crea jobs ni calificaciones | `apps/backend/tests/integracion/omrJobsWorkflow.test.ts` | Implementado |