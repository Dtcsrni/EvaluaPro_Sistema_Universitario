# Sesion de correccion de accesos directos

- objetivo: unificar accesos del escritorio y menu Inicio, retirar duplicados canonicos y asignar ICO locales de alta resolucion.
- sessionId: `02b11db3-4216-471c-9cb9-3108456316d8`
- estado: `draft`
- archivos: `packaging/app-host/ShortcutReconciler.cs`, `scripts/tests/installer-hub-contract.test.mjs`, `docs/specs/accesos_directos_canonicos.spec.md`, `CHANGELOG.md`, versiones y huella OMR de 1.2.22.
- decisiones: el MSI y el host convergen en `Programas/EvaluaPro`; los duplicados de raiz se borran solo si su destino coincide con el ejecutable canonico; los iconos se leen de `scripts/icons` y requieren cuadro 256x256.
- validacion: build WPF correcto (0 advertencias/errores); lint, typecheck, frontend CI, backend CI, portal CI, TDD enforcement, pipeline contract y contrato Installer Hub aprobados. Prueba focal del reconciliador e ICO: 1/1 aprobada.
- pendientes: cobertura CI local agoto el timeout de 180 s en el caso sintetico OMR bajo instrumentacion; `perf:check` requiere `JWT_SECRETO`, no configurado y no inventado. PR, release 1.2.22, instalacion local y verificacion runtime de accesos quedan pendientes.
- riesgos: el cierre/apertura del host sin interfaz no se implementa en este cambio; el acceso Startup obsoleto apunta a staging y se debe migrar al instalar la nueva version.
- siguiente paso: completar los gates disponibles, publicar y validar 1.2.22; reconciliar accesos locales conservando copia de los `.lnk` actuales y comprobar iconos y destinos desde el shell.
