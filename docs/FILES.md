# Mapa de archivos

Este documento describe cada archivo del repositorio. Los archivos
generados o lockfiles no deben editarse manualmente.

## Raiz
- `.gitignore`: artefactos y archivos ignorados.
- `.github/copilot-instructions.md`: guias de estilo para el repo.
- `docker-compose.yml`: stack local con perfiles dev/prod.
- `package.json`: scripts y workspaces.
- `package-lock.json`: lockfile de npm (generado).
- `README.md`: guia principal del proyecto.

## docs/
- `docs/ARQUITECTURA.md`: decisiones, responsabilidades y diagramas texto.
- `docs/FLUJO_EXAMEN.md`: flujo completo de examen.
- `docs/DESPLIEGUE.md`: Docker Compose local y Cloud Run.
- `docs/SEGURIDAD.md`: checklist OWASP API 2023.
- `docs/FORMATO_PDF.md`: reglas de PDF carta y OMR.
- `docs/PRUEBAS.md`: alcance y ejecucion de pruebas.
- `docs/FILES.md`: este mapa de archivos.

## scripts/
- `scripts/dashboard.mjs`: verificacion rapida de API y web.

## backend/
- `backend/.eslintrc.cjs`: reglas ESLint backend.
- `backend/Dockerfile`: imagen Docker API.
- `backend/package.json`: dependencias y scripts backend.
- `backend/tsconfig.json`: configuracion TypeScript backend.
- `backend/vitest.config.ts`: configuracion de pruebas Vitest.

### backend/src
- `backend/src/index.ts`: entrypoint del servidor.
- `backend/src/app.ts`: configuracion Express y middlewares.
- `backend/src/configuracion.ts`: lectura de env y defaults.
- `backend/src/rutas.ts`: registro de rutas API.

### backend/src/infraestructura
- `backend/src/infraestructura/baseDatos/mongoose.ts`: conexion Mongo.
- `backend/src/infraestructura/archivos/almacenLocal.ts`: guardado local de PDFs.
- `backend/src/infraestructura/correo/servicioCorreo.ts`: placeholder envio de correo.

### backend/src/compartido/errores
- `backend/src/compartido/errores/errorAplicacion.ts`: error tipado de dominio.
- `backend/src/compartido/errores/manejadorErrores.ts`: middleware de errores.

### backend/src/compartido/salud
- `backend/src/compartido/salud/rutasSalud.ts`: endpoint de salud.

### backend/src/compartido/tipos
- `backend/src/compartido/tipos/dominio.ts`: tipos compartidos de dominio.
- `backend/src/compartido/tipos/jsqr.d.ts`: tipos para jsQR.

### backend/src/compartido/utilidades
- `backend/src/compartido/utilidades/aleatoriedad.ts`: helpers de aleatoriedad.
- `backend/src/compartido/utilidades/calculoCalificacion.ts`: fracciones y Decimal.

### backend/src/compartido/validaciones
- `backend/src/compartido/validaciones/validar.ts`: helpers Zod.

### backend/src/modulos/modulo_autenticacion
- `backend/src/modulos/modulo_autenticacion/controladorAutenticacion.ts`: registro, login y perfil.
- `backend/src/modulos/modulo_autenticacion/middlewareAutenticacion.ts`: JWT y helper de docente.
- `backend/src/modulos/modulo_autenticacion/modeloDocente.ts`: esquema Docente.
- `backend/src/modulos/modulo_autenticacion/rutasAutenticacion.ts`: rutas de auth.
- `backend/src/modulos/modulo_autenticacion/servicioHash.ts`: hash de contrasena.
- `backend/src/modulos/modulo_autenticacion/servicioTokens.ts`: JWT docente.
- `backend/src/modulos/modulo_autenticacion/validacionesAutenticacion.ts`: validaciones Zod.

### backend/src/modulos/modulo_alumnos
- `backend/src/modulos/modulo_alumnos/controladorAlumnos.ts`: CRUD alumnos.
- `backend/src/modulos/modulo_alumnos/controladorPeriodos.ts`: CRUD periodos.
- `backend/src/modulos/modulo_alumnos/modeloAlumno.ts`: esquema Alumno.
- `backend/src/modulos/modulo_alumnos/modeloPeriodo.ts`: esquema Periodo.
- `backend/src/modulos/modulo_alumnos/rutasAlumnos.ts`: rutas alumnos.
- `backend/src/modulos/modulo_alumnos/rutasPeriodos.ts`: rutas periodos.
- `backend/src/modulos/modulo_alumnos/validacionesAlumnos.ts`: validaciones Zod alumnos.
- `backend/src/modulos/modulo_alumnos/validacionesPeriodos.ts`: validaciones Zod periodos.

