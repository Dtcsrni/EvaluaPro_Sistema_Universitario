---
id: SPEC-132
titulo: Patron vectorial institucional de cabecera de examen
version: 1.0.0
fecha: 2026-11-05
autor: EvaluaPro Team
modulo: modulo_generacion_pdf
estado: implemented
---

## Contexto

La cabecera de referencia usa una base azul muy clara con un patrón geométrico
repetido de rombos y nodos, atravesado por diagonales finas que forman una red
amplia. El renderer actual dibuja una retícula sencilla mezclada con una roseta
central y micro-puntos uniformes; esa composición no reproduce la estructura,
el ritmo ni la distribución de la referencia.

Se busca recuperar el lenguaje visual reconocible del examen compartido y
refinarlo con trazos vectoriales de bajo contraste. El cambio se limita al fondo
decorativo de la cabecera. No cambia la composición de una columna, el número de
páginas, el contenido, los campos del alumno, la zona de calificación ni la
geometría de QR, fiduciales u OMR.

## Requisitos Funcionales

- **REQ-001 — Motivo fiel a la referencia:** La cabecera combina un campo azul
  pálido con una retícula repetida de rombos abiertos y nodos pequeños,
  diagonales largas de conexión y motivos geométricos secundarios distribuidos
  con ritmo regular. Se elimina la roseta/figura central que no aparece en la
  referencia.
- **REQ-002 — Refinamiento visual:** El patrón conserva la paleta azul de la
  referencia, añade variaciones sutiles de escala y densidad, y mantiene el
  contraste suficientemente bajo para no competir con texto, escudos o datos.
  No se agregan bloques de color saturado ni círculos decorativos aislados en
  los bordes.
- **REQ-003 — Vectorial y determinista:** El fondo se genera con primitivas
  vectoriales del PDF, sin imágenes raster, dependencias nuevas, aleatoriedad ni
  datos externos. La complejidad de dibujo no aumenta respecto al patrón actual.
- **REQ-004 — Zonas funcionales protegidas:** El patrón queda debajo de los
  componentes de cabecera y no invade el espacio blanco de QR, sus módulos de
  silencio, fiduciales, burbujas OMR, cajas de calificación ni campos de captura.
  Sus límites quedan recortados al rectángulo interior de la cabecera.
- **REQ-005 — Compatibilidad geométrica:** Se preservan coordenadas y
  dimensiones de todos los elementos funcionales, el comportamiento dúplex y el
  resto del diseño de la plantilla.

## Criterios de Aceptación

- La vista renderizada a tamaño de página muestra los rombos/nodos y la red
  diagonal de forma continua y balanceada, con mayor similitud a la referencia
  que la roseta central actual.
- El patrón se mantiene dentro de la cabecera en las variantes normal y densa,
  y sus trazos no aparecen sobre zonas blancas funcionales del QR, fiduciales,
  OMR o campos de escritura.
- Una comparación de layout antes/después confirma que no cambian las cajas de
  texto, QR, fiduciales, OMR ni el conteo de páginas.
- La salida sigue siendo vectorial y el número de primitivas decorativas no
  supera el del patrón previo para el mismo tamaño de cabecera.
- Las pruebas visuales de PDF y los chequeos de colisiones del layout pasan.

## Matriz de Trazabilidad

| ID Requisito | Descripción del Caso | Archivo de Test Vinculado | Estado |
| --- | --- | --- | --- |
| REQ-001, REQ-002 | Rombos, nodos y red diagonal con contraste tenue; revisión de la muestra rasterizada | `apps/backend/tests/pdf.layout.visual.guard.test.ts` | Implementado; render de control revisado |
| REQ-003, REQ-004 | Dibujo vectorial determinista y aislamiento de QR/OMR; comparación del operador PDF | `apps/backend/tests/pdf.layout.visual.guard.test.ts` | Implementado; la muestra pasó de 24,635 a 13,465 operadores de página y de 225,165 a 138,885 bytes |
| REQ-005 | Snapshot de cajas funcionales y paginación antes/después | `apps/backend/tests/pdf.layout.visual.guard.test.ts` | Implementado; cajas y página idénticas en el fixture |

## Evidencia de implementación

- El patrón nuevo reemplaza la roseta central y el micro-punteado por una malla
  facetada de diagonales, rombos abiertos y nodos pequeños en azul tenue. Sus
  coordenadas se calculan dentro del margen interior de cabecera y el código
  usa solo `drawLine` y `drawCircle`; no incorpora imágenes ni dependencias.
- En la misma muestra de control, la rasterización previa y posterior conserva
  exactamente la cabecera (32.34646, 590.65354, 547.30709, 173 pt), QR
  (418.64567, 643.93701, 107.71654, 119.71654 pt), caja del primer reactivo,
  cinco centros/radios de burbuja y el conteo de una página. No hubo colisiones.
- `npm ci` instaló el lockfile sin modificarlo. La generación documentada de
  Prisma y el typecheck backend pasaron con `npm --prefix apps/backend run typecheck`.
  ESLint de renderer/test, `npm run sdd:audit` y la suite final
  `npm --prefix apps/backend test -- --run tests/pdf.layout.visual.guard.test.ts
  --pool=forks --reporter=default` pasaron; esta suite tuvo 38/38 pruebas.
- La impresión dúplex física continúa pendiente. La comparación raster/PDF no
  acredita el comportamiento de tinta en papel.
