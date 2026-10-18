# Timeline Gate Estable 1.2.8

- SHA candidato: `e67e7cb41d8f39bff034432053ec634f9b8ccd93`
- Rama evaluada: `main`
- Fecha: 2026-10-18
- Resultado de las validaciones ejecutadas: CI completa, visual UX/UI y E2E Installer Windows aprobados. El flujo humano externo y la instalación manual local no forman parte de esta evidencia automatizada.

## Pasos

1. [OK] CI Checks full #1480 (run 39071161801) en el SHA candidato exacto.
2. [OK] CI Checks full #1481 (run 39076579171) consecutivo, sobre el mismo SHA.
3. [OK] Cobertura backend/portal y auditoría Classroom en ambas corridas.
4. [OK] Gate OMR canónico en ambas corridas.
5. [OK] PDF/impresión y E2E de ciclo completo en ambas corridas.
6. [OK] E2E visual UX/UI y recorridos responsive de docente, alumno y administración.
7. [OK] Build MSI/Bundle, footprint, manifiesto/hash y antivirus en CI Installer Windows #703 (run 39082944315).
8. [OK] Smoke GUI del bundle Burn en Installer Windows #703.
9. [OK] E2E de actualización desde v1.2.3 en Installer Windows #703.
10. [OK] E2E visual de vista/descarga PDF en Microsoft Edge.
11. [OK] Artefacto installer-windows ID 12120710054 y digest ZIP verificados en metadatos de GitHub.
12. [NO EJECUTADO] Flujo humano docente con producción externa.
13. [NO EJECUTADO] Instalación manual local; pendiente posterior a la publicación estable.

## Resultado

El SHA candidato `e67e7cb41d8f39bff034432053ec634f9b8ccd93` superó dos corridas full consecutivas y el E2E completo del instalador Windows. Los gates automatizados no constituyen evidencia de uso con datos reales ni de instalación manual local.
