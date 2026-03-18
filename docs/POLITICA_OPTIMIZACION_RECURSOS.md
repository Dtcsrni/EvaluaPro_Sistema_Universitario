# POLITICA_OPTIMIZACION_RECURSOS

## 1) Objetivo
Definir controles operativos obligatorios para evitar acumulacion de archivos innecesarios y optimizar continuamente el uso de disco, RAM, CPU y recursos Docker en EvaluaPro.

## 2) Alcance
- Host Windows de operacion local/institucional.
- Repositorio `sistema-evaluacion-universitaria`.
- Docker Desktop (imagenes, contenedores, volumenes, build cache).
- Artefactos temporales y de ejecucion (logs, reportes, caches, backups locales).

## 3) Principios
- Minimizar desperdicio sin comprometer trazabilidad ni recuperacion.
- Retener solo lo necesario por ventana temporal definida.
- Preferir limpieza automatizada y recurrente sobre limpieza manual reactiva.
- Evitar rebuilds forzados cuando no aportan valor operativo.
- Medir antes y despues de cada tarea de limpieza.

## 4) Umbrales operativos (SLO de capacidad)
### 4.1 Disco host (unidades de trabajo)
- **Verde**: uso < 80%.
- **Amarillo**: 80% a 89%.
- **Naranja**: 90% a 94%.
- **Rojo**: >= 95% (accion inmediata).

### 4.2 RAM host
- **Verde**: uso < 75%.
- **Amarillo**: 75% a 84%.
- **Naranja**: 85% a 89%.
- **Rojo**: >= 90% sostenido por > 10 minutos.

### 4.3 Docker (espacio)
- Build cache reclamable objetivo: <= 5 GB.
- Imagenes reclamables objetivo: <= 10 GB.
- Volumenes sin uso: 0 (eliminacion semanal).

### 4.4 Contenedores
- Solo servicios del perfil activo (`dev` o `prod`) deben estar corriendo.
- No coexistencia prolongada de stacks `dev` y `prod` en una misma estacion.

## 5) Politica de retencion por tipo de archivo
- `logs/`: retener 14 dias en host local; rotar/eliminar lo mas antiguo.
- `test-results/`: retener 7 dias.
- `reports/qa/latest/`: conservar solo el ultimo set y snapshots requeridos por auditoria.
- Backups locales comprimidos (`*.bundle`, dumps): retener maximo 3 por entorno y 30 dias.
- Artefactos temporales (`.tmp*`, `tmp_*`, `*.log` de depuracion): limpieza semanal.

## 6) Operacion recurrente (obligatoria)
### 6.1 Diario (inicio o cierre de jornada)
1. Verificar estado y consumo:
   - `docker system df`
   - `docker compose ps`
2. Evitar stacks duplicados:
   - Si operas en `prod`, detener servicios `dev`.
   - Si operas en `dev`, detener servicios `prod`.
3. Ejecutar arranque rapido por defecto:
   - `npm run stack:prod` o `npm run stack:dev`

### 6.2 Semanal (mantenimiento preventivo)
1. Limpieza de Docker no usado:
   - `docker system prune -f`
2. Limpieza de cache de build:
   - `docker builder prune -a -f`
3. Limpieza de volumenes huerfanos:
   - `docker volume prune -f`
4. Limpieza de red no usada:
   - `docker network prune -f`

### 6.3 Mensual (optimizacion profunda)
1. Ventana programada (fuera de horario de uso).
2. Limpieza amplia:
   - `docker system prune -a --volumes -f`
3. Revalidar stack:
   - `npm run stack:prod`
   - `docker compose ps`
   - `docker system df`
4. Registrar evidencia (antes/despues) en bitacora operativa.

## 7) Politica de reconstruccion y despliegue
- Prohibido usar `--build --force-recreate` como rutina diaria.
- Usar rutas rapidas por defecto (`stack:prod`, `stack:dev`).
- Usar variantes `:full` solo cuando:
  - cambio de dependencias base,
  - actualizacion de Dockerfile,
  - corrupcion de cache,
  - incidente reproducible que requiere rebuild.

