---
id: SPEC-034
titulo: Flujo Operativo por Pestañas y Guías Rápidas Dedicadas en Diseño de Exámenes
version: 1.0.0
fecha: 2026-08-26
autor: Antigravity / EvaluaPro Team
modulo: modulo_docente
estado: approved
---

## Contexto
La sección de maquetación y producción de exámenes ("Diseño de Exámenes", anteriormente "Plantillas") engloba tres responsabilidades operativas distintas:
1. Maquetación estructural y catálogo de plantillas por temas.
2. Centro de generación masiva e individual de exámenes impresos con códigos QR y folios únicos.
3. Custodia, descarga de paquetes ZIP/PDF, regeneración de lotes y diagnóstico del flujo OMR V1.

Presentar todas las herramientas simultáneamente en una sola vista causa sobrecarga cognitiva. Se requiere una navegación por pestañas funcionales donde cada fase del flujo tenga su propio espacio de trabajo y su propia guía rápida interactiva contextual.

## Requisitos Funcionales
- **REQ-001 (Pestañas de Navegación)**: La sección debe exponer tres pestañas claramente diferenciadas:
  - `[ 📐 Diseñar Exámenes ]`: Muestra el formulario de maquetación y el catálogo de plantillas existentes.
  - `[ 🚀 Generar Paquete PDF/OMR ]`: Muestra la consola de producción y generación de exámenes en lote/individual.
  - `[ 📦 Historial de Lotes ]`: Muestra el registro de paquetes generados, descargas y flujo OMR V1.
- **REQ-002 (Cambio Dinámico de Vistas)**: Al hacer clic en una pestaña, el sistema debe cambiar inmediatamente el contenido visible en pantalla, ocultando las otras secciones sin recargar la página.
- **REQ-003 (Guías Rápidas Contextuales)**: Cada una de las 3 pestañas debe contar con su propia tarjeta de guía rápida explicativa independiente (con opción de ocultar/mostrar persistente en `localStorage`):
  - Pestaña 1: Guía de Estructura, Materia y Composición Temática.
  - Pestaña 2: Guía de Generación, Folios Únicos y Códigos QR por Alumno.
  - Pestaña 3: Guía de Descarga de Paquetes, Reimpresión y Calificación OMR.

## Criterios de Aceptación
1. Al renderizar la vista, la pestaña por defecto es `Diseñar Exámenes`.
2. Al hacer clic en `Generar Paquete PDF/OMR`, el formulario de diseño se oculta y se muestra la consola de generación.
3. Al hacer clic en `Historial de Lotes`, se muestra el listado de paquetes generados y herramientas de custodia.
4. Cada pestaña muestra su respectiva guía contextual arriba del área de trabajo.
5. El 100% de los tests unitarios y de integración de Vitest pasan en verde en CI.

## Matriz de Trazabilidad

| ID Requisito | Descripción del Caso | Archivo de Test Vinculado | Estado |
| --- | --- | --- | --- |
| REQ-001 | Renderizado inicial y presencia de pestañas operativas | `apps/frontend/tests/plantillas.refactor.test.tsx` | Completado |
| REQ-002 | Alternancia interactiva entre pestañas de diseño, generación e historial | `apps/frontend/tests/plantillas.refactor.test.tsx` | Completado |
| REQ-003 | Presencia de guías rápidas contextuales por pestaña | `apps/frontend/tests/plantillas.refactor.test.tsx` | Completado |
