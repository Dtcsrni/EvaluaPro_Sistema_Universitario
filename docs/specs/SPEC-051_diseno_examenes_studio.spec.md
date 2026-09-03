---
id: SPEC-051
titulo: Estudio de diseño de exámenes con vista previa integrada y marca docente
version: 1.0.0
fecha: 2026-08-31
autor: EvaluaPro Team
modulo: modulo_diseno_examenes
estado: approved
---

## Contexto

La pantalla de Diseño de Exámenes concentra configuración, selección temática,
densidad, catálogo y generación en un flujo difícil de recorrer. El docente
necesita entender qué está configurando, cuánto ocupará el examen y qué verá
antes de guardarlo o producirlo. La pantalla se reorganiza como un estudio de
construcción con configuración progresiva, asignación visible por tema y una
previsualización PDF suficientemente grande para validar el resultado.

La identidad gráfica PDF se conserva como preferencia reutilizable del docente.
La plantilla puede heredar los logos configurados en Cuenta o definir un
reemplazo específico para ese examen.

## Requisitos Funcionales

- **REQ-001 (Estudio de construcción)**: La pestaña de diseño debe presentar
  configuración, temas/formato y vista previa como un flujo visual único, con
  jerarquía clara y sin duplicar acciones de generación o historial.
- **REQ-002 (Asignación temática)**: El docente debe conservar la selección de
  temas, conteo de reactivos disponibles y ajuste de preguntas por plantilla.
- **REQ-003 (Vista previa prioritaria)**: La vista previa PDF debe ocupar el
  panel principal de revisión, mantener acciones de actualizar, abrir,
  pantalla completa y cerrar, y adaptarse al ancho disponible sin solaparse.
- **REQ-004 (Preferencias de logos)**: Cuenta > PDF institucional debe permitir
  cargar y guardar dos imágenes reutilizables. Diseño de Exámenes debe
  precargarlas como valores predeterminados, permitiendo reemplazos por
  plantilla sin romper plantillas existentes.
- **REQ-005 (Compatibilidad funcional)**: Las pestañas de generación e historial,
  edición, archivado, filtros, permisos y persistencia de pestaña activa deben
  conservar su comportamiento observable.
- **REQ-006 (Accesibilidad y responsive)**: La nueva estructura debe mantener
  labels, landmarks, foco visible, estados de carga/error y funcionar en
  desktop, tablet y móvil sin texto ilegible ni controles superpuestos.
- **REQ-007 (OMR legible)**: Cada panel OMR debe conservar una superficie de
  marcado ampliada, separación mínima entre burbujas, etiquetas no invasivas,
  fiduciales dentro del panel y coordenadas del contrato OMR canónico.
- **REQ-008 (Formato rico)**: El renderer debe interpretar negrita, cursiva y
  subrayado explícito en enunciados y opciones sin convertir el marcado en
  texto visible ni alterar la envoltura de línea.

## Criterios de Aceptación

1. La pantalla muestra configuración y preview en una composición de estudio
   de tres columnas cuando hay espacio suficiente, y cae a una sola columna en
   viewport estrecho.
2. El panel PDF es visualmente dominante y su iframe tiene una altura útil,
   sin miniatura fija que obligue al docente a usar pantalla completa.
3. Los cambios de título, materia, temas, páginas, preguntas, fuente,
   interlineado y logos siguen llegando al payload de creación/edición.
4. Una imagen cargada en Cuenta > PDF institucional se envía al endpoint de
   preferencias, aparece como preferencia guardada y se reutiliza al crear una
   plantilla si no existe override.
5. Las plantillas antiguas sin logos siguen usando los defaults existentes y
   las plantillas con logos propios mantienen prioridad.
6. Las pruebas focalizadas de Plantillas, Cuenta y contratos de preferencias
   pasan sin regresiones.
7. Una prueba de layout verifica el diámetro OMR, la separación entre centros,
   los límites del panel y la generación de formato rico.

## Matriz de Trazabilidad

| ID Requisito | Descripción del Caso | Archivo de Test Vinculado | Estado |
| --- | --- | --- | --- |
| REQ-001 | Composición y navegación del estudio de diseño | `apps/frontend/tests/plantillas.refactor.test.tsx` | Pendiente |
| REQ-002 | Selección temática y ajuste de reactivos | `apps/frontend/tests/plantillas.refactor.test.tsx` | Pendiente |
| REQ-003 | Visor PDF integrado y acciones de preview | `apps/frontend/tests/plantillas.refactor.test.tsx` | Pendiente |
| REQ-004 | Preferencias de PDF y carga de logos | `apps/frontend/tests/seccionCuenta.test.tsx` | Pendiente |
| REQ-005 | Pestañas, edición, filtros y permisos | `apps/frontend/tests/plantillas.refactor.test.tsx` | Pendiente |
| REQ-006 | Contratos UX y responsive | `apps/frontend/tests/ux.quality.test.tsx` | Verificado |
| REQ-007 | Geometría OMR ampliada y sin solapes | `apps/backend/tests/pdf.layout.visual.guard.test.ts` | Verificado |
| REQ-008 | Negrita, cursiva y subrayado | `apps/backend/tests/pdf.layout.visual.guard.test.ts` | Verificado |
