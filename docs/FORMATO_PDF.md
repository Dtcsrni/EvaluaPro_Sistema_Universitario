# Formato PDF y OMR

Especificacion operativa del formato de examen y su lectura OMR.

## Formato de pagina
- Carta US (`612x792 pt`).
- Margen configurable (default 8 mm, minimo operativo 4.5 mm).
- QR por pagina con texto obligatorio: `EXAMEN:<FOLIO>:P<n>:TV4`.
- Marcas de registro/fiduciales incluidas en layout canonico TV4 con paridad visual A050929D.
- Encabezado compacto con acentos de color y alta legibilidad para maximizar area util de preguntas por cara.
- La identidad visual del examen es canónica y compartida entre renderers:
  - paleta compacta A050929D
  - tipografía sans-serif neutra
  - numeradores, panel OMR, footer y cajas de captura con la misma semántica visual en preview, individual y lote

## Plantilla OMR soportada
- Plantilla operativa canonica: `TV4`.
- Auto-calificacion operativa sobre examenes generados en `TV4`.

## Mapa OMR persistido
Cada examen generado guarda `mapaOmr` con:
- `templateVersion: 4`
- QR por pagina (posicion y tamano)
- marcas de pagina
- preguntas por pagina
- opciones por pregunta con coordenadas exactas
- fiduciales por bloque OMR

Esto permite que el escaneo no dependa de OCR libre, sino de geometria conocida.

## Pipeline OMR actual
1. Decodifica imagen y normaliza colorimetria.
2. Detecta QR TV4 y valida consistencia con `mapaOmr`.
3. Elige transformacion geometrica (QR/homografia/escala) con heuristica de coherencia.
4. Ajusta centros por fiduciales y caja OMR.
5. Evalua burbujas por rasgos fotometricos e hibridos.
6. Clasifica respuesta por pregunta (opcion/confianza).
7. Calcula calidad de pagina y estado de analisis:
   - `ok`
   - `requiere_revision`
   - `rechazado_calidad`

## Criterios de salida OMR
- `respuestasDetectadas`: arreglo por pregunta.
- `confianzaPromedioPagina` y `ratioAmbiguas`.
- `calidadPagina` en rango `[0,1]`.
- `motivosRevision` y `advertencias` para trazabilidad.

## Consideraciones operativas
- OMR puede degradarse por desenfoque, distorsion severa, contraste pobre o recortes.
- El sistema mantiene modo de revision manual cuando la calidad no permite auto-calificar con seguridad.
- La calificacion final usa `mapaVariante` para comparar respuestas detectadas contra clave correcta real.
- El cache de preview PDF se invalida si cambia la plantilla, el banco de preguntas usado o la firma visual/layout del renderer.
