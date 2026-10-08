# Política de seguridad del proyecto

Revisión documental: 2026-10-08

Este documento define objetivos y prácticas esperadas; no es una certificación, auditoría de controles ni confirmación de cumplimiento legal. La existencia de una regla no prueba que todas las interfaces o instalaciones la implementen. Para verificar una capacidad concreta, consulta su código, pruebas y evidencia de release.

## 1. Clasificacion de datos
- `publico`
- `interno`
- `personal`
- `sensible`

## 2. Principios
- Minimo privilegio.
- Defensa en profundidad.
- Privacidad desde el diseno y por defecto.
- Trazabilidad y no repudio operativo.

## 3. Controles técnicos requeridos
- TLS en comunicaciones remotas cuando corresponda al despliegue.
- Proteger respaldos exportados y artefactos sensibles con los controles que documenta el flujo de exportación.
- No describir la SQLite activa como cifrada sin evidencia específica del mecanismo y la configuración instalados.
- RBAC con permisos de accion.
- Sanitizacion de payloads y validaciones estrictas.
- Logging estructurado con `requestId` y sin secretos.

La aplicación local guarda datos operativos en SQLite. El control de acceso del equipo y la protección de respaldos son responsabilidades distintas; una no sustituye a la otra.

## 4. Controles organizativos
- Matriz RACI de seguridad.
- Revision periodica de accesos.
- Gestion de proveedores/encargados.
- Capacitacion basica de seguridad operativa.

## 5. Gestion de secretos
- Secretos fuera de repositorio.
- Rotacion periodica de llaves/tokens.
- Prohibido compartir secretos por canales no seguros.

## 6. Respuesta a incidentes
1. Contencion.
2. Analisis y erradicacion.
3. Recuperacion.
4. Lecciones aprendidas.
5. Notificacion conforme obligacion legal/contractual.

## 7. Cumplimiento y evidencia
La aplicación de leyes o contratos depende del responsable del tratamiento, la institución, la configuración y el uso. Este documento no declara que EvaluaPro cumpla por sí solo la LFPDPPP u otro marco. Antes de una operación real, revisa el aviso de privacidad, el procedimiento ARCO y las obligaciones aplicables en tu institución.

Para reportes de vulnerabilidad, consulta `SECURITY.md`. Antes de comunicar que una vulnerabilidad fue corregida, valida el cambio contra el aviso o advisory correspondiente y la versión publicada.
