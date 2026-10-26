---
id: SPEC-126
titulo: Login docente-local con OAuth Desktop y PKCE
version: 1.0.0
fecha: 2026-10-26
autor: Codex / EvaluaPro
modulo: modulo_autenticacion
estado: approved
---

## Contexto

La instalación limpia de `docente-local` no incluye el Client ID web de Google Identity Services. El login docente queda limitado a contraseña local y no establece `Docente.googleSub`; el flujo Classroom, correctamente, rechaza conectar una identidad sin verificar. El producto ya distribuye un Client ID OAuth público de tipo escritorio para Classroom, pero todavía no lo usa para el login docente. La docente aprobó usar OAuth Desktop con PKCE para que Classroom y el login requerido por su identidad funcionen sin copiar `.env`.

## Requisitos Funcionales

- **REQ-001 (Login nativo distribuido):** `docente-local` puede iniciar sesión y registrar una cuenta docente con el Client ID Desktop versionado, sin depender de `GOOGLE_OAUTH_CLIENT_ID`, `VITE_GOOGLE_CLIENT_ID`, secretos ni redirects fijos.
- **REQ-002 (Protocolo seguro):** Cada intento genera `state` impredecible de un solo uso, PKCE `S256`, listener loopback en `127.0.0.1` con puerto efímero y expiración acotada. El callback valida método, loopback, ruta, emisor, parámetros duplicados, `state` y código antes del canje.
- **REQ-003 (Scopes mínimos):** El login solicita solamente `openid`, `email` y `profile`. Los scopes de Classroom se solicitan aparte al conectar Classroom, con consentimiento propio y alcance de solo lectura.
- **REQ-004 (Identidad verificada):** El servidor verifica el ID token contra el Client ID Desktop y exige `email_verified=true` y `sub` presente antes de llamar a los flujos existentes de login/registro. Las cuentas preexistentes se enlazan o rechazan según la regla existente de `googleSub`; no se vincula por correo sin una credencial firmada y validada.
- **REQ-005 (Entrega temporal recuperable):** El credential validado se conserva solo en memoria por tiempo limitado; el frontend puede recuperar el mismo resultado mientras confirma su recepción, para tolerar una respuesta HTTP perdida. Nunca se escribe en logs, URL, almacenamiento persistente o artefactos. Confirmar, cancelar, vencer o fallar libera el listener y su estado.
- **REQ-006 (UX de autorización):** La acción del docente abre el navegador de sistema desde un gesto explícito, muestra espera/cancelación/error accesibles y recupera el resultado sin depender de `window.opener` ni de Google Identity Services.
- **REQ-007 (Compatibilidad):** El login Google web ya configurado puede conservarse como compatibilidad para otros entornos. En `docente-local`, la ruta Desktop se ofrece sin configuración manual; el login con contraseña conserva su política actual.
- **REQ-008 (Diagnóstico):** Capacidades públicas distinguen login Desktop, login web GIS y Classroom. El diagnóstico no revela secretos, credenciales ni identificadores de flujo reutilizables.

## Criterios de Aceptación

1. Una instalación limpia `docente-local` puede iniciar sesión/registrarse por OAuth Desktop sin editar `.env` ni enviar una petición GIS desde el origen local.
2. PKCE, callback loopback, issuer y estado inválidos, duplicados, expirados o reutilizados se rechazan y cierran el listener.
3. Un ID token sin `email_verified`, sin `sub`, expirado o con audiencia distinta no crea sesión ni cambia el registro del docente.
4. Los scopes del login son exactamente identidad básica; Classroom conserva consentimiento separado para sus scopes de lectura.
5. El credential OAuth solo se entrega una vez, vence y no aparece en logs ni persistencia.
6. Los flujos de login y registro existentes reciben el credential validado y mantienen sus reglas de identidad, licencia, permisos y contraseñas.
7. Tests de servicio/controlador/frontend e instalador verifican capacidades limpias; build docente, typecheck, lint, guard WCAG y gates de release aplicables pasan.
8. El E2E real de Classroom posterior confirma que `googleSub` coincide con la identidad login y que curso, tema, actividades, fechas, roster y entregas siguen siendo de solo lectura.

## Matriz de Trazabilidad

| ID Requisito | Descripción del Caso | Archivo de Test Vinculado | Estado |
| --- | --- | --- | --- |
| REQ-001, REQ-002, REQ-003, REQ-005 | OAuth Desktop, PKCE, callback, expiración y entrega temporal | `apps/backend/tests/servicioGoogleDesktop.test.ts` | Implementado; test focal 4/4 |
| REQ-004 | Verificación de audiencia, email verificado y sujeto antes de login/registro | `apps/backend/tests/servicioGoogleDesktop.test.ts`; `apps/backend/tests/integracion/autenticacion.googleOnly.test.ts` | Implementado; typecheck y prueba de integración focal pasan |
| REQ-006, REQ-007 | Acción, navegador del sistema en WebView2, cancelación y recuperación de sesión | `apps/frontend/tests/seccionAutenticacion.desktopOAuth.test.tsx`; `scripts/tests/installer-hub-contract.test.mjs` | Implementado; build WPF correcto, falta E2E instalada |
| REQ-008 | Capacidades y rutas Desktop sin configuración web, con origen permitido | `apps/backend/tests/integracion/autenticacion.googleOnly.test.ts` | Implementado; prueba de integración focal pasa |
| REQ-001, REQ-008 | Client ID Desktop incluido en configuración del backend instalado | `apps/backend/src/configuracion.ts`; gates de build/instalador | Pendiente de validar en build limpio |

## Riesgos y límites

- La disponibilidad del flujo también depende de que el proyecto Google permita el Client ID y que la cuenta docente pueda consentir sus scopes. La automatización local no sustituye verificación de OAuth ni una prueba real del proveedor.
- El callback usa loopback y requiere que el firewall local permita la conexión iniciada por el navegador al listener local; no requiere exponer el backend a la red.
- Los resultados de este login no prueban la importación real de Classroom ni sustituyen el gate de E2E ligado al SHA candidato.

## Estado SDD

`approved`: la docente autorizó el login docente con OAuth Desktop + PKCE para habilitar el flujo de identidad necesario en todas las instalaciones `docente-local`, sin depender de copias de `.env`.
