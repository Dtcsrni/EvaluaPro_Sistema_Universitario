---
id: SPEC-120
titulo: Aislar la validación de instalación MSI del equipo local
version: 1.0.0
fecha: 2026-10-18
autor: Codex
modulo: installer_build
estado: approved
---

## Contexto

> Integrada como componente de release en [SPEC-122](SPEC-122_estabilizacion_release_1_2_8.spec.md); esta ficha conserva la aprobación y el origen del requisito.

`npm run installer:hub:build` ejecuta `msiexec /i` para validar el MSI `docente-local` con un `INSTALLFOLDER` bajo `%TEMP%` y después ejecuta `msiexec /x`. La ruta temporal limita los archivos, pero no aísla el registro de producto de Windows Installer. En la corrida local de 1.2.8, el registro MsiInstaller mostró instalación y retirada del producto; después, la consulta de solo lectura devolvió `ProductState=5` y versión `1.2.8.0`. No hay una lectura previa que permita atribuir el estado actual únicamente a esta corrida. El usuario necesita que las pruebas locales no alteren ni desinstalen una instalación que ya exista.

## Requisitos Funcionales

- **REQ-001:** El build local ordinario no debe ejecutar `msiexec /i` ni `/x` contra el host; debe extraer administrativamente el MSI a una carpeta temporal y validar su contenido sin registrar el producto.
- **REQ-002:** Las pruebas reales de instalación, reparación, actualización y retirada del MSI se ejecutan solo en un runner Windows desechable de CI; deben conservar evidencia del estado y la limpieza del runner al terminar.
- **REQ-003:** Los reportes deben distinguir explícitamente extracción/validación de payload de una transacción real de Windows Installer; no pueden denominar «aislada» a una instalación que modifica el host.
- **REQ-004:** Las regresiones deben demostrar que un build local preserva el estado MSI inicial del host y que el E2E desechable limpia únicamente su propio estado.

## Criterios de Aceptación

- El build ordinario 1.2.8 valida schema, archivos, hashes, contenido y launchers con extracción administrativa, sin registrar el MSI en el host.
- El E2E con transacciones MSI corre en un runner Windows desechable, conserva registro del estado y no deja producto, servicio, tarea ni proceso residual en ese runner.
- Un fallo intermedio conserva logs y evidencia, y no intenta retirar ni reparar un producto ajeno del host.
- Las pruebas locales relacionadas con el build pasan antes de pedir CI/CD.

## Matriz de Trazabilidad

| ID Requisito | Descripción del Caso | Archivo de Test Vinculado | Estado |
| --- | --- | --- | --- |
| REQ-001, REQ-003, REQ-004 | El build local extrae y valida el payload sin `/i` ni `/x`; la regresión comprueba el alcance y conserva logs si falla | `scripts/tests/installer-hub-contract.test.mjs` | Implementado localmente; pendiente CI para estado final |
| REQ-002, REQ-004 | El lifecycle real comprueba instalación/upgrade/reparación/desinstalación y limpieza en el runner Windows efímero | `scripts/tests/installer-hub-e2e-docente.ps1`; `.github/workflows/ci-installer-windows.yml` | E2E visual local pasó; transacciones reales pendientes de CI aislado |
