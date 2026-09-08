---
id: SPEC-034
titulo: Flujo Operativo por Pestañas y Guías Rápidas Dedicadas en Diseño de Exámenes
version: 1.0.0
fecha: 2026-08-26
autor: Antigravity / EvaluaPro Team
modulo: modulo_docente
estado: implemented
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
- **REQ-004 (Previsualización de Plantillas)**: El botón `Previsualizar` del catálogo debe cargar el boceto JSON y abrir inmediatamente el panel de previsualización de la plantilla seleccionada. Si el panel ya está abierto, el mismo botón debe actualizar el boceto sin dejar la interfaz en un estado aparentemente inerte.
- **REQ-005 (Layout del Boceto)**: Cada página del boceto debe presentar su cabecera y listado de preguntas en una composición vertical, legible y responsive; los metadatos no deben estirarse ni desplazar horizontalmente las preguntas por reglas genéricas de listados.
- **REQ-006 (Visor PDF Legible)**: El PDF generado desde el boceto debe mostrarse en un visor embebido que use el ancho disponible y una altura suficiente para leer la página sin quedar reducido al tamaño por defecto del elemento `iframe`.

## Criterios de Aceptación
1. Al renderizar la vista, la pestaña por defecto es `Diseñar Exámenes`.
2. Al hacer clic en `Generar Paquete PDF/OMR`, el formulario de diseño se oculta y se muestra la consola de generación.
3. Al hacer clic en `Historial de Lotes`, se muestra el listado de paquetes generados y herramientas de custodia.
4. Cada pestaña muestra su respectiva guía contextual arriba del área de trabajo.
5. Al hacer clic en `Previsualizar`, el panel `Previsualización (boceto por página)` queda visible y se solicita el boceto de la plantilla seleccionada.
6. Cada bloque `Página N` muestra sus metadatos arriba y sus preguntas debajo, sin chips verticalmente estirados ni solapamiento del texto.
7. El visor PDF ocupa el ancho del contenedor y mantiene una altura mínima legible, con ajuste para pantallas pequeñas.
8. El 100% de los tests unitarios y de integración de Vitest pasan en verde en CI.

## Matriz de Trazabilidad

| ID Requisito | Descripción del Caso | Archivo de Test Vinculado | Estado |
| --- | --- | --- | --- |
| REQ-001 | Renderizado inicial y presencia de pestañas operativas | `apps/frontend/tests/plantillas.refactor.test.tsx` | Completado |
| REQ-002 | Alternancia interactiva entre pestañas de diseño, generación e historial | `apps/frontend/tests/plantillas.refactor.test.tsx` | Completado |
| REQ-003 | Presencia de guías rápidas contextuales por pestaña | `apps/frontend/tests/plantillas.refactor.test.tsx` | Completado |
| REQ-004 | El botón Previsualizar abre el panel y solicita el boceto | `apps/frontend/tests/plantillas.refactor.test.tsx` | Completado |
| REQ-005 | La página del boceto conserva una composición vertical legible | `apps/frontend/src/styles/screens.css` | Completado |
| REQ-006 | El visor PDF usa un tamaño legible y responsive | `apps/frontend/tests/plantillas.refactor.test.tsx` | Completado |
