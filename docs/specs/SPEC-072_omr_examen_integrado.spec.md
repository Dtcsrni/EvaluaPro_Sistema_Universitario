---
id: SPEC-072
titulo: Plantilla candidata de examen con OMR integrado por opcion
version: 0.3.0
fecha: 2026-09-30
autor: EvaluaPro Team
modulo: modulo_escaneo_omr, modulo_generacion_pdf
estado: approved
---

## Contexto

El benchmark externo y la evidencia local no justifican la calificacion
automatica actual. La auditoria completa Wild-OMR obtuvo 69.18% de examenes
exactos con DWSNAP en sus 769 capturas; el estrato de escaner plano dio 28/30,
pero solo corresponde a 30 hojas fisicas A4 de 5 mm y no replica EvaluaPro.
El corpus fotografico local carece de examenes completos con etiquetas
independientes adjudicadas.

Esta candidata conserva la respuesta **dentro de cada pregunta del propio
examen**. No agrega hoja de respuestas, matriz final ni transferencia de
respuestas. Cada opcion A–E tendra un circulo OMR inmediatamente al lado de su
texto. El motor podra leer las coordenadas por pagina/reactivo/opcion desde el
mapa ligado al QR. La plantilla experimental omr-inline-exam-v1 y el motor
evaluapro-omr-qr mantienen versionado separado de la aplicacion; el motor
sigue en 1.0.0-dev.3. Una futura dev.4 requiere una especificacion aprobada
y medicion completa. TV4 queda sin cambios como control y la lectura manual
sigue siendo la unica fuente de calificaciones hasta superar el gate.

La hipotesis principal es reducir el espacio entre la opcion impresa y su
burbuja, sin invadir el interior OMR: la marca se asocia directamente con el
texto elegido y se elimina el error de transcripcion a otra hoja. La region
blanca alrededor de cada circulo evita que el texto, reglas, imagenes o
elementos editoriales contaminen la medicion de tinta.

## Requisitos Funcionales

- **REQ-001 — Versionado aislado:** La plantilla candidata tendra ID,
  version y fingerprint propios. El motor mantendra version SemVer separada
  tanto de la aplicacion como de la plantilla. Ningun mapa TV4 se interpretara
  con la geometria nueva ni se permitira fallback silencioso.
- **REQ-002 — OMR dentro del examen:** Cada pregunta imprimira sus cinco
  opciones y una burbuja de respuesta junto a cada opcion en la misma pagina y
  bloque de pregunta. No se generara hoja/matriz OMR separada ni se exigira
  transcribir respuestas. Se conserva el orden A–E asociado al texto aprobado.
- **REQ-002A — Asociacion directa y legible:** La burbuja precedera a la
  etiqueta/texto de su opcion en una linea de opcion propia. Si el texto ocupa
  varias lineas, solo la burbuja de esa opcion se alinea con su primera linea;
  la siguiente opcion comienza tras el bloque completo. Se conserva el
  identificador visible de pregunta y su orden. No se reduce la fuente por
  debajo del minimo aprobado ni se corta stem/opcion para forzar densidad.
- **REQ-003 — Celda OMR con zona limpia:** Dimensiones iniciales candidatas:
  circulo vacio de 8 mm, filas de opcion con paso vertical objetivo de
  10.5 mm cuando no haya texto multilínea, y al menos 3 mm libres entre el
  borde exterior de la burbuja y el texto. Las letras A–E quedan fuera del
  circulo. Dentro de su region de lectura no habra texto, lineas, sombreados,
  imagenes ni fondos. El mapa persistira coordenadas y radio por opcion, no
  coordenadas inferidas por indexado de un rectangulo fijo. El espacio entre
  opcion multilínea puede variar; su centro exacto se registra en el mapa.
