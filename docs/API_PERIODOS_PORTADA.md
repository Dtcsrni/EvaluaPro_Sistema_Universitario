# API de portada de materia

Prefijo: `/api/periodos`. Todas las rutas requieren una sesión autenticada de docente.

## Consultar una portada

`GET /api/periodos/:periodoId/portada`

Requiere `periodos:leer`. Devuelve los bytes como `image/webp`; la respuesta es privada y no cacheable. Devuelve `404` cuando la materia no existe para el docente o aún no tiene portada.

## Crear o reemplazar

`PUT /api/periodos/:periodoId/portada`

Requiere `periodos:gestionar`. Envía `multipart/form-data` con un solo archivo en el campo `archivo`.

- Formatos aceptados: JPG/JPEG (`image/jpeg`), PNG (`image/png`) y WebP (`image/webp`).
- Tamaño máximo original: 20 MiB (20 × 1024 × 1024 bytes).
- Dimensiones máximas: 20 megapíxeles.
- SVG, GIF, MIME no coincidente, imágenes animadas y contenido que no pueda decodificarse se rechazan.
- El servidor corrige la orientación EXIF, ajusta la imagen a 1600 × 1200 como máximo y la guarda como WebP sin conservar metadatos.

Una respuesta `200` incluye `{ ok, mimeType, sizeBytes, width, height }`. Los errores de formato o dimensión usan un código 4xx y no guardan datos.

## Retirar

`DELETE /api/periodos/:periodoId/portada`

Requiere `periodos:gestionar`. Es idempotente: devuelve `{ ok: true }` aunque la materia no tuviera portada. Una materia ajena o inexistente devuelve `404`.

## Listado

`GET /api/periodos` conserva el contrato existente y agrega `tienePortada: boolean`. Nunca incluye el BLOB de imagen.
