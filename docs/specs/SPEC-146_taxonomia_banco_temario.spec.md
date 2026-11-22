---
id: SPEC-146
titulo: Taxonomia y vinculacion opcional del banco al temario
version: 1.0.0
fecha: 2026-10-23
autor: Codex / EvaluaPro Team
modulo: modulo_banco
estado: approved
---

## Contexto
El docente necesita organizar reactivos por categoría y tema, recategorizarlos en lote y, cuando le resulte útil, relacionar esa taxonomía con el temario de la materia. La clasificación propia del banco debe seguir disponible cuando no se vincule el temario.

## Requisitos Funcionales
- **REQ-001:** Cada tema del banco pertenece a una categoría; categorías agrupan temas. Los datos existentes permanecen utilizables.
- **REQ-002:** El docente puede seleccionar varios reactivos y reasignarlos en lote a un tema destino; la operación conserva consistencia entre registros legacy y asignaciones canónicas.
- **REQ-003:** Una categoría puede vincularse opcionalmente con un nodo de nivel 1 del temario y un tema con un nodo de nivel 2 del mismo periodo. Los vínculos se pueden omitir o quitar.
- **REQ-004:** La API valida propiedad docente, periodo y nivel del nodo antes de guardar vínculos; rechaza nodos ajenos o de nivel incorrecto.

## Criterios de Aceptación
1. Las pantallas de gestión del banco permiten clasificar temas por categoría y consultar/actualizar los vínculos opcionales al temario.
2. La recategorización masiva cambia la asignación en lote sin perder consistencia de las representaciones legacy y canónica.
3. Los nodos de temario de nivel 1/2 pueden vincularse respectivamente a categoría/tema, y los nodos de otro periodo o nivel se rechazan.
4. Las clasificaciones sin vínculo al temario y registros previos siguen siendo operables.
5. La API y los contratos publicados describen los campos y mutaciones incorporados.

## Matriz de Trazabilidad

| ID Requisito | Descripción del Caso | Archivo de Test Vinculado | Estado |
| --- | --- | --- | --- |
| REQ-001 | Gestión de categoría y tema de banco | `apps/frontend/tests/bancoGestionTemas.test.tsx` | Verificado |
| REQ-002 | Reasignación masiva de reactivos | `apps/backend/tests/bancoPreguntas.controlador.test.ts` | Verificado |
| REQ-003 | Vinculación opcional al temario | `apps/backend/tests/bancoPreguntas.controlador.test.ts` | Verificado |
| REQ-004 | Validación de periodo y nivel del nodo | `apps/backend/tests/bancoPreguntas.controlador.test.ts` | Verificado |