- **REQ-004 — Fiduciales de pagina comparables:** Evaluar dos familias sobre
  paginas identicas en contenido: (A) cuatro AprilTag 36h11 codificados, ID
  distinto por esquina, 18 mm iniciales y quiet zone minima de 2 mm; (B)
  cuatro cuadrados negros de 7 mm con quiet zone y señal asimetrica de
  orientacion, como control compatible con TV4. Medir localizacion, orientacion,
  escala, falsos positivos y perdida de deteccion por dispositivo/condicion.
  OpenCV 5.0 incluye DICT_APRILTAG_36h11 (6x6 bits, distancia Hamming
  minima 11, 587 codigos), pero el orden de esquinas AprilTag difiere del
  orden ArUco y del detector AprilTag nativo; la orientacion se debe verificar
  expresamente. El upstream AprilTag 3 recomienda tagStandard41h12 para uso
  general y declara soporte oficial solo Linux. Por ello, 36h11 es un
  comparador compatible con OpenCV, no una familia recomendada universal ni
  una dependencia productiva aprobada. No se aprueba una dependencia sin
  validar runtime, empaquetado Windows y mejora fisica frente al control.
- **REQ-004A — Deformacion local:** En un subestudio factorial, comparar
  cuatro anclas de esquina con y sin dos anclas interiores laterales situadas
  en margenes limpios. Las anclas adicionales solo se conservan si reducen
  error de reproyeccion y mejoran exactitud total en hojas curvas/pliegues sin
  perjudicar papel plano, impresora, costo de tinta o lectura de opciones.
  Una homografia de cuatro esquinas no se considerara correccion de curvatura
  no proyectiva.
- **REQ-005 — Registro cerrado por pagina:** La pagina debe resolver identidad,
  orientacion y correspondencia de sus anclas antes de leer respuestas. Si
  falta una marca, hay conflicto de ID, recorte, distorsion fuera del modelo o
  residuo excesivo, el examen va a revision manual; no se extrapola la
  geometria desde el QR ni desde las respuestas esperadas.
- **REQ-006 — QR por pagina ligado al mapa:** Cada pagina del examen tendra un
  QR firmado que identifique examen, pagina, version de plantilla y mapa
  geometrico, sin incluir clave ni respuestas esperadas. Zona inicial de
  reserva: 32 mm con quiet zone de cuatro modulos; confirmar capacidad del
  payload y lectura fisica. El QR valida identidad/pagina y no aporta centros
  ni predice marcas. QR ausente, invalido, inesperado o no ligado al mapa
  bloquea la calificacion automatica.
- **REQ-007 — Lectura y estados:** Medir tinta dentro de cada burbuja despues
  del registro, distinguiendo blank, filled, X, multiple, borrada y uncertain.
  La marca elegida puede ser relleno o X simple contenida. Doble marca, trazo
  que invade otra burbuja, palomita no validada, borrado, baja calidad,
  desacuerdo entre lectores o geometria dudosa se conserva como revision
  manual, no se convierte a la opcion mas cercana.
- **REQ-008 — Etiquetas y particiones sin fuga:** Adjudicar verdad terreno
  sin ver predicciones del motor y por dos revisores; resolver desacuerdos
  antes de sellar. Separar entrenamiento/calibracion/prueba por examen fisico,
  sesion, dispositivo y lote. Recapturas y derivados de una misma hoja solo
  aparecen en una particion. TV4 es control de dominio, no etiqueta de la
  geometria candidata.
- **REQ-009 — Gate por examen completo:** Numerador: examenes donde pagina,
  identidad, estado y opcion de cada reactivo se leen exactamente. Denominador:
  todos los examenes etiquetados del conjunto sellado. Cualquier error,
  abstencion, pagina faltante o identidad no resuelta es fallo completo; un
  blanco intencional solo cuenta si se etiqueta y se lee como blanco. Reportar
  tambien intervalo Wilson 95%, exactitud por reactivo, precision, cobertura,
  abstenciones, QR, estratos, memoria y latencia. No inferir exactitud total a
  partir de exactitud por celda ni de emisiones seleccionadas.
- **REQ-010 — Manual hasta la promocion:** No publicar respuestas ni
  calificaciones automaticamente hasta demostrar al menos 90% de examenes
  completos exactos en prueba sellada y repetir el resultado en una prueba
  fisica reproducible de la plantilla, QR y dispositivos objetivo. Un estrato
  que no alcance el gate permanece manual, aunque el promedio agregado pase.
