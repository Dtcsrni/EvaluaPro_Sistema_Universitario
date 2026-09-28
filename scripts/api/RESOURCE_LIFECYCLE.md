# Inventario de ciclo de vida API por recurso

Este inventario refleja el checkout `codex/api-topic-audit` durante la fase de cierre de SPEC-070. Es backlog verificable, no una afirmación de cobertura. Cada operación debe contrastarse con router montado, controlador/servicio, permisos, persistencia, SDK y flujo GUI equivalente.

## Criterios de cobertura

- **Lectura:** listado con filtros/paginación cuando el historial pueda crecer, detalle por ID y aislamiento por docente/tenant.
- **Alta y cambio:** validación estricta; misma lógica y persistencia que GUI; concurrencia/idempotencia/auditoría cuando repetir o perder una respuesta pueda duplicar o alterar el resultado.
- **Baja:** preferir archivo/estado de dominio. La eliminación física solo existe cuando la retención y las relaciones lo permiten; nunca añadir un `DELETE` genérico que destruya historial académico, de OMR o de auditoría.
- **Acciones:** importación, revisión, publicación, generación, clasificación y calificación conservan previsualización, procedencia, permisos y recuperación específicos.
- **Correspondencia:** los wrappers SDK y `AGENTS.md` solo presentan como disponibles rutas montadas y probadas. OpenAPI por sí solo no prueba que una ruta exista.

## Brechas confirmadas en rutas documentadas

El generador inspecciona declaraciones literales de los routers. La auditoría inicial halló 43 operaciones OpenAPI con `x-evaluapro-router` sin declaración correspondiente. Esta fase montó nueve operaciones (`GET /alumnos/{alumnoId}`, `GET /examenes/plantillas/{id}`, `GET /omr/jobs`, `GET /omr/jobs/{jobId}`, `GET /entregas`, `GET /entregas/{entregaId}` y el ciclo de metadatos/expiración de códigos de acceso); quedan 34 operaciones. El generador marca las no montadas como `pending-router`, `deprecated` y `x-evaluapro-available: false`; el comprobador exige que cada brecha aparezca en este inventario.

| Recurso/flujo | Operaciones documentadas pero no montadas | Estado/decisión requerida |
| --- | --- | --- |
| Banco de reactivos: importación | `GET /banco-preguntas/importaciones/esquema`, `GET /banco-preguntas/importaciones/plantilla.xlsx`, `GET /banco-preguntas/importaciones`, `GET /banco-preguntas/importaciones/{importId}`, `POST /banco-preguntas/importaciones/preview`, `POST /banco-preguntas/importaciones/{importId}/confirmar` | Montar el ciclo preview→confirmación idempotente sobre un servicio canónico compartido con GUI, o retirar los wrappers. Hoy el router implementa el CRUD legacy `BancoPregunta`, no la importación canónica anunciada. |
| Banco de reactivos: lectura y ciclo de revisión | `GET /banco-preguntas/reactivos`, `GET /banco-preguntas/reactivos/{reactivoId}`, `GET /banco-preguntas/reactivos/{reactivoId}/versiones`, `POST /banco-preguntas/reactivos/{reactivoId}/revisar`, `POST /banco-preguntas/reactivos/{reactivoId}/publicar`, `POST /banco-preguntas/reactivos/{reactivoId}/retirar` | El modelo Prisma legacy no almacena `estado`, asignaciones canónicas ni procedencia/hash por versión. No proyectar estados inventados: definir persistencia/adaptación explícita antes de habilitar estos contratos. |
| Banco de reactivos: calibración | `GET /banco-preguntas/reactivos/{reactivoId}/calibracion`, `POST /banco-preguntas/reactivos/{reactivoId}/calibracion` | No hay controlador ni almacenamiento declarado para parámetros/resultados de calibración. Definir datos y procedencia antes de exponer escritura. |
| Clasificación OMR: ingesta PDF | `POST /omr/ingestas`, `GET /omr/ingestas/{jobId}`, `GET /omr/ingestas/por-clave/{clientRequestId}`, `GET /omr/ingestas/{jobId}/manifiesto`, `GET /omr/ingestas/{jobId}/originales/{fileId}`, `GET /omr/ingestas/{jobId}/paquetes/{packageId}`, `POST /omr/ingestas/{jobId}/paginas/{pageIndex}/resolver` | Distinguirlo del workflow existente `/omr/jobs`: falta un router/servicio de ingesta durable y su ciclo de artefactos. Definir retención, recuperación idempotente, resolución y no escritura de calificaciones. |
| Calificaciones: lista académica | `GET /analiticas/lista-academica`, `POST /analiticas/lista-academica/calificaciones` | Ruta anunciada por SDK/contrato pero no montada. Definir el servicio académico y proteger cualquier escritura con concurrencia, clave idempotente y auditoría; no escribir notas en esta fase. |
| Lotes de exámenes | `GET /examenes/generados/lotes`, `GET /examenes/generados/lote/{loteId}/auditoria`, `POST /examenes/generados/lote/{loteId}/archivar`, `POST /examenes/generados/lote/{loteId}/restaurar` | Completar lectura/auditoría y estados sobre el artefacto persistido; verificar hash/estructura al restaurar y conservar referencias OMR/calificación. No editar artefactos generados en sitio. |
| Evidencias de evaluación | `GET /evaluaciones/evidencias/{evidenciaId}`, `PUT /evaluaciones/evidencias/{evidenciaId}`, `POST /evaluaciones/evidencias/{evidenciaId}/archivar`, `POST /evaluaciones/evidencias/{evidenciaId}/restaurar` | El router actual solo monta lista y alta. Separar evidencia manual de Classroom (fuente externa), añadir control de versión/motivo/auditoría y no permitir CRUD genérico sobre datos sincronizados. |
| Temarios | `GET /temarios/{temarioId}`, `PUT /temarios/{temarioId}`, `GET /temarios/{temarioId}/auditoria` | El router actual lista, crea, elimina y actualiza estados de nodos, pero no declara detalle/edición/auditoría que el SDK y `AGENTS.md` anuncian. Preservar historial de avance y notas al editar. |

