---
id: SPEC-042
titulo: Estudio de Diseño de Exámenes y Producción Masiva con Folios Únicos
version: 1.13.0
fecha: 2026-09-02
autor: Antigravity / EvaluaPro Team
modulo: modulo_diseno_examenes
estado: implemented
---

## Contexto
Maquetación de la estructura del examen por temas y producción masiva de paquetes PDF con folios únicos, códigos QR institucionales y hojas de burbujas OMR.

## Requisitos Funcionales
- **REQ-001 (Maquetación OMR)**: Configuración de materia, temas y estimación de reactivos.
- **REQ-002 (Generación Masiva)**: Creación de lotes con folios y códigos QR individuales por alumno.
- **REQ-003 (Custodia e Historial)**: Descarga de ZIP/PDF, regeneración y trazabilidad forense.
- **REQ-004 (Layout PDF Imprimible)**: El PDF debe reservar espacio suficiente entre encabezado, instrucciones y primer reactivo; ningún texto de pregunta puede invadir el encabezado ni la caja de instrucciones.
- **REQ-005 (Referencia Visual OMR)**: El PDF debe conservar una jerarquía visual consistente con la referencia aprobada: bloque de indicaciones separado, preguntas legibles en dos columnas de opciones y panel OMR visible con identificador de pregunta.
- **REQ-006 (Densidad y tipografía configurable)**: La pantalla de diseño debe permitir elegir el tamaño de fuente y el espaciado de línea. El motor debe aplicar esos valores de forma consistente a la medición y al dibujo, conservando entre 10 y 15 preguntas por página cuando la combinación de contenido y páginas lo permita; si no es posible, debe reportar el ajuste sin producir solapes.
- **REQ-007 (Cabecera institucional)**: La cabecera debe reservar slots estables para los logotipos configurados del docente, mostrar institución, lema, materia y campos del alumno sin sobreposiciones, y conservar una zona silenciosa alrededor de los elementos OMR.
- **REQ-008 (Jerarquía editorial de cabecera)**: La primera página debe presentar una cabecera de dos niveles: franja institucional de alto contraste, bloque central de título/metadatos y banda inferior para datos del alumno. Los logos deben ocupar slots simétricos, el QR debe permanecer aislado en su reserva blanca y todos los textos deben conservar contraste, alineación y separación verificables al renderizar a 300 DPI.
- **REQ-009 (Aprovechamiento de continuación)**: En páginas posteriores, la reserva superior del QR no debe desplazar innecesariamente todo el contenido hacia abajo. El primer reactivo puede utilizar la zona superior izquierda con ancho limitado para no invadir el QR, mientras su panel OMR se coloca en la columna derecha, debajo de la reserva QR y separado del texto; los reactivos siguientes deben recuperar el layout normal, con geometría registrada y sin colisiones.
- **REQ-010 (Ritmo vertical)**: Cuando una página tenga sobrante vertical después de colocar sus reactivos, el motor debe distribuirlo entre los separadores de los bloques para aprovechar el área imprimible, sin superar una separación máxima editorial ni afectar el área segura inferior.
- **REQ-011 (Escala tipográfica de cabecera)**: Al aumentar la escala tipográfica configurada, la cabecera debe conservar separación visual entre institución, título, lema, metadatos y campos del alumno; el ajuste no debe generar colisiones ni recortes.
- **REQ-012 (Campos de captura de cabecera)**: Las líneas de nombre y grupo deben permanecer en una banda propia, debajo de los metadatos, sin atravesar texto ni confundirse con las líneas decorativas del bloque central.
- **REQ-013 (Versión OMR única)**: La generación, previsualización, escaneo, calificación y recuperación deben usar exclusivamente el contrato OMR moderno canónico. Deben eliminarse ramas, tipos, rutas, scripts, fixtures y datasets de versiones anteriores; los valores de versión distintos del contrato canónico deben rechazarse explícitamente.
- **REQ-014 (Política de identidad de versiones)**: El contrato OMR canónico debe tener una identidad única, estable y visible (`OMR canónico · v4` / `omr-canonical-v4`) distinta de la versión de la aplicación. Todo artefacto, payload, reporte, endpoint de versión y superficie de la GUI que determine o muestre el flujo OMR debe declarar esa identidad; ningún componente puede seleccionar una versión por nombre de archivo, valor `latest` o fallback silencioso. Las versiones antiguas o desconocidas deben rechazarse en los límites de generación, escaneo, calificación, recuperación y carga de datasets.
- **REQ-015 (Composición geométrica cerrada)**: En la primera página, la reserva exterior completa del QR y los slots de logotipos deben quedar contenidos dentro de la cabecera; ninguna regla decorativa puede intersectar los bloques tipográficos. Las marcas de registro, reservas OMR y elementos de identidad deben permanecer dentro del área imprimible, con quiet zones conservadas.
- **REQ-016 (Contenido completo de cabecera)**: La institución, título, lema y metadatos no deben truncarse silenciosamente. Si el ancho disponible no basta, el renderer debe envolver las líneas y ampliar la cabecera de forma controlada, manteniendo los campos de captura, instrucciones, área imprimible y densidad del examen sin solapes.
- **REQ-017 (QR canónico resiliente)**: El QR debe generarse con corrección de errores alta, quiet zone completa y escala raster entera; el detector debe buscar únicamente la reserva física del QR canónico y rechazar firmas que no sean HMAC del contrato activo.
- **REQ-018 (Balance de páginas excedentes)**: Si el contenido no cabe en el número de páginas solicitado, el renderer debe conservar la legibilidad y repartir los reactivos entre las hojas adicionales, evitando concentrar contenido en una página y dejar otra anormalmente vacía.
- **REQ-019 (Geometría OMR única)**: El ancho de la caja OMR, el diámetro de las burbujas, la separación de sus centros y el desplazamiento etiqueta-burbuja deben proceder del mismo perfil canónico que se persiste en el mapa. No se admiten valores alternos entre dominio, renderer y detector.
- **REQ-020 (Tolerancias de impresión y captura)**: Cada panel OMR debe conservar un borde seguro interior, quiet zones de fiduciales, burbujas completamente contenidas y separación positiva entre burbujas, fiduciales, encabezado y texto. Las invariantes deben comprobarse con coordenadas PDF y con el PDF rasterizado a 150 y 300 DPI.
- **REQ-021 (Contrato de centros de respuesta)**: La plantilla canónica debe declarar explícitamente que las cinco opciones se imprimen en una fila horizontal, con centros equidistantes. El mapa debe conservar el paso horizontal real de los centros para que el detector y sus rutas de rescate no infieran una geometría vertical inexistente.

