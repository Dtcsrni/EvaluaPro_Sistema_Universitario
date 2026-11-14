---
id: SPEC-132
titulo: Patron vectorial institucional de cabecera de examen
version: 1.1.0
fecha: 2026-11-13
autor: EvaluaPro Team
modulo: modulo_generacion_pdf
estado: implemented
---

## Contexto

La cabecera usa una base azul clara con rombos, nodos y una red de diagonales.
La revisión solicitada pide un patrón más visible y original, con geometría
radial tipo mandala, manteniendo el contraste de texto y la limpieza de las
zonas de QR, fiduciales y captura.

Se busca recuperar el lenguaje visual reconocible del examen compartido y
refinarlo con trazos vectoriales de bajo contraste. El cambio se limita al fondo
decorativo de la cabecera. No cambia la composición de una columna, el número de
páginas, el contenido, los campos del alumno, la zona de calificación ni la
geometría de QR, fiduciales u OMR.

## Requisitos Funcionales

- **REQ-001 — Geometría editorial:** La cabecera combina rombos abiertos,
  diagonales largas y rosetones poligonales simétricos de ocho pétalos con
  escalas alternadas. El motivo se repite de forma determinista y evita una
  ilustración raster o una única roseta central dominante.
- **REQ-002 — Presencia y contraste:** El patrón se distingue claramente en
  impresión y pantalla, pero usa trazos finos sobre fondo claro. El texto y los
  elementos funcionales conservan contraste superior al del patrón.
- **REQ-003 — Vectorial y determinista:** El fondo se genera con primitivas
  vectoriales del PDF, sin imágenes raster, dependencias nuevas, aleatoriedad ni
  datos externos. La cantidad de trazos se limita al área de cabecera y se
  mantiene acotada por tamaño.
- **REQ-004 — Zonas funcionales protegidas:** El patrón se recorta al rectángulo
  interior de cabecera. El QR, sus módulos de silencio, fiduciales, burbujas
  OMR, cajas y campos de captura permanecen blancos o limpios según el tipo de
  lectura; el patrón nunca los sustituye ni dibuja dentro de ellos.
- **REQ-005 — Compatibilidad geométrica:** Se preservan coordenadas y
  dimensiones de todos los elementos funcionales, el comportamiento dúplex y el
  resto del diseño de la plantilla.

## Criterios de Aceptación

- La vista renderizada a tamaño de página muestra la malla y los rosetones con
  presencia visible y balanceada.
- El patrón se mantiene dentro de la cabecera en las variantes normal y densa,
  y sus trazos no aparecen sobre zonas blancas funcionales del QR, fiduciales,
  OMR o campos de escritura.
- Una comparación de layout antes/después confirma que no cambian las cajas de
  texto, QR, fiduciales, OMR ni el conteo de páginas.
- La salida sigue siendo vectorial y la cantidad de primitivas crece de forma
  acotada y proporcional al tamaño de la cabecera.
- Las pruebas visuales de PDF y los chequeos de colisiones del layout pasan.

## Matriz de Trazabilidad

| ID Requisito | Descripción del Caso | Archivo de Test Vinculado | Estado |
| --- | --- | --- | --- |
| REQ-001, REQ-002 | Rosetones, rombos y red diagonal; revisión de geometría y contraste rasterizado | `apps/backend/tests/pdf.layout.visual.guard.test.ts` | Implementado; 39/39 pruebas pasan |
| REQ-003, REQ-004 | Dibujo vectorial determinista y QR blanco legible | `apps/backend/tests/pdf.layout.visual.guard.test.ts`, `apps/backend/tests/pdf.paridad.test.ts` | Implementado; lectura QR y raster a 150/300 DPI pasan |
| REQ-005 | Snapshot de cajas funcionales y paginación antes/después | `apps/backend/tests/pdf.layout.visual.guard.test.ts` | Implementado; cajas y página idénticas en el fixture |

## Evidencia de implementación

- El patrón usa una malla facetada de diagonales, rombos abiertos, nodos y
  rosetones vectoriales de ocho pétalos en dos tonos azules. La opacidad es
  mayor que la versión anterior; la salida mantiene el área funcional en blanco.
- El test de control preserva las cajas de cabecera, QR, reactivo, burbujas y
  paginación. La prueba de rasterización decodifica QR en la salida renderizada.
- La impresión física y la captura OCR externa de texto sobre esta variante
  quedan pendientes; el QR y los fiduciales sí conservan sus reservas de alto
  contraste y los tests rasterizados de QR/OMR pasan.
