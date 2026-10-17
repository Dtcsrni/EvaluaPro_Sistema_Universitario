# Timeline Gate Estable 1.2.8

- SHA candidato: `7752c394dad88f671037899629ab970ec6e61f7f`
- Rama evaluada: `main`
- Fecha: 2026-10-17
- Resultado automatizado: gates de CI, UX/UI y Installer Hub aprobados; flujo humano de producción externa pendiente.

## Pasos

1. [OK] CI Checks full #1458 en el SHA candidato exacto.
2. [OK] CI Checks full #1459 consecutivo, mismo SHA; todos los jobs extendidos success.
3. [OK] Backend Prisma/SQLite, cobertura backend/portal y Classroom audit en ambas corridas.
4. [OK] OMR canónico y E2E docente-alumno.
5. [OK] PDF impresión y E2E visual de UX/UI; recorrido integral docente de 4 pruebas aprobado.
6. [OK] Build MSI/Bundle docente-local y gate de footprint en CI Installer Windows #689.
7. [OK] Smoke GUI de Installer Hub y gate antivirus.
8. [OK] E2E del bundle, incluida actualización desde v1.2.3.
9. [OK] E2E de vista/descarga PDF en Microsoft Edge.
10. [PENDIENTE] Flujo humano docente contra producción externa.
11. [PENDIENTE] Instalación manual en el equipo local; debe verificarse tras publicar mediante Installer Hub.

## Resultado

El candidato `7752c394dad88f671037899629ab970ec6e61f7f` superó dos corridas full consecutivas y el E2E del instalador Windows. El gate de producción humana se marca como no ejecutado; esta evidencia no afirma uso de datos productivos.
