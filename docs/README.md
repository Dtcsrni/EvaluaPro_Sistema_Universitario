# Documentación de EvaluaPro

Centro documental de producto, operación, cumplimiento y arquitectura de
EvaluaPro. La fuente de verdad actual es `docente-local` nativo para Windows,
en candidata `1.1.1`, pendiente del resultado Go de la gate estable.

## Lectura por objetivo
- Negocio/licencia: `comercial/FEATURE_CATALOG.md`, `comercial/LICENSING_TIERS.md`, `comercial/ESTRATEGIA_COMERCIAL.md`, `comercial/playbook-demo-35d.md`.
- Seguridad/cumplimiento: `SECURITY_POLICY.md`, `CUMPLIMIENTO.md`, `legal/*`.
- Operación técnica: `DESPLIEGUE.md`, `INSTALLER_HUB.md`, `SINCRONIZACION_ENTRE_COMPUTADORAS.md`, `POLITICA_OPTIMIZACION_RECURSOS.md`.
- Estado de distribución: `RELEASE_STATUS.md`, `TAGGING_POLICY.md`.
- Arquitectura/calidad: `ARQUITECTURA.md`, `ARQUITECTURA_C4.md`, `DESIGN.md`, `PRUEBAS.md`, `RELEASE_GATE_STABLE.md`.
- Footprint/limpieza: `POLITICA_OPTIMIZACION_RECURSOS.md` (peso operativo, componentes regenerables y mantenimiento Docker).
- Utilidades IA: `docs/POLITICA_ECONOMIA_TOKENS_CODEX.md`, `scripts/ai-model-router.mjs` y `npm run ai:model:pick` para seleccionar modelo segun tarea, riesgo y presupuesto.
- Prueba local del router: `npm run test:ai:model-router`.

## Documentos auto-generados
- `AUTO_DOCS_INDEX.md`
- `AUTO_ENV.md`
- `comercial/FEATURE_CATALOG.md`

## Comandos de sincronizacion documental
- `npm run docs:generate`
- `npm run docs:commercial:sync`
- `npm run docs:sync`

<!-- AUTO:COMMERCIAL-CONTEXT:START -->
## Contexto Comercial y Soporte

- Rol de este documento: Documentacion funcional/operativa para despliegue, seguridad y cumplimiento.
- Edicion Comunitaria (AGPL): flujo operativo base para uso real.
- Edicion Comercial/Institucional: mas automatizacion, soporte SLA, endurecimiento y hoja de ruta prioritaria por nivel.
- Catalogo dinamico de capacidades: [FEATURE_CATALOG](comercial/FEATURE_CATALOG.md).
- Licenciamiento comercial y modalidades de pago: [LICENSING_TIERS](comercial/LICENSING_TIERS.md).
- Ultima sincronizacion automatica: 2026-06-23.
<!-- AUTO:COMMERCIAL-CONTEXT:END -->
