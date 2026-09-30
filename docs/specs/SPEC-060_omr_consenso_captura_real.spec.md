---
id: SPEC-060
titulo: Consenso robusto y calibracion de deteccion OMR para capturas reales
version: 1.1.1
fecha: 2026-09-19
autor: EvaluaPro Team
modulo: modulo_escaneo_omr
estado: approved
---

## Contexto

Las capturas de celular de los dos lotes reales compartidos combinan cambios de
iluminacion, perspectiva, compresion, desenfoque y resolucion. El motor ya
realiza busqueda geometrica local y un segundo pase, pero su fusion dependia
principalmente del score bruto de cada opcion. Ese score no es comparable de
forma directa entre pasadas con distinto contraste y puede conservar una
hipotesis incorrecta cuando una pasada recupera una marca y la otra la pierde.

## Objetivo

Incorporar una decision OMR v2 que compare cada reactivo mediante evidencia
normalizada por su propio vector de cinco opciones, forma de la marca,
separacion frente a la segunda candidata y consistencia entre pasadas. La
decision debe conservar la abstencion ante doble marca, tachadura o conflicto
no resoluble, y no debe consultar la clave de respuestas.

## Requisitos Funcionales

- **REQ-001:** La evidencia de cada pasada debe normalizarse por reactivo con
  estadisticos robustos (mediana/MAD) antes de compararse; no se permite
  elegir una respuesta solo por score bruto entre pasadas.
- **REQ-002:** Dos pasadas que coinciden en una unica opcion valida deben
  aumentar la confianza solo dentro de [0,1] y conservar los scores y flags
  de la evidencia mas informativa.
- **REQ-003:** Una opcion valida en una pasada y una lectura en blanco en la
  otra solo puede rescatarse si supera umbrales de margen, nucleo, forma y
  confianza; de lo contrario se conserva como ambigua.
- **REQ-004:** Si dos pasadas producen opciones distintas, un margen robusto
  pequeno debe producir abstencion; un ganador claramente superior puede
  conservarse con una marca de revision que haga visible el conflicto.
- **REQ-005:** Cualquier doble marca o tachadura confirmada debe seguir sin
  letra calificable. La clave de respuestas solo se usa fuera del detector,
  durante la etapa de calificacion.
- **REQ-006:** El resultado fusionado debe identificar la politica
  `conservadora_v2` y conservar las decisiones de calidad, geometria y
  cobertura existentes.
- **REQ-007:** Deben existir pruebas unitarias para consenso, rescate seguro,
  conflicto, invalidez y limites numericos, ademas de ejecutar las pruebas OMR
  existentes sin regresion.
- **REQ-008:** El lote docente global mas reciente debe incorporarse como
  regresion fotografica TV4 con etiquetas de marca adjudicadas
  independientemente del OMR; cada QR capturado debe compararse con el QR y el
  mapa del PDF exacto generado antes de impresion. Reportes OMR previos no son
  fuente de `ground_truth`.
- **REQ-009:** Una señal débil que no distingue de forma suficiente tinta
  seleccionada del contorno impreso no puede emitirse como opción calificable.
  Debe conservarse como ambigua para revisión, y una página esencialmente vacía
  no debe adquirir letras por rescates de baja señal.

## Criterios de Aceptación

1. La fusion coincide cuando ambas pasadas observan la misma opcion y nunca
   genera confianza fuera de [0,1].
2. Una pasada con una marca fuerte y otra en blanco rescata la respuesta solo
   cuando la evidencia independiente satisface los umbrales; una marca debil
   permanece en revision.
3. Dos opciones distintas con fuerza equivalente se convierten en respuesta
   nula con `bajo_contraste` y no se califican automaticamente.
4. Una doble marca o tachadura no puede convertirse en letra por el consenso.
5. `typecheck` y la bateria focalizada de OMR pasan; el resultado real se
   reporta separado de la evidencia sintetica y no se declara exactitud
   operacional sin un dataset etiquetado independiente.
6. El lote fotografico global registra las cuatro capturas y sus 16 paginas,
   conserva referencia verificable al PDF preimpresion y exige que las
   etiquetas de respuestas se revisen contra las marcas visibles; QR no
   detectado o discordante queda como fallo/abstencion explícita, nunca como
   coincidencia inferida del mapa.
7. Una regresión de hoja vacía bajo remuestreo y compresión no devuelve opciones
   calificables por artefactos del contorno; las marcas sintéticas con evidencia
   sólida continúan detectándose y los intentos débiles quedan sin letra.

## Matriz de Trazabilidad

| ID | Evidencia | Archivo de test | Estado |
| --- | --- | --- | --- |
| REQ-001 | Normalizacion robusta por reactivo | `apps/backend/tests/omr.consenso.robusto.test.ts` | Completado |
| REQ-002 | Consenso de opcion comun y confianza acotada | `apps/backend/tests/omr.consenso.robusto.test.ts` | Completado |
| REQ-003 | Rescate seguro frente a blanco | `apps/backend/tests/omr.consenso.robusto.test.ts` | Completado |
| REQ-004 | Abstencion ante conflicto | `apps/backend/tests/omr.consenso.robusto.test.ts` | Completado |
| REQ-005 | Invariante de invalidez | `apps/backend/tests/omr.consenso.robusto.test.ts` | Completado |
| REQ-006 | Politica v2 en resultado OMR | `apps/backend/tests/omr.consenso.robusto.test.ts` | Completado |
| REQ-007 | Pruebas OMR y typecheck | `npm -C apps/backend run test -- ... --run`, `npm -C apps/backend run typecheck` | Completado |
| REQ-008 | Regresion del lote fotografico global y QR contra PDF preimpresion | `omr_samples_tv4_pilot_real` y validador real | Pendiente |
| REQ-009 | Abstencion ante evidencia débil del contorno impreso | `apps/backend/tests/pdf.layout.visual.guard.test.ts`, `apps/backend/tests/omr.estado-respuesta.test.ts` | Fallo reproducido; corrección y regresión pendientes |
