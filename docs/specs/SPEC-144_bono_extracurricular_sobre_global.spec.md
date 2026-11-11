---
id: SPEC-144
titulo: Bono extracurricular sobre el global del tercer parcial
version: 1.0.0
fecha: 2026-11-09
autor: EvaluaPro Team
modulo: modulo_analiticas
estado: implemented
---

## Contexto

El docente necesita reconocer una actividad extracurricular sin alterar las
fórmulas institucionales ni aplicar el bono a parciales. La confirmación y el
resultado se registran en EvaluaPro y se reflejan explícitamente en la lista.

## Requisitos Funcionales

- El docente confirma el bono por alumno. La solicitud solo admite `0` para retirarlo o `0.5` puntos.
- El bono incrementa únicamente la calificación global del tercer parcial; no modifica los parciales 1 y 2 ni sus componentes.
- Solo se aplica si el global base existe y es aprobatorio (`>= 6`). El resultado se limita a 10; por ejemplo, 9.75 recibe 0.25.
- Si el global es menor que 6, ya es 10 o no existe, no se aplica. La vista previa explica el resultado antes de guardar.
- En el XLSX, el bono aplicado se exporta como un valor visible en BB y el global como el resultado ya calculado en AV. El bono no se vuelve a sumar en fórmulas de P1/P2/P3.

## Criterios de Aceptación

- Solo se admite una confirmación docente de 0 o +0.5 puntos.
- El global de tercer parcial recibe el bono solo si la calificación base es
  aprobatoria y menor que 10; el resultado nunca excede 10.
- La vista previa explica la elegibilidad antes de guardar y el XLSX muestra el
  bono aplicado sin duplicarlo en fórmulas de otros parciales.

## Matriz de Trazabilidad

| Requisito | Implementación | Regresión |
| --- | --- | --- |
| Validar 0 o 0.5 y guardar confirmación del docente | `validacionesAnaliticas.ts`, `controladorAnaliticas.ts` | `apps/backend/tests/integracion/listaAcademicaContratos.test.ts` |
| Elegibilidad, umbral 6 y límite 10 | `servicioBonoExtracurricular.ts`, `servicioListaAcademica.ts` | `apps/backend/tests/bonoExtracurricular.test.ts` |
| Vista previa global-only y confirmación explícita | `ConsultaCalificaciones.tsx` | `apps/frontend/tests/seccionCalificaciones.resumen.test.tsx` |
| Exportar el bono visible solo sobre el global | `servicioExportacionXlsxCalificaciones.ts` | `apps/backend/tests/analiticas.xlsx.sv.contract.test.ts` |
