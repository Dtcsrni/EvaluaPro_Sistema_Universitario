# Timeline Gate Estable 1.2.8

- SHA candidato: `84a89c0df5e7ae542dba11ff45e55ea3c7c40638`
- Rama evaluada: `main`
- Fecha: 2026-10-20
- Resultado: CI Checks, seguridad, antivirus y E2E Windows/UX visual aprobaron sobre el mismo SHA. Falta ejecutar Release Stable Gate para promover y publicar.

## Pasos

1. [OK] CI Checks #1527 (run 39381668637), main y SHA candidato exacto; Core, verificaciones extendidas y ux-visual-check concluyeron success.
2. [OK] Backend tests, auditoría Classroom, lint/typecheck frontend, WCAG, UX quality, build, arquitectura y seguridad concluyeron success.
3. [OMITIDO POR IMPACTO] Coverage backend/frontend no se ejecutó en esta corrida; no se contabiliza como aprobado.
4. [OK] Security CodeQL #894 (run 39381668632) sobre el mismo SHA.
5. [OK] CI Antivirus Gate #350 (run 39381668664) sobre el mismo SHA.
6. [OK] E2E UX/UI visual y publicación de evidencia en CI Checks #1527; artefacto e2e-visual-39381668637 ID 12246991944.
7. [OK] Build MSI/Bundle, contratos del Hub, footprint, manifiesto/hash y antivirus en CI Installer Windows #741 (run 39382108606).
8. [OK] E2E completa de GUI sobre el bundle docente candidato en CI Installer Windows #741.
9. [OK] E2E de actualización desde baseline oficial v1.2.3 en CI Installer Windows #741.
10. [OK] E2E visual de vista y descarga PDF en Microsoft Edge en CI Installer Windows #741.
11. [OK] Artefacto installer-windows ID 12246976717; 272084140 bytes; digest ZIP SHA-256 `785f89b8464f2097f1a1fbc67a9f870a7e52a7e48be2f865b57856b8c350d404`.
12. [NO EJECUTADO] Flujo docente humano con producción externa; no se usaron credenciales ni datos reales.
13. [NO EJECUTADO] Instalación manual en el equipo local; se ejecutó E2E aislado en CI.
14. [PENDIENTE] Release Stable Gate, promoción del release v1.2.8, E2E del asset draft y validación del asset público.

## Resultado

El candidato `84a89c0df5e7ae542dba11ff45e55ea3c7c40638` superó CI Checks, CodeQL, antivirus y el E2E del bundle Windows, incluido UX/UI y PDF en Edge. La corrida de CI omitió coverage por impacto. Aún no es una release estable: falta el Stable Gate, que volverá a ejecutar QA y validará la promoción y el asset público.

