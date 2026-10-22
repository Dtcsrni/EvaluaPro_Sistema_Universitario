# Timeline Gate Estable 1.2.9

- SHA candidato: `f624dcbd211f1fb87d578995918b69bf6112f4b5`
- Rama: `main`
- Fecha: 2026-10-22 (UTC)
- Resultado: CI y E2E del candidato aprobadas; promoción estable pendiente.

## Evidencia por etapa

1. [OK] CI Checks #1606 (run 39753480909), SHA exacto.
2. [OK] Security CodeQL #971 (run 39753481003), SHA exacto.
3. [OK] CI Antivirus Gate #389 (run 39753480993), SHA exacto.
4. [OK] CI Installer Windows #819 (run 39754392480), SHA exacto, success.
5. [OK] Build MSI/Bundle docente-local, fixture Burn, footprint y smoke GUI.
6. [OK] Manifiesto, sidecar SHA, antivirus y artifacts del bundle.
7. [OK] E2E completa; baseline oficial v1.2.3 verificado.
8. [OK] PDF Edge: vista/descarga intacta, 1 test passed.
9. [OK] wcag-guard OK; 33/33 pares de contraste.
10. [OK] Artifact E2E #819 ID 12416995743; 276066017 bytes; digest en integridad_sha256.json.
11. [EN CURSO] Commit de este expediente limitado a docs/release/evidencias/1.2.9.
12. [PENDIENTE] Stable Gate: matriz responsive, contrato visual, E2E de ciclo y QA completa.
13. [PENDIENTE] Publicar draft y verificar E2E del asset draft y público.
14. [NO EJECUTADO] Flujo docente productivo e instalación local; SQLite intacta.
15. [BLOQUEO LOCAL] Windows Sandbox cerró con 0x80370106; no se inició E2E local.

## Resultado

El candidato 1.2.9 pasó CI Checks, CodeQL, antivirus y CI Installer Windows #819. Aún no es release estable. Restan Stable Gate y E2E de assets. El host local y SQLite no se modificaron.
