---
id: SPEC-054
titulo: Evolucion integral de identidad visual, UX/UI y rendimiento del frontend
version: 1.3.0
fecha: 2026-09-02
autor: EvaluaPro Team
modulo: frontend_experiencia_completa
estado: approved
---

## Contexto

El frontend de EvaluaPro expone superficies para docente, alumno y administración
de negocio. La funcionalidad está cubierta por módulos y pruebas, pero la presentación
acumula clases, tokens, superficies y layouts históricos. La evolución debe conservar
los contratos funcionales y establecer una identidad única, legible, responsive y
eficiente.

## Dirección aprobada

La identidad es **Petróleo Prismático** con glass operativo: el vidrio expresa jerarquía
de superficie mediante transparencia, blur, borde, reflejo y sombra controlados, pero
ningún texto crítico depende de la transparencia. Se adopta la estrategia recomendada:
glass marcado de densidad media, navegación docente agrupada por dominio, migración
progresiva desde foundations hacia las tres aplicaciones y radios de 8 px para controles,
12 px para tarjetas y 16 px para shells principales. La iconografía se mantiene vectorial,
policromática y semántica, con colores funcionales visibles por dominio sin depender de
duotono, raster ni glifos monocromáticos.
En escritorio amplio, el encabezado conserva identidad, contrato OMR, tema y salida en
una sola línea; el wrapping queda reservado para anchos menores, sin desplazar ni ocultar
la acción primaria.

## Alcance

- Fundaciones de color, tipografía, espaciado, radios, capas, sombras, motion y focus.
- Primitivas reutilizables para superficies, botones, campos, tabs, badges, mensajes,
  tablas/listas, diálogos, estados vacíos y toasts.
- Iconografía vectorial policromática de alta nitidez y control de cuenta docente con
  identidad, rol, estados de interacción y área táctil accesible.
- Shell y navegación de docente, alumno y admin negocio.
- Pantallas docentes: autenticación, materias, alumnos, asistencias, temarios, banco,
  plantillas, entrega, escaneo, calificaciones, evaluaciones, Classroom, sincronización,
  rehidratación y cuenta.
- Pantallas de alumno: acceso, resumen, materias, agenda, avisos, historial, resultados,
  detalle, revisión, conformidad y PDF.
- Pantallas de negocio: dashboard, tenants, planes, suscripciones, licencias, cupones,
  campañas, plantillas, cobranza y auditoría.
- Rendimiento de carga inicial, carga diferida por destino/módulo, CSS y procesamiento
  de imágenes.

## Requisitos Funcionales

- REQ-001: Los colores de pantalla deben consumirse desde tokens semánticos de la
  identidad canónica; los nuevos módulos no pueden introducir hexadecimales locales.
- REQ-002: Las superficies deben usar variantes compartidas y fallback opaco equivalente.
- REQ-003: Los controles deben tener estados default, hover, active, focus-visible,
  disabled, loading y error cuando aplique.
- REQ-004: Texto normal debe conservar contraste mínimo 4.5:1 y texto grande 3:1 en
  claro y oscuro; el estado no debe depender solo del color.
- REQ-005: La navegación debe exponer contexto, ubicación actual y acción primaria sin
  obligar a recorrer una tira horizontal extensa en desktop.
- REQ-006: Formularios, guías y detalles avanzados deben usar revelación progresiva sin
  ocultar errores ni cambios sin guardar.
- REQ-007: Las pantallas deben conservar semántica HTML, orden de teclado, landmarks,
  nombres accesibles y soporte para reduced motion.
- REQ-008: La carga inicial no debe importar módulos pesados de otros destinos; OCR,
  QR y pantallas complejas deben cargarse bajo demanda.
- REQ-009: La migración visual no debe cambiar APIs, persistencia, permisos ni reglas
  de negocio.
- REQ-010: Cada oleada debe incluir prueba contractual, prueba responsive, contraste y
  captura visual autenticada de sus estados principal, loading, empty, error y success.
- REQ-011: Los comandos frontend que cargan Vite/Vitest deben usar un cargador de
  configuración compatible con Windows sin depender de escritura temporal en
  `node_modules/.vite-temp`.
- REQ-012: Los íconos de navegación y acciones deben conservar nitidez vectorial,
  diferenciación cromática por función, reconocimiento visual a tamaños pequeños y
  etiquetas accesibles; el control de cuenta docente debe ser operable, legible y
  diferenciable de versión, tema y salida.
- REQ-013: En anchos de escritorio amplio el encabezado docente debe mantener sus
  acciones principales en una sola fila; en anchos menores debe replegarse de forma
  determinista sin overflow horizontal ni pérdida de contexto.

## Oleadas de implementación

1. Foundations, primitivas y contrato de layout.
2. Shell, navegación y autenticación.
3. Docente: materias, alumnos, asistencias y temarios.
4. Docente: banco, plantillas, entrega, escaneo y calificaciones.
5. Docente: evaluaciones, Classroom, sincronización, rehidratación y cuenta.
6. Alumno completo.
7. Admin negocio completo.
8. Rendimiento, accesibilidad, responsive y auditoría visual final.

## Criterios de Aceptación

- Las tres aplicaciones usan los mismos tokens y primitivas, con acento semántico por
  dominio.
- No hay superficies principales con contraste insuficiente o texto ilegible sobre glass.
- La navegación docente es operable con teclado y no requiere scroll horizontal para
  encontrar acciones primarias en desktop.
- La interfaz funciona en 360, 768, 1024 y 1440 px sin solapamientos críticos.
- En 1366 px o más, las acciones del encabezado docente permanecen en una sola fila;
  en 390 px el encabezado y la navegación siguen siendo legibles y accionables.
- `prefers-reduced-motion`, foco, labels y mensajes de error tienen cobertura automática.
- La carga diferida se comprueba en el bundle y en una medición de navegación real.
- Se ejecutan los gates frontend aplicables y se documentan fallos preexistentes separados.

## Matriz de Trazabilidad

| Requisito | Evidencia | Estado |
| --- | --- | --- |
| REQ-001 a REQ-007 | `scripts/tests/ui-cards.contract.test.mjs`, `scripts/tests/ui-contrast-audit.mjs`, `apps/frontend/tests/ux.quality.test.tsx` | Parcial, ampliación por oleada |
| REQ-008 | `scripts/tests/frontend-performance.contract.test.mjs` y chunks de `npm -C apps/frontend run build` | Implementado en oleada 1 |
| REQ-009 | Suite funcional existente del frontend | Protegido |
| REQ-010 | `apps/frontend/tests/ux.visual.test.tsx` y auditoría visual autenticada pendiente | Pendiente por pantalla |
| REQ-011 | `scripts/tests/frontend-performance.contract.test.mjs` y scripts de `apps/frontend/package.json` | Implementado en oleada 1 |
| REQ-012 | `apps/frontend/src/ui/iconos.tsx`, `apps/frontend/src/apps/app_docente/ShellDocente.tsx`, `scripts/tests/ui-cards.contract.test.mjs` | Implementado en oleada 2 |
| REQ-013 | `apps/frontend/src/styles/cards.css`, `tests/gui-responsive/responsive-docente.spec.ts` y capturas `reports/qa/latest/gui-docente-*.png` | Implementado en oleada 3 |

## Fuera de alcance

- Cambios de API, modelo de datos, autenticación, permisos o lógica de evaluación.
- Dependencias nuevas de producción sin especificación y aprobación separadas.
- Cambios en Installer Hub nativo; se planifica después de cerrar las tres superficies web.
