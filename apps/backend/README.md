# apps/backend — API Docente Local de EvaluaPro

API docente centralizada de **Sistema EvaluaPro (EP)**, construida con arquitectura limpia, TypeScript estricto, motor OMR por visión computacional (TV3/TV4) y persistencia nativa con **Prisma ORM sobre SQLite embebido** para operación local offline-first.

> **Estado:** Línea base oficial estable `v1.1.1`.  
> Cumple el 100% de los contratos de Spec-Driven Development (SDD: `SPEC-034` a `SPEC-049`).

---

## Stack Tecnológico
- **Runtime:** Node.js 24 (ESM + TypeScript estricto)
- **Framework Web:** Express con endurecimiento de seguridad (Helmet, CORS restrictivo, Rate Limiting, sanitización Zod)
- **Persistencia:** Prisma ORM con base de datos nativa SQLite (offline-first local) y compatibilidad multi-motor
- **Visión Computacional & OMR:** Motor TV3/TV4 con detección de fiduciales, normalización afín, decodificación QR HMAC-SHA256 y umbrales adaptativos
- **Documentos & Reportes:** Generador PDF vectorial de exámenes y hojas de respuesta, exportador XLSX/DOCX sanitizado con firmas criptográficas

---

## Módulos y Capacidades del Dominio

| Módulo | Responsabilidad | Especificación SDD |
| :--- | :--- | :--- |
| **`modulo_autenticacion`** | Sesión docente local, JWT seguro, TOTP step-up y guardrails | [`SPEC-036`](../../docs/specs/SPEC-036_autenticacion_guardrails.spec.md) |
| **`modulo_alumnos`** | Catálogo de alumnos, roster por grupo y tracking de asistencia | [`SPEC-038`](../../docs/specs/SPEC-038_alumnos_roster_management.spec.md), [`SPEC-039`](../../docs/specs/SPEC-039_asistencias_seguimiento.spec.md) |
| **`modulo_banco_preguntas`**| Taxonomía de reactivos, opciones múltiples, discriminación y dificultad | [`SPEC-041`](../../docs/specs/SPEC-041_banco_preguntas_taxonomia.spec.md) |
| **`modulo_generacion_pdf`** | Producción de cuadernillos foliados, QR de integridad y bundle de recuperación | [`SPEC-042`](../../docs/specs/SPEC-042_diseno_produccion_examenes_omr.spec.md) |
| **`modulo_escaneo_omr`** | Procesamiento de lotes de hojas escaneadas (PNG/JPG/PDF), cálculo de confianza y rescoring | [`SPEC-044`](../../docs/specs/SPEC-044_calificaciones_motor_omr.spec.md) |
| **`modulo_analiticas`** | Libros de calificaciones sanitizados, exportación DOCX/XLSX y firma SHA256 | [`SPEC-040`](../../docs/specs/SPEC-040_temarios_encuadre_firmas.spec.md) |
| **`modulo_sincronizacion_nube`** | Publicación batch hacia el Portal Alumno Cloud (`schemaVersion: 3`) y Google Classroom | [`SPEC-046`](../../docs/specs/SPEC-046_google_classroom_sync.spec.md), [`SPEC-048`](../../docs/specs/SPEC-048_sincronizacion_offline_cloud.spec.md) |

---

## Desarrollo Local

Desde la raíz del repositorio:
```bash
npm run dev:backend
```

O directamente dentro del módulo:
```bash
npm --prefix apps/backend run dev
```

### Preparación de Base de Datos SQLite
Para preparar o migrar la base de datos local SQLite de forma idempotente:
```bash
node scripts/prepare-docente-sqlite.mjs
```

---

## Ejecución de Pruebas

```bash
# Suite completa de backend (unitarias + integración + contratos)
npm run test:backend:ci

# Pruebas con cobertura
npm run test:coverage:ci

# Verificación de aislamiento docente y roles
npm run test:docente:isolated
```

---

## Configuración y Variables de Entorno

El backend opera de forma autónoma con valores predeterminados seguros para desarrollo local. En producción, la configuración se lee desde el entorno o archivo `.env` validado:

| Variable | Propósito | Valor por defecto (dev) |
| :--- | :--- | :--- |
| `PUERTO_API` / `PORT` | Puerto de escucha HTTP | `4000` |
| `DATABASE_URL` | Conexión Prisma (SQLite) | `file:./data/evaluapro.db` |
| `JWT_SECRETO` | Secreto de firmado para tokens de sesión | Clave autogenerada en dev |
| `OMR_QR_HMAC_SECRET` | Secreto HMAC para sellado criptográfico de QR | Clave institucional |
| `PORTAL_ALUMNO_URL` | URL del portal cloud de alumnos | `http://localhost:8080` |
| `PORTAL_ALUMNO_API_KEY`| Token de autenticación hacia el portal cloud | Configurable |

---

## Documentación y Referencias
- [Arquitectura C4 y Diagramas](../../docs/ARQUITECTURA_C4.md)
- [Contratos y Especificaciones SDD](../../docs/specs/)
- [Seguridad y Protección de Datos](../../docs/SEGURIDAD.md)

<!-- AUTO:COMMERCIAL-CONTEXT:START -->
## Contexto Comercial y Soporte

- Rol de este documento: Referencia tecnica del backend docente y sus contratos API.
- Edicion Comunitaria (AGPL): flujo operativo base para uso real.
- Edicion Comercial/Institucional: mas automatizacion, soporte SLA, endurecimiento y hoja de ruta prioritaria por nivel.
- Catalogo dinamico de capacidades: [FEATURE_CATALOG](../../docs/comercial/FEATURE_CATALOG.md).
- Licenciamiento comercial y modalidades de pago: [LICENSING_TIERS](../../docs/comercial/LICENSING_TIERS.md).
- Ultima sincronizacion automatica: 2026-08-28.
<!-- AUTO:COMMERCIAL-CONTEXT:END -->
