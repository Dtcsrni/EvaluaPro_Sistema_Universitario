# Docente Local Lite

## Objetivo

Adelgazar `docente-local` sin aprobar una migracion por intuicion. Cada corte debe comparar confiabilidad y footprint contra el baseline del Installer Hub vigente.

## Baseline

- Ejecutar `npm run installer:docente:baseline` para capturar contrato local, bundle disponible y probes Docker no destructivos.
- Completar en VM limpia la evidencia real de descarga/instalacion:
  - bytes descargados;
  - tiempo hasta UI lista;
  - prompts UAC;
  - disco y RAM idle;
  - `install`, `repair`, `update` y `uninstall`.
- El stack minimo actual sigue siendo `mongo_local`, `api_docente_prod`, `web_docente_prod`; portal cloud queda como integracion diferida.

## Cortes de implementacion

1. Instalacion minima:
   - backend docente local arranca con `EVALUAPRO_FLAVOR=docente-local` y `PORTAL_SYNC_REQUIRED=0`;
   - portal/sync, OAuth/Classroom, correo y licencia no obligatoria se configuran al primer uso.
2. Soporte:
   - Dashboard expone operaciones de alto nivel con sesion step-up local activa;
   - allowlist no acepta comandos ni rutas arbitrarias.
3. Footprint:
   - excluir tooling no operativo de imagenes/payload docente;
   - comparar topologia actual de tres servicios contra variante compacta antes de adoptarla.

## Spike sin Docker

Spike puede evaluar runtime Windows embebido y persistencia alternativa. Entregable requerido:

- prototipo minimo medible;
- tabla contra baseline WSL2 Docker;
- impacto en backup, sync, OMR/PDF, update, seguridad y soporte;
- recomendacion explicita: seguir adelgazando Docker o abrir migracion.
