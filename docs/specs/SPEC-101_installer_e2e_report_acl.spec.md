---
id: SPEC-101
titulo: Aislamiento ACL de reportes E2E Installer Hub
version: 1.1.1
fecha: 2026-10-14
autor: Codex
modulo: installer_hub_ci
estado: approved
---

## Contexto

La E2E de upgrade de Installer Hub falló antes de instalar el baseline porque el directorio de handoff heredó permisos de escritura para `BUILTIN\Users`. El validador de seguridad rechazó correctamente ese ACL. Los reportes contienen solicitudes y respuestas operativas del instalador; deben generarse en un directorio aislado con permisos explícitos y conservarse como artefactos de CI.

Al repetir el E2E se detectó que el runner intentaba importar el módulo con `Import-Module -LiteralPath`, parámetro que no existe en Windows PowerShell 5.1. La importación debe usar `-Name` con la ruta como valor; el contrato debe probar tanto la invocación del runner como el binding real del módulo en Windows.

## Requisitos Funcionales

- **REQ-001:** El runner E2E creará el directorio de reporte como hijo directo de un padre existente cuyo ACL no permita escritura a grupos amplios; la carpeta nueva no heredará ACL y concederá acceso completo solo a la identidad actual y `SYSTEM`.
- **REQ-002:** El runner rechazará padres reparse point, ACL inseguros y rutas de reporte preexistentes sin modificarlas; fallará cerrado si no puede establecer o verificar el ACL y conservará sin cambios el guard de `Test-InstallerHubPrivateAcl`.
- **REQ-003:** Los flujos E2E de CI (workflow dispatch, release draft y release público) ubicarán sus reportes como hijos únicos del perfil del runner, fuera del checkout y de `RUNNER_TEMP`; calcularán la ruta una vez y la reutilizarán para el runner y la carga del artefacto tras fallos. Si el preflight falla antes de preparar la ruta, omitirán la carga del artefacto en vez de expandir una ruta vacía a la raíz del volumen.
- **REQ-004:** Pruebas de contrato impedirán regresar a rutas de reporte heredables y comprobarán en Windows que el inicializador produce ACL privado.
- **REQ-005:** El runner importará el módulo ACL mediante un parámetro admitido por Windows PowerShell 5.1; el contrato comprobará la línea del runner y ejecutará una prueba de importación del módulo en Windows.
- **REQ-006:** La ruta privada incluirá `run_id` y `run_attempt` para que los reintentos nunca reutilicen ni modifiquen evidencia de otra ejecución.

## Criterios de Aceptación

- Un directorio nuevo pasa el guard de ACL; los ACE heredados quedan deshabilitados y los reportes siguen accesibles para el runner y el proceso de carga de artefactos.
- Un ACL amplio preexistente no se sanea silenciosamente: la inicialización lo rechaza para evitar modificar datos ajenos.
- Los tres flujos CI usan una ruta privada bajo el perfil del runner; el upload de artefactos apunta al mismo output de ruta que recibe el runner E2E.
- Si la etapa que prepara la ruta no produjo un output, el uploader queda omitido y no intenta recorrer una raíz o ruta ajena.
- La carpeta es única por `run_id` y `run_attempt`, de modo que un reintento no colisiona con un reporte preexistente.
- Las pruebas focalizadas cubren contrato CI y ACL real en Windows. El E2E de upgrade v1.2.3 → v1.2.8 debe terminar antes de considerar exitoso el cambio; no se crea tag ni release como parte de esta spec.
- La prueba de importación no depende de PowerShell 7 ni de parámetros inexistentes en Windows PowerShell 5.1.

## Matriz de Trazabilidad

| ID Requisito | Descripción del Caso | Archivo de Test Vinculado | Estado |
| --- | --- | --- | --- |
| REQ-001, REQ-002 | Crea directorio privado y rechaza rutas existentes inseguras | `scripts/tests/installer-hub-contract.test.mjs` | Pendiente |
| REQ-003, REQ-004, REQ-006 | Contrato de rutas privadas, reintentos y artefactos en todos los flujos CI | `scripts/tests/installer-upgrade-e2e-contract.test.mjs` | Pendiente |
| REQ-005 | Invocación compatible del módulo y prueba real de importación en Windows PowerShell | `scripts/tests/installer-upgrade-e2e-contract.test.mjs` | Pendiente |
