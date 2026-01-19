# Flujo de examen

## 1) Crear banco de preguntas
- Docente crea preguntas con 5 opciones y 1 correcta.
- Se guarda versión actual y se permite versionado futuro.

## 2) Crear plantilla de examen
- Se define tipo (parcial/global), titulo e instrucciones.
- Se asocian preguntas del banco.

## 3) Generar exámenes imprimibles
- Se aleatoriza orden de preguntas y opciones.
- Se genera PDF carta con QR por página.
- Se guarda `mapaVariante` para reconstruir respuestas correctas.

## 4) Imprimir
- Impresión a doble cara según tipo:
  - Parcial: 1 hoja (2 páginas).
  - Global: 2 hojas (4 páginas).

## 5) Vincular al recibir
- Se escanea QR de la primera página.
- Se busca alumno y se vincula examen -> alumno.
- Estado cambia a ENTREGADO.

## 6) Escaneo OMR
- Captura desde celular o cámara.
- Se detecta QR y página.
- Se corrige perspectiva con marcas.
- Se detectan burbujas y se genera vista de verificacion.
- Docente puede ajustar respuestas antes de calificar.

## 7) Calificar
- Se compara con clave real según `mapaVariante`.
- Calificacion exacta:
  - calificación = (aciertos * 5) / totalReactivos
  - bono máximo 0.5, calificación final tope 5.0
- Parcial/global: 5 examen + 5 evaluacion continua o proyecto (tope 10).
- Banderas de revisión solo como sugerencias (sin acusaciones automáticas).

## 8) Publicar y portal alumno
- Docente publica resultados hacia nube.
- Alumno consulta resultados en portal siempre disponible.
- Codigo de acceso con vigencia 12h y un solo uso.
- Acceso alumno: codigo + matricula.

## 9) Exportar CSV
- Exportacion CSV sin dependencias de Excel.
- Endpoint: `GET /api/analiticas/calificaciones-csv?periodoId=...`.
- Columnas por defecto: `matricula,nombre,grupo,parcial1,parcial2,global,final,banderas`.
