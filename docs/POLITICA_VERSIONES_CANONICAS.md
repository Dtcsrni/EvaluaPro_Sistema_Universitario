# Política de versiones canónicas

## Propósito

EvaluaPro debe trabajar siempre con una única versión activa y verificable del
contrato OMR. La versión del producto y la versión del contrato OMR son
identidades distintas y deben mostrarse por separado.

## Identidad activa

La fuente declarativa de esta política es
`config/omr-version-policy.json`. Actualmente define:

- **Producto:** la versión publicada en `package.json` y `config/app-version.json`.
- **Contrato OMR:** `omr-canonical-v4`.
- **Etiqueta humana:** `OMR canónico · v4`.
- **Marcador de datos/QR:** `TV4`.

El marcador `TV4` es un identificador de protocolo ya emitido en QR y mapas;
no constituye una rama de compatibilidad. El motor solo acepta la versión 4.

## Reglas obligatorias

1. Generación, previsualización, escaneo, calificación, recuperación y datasets
   activos deben declarar el contrato OMR canónico.
2. No se permite elegir una implementación por nombre de archivo, por `latest`,
   por orden de directorio ni por fallback silencioso.
3. Una versión ausente, desconocida o distinta de 4 se rechaza con error
   explícito y no puede continuar por una ruta de compatibilidad.
4. Todo PDF, mapa, payload, reporte o manifiesto que exponga identidad OMR debe
   conservar el identificador de contrato y la versión de plantilla.
5. La GUI debe mostrar permanentemente `OMR canónico · v4` en el shell docente,
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
OMR (`OMR canónico · v4`).
