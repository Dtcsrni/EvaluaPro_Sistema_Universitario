# Notas de Release - EvaluaPro v1.0.1

EvaluaPro `1.0.1` es un patch release sobre `1.0.0` para dejar el corte estable alineado con `main` y con la validacion extendida completa.

## Cambios

- Se integra la preparacion docente para cursos ya iniciados y examen global con insumos externos: listas XLSX, temarios/encuadres DOCX, parciales previos y material complementario.
- Se conserva el proceso estandarizado en `docs/PROCESO_GLOBAL_CURSO_INICIADO.md` para preview, mapeo, normalizacion, hidratacion y reporte de importacion.
- Se corrige CI extendido para generar Prisma Client antes de ejecutar suites que importan backend.
- Se agrega prueba de contrato para evitar que los jobs `Extended Funcionales`, `Extended Perf/Arquitectura` y `Extended Compliance/Evidencia` vuelvan a ejecutar sin Prisma Client generado.

## Evidencia

- Commit validado: `ad425d1c99871d276ffb6e90ab0d2c48cbb80791`
- Workflow: `CI Checks`
- Run: `https://github.com/Dtcsrni/EvaluaPro_Sistema_Universitario/actions/runs/28178008367`
- Resultado: Core y Extended en `success`.

## Riesgos conocidos

- No se reescribe el tag `v1.0.0`; `v1.0.1` es el corte que contiene los fixes y la evidencia post-merge.
- El push remoto reporta vulnerabilidades Dependabot pendientes en default branch; no bloquearon `npm audit --omit=dev --audit-level=critical`, pero deben atenderse como hardening separado.
