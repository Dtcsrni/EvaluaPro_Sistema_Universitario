---
id: SPEC-111
titulo: Lectura de manifiestos Windows compatible con BOM en el gate estable
version: 0.1.0
fecha: 2026-10-16
autor: Codex
modulo: devops
estado: approved
---

## Contexto

El primer Release Stable Gate para 1.2.8 falló antes de QA al parsear
`dist/installer/EvaluaPro-release-manifest.json`. El artefacto Windows comienza con
BOM UTF-8 (U+FEFF); el `JSON.parse(fs.readFileSync(..., "utf8"))` inline del workflow
lo rechaza con `Unexpected token '﻿'`. El mismo artefacto pasó las validaciones dentro
del CI Installer Windows; el fallo está en la lectura del gate estable.

La arquitectura local docente vigente usa Express/TypeScript, Prisma y SQLite. Esta
corrección solo aborda lectura del manifiesto en automatización y no altera el producto,
la base, el contenido del artefacto o los criterios de publicación.

## Requisitos Funcionales

- **REQ-001 — Normalizar BOM de forma acotada:** La lectura JSON del manifiesto de
  instalación debe aceptar UTF-8 con o sin BOM y conservar intactos los bytes/valores
  restantes.
- **REQ-002 — Diagnóstico legible:** JSON inválido después de retirar un BOM inicial debe
  seguir fallando con un mensaje que identifique el manifiesto inválido.
- **REQ-003 — Integración del gate:** La misma lectura compatible debe alimentar la
  comprobación de versión, SHA de build y flavor docente-local antes de QA.
- **REQ-004 — No debilitar gates:** Mantener validación de versión, SHA, flavor, hash,
  firma, artefactos, cobertura QA, E2E y restricciones de publicación sin retries que
  oculten fallos.

## Criterios de Aceptación

- **AC-001:** Una regresión automatizada prueba el mismo manifiesto JSON en dos casos:
  UTF-8 sin BOM y UTF-8 con BOM inicial; ambos producen los mismos valores y validan.
- **AC-002:** Un manifiesto malformado sin BOM o con BOM falla explícitamente.
- **AC-003:** Una prueba de contrato confirma que el paso del workflow de Release Stable
  Gate usa la lectura normalizada antes de comparar versión/SHA/flavor.
- **AC-004:** Los contratos de release afectados pasan y el gate estable vuelve a correr
  con el mismo candidato 1.2.8 y el mismo CI Installer Windows #686. No se crea ni publica
  release hasta que el gate completo concluya correctamente.

## Matriz de Trazabilidad

| ID Requisito | Descripción del Caso | Archivo de Test Vinculado | Estado |
|---|---|---|---|
| REQ-001 | Parser acepta el mismo JSON con y sin BOM inicial | `scripts/tests/installer-release-manifest.test.mjs` | En implementación |
| REQ-002 | JSON malformado con o sin BOM falla con diagnóstico legible | `scripts/tests/installer-release-manifest.test.mjs` | En implementación |
| REQ-003 | El workflow usa el validador normalizado antes de comparar versión/SHA/flavor | `scripts/tests/ci-workflow-contract.test.mjs` | En implementación |
| REQ-004 | El validador mantiene los campos y gates de publicación existentes | `scripts/tests/installer-release-manifest.test.mjs`; `scripts/tests/ci-workflow-contract.test.mjs` | En implementación |

## Alcance y riesgos

- Alcance: parser de manifiesto en el gate estable y pruebas de regresión/contrato.
- Fuera de alcance: cambiar el candidato, actualizar versión, reconstruir el MSI, cambiar
  requisitos del gate, generar una release o instalar software localmente.
- Riesgo: retirar BOM en cualquier posición podría enmascarar datos malformados; por ello
  solo se acepta U+FEFF al inicio del texto.
