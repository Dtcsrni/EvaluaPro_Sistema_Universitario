# Timeline Gate Estable 1.2.8

- SHA candidato: `94bc5c881ea1bb8739911814dc7f05e52def94d6`
- Rama evaluada: `main`
- Fecha: 2026-10-18
- Resultado: CI full consecutiva, UX/UI visual y E2E Installer Windows aprobados. El flujo humano externo y la instalación manual local no forman parte de esta evidencia automatizada.

## Pasos

1. [OK] CI Checks full #1495 (run 39096808969) en el SHA candidato exacto.
2. [OK] CI Checks full #1496 (run 39102658491), consecutiva, sobre el mismo SHA.
3. [OK] Cobertura backend/portal y auditoría Classroom en ambas corridas.
4. [OK] Gate OMR canónico en ambas corridas.
5. [OK] PDF/impresión y E2E de ciclo completo en ambas corridas.
6. [OK] E2E visual UX/UI y recorridos responsive de docente, alumno y administración en ambas corridas.
7. [OK] Build MSI/Bundle, footprint, manifiesto/hash y antivirus en CI Installer Windows #711 (run 39096847674).
8. [OK] Smoke GUI del bundle Burn en Installer Windows #711.
9. [OK] E2E de actualización desde v1.2.3 en Installer Windows #711.
10. [OK] E2E visual de vista/descarga PDF en Microsoft Edge.
11. [OK] Artefacto `installer-windows` ID 12125527616; digest ZIP SHA-256 `eac35a42102adedefffc12970088bef566f6a481fd05f6b0999a2ecd403584e1`.
12. [NO EJECUTADO] Flujo humano docente con producción externa.
13. [NO EJECUTADO] Instalación manual local; pendiente posterior a la publicación estable.

## Resultado

El SHA candidato `94bc5c881ea1bb8739911814dc7f05e52def94d6` superó dos corridas full consecutivas y el E2E completo del instalador Windows. Los gates automatizados no acreditan uso con datos reales ni una instalación manual local.
