# Centro Documental de EvaluaPro

Centro neurálgico de arquitectura, especificaciones de desarrollo guiadas por contratos (Spec-Driven Development), operación, calidad y gobernanza de **Sistema EvaluaPro**.

> **Línea Base Oficial:** Versión estable `v1.1.1` para Windows (`docente-local` nativo con Installer Hub WiX Burn + .NET 8).

---

## Estructura y Navegación Documental

### 1. Arquitectura y Diseño
- [Arquitectura Integral del Sistema](ARQUITECTURA.md) — Visión general de módulos y diseño por capas.
- [Arquitectura C4 y Diagramas](ARQUITECTURA_C4.md) — Modelos Context, Container, Component y Code en Mermaid.
- [Sistema de Diseño Visual](DESIGN.md) — Especificación de Bento Elevation, Glassmorphism y accesibilidad.
- [Criterios de Calidad UX](UX_QUALITY_CRITERIA.md) — Estándares contractuales de interfaz y tiempos de respuesta.

### 2. Especificaciones de Desarrollo (Spec-Driven Development - SDD)
El repositorio opera bajo la política estricta de SDD documentada en [`docs/POLITICA_SDD.md`](POLITICA_SDD.md). Todo cambio de código o pruebas responde a una especificación formal:
- **Estudio de Diseño de Exámenes:** [`SPEC-034: Diseño de Exámenes en 3 Pestañas`](specs/SPEC-034_diseno_examenes_tabs.spec.md)
- **Installer Hub:** [`SPEC-035: Hub Selector & Instalación Windows`](specs/SPEC-035_hub_selector_pwa.spec.md)
- **Autenticación & Guardrails:** [`SPEC-036: Seguridad y Sesión Docente`](specs/SPEC-036_autenticacion_guardrails.spec.md)
- **Ciclo de Vida de Materias:** [`SPEC-037: Gestión de Periodos y Materias`](specs/SPEC-037_materias_periodos_lifecycle.spec.md)
- **Roster & Asistencias:** [`SPEC-038: Catálogo de Alumnos`](specs/SPEC-038_alumnos_roster_management.spec.md), [`SPEC-039: Seguimiento de Asistencias`](specs/SPEC-039_asistencias_seguimiento.spec.md)
- **Encuadre & Firmas:** [`SPEC-040: Temarios, Encuadre y Firmas Digitales`](specs/SPEC-040_temarios_encuadre_firmas.spec.md)
- **Banco de Reactivos:** [`SPEC-041: Taxonomía y Banco de Preguntas`](specs/SPEC-041_banco_preguntas_taxonomia.spec.md)
- **Producción OMR & Forense:** [`SPEC-042: Producción de Exámenes`](specs/SPEC-042_diseno_produccion_examenes_omr.spec.md), [`SPEC-044: Motor de Calificación OMR`](specs/SPEC-044_calificaciones_motor_omr.spec.md), [`SPEC-045: Rehidratación Forense`](specs/SPEC-045_rehidratacion_forense.spec.md)
- **Integraciones:** [`SPEC-046: Google Classroom Sync`](specs/SPEC-046_google_classroom_sync.spec.md), [`SPEC-047: Portal Alumno Cloud`](specs/SPEC-047_portal_alumno_cloud.spec.md), [`SPEC-048: Sincronización Offline-Cloud`](specs/SPEC-048_sincronizacion_offline_cloud.spec.md)

### 3. Instalación, Despliegue y Operación
- [Guía de Installer Hub](INSTALLER_HUB.md) — Empaquetado WiX Toolset v5 Burn con Bootstrapper WPF .NET 8.
- [Guía de Despliegue](DESPLIEGUE.md) — Configuración para entornos locales y en la nube.
- [Sincronización entre Computadoras](SINCRONIZACION_ENTRE_COMPUTADORAS.md) — Protocolo de respaldo y migración de datos.
- [Runbook de Operación](RUNBOOK_OPERACION.md) — Procedimientos para incidentes, copias de seguridad y diagnósticos.

### 4. Seguridad, Gobernanza y Cumplimiento
- [Política de Seguridad](SECURITY_POLICY.md) — Cifrado de datos en reposo, sellado HMAC-SHA256 y auditoría.
- [Cumplimiento Normativo](CUMPLIMIENTO.md) — Alineación con marcos de privacidad de datos universitarios.
- [Aviso de Privacidad Integral](legal/aviso-privacidad-integral.md) y [Procedimiento ARCO](legal/procedimiento-arco.md).
- [Política de Versionado](VERSIONADO.md) y [Release Gate Estable](RELEASE_GATE_STABLE.md).

---

## Documentos Generados Automáticamente

- [`AUTO_DOCS_INDEX.md`](AUTO_DOCS_INDEX.md) — Índice exhaustivo de documentación versionada.
- [`AUTO_ENV.md`](AUTO_ENV.md) — Catálogo consolidado de variables de entorno y banderas de feature.
- [`INVENTARIO_CODIGO_EXHAUSTIVO.md`](INVENTARIO_CODIGO_EXHAUSTIVO.md) — Catálogo de archivos, líneas y módulos del proyecto.

### Comandos de Sincronización
```bash
# Sincronizar índices y contratos de documentación
npm run docs:generate
npm run docs:commercial:sync
npm run docs:sync

# Regenerar inventario completo de código
npm run inventario:codigo
```

<!-- AUTO:COMMERCIAL-CONTEXT:START -->
## Contexto Comercial y Soporte

- Rol de este documento: Documentacion funcional/operativa para despliegue, seguridad y cumplimiento.
- Edicion Comunitaria (AGPL): flujo operativo base para uso real.
- Edicion Comercial/Institucional: mas automatizacion, soporte SLA, endurecimiento y hoja de ruta prioritaria por nivel.
- Catalogo dinamico de capacidades: [FEATURE_CATALOG](comercial/FEATURE_CATALOG.md).
- Licenciamiento comercial y modalidades de pago: [LICENSING_TIERS](comercial/LICENSING_TIERS.md).
- Ultima sincronizacion automatica: 2026-08-28.
<!-- AUTO:COMMERCIAL-CONTEXT:END -->
