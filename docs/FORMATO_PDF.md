# Formato PDF y OMR

## Formato carta
- Tamaño: 216 x 279 mm (8.5 x 11 in).
- Margen seguro recomendado: 10 mm.
- Fuente limpia y alto contraste (baja tinta).

## Marcas de registro
- Líneas cortas en esquinas para corrección de perspectiva.
- Usadas por el pipeline OMR para alinear.

## QR por página
- QR en esquina superior derecha con quiet zone.
- Primera página incluye folio y página (ej. EXAMEN:ABC123:P1).

## Layouts
- Parcial: 2 páginas (1 hoja doble cara).
- Global: 4 páginas (2 hojas doble cara).

## Burbujas y opciones
- 5 opciones A-E con burbujas.
- Ubicación consistente para facilitar detección.
- Guardar `mapaVariante` para reconstruir orden real.

## OMR pipeline
1) Detectar QR y número de página.
2) Corregir perspectiva con marcas.
3) Segmentar zona de respuestas.
4) Detectar burbuja marcada.
5) Mostrar verificación manual al docente.
6) Guardar `mapaOmr` (posiciones exactas por página).
