---
id: SPEC-056
titulo: Auditoria visual y muestras reproducibles del examen OMR canonico
version: 1.7.0
fecha: 2026-09-12
autor: EvaluaPro Team
modulo: modulo_generacion_pdf
estado: implemented
---

## Contexto

La plantilla OMR canónica requiere evidencia visual reproducible para evitar
regresiones de composición, legibilidad, QR y geometría de respuesta al
generar exámenes reales. Las muestras deben utilizar el perfil horizontal
canónico; no se conservan perfiles verticales históricos como ruta operativa.

## Objetivo

Mantener una única muestra base reproducible, generada por el mismo renderer
canonico que usa produccion, con 25 reactivos enriquecidos y objetivo de dos
paginas consecutivas para medir la capacidad maxima por par duplex. La muestra
incluye formato enriquecido, JavaScript, formula e imagen; se inspecciona
rasterizada a 150 y 300 DPI, ademas de validar el mapa OMR y las colisiones
geometricas.

## Requisitos Funcionales

- **REQ-001**: Las muestras deben invocar `generarPdfExamen` y persistir el PDF
  y su mapa OMR asociado.
- **REQ-002**: El PDF debe conservar la jerarquia de cabecera, instrucciones,
  QR, campos de captura y paneles OMR sin recortes ni solapes. Las
  instrucciones largas deben envolverse dentro del ancho real disponible,
  descontando la etiqueta y la reserva del QR; nunca se permite recortar solo
  la primera linea. Los iconos funcionales de alumno, grupo e indicaciones se
  dibujan como vectores y deben permanecer separados de los textos y campos.
  La banda de captura puede incluir geometria secundaria solo en sus zonas
  libres; las franjas de nombre, grupo, indicaciones y sus lineas de escritura
  deben quedar despejadas.
- **REQ-003**: Las opciones de varias lineas deben mantener separacion visual;
  ninguna regla de tarjeta puede atravesar glifos al rasterizar.
- **REQ-004**: Cada panel canónico debe conservar cinco burbujas en una sola
  fila horizontal, fiduciales contenidos, separación positiva y coordenadas
  compatibles con el detector.
- **REQ-005**: Las muestras deben conservar la secuencia dúplex canónica:
  páginas impares frente, páginas pares reverso, pares físicos numerados y
  volteo por borde largo. No se agregan páginas vacías: cuando el contenido
  termine en un frente impar, la última hoja conserva solo ese frente.
- **REQ-006**: La muestra base debe llenar cada página del primer par hasta su
  capacidad física antes de abrir una página adicional, sin sacrificar las
  reservas OMR, legibilidad, margen de impresión o ausencia de colisiones.

## Criterios de Aceptación

1. La muestra base (`omr-tv4-base-capacity`) se genera con
   `preguntasRestantes = 0` y sin `collisionBoxes`.
2. Las paginas renderizadas a 150 y 300 DPI se inspeccionan visualmente y no
   presentan texto recortado, solapes, QR ilegible, paneles fuera del marco ni
   reglas atravesando texto.
3. El cambio de presentacion de tarjetas no altera el contrato OMR canonico ni
   las pruebas de layout existentes.
4. El mapa de cada muestra declara `hoja`, `lado` e `indiceEnHoja` de cada
   página y las páginas consecutivas se imprimen como pares dúplex, sin caras
  vacías artificiales; una última página frontal aislada se conserva cuando
  el contenido real termina en un número impar.
5. La muestra base conserva los 25 reactivos y llena el primer par dúplex al
   máximo posible; si el contenido enriquecido excede dos páginas, las páginas
   adicionales son reales y no se insertan reversos vacíos.

## Evidencia

- Generador reproducible de muestras: `apps/backend/scripts/omr-visual-qa.ts`.
- Runner ESM oficial: `npm -C apps/backend run omr:visual:qa`, implementado por
  `apps/backend/scripts/omr-visual-qa-runner.mjs`.
- Salida final: `output/qa/omr-tv4-base-capacity.pdf` y su
  `*.layout.json`; los rasterizados de inspección se mantienen solo en
  temporales y se eliminan al finalizar (o la ruta
  explícita de `OMR_VISUAL_QA_OUT_DIR`).
- Validacion automatica: `apps/backend/tests/pdf.layout.visual.guard.test.ts`.
- La misma prueba valida la presencia, contención y ausencia de colisiones de
  los iconos vectoriales de la cabecera (`headerIconBoxes`).
- Paridad de raster y firma geométrica: `apps/backend/tests/pdf.paridad.test.ts`; además
  de fiduciales y QR, mide contraste local del patrón en la cabecera a 150 y
  300 DPI para evitar que vuelva a quedar plano o invisible.
- Ejecución verificada: la muestra base se genera con el perfil horizontal
  canónico, cero preguntas restantes y cero colisiones; el PDF se rasteriza a
  150 y 300 DPI y su mapa conserva la secuencia dúplex.

## Matriz de Trazabilidad

| ID Requisito | Descripción del Caso | Archivo de Test Vinculado | Estado |
| --- | --- | --- | --- |
| REQ-001 | Generación del PDF y mapa OMR reproducibles | `apps/backend/tests/pdf.layout.visual.guard.test.ts` | Completado |
| REQ-002 | Cabecera, QR, campos, paneles y márgenes sin solapes | `apps/backend/tests/pdf.layout.visual.guard.test.ts` | Completado |
| REQ-003 | Separación de opciones y reglas de tarjetas | `apps/backend/tests/pdf.layout.visual.guard.test.ts` | Completado |
| REQ-004 | Cinco burbujas, fiduciales y coordenadas compatibles | `apps/backend/tests/pdf.layout.visual.guard.test.ts` | Completado |
| REQ-005 | Secuencia dúplex sin páginas vacías artificiales | `apps/backend/tests/pdf.paridad.test.ts` | Completado |
| REQ-006 | Capacidad máxima por par dúplex | `apps/backend/tests/pdf.paridad.test.ts` | Completado |
