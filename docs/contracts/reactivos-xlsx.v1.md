# Contrato XLSX de reactivos v1

El libro se convierte en el contrato canónico `evaluapro.reactivos.batch` y
usa el mismo preview, resolución de IDs, detección de conflictos, confirmación
transaccional y ciclo de revisión/publicación que JSON/JSONL. El XLSX no es un
camino alterno de escritura.

Descarga la plantilla desde Banco de reactivos o desde
`GET /api/banco-preguntas/importaciones/plantilla.xlsx`.

## Estructura del libro

El archivo debe ser `.xlsx` y contener exactamente dos hojas visibles, en
cualquier orden: `Lote` y `Reactivos`. No se admiten hojas extra, ocultas,
combinadas, fórmulas ni encabezados desconocidos, faltantes, duplicados o
reordenados. Usa texto plano en las celdas, excepto `schemaVersion` (entero
`1`), `expectedVersion` (entero positivo) y `confidence` (decimal entre 0 y
1), que deben ser valores numéricos de Excel. Las fechas deben ser
texto ISO-8601 con zona horaria.

### Hoja `Lote`

Fila 1: `campo`, `valor`. Cada campo permitido aparece una sola vez.

| Campo | Obligatorio | Valor |
| --- | --- | --- |
| `contract` | Sí | `evaluapro.reactivos.batch` |
| `schemaVersion` | Sí | `1` |
| `batchId` | Sí | Identificador estable del lote |
| `periodoId` | Sí | ID canónico de la materia/periodo; no usar nombre |
| `temaIds` | Sí | Arreglo JSON de IDs canónicos, por ejemplo ` ["tema-123"] ` |
| `generator` | Sí | Autor o generador de contenido |
| `generatorModel` | No | Modelo usado, si aplica |
| `generatedAt` | Sí | Fecha ISO-8601, por ejemplo `2026-09-23T18:00:00Z` |
| `sourceDocumentSha256` | No | SHA-256 hexadecimal del documento fuente |

### Hoja `Reactivos`

Fila 1 debe contener exactamente estos encabezados en este orden:

`externalKey`, `itemId`, `expectedVersion`, `temaId`, `enunciado`, `opcionA`, `opcionB`,
`opcionC`, `opcionD`, `opcionE`, `respuestaCorrecta`,
`difficultyHypothesis`, `cognitiveLevel`, `competenciesJson`, `tagsJson`,
`notes`, `confidence`.

- `externalKey`: requerido, único dentro del lote y compuesto por letras,
  números, punto, guion, guion bajo o dos puntos.
- `temaId`: opcional cuando `Lote.temaIds` contiene un solo ID; requerido por
  fila si el lote abarca varios temas. Debe ser uno de los IDs canónicos de
  `Lote.temaIds`. Cada reactivo queda asignado a un único tema; no se replica
  automáticamente en todos los temas seleccionados.
- `itemId` y `expectedVersion`: ambos vacíos para crear. Para actualizar, ambos
  son obligatorios; `expectedVersion` debe ser entero positivo. Una versión
  desactualizada se reporta como conflicto, nunca se sobrescribe.
- `enunciado` y `opcionA`–`opcionE`: textos requeridos. No pegues fórmulas ni
  contenido HTML ejecutable.
- `respuestaCorrecta`: una sola clave: `A`, `B`, `C`, `D` o `E`.
- `difficultyHypothesis`: vacío, `easy`, `medium` o `hard`.
- `cognitiveLevel`: vacío, `remember`, `understand`, `apply`, `analyze`,
  `evaluate` o `create`.
- `competenciesJson` y `tagsJson`: arreglos JSON de textos; usa `[]` si no hay
  valores.
- `notes`: notas de procedencia, opcionales.
- `confidence`: número entre 0 y 1 que representa la confianza declarada por
  quien genera/importa; no es una medición psicométrica.

Cada fila completa se convierte a un reactivo `omr.mcq5` con cinco opciones en
orden A–E y una sola respuesta correcta. Por compatibilidad, el importador sigue
aceptando la versión anterior de encabezados; si el lote declara varios temas,
la fila debe incluir `temaId`. El contrato admite hasta 500 reactivos
por lote. Los IDs y la existencia del periodo/tema se validan en el servidor.
La materia y los temas nunca se buscan por nombre.

## Flujo confiable

1. Completa la plantilla sin cambiar nombres ni orden de encabezados.
2. Sube el libro y revisa el preview. La validación no escribe en la base.
3. Corrige errores o conflictos en el archivo y genera un preview nuevo.
4. Confirma el plan revisado. El navegador envía el payload que devolvió ese
   preview y el servidor recalcula su hash antes de persistir.
5. Envía los borradores a revisión y publícalos mediante las acciones explícitas
   del banco.

Reimportar el mismo contenido es idempotente. Cambiar el contenido conservando
`externalKey` no reemplaza silenciosamente el reactivo existente.
