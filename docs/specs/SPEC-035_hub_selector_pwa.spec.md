---
id: SPEC-035
titulo: Hub Principal, Selector de Aplicaciones y Ruteo PWA
version: 1.0.0
fecha: 2026-08-26
autor: Antigravity / EvaluaPro Team
modulo: modulo_hub
estado: implemented
---

## Contexto
EvaluaPro ofrece una arquitectura multiapp orientada a diferentes roles universitarios (Plataforma Docente, Portal Alumno Cloud, Administrador de Negocio y Utilidades de Instalación). El Hub Principal (`AppSelector.tsx` / `App.tsx`) debe proporcionar un ruteo transparente, soporte offline PWA y diagnóstico de conexión por red local con código QR para dispositivos móviles.

## Requisitos Funcionales
- **REQ-001 (Detección de Rol y Hash Routing)**: El Hub debe permitir la navegación entre las aplicaciones del sistema mediante hash de URL (`#docente`, `#alumno`, `#admin`, `#version`) y persistir la última vista seleccionada.
- **REQ-002 (PWA & Service Worker)**: La aplicación debe registrar los manifests PWA institucionales según el rol activo, asegurando capacidad offline y caché segura de assets estáticos.
- **REQ-003 (Diagnóstico Móvil QR)**: El Hub debe exponer una herramienta de diagnóstico que detecte la IP local del servidor y genere un código QR interactivo para permitir que dispositivos móviles escaneen y accedan a la aplicación en la red local.

## Criterios de Aceptación
1. Al cargar la app sin hash, se presenta el selector inicial de aplicaciones.
2. Al ingresar con token de docente, se renderiza la Plataforma Docente envuelta en su shell.
3. El panel de diagnóstico móvil muestra la IP detectada y permite configurar un host manual.
4. El contrato de Service Worker mantiene las peticiones de API como `network-only`.

## Matriz de Trazabilidad

| ID Requisito | Descripción del Caso | Archivo de Test Vinculado | Estado |
| --- | --- | --- | --- |
| REQ-001 | Ruteo por hash y selector de apps por rol | `apps/frontend/tests/app.selector.test.tsx` | Completado |
| REQ-002 | Contratos de PWA y Service Worker | `apps/frontend/tests/pwa.contract.test.ts` | Completado |
| REQ-003 | Diagnóstico móvil y generación de QR | `apps/frontend/tests/qrAccesoMovil.test.tsx` | Completado |
