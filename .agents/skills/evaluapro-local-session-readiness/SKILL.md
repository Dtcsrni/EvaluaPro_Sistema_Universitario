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
5. Si un servicio no está activo y la petición del usuario autoriza usar EvaluaPro, sigue el procedimiento documentado del runtime instalado. En Windows, busca primero el acceso directo `EvaluaPro - Prod` y confirma que no haya instancia activa. Si ese acceso no existe, inspecciona `installation.manifest.json`, `scripts/launcher-broker.ps1` y el acceso directo instalado; no deduzcas el flavor por el nombre de `EvaluaPro.exe`. El broker instalado puede exponer `open-dashboard` con `Mode prod` y el puerto de control documentado `4519`; úsalo solo si la instalación confirma esos parámetros y los puertos no tienen listeners. No uses el launcher de desarrollo para reemplazar producción.
6. Tras el arranque, comprueba el endpoint del broker documentado por esa instalación (en el broker actual, `GET /api/status` en el puerto `4519`), `GET /api/salud/live` de API y `GET /` de UI. Conserva el código HTTP real de cada respuesta, incluidos 401/404; no los presentes como conexión rechazada. Confirma también PID, ruta de proceso y puerto. Solo API y UI en HTTP 200 dejan el runtime listo para la tarea.
7. Si el launcher normal no levanta servicios, inspecciona primero el estado más reciente del broker/dashboard y los locks documentados. Contrasta el PID del lock con el proceso real, su ruta/línea de comandos y el listener correspondiente. No mates procesos desconocidos ni borres locks si el PID existe, el owner es incierto o el puerto responde. Si el PID no existe y el puerto está cerrado, conserva una copia de los metadatos y usa el mecanismo de recuperación previsto por la instalación; cualquier retirada manual de locks debe limitarse a los archivos de lock exactos y contar con autorización del usuario para recuperar el runtime. No borres datos, bases, logs, backups o archivos de instalación.
8. Si el dashboard/broker funciona y ofrece diagnóstico, úsalo antes de reparar. La reparación no destructiva del Hub está autorizada solo cuando el usuario pidió reparar/recuperar el runtime y el procedimiento vigente la identifica como segura. Instalación, actualización, migración, desinstalación o eliminación de datos requieren autorización específica; no forman parte del arranque normal. Si la reparación falla o propone tocar datos, detente y comunica el paso exacto.
9. Solo después de verificar ambos servicios, inspecciona las pestañas del navegador lateral y reutiliza una que ya muestre EvaluaPro. No crees otra pestaña si una ya cargó la aplicación o si la apertura está `queued`; ese estado no confirma una pestaña nueva ni una carga terminada. Si solo existe una pestaña con error y ambos health checks dan 200, recarga esa pestaña una vez y observa el resultado.
10. Si el control del navegador termina inesperadamente, distingue el fallo del controlador de un cierre de Edge: reinicializa el control una vez, vuelve a inventariar pestañas y enlaza la pestaña existente más reciente. No repitas aperturas a ciegas. Si la política del navegador bloquea la URL, no pruebes otra superficie, esquema, host ni mecanismo indirecto para llegar al mismo sitio; deja autenticación/interacción al usuario y reporta el bloqueo. Si API/UI responden 200 pero no puedes observar una pestaña funcional tras una recuperación permitida, detente y reporta el bloqueo sin afirmar que el navegador se crasheó.
11. Si hace falta autenticación, deja que la persona la complete en la UI; nunca pidas ni escribas su contraseña en el chat, comandos o logs.
12. Para consultar o calificar exámenes, continúa con `evaluapro-exam-query` y `evaluapro-exam-grading`. Usa la API documentada; no accedas directamente a SQLite/Prisma ni conviertas una respuesta no disponible en un resultado.

## Sesión de la GUI frente a sesión API

- Una sesión visible en la GUI y una llamada directa a la API son contextos distintos. Un `401` de `Invoke-WebRequest`, `curl` u otro cliente sin `Authorization: Bearer` solo demuestra que esa solicitud no estaba autenticada; no demuestra que la GUI haya perdido la sesión.
- No extraigas tokens de `localStorage`, cookies, perfiles del navegador ni memoria del proceso para reutilizar la sesión. Usa únicamente el cliente/API documentado y un mecanismo local de autenticación aprobado; nunca pidas al usuario pegar secretos en el chat.
- Si la GUI muestra al docente autenticado pero no existe un mecanismo aprobado para autenticar el cliente API, reporta ambas evidencias por separado. Deja el paso API pendiente o permite que el docente lo complete en la GUI; no declares que la sesión falló ni intentes una ruta alterna.
- Si Codex rechaza la URL por política del navegador, es un límite del controlador/plataforma, no un defecto corregible desde EvaluaPro. No cambies host, esquema, superficie ni transporte para evadirlo. Conserva la GUI para uso del docente y detén la automatización visual.

## Diagnóstico mínimo

Reporta el estado por capa, con hora local y evidencia breve:

- API: código HTTP o conexión rechazada/no disponible.
- UI: código HTTP o conexión rechazada/no disponible.
- Runtime: proceso/puerto comprobados y acción documentada usada, si la hubo.
- Launcher: resultado de apertura/recuperación y diagnóstico redacted; indica cualquier lock stale y cómo se verificó.
- Navegador: página cargada o error observado, separado del estado de API/UI.

No muestres variables de entorno, credenciales, tokens, cookies, URLs con secretos ni salida de logs sin sanitizar. No afirmes que la aplicación está lista hasta observar HTTP 200 en API y UI.
