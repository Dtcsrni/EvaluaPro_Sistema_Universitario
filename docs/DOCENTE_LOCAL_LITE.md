# Runtime docente-local

## Objetivo

Documentar la arquitectura ligera y el baseline de confiabilidad del flavor
`docente-local` para Windows.

## Baseline

- `npm run installer:docente:baseline -- --json` registra el contrato local, los
  bundles disponibles y sus límites de tamaño.
- Completar en una VM Windows limpia la evidencia de descarga e instalación:
  bytes descargados, tiempo hasta UI lista, prompts UAC, uso de disco y RAM,
  además de `install`, `repair`, `update` y `uninstall`.
- La aplicación usa Node.js embebido, API/Web locales y SQLite. El portal cloud
  y las integraciones externas se configuran de forma diferida.

## Cortes de implementación

1. Instalación mínima:
   - backend docente local con `EVALUAPRO_FLAVOR=docente-local` y
     `PORTAL_SYNC_REQUIRED=0`;
   - portal/sync, OAuth/Classroom, correo y licencia no obligatoria se
     configuran al primer uso.
2. Soporte:
   - Dashboard expone operaciones de alto nivel con sesión step-up local activa;
   - allowlist no acepta comandos ni rutas arbitrarias.
3. Footprint:
   - medir el payload, memoria, tiempo de arranque y ciclo de actualización;
   - retirar dependencias solo después de comparar confiabilidad y flujos docentes.

## Validación requerida

- Prototipo o cambio medible ligado a una especificación aprobada.
- Comparación reproducible de descarga, instalación, arranque, almacenamiento,
  memoria, backup, sincronización, OMR/PDF, actualización, seguridad y soporte.
- Recomendación basada en resultados observados, sin inferir estabilidad de un
  único smoke o de un bundle presente.
