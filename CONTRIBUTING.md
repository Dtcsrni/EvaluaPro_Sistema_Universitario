# Contribucion

## Modelo de repositorio
- Core abierto: AGPL-3.0-or-later.
- Componentes comerciales: fuera del alcance de PR publicos.

## Reglas
1. No subir datos personales reales, respaldos operativos ni secretos.
2. Todo cambio funcional debe incluir pruebas.
3. Mantener trazabilidad en `CHANGELOG.md` y docs tecnicas.
4. Respetar contratos API y gates CI.

## Calidad de codigo (lint/typecheck)
- Ejecuta validaciones desde raiz antes de abrir PR:
	- `npm run lint`
	- `npm run typecheck`
- El repositorio ya está alineado a ESLint 9 con `eslint.config.cjs` (flat config) en raíz y apps.
- No uses `ESLINT_USE_FLAT_CONFIG=false` en flujo normal de contribución.

## Seguridad
- Reportes responsables: armsystechno@gmail.com
- No abrir incidencias publicas para vulnerabilidades activas.

## Cumplimiento
Al contribuir, aceptas que el proyecto aplica politicas de privacidad y
saneamiento de datos descritas en `docs/legal/*` y `docs/SECURITY_POLICY.md`.
