---
id: SPEC-039
titulo: Control Diario de Asistencias, Justificantes y Porcentajes
version: 1.2.0
fecha: 2026-09-23
autor: Antigravity / EvaluaPro Team
modulo: modulo_asistencias
estado: implemented
---

## Contexto
El docente realiza el pase de lista diario por grupo y materia. El sistema calcula en tiempo real los porcentajes de asistencia requeridos para tener derecho a examen y permite registrar justificaciones.

## Requisitos Funcionales
- **REQ-001 (Pase de Lista Rápido)**: Marcar Presente, Falta, Retardo o Justificada mediante botones identificados con su nombre completo y una acción directa por estudiante. Cada opción debe poder seleccionarse con un clic y operar con teclado.
- **REQ-002 (Recordatorio Automático)**: Banner en el shell docente si no se ha pasado lista en el día.
- **REQ-003 (Reporte y Resumen)**: Cálculo del porcentaje acumulado de asistencia por estudiante.
- **REQ-004 (Integridad del Grupo)**: La lista de una sesión incluye únicamente alumnos del periodo y grupo de esa sesión. El backend valida la pertenencia antes de guardar y rechaza el lote completo si algún alumno no corresponde.
- **REQ-005 (Permisos de Gestión)**: Los controles de creación y edición solo se habilitan para usuarios con permiso efectivo de gestión; la consulta permanece disponible para usuarios de solo lectura.
- **REQ-006 (Fecha Local)**: La fecha predeterminada de sesión y la comparación del recordatorio usan la fecha local del usuario.
- **REQ-007 (Persistencia E2E)**: Las sesiones, estados y pertenencia a periodo y grupo sobreviven a la recarga y reapertura; el resumen refleja los registros guardados.

## Criterios de Aceptación
1. El sistema permite registrar Presente, Falta, Retardo o Justificada con un solo clic por alumno, mostrando el nombre completo de cada estado.
2. El Shell Docente muestra recordatorio visual en caso de no haber registrado asistencia en la fecha activa.
3. Se calcula el porcentaje acumulado de asistencia y se identifican estudiantes en riesgo por faltas.
4. Crear o abrir una sesión nunca incorpora alumnos de otro periodo o grupo; un lote mixto enviado directamente al API se rechaza sin escrituras parciales.
5. Los usuarios de solo lectura no pueden cambiar estados ni ejecutar operaciones de gestión desde la interfaz; el backend conserva su autorización como límite definitivo.
6. Las fechas de sesión y recordatorio se interpretan según el día local, incluso cerca del cambio de fecha UTC.
7. El recorrido navegador → API → persistencia → reapertura → resumen conserva los estados y las pertenencias correctos.

## Matriz de Trazabilidad

| ID Requisito | Descripción del Caso | Archivo de Test Vinculado | Estado |
| --- | --- | --- | --- |
| REQ-001 | Pase de lista diario | `apps/frontend/tests/seccionAsistencias.test.tsx` | Completado |
| REQ-002 | Recordatorio de asistencia en shell | `apps/frontend/tests/appDocente.test.tsx` | Completado |
| REQ-003 | Reglas y cálculo de asistencias | `apps/backend/tests/integracion/asistencia.reglas.test.ts` | Completado |
| REQ-004 | Pertenencia de alumno a periodo/grupo y rechazo atómico | `apps/backend/tests/integracion/asistencia.reglas.test.ts` | Completado |
| REQ-005 | Controles de lectura frente a gestión | `apps/frontend/tests/seccionAsistencias.test.tsx` | Completado |
| REQ-006 | Fecha local predeterminada | `apps/frontend/tests/fechaLocal.test.ts` | Completado |
| REQ-007 | E2E navegador → API → persistencia → reapertura → resumen con periodo y grupo conservados | `tests/gui-responsive/journey-docente-integral.spec.ts` | Completado |
