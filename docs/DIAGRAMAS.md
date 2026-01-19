# Diagramas

Este catálogo incluye los diagramas necesarios para entender el sistema end-to-end.

Fuentes Mermaid: `docs/diagramas/src/`.
SVG renderizados: `docs/diagramas/rendered/`.

## Actualización automática (fuentes)

Los `.mmd` incluyen un bloque comentado `%% AUTO:START system_model ... %% AUTO:END system_model`.
Ese bloque se genera desde el código (prefijos y superficies de rutas) para ayudar a mantener
los diagramas sincronizados con el estado real del sistema.

- Generar/actualizar: `npm run diagramas:generate`
- Verificar en CI: `npm run diagramas:check`

Tip: para poner todo en sync de una vez (fuentes + SVG + docs auto): `npm run docs:sync`

## Render a SVG (automatizado)

Para mantener `docs/diagramas/rendered/**` en sync con las fuentes Mermaid:

- Renderizar SVG: `npm run diagramas:render`
- Verificar SVG en CI: `npm run diagramas:render:check`

Si tu entorno no puede ejecutar Chromium/Puppeteer (raro, pero puede pasar en CI),
puedes desactivar temporalmente el check con `DIAGRAMAS_RENDER_CHECK=0`.

## Consistencia semantica (rutas)

Valida que las rutas HTTP mencionadas en los diagramas de secuencia correspondan con el código:

- Portal alumno cloud: valida método + path exacto.
- Backend: valida método + path exacto (derivado de los routers montados); si no puede resolver algún router, hace fallback a validar el montaje.

Comando: `npm run diagramas:consistencia:check`

Nota: el bloque `system_model` actualiza el **código** de las fuentes Mermaid; el render produce los SVG.

## Arquitectura general

![Arquitectura logica](diagramas/rendered/arquitectura/arquitectura-logica.svg)

![Arquitectura despliegue](diagramas/rendered/arquitectura/arquitectura-despliegue.svg)

## C4 (contexto, contenedores, componentes)

![C4 contexto](diagramas/rendered/c4/arquitectura-c4-context.svg)

![C4 contenedores](diagramas/rendered/c4/arquitectura-c4-container.svg)

![C4 componentes API docente (core)](diagramas/rendered/c4/arquitectura-c4-component.svg)

![C4 componentes API docente (integraciones)](diagramas/rendered/c4/arquitectura-c4-component-integraciones.svg)

## Flujos principales

![Flujo de examen](diagramas/rendered/flujos/flujo-examen.svg)

![Secuencia login docente](diagramas/rendered/secuencias/secuencia-login-docente.svg)

![Secuencia publicacion](diagramas/rendered/secuencias/secuencia-publicacion.svg)

![Secuencia portal alumno](diagramas/rendered/secuencias/secuencia-portal-alumno.svg)

## Modelo de datos (documentos)

![Modelo de datos local](diagramas/rendered/datos/modelo-datos-local.svg)

![Modelo de datos cloud](diagramas/rendered/datos/modelo-datos-cloud.svg)

## Fuentes Mermaid
- `docs/diagramas/src/arquitectura/arquitectura-logica.mmd`
- `docs/diagramas/src/arquitectura/arquitectura-despliegue.mmd`
- `docs/diagramas/src/c4/arquitectura-c4-context.mmd`
- `docs/diagramas/src/c4/arquitectura-c4-container.mmd`
- `docs/diagramas/src/c4/arquitectura-c4-component.mmd`
- `docs/diagramas/src/c4/arquitectura-c4-component-integraciones.mmd`
- `docs/diagramas/src/flujos/flujo-examen.mmd`
- `docs/diagramas/src/secuencias/secuencia-login-docente.mmd`
- `docs/diagramas/src/secuencias/secuencia-publicacion.mmd`
- `docs/diagramas/src/secuencias/secuencia-portal-alumno.mmd`
- `docs/diagramas/src/datos/modelo-datos-local.mmd`
- `docs/diagramas/src/datos/modelo-datos-cloud.mmd`
