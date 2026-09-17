# Investigación técnica: QR resiliente para OMR v4

Fecha de corte: 2026-09-11
Alcance: plantilla canónica `TV4`, PDF Letter, Epson EcoTank L1250 y captura de hoja completa con celular.

## Conclusión

El QR debe ser un identificador firmado, compacto y aislado físicamente, usado junto con los cuatro fiduciales de página para rectificar la fotografía. La configuración adoptada es:

- negro sobre blanco, corrección `H`, matriz observada `53 × 53`;
- símbolo de `28 mm`, padding físico blanco de `3 mm` por lado y quiet zone interna de `4` módulos;
- PNG a escala entera `24`, sin interpolación ni decoraciones sobre el símbolo;
- tarjeta de `34 mm`, separada del fiducial superior derecho por `4 pt` extra además de sus reservas;
- payload compacto con `HMAC-SHA-256` truncado a 24 hexadecimales, versión, folio, página, variante, hash de clave y clave visible de página;
- detección por imagen original, gris, cuatro umbrales, inversión, recorte superior derecho, ampliación nearest-neighbor 2× y región candidata;
- aceptación geométrica por forma, área, proporción, tamaño y posición; homografía QR solo desde calidad `0.72`.

No puede afirmarse una tasa de cámara sin un lote físico. El manifest de piloto está vacío (`captureCount: 0`), por lo que impresión y celular siguen `not_applicable`; el validador deja esta condición registrada en `reports/qa/latest/omr/canonical-pilot-real-validation.json` y no la convierte en una aprobación.

## Fuentes primarias

