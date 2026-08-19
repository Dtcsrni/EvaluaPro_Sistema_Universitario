---
id: SPEC-014
titulo: Flujo Inicial de Registro Docente y Establecimiento de Licencia
version: 1.0.0
fecha: 2026-08-19
autor: Antigravity / DeepMind
modulo: modulo_autenticacion
estado: implemented
---

# Flujo Inicial de Registro Docente y Establecimiento de Licencia

## Contexto

En el primer uso de la aplicación de escritorio EvaluaPro (modo docente local o standalone), el usuario requiere una experiencia de onboarding inmediata que permita:
1. Registrar su cuenta docente con sus datos institucionales.
2. Ingresar y validar la clave o código de activación de su licencia institucional.

Anteriormente la aplicación abría por defecto en el modo de inicio de sesión convencional para usuarios ya existentes. Esta especificación formaliza que la primera interacción del docente nuevo sea el formulario de registro y activación de licencia.

## Requisitos Funcionales

- **REQ-001 (Modo Inicial de Registro):** Al iniciar la aplicación sin una sesión activa o en una instalación nueva, la pantalla de autenticación debe mostrar por defecto la vista de **Registro de Docente**.
- **REQ-002 (Campo de Licencia):** El formulario de registro debe incorporar un campo para ingresar la **Clave / Código de Activación de Licencia**.
- **REQ-003 (Activación en Backend):** Si se suministra un código de licencia durante el registro (local o Google), el backend debe verificar y activar la licencia asociada al nuevo docente creado.
- **REQ-004 (Alternancia a Inicio de Sesión):** Los usuarios que ya cuenten con credenciales deben poder alternar fluidamente a la pestaña "Ingresar".

## Criterios de Aceptación

1. La pantalla inicial de `AppDocente` renderiza `SeccionAutenticacion` con `modo === 'registrar'`.
2. El formulario de registro incluye el input `codigoLicencia`.
3. El payload enviado a `/autenticacion/registrar` y `/autenticacion/registrar-google` incluye `codigoLicencia` cuando se capture.
4. El backend procesa el alta del usuario e inicializa el registro correctamente.

## Matriz de Trazabilidad

| ID Requisito | Descripción del Caso | Archivo de Test Vinculado | Estado |
| --- | --- | --- | --- |
| REQ-001 | Pantalla inicial en modo registro | `apps/frontend/tests/seccionAutenticacion.test.tsx` | Completado |
| REQ-002 | Entrada de código de licencia | `apps/frontend/tests/seccionAutenticacion.test.tsx` | Completado |
| REQ-003 | Procesamiento de registro con licencia en backend | `apps/backend/tests/validaciones.auth.test.ts` | Completado |
| REQ-004 | Alternancia entre ingresar y registrar | `apps/frontend/tests/seccionAutenticacion.test.tsx` | Completado |
