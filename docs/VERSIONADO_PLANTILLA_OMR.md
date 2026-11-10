# Versionado de la plantilla OMR

La versión de implementación de la plantilla sigue `MAJOR.MINOR.PATCH` y se publica en `config/omr-version-policy.json` como `layoutVersion`. Un sufijo como `-dev.1` identifica una versión aún no liberada.

- **MAJOR:** cambios incompatibles con formatos, lectores o evidencia existentes; requieren migración o soporte explícito para el formato anterior.
- **MINOR:** mejoras compatibles de diseño o capacidades que no rompan la lectura de exámenes existentes.
- **PATCH:** correcciones compatibles sin nuevas capacidades.

La versión del formato, la versión del motor de lectura QR/OMR y la versión de la aplicación son independientes. Los QR nuevos y los manifiestos de recuperación registran la identidad SemVer del formato. El lector conserva compatibilidad con el marcador `TV4` de hojas impresas anteriormente; ese marcador es histórico y no se genera para hojas nuevas.

La identidad OMR visible es `OMR · 1.0.0-dev.1`; `templateVersion: 4` se conserva solo como número interno de geometría y almacenamiento heredado. El marcador `O1.0.0` identifica los QR nuevos. Las versiones anteriores de la app y del motor se consultan por separado.
