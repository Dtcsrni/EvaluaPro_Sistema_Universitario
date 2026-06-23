---
id: SPEC-002
titulo: Automatización de Reglas de Encuadre y Firma Digital CUH
version: 1.0.0
fecha: 2026-06-23
autor: Antigravity
modulo: modulo_evaluaciones
estado: approved
---

# SPEC-002: Automatización de Reglas de Encuadre y Firma Digital CUH

## Contexto
El Centro Universitario Hidalguense (CUH) tiene normativas académicas oficiales sobre la ponderación de exámenes, las inasistencias y el redondeo de calificaciones. 
Este desarrollo automatiza estas reglas y proporciona un flujo local y 100% gratuito para la firma digital de conformidad del encuadre oficial (tanto de alumnos como docentes), utilizando una biblioteca local open-source (`pdf-lib`) y tokens seguros enviados por correo institucional (`@cuh.mx`).

## Requisitos Funcionales
- **REQ-001:** El sistema debe registrar y persistir los encuadres académicos y sus correspondientes firmas por periodo en la base de datos (Prisma).
- **REQ-002:** El backend debe generar un PDF de encuadre utilizando `pdf-lib` con la tabla oficial de "Formato de Asignatura" conteniendo todos los metadatos institucionales (Clave, Asignatura, Catedrático, Horas, Créditos, Objetivo General), las ponderaciones de calificaciones, la regla de asistencia y las firmas de conformidad en un diseño de dos páginas.
- **REQ-003:** El sistema debe enviar notificaciones por correo institucional a alumnos y docentes con tokens seguros y únicos para firmar digitalmente el encuadre.
- **REQ-004:** El backend debe permitir a un firmante estampar su firma digital (Fecha, IP y Hash de Integridad) en el PDF del encuadre, actualizando su posición en la tabla de firmas de la página 2 del PDF.
- **REQ-005:** La regla de asistencia debe verificar si el alumno acumuló $\ge 4$ inasistencias en el periodo y, en ese caso, marcarlo o penalizarlo en el resumen del periodo.
- **REQ-006:** La lógica de calificación debe calcular el promedio ponderado de acuerdo a los pesos oficiales configurados y aplicar las reglas de redondeo institucional de CUH ($< 6.0 \rightarrow$ floor; $\ge 6.0 \rightarrow$ standard half-up).

## Criterios de Aceptación
- **AC-001 (REQ-002):** Validar que el PDF generado contenga el título oficial, la tabla de datos de asignatura y los textos específicos de las políticas del CUH.
- **AC-002 (REQ-004):** Validar que estampar una firma actualice el PDF escribiendo "FIRMADO" y los metadatos (Fecha, IP, Hash) en la fila correspondiente, sin corromper el documento.
- **AC-003 (REQ-005):** Verificar que la inasistencia se calcule correctamente y que con 4 o más faltas se restrinjan las calificaciones/derechos.
- **AC-004 (REQ-006):** Validar el redondeo exacto de CUH con los casos de prueba: `6.5 -> 7`, `6.4 -> 6`, `5.9 -> 5`, `5.4 -> 5`.

## Matriz de Trazabilidad

| ID Requisito | Descripción del Caso | Archivo de Test Vinculado | Estado |
| --- | --- | --- | --- |
| REQ-001 | Persistencia de EncuadreAcademico y FirmaEncuadre | `apps/backend/tests/servicioEncuadrePdf.test.ts` | Completado |
| REQ-002 | Generar PDF con Formato de Asignatura | `apps/backend/tests/servicioEncuadrePdf.test.ts` | Completado |
| REQ-003 | Envío de tokens por correo a firmantes | `apps/backend/tests/servicioEncuadrePdf.test.ts` | Completado |
| REQ-004 | Estampar firma digital con pdf-lib en fila del firmante | `apps/backend/tests/servicioEncuadrePdf.test.ts` | Completado |
| REQ-005 | Validación de límite de inasistencias (>= 4 faltas) | `apps/backend/tests/evaluaciones.politicaLisc.test.ts` | Completado |
| REQ-006 | Redondeo institucional de CUH (< 6.0 floor, >= 6.0 half-up) | `apps/backend/tests/evaluaciones.politicaLisc.test.ts` | Completado |