## Criterios de Aceptación
1. El asistente de diseño permite seleccionar materias, temas y distribución de preguntas para el examen.
2. La generación masiva produce folios únicos y códigos QR diferenciados por alumno con barra de progreso interactiva.
3. El historial de lotes mantiene la custodia y permite la descarga de paquetes ZIP/PDF generados.
4. Las pruebas de generación masiva y maquetación de plantillas quedan validadas.
5. La primera pregunta de cada PDF comienza debajo del encabezado y de las instrucciones, sin solapes visuales.
6. El bloque de indicaciones aparece separado del encabezado y los paneles OMR mantienen un identificador legible sin invadir las burbujas.
7. Cambiar tamaño de fuente o espaciado en el formulario se refleja en la previsualización y en la generación real, con validación geométrica de la página.
8. La cabecera usa los logotipos configurados cuando existen y mantiene alineación, márgenes y separación verificables.
9. La cabecera presenta una jerarquía visual estable, no contiene colisiones entre textos, logos, QR o campos, y mantiene legibilidad humana en una muestra PDF renderizada a 300 DPI.
10. Las páginas de continuación aprovechan la zona superior libre sin invadir el QR: el primer reactivo y su panel OMR quedan separados, los siguientes conservan su composición y el reparto de preguntas no se degrada.
11. Una página con pocos reactivos no concentra todo el contenido en la parte superior: el sobrante vertical se reparte de forma uniforme y verificable entre los reactivos, manteniendo legibilidad y márgenes seguros.
12. La cabecera conserva separación entre sus líneas cuando `fontScale` aumenta y el PDF completo sigue generándose sin colisiones.
13. Las líneas de “Nombre del alumno” y “Grupo” tienen una reserva geométrica propia y no intersectan metadatos, lema, título ni decoración central.
14. El código activo no contiene ramas operativas ni datasets de TV1/TV3; la plantilla canónica es la única aceptada por generación, escaneo, calificación y recuperación.
15. Las pruebas sintéticas y de layout usan únicamente el dataset y contrato canónicos, y las referencias históricas eliminadas no aparecen en código activo, scripts ni documentación operativa.
16. La política de versiones declara una única versión OMR canónica y la comprobación automática falla si el contrato del backend, la GUI, los metadatos o los datasets activos divergen.
17. La GUI docente muestra de forma persistente el contrato activo `OMR canónico · v4` y, por separado, la versión de la aplicación; el centro de versión explica que las versiones antiguas no son operativas.
18. Una entrada OMR con versión distinta de 4, ausente o no reconocida no puede continuar por una ruta de compatibilidad o degradación silenciosa.
19. La reserva completa del QR de primera página queda dentro del rectángulo de cabecera, ambos slots de logos quedan contenidos y ninguno invade el QR.
20. La decoración de cabecera no atraviesa institución, título, lema, metadatos ni campos de captura; las pruebas geométricas fallan ante un solape.
21. Las marcas de registro y sus quiet zones no salen del área de página ni se recortan por el borde nominal.
22. Una cabecera larga conserva todas sus líneas visibles, aumenta su altura solo cuando es necesario y mantiene bloques, campos, QR, instrucciones y reactivos sin colisiones.
23. El QR generado conserva una reserva física de 31 mm, corrección de errores `H`, quiet zone de 4 módulos y firma HMAC; el detector no utiliza tamaños ni firmas históricas como ruta operativa.
24. Un examen que requiere una página adicional no deja una última hoja desproporcionadamente vacía cuando la capacidad física permite un reparto equilibrado.
25. El perfil OMR persistido coincide exactamente con las dimensiones usadas para dibujar cada panel; en particular, el ancho de caja y la separación etiqueta-burbuja no divergen entre capas.
26. Cada panel contiene cinco burbujas en una fila horizontal equidistante; cada círculo y su quiet zone quedan dentro del panel, sin intersección con fiduciales, borde ni texto.
27. Las pruebas de rasterización a 150 y 300 DPI conservan las marcas de registro, fiduciales y burbujas distinguibles sin recortes ni componentes fuera de su reserva geométrica.