- **REQ-011 — Alternativas de motor:** DWSNAP clasico es el comparador de
  primera prioridad para escaner, no un reemplazo aprobado. Los clasificadores
  aprendidos quedan exploratorios hasta disponer de etiquetas locales
  adjudicadas y superar el mismo gate. No agregar dependencia/servicio
  productivo sin medir precision total, latencia, memoria, privacidad,
  empaquetado Windows y costo operativo.
- **REQ-012 — Paginas y limites de examen:** Todos los reactivos permanecen
  una sola vez, en orden, con su opcion marcada junto al texto. No se permite
  pagina de respuestas. La paginacion evita dividir una opcion de su burbuja;
  el mapa registra pagina/reactivo/opcion y QR. Para lotes con variantes se
  mantiene el conteo uniforme de paginas exigido por SPEC-068 sin reducir
  legibilidad; si no cabe, se aumenta la paginacion uniforme del lote.

## Criterios de Aceptación

La especificacion sigue en draft; no autoriza cambios de codigo productivo
ni de pruebas automatizadas hasta aprobacion conforme a SDD. La generacion
candidata final debera ocurrir por el renderer y flujo de EvaluaPro, no por un
renderer PDF paralelo.

1. El examen contiene todas las burbujas OMR junto a sus opciones; no se genera
   una hoja separada. Una vista previa y PDF real de EvaluaPro muestran que el
   orden A–E, numero de pregunta, texto y burbuja coinciden exactamente.
2. El mapa por pagina persiste una coordenada por burbuja con questionId,
   numero, letra, radio y bounds; el QR identifica examen, pagina, plantilla y
   mapa exactos. La clave no participa en la orientacion ni en la deteccion.
3. Pruebas de colision cubren burbuja-texto, burbuja-burbuja, fiduciales,
   quiet zones, QR, margenes, engrapado, imagenes, opciones que envuelven y
   cambio de pagina. La fuente permanece uniforme y legible en contenido corto
   y largo; se cumplen paginas Carta y conteo uniforme por lote.
4. El bake-off fisico factorial mantiene identico el contenido y compara
   AprilTag/cuadrados con y sin anclas interiores. Incluye impresion a escala
   real, escaner plano a 300 dpi y moviles previstos; registra originales,
   configuracion, hash, etiquetas adjudicadas, lectura QR, registro, respuestas
   y tiempos.
5. La prueba incluye respuestas llenas, X simple, intencionalmente vacias,
   doble marca, borrado, trazo parcial/tenue, cruzado y opciones largas. Los
   casos dificiles permanecen en el denominador; una salida incierta falla el
   examen completo.
6. La metrica principal supera 90% de examenes completos exactos por cada
   estrato que se habilite. Si falla, se mantiene el flujo manual y se conserva
   el fallo como evidencia; no se cambian umbrales sobre el conjunto sellado.
7. El motor mantiene version SemVer propia, separada de la aplicacion y de
   omr-inline-exam-v1. No hay release estable hasta pasar los gates completos
   y dejar evidencia de regresion.

## Boceto de una pregunta integrada

    ┌───────────────────────────────────────────────────────────────────────┐
    │ 12. ¿Cuál afirmación describe mejor ...?                              │
    │                                                                       │
    │     ○  A) Primera alternativa ...                                     │
    │     ○  B) Segunda alternativa ...                                     │
    │     ○  C) Tercera alternativa ...                                     │
    │     ○  D) Cuarta alternativa ...                                      │
    │     ○  E) Quinta alternativa ...                                      │
    └───────────────────────────────────────────────────────────────────────┘

