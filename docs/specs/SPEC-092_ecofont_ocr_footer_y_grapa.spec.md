---
id: SPEC-092
titulo: Ecofont, referencias OCR y pie de pagina seguro para engrapado
version: 1.0.0
fecha: 2026-10-12
autor: Codex
modulo: modulo_generacion_pdf
estado: approved
---

## Contexto

El renderizador OMR embebe Ecofont Vera Sans y asigna esa misma fuente a texto normal,
negritas, cursivas y monoespaciado. Las referencias de folio y pagina del pie tambien
usan Ecofont. La prueba existente verifica runs de texto de preguntas, pero no distingue
el tipo de letra del texto OCR ni recorre todos los recursos tipograficos del documento.

El pie actual imprime dos referencias OCR pequenas y un identificador compuesto adicional.
Ese identificador cae dentro de la segunda region que `ocrPieOmr` recorta para OCR, agrega
ruido a la lectura y duplica datos internos. La zona de engrapado ya tiene validaciones
geometricas, pero la regresion solo comprueba la separacion respecto al fiducial de la
primera pagina y no explicita la cobertura de todos los fiduciales en el frente y reverso.

## Requisitos Funcionales

- REQ-001: Todo texto visible destinado a lectura humana en cada pagina del examen conserva
  Ecofont Vera Sans incrustada: encabezados, metadatos, instrucciones, preguntas, opciones,
  etiquetas OMR y decoracion textual. La excepcion se limita a las referencias seriales
  que consume el OCR del pie.
- REQ-002: Las dos referencias OCR del pie usan Helvetica (fuente PDF Standard 14) en lugar
  de Ecofont, con alto contraste, linea base estable y tamano minimo de 8.5 pt. Imprimen la
  forma `FOLIO <identificador> · Pagina N de TOTAL`; `ocrPieOmr` reconoce el prefijo y N,
  conserva las dos regiones de lectura y mantiene el consenso independiente entre ambas.
  Si un folio admitido no cabe a ese tamano, el renderizador devuelve un error de layout
  explicito.
- REQ-003: El pie elimina el identificador compuesto redundante de las regiones OCR y
  presenta solo la referencia que necesita el lector para resolver folio y pagina. Las dos
  copias ocupan zonas balanceadas existentes, separadas por una regla fina y con un fondo
  blanco limpio; no incluyen texto adicional dentro de las regiones OCR.
- REQ-004: El pie ofrece jerarquia clara entre folio y pagina, alineacion consistente,
  contraste de impresion y separacion visual del examen con tinta moderada, sin invadir
  margenes, marcas de esquina, fiduciales, zonas tranquilas, marcas OMR ni la zona segura
  de impresion.
- REQ-005: En cada pagina de examen y cada lado de impresion duplex, la reserva de grapa y
  su margen de seguridad no intersectan ningun fiducial ni su zona tranquila. En reverso,
  la comprobacion refleja correctamente la reserva respecto al borde de encuadernacion.
  La validacion debe cubrir tambien todos los fiduciales de pagina y los casos limite de
  reserva desplazada; un solape rechaza el layout antes de devolver el PDF.

## Criterios de Aceptación

1. Una prueba de PDF confirma que el texto humano conserva Ecofont en preguntas, opciones,
   instrucciones, encabezado y etiquetas; confirma que ambas referencias seriales usan la
   fuente OCR separada y que no hay un tercer serial en sus regiones.
2. El PDF declara/usa las fuentes esperadas al inspeccionar sus recursos; una fuente de
   sustitucion accidental en texto humano o Ecofont en las referencias OCR hace fallar la
   prueba.
3. La extraccion de texto conserva dos cadenas OCR iguales por pagina con folio y numero
   de pagina, y las pruebas de OCR aceptan la cadena generada y rechazan una referencia
   ambigua o duplicada dentro de una misma zona.
4. El pie cabe para el folio de longitud maxima admitido a 8.5 pt o falla explicitamente;
   las dos referencias `FOLIO <identificador> · Pagina N de TOTAL` quedan en zonas balanceadas sobre fondo
   blanco, sin otro serial dentro de sus recortes OCR ni solape con marcas de esquina,
   fiduciales, codigos OMR o el borde inferior.
5. Las pruebas geometricas recorren paginas de anverso y reverso, verifican quiet zones de
   cada fiducial, reserva de grapa y margen de seguridad; la prueba visual renderizada en
   carta confirma que la grapa no oculta ni recorta fiduciales y que el pie es legible.
6. El examen mantiene sus paginas Carta y su identidad OMR; `detectarColisionesDuplexOmr`
   no informa nuevas colisiones.

## Matriz de Trazabilidad

| ID Requisito | Descripcion del Caso | Archivo de Test Vinculado | Estado |
| --- | --- | --- | --- |
| REQ-001, REQ-002 | Recursos de fuente usados por cada página; Ecofont para texto humano y exactamente dos usos Helvetica para OCR | `apps/backend/tests/pdf.ecofont.test.ts` | Completado; todas las páginas de examen verificadas |
| REQ-002, REQ-003 | Dos referencias independientes, total real de páginas y OCR sin serial compuesto; PDF generado rasterizado y leído con Tesseract español local | `apps/backend/tests/pdf.layout.visual.guard.test.ts`; `apps/backend/tests/omr.ocrPie.test.ts`; `apps/backend/tests/pdf.omr.ocr.e2e.test.ts` | Pendiente: la E2E real devuelve null para el pie generado; no se considera aprobado |
| REQ-004 | Bounds, no-solapes y render visual del pie en página Carta | `apps/backend/tests/pdf.layout.visual.guard.test.ts` | Completado; renderizado de anverso y reverso revisado |
| REQ-005 | Grapa separada de cada fiducial y quiet zone en anverso y reverso | `apps/backend/tests/pdf.ink-sparing-staple.test.ts` | Completado; 4 esquinas por página con márgenes de seguridad |

## Resultado de Implementacion

- Validacion de este corte: `app.cors.test.ts` y `inicialesAlumno.test.ts`, 7/7;
  `integracion/examenesLotesApi.test.ts`, 3/3; `git diff --check`, aprobado.
- Pendiente bloqueante: `pdf.omr.ocr.e2e.test.ts` genera y rasteriza un examen, pero
  Tesseract no logra consensuar el folio y la pagina del pie. No se rebajo el umbral de
  confianza ni se declara cumplido REQ-002/003. La E2E de instalacion Windows tambien
  sigue pendiente de CI verde.
- QA visual: el raster de Carta confirma posicion y separacion del pie; no es evidencia
  de lectura OCR efectiva ni de impresion/escaneo fisico.
- No se genero ni publico un lote de examenes como parte de esta correccion.