- [DENSO WAVE: estructura y quiet zone](https://www.qrcode.com/en/howto/code.html): cuatro módulos de zona de silencio.
- [DENSO WAVE: corrección de errores](https://www.qrcode.com/en/about/error_correction.html/index.html): Reed–Solomon y niveles L/M/Q/H.
- [DENSO WAVE: tamaño de módulo](https://www.qrcode.com/en/howto/cell.html): módulos grandes y al menos cuatro puntos por módulo.
- [DENSO WAVE: problemas de lectura](https://www.qrcode.com/en/howto/trouble.html): distorsión, escalado y objetos cercanos reducen lectura.
- [Epson L1250 User's Guide](https://files.support.epson.com/docid/cpd6/cpd61841.pdf): margen mínimo documental de 3 mm y riesgo de expansión sin bordes.
- [ISO/IEC 18004:2024](https://www.iso.org/standard/83389.html): simbología, codificación, corrección y calidad.
- [OpenCV QRCodeDetector](https://docs.opencv.org/4.13.0/javadoc/org/opencv/objdetect/QRCodeDetector.html) y [ejemplo oficial](https://github.com/opencv/opencv/blob/4.x/samples/cpp/qrcode.cpp): referencia de detección y decodificación en perspectiva.

## Estado implementado y trazable

`apps/backend/src/modulos/modulo_generacion_pdf/domain/qrExamen.ts` genera por página:

`EXAMEN:<folio>:P<página>:TV4:ID:<id>:KI:<key-id>:TQ:<total>:QD:<desde>:QH:<hasta>:VH:<variante>:AK:<clave>:K:<clave-visible>:SG:H1<firma>`

La firma usa el secreto asociado a `KI`, comparación de tiempo constante y nunca expone secretos. `K` permite reconstruir la clave visible de página; `VH` y `AK` detectan variante o clave incompatible; el manifest/bundle conserva la recuperación completa.

El renderer usa `qrcode`, `H`, negro/blanco, margen modular `4` y PNG a escala entera. El detector `jsQR` valida el texto decodificado contra geometría y tamaño antes de usarlo como referencia.

## Geometría medida de la salida QA

La salida `output/qa/omr-tv4-epson-25-rich-capacity.pdf` y su mapa reportan:

| Parámetro | Valor |
|---|---:|
| Página | Letter, `612 × 792 pt` |
| Símbolo | `28 mm` |
| Padding exterior | `3 mm` por lado |
| Huella de tarjeta | `34 mm` |
| Matriz | `53 × 53` |
| Módulos totales | `61 × 61` (`53 + 2×4`) |
| Módulo físico | `28/61 = 0.459 mm` |
| Densidad estimada a 300 dpi | `6.00 dots/module` |
| Fiducial | `7 mm` sólido |
| Separación QR–fiducial | `4 pt` extra más quiet zones |

`dots/module = 0.508 mm × 300 dpi / 25.4 = 6.00 dots/module`.

Es una estimación del PDF previa a impresión; durante el piloto deben registrarse papel, calidad y escala del diálogo de la L1250. El margen de plantilla de 10 mm excede el mínimo documental de Epson.

## Decisiones técnicas

### Corrección H y payload compacto

`H` mejora tolerancia a daño, pero puede aumentar la matriz. El QR no contiene preguntas ni la clave completa: esos datos permanecen en el manifest firmado. No se recomiendan logos, colores, iconos, transparencias, overlay ni texto dentro del símbolo.

### Tres capas de aislamiento

1. quiet zone interna de cuatro módulos generada por la librería;
2. padding blanco físico de 3 mm dentro de la tarjeta;
3. separación geométrica respecto de fiduciales y otros objetos.

La tercera capa evita que un fiducial vecino parezca unido al QR bajo blur.

### Cascada móvil conservadora

Se prueban original, gris, umbrales `120/145/170/195`, inversión, recorte superior derecho, nearest-neighbor 2× y región candidata. El QR no se acepta solo por texto: debe superar controles de área, forma, proporción y tamaño. La autocalificación exige además encuadre, cobertura, calidad, firma y respuestas no ambiguas.

## Umbrales iniciales

Son valores calibrables, no resultados de piloto:

| Señal | Automático | Revisión | Rechazo/paro |
|---|---:|---:|---:|
| confianza geométrica | `≥ 0.72` | `0.52–0.719` | `< 0.52` |
| calidad de página | `≥ 0.68` | `0.52–0.679` | `< 0.52` |
| confianza OMR media | `≥ 0.68` | `0.58–0.679` | `≤ 0.30` |
| cobertura | `≥ 0.60` | `0.45–0.599` | `< 0.45` |
| ambiguas | `≤ 0.10` | `0.10–0.40` | `> 0.40` |
| HMAC | válida | secreto recuperable pendiente | inválida |
| folio/página | exactos | QR ausente, mapa consistente | conflicto |

Una señal no puede compensar firma inválida, conflicto de folio o geometría no confiable.

## Cambios implementados en esta iteración

- escuela, motto, título, materia y docente sobre fondo geométrico, sin caja central independiente;
- patrón geométrico visible sin ocupar QR, texto ni fiduciales;
- slots de logos ampliados a `54 × 54 pt` con guardas;
- fallback de detección alineado de `33/2 mm` a `31/3 mm`;
- símbolo de `28 mm`, padding `3 mm`, huella constante `34 mm`;
- raster QR con escala entera `24` y guarda QR–fiducial;
- holgura de planificación de `2 pt` para evitar discrepancias por redondeo;
- muestra rica consistente en 25 reactivos: negritas, cursivas, subrayados, subíndices, superíndices, LaTeX, JS, fórmula SVG y diagrama SVG.

La QA sintética posterior cubrió seis capturas con perspectiva leve (`60`
respuestas, exactitud `1.0`, inválidas rechazadas `1.0`) y seis perfiles de
degradación fotográfica (`360` evaluaciones, exactitud `1.0`, inválidas
rechazadas `1.0`). Estos resultados no sustituyen el piloto con hojas
impresas.

## Protocolo físico pendiente

1. Imprimir al menos 30 hojas de dos páginas con Epson EcoTank L1250.
2. Registrar papel, calidad, escala, tinta y fecha.
3. Capturar cada hoja completa con tres celulares, tres distancias y tres ángulos leves.
4. Incluir luz uniforme, sombra, blur leve, JPEG, inclinación y recorte parcial controlado.
5. Guardar original, SHA-256, mapa, resultado QR, homografía, respuestas, flags y decisión.
6. Medir `QR detection recall`, `payload exact match`, `page identification accuracy`, `fiducial detection`, `answer accuracy`, `false auto-grade rate` y `review rate`.
7. Separar calibración y evaluación; no reutilizar capturas.
8. Liberar solo si el límite inferior del intervalo de confianza cumple el objetivo y los falsos positivos quedan en el límite aprobado.

Mientras no existan capturas, `npm -C apps/backend run omr:validate:pilot-real` genera un informe `not_applicable` con causa `capture_count_zero` y termina con código distinto de cero. Ese resultado es deliberado: impide declarar validación física sin evidencia.

Debe incluirse una hoja mal impresa y otra con QR parcialmente degradado. La respuesta ante evidencia insuficiente es `requiere_revision` o recuperación desde manifest, nunca adivinar.

## Riesgos y evolución

- La rasterización del PDF no demuestra robustez de una hoja impresa ni de una cámara.
- Papel, tinta y calidad pueden suavizar o desplazar el bitmap.
- La firma autentica contenido, pero no sustituye la cadena de custodia.
- Structured Append no es apropiado para una foto única; cada página debe ser autocontenida.
- OpenCV puede incorporarse como benchmark o segundo backend, pero no debe crear dos políticas de confianza divergentes.
- Cada cambio debe versionar el contrato, registrar `templateVersion`, `keyId`, `engineVersion`, geometría y hashes, regenerar dataset sintético y repetir la matriz física.

La mejora de mayor valor siguiente es ejecutar el piloto físico. Con esas mediciones se decidirá si conviene mantener 31 mm, volver a 33 mm, modificar payload, añadir OpenCV o ajustar umbrales.
