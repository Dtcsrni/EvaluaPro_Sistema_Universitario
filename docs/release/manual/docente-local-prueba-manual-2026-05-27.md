# Prueba manual docente-local 2026-05-27

Objetivo: ejecutar una prueba manual docente sobre el Installer Hub `docente-local` hasta generacion, impresion y calificacion de examenes.

## Precondiciones
- Instalar desde `dist/installer/docente-local/EvaluaPro-InstallerHub-docente-local-v1.0.0.exe`.
- Runtime esperado: `WSL2 + Ubuntu + Docker Engine`.
- Stack minimo sano: `mongo_local`, `api_docente_prod`, `web_docente_prod`.
- URL docente: `http://localhost:4173`.
- No usar Docker Desktop salvo soporte explicito con `EVALUAPRO_DOCKER_RUNTIME=desktop`.

## Datos minimos
- 1 docente activo.
- 1 materia/periodo activo.
- 3 alumnos cargados.
- Banco con reactivos suficientes para una plantilla parcial y una global.
- Plantilla activa con OMR/PDF habilitado.

## Recorrido manual
1. Abrir el Dashboard del Hub y confirmar estado saludable.
2. Abrir la UI docente en `http://localhost:4173`.
3. Iniciar sesion como docente.
4. Crear o seleccionar materia/periodo.
5. Registrar o importar alumnos.
6. Crear reactivos en banco y validar que quedan visibles.
7. Crear plantilla de examen.
8. Generar examen desde la plantilla.
9. Descargar PDF individual o lote.
10. Abrir el PDF y verificar:
    - tamano carta,
    - folio/QR visibles,
    - OMR legible,
    - sin cortes de contenido antes de imprimir.
11. Imprimir una copia fisica o imprimir a PDF desde el visor del sistema.
12. Registrar entrega o asociar alumno segun el flujo disponible.
13. Calificar por escaneo OMR o modo manual.
14. Verificar resultado por alumno y calificacion global/final.
15. Exportar evidencia o reporte de calificaciones.
16. Ejecutar cierre: cerrar sesion, detener/reparar desde Hub si aplica, y confirmar que no quedan errores activos.

## Evidencia a guardar
- Captura del Dashboard saludable.
- Captura de UI docente autenticada.
- PDF generado.
- Captura o archivo de impresion.
- Captura de calificacion final.
- `docs/release/manual/prod-flow.json` completado con valores reales.
- `reports/qa/latest/manifest.json`.

## Go/No-Go
- `GO` para piloto manual: todos los pasos anteriores completos sin error bloqueante y con evidencia guardada.
- `NO-GO`: fallo de login, generacion, descarga/impresion PDF, calificacion o runtime minimo.
