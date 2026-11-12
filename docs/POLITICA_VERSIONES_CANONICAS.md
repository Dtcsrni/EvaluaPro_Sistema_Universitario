# Política de versiones canónicas

## Propósito

EvaluaPro debe trabajar siempre con una única versión activa y verificable del
contrato OMR. La versión del producto y la versión del contrato OMR son
identidades distintas y deben mostrarse por separado.

## Identidad activa

La fuente declarativa de esta política es
`config/omr-version-policy.json`. Actualmente define:

- **Producto:** la versión publicada en `package.json` y `config/app-version.json`.
- **Contrato OMR:** `omr-canonical-1.0.0`.
- **Etiqueta humana:** `OMR · 1.0.0-dev.1`.
- **Marcador de datos/QR nuevo:** `O1.0.0`.

El QR nuevo identifica el layout con una abreviatura estable de SemVer. El lector
conserva `TV4` solo como alias de entrada para hojas y mapas ya emitidos; no lo
genera en exámenes nuevos. El entero `templateVersion: 4` se conserva en los
mapas como detalle de almacenamiento interno y no se muestra como versión OMR.
La versión visible SemVer usa `major.minor.patch` y un sufijo prerelease cuando
corresponda: cambios incompatibles elevan `major`, cambios compatibles elevan
`minor` y correcciones compatibles elevan `patch`.

## Reglas obligatorias

1. Generación, previsualización, escaneo, calificación, recuperación y datasets
   activos deben declarar el contrato OMR canónico.
2. No se permite elegir una implementación por nombre de archivo, por `latest`,
   por orden de directorio ni por fallback silencioso.
3. Una versión SemVer ausente, desconocida o incompatible se rechaza con error
   explícito. Solo se acepta el alias QR heredado documentado para leer material
   ya impreso; nunca se usa para generar nuevos exámenes.
4. Todo PDF, mapa, payload, reporte o manifiesto que exponga identidad OMR debe
   conservar el identificador de contrato y la versión de plantilla.
5. La GUI debe mostrar permanentemente `OMR · 1.0.0-dev.1` en el shell docente,
   el flujo de plantillas y el centro de versión. La versión de la aplicación
   (`vX.Y.Z`) se muestra en un indicador separado.
6. Datasets, artefactos y builds antiguos no son fuentes operativas. Si se
   conservan por trazabilidad histórica, deben estar fuera de los recorridos
   activos y no pueden pasar los gates de generación o evaluación.

## Verificación y liberación

El gate `npm run test:omr:version-policy` valida la identidad declarada, la
alineación entre backend y frontend, la ausencia de etiquetas antiguas en la
GUI y el rechazo de referencias operativas obsoletas. Este gate debe ejecutarse
junto con los tests OMR, layout PDF, lint, typecheck y build antes de publicar.

Una instalación local solo se considera actualizada cuando su build y su
backend provienen de la misma ejecución de compilación. El indicador de la GUI
debe permitir distinguir inmediatamente el producto (`vX.Y.Z`) del contrato
OMR (`OMR · 1.0.0-dev.1`).
