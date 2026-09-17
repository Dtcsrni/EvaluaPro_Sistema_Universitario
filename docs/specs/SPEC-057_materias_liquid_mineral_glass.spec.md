---
id: SPEC-057
titulo: Vista Materias con identidad Liquid Mineral Glass
version: 1.0.0
fecha: 2026-09-14
autor: EvaluaPro Team
modulo: frontend_materias
estado: approved
---

## Contexto

La vista docente de Materias concentra la configuración de asignaturas, grupos,
fechas y alumnos. Su identidad visual actual depende demasiado de brillos neon,
capas anidadas y sombras luminosas. Se requiere una evolución hacia Liquid Mineral
Glass: vidrio muy transparente y visible, con refracción y profundidad, combinado
con tonos mate de petróleo, pizarra, lavanda, salvia, ocre y coral.

## Requisitos Funcionales

- **REQ-001 (Identidad visual mate):** La vista usa una paleta semántica mate y no
  depende de colores neon ni halos `0 0` para comunicar jerarquía.
- **REQ-002 (Liquid glass progresivo):** Las superficies pueden ser muy
  transparentes cuando el fondo es estable; formularios, validaciones y contenido
  denso usan una capa de respaldo más opaca sin reducir la legibilidad del texto.
- **REQ-003 (Jerarquía de Materias):** La pantalla presenta una acción primaria
  visible para registrar materia, un catálogo de materias activas y la acción
  contextual para abrir grupo.
- **REQ-004 (Estados y contraste):** Materia activa, cierre próximo, progreso,
  éxito, advertencia y riesgo se distinguen por color y texto, sin depender solo
  del color.
- **REQ-005 (Compatibilidad funcional):** No cambian APIs, persistencia, permisos,
  navegación, nombres accesibles ni acciones CRUD existentes.
- **REQ-006 (Responsive y reduced motion):** La composición conserva lectura y
  operación en desktop, tablet y móvil, incluyendo `prefers-reduced-motion`.

## Criterios de Aceptación

1. La vista Materias conserva los controles existentes para guía, alta, edición,
   archivado, descargas y apertura de grupos.
2. La acción primaria `Registrar materia` es visible en el encabezado y abre el
   formulario existente sin duplicar lógica.
3. Las tarjetas usan superficies glass transparentes con borde y sombra mate; no
   usan halos luminosos como mecanismo principal de separación.
4. El tema claro y oscuro conserva texto legible y estados semánticos visibles.
5. Pasan el test específico de Materias, `ux.quality`, typecheck, lint y build del
   frontend.

## Matriz de Trazabilidad

| ID Requisito | Descripción del Caso | Archivo de Test Vinculado | Estado |
| --- | --- | --- | --- |
| REQ-001 | Paleta y contrato visual | `scripts/tests/gui-design-contract.test.mjs` | Pendiente de ejecución |
| REQ-002 | Superficies glass y contraste | `apps/frontend/tests/ux.visual.test.tsx` | Pendiente de ejecución |
| REQ-003 | Alta y navegación de materias | `apps/frontend/tests/seccionPeriodos.edit.test.tsx` | Protegido |
| REQ-004 | Estados y ayuda contextual | `apps/frontend/tests/ux.quality.test.tsx` | Protegido |
| REQ-005 | Acciones y permisos | `apps/frontend/tests/seccionPeriodos.listasInstitucionales.test.tsx` | Protegido |
| REQ-006 | Responsive y reduced motion | `apps/frontend/tests/gui.responsive.contract.test.tsx` | Pendiente de ejecución |
