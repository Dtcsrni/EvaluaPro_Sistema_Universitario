# Arquitectura

## Resumen
EvaluaPro usa arquitectura de monorepo con separacion por aplicaciones:
1. API docente local (`apps/backend`) como sistema de escritura y orquestacion.
2. Frontend docente/alumno (`apps/frontend`) como UI principal.
3. API/portal alumno cloud (`apps/portal_alumno_cloud`) como read-model para consulta de resultados.

## Componentes principales
- Backend docente:
  - Express + TypeScript + Prisma + SQLite.
  - Arquitectura modular por dominio (`modulos/*`).
  - Capas compartidas (`compartido/*`) e infraestructura (`infraestructura/*`).
- Frontend:
  - React + Vite.
  - Apps desacopladas por destino (`app_docente`, `app_alumno`).
- Portal cloud:
  - API orientada a consumo alumno y sincronizacion desde backend local.

## Modulos funcionales backend

| Modulo | Responsabilidad | Depende de | Modelos Prisma |
| --- | --- | --- | --- |
| `modulo_admin_docentes` | Administración de docentes y permisos asociados. | `modulo_autenticacion` | — |
| `modulo_alumnos` | Alumnos, periodos, grupos y padrones. | `modulo_autenticacion`, `modulo_papelera` | `Periodo`, `PeriodoPortada`, `Alumno` |
| `modulo_analiticas` | Consultas analíticas, banderas y exportaciones. | `modulo_autenticacion`, `modulo_calificacion` | `BanderaRevision`, `EventoUso` |
| `modulo_asistencias` | Reglas, sesiones y registros de asistencia. | `modulo_autenticacion` | `AsistenciaRegla`, `AsistenciaSesion`, `AsistenciaRegistro`, `AsistenciaExcepcion` |
| `modulo_autenticacion` | Identidad docente, sesión, autenticación y autorización. | — | `Docente`, `SesionDocente`, `RecuperacionContrasenaDocente` |
| `modulo_banco_preguntas` | Preguntas, reactivos, temas e importaciones versionadas. | `modulo_autenticacion` | `BancoPregunta`, `VersionPregunta`, `OpcionPregunta`, `Reactivo`, `ReactivoVersion`, `ReactivoOpcion`, `ReactivoAsignacion`, `ReactivoImportacion`, `ReactivoImportacionFila`, `ReactivoAsset`, `ReactivoCalibracion`, `TemaBanco`, `TemaBancoAuditoria` |
| `modulo_calificacion` | Calificaciones, revisión y persistencia de notas. | `modulo_autenticacion`, `modulo_escaneo_omr`, `modulo_generacion_pdf` | `PreferenciaRetencionParcial`, `Calificacion`, `CalificacionListaManual`, `CalificacionListaMutacion`, `ResultadoExtraExterno`, `SolicitudRevisionAlumno` |
| `modulo_comercial` | Operaciones comerciales de la aplicación. | `modulo_autenticacion` | — |
| `modulo_comercial_core` | Planes, licencias, suscripciones, tenants y auditoría comercial. | `modulo_autenticacion` | `Tenant`, `Suscripcion`, `Cobranza`, `Licencia`, `Cupon`, `Campana`, `ConsentimientoComercial`, `EventoComercial`, `AuditoriaComercial`, `PlanComercial`, `PlantillaNotificacion` |
| `modulo_compliance` | Cumplimiento, solicitudes de derechos y eventos. | `modulo_autenticacion` | `EventoCumplimiento`, `SolicitudDsr` |
| `modulo_escaneo_omr` | Ingesta y análisis de hojas OMR. | `modulo_autenticacion`, `modulo_generacion_pdf` | `EscaneoOmrArchivado`, `OmrSheetFamily`, `OmrSheetRevision`, `OmrScanJob` |
| `modulo_evaluaciones` | Evidencias, políticas y resúmenes de evaluación. | `modulo_autenticacion` | `PoliticaCalificacion`, `PoliticaCalificacionAuditoria`, `ConfiguracionPeriodoEvaluacion`, `EvidenciaEvaluacion`, `ComponenteExamen`, `ResumenEvaluacionAlumno`, `EncuadreAcademico`, `FirmaEncuadre` |
| `modulo_generacion_pdf` | Plantillas, lotes, PDFs y artefactos de examen. | `modulo_autenticacion`, `modulo_banco_preguntas`, `modulo_papelera` | `ExamenPlantilla`, `PreguntaPlantilla`, `ExamenPlantillaAuditoria`, `ExamenGenerado`, `ExamenRecoveryBundle`, `ExamenLoteArtefactoPdf`, `ExamenLoteArtefactoPdfAuditoria`, `ExamenRecoveryManifest` |
| `modulo_hidratacion_cursos` | Hidratación de datos iniciales de cursos. | `modulo_autenticacion`, `modulo_banco_preguntas` | — |
| `modulo_integraciones_classroom` | Conexión, consulta e importación de Google Classroom. | `modulo_alumnos`, `modulo_autenticacion`, `modulo_evaluaciones` | `IntegracionClassroom`, `BitacoraSyncClassroom`, `MapeoClassroomAlumnoCurso`, `MapeoClassroomEvidencia` |
| `modulo_listas_institucionales` | Listas institucionales por plantilla. | `modulo_autenticacion` | — |
| `modulo_papelera` | Archivo y recuperación lógica de entidades. | `modulo_autenticacion` | `PapeleraItem` |
| `modulo_recuperacion_examenes` | Recuperación y reconstrucción de exámenes. | `modulo_autenticacion`, `modulo_generacion_pdf` | `ReconstruccionExamen` |
| `modulo_sincronizacion_nube` | Paquetes, códigos de acceso y sincronización con portal. | `modulo_alumnos`, `modulo_analiticas`, `modulo_autenticacion`, `modulo_banco_preguntas`, `modulo_calificacion`, `modulo_escaneo_omr`, `modulo_evaluaciones`, `modulo_generacion_pdf`, `modulo_vinculacion_entrega` | `CodigoAcceso`, `Sincronizacion` |
| `modulo_temarios` | Temarios, avance y encuadre curricular. | `modulo_autenticacion` | `Temario`, `TemarioNodo`, `AuditoriaTemario` |
| `modulo_vinculacion_entrega` | Vinculación entre folios y entregas. | `modulo_autenticacion` | `Entrega` |

