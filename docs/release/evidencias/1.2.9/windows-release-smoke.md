# Evidencia Windows — EvaluaPro 1.2.9

Fecha de validación: 2026-10-22 (UTC)  
Versión: 1.2.9  
SHA candidato: `f624dcbd211f1fb87d578995918b69bf6112f4b5`

## CI Installer Windows

- CI Installer Windows #819 (run ID 39754392480), rama `main`, SHA exacto: `success`.
- Pasaron build MSI/Bundle docente-local, fixture Burn, footprint, smoke GUI, manifest/hash, antivirus y artifacts.
- E2E del bundle docente-local y actualización desde baseline oficial v1.2.3: `success`.
- E2E visual PDF Edge: un test aprobado; el PDF sintético se visualizó y descargó intacto.
- wcag-guard OK y 33/33 pares de contraste aprobados.
- IDs, tamaños y digests de ZIP en `integridad_sha256.json`; no son hashes del EXE extraído.
- Las capturas de E2E y logs se conservan en el artifact `installer-hub-e2e-39754392480` de GitHub Actions.

## Host Windows 11

Windows Sandbox finalizó inesperadamente con código 0x80370106 durante el intento de E2E aislada. Por ello, no se afirma una E2E local. No se instaló ni actualizó EvaluaPro en el host; la base SQLite activa no se leyó ni modificó.

## Promoción pendiente

Stable Promotion Gate aún debe ejecutar matriz GUI responsive, contrato visual, E2E de ciclo docente y QA completa. Después se requieren E2E del asset de release draft y del asset público. No se usaron credenciales o datos productivos.
