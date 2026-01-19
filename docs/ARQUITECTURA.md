# Arquitectura

## Resumen
La plataforma se divide en dos piezas:
1) Backend y frontend docente local (monolito modular).
2) Servicio cloud separado para portal alumno (solo lectura).

## Componentes principales
- Backend docente: Express + MongoDB + TypeScript.
- Frontend docente/alumno: React + Vite + TypeScript.
- Cloud Run: servicio portal alumno (API lectura + UI app_alumno).

## Capas del backend
- `modulos/`: dominio de negocio (alumnos, banco, PDF, OMR, calificación, etc.).
- `infraestructura/`: adaptadores externos (DB, archivos, correo).
- `compartido/`: errores, validaciones, tipos y utilidades.

## Diagrama de arquitectura (lógico)
Fuente: `docs/diagramas/src/arquitectura/arquitectura-logica.mmd`

![Arquitectura logica](diagramas/rendered/arquitectura/arquitectura-logica.svg)

## Diagrama de despliegue (local + nube)
Fuente: `docs/diagramas/src/arquitectura/arquitectura-despliegue.mmd`

![Arquitectura despliegue](diagramas/rendered/arquitectura/arquitectura-despliegue.svg)

Ver todos los diagramas en `docs/DIAGRAMAS.md`.

Ver la versión C4 en `docs/ARQUITECTURA_C4.md`.

## Decisiones clave
- Monolito modular local: menos complejidad, fácil mantenimiento.
- Servicio cloud separado: alta disponibilidad para alumno sin exponer red local.
- Calificacion exacta: Decimal.js y fraccion almacenada.
- PDF carta: baja tinta, márgenes seguros y QR en cada página.
- PDFs locales se almacenan en `data/examenes` (ignorado por git).
- Autenticación docente con JWT y validación por objeto.
- Portal alumno con codigo de acceso temporal (12h, 1 uso).
- OMR guiado por mapa de posiciones generado junto al PDF.
- Sincronizacion local -> cloud protegida por API key.

## Nomenclatura
- Rutas, variables y modulos en espanol mexicano con camelCase.
- Colecciones en plural (docentes, alumnos, etc.).