## Lecturas montadas durante esta fase

- `GET /alumnos/{alumnoId}`: scoped por relación `Alumno.periodo.docenteId`; responde 404 si no existe o pertenece a otro docente.
- `GET /examenes/plantillas/{id}`: delega al `obtenerPlantillaDocente` compartido, devuelve IDs de preguntas en orden y responde 404/403 con el aislamiento de plantilla existente.
- `GET /omr/jobs` y `GET /omr/jobs/{jobId}`: reutilizan el DTO público del job, excluyen el contenido fuente y aíslan por docente. El listado pagina por `createdAt,id`, filtra por assessment/status y limita 100 por página.
- `GET /entregas` y `GET /entregas/{entregaId}`: exigen permiso `entregas:gestionar`, aplican aislamiento docente, filtros por examen/alumno/periodo/lote/estado y paginación estable. La respuesta usa una selección explícita de campos y resúmenes asociados, sin exponer la fila completa de examen/alumno.
- `GET /sincronizaciones/codigo-acceso`, `GET /sincronizaciones/codigo-acceso/{codigoAccesoId}` y `POST /sincronizaciones/codigo-acceso/{codigoAccesoId}/expirar`: las lecturas excluyen el secreto `codigo`; la expiración aplica una transición condicional e idempotente y escribe evento de cumplimiento en la misma transacción. La generación existente sigue devolviendo el secreto una sola vez.

## Inventario que falta completar

Las 34 operaciones anteriores son las diferencias OpenAPI/router encontradas en la auditoría focal, no el inventario completo de modelos. Aún debe clasificarse cada modelo Prisma (`apps/backend/prisma/schema.prisma`) como recurso de API operable, agregado interno, dato derivado, artefacto inmutable, secreto o registro de auditoría; después debe documentarse su ciclo soportado y motivo de cualquier operación ausente. No crear CRUD genérico para entidades internas o relacionadas si el servicio de dominio no lo permite.

## Validación de cada cierre de brecha

1. Probar ruta autenticada, permiso, tenant/docente, entradas inválidas y resultado incierto cuando aplique.
2. Probar que una operación API y el componente/servicio GUI consultan o mutan la misma persistencia.
3. Actualizar el wrapper del SDK, OpenAPI y catálogo solo para rutas montadas.
4. Añadir un gate que falle ante operaciones OpenAPI con `x-evaluapro-router` sin declaración en su archivo fuente.