Cada módulo publica dos superficies separadas: `index.ts` para APIs de dominio y `composition.ts` para la integración con el host (routers y tareas de ciclo de vida). Los módulos y servicios compartidos consumen la API de dominio; `apps/backend/src/rutas.ts` y `apps/backend/src/index.ts` consumen solo la entrada de composición. Así, una API de dominio no carga routers y el host deja de depender de rutas privadas de cada módulo. El registro versiona ambas superficies con SemVer junto con dependencias, compatibilidad del host y propiedad de datos en `docs/contracts/module-contracts.v2.json`.

## Contratos de arquitectura
- Rutas publicas solo en autenticacion y salud.
- El resto del API backend se monta despues de `requerirDocente`.
- Cada endpoint sensible aplica permisos (`requerirPermiso`) por accion.
- El portal cloud trata resultados como vista derivada de sincronizacion, no como fuente primaria de escritura academica.

## Evolución y compatibilidad de módulos

- El despliegue sigue siendo un monolito modular: frontend, API local y portal cloud son aplicaciones del monorepo, pero los módulos backend no se publican ni despliegan por separado.
- Cada módulo tiene `contractVersion` SemVer, `hostCompatibility`, dependencias con rango de contrato, una entrada de dominio `index.ts` y una entrada de host `composition.ts`. El gate `qa:module-contracts:check` resuelve imports con `apps/backend/tsconfig.json`, compara ambas superficies TypeScript con historiales append-only, impide cambios incompatibles sin bump SemVer, rechaza imports privados del host/módulos y ciclos, y comprueba propietario único para cada modelo Prisma. También exige que la versión del host coincida con `package.json`.
- Para actualizar una API de dominio o de composición, cambia primero `contractVersion` según compatibilidad y ejecuta `npm run qa:module-contracts:snapshot`; el comando agrega snapshots a ambos historiales y falla si detecta cambios sin versión nueva o un bump insuficiente.
- Para agregar o cambiar una dependencia: actualizar primero la API pública consumida, declarar el rango en el registro y validar el grafo. Los cambios incompatibles incrementan la versión mayor del contrato y requieren adaptar consumidores antes de integrar el host.
- Prisma y SQLite mantienen una base y migraciones centrales. Aplicar `expand-migrate-contract`: expandir de forma compatible, migrar datos/consumidores y retirar columnas o estructuras solo cuando todos los consumidores hayan superado la ventana de compatibilidad.
- La versión de contrato es actualmente `1.1.0` en todos los módulos y el host admite `>=1.2.6 <2.0.0`. Son límites de integración dentro del monorepo; no representan paquetes publicados ni compatibilidad binaria entre procesos.

## Datos y persistencia
- Fuente primaria local del flavor docente: SQLite administrado por Prisma
  (docentes, materias, alumnos, exámenes, calificaciones y estado operativo).
- Artefactos locales: PDFs y activos OMR en almacenamiento local del backend.
- La consulta alumno usa el portal correspondiente cuando el despliegue lo
  requiere; el sistema docente conserva la fuente operativa local.

## Diagramas
- Arquitectura logica: `diagramas/rendered/arquitectura/arquitectura-logica.svg`
- Arquitectura de despliegue: `diagramas/rendered/arquitectura/arquitectura-despliegue.svg`
- Vista C4: `ARQUITECTURA_C4.md`

## Decisiones tecnicas vigentes
- Monolito modular backend para velocidad de cambio y trazabilidad.
- OMR guiado por mapa geometrico generado junto al PDF.
- Calificacion exacta y auditable con metadatos OMR.
- RBAC por permisos de accion, no por menus.
- Sincronizacion desacoplada (paquete local y push/pull remoto).
