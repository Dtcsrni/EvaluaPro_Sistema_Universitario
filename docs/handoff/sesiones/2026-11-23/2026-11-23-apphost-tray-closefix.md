# Traza: cierre AppHost a bandeja

- sessionId: $sid
- estado: draft
- objetivo: corregir la excepción WPF al elegir «No»; mantener AppHost, bandeja y APIs disponibles.
- cambios: packaging/app-host/App.xaml.cs, scripts/tests/app-host-shutdown.contract.test.mjs, docs/specs/SPEC-065_ciclo_vida_servicios_app_host.spec.md.
- validación: contratos AppHost 10/10; contrato Installer Hub 192/192 (12 omitidos); SDD audit OK; publish AppHost OK; bundle local 1.2.28 OK; SQLite quick_check=ok solo lectura.
- límite: no se ejecutó el E2E del instalador local; la instalación activa bloquea el target aislado y la alternativa modificaría la instalación/registro vigente.
- CI: el commit previo falló por la ruta «No»; la corrección aún no está enviada.
- siguiente paso: commit/push en PR #327, validar el SHA nuevo, instalar la corrección local y después completar merge/sync.
