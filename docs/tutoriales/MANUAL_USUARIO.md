# Inicio rápido docente

Esta guía resume el primer recorrido por el perfil `docente-local`. Para instrucciones completas y límites de respaldo, consulta el [manual docente](../MANUAL_USUARIO_DOCENTE.md).

## Instalar

1. Descarga el instalador y el checksum desde [GitHub Releases/latest](https://github.com/Dtcsrni/EvaluaPro_Sistema_Universitario/releases/latest).
2. Verifica el checksum del EXE y ejecuta Installer Hub.
3. Completa los requisitos que indique el asistente; inicia EvaluaPro al terminar.

La versión de `main` no necesariamente está publicada como instalador. Confirma el tag de la release y la versión visible en la aplicación.

## Preparar una evaluación

1. Inicia sesión con una cuenta docente habilitada.
2. Registra el periodo, la materia y el grupo.
3. Revisa matrículas y alumnos antes de crear la evaluación.
4. Prepara los reactivos y la plantilla; verifica el PDF antes de imprimir.
5. Conserva los folios/QR para relacionar las respuestas con el examen correspondiente.

## Revisar respuestas

1. Carga el archivo de escaneo desde el módulo OMR.
2. Comprueba folio, alumno y examen.
3. Resuelve las lecturas ambiguas y compara las respuestas con la clave.
4. Confirma la calificación manualmente según la política vigente.

OMR es lectura óptica de marcas; sus resultados pueden requerir revisión. No uses la lectura automática como confirmación de identidad ni como decisión final de calificación.

## Cuidar los datos

- Respalda antes de actualizar, reparar o mover la información.
- Usa el flujo de snapshot/exportación de EvaluaPro.
- Nunca sincronices la SQLite activa con OneDrive, red o USB.
- Las integraciones remotas requieren configurar sus servicios y credenciales.

Consulta [Respaldo y migración](../SINCRONIZACION_ENTRE_COMPUTADORAS.md), [Instalación](../INSTALLER_HUB.md) y [Runbook](../RUNBOOK_OPERACION.md).
