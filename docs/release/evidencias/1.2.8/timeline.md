# Timeline Gate Estable 1.2.8

- SHA candidato: `c436b2ea87871c4843e2ad90731e45628b73e869`
- Rama evaluada: `main`
- Fecha: 2026-10-18
- Resultado de validaciones: CI completa, visual UX/UI y E2E Installer Windows aprobados. El flujo humano externo y la instalación manual local no forman parte de esta evidencia automatizada.

## Pasos

1. [OK] CI Checks full #1486 (run 39085845113) en el SHA candidato exacto.
2. [OK] CI Checks full #1487 (run 39091609380), consecutiva, sobre el mismo SHA.
3. [OK] Cobertura backend/portal y auditoría Classroom en ambas corridas.
4. [OK] Gate OMR canónico en ambas corridas.
5. [OK] PDF/impresión y E2E de ciclo completo en ambas corridas.
6. [OK] E2E visual UX/UI y recorridos responsive de docente, alumno y administración en ambas corridas.
7. [OK] Build MSI/Bundle, footprint, manifiesto/hash y antivirus en CI Installer Windows #706 (run 39086197623).
8. [OK] Smoke GUI del bundle Burn en Installer Windows #706.
9. [OK] E2E de actualización desde v1.2.3 en Installer Windows #706.
10. [OK] E2E visual de vista/descarga PDF en Microsoft Edge.
11. [OK] Artefacto `installer-windows` ID 12121561847 y digest verificados en metadatos de GitHub.
12. [NO EJECUTADO] Flujo humano docente con producción externa.
13. [NO EJECUTADO] Instalación manual local; pendiente posterior a la publicación estable.

## Resultado

El SHA candidato `c436b2ea87871c4843e2ad90731e45628b73e869` superó dos corridas full consecutivas y el E2E completo del instalador Windows. Los gates automatizados no acreditan uso con datos reales ni una instalación manual local.