### backend/src/modulos/modulo_banco_preguntas
- `backend/src/modulos/modulo_banco_preguntas/controladorBancoPreguntas.ts`: CRUD banco preguntas.
- `backend/src/modulos/modulo_banco_preguntas/modeloBancoPregunta.ts`: esquema BancoPregunta.
- `backend/src/modulos/modulo_banco_preguntas/rutasBancoPreguntas.ts`: rutas banco preguntas.
- `backend/src/modulos/modulo_banco_preguntas/validacionesBancoPreguntas.ts`: validaciones Zod banco.

### backend/src/modulos/modulo_generacion_pdf
- `backend/src/modulos/modulo_generacion_pdf/controladorGeneracionPdf.ts`: CRUD plantillas y generar.
- `backend/src/modulos/modulo_generacion_pdf/controladorListadoGenerados.ts`: listados y descarga.
- `backend/src/modulos/modulo_generacion_pdf/modeloExamenGenerado.ts`: esquema ExamenGenerado.
- `backend/src/modulos/modulo_generacion_pdf/modeloExamenPlantilla.ts`: esquema ExamenPlantilla.
- `backend/src/modulos/modulo_generacion_pdf/rutasGeneracionPdf.ts`: rutas de generacion.
- `backend/src/modulos/modulo_generacion_pdf/servicioGeneracionPdf.ts`: render PDF + mapa OMR.
- `backend/src/modulos/modulo_generacion_pdf/servicioVariantes.ts`: variantes y ordenamientos.
- `backend/src/modulos/modulo_generacion_pdf/validacionesExamenes.ts`: validaciones Zod.

### backend/src/modulos/modulo_vinculacion_entrega
- `backend/src/modulos/modulo_vinculacion_entrega/controladorVinculacionEntrega.ts`: vincular examen/alumno.
- `backend/src/modulos/modulo_vinculacion_entrega/modeloEntrega.ts`: esquema Entrega.
- `backend/src/modulos/modulo_vinculacion_entrega/rutasVinculacionEntrega.ts`: rutas vinculacion.
- `backend/src/modulos/modulo_vinculacion_entrega/validacionesVinculacion.ts`: validaciones Zod.

### backend/src/modulos/modulo_escaneo_omr
- `backend/src/modulos/modulo_escaneo_omr/controladorEscaneoOmr.ts`: escaneo y revision OMR.
- `backend/src/modulos/modulo_escaneo_omr/rutasEscaneoOmr.ts`: rutas OMR.
- `backend/src/modulos/modulo_escaneo_omr/servicioOmr.ts`: pipeline QR + marcas + burbujas.
- `backend/src/modulos/modulo_escaneo_omr/validacionesOmr.ts`: validaciones Zod OMR.

### backend/src/modulos/modulo_calificacion
- `backend/src/modulos/modulo_calificacion/controladorCalificacion.ts`: calcular y guardar.
- `backend/src/modulos/modulo_calificacion/modeloCalificacion.ts`: esquema Calificacion.
- `backend/src/modulos/modulo_calificacion/rutasCalificaciones.ts`: rutas calificacion.
- `backend/src/modulos/modulo_calificacion/servicioCalificacion.ts`: calculo exacto y topes.
- `backend/src/modulos/modulo_calificacion/validacionesCalificacion.ts`: validaciones Zod.

### backend/src/modulos/modulo_analiticas
- `backend/src/modulos/modulo_analiticas/controladorAnaliticas.ts`: banderas y exportaciones.
- `backend/src/modulos/modulo_analiticas/modeloBanderaRevision.ts`: esquema BanderaRevision.
- `backend/src/modulos/modulo_analiticas/rutasAnaliticas.ts`: rutas analiticas.
- `backend/src/modulos/modulo_analiticas/servicioExportacionCsv.ts`: CSV generico.
- `backend/src/modulos/modulo_analiticas/validacionesAnaliticas.ts`: validaciones Zod.

