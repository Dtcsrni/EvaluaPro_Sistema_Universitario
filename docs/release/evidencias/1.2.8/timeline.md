# Timeline Gate Estable 1.2.8

- SHA candidato: `21ef1ef414a765cfff83851a841686812b4cd795`
- Rama evaluada: `main`
- Fecha: 2026-10-18
- Resultado: CI full consecutiva, UX/UI visual y E2E Installer Windows aprobados. El flujo humano externo y la instalación manual local no forman parte de esta evidencia automatizada.

## Pasos

1. [OK] CI Checks full #1502 (run 39144073253) en el SHA candidato exacto.
2. [OK] CI Checks full #1503 (run 39155029767), consecutiva, sobre el mismo SHA.
3. [OK] Cobertura backend/portal y auditoría Classroom en ambas corridas.
4. [OK] Gate OMR canónico en ambas corridas.
5. [OK] PDF/impresión y E2E de ciclo completo en ambas corridas.
6. [OK] E2E visual UX/UI y recorridos responsive de docente, alumno y administración en ambas corridas.
7. [OK] Build MSI/Bundle, footprint, manifiesto/hash y antivirus en CI Installer Windows #714 (run 39113401895).
8. [OK] Smoke GUI del bundle Burn en Installer Windows #714.
9. [OK] E2E de actualización desde v1.2.3 en Installer Windows #714.
10. [OK] E2E visual de vista/descarga PDF en Microsoft Edge.
11. [OK] Artefacto `installer-windows` ID 12131808550; digest ZIP SHA-256 `50fd7251a9fee4ca8e265f916006cfb59a2a34c0de84e5405493f09e7de1b2f5`.
12. [NO EJECUTADO] Flujo docente humano con producción externa; la política de Stable Gate lo define como opcional y no se usaron datos reales.
13. [NO EJECUTADO] Instalación manual en el equipo local; la evidencia disponible es CI E2E de actualización, no una instalación física local.

## Resultado

El SHA candidato `21ef1ef414a765cfff83851a841686812b4cd795` superó dos corridas full consecutivas y el E2E completo del instalador Windows. La cobertura backend local también pasó: 60 lotes, 0 fallos, sobre un árbol Git idéntico al candidato (`f4e172c6d788845ac59164642082abebd5e7490c`). Los gates automatizados no acreditan uso con datos reales ni una instalación manual local.
