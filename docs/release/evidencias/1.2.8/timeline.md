# Timeline Gate Estable 1.2.8

- SHA candidato: `ab784c4c4fca0ca24d86cab8a37ceaca22d5e0d1`
- Rama evaluada: `main`
- Fecha: 2026-10-16
- Resultado automatizado: gates de CI, UX/UI y Installer Hub aprobados; flujo humano de producción externa pendiente.

## Pasos

1. [OK] CI Checks full #1451 en el SHA candidato.
2. [OK] CI Checks full #1452 consecutivo, mismo SHA.
3. [OK] Backend Prisma/SQLite, cobertura backend/portal y Classroom audit.
4. [OK] OMR canónico y E2E docente-alumno.
5. [OK] PDF impresión y E2E visual de UX/UI.
6. [OK] Build MSI/Bundle docente-local y gate de footprint.
7. [OK] Smoke GUI de Installer Hub y gate antivirus.
8. [OK] E2E del bundle, incluida actualización desde v1.2.3.
9. [OK] E2E de vista/descarga PDF en Microsoft Edge.
10. [PENDIENTE] Flujo humano docente contra producción externa.
11. [PENDIENTE] Instalación manual en el equipo local; debe verificarse tras publicar mediante Installer Hub.

## Resultado

El candidato `ab784c4c4fca0ca24d86cab8a37ceaca22d5e0d1` superó dos corridas full consecutivas y el E2E del instalador Windows. El gate de producción humana se marca como no ejecutado; esta evidencia no afirma uso de datos productivos.