## 8) Politica de volumenes
- Volumenes persistentes permitidos: solo los de datos activos del entorno en uso.
- Volumenes sin contenedor asociado (huerfanos): eliminacion obligatoria semanal.
- Antes de limpiar volumenes en ventana mensual:
  - confirmar necesidad de respaldo.
  - documentar riesgo de perdida de datos no sincronizados.

## 8.1) Segregacion obligatoria de datos (pruebas vs produccion)
- Queda prohibido reutilizar la misma base de datos Mongo para `dev/test` y `prod`.
- Nombres de BD obligatorios por entorno:
  - `mern_app_dev` para desarrollo local.
  - `mern_app_test` para pruebas.
  - `mern_app_prod` para operacion real.
- Queda prohibido compartir la misma carpeta de archivos entre entornos.
- Carpetas de almacenamiento obligatorias por entorno:
  - `apps/backend/data/examenes_dev`
  - `apps/backend/data/examenes_test`
  - `apps/backend/data/examenes_prod`
- Las evidencias de test (`test-results`, reportes QA, artefactos de OMR de prueba) no deben copiarse a rutas de operacion real.
- Cualquier script de prueba debe usar explicitamente `MONGODB_URI_TEST` o una base temporal aislada.

## 9) Politica de RAM/CPU
- Cerrar procesos no esenciales durante build/rebuild/test intensivo.
- Evitar navegadores/IDEs duplicados en sesiones de carga alta.
- No ejecutar suites pesadas en paralelo si RAM >= 85%.
- Si RAM >= 90% sostenido:
  - detener servicios no criticos,
  - reiniciar Docker Desktop,
  - reintentar con perfil unico (`dev` o `prod`).

## 10) Politica de carpetas del repositorio
- No versionar artefactos generados no requeridos por contrato.
- Mantener `reports/` y `test-results/` bajo retencion definida.
- Limpiar carpetas temporales de OMR e importaciones intermedias al cierre semanal.
- Evitar duplicados de datasets locales sin etiqueta de vigencia.
- Separar de forma estricta datasets de validacion/prueba de datasets de operacion real.

## 11) Automatizacion recomendada (Windows Task Scheduler)
- Tarea `EvaluaPro-Mantenimiento-Semanal`:
  - Frecuencia: semanal.
  - Accion: PowerShell con comandos de seccion 6.2.
  - Resultado esperado: cache y volumenes no usados en minimo.
- Tarea `EvaluaPro-Mantenimiento-Mensual`:
  - Frecuencia: mensual.
  - Accion: limpieza profunda de seccion 6.3.
  - Requiere ventana aprobada de mantenimiento.

## 12) Gobernanza y responsabilidades
- Operador local:
  - ejecutar controles diarios/semanales,
  - registrar incidencias de capacidad.
- Responsable tecnico:
  - aprobar limpieza profunda,
  - revisar tendencias de consumo,
  - ajustar umbrales segun crecimiento real.

## 13) Runbook de respuesta por severidad
### Nivel Naranja (90%-94% disco o 85%-89% RAM)
1. `docker system df`
2. `docker builder prune -a -f`
3. `docker system prune -f`
4. Reevaluar consumo.

### Nivel Rojo (>=95% disco o >=90% RAM sostenido)
1. Ventana inmediata de mantenimiento.
2. `docker compose down --volumes --remove-orphans` (si aplica).
3. `docker system prune -a --volumes -f`
4. Levantar solo perfil activo y validar salud.

## 14) KPIs de control
- GB recuperados por semana.
- Build cache reclamable promedio semanal.
- Tiempo medio de stack a estado saludable.
- Incidentes por falta de espacio o saturacion RAM.

## 15) Comandos de referencia rapida
- Diagnostico:
  - `docker system df`
  - `docker compose ps`
- Limpieza conservadora:
  - `docker system prune -f`
  - `docker builder prune -a -f`
- Limpieza exhaustiva:
  - `docker compose down --volumes --remove-orphans`
  - `docker system prune -a --volumes -f`

## 16) Cumplimiento
Esta politica es de aplicacion obligatoria para cualquier estacion que ejecute EvaluaPro en modo operativo local o institucional. El incumplimiento recurrente (sin evidencia de mantenimiento) se considera riesgo operativo y debe escalarse al responsable tecnico.
