---
id: SPEC-079
titulo: Contratos versionados y evolución independiente de módulos
version: 1.0.0
fecha: 2026-10-11
autor: Codex
modulo: arquitectura-backend
estado: implemented
---

## Contexto

EvaluaPro mantiene un monolito modular backend de 21 módulos. El inventario inicial detectó 42 dependencias dirigidas entre módulos y tres ciclos: alumnos/papelera, Classroom/evaluaciones y el componente calificación/sincronización/analíticas. El gate `qa:clean-architecture:strict` pasa, pero no inspecciona límites ni compatibilidad de módulos. La aplicación docente local y su SQLite requieren una sola composición y proceso de release; separar despliegues o introducir microservicios no aporta valor demostrado.

Esta spec implementa evolución independiente dentro del monolito: cada módulo ofrece una entrada pública explícita, declara su versión de contrato y dependencias, y el host verifica compatibilidad antes de integrar. Se preservan las rutas, contratos HTTP, datos persistidos y comportamiento vigente. Las dependencias entre dominios se expresan mediante APIs públicas; los ciclos se eliminan mediante extracción de contratos compartidos o inversión de dependencias. El esquema y las migraciones de SQLite/Prisma siguen centralizados, con propiedad explícita por módulo y migraciones compatibles hacia delante y atrás durante la ventana admitida.

## Requisitos Funcionales

- REQ-001: publicar un registro versionado para los 21 módulos backend con versión SemVer de API, rango de compatibilidad con EvaluaPro, dependencias y versiones de contrato consumidas.
- REQ-002: exponer cada módulo por `index.ts`; los módulos no pueden importar archivos privados de otro módulo.
- REQ-003: el gate estático debe resolver imports TypeScript relativos, comparar dependencias reales con el registro, rechazar dependencias no declaradas y detectar ciclos. El gate genera un reporte reproducible sin incluir código fuente ni datos operativos.
- REQ-004: eliminar los ciclos alumnos/papelera y calificación/sincronización cloud sin cambiar rutas HTTP, autorización, resultados ni persistencia.
- REQ-005: el registro debe definir la propiedad de modelos/tablas persistidos y el contrato de migración. Ninguna entidad persistida puede quedar sin propietario o tener más de uno; los cambios son aditivos primero y destructivos solo tras vencer la ventana de compatibilidad declarada.
- REQ-006: la CI ejecuta el chequeo de contratos para cambios de backend y arquitectura; pruebas de módulo más consumidores transitivos afectados son el primer nivel, y las suites backend/portal completas siguen como gate de integración/release.
- REQ-007: documentar inventario módulo por módulo, dependencias, contratos públicos, propiedad de datos, riesgos y secuencia de migración. Mantener el monolito modular y SQLite local; no añadir dependencias de runtime ni microservicios.
- REQ-008: el verificador falla con mensajes accionables ante versión inválida, rango de host incompatible, import privado, dependencia fuera del registro, ciclo o propiedad de datos ausente/duplicada.

## Criterios de Aceptación

- Los 21 módulos tienen una entrada pública y exactamente un descriptor versionado en el registro.
- Todo import entre módulos usa la entrada pública; no hay ciclos; el grafo observado coincide con las dependencias declaradas.
- Los ciclos iniciales observados antes del cambio están eliminados sin alterar comportamiento funcional.
- Cada modelo persistido del backend tiene propietario único y estrategia de migración documentada; una prueba del verificador demuestra que rechaza una entidad sin propietario y propiedad duplicada.
- Las pruebas automatizadas cubren caso válido, import profundo, dependencia no declarada, ciclo, compatibilidad SemVer de host y propiedad de persistencia.
- `qa:clean-architecture:strict`, `npm run lint`, `npm run typecheck`, pruebas de contrato, backend y portal pasan. También pasan los gates globales definidos en AGENTS.md; cualquier gate bloqueado por entorno se reporta con su evidencia exacta.
- La documentación de arquitectura distingue estado implementado de fases futuras y no afirma independencia de despliegue.

## Matriz de Trazabilidad

| ID Requisito | Descripción del Caso | Archivo de Test Vinculado | Estado |
| --- | --- | --- | --- |
| REQ-001 | Registro único y versiones SemVer/rangos de host válidos para todos los módulos | `scripts/tests/module-contract-check.test.mjs` | Verificado: registro real y fixture compatible |
| REQ-002 | Import externo dirigido a la entrada pública del módulo | `scripts/tests/module-contract-check.test.mjs` | Verificado: imports profundos rechazados |
| REQ-003 | Resolver grafo real, dependencias declaradas y ciclos | `scripts/tests/module-contract-check.test.mjs` | Verificado: 39 dependencias declaradas, cero ciclos |
| REQ-004 | Verificar los ciclos iniciales y sus sustitutos unidireccionales | `scripts/tests/module-contract-check.test.mjs` y suites backend CI | Verificado: Classroom, alumnos/papelera, calificación/OMR |
| REQ-005 | Propiedad única de cada modelo persistido y compatibilidad de migraciones | `scripts/tests/module-contract-check.test.mjs` | Verificado: 76 propietarios; ausencia y duplicidad rechazadas |
| REQ-006 | Integración del gate estructural con clean architecture y CI afectada | `scripts/tests/clean-architecture-check.test.mjs` y `ci/affected-test-map.json` | Verificado: gate y selección afectados registrados |
| REQ-007 | Inventario y límites vigentes en la documentación | `docs/ARQUITECTURA.md` | Verificado: 21 módulos, datos y límites de despliegue documentados |
| REQ-008 | Mensajes/fallos verificables para cada violación del contrato | `scripts/tests/module-contract-check.test.mjs` | Verificado: rangos, dependencias, ciclos y propiedad inválidos rechazados |

## Evidencia de validación

- En verde: `npm ci` (0 vulnerabilidades), `npm run lint`, `npm run typecheck`, `npm run test:module-contracts` (10/10), `npm run test:frontend:ci` (406 pruebas), `npm run test:backend:ci` (56 lotes), `npm run test:portal:ci` (32 pruebas), `npm run test:tdd:enforcement:ci`, `npm run api:contract:check`, `npm run pipeline:contract:check` (41/41), `npm run ci:policy:audit` y `npm run sdd:audit`.
- Limitaciones del entorno: `npm run test:coverage:ci` agotó el timeout de 8 minutos en lotes de PDF/OMR de larga duración, sin fallos de aserción registrados; `npm run perf:check` no inició mediciones porque `NODE_ENV=production` requiere `JWT_SECRETO`, ausente en el entorno. No se inventó la credencial.
