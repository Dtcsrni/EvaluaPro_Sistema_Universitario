---
id: SPEC-SHORTCUTS-CANONICAL
titulo: Accesos directos canonicos e iconos de alta resolucion
version: 1.1.0
fecha: 2026-11-15
autor: Codex
modulo: installer_hub_docente
estado: approved
---

## Contexto

El instalador WiX registra los accesos del menu Inicio en `Programas\\EvaluaPro`.
El reconciliador del host nativo tambien los creaba en la raiz de `Programas`,
lo que duplicaba entradas. Ademas, los accesos deben usar iconos ICO incluidos
en la instalacion y conservar un cuadro de 256 x 256 pixeles.

## Requisitos Funcionales

- REQ-001: El escritorio y el menu Inicio deben apuntar al ejecutable de la
  instalacion canonica de EvaluaPro.
- REQ-002: Los accesos de Inicio deben quedar bajo `Programas\\EvaluaPro`; no
  se deben crear duplicados en la raiz de `Programas`.
- REQ-003: El reconciliador solo elimina accesos de la raiz que apunten al
  ejecutable canonico; debe conservar accesos ajenos o cuyo destino no pueda
  verificarse.
- REQ-004: Los iconos principales y del Hub deben usar ICO locales con un
  cuadro de 256 x 256; si el ICO no es valido, se usa el icono del ejecutable.
- REQ-005: El informe de reconciliacion debe registrar la ruta de icono que
  realmente se asigno.
- REQ-006: El MSI `docente-local` instala los iconos ICO del escritorio y del
  Hub junto al ejecutable para que la reconciliacion de ubicaciones no creadas
  por WiX, incluido OneDrive, conserve la resolucion alta.

## Criterios de Aceptación

| Requisito | Prueba | Estado |
| --- | --- | --- |
| REQ-001, REQ-002 | Contrato de `ShortcutReconciler` y smoke de MSI | Implementado; validar runtime |
| REQ-003 | Contrato de borrado condicionado al destino canonico | Implementado |
| REQ-004 | Contrato C# y lectura de cabeceras de ambos ICO | Implementado |
| REQ-005 | Contrato de serializacion del icono resuelto | Implementado |
| REQ-006 | Contrato MSI y archivos ICO del paquete instalado | Implementado |

## Matriz de Trazabilidad

| ID | Archivo de prueba |
| --- | --- |
| REQ-001 a REQ-006 | `scripts/tests/installer-hub-contract.test.mjs` |
