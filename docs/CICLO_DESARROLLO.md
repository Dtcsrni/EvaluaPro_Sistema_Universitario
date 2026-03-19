# Ciclo de desarrollo

Objetivo: establecer un flujo unico y auditable desde la necesidad de negocio hasta la operacion en produccion.

## Fase 1. Requisitos (obligatoria)
Entrada minima:
- problema a resolver y objetivo medible,
- alcance (incluye/no incluye),
- actores y permisos impactados,
- criterio de aceptacion verificable,
- riesgos funcionales y tecnicos.

Artefactos de salida (al menos uno segun tipo de cambio):
- historia/tarea en issue o rama de trabajo con criterios de aceptacion,
- actualizacion de `docs/FLUJO_EXAMEN.md` si cambia flujo funcional,
- actualizacion de `docs/ROLES_PERMISOS.md` si cambia autorizacion,
- actualizacion de `docs/FORMATO_PDF.md` si cambia contrato PDF/OMR.

Gate de paso a implementacion:
- no se inicia desarrollo sin criterio de aceptacion verificable.

## Fase 2. Diseno tecnico
- definir estrategia (modulos, contratos, migracion, feature flags),
- identificar impacto en API, datos, seguridad y observabilidad,
- acordar plan de pruebas asociado al requisito.

## Fase 3. Implementacion (TDD)
- cambio funcional con prueba nueva/ajustada en la misma entrega,
- cumplimiento de diff coverage y deuda temporal controlada,
- trazabilidad del cambio en docs de baseline cuando aplique.

## Fase 4. Verificacion (CI/QA)
- ejecucion de quality gates bloqueantes de CI,
- verificacion de contratos funcionales (backend/frontend/portal/docs),
- evidencia en reportes (`reports/qa/latest/*`) cuando aplique.

## Fase 5. Release y operacion
- merge directo o por PR segun el nivel de estabilidad vigente del repositorio,
- validacion de release gates segun version objetivo,
- monitoreo post-deploy y runbook de recuperacion.

## Criterio de cumplimiento del ciclo
Toda entrega funcional debe poder responder tres preguntas:
1. Que requisito implementa?
2. Como se valida objetivamente?
3. Que evidencia (tests/checks/docs) lo demuestra?
