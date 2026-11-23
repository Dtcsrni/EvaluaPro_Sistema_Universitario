# Mapa de archivos

Este documento resume la estructura vigente del repositorio.

## Raiz
- `README.md`: guia principal.
- `package.json`: scripts globales y workspaces.
- `docs/`: documentacion tecnica y operativa.
- `scripts/`: utilidades de arranque, dashboard, docs y diagramas.
- `apps/`: aplicaciones del monorepo.
- `ci/`: contrato de pipeline agnostico.
- `ops/`: observabilidad local (Prometheus/Grafana/alertas).

## apps/
- `apps/backend/`: API docente (escritura, OMR, calificacion, sincronizacion).
- `apps/frontend/`: interfaz docente/alumno.
- `apps/portal_alumno_cloud/`: API y portal de consulta alumno.

## backend (estructura)
- `src/app.ts`, `src/index.ts`, `src/rutas.ts`
- `src/modulos/*` por dominio:
  - autenticacion, alumnos, banco, generacion_pdf,
  - vinculacion_entrega, escaneo_omr, calificacion,
  - analiticas, sincronizacion_nube, admin_docentes, papelera
- Estado OMR vigente:
  - endpoint operativo: `/api/omr/*`
- `src/infraestructura/*`: base de datos, archivos, seguridad, logging, correo
- `src/compartido/*`: errores, validaciones, utilidades
- `tests/*`: unitarias, contrato e integracion

## frontend (estructura)
- `src/apps/app_docente/`
- `src/apps/app_alumno/`
- `src/servicios_api/`
- `tests/`

## portal_alumno_cloud (estructura)
- `src/app.ts`, `src/index.ts`, `src/rutas.ts`
- `src/modelos/*`
- `src/servicios/*`
- `src/infraestructura/*`
- `tests/*`

## docs/
- Arquitectura: `ARQUITECTURA.md`, `ARQUITECTURA_C4.md`
- Flujo: `FLUJO_EXAMEN.md`
- PDF/OMR: `FORMATO_PDF.md`
- Seguridad/RBAC: `SEGURIDAD.md`, `ROLES_PERMISOS.md`
- Operacion: `DESPLIEGUE.md`, `PRUEBAS.md`, `SINCRONIZACION_ENTRE_COMPUTADORAS.md`
- Gobierno: `VERSIONADO.md`
- Inventario: `INVENTARIO_PROYECTO.md`
- Auto: `AUTO_DOCS_INDEX.md`, `AUTO_ENV.md`

## Nota
`AUTO_DOCS_INDEX.md` y `AUTO_ENV.md` se regeneran con scripts, no editar manualmente.


