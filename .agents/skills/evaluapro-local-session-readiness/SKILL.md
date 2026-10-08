---
name: evaluapro-local-session-readiness
description: Comprueba y recupera el runtime local docente de EvaluaPro antes de abrir su UI o iniciar sesión. Úsala para accesos desde navegador lateral, consultas API y flujos locales de exámenes cuando localhost no responde.
---

# Preparación de sesión local de EvaluaPro

Evita abrir una página de acceso que no tiene un servicio detrás. Distingue el navegador de los servicios web/API y verifica la instancia antes de continuar.

## Flujo

1. Usa como fuente canónica `C:\Users\evega\Documents\EvaluaPro`. Comprueba que existen `AGENTS.md`, `docs/RUNBOOK_OPERACION.md` y `scripts/api/evaluapro-client.mjs`. No uses `C:\Users\evega\Documents\ChatGPT\Evaluapro` como runtime: es una copia incompleta.
2. Lee el runbook y determina el flavor y puertos efectivos de la instalación. Para docente-local, los valores documentados por defecto son API `http://127.0.0.1:4000/api` y UI `http://localhost:4173`; verifica la configuración vigente antes de asumirlos.
3. Antes de abrir o recargar el navegador, realiza solo comprobaciones GET:
   - API `GET /salud/live` debe responder HTTP 200.
   - UI `/` debe responder HTTP 200.
   - Confirma que los puertos pertenecen a los procesos de EvaluaPro esperados; no inicies un segundo stack si ya hay un listener.
4. Si aparece `ERR_CONNECTION_REFUSED`, informa que el destino no aceptó la conexión; eso por sí solo no prueba que el navegador se haya crasheado. No vuelvas a abrir ni recargar la pestaña hasta que el servicio responda.
5. Si un servicio no está activo y la petición del usuario autoriza usar EvaluaPro, sigue el procedimiento documentado del runtime instalado. En Windows, el runbook indica el acceso directo `EvaluaPro - Prod`; confirma que no haya una instancia activa antes de iniciarlo y espera a que API y UI pasen sus health checks. No uses el launcher de desarrollo para reemplazar una instalación productiva.
6. No ejecutes reparación, instalación, actualización, migración o eliminación para resolver un puerto cerrado salvo que la persona haya solicitado esa acción. Si el arranque normal falla, detente, inspecciona el diagnóstico permitido y reporta qué servicio falta; no pruebes puertos alternativos ni bases de datos por tanteo.
7. Solo después de verificar ambos servicios, inspecciona las pestañas del navegador lateral y reutiliza una que ya muestre EvaluaPro. No crees otra pestaña si una ya cargó la aplicación o si la apertura está `queued`; ese estado no confirma una pestaña nueva ni una carga terminada. Si solo existe una pestaña con error y ambos health checks dan 200, recarga esa pestaña una vez y observa el resultado.
8. Si el control del navegador termina inesperadamente, distingue el fallo del controlador de un cierre de Edge: reinicializa el control una vez, vuelve a inventariar pestañas y enlaza la pestaña existente más reciente. No repitas aperturas a ciegas. Si API/UI responden 200 pero no puedes observar una pestaña funcional tras esa recuperación, detente y reporta el bloqueo sin afirmar que el navegador se crasheó.
9. Si hace falta autenticación, deja que la persona la complete en la UI; nunca pidas ni escribas su contraseña en el chat, comandos o logs.
10. Para consultar o calificar exámenes, continúa con `evaluapro-exam-query` y `evaluapro-exam-grading`. Usa la API documentada; no accedas directamente a SQLite/Prisma ni conviertas una respuesta no disponible en un resultado.

## Diagnóstico mínimo

Reporta el estado por capa, con hora local y evidencia breve:

- API: código HTTP o conexión rechazada/no disponible.
- UI: código HTTP o conexión rechazada/no disponible.
- Runtime: proceso/puerto comprobados y acción documentada usada, si la hubo.
- Navegador: página cargada o error observado, separado del estado de API/UI.

No muestres variables de entorno, credenciales, tokens, cookies, URLs con secretos ni salida de logs sin sanitizar. No afirmes que la aplicación está lista hasta observar HTTP 200 en API y UI.
