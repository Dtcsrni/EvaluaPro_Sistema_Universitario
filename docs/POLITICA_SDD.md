# Política de Spec-Driven Development (SDD)

Este documento define la política de **Spec-Driven Development (SDD)** vigente de forma mandatoria en todo el monorepo. Todos los desarrolladores y agentes de IA deben seguir estrictamente este flujo de trabajo.

---

## 1. Declaración de la Política

Ningún cambio de código de producción, refactorización estructural o adición de pruebas automatizadas se puede realizar sin una **Especificación Técnica (Spec)** previa que describa el comportamiento deseado. La Spec es la **fuente de verdad absoluta** para el comportamiento operativo y comercial del sistema.

---

## 2. Ciclo de Vida de una Spec

Cada especificación pasa por tres estados bien definidos en su YAML frontmatter:

1. **draft (Borrador):** La spec se está redactando o está sujeta a cambios/discusión. No se puede escribir código de producción basado en ella.
2. **approved (Aprobada):** La spec ha sido revisada y aprobada por el usuario (u otros agentes). A partir de este momento, se puede iniciar el desarrollo de las pruebas automatizadas (TDD) y del código.
3. **implemented (Implementada):** El código ha sido desarrollado, los tests pasan en verde en CI, y la matriz de trazabilidad está completamente verificada.

---

## 3. Estructura Obligatoria de una Spec

Todas las especificaciones deben almacenarse en markdown bajo la ruta `docs/specs/*.spec.md` y cumplir con la siguiente estructura:

### 3.1) YAML Frontmatter (Metadatos)
Debe ir al inicio del archivo y contener exactamente estos campos:
```yaml
---
id: SPEC-XXX                # Identificador único de spec (ej. SPEC-001)
titulo: Nombre de la Spec    # Título corto y descriptivo
version: 1.0.0              # Versión semántica de la spec
fecha: YYYY-MM-DD           # Fecha de última modificación
autor: Nombre/Agente        # Autor o autores
modulo: modulo_x            # Módulo afectado (ej. modulo_asistencias, devops)
estado: draft|approved|implemented
---
```

### 3.2) Secciones Obligatorias
El cuerpo del archivo markdown debe contener, como mínimo, las siguientes secciones:

- `## Contexto`: Explicación del problema, justificación de negocio, valor comercial y usuarios (Personas) beneficiados.
- `## Requisitos Funcionales`: Lista clara y estructurada de casos de uso, flujos alternativos, validaciones y reglas de negocio detalladas.
- `## Criterios de Aceptación`: Definición objetiva de cuándo se considera terminado el desarrollo (aserciones lógicas esperadas).
- `## Matriz de Trazabilidad`: Una tabla que mapea cada Requisito Funcional con su archivo de pruebas automatizadas de Vitest/Playwright real en el monorepo.

---

## 4. Matriz de Trazabilidad

Para asegurar que las especificaciones no queden obsoletas, la matriz de trazabilidad debe seguir este formato de tabla:

| ID Requisito | Descripción del Caso | Archivo de Test Vinculado | Estado |
| --- | --- | --- | --- |
| REQ-001 | El sistema debe rechazar emails inválidos | `apps/backend/tests/validar.test.ts` | Completado |

### Reglas de Validación de la Matriz:
- El campo **Archivo de Test Vinculado** debe contener una ruta de archivo relativa válida dentro del monorepo (por ejemplo, `apps/backend/tests/validar.test.ts`).
- Si el archivo indicado no existe en el sistema de archivos, el auditor de SDD lanzará un error y bloqueará el pipeline.

---

## 5. Auditoría Automatizada (DevOps)

El cumplimiento de esta política se audita automáticamente a través de dos mecanismos:
1. **Auditor de Specs (`npm run sdd:audit`):** Analiza todas las especificaciones bajo `docs/specs/*.spec.md` para garantizar que cumplan con el frontmatter requerido, las secciones obligatorias y que los tests declarados en la matriz existan realmente.
2. **Gate de Integración en CI (`npm run ci:policy:audit`):** Corre el auditor de specs de forma obligatoria y bloqueante. Si alguna spec viola la política o tiene tests rotos/inexistentes, el build fallará automáticamente.
