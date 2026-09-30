---
id: SPEC-063
titulo: Orientacion e inclinacion robustas de pagina OMR
version: 1.0.3
fecha: 2026-09-26
autor: EvaluaPro Team
modulo: modulo_escaneo_omr, modulo_generacion_pdf
estado: approved
---

## Contexto

El detector canonico v4 puede medir giro cardinal e inclinacion residual desde
la arista superior del QR y rectificar perspectiva mediante homografia. Las
capturas CamScanner del dataset reciente proceden de plantillas legadas con
cuatro marcas simetricas y, en diez casos, permanecen con orientacion
indeterminada. La plantilla siguiente ya incluye un centro hueco asimetrico en
el fiducial superior izquierdo; el mapa lo conserva. La prueba sobre el PDF
rasterizado revelo que texto denso cercano podia puntuar por encima del
fiducial hueco, asi que la deteccion de cuadrados ahora recompensa el patron
centro claro/anillo oscuro antes de ordenar la homografia. La inclinacion desde
el fiducial se promedia con el borde paralelo opuesto para reducir el sesgo
local de un centro detector. Sin evidencia
direccional suficiente, la pagina continua en abstencion segura.

## Requisitos Funcionales

- **REQ-001:** El detector debe estimar el giro cardinal (0, 90, 180, 270 grados)
  y la inclinacion residual de la pagina con el QR cuando este sea legible.
- **REQ-002:** La plantilla canonica futura debe incluir una referencia
  direccional asimetrica localizable aun cuando el QR no sea legible. El mapa
  OMR debe persistir el tipo, tamano y coordenadas de esa referencia y el
  fingerprint del layout debe invalidarse cuando cambie.
- **REQ-003:** La referencia direccional debe identificar semanticamente las
  esquinas antes de calcular la homografia de pagina. La homografia debe usar
  correspondencias verificadas y conservar control de calidad/residuo; no se
  permite asumir orientacion cero cuando no haya evidencia direccional.
- **REQ-004:** Si QR y fiduciales discrepan, la pagina debe quedar con
  orientacion indeterminada y sus respuestas deben abstenerse. Si solo falta
  evidencia direccional pero no existe conflicto, se pueden conservar las
  candidatas fotometricas y los estados de reactivo para revision manual; nunca
  deben habilitar autocalificacion basadas en una orientacion supuesta.
- **REQ-005:** El resultado OMR debe exponer giro, inclinacion, fuente de
  orientacion y calidad de referencia para auditoria sin consultar la clave.
- **REQ-006:** Deben existir regresiones con rotaciones cardinales, inclinacion
  positiva/negativa, perspectiva, baja resolucion, QR ausente y conflicto de
  referencias, ademas de verificar que la plantilla dibujada coincide con el
  mapa persistido y que los fallos conservan abstencion segura.

## Criterios de Aceptación

1. Para las cuatro rotaciones, el detector recupera la orientacion correcta y
   aplica una transformacion que mapea los puntos de referencia a su posicion
   canonica dentro de una tolerancia definida por la resolucion de raster.
2. La inclinacion estimada conserva signo y magnitud dentro de 1 grado en
   fixtures sinteticos etiquetados con inclinacion entre -15 y +15 grados.
3. La orientacion se recupera desde la referencia direccional con QR ausente;
   la homografia usa las esquinas semanticamente correctas.
4. Ante conflicto de referencias no se publican letras. Sin QR ni fiducial
   direccional confiable, pero sin conflicto, se conservan las candidatas y
   estados para revisión, la pagina requiere revision y no se auto-califica.
5. Los tests OMR/geometria, el typecheck y los tests de layout/fingerprint pasan.
   La evaluacion sobre capturas reales se reporta por separado de los fixtures
   sinteticos y no se presenta como exactitud poblacional.

## Matriz de Trazabilidad

| ID | Evidencia | Archivo de test | Estado |
| --- | --- | --- | --- |
| REQ-001 | Giro e inclinacion derivados del QR | `apps/backend/tests/omr.geometry.reference.test.ts` | Verificado en fixtures sinteticos |
| REQ-002 | Render, mapa y fingerprint del fiducial direccional | `apps/backend/tests/integracion/plantillasCrudYPreview.test.ts`, `apps/backend/tests/pdf.canonico.test.ts`, `apps/backend/src/modulos/modulo_escaneo_omr/infra/imagenProcesamientoCanonico.ts` | En PDF real rasterizado se verifica centro claro/anillo negro solo en la esquina superior izquierda y los otros tres centros negros; sin pasar QR decodificado ni geometría QR esperada al localizador, `obtenerTransformacion` determina 0° por `fiducial_direccional`. Se corrigió la puntuación de cuadrados para reconocer el centro hueco frente a texto denso. Es prueba digital, no impresión física. |
| REQ-003 | Orden semantico de esquinas y homografia | `apps/backend/tests/omr.geometry.reference.test.ts` | Verificado: cuatro giros y 7 grados de inclinacion |
| REQ-004 | Abstencion ante conflicto y preservacion de candidatas sin referencia | `apps/backend/tests/omr.geometry.reference.test.ts` | Verificado en fixtures y contrato de decisión |
| REQ-005 | Telemetria de orientacion | `apps/backend/src/modulos/modulo_escaneo_omr/servicioOmrCv.ts` | Campos expuestos; asercion automatizada de serializacion pendiente |
| REQ-006 | Rotaciones, inclinaciones y regresion de plantilla | `apps/backend/tests/omr.geometry.reference.test.ts` | Rotaciones e inclinacion sinteticas verificadas; perspectiva, baja resolucion y variacion fotografica pendientes |
