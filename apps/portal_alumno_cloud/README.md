# apps/portal_alumno_cloud — API Portal Alumno Cloud de EvaluaPro

Servicio de consulta cloud y sincronización distribuida para **alumnos universitarios**, optimizado para alta concurrencia, lectura ultrarrápida y resiliencia ante cortes de red.

> **Estado:** Línea base oficial estable `v1.1.1`.  
> Implementa el protocolo de sincronización batch [`SPEC-047`](../../docs/specs/SPEC-047_portal_alumno_cloud.spec.md) y [`SPEC-048`](../../docs/specs/SPEC-048_sincronizacion_offline_cloud.spec.md).

---

## Capacidades Principales

- **Consulta Segura:** Autenticación de alumnos por matrícula universitaria y código temporal de verificación.
- **Historial de Evaluaciones:** Acceso al desglose de respuestas por reactivo, reactivos de recuperación y constancias digitales.
- **Sincronización Idempotente:** Endpoint `POST /api/portal/sincronizar` compatible con `schemaVersion: 3` (y retrocompatibilidad con versión 2), con control de colisiones mediante upsert atómico por folio de examen.
- **Protección Perimetral:** Rate Limiting por IP/matrícula, cabeceras de seguridad Helmet y validación estricta de esquemas Zod.

---

## Endpoints de la API

| Método | Ruta | Acceso | Descripción |
| :--- | :--- | :--- | :--- |
| `POST` | `/api/portal/sincronizar` | Interno (`PORTAL_API_KEY`) | Sincronización batch desde el backend docente |
| `GET` | `/api/portal/perfil` | Alumno (Bearer JWT) | Datos del alumno y materias cursadas |
| `GET` | `/api/portal/materias` | Alumno (Bearer JWT) | Listado de materias activas y calificaciones |
| `GET` | `/api/portal/agenda` | Alumno (Bearer JWT) | Próximas evaluaciones y fechas límite |
| `GET` | `/api/portal/avisos` | Alumno (Bearer JWT) | Avisos institucionales y publicaciones de docentes |
| `GET` | `/api/portal/historial`| Alumno (Bearer JWT) | Histórico de exámenes y desgloses OMR |

---

## Desarrollo Local

Desde la raíz:
```bash
npm run dev:portal
```

Directamente en el módulo:
```bash
npm --prefix apps/portal_alumno_cloud run dev
```

### Ejecución de Pruebas
```bash
npm run test:portal:ci
```

---

## Configuración y Variables de Entorno

| Variable | Propósito | Valor por defecto (dev) |
| :--- | :--- | :--- |
| `PUERTO_PORTAL` / `PORT` | Puerto de escucha HTTP | `8080` |
| `DATABASE_URL` | Conexión de persistencia Prisma | `file:./data/portal_alumno.db` |
| `PORTAL_API_KEY` | Clave secreta para sincronización backend docente | Clave autogenerada en dev |
| `JWT_SECRETO` | Secreto de firmado para sesiones de alumnos | Clave autogenerada en dev |

---

## Documentación y Referencias
- [Especificación Portal Alumno Cloud (`SPEC-047`)](../../docs/specs/SPEC-047_portal_alumno_cloud.spec.md)
- [Especificación Sincronización Offline-Cloud (`SPEC-048`)](../../docs/specs/SPEC-048_sincronizacion_offline_cloud.spec.md)
- [Políticas de Seguridad](../../docs/SEGURIDAD.md)

<!-- AUTO:COMMERCIAL-CONTEXT:START -->
## Contexto Comercial y Soporte

- Rol de este documento: Referencia tecnica del portal cloud de consulta del alumno.
- Edicion Comunitaria (AGPL): flujo operativo base para uso real.
- Edicion Comercial/Institucional: mas automatizacion, soporte SLA, endurecimiento y hoja de ruta prioritaria por nivel.
- Catalogo dinamico de capacidades: [FEATURE_CATALOG](../../docs/comercial/FEATURE_CATALOG.md).
- Licenciamiento comercial y modalidades de pago: [LICENSING_TIERS](../../docs/comercial/LICENSING_TIERS.md).
- Ultima sincronizacion automatica: 2026-08-28.
<!-- AUTO:COMMERCIAL-CONTEXT:END -->