## Matriz de Trazabilidad

| ID Requisito | Descripción del Caso | Archivo de Test Vinculado | Estado |
| --- | --- | --- | --- |
| REQ-001 | Formulario de diseño y catálogo de plantillas | `apps/frontend/tests/plantillas.refactor.test.tsx` | Completado |
| REQ-002 | Producción masiva con barra de progreso | `apps/frontend/tests/plantillasGenerados.test.tsx` | Completado |
| REQ-003 | Regeneración e historial de lotes | `apps/backend/tests/controladorListadoGenerados.regenerar.test.ts` | Completado |
| REQ-004 | Primera pregunta debajo del encabezado y sin invasión de instrucciones | `apps/backend/tests/pdf.layout.visual.guard.test.ts` | Completado |
| REQ-005 | Jerarquía visual de indicaciones, opciones y panel OMR | `apps/backend/tests/pdf.layout.visual.guard.test.ts` | Completado |
| REQ-006A | Configuración de tipografía y densidad | `apps/backend/tests/pdf.layout.visual.guard.test.ts` | Completado |
| REQ-006B | Propagación de configuración a preview/generación | `apps/frontend/tests/plantillas.refactor.test.tsx` | Completado |
| REQ-007 | Cabecera institucional con slots de logos y guardas geométricas | `apps/backend/tests/pdf.layout.visual.guard.test.ts` | Completado |
| REQ-008 | Jerarquía editorial, contraste y colisiones de la cabecera | `apps/backend/tests/pdf.layout.visual.guard.test.ts` | Completado |
| REQ-009 | Uso de espacio superior en páginas de continuación sin colisiones | `apps/backend/tests/pdf.layout.visual.guard.test.ts` | Completado |
| REQ-010 | Distribución vertical del sobrante sin superar el ritmo editorial | `apps/backend/tests/pdf.layout.visual.guard.test.ts` | Completado |
| REQ-011 | Adaptación de cabecera a escala tipográfica sin colisiones | `apps/backend/tests/pdf.layout.visual.guard.test.ts` | Completado |
| REQ-012 | Separación geométrica de campos de nombre y grupo | `apps/backend/tests/pdf.layout.visual.guard.test.ts` | Completado |
| REQ-013 | Contrato OMR canónico único sin compatibilidad histórica | `apps/backend/tests/pdf.paridad.test.ts` | Completado |
| REQ-014 | Identidad única, marcado visible y rechazo de versiones antiguas | `scripts/tests/omr-version-policy.test.mjs` | Completado |
| REQ-015 | Contención QR/logos, decoración sin solapes y margen de registro | `apps/backend/tests/pdf.layout.visual.guard.test.ts` | Completado |
| REQ-016 | Envolvimiento de cabecera larga sin truncamiento silencioso | `apps/backend/tests/pdf.layout.visual.guard.test.ts` | Completado |
| REQ-017 | QR canónico resiliente y sin rutas históricas | `apps/backend/tests/qr.examen.test.ts` | Completado |
| REQ-018 | Reparto equilibrado cuando se excede el objetivo de páginas | `apps/backend/tests/pdf.layout.visual.guard.test.ts` | Completado |
| REQ-019 | Perfil OMR único entre dominio, renderer y mapa persistido | `apps/backend/tests/pdf.layout.visual.guard.test.ts` | En validación |
| REQ-020 | Bordes seguros, quiet zones y separación geométrica/raster | `apps/backend/tests/pdf.layout.visual.guard.test.ts` | En validación |
| REQ-021 | Paso horizontal explícito de centros de respuesta | `apps/backend/tests/pdf.layout.visual.guard.test.ts` | En validación |
