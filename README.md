# EvaluaPro | Evaluacion Universitaria

EvaluaPro convierte el flujo academico completo en un proceso trazable y repetible: diseno de examen, impresion PDF, aplicacion, lectura OMR, calificacion y publicacion.

| Categoria | Estado |
| --- | --- |
| Core | [![CI Checks](https://github.com/Dtcsrni/EvaluaPro_Sistema_Universitario/actions/workflows/ci.yml/badge.svg?branch=main)](https://github.com/Dtcsrni/EvaluaPro_Sistema_Universitario/actions/workflows/ci.yml) [![CI Policy Audit](https://github.com/Dtcsrni/EvaluaPro_Sistema_Universitario/actions/workflows/ci-policy-audit.yml/badge.svg?branch=main)](https://github.com/Dtcsrni/EvaluaPro_Sistema_Universitario/actions/workflows/ci-policy-audit.yml) |
| Seguridad y Release | [![Security CodeQL](https://github.com/Dtcsrni/EvaluaPro_Sistema_Universitario/actions/workflows/security-codeql.yml/badge.svg?branch=main)](https://github.com/Dtcsrni/EvaluaPro_Sistema_Universitario/actions/workflows/security-codeql.yml) [![Installer Windows](https://github.com/Dtcsrni/EvaluaPro_Sistema_Universitario/actions/workflows/ci-installer-windows.yml/badge.svg?branch=main)](https://github.com/Dtcsrni/EvaluaPro_Sistema_Universitario/actions/workflows/ci-installer-windows.yml) [![Release Beta](https://github.com/Dtcsrni/EvaluaPro_Sistema_Universitario/actions/workflows/release-beta.yml/badge.svg?branch=main)](https://github.com/Dtcsrni/EvaluaPro_Sistema_Universitario/actions/workflows/release-beta.yml) [![CI Antivirus Gate](https://github.com/Dtcsrni/EvaluaPro_Sistema_Universitario/actions/workflows/ci-antivirus-gate.yml/badge.svg?branch=main)](https://github.com/Dtcsrni/EvaluaPro_Sistema_Universitario/actions/workflows/ci-antivirus-gate.yml) [![Package Images](https://github.com/Dtcsrni/EvaluaPro_Sistema_Universitario/actions/workflows/package.yml/badge.svg?branch=main)](https://github.com/Dtcsrni/EvaluaPro_Sistema_Universitario/actions/workflows/package.yml) |
| Release Governance | [![Release Stable Gate](https://github.com/Dtcsrni/EvaluaPro_Sistema_Universitario/actions/workflows/release-stable-gate.yml/badge.svg?branch=main)](https://github.com/Dtcsrni/EvaluaPro_Sistema_Universitario/actions/workflows/release-stable-gate.yml) |
| Modulos | [![CI Backend Module](https://github.com/Dtcsrni/EvaluaPro_Sistema_Universitario/actions/workflows/ci-backend.yml/badge.svg?branch=main)](https://github.com/Dtcsrni/EvaluaPro_Sistema_Universitario/actions/workflows/ci-backend.yml) [![CI Frontend Module](https://github.com/Dtcsrni/EvaluaPro_Sistema_Universitario/actions/workflows/ci-frontend.yml/badge.svg?branch=main)](https://github.com/Dtcsrni/EvaluaPro_Sistema_Universitario/actions/workflows/ci-frontend.yml) [![CI Portal Module](https://github.com/Dtcsrni/EvaluaPro_Sistema_Universitario/actions/workflows/ci-portal.yml/badge.svg?branch=main)](https://github.com/Dtcsrni/EvaluaPro_Sistema_Universitario/actions/workflows/ci-portal.yml) [![CI Docs Module](https://github.com/Dtcsrni/EvaluaPro_Sistema_Universitario/actions/workflows/ci-docs.yml/badge.svg?branch=main)](https://github.com/Dtcsrni/EvaluaPro_Sistema_Universitario/actions/workflows/ci-docs.yml) |
| Documentacion y Automatizacion | [![Auto-Generate Docs](https://github.com/Dtcsrni/EvaluaPro_Sistema_Universitario/actions/workflows/autogen-docs.yml/badge.svg?branch=main)](https://github.com/Dtcsrni/EvaluaPro_Sistema_Universitario/actions/workflows/autogen-docs.yml) |

Esta version del repositorio sigue un enfoque **Nucleo Abierto**:
- **Edicion gratuita (AGPL)**: cubre el flujo minimo que realmente resuelve operacion docente diaria.
- **Ediciones comercial e institucional**: habilitan capacidades avanzadas por nivel, soporte y compromisos de hoja de ruta.

## Propuesta de Valor Comercial
- Reduce reprocesos en captura/calificacion con flujos validados en CI.
- Minimiza riesgo operativo con contratos de API, OMR y release.
- Permite adopcion progresiva: iniciar gratis, contratar un plan comercial individual de entrada y escalar sin migracion de plataforma.

## Ediciones y Licenciamiento
- `Edicion Comunitaria (AGPLv3)`: uso del nucleo abierto bajo `LICENSE`.
- `Edicion Comercial` y `Edicion Institucional`: `LICENSE-COMMERCIAL.md`.
- Nivel comercial de entrada recomendado (docente): `Docente Esencial` (1 docente, calidad/precio).
- Promocion comercial de prueba: `35 dias` con consentimiento informado para uso de datos operativos y de adopcion.
- Modalidades comerciales: mensual, semestral, anual y pago unico recomendado.
- Detalle de niveles: [docs/comercial/LICENSING_TIERS.md](docs/comercial/LICENSING_TIERS.md).
- Estrategia comercial: [docs/comercial/ESTRATEGIA_COMERCIAL.md](docs/comercial/ESTRATEGIA_COMERCIAL.md).
- Monetizacion de la Edicion Comunitaria: [docs/comercial/MONETIZACION_EDICION_COMUNITARIA.md](docs/comercial/MONETIZACION_EDICION_COMUNITARIA.md).
- Analisis de mercado LATAM: [docs/comercial/MERCADO_LATAM_ANALISIS.md](docs/comercial/MERCADO_LATAM_ANALISIS.md).
- Modelo de pricing: [docs/comercial/MODELO_PRECIOS_LATAM.md](docs/comercial/MODELO_PRECIOS_LATAM.md).
- Arquitectura de oferta por perfil: [docs/comercial/ARQUITECTURA_OFERTA_PERFIL_NIVELES.md](docs/comercial/ARQUITECTURA_OFERTA_PERFIL_NIVELES.md).

## Funciones actuales
Las funciones se sincronizan automaticamente desde rutas activas del backend + evidencia de pruebas.

<!-- AUTO:FEATURES:START -->
## Funciones Confiables por Persona

_Lista auto-sincronizada desde rutas reales del backend + evidencia de pruebas._

| Categoria | Docente | Coordinacion | Institucional | Socio de Canal |
| --- | --- | --- | --- | --- |
| Aplicacion y Captura | 2 | 2 | 2 | 2 |
| Calificacion | 3 | 3 | 3 | 3 |
| Cumplimiento | 0 | 0 | 1 | 1 |
| Gobernanza | 0 | 1 | 1 | 1 |
| Integraciones | 1 | 1 | 1 | 1 |
| Operacion Academica | 2 | 2 | 2 | 2 |
| Operacion Distribuida | 1 | 2 | 2 | 2 |
| Plataforma | 2 | 2 | 2 | 2 |
| Preparacion de Examenes | 2 | 2 | 2 | 2 |
| Seguridad | 1 | 1 | 1 | 1 |

- Totales por persona: Docente: 14 · Coordinacion: 16 · Institucional: 17 · Socio de Canal: 17.
- Catalogo completo: [docs/comercial/FEATURE_CATALOG.md](docs/comercial/FEATURE_CATALOG.md)
<!-- AUTO:FEATURES:END -->

## Hoja de Ruta Comercial (Promesas por Nivel)
- `Edicion Comunitaria`: estabilidad del nucleo y mejoras publicas sin SLA.
- `Edicion Comercial`: prioridad en automatizacion docente y productividad.
- `Edicion Institucional`: compromisos formales de hoja de ruta, cumplimiento y soporte institucional.

Hoja de ruta de producto/ingenieria: [docs/ROADMAP_REQUISITOS.md](docs/ROADMAP_REQUISITOS.md).

## Seguridad y Cumplimiento
- Politica de seguridad: [docs/SECURITY_POLICY.md](docs/SECURITY_POLICY.md)
- Cumplimiento Mexico/Hidalgo: [docs/CUMPLIMIENTO.md](docs/CUMPLIMIENTO.md)
- Aviso de privacidad: [docs/legal/aviso-privacidad-integral.md](docs/legal/aviso-privacidad-integral.md)
- Procedimiento ARCO: [docs/legal/procedimiento-arco.md](docs/legal/procedimiento-arco.md)

## Instalacion y Uso
- Releases: [GitHub Releases](https://github.com/Dtcsrni/EvaluaPro_Sistema_Universitario/releases)
- Instalacion oficial (usuario final): `EvaluaPro-InstallerHub-<flavor>.exe` (fuente unica para instalacion y prerequisitos)
- Installer Hub (Windows): [docs/INSTALLER_HUB.md](docs/INSTALLER_HUB.md)
- Desarrollo local:
```bash
npm install
npm run dev:backend
npm run dev:frontend
```

## Evidencia Tecnica
- Pipeline/gates: `npm run pipeline:contract:check`
- QA full: `npm run qa:full`
- Catalogo dinamico y README sync: `npm run docs:commercial:sync`
- Changelog: [CHANGELOG.md](CHANGELOG.md)

## Contacto Comercial
Para cotizacion de licencias comerciales, despliegue institucional y soporte, escribir a `armsystechno@gmail.com` y adjuntar:
- volumen de alumnos/docentes,
- modalidad (local, hibrido, cloud),
- requerimientos de cumplimiento y SLA.

Sitio comercial para GitHub Pages (landing de promocion/licencias): `site/`.

<!-- AUTO:COMMERCIAL-CONTEXT:START -->
## Contexto Comercial y Soporte

- Rol de este documento: Presentacion comercial del producto y decision de compra/licencia.
- Edicion Comunitaria (AGPL): flujo operativo base para uso real.
- Edicion Comercial/Institucional: mas automatizacion, soporte SLA, endurecimiento y hoja de ruta prioritaria por nivel.
- Catalogo dinamico de capacidades: [FEATURE_CATALOG](docs/comercial/FEATURE_CATALOG.md).
- Licenciamiento comercial y modalidades de pago: [LICENSING_TIERS](docs/comercial/LICENSING_TIERS.md).
- Ultima sincronizacion automatica: 2026-02-27.
<!-- AUTO:COMMERCIAL-CONTEXT:END -->


- Operacion del sistema comercial integral: [docs/comercial/SISTEMA_COMERCIAL_OPERACION.md](docs/comercial/SISTEMA_COMERCIAL_OPERACION.md)
