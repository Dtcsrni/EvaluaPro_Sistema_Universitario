# Contratos de EvaluaPro

## Contratos de módulos backend

El registro [`module-contracts.v2.json`](./module-contracts.v2.json) define versión SemVer, compatibilidad del host, dependencias, APIs de dominio, superficies de composición y propiedad de modelos persistidos para los 21 módulos backend.

- Los consumidores de dominio importan desde el `index.ts` público del módulo.
- El host docente (`apps/backend/src/rutas.ts` y `apps/backend/src/index.ts`) integra routers y tareas de inicio mediante `composition.ts`.
- Los historiales de dominio y composición son append-only y comparten `contractVersion`; los cambios incompatibles requieren versión major y los aditivos versión minor.
- Para registrar una API nueva, incrementa `contractVersion` y ejecuta `npm run qa:module-contracts:snapshot`; después valida con `npm run qa:module-contracts:check`.
- `qa:clean-architecture:strict` vuelve a comprobar límites, ciclos y propiedad de datos.

## Contrato de reactivos para generadores

El contrato canónico es [`reactivos-batch.v1.schema.json`](./reactivos-batch.v1.schema.json).
La plantilla tabular equivalente está definida en [`reactivos-xlsx.v1.md`](./reactivos-xlsx.v1.md) y se puede descargar desde el Banco de reactivos.

Para generar un lote desde ChatGPT u otro generador:

1. Solicita salida JSON estricta, sin Markdown ni comentarios.
2. Copia `periodoId` y `temaIds` desde el botón de plantilla de EvaluaPro.
3. Usa un `externalKey` estable por reactivo.
4. Para reactivos nuevos usa `itemId: null` y `expectedVersion: null`.
5. Para actualizar uno existente usa su `itemId` y la versión esperada.
6. Conserva exactamente las opciones A, B, C, D y E y una sola respuesta correcta.
7. Carga el archivo en EvaluaPro y revisa el preview antes de confirmar.

También puedes descargar la plantilla `.xlsx`, completar `Lote` con los IDs
canónicos y agregar una fila por reactivo en `Reactivos`. No cambies sus hojas
ni encabezados. Ambos formatos usan el mismo pipeline y los mismos controles.

JSONL usa una línea por lote válido. Todas las líneas de un archivo JSONL deben
compartir `batchId`, `target` y `source`; el backend las combina y vuelve a
validar el lote completo, por lo que un `externalKey` duplicado se rechaza.

El preview no publica reactivos. La confirmación los crea en `draft`; después
de revisar el contenido deben publicarse para que alimenten el banco compatible
con el generador OMR.

## Prompt recomendado para ChatGPT

Puedes pedir al generador:

> Genera un lote de reactivos para EvaluaPro. Devuelve únicamente JSON válido,
> sin Markdown ni comentarios, conforme a `reactivos-batch.v1.schema.json`.
> Usa exactamente el `periodoId` y los `temaIds` proporcionados. Para cada
> reactivo nuevo usa un `externalKey` estable, `itemId: null` y
> `expectedVersion: null`. Conserva cinco opciones en orden A-E y marca una
> sola como correcta. La dificultad y el nivel cognitivo son hipótesis, no
> mediciones. No uses nombres de materia o tema, HTML inseguro ni URLs remotas.

El generador no debe inventar IDs: si no recibe los identificadores canónicos,
debe solicitarlos antes de producir el lote.
