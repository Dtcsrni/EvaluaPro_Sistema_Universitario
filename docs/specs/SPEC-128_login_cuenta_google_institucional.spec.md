---
id: SPEC-128
titulo: Sugerencia de última cuenta institucional en login Google
version: 1.0.0
fecha: 2026-10-28
autor: Docente / Codex
modulo: modulo_autenticacion
estado: implemented
---

# SPEC-128: Sugerencia de última cuenta institucional en login Google

## Contexto

El botón de acceso Google en el navegador lateral sugiere una cuenta personal que no corresponde al docente. La persona solicitó que EvaluaPro sugiera la última cuenta institucional usada, inicialmente `Erick.vega@cuh.mx`, y mantenga una vía visible para escoger otra cuenta.

## Requisitos Funcionales

- REQ-001: El botón principal de inicio de sesión Google pasa `login_hint` con `Erick.vega@cuh.mx` como valor inicial.
- REQ-002: Después de un inicio de sesión aceptado por la API, la UI recuerda localmente solo el correo del ID token Google aceptado si `email_verified` es verdadero y el dominio termina en `@cuh.mx` (sin distinguir mayúsculas). No guarda tokens ni credenciales en esta preferencia.
- REQ-003: Un correo personal, una credencial no verificada, una respuesta de API fallida o un fallo de `localStorage` no reemplaza la última cuenta institucional ni interrumpe el login.
- REQ-004: El control visible «Usar otra cuenta» vuelve a renderizar el botón Google sin `login_hint`; al elegir la cuenta institucional guardada se restaura la sugerencia actual.
- REQ-005: El hint solo orienta a Google. La API conserva la validación de credencial y cuenta existente; no se usa el correo guardado para autenticar ni autorizar.
- REQ-006: Las pruebas aisladas usan los puertos de desarrollo y la cinta de entorno visible con su versión; no reinician, escriben ni consultan la base de producción.

## Criterios de Aceptación

1. Sin preferencia almacenada, el widget principal recibe `login_hint="Erick.vega@cuh.mx"`.
2. Una cuenta institucional verificada se recuerda solo después de que `/autenticacion/google` responde correctamente.
3. Un correo Gmail, `email_verified=false`, error API o almacenamiento bloqueado deja intacta la última sugerencia y no rompe el flujo.
4. «Usar otra cuenta» elimina el hint del widget; «Volver a mi cuenta institucional» restaura el último hint.
5. Registro y recuperación Google conservan el comportamiento existente, sin recibir esta preferencia de login.
6. El entorno de prueba se distingue como DESARROLLO con versión en todas las vistas y usa UI 4174/API 4001.
7. Build, pruebas focalizadas, lint y guardas de accesibilidad no introducen regresiones.

## Matriz de Trazabilidad

| ID Requisito | Descripción del Caso | Archivo de Test Vinculado | Estado |
| --- | --- | --- | --- |
| REQ-001, REQ-003 | Valor inicial, normalización de dominio y degradación segura de almacenamiento | `apps/frontend/tests/googleLoginHint.test.ts` | Implementado; pruebas focalizadas aprobadas |
| REQ-002, REQ-003 | Recordar únicamente correo institucional verificado tras éxito API | `apps/frontend/tests/seccionAutenticacion.test.tsx` | Implementado; pruebas focalizadas aprobadas |
| REQ-004, REQ-005 | Alternar hint del widget; conservar callback de autenticación | `apps/frontend/tests/seccionAutenticacion.test.tsx` | Implementado; pruebas focalizadas aprobadas |
| REQ-006 | Ribbon de dev y separación de puertos | `apps/frontend/tests/RuntimeEnvironmentRibbon.test.tsx` | Implementado; pruebas focalizadas aprobadas |