### backend/src/modulos/modulo_sincronizacion_nube
- `backend/src/modulos/modulo_sincronizacion_nube/controladorSincronizacion.ts`: publicacion cloud.
- `backend/src/modulos/modulo_sincronizacion_nube/modeloCodigoAcceso.ts`: esquema CodigoAcceso.
- `backend/src/modulos/modulo_sincronizacion_nube/modeloSincronizacion.ts`: esquema Sincronizacion.
- `backend/src/modulos/modulo_sincronizacion_nube/rutasSincronizacionNube.ts`: rutas sync.
- `backend/src/modulos/modulo_sincronizacion_nube/validacionesSincronizacion.ts`: validaciones Zod.

### backend/tests
- `backend/tests/setup.ts`: setup de entorno para pruebas.
- `backend/tests/calificacion.test.ts`: pruebas de calculo exacto y topes.
- `backend/tests/csv.test.ts`: pruebas de exportacion CSV.
- `backend/tests/variantes.test.ts`: pruebas de variantes aleatorias.
- `backend/tests/salud.test.ts`: prueba de salud API.
- `backend/tests/contrato/validaciones.test.ts`: validaciones de payload.
- `backend/tests/integracion/flujoExamen.test.ts`: flujo completo de examen.
- `backend/tests/integracion/autorizacion.test.ts`: seguridad de tokens.
- `backend/tests/integracion/aislamientoDocente.test.ts`: aislamiento por docente.
- `backend/tests/utils/mongo.ts`: Mongo en memoria para pruebas.
- `backend/tests/utils/token.ts`: helper para token de docente.

## frontend/
- `frontend/Dockerfile`: build y runtime del frontend.
- `frontend/index.html`: HTML base.
- `frontend/package.json`: dependencias y scripts.
- `frontend/tsconfig.json`: config TS React.
- `frontend/tsconfig.node.json`: config TS tooling.
- `frontend/vite.config.ts`: config Vite.
- `frontend/vitest.config.ts`: configuracion de pruebas frontend.

### frontend/src
- `frontend/src/App.tsx`: selector de app docente/alumno.
- `frontend/src/main.tsx`: bootstrap React.
- `frontend/src/styles.css`: estilos globales.
- `frontend/src/apps/app_docente/AppDocente.tsx`: UI docente.
- `frontend/src/apps/app_alumno/AppAlumno.tsx`: portal alumno.
- `frontend/src/servicios_api/clienteApi.ts`: cliente HTTP docente (JWT).
- `frontend/src/servicios_api/clientePortal.ts`: cliente HTTP portal (token).
- `frontend/src/componentes/`: carpeta preparada para componentes.
- `frontend/src/estado/`: carpeta preparada para estado global.
- `frontend/src/rutas/`: carpeta preparada para rutas.
- `frontend/src/pwa/`: carpeta preparada para PWA.

### frontend/tests
- `frontend/tests/setup.ts`: setup de pruebas React.
- `frontend/tests/appDocente.test.tsx`: render basico app docente.
- `frontend/tests/appAlumno.test.tsx`: render basico app alumno.

## portal_alumno_cloud/
- `portal_alumno_cloud/Dockerfile`: imagen Docker portal alumno.
- `portal_alumno_cloud/package.json`: dependencias y scripts.
- `portal_alumno_cloud/tsconfig.json`: configuracion TypeScript.
- `portal_alumno_cloud/vitest.config.ts`: configuracion de pruebas portal alumno.

### portal_alumno_cloud/src
- `portal_alumno_cloud/src/index.ts`: entrypoint del portal.
- `portal_alumno_cloud/src/app.ts`: middlewares del portal.
- `portal_alumno_cloud/src/configuracion.ts`: lectura de env y defaults.
- `portal_alumno_cloud/src/rutas.ts`: rutas de consulta y sync.
- `portal_alumno_cloud/src/infraestructura/baseDatos/mongoose.ts`: conexion Mongo cloud.
- `portal_alumno_cloud/src/modelos/modeloCodigoAcceso.ts`: esquema CodigoAcceso cloud.
- `portal_alumno_cloud/src/modelos/modeloResultadoAlumno.ts`: esquema ResultadoAlumno.
- `portal_alumno_cloud/src/modelos/modeloSesionAlumno.ts`: esquema SesionAlumno.
- `portal_alumno_cloud/src/servicios/middlewareSesion.ts`: middleware token alumno.
- `portal_alumno_cloud/src/servicios/servicioSesion.ts`: hash y tokens de sesion.

### portal_alumno_cloud/tests
- `portal_alumno_cloud/tests/setup.ts`: setup de entorno portal.
- `portal_alumno_cloud/tests/utils/mongo.ts`: Mongo en memoria para pruebas.
- `portal_alumno_cloud/tests/integracion/portal.test.ts`: flujo de portal alumno.
