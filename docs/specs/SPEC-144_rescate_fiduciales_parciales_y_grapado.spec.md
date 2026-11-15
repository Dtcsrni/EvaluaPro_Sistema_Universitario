---
id: SPEC-144
titulo: Fiduciales locales tolerantes a oclusión y reserva de grapado
version: 1.1.0
fecha: 2026-11-13
autor: EvaluaPro Team
modulo: modulo_escaneo_omr, modulo_generacion_pdf
estado: implemented
---

## Contexto

La lectura local de respuestas depende de fiduciales alrededor de cada panel.
Una marca tapada, deformada por el pliegue o degradada por una captura puede
invalidar el ajuste aunque sobrevivan referencias suficientes en otros lados.
Las capturas recientes muestran pliegues diagonales variables en los bordes
superiores, sobre todo a la derecha y ocasionalmente a la izquierda. La zona
impresa de GRAPA permanece arriba a la izquierda y no debe ampliarse hacia el
logo ni los fiduciales. Se conserva el núcleo de alto contraste; el QR actúa
como referencia independiente cuando una marca de esquina está ocluida.

## Requisitos Funcionales

- REQ-001: el ajuste por pregunta detecta cualquier subconjunto válido de los
  fiduciales declarados, sin exigir el lado izquierdo como ancla obligatoria.
- REQ-002: con tres o más puntos no colineales, el ajuste robusto usa consenso
  de inliers y calcula la transformación con los puntos consistentes; un punto
  atípico no debe desplazar el panel.
- REQ-003: con dos puntos geométricamente separados se permite solo una
  transformación restringida de escala/traslación, si el error, cobertura y
  plausibilidad están dentro de umbral. Con menos evidencia se conserva la
  geometría global y se informa ajuste local rechazado.
- REQ-004: el formato heredado de dos fiduciales no inventa anclas físicas
  adicionales ni cuenta puntos virtuales como observados.
- REQ-005: la plantilla mantiene un área de exclusión del grapado ampliada y
  verifica que no interseque el núcleo ni la zona tranquila de fiduciales de
  página o pregunta, OMR, texto o QR.
- REQ-006: los fiduciales mantienen núcleo negro cuadrado y zona tranquila
  blanca; no se añade ornamentación dentro de la zona detectada.
- REQ-007: el diagnóstico informa puntos esperados/detectados y el tipo de
  rescate para poder auditar cobertura parcial.
- REQ-008: si falta al menos un fiducial de página y el QR se detecta con
  geometría confiable, se usa el QR como homografía global y se registra el
  conteo parcial de fiduciales; sin QR u orientación verificable no se afirma
  una rectificación global confiable.
- REQ-009: el despeje de GRAPA se valida frente a zonas tranquilas y contenido
  funcional en anverso y reverso, sin ampliar la reserva de forma que invada
  logotipos, QR o fiduciales.

## Criterios de Aceptación

1. Pruebas sintéticas cubren cada fiducial ausente por separado, oclusión de
   ambos fiduciales de un lado, tres puntos válidos con un atípico, dos puntos
   colineales útiles, puntos insuficientes, degeneración geométrica y extremos
   de escala/error.
2. La plantilla rasterizada conserva la densidad y contraste mínimos del
   marcador existente, y todas las zonas de grapado ampliadas son disjuntas
   de fiduciales/zonas tranquilas tanto al frente como al reverso.
3. Una generación Carta representativa conserva paginación, mapa OMR y QR;
   el validador falla con un diagnóstico si el contenido no cabe fuera de la
   reserva física ampliada.
4. El motor no convierte evidencia geométrica insuficiente en respuesta
   calificada: mantiene confianza/revisión según la política vigente.

## Matriz de Trazabilidad

| ID Requisito | Descripción del Caso | Archivo de Test Vinculado | Estado |
| --- | --- | --- | --- |
| REQ-001–004 | Ajuste robusto con subconjuntos, un outlier y casos degenerados | `apps/backend/tests/omr.fiduciales.local.test.ts` | Implementado; 7 pruebas focales pasan |
| REQ-005–006, REQ-009 | Despeje de GRAPA y fiduciales de alto contraste | `apps/backend/tests/pdf.ink-sparing-staple.test.ts` | Implementado; 7 pruebas focales pasan |
| REQ-007 | Métricas y advertencia de ajuste local parcial | `apps/backend/tests/omr.fiduciales.local.test.ts` | Implementado; typecheck backend pasa |
| REQ-008 | QR global como rescate con una esquina oculta | `apps/backend/tests/omr.geometry.reference.test.ts` | Implementado; 33 pruebas de referencia pasan |