Las burbujas se ubican antes de cada opcion, en el mismo bloque y pagina que
la pregunta. La reticula se ajusta al texto con posiciones explicitas en el
mapa. Como geometria inicial se propone papel Carta, burbujas de 8 mm y
separacion vertical objetivo de 10.5 mm; el renderer debe calcular zonas reales
y rechazar colisiones. La reserva QR y los fiduciales van en margenes de pagina
sin invadir el contenido ni las zonas de grapa. Estas son dimensiones
candidatas, no un layout probado ni aceptado para produccion.

## Matriz de Trazabilidad

| ID | Caso | Archivo de test vinculado | Estado |
| --- | --- | --- | --- |
| REQ-001–004A, REQ-012 | Version, posicion por opcion, paginacion, mapa, zonas y fiduciales | apps/backend/tests/pdf.layout.visual.guard.test.ts | Pendiente tras aprobar la spec |
| REQ-005, REQ-007 | Registro, lectura por burbuja y abstencion segura | apps/backend/tests/omr.geometry.reference.test.ts | Pendiente de extender |
| REQ-006 | QR por pagina ligado a mapa/manifiesto | apps/backend/tests/omr.qr.preimpresion.test.ts | Pendiente de extender |
| REQ-008–011 | Particion sin fuga, exactitud total, promocion y rendimiento | apps/backend/tests/omr.dataset-grain.test.ts | Pendiente de implementar |

## Evidencia y limites

- Las 38 fotos omr-camera-camscanner-20260924/images/ son las mismas 38
  fuentes de D:\Downloads\Mobile Devices por SHA-256. En parte del corpus, las
  opciones impresas quedan demasiado cerca de la banda OMR; hay ruido y
  rotacion. Se observan X y relleno, pero la inspeccion no adjudica respuestas.
- Las cuatro fotos CamScanner 29-09-2026 07.35_01..04.jpg son listas
  administrativas, no respuestas de opcion multiple; no sirven para entrenar
  el clasificador de marcas.
- El PDF CamScanner de 48 paginas tiene reactivos/QR/fiduciales en algunas
  paginas, pero solo ocho celdas de una pagina tienen etiquetas parciales
  revisadas una vez. No ofrece ground truth independiente de examen completo.
- No entrenar con predicciones previas del motor como etiquetas; eso copiaria
  sus errores. Wild-OMR tiene 769 capturas pero solo 30 hojas fisicas; no hacer
  particiones aleatorias por foto ni inferir diversidad de 769 hojas.
- DWSNAP logro 532/769 (69.18%) examenes completos con QR en Wild-OMR. En el
  estrato de escaner, 28/30 (93.33%; Wilson 95% 78.68–98.15%). Es prioridad de
  bake-off, no resultado de esta plantilla ni razon para liberar el motor.
- Wild-OMR usa A4 y burbujas de 5 mm; esta propuesta usa Letter y 8 mm. La
  geometria inline aun no se ha impreso ni evaluado y no se afirma mejora.
- OpenCV documenta DICT_APRILTAG_36h11, 6x6 bits, distancia Hamming minima
  11 y 587 codigos; advierte que el orden de esquinas difiere de ArUco y del
  detector AprilTag nativo. El repositorio AprilTag 3 recomienda
  tagStandard41h12 para uso general y solo declara soporte oficial Linux.
  Los AprilTags OpenCV, los cuadrados asimetricos y las anclas interiores son
  hipotesis a medir; no se agrega dependencia productiva antes de verificar
  orientacion, deteccion, calidad de registro, coste y empaquetado Windows.
- La exactitud del examen completo requiere identidad/pagina correcta y todos
  los estados/opciones exactos; cualquier abstencion cuenta como fallo
  operativo. El intervalo de confianza se informa junto al porcentaje.

## Referencias

- Wild-OMR v1: https://zenodo.org/records/21710005
- AprilTag 3, repositorio y documentos del proyecto: https://github.com/AprilRobotics/apriltag
- OpenCV 5.0, deteccion ArUco/AprilTag, familias, distancia Hamming y orden de esquinas: https://docs.opencv.org/5.0/main_modules/objdetect_aruco.html
- Loke et al. (2018), A new method of mark detection for software-based optical mark recognition: https://doi.org/10.1371/journal.pone.0206420



