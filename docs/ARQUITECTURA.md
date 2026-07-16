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
- `modulo_autenticacion`
- `modulo_alumnos`
- `modulo_banco_preguntas`
- `modulo_generacion_pdf`
- `modulo_vinculacion_entrega`
- `modulo_escaneo_omr`
- `modulo_calificacion`
- `modulo_analiticas`
- `modulo_sincronizacion_nube`
- `modulo_admin_docentes`
- `modulo_papelera`
- `modulo_compliance`

## Contratos de arquitectura
- Rutas publicas solo en autenticacion y salud.
- El resto del API backend se monta despues de `requerirDocente`.
- Cada endpoint sensible aplica permisos (`requerirPermiso`) por accion.
- El portal cloud trata resultados como vista derivada de sincronizacion, no como fuente primaria de escritura academica.

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
