---
id: SPEC-144
titulo: Bono extracurricular sobre el global del tercer parcial
version: 1.0.0
fecha: 2026-11-09
modulo: modulo_analiticas
estado: implemented
---

## Regla

- El docente confirma el bono por alumno. La solicitud solo admite `0` para retirarlo o `0.5` puntos.
- El bono incrementa únicamente la calificación global del tercer parcial; no modifica los parciales 1 y 2 ni sus componentes.
- Solo se aplica si el global base existe y es aprobatorio (`>= 6`). El resultado se limita a 10; por ejemplo, 9.75 recibe 0.25.
- Si el global es menor que 6, ya es 10 o no existe, no se aplica. La vista previa explica el resultado antes de guardar.
- En el XLSX, el bono aplicado se exporta como un valor visible en BB y el global como el resultado ya calculado en AV. El bono no se vuelve a sumar en fórmulas de P1/P2/P3.

## Trazabilidad

| Requisito | Implementación | Regresión |
| --- | --- | --- |
| Validar 0 o 0.5 y guardar confirmación del docente | `validacionesAnaliticas.ts`, `controladorAnaliticas.ts` | `integracion/listaAcademicaContratos.test.ts` |
| Elegibilidad, umbral 6 y límite 10 | `servicioBonoExtracurricular.ts`, `servicioListaAcademica.ts` | `bonoExtracurricular.test.ts` |
| Vista previa global-only y confirmación explícita | `ConsultaCalificaciones.tsx` | `seccionCalificaciones.resumen.test.tsx` |
| Exportar el bono visible solo sobre el global | `servicioExportacionXlsxCalificaciones.ts` | `analiticas.xlsx.sv.contract.test.ts` |
