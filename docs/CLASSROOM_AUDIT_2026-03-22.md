# Auditoria Integral Classroom

Fecha de corte: 2026-03-22
Alcance: backend + frontend docente + evidencia de ejecucion local + bloqueo E2E real

## Resultado ejecutivo
- Estado general: `funciona con riesgos`
- Gate interno del repo: `aprobado`
- Gate E2E real con Google Classroom: `bloqueado`
- Conclusión operativa: el módulo Classroom es funcional dentro del repo y tiene cobertura interna suficiente para flujos principales, pero no puede declararse completamente utilizable en este entorno porque faltan credenciales reales y dataset Google para cerrar la fase obligatoria de validación externa.

## Evidencia reproducible
- Suite backend focal Classroom:
  - `npm -C apps/backend run test -- tests/integracion/classroom.audit.test.ts tests/integracion/classroom.pull.test.ts tests/integracion/classroom.v2.test.ts tests/servicioClassroomGoogle.test.ts`
  - resultado: `4` archivos, `17` pruebas, todas en verde
- Suite frontend focal Classroom:
  - `npm -C apps/frontend run test -- tests/centroClassroom.behavior.test.tsx tests/seccionEvaluaciones.test.tsx`
  - resultado: `2` archivos, `4` pruebas, todas en verde
- Comando agregado para rerun integrado:
  - `npm run test:classroom:audit:ci`
- Verificación del entorno real Google:
  - `GOOGLE_CLASSROOM_CLIENT_ID=false`
  - `GOOGLE_CLASSROOM_CLIENT_SECRET=false`
  - `GOOGLE_CLASSROOM_REDIRECT_URI=false`
  - `CLASSROOM_TOKEN_CIPHER_KEY=false`

## Dictamen por funcionalidad
| Funcionalidad | Estado | Evidencia | Nota |
| --- | --- | --- | --- |
| Descubrimiento de capacidad backend/UI | `funciona` | `capacidadesIntegraciones`, ocultamiento UI y test de no disponibilidad | La UI bloquea correctamente si `classroomBackend=false`. |
| Configuración operativa OAuth/Classroom | `funciona con riesgos` | flujo de `SeccionCuenta` + mensajes amigables | Sigue siendo un flujo manual basado en comando PowerShell, no autoaplicable desde UI. |
| Inicio OAuth y callback internos | `funciona` | `servicioClassroomGoogle.test.ts`, `classroom.pull.test.ts` | Cubierto por mocks y rutas reales del backend. |
| Conexión real con Google | `no cumple` | verificación del entorno sin credenciales | Gate obligatorio bloqueado por ausencia de configuración real. |
| Listado de cursos | `funciona` | `classroom.v2.test.ts`, `classroom.audit.test.ts` | Cubierto en éxito, no conectado y error Google. |
| Listado de actividades | `funciona` | `classroom.v2.test.ts`, `centroClassroom.behavior.test.tsx` | Cubierto en flujo feliz interno. |
| Obtención de roster | `funciona` | `classroom.v2.test.ts`, `classroom.audit.test.ts` | Cubierto con roster resuelto y roster vacío. |
| Matching automático por correo/matrícula | `funciona` | `classroom.v2.test.ts` | Estrategias `email` y `matricula` cubiertas. |
| Mapeo manual de alumnos | `funciona` | `classroom.v2.test.ts`, `centroClassroom.behavior.test.tsx` | Persistencia y reflejo UI cubiertos. |
| Preview de importación | `funciona` | `classroom.v2.test.ts`, `classroom.audit.test.ts`, `centroClassroom.behavior.test.tsx` | Cubre éxito, vacío y unmatched visible. |
| Importación persistente | `funciona` | `classroom.v2.test.ts`, `classroom.audit.test.ts` | Cubre persistencia y caso sin persistencia por unmatched. |
| Idempotencia y reimportación | `funciona` | `classroom.pull.test.ts` | Segunda corrida actualiza sin duplicar. |
| Historial y estado de sincronización | `funciona` | `classroom.v2.test.ts`, `centroClassroom.behavior.test.tsx` | Cobertura interna correcta; utilidad UX todavía básica. |
| RBAC y permisos | `funciona` | `rolesPermisos.test.ts` + revisión de RBAC | Docente/coordinador tienen permisos; lector queda bloqueado. |
| Mensajes de error y recuperación UX | `funciona con riesgos` | `centroClassroom.behavior.test.tsx`, `clienteComun.ts` | Hay mensajes amigables, pero el troubleshooting operativo depende demasiado del usuario. |
| Escalabilidad visual y operativa | `funciona con riesgos` | revisión estática de `CentroClassroom.tsx` | No hay búsqueda, filtros ni paginación; preview muestra solo las primeras `12` submissions. |
| Eficiencia/optimalidad del importador | `funciona con riesgos` | revisión estática de `servicioSyncClassroom.ts` | Persisten patrones N+1 en resolución de alumno y lectura por submission. |

## Hallazgos técnicos prioritarios
1. `Bloqueador`: no hay credenciales reales de Google Classroom en el entorno actual; la fase E2E externa no puede ejecutarse.
2. `Riesgo alto`: la UX de configuración sigue siendo manual y técnica desde `SeccionCuenta`; esto reduce la usabilidad real para entornos no administrados.
3. `Riesgo medio`: `servicioSyncClassroom.ts` hace búsquedas por alumno y por evidencia dentro del loop de submissions, lo que eleva costo en cursos grandes.
4. `Riesgo medio`: `CentroClassroom.tsx` no escala bien para grupos grandes; no tiene filtros, búsqueda ni resumen previo más completo.
5. `Riesgo medio`: el historial visible ayuda poco a auditoría humana; muestra ejecución y total procesadas, pero no resume errores o unmatched.

## Cobertura agregada en este corte
- Backend:
  - `apps/backend/tests/integracion/classroom.audit.test.ts`
  - escenarios nuevos: `CLASSROOM_NO_CONECTADO`, `CLASSROOM_API_ERROR`, roster vacío, preview sin submissions, unmatched sin persistencia, paginación de roster y submissions
- Frontend:
  - `apps/frontend/tests/centroClassroom.behavior.test.tsx`
  - escenarios nuevos: no disponibilidad, mensaje amigable por `CLASSROOM_NO_CONFIG`, flujo UI de reconexión OAuth, selección de curso, guardado de mapeo, preview, importación y desconexión

## Recomendación de cierre
- El módulo no debe declararse `completamente utilizable` hasta ejecutar una validación E2E real con:
  - credenciales válidas
  - redirect URI registrada
  - curso real con alumnos y tareas
  - evidencia de importación y reimportación exitosa
- Siguiente endurecimiento recomendado:
  - optimizar el importador para reducir N+1
  - reforzar UX del preview y del historial
  - reducir dependencia de configuración manual operativa
