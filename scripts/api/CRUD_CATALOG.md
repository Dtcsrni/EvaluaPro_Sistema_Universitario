# Catálogo de rutas y operaciones API

Generado desde los routers backend. 234 declaraciones montadas y 34 operaciones OpenAPI pendientes de router; las operaciones CRUD/acciones aparecen marcadas cuando aún no se pueden invocar. No usar operaciones con estado `pending-router`.

Los permisos y validadores se leen de los middlewares y llamadas `validarCuerpo` de cada router. Los schemas detallados de flujos críticos están en [`openapi.json`](./openapi.json); un validador `esquema...` apunta a la definición Zod del backend cuando el contrato amplio todavía no exporta campos en JSON Schema.

| Módulo | Ruta | Métodos | Estado | Sesión | Permisos | Validador de cuerpo |
| --- | --- | --- | --- | --- | --- | --- |
| Administración | `/admin/docentes` | GET | Disponible | Bearer | docentes:administrar | — |
| Administración | `/admin/docentes/{docenteId}` | POST | Disponible | Bearer | docentes:administrar | esquemaActualizarDocenteAdmin |
| Administración comercial | `/admin-negocio/auditoria` | GET | Disponible | Bearer | comercial:auditoria:leer | — |
| Administración comercial | `/admin-negocio/campanas` | GET, POST | Disponible | Bearer | comercial:campanas:leer, comercial:campanas:gestionar | esquemaCrearCampana |
| Administración comercial | `/admin-negocio/campanas/{id}` | PATCH, POST | Disponible | Bearer | comercial:campanas:gestionar | esquemaActualizarCampana |
| Administración comercial | `/admin-negocio/cobranza` | GET | Disponible | Bearer | comercial:cobranza:leer | — |
| Administración comercial | `/admin-negocio/cobranza/ciclo/ejecutar` | POST | Disponible | Bearer | comercial:cobranza:gestionar | esquemaEjecutarCicloCobranza |
| Administración comercial | `/admin-negocio/cobranza/mercadopago/preferencia` | POST | Disponible | Bearer | comercial:cobranza:gestionar | esquemaCrearPreferenciaMercadoPago |
| Administración comercial | `/admin-negocio/consentimientos` | POST | Disponible | Bearer | comercial:suscripciones:gestionar | esquemaConsentimientoComercial |
| Administración comercial | `/admin-negocio/cupones` | GET, POST | Disponible | Bearer | comercial:cupones:leer, comercial:cupones:gestionar | esquemaCrearCupon |
| Administración comercial | `/admin-negocio/cupones/{id}` | PATCH, POST | Disponible | Bearer | comercial:cupones:gestionar | esquemaActualizarCupon |
| Administración comercial | `/admin-negocio/dashboard/resumen` | GET | Disponible | Bearer | comercial:metricas:leer | — |
| Administración comercial | `/admin-negocio/licencias` | GET | Disponible | Bearer | comercial:licencias:leer | — |
| Administración comercial | `/admin-negocio/licencias/{id}/reasignar-dispositivo` | POST | Disponible | Bearer | comercial:licencias:gestionar | esquemaReasignarLicenciaDispositivo |
| Administración comercial | `/admin-negocio/licencias/{id}/revocar` | POST | Disponible | Bearer | comercial:licencias:revocar | esquemaRevocarLicencia |
| Administración comercial | `/admin-negocio/licencias/generar` | POST | Disponible | Bearer | comercial:licencias:gestionar | esquemaGenerarLicencia |
| Administración comercial | `/admin-negocio/metricas/churn` | GET | Disponible | Bearer | comercial:metricas:leer | — |
| Administración comercial | `/admin-negocio/metricas/conversion` | GET | Disponible | Bearer | comercial:metricas:leer | — |
| Administración comercial | `/admin-negocio/metricas/guardrails` | GET | Disponible | Bearer | comercial:metricas:leer | — |
| Administración comercial | `/admin-negocio/metricas/ltv-cac` | GET | Disponible | Bearer | comercial:metricas:leer | — |
| Administración comercial | `/admin-negocio/metricas/mrr` | GET | Disponible | Bearer | comercial:metricas:leer | — |
| Administración comercial | `/admin-negocio/planes` | GET, POST | Disponible | Bearer | comercial:planes:leer, comercial:planes:gestionar | esquemaCrearPlan |
| Administración comercial | `/admin-negocio/planes/{id}` | PATCH, POST | Disponible | Bearer | comercial:planes:gestionar | esquemaActualizarPlan |
| Administración comercial | `/admin-negocio/plantillas-notificacion` | GET, POST | Disponible | Bearer | comercial:campanas:leer, comercial:campanas:gestionar | esquemaCrearPlantillaNotificacion |
| Administración comercial | `/admin-negocio/plantillas-notificacion/{id}` | PATCH, POST | Disponible | Bearer | comercial:campanas:gestionar | esquemaActualizarPlantillaNotificacion |
| Administración comercial | `/admin-negocio/suscripciones` | GET, POST | Disponible | Bearer | comercial:suscripciones:leer, comercial:suscripciones:gestionar | esquemaCrearSuscripcion |
| Administración comercial | `/admin-negocio/suscripciones/{id}/aplicar-cupon` | POST | Disponible | Bearer | comercial:suscripciones:gestionar | esquemaAplicarCupon |
| Administración comercial | `/admin-negocio/suscripciones/{id}/cambiar-plan` | POST | Disponible | Bearer | comercial:suscripciones:gestionar | esquemaCambiarPlan |
| Administración comercial | `/admin-negocio/suscripciones/{id}/estado` | POST | Disponible | Bearer | comercial:suscripciones:gestionar | esquemaActualizarEstadoSuscripcion |
| Administración comercial | `/admin-negocio/tenants` | GET, POST | Disponible | Bearer | comercial:tenants:leer, comercial:tenants:gestionar | esquemaCrearTenant |
| Administración comercial | `/admin-negocio/tenants/{id}` | PATCH, POST | Disponible | Bearer | comercial:tenants:gestionar | esquemaActualizarTenant |
| Alumnos | `/alumnos` | GET, POST | Disponible | Bearer | alumnos:leer, alumnos:gestionar | esquemaCrearAlumno |
| Alumnos | `/alumnos/{alumnoId}` | GET | Disponible | Bearer | alumnos:leer | — |
| Alumnos | `/alumnos/{alumnoId}/actualizar` | POST | Disponible | Bearer | alumnos:gestionar | esquemaActualizarAlumno |
| Alumnos | `/alumnos/{alumnoId}/eliminar` | POST | Disponible | Bearer | alumnos:eliminar_dev | esquemaBodyVacioOpcional |
| Analíticas | `/analiticas/banderas` | GET, POST | Disponible | Bearer | analiticas:leer | esquemaCrearBandera |
| Analíticas | `/analiticas/calificaciones-csv` | GET | Disponible | Bearer | analiticas:leer | — |
| Analíticas | `/analiticas/calificaciones-xlsx` | GET | Disponible | Bearer | analiticas:leer | — |
| Analíticas | `/analiticas/eventos-uso` | POST | Disponible | Bearer | analiticas:leer | esquemaRegistrarEventosUso |
| Analíticas | `/analiticas/exportar-csv` | POST | Disponible | Bearer | analiticas:leer | esquemaExportarCsv |
| Analíticas | `/analiticas/lista-academica-csv` | GET | Disponible | Bearer | analiticas:leer | — |
| Analíticas | `/analiticas/lista-academica-docx` | GET | Disponible | Bearer | analiticas:leer | — |
| Analíticas | `/analiticas/lista-academica-firma` | GET | Disponible | Bearer | analiticas:leer | — |
| Analíticas | `/analiticas/lista-academica/calificaciones` | POST | Parcial; revisar operaciones | Bearer | calificaciones:calificar | esquemaGuardarCalificacionLista |
| API | `/comercial-publico/licencias/activar` | POST | Disponible | Público | — | esquemaActivarLicencia |
| API | `/comercial-publico/licencias/heartbeat` | POST | Disponible | Público | — | esquemaHeartbeatLicencia |
| API | `/comercial-publico/mercadopago/webhook` | POST | Disponible | Público | — | esquemaWebhookMercadoPago |
| API | `/evaluaciones-publicas/encuadre/firmar/{token}` | GET, POST | Disponible | Público | — | esquemaVacio |
| API | `/evaluaciones-publicas/encuadre/pdf/{token}` | GET | Disponible | Público | — | — |
| API | `/metrics` | GET | Disponible | Público | — | — |
| Asistencia | `/asistencias/derecho-examen/{alumnoId}` | GET | Disponible | Bearer | asistencias:leer | — |
| Asistencia | `/asistencias/excepciones` | GET, POST | Disponible | Bearer | asistencias:leer, asistencias:gestionar | esquemaCrearExcepcion |
| Asistencia | `/asistencias/excepciones/{excepcionId}/eliminar` | POST | Disponible | Bearer | asistencias:gestionar | esquemaBodyVacioOpcional |
| Asistencia | `/asistencias/reglas` | GET, POST | Disponible | Bearer | asistencias:leer, asistencias:gestionar | esquemaCrearRegla |
| Asistencia | `/asistencias/reglas/{reglaId}/eliminar` | POST | Disponible | Bearer | asistencias:gestionar | esquemaBodyVacioOpcional |
| Asistencia | `/asistencias/resumen` | GET | Disponible | Bearer | asistencias:leer | — |
| Asistencia | `/asistencias/sesiones` | GET, POST | Disponible | Bearer | asistencias:leer, asistencias:gestionar | esquemaCrearSesion |
| Asistencia | `/asistencias/sesiones/{sesionId}/eliminar` | POST | Disponible | Bearer | asistencias:gestionar | esquemaBodyVacioOpcional |
| Asistencia | `/asistencias/sesiones/{sesionId}/registros` | GET, POST | Disponible | Bearer | asistencias:leer, asistencias:gestionar | esquemaGuardarRegistros |
| Autenticación | `/autenticacion/accesos-directos/regenerar` | POST | Disponible | Bearer | cuenta:actualizar | esquemaBodyVacioOpcional |
| Autenticación | `/autenticacion/capacidades-integraciones` | GET | Disponible | Público | — | — |
| Autenticación | `/autenticacion/definir-contrasena` | POST | Disponible | Bearer | cuenta:actualizar | esquemaDefinirContrasenaDocente |
| Autenticación | `/autenticacion/google` | POST | Disponible | Público | — | esquemaIngresarDocenteGoogle |
| Autenticación | `/autenticacion/ingresar` | POST | Disponible | Público | — | esquemaIngresarDocente |
| Autenticación | `/autenticacion/perfil` | GET | Disponible | Bearer | cuenta:leer | — |
| Autenticación | `/autenticacion/preferencias/pdf` | POST | Disponible | Bearer | cuenta:actualizar | esquemaActualizarPreferenciasPdf |
| Autenticación | `/autenticacion/recuperar-contrasena-google` | POST | Disponible | Público | — | esquemaRecuperarContrasenaGoogle |
| Autenticación | `/autenticacion/refrescar` | POST | Disponible | Público | — | esquemaBodyVacioOpcional |
| Autenticación | `/autenticacion/registrar` | POST | Disponible | Público | — | esquemaRegistrarDocente |
| Autenticación | `/autenticacion/registrar-google` | POST | Disponible | Público | — | esquemaRegistrarDocenteGoogle |
| Autenticación | `/autenticacion/restablecer-contrasena` | POST | Disponible | Público | — | esquemaRestablecerContrasena |
| Autenticación | `/autenticacion/salir` | POST | Disponible | Público | — | esquemaBodyVacioOpcional |
| Autenticación | `/autenticacion/solicitar-recuperacion-contrasena` | POST | Disponible | Público | — | esquemaSolicitarRecuperacionContrasena |
| Calificaciones | `/calificaciones/calificar` | POST | Disponible | Bearer | calificaciones:calificar | esquemaCalificarExamen |
| Calificaciones | `/calificaciones/examen/{examenGeneradoId}` | GET | Disponible | Bearer | calificaciones:calificar | — |
| Calificaciones | `/calificaciones/revision/solicitudes` | GET | Disponible | Bearer | calificaciones:calificar | — |
| Calificaciones | `/calificaciones/revision/solicitudes/{id}/resolver` | POST | Disponible | Bearer | calificaciones:calificar | esquemaResolverSolicitudRevision |
| Calificaciones | `/calificaciones/revision/solicitudes/sincronizar` | POST | Disponible | Bearer | calificaciones:calificar | esquemaSincronizarSolicitudesRevision |
| Classroom | `/evaluaciones/v2/classroom/cursos` | GET | Disponible | Bearer | classroom:pull | — |
| Classroom | `/evaluaciones/v2/classroom/cursos/{courseId}/actividades` | GET | Disponible | Bearer | classroom:pull | — |
| Classroom | `/evaluaciones/v2/classroom/cursos/{courseId}/alumnos` | GET | Disponible | Bearer | classroom:pull | — |
| Classroom | `/evaluaciones/v2/classroom/cursos/{courseId}/importar-alumnos` | POST | Disponible | Bearer | classroom:pull | esquemaImportarAlumnosClassroom |
| Classroom | `/evaluaciones/v2/classroom/estado` | GET | Disponible | Bearer | classroom:pull | — |
| Classroom | `/integraciones/classroom/mapear` | GET, POST | Disponible | Bearer | classroom:pull | esquemaMapearClassroom |
| Classroom | `/integraciones/classroom/oauth/callback` | GET | Disponible | Público | — | — |
| Classroom | `/integraciones/classroom/oauth/iniciar` | GET | Disponible | Bearer | classroom:conectar | — |
| Classroom | `/integraciones/classroom/pull` | POST | Disponible | Bearer | classroom:pull | esquemaPullClassroom |
| Comercial | `/comercial/monetizacion-comunitaria/estrategias` | GET | Disponible | Bearer | analiticas:leer | — |
| Comercial | `/comercial/monetizacion-comunitaria/ofertas` | GET | Disponible | Bearer | analiticas:leer | — |
| Comercial | `/comercial/monetizacion-comunitaria/recomendacion` | POST | Disponible | Bearer | analiticas:leer | esquemaRecomendacionMonetizacion |
| Cumplimiento | `/compliance/audit-log` | GET | Disponible | Bearer | compliance:leer | — |
| Cumplimiento | `/compliance/dsr` | POST | Disponible | Bearer | compliance:gestionar | esquemaCrearDsr |
| Cumplimiento | `/compliance/purge` | POST | Disponible | Bearer | compliance:expurgar | esquemaPurgeCompliance |
| Cumplimiento | `/compliance/status` | GET | Disponible | Bearer | compliance:leer | — |
| Entregas | `/entregas` | GET | Disponible | Bearer | entregas:gestionar | esquemaListarEntregas |
| Entregas | `/entregas/{entregaId}` | GET | Disponible | Bearer | entregas:gestionar | — |
| Entregas | `/entregas/deshacer-folio` | POST | Disponible | Bearer | entregas:gestionar | esquemaDeshacerEntregaPorFolio |
| Entregas | `/entregas/vincular` | POST | Disponible | Bearer | entregas:gestionar | esquemaVincularEntrega |
| Entregas | `/entregas/vincular-folio` | POST | Disponible | Bearer | entregas:gestionar | esquemaVincularEntregaPorFolio |
| Evaluaciones | `/evaluaciones/alumnos/{alumnoId}/resumen` | GET | Disponible | Bearer | evaluaciones:leer | — |
| Evaluaciones | `/evaluaciones/configuracion-periodo` | GET, POST | Disponible | Bearer | evaluaciones:leer, evaluaciones:gestionar | esquemaConfigurarPeriodo |
| Evaluaciones | `/evaluaciones/encuadre/estado/{periodoId}` | GET | Disponible | Bearer | evaluaciones:leer | — |
| Evaluaciones | `/evaluaciones/encuadre/inicializar` | POST | Disponible | Bearer | evaluaciones:gestionar | esquemaInicializarEncuadre |
| Evaluaciones | `/evaluaciones/evidencias` | GET, POST | Disponible | Bearer | evaluaciones:leer, evaluaciones:gestionar | esquemaCrearEvidencia |
| Evaluaciones | `/evaluaciones/evidencias/{evidenciaId}` | GET, PUT | Parcial; revisar operaciones | Bearer | evaluaciones:leer, evaluaciones:gestionar | esquemaActualizarEvidencia |
| Evaluaciones | `/evaluaciones/evidencias/{evidenciaId}/archivar` | POST | Parcial; revisar operaciones | Bearer | evaluaciones:gestionar | esquemaArchivarEvidencia |
| Evaluaciones | `/evaluaciones/evidencias/{evidenciaId}/restaurar` | POST | Parcial; revisar operaciones | Bearer | evaluaciones:gestionar | esquemaRestaurarEvidencia |
| Evaluaciones | `/evaluaciones/examenes/componentes` | POST | Disponible | Bearer | evaluaciones:gestionar | esquemaComponenteExamen |
| Evaluaciones | `/evaluaciones/politicas` | GET, POST | Disponible | Bearer | evaluaciones:leer, evaluaciones:gestionar | esquemaCrearPolitica |
| Evaluaciones | `/evaluaciones/politicas/{codigo}` | GET, PUT, DELETE | Disponible | Bearer | evaluaciones:leer, evaluaciones:gestionar | esquemaCrearPolitica, esquemaArchivarPolitica |
| Evaluaciones | `/evaluaciones/politicas/{codigo}/auditoria` | GET | Disponible | Bearer | evaluaciones:leer | — |
| Evaluaciones | `/evaluaciones/v2/alumnos/{alumnoId}/resumen` | GET | Disponible | Bearer | evaluaciones:leer | — |
| Evaluaciones | `/evaluaciones/v2/classroom/cursos/{courseId}/mapeo-alumnos` | PUT | Disponible | Bearer | classroom:pull | esquemaActualizarMapeoAlumnosCurso |
| Evaluaciones | `/evaluaciones/v2/classroom/importaciones/ejecutar` | POST | Disponible | Bearer | classroom:pull | esquemaEjecutarImportacionClassroom |
| Evaluaciones | `/evaluaciones/v2/classroom/importaciones/historial` | GET | Disponible | Bearer | classroom:pull | — |
| Evaluaciones | `/evaluaciones/v2/classroom/importaciones/preview` | POST | Disponible | Bearer | classroom:pull | esquemaPreviewImportacionClassroom |
| Evaluaciones | `/evaluaciones/v2/classroom/mapeos` | GET | Disponible | Bearer | classroom:pull | — |
| Evaluaciones | `/evaluaciones/v2/classroom/oauth/desconectar` | POST | Disponible | Bearer | classroom:conectar | esquemaBodyVacioOpcional |
| Evaluaciones | `/evaluaciones/v2/classroom/oauth/iniciar` | GET | Disponible | Bearer | classroom:conectar | — |
| Evaluaciones | `/evaluaciones/v2/contexto` | GET | Disponible | Bearer | evaluaciones:leer | — |
| Evaluaciones | `/evaluaciones/v2/evidencias` | POST | Disponible | Bearer | evaluaciones:gestionar | esquemaCrearEvidencia |
| Evaluaciones | `/evaluaciones/v2/examenes/componentes` | POST | Disponible | Bearer | evaluaciones:gestionar | esquemaComponenteExamen |
| Evaluaciones | `/evaluaciones/v2/politica` | POST | Disponible | Bearer | evaluaciones:gestionar | esquemaConfigurarPeriodo |
| Exámenes | `/examenes/generados` | GET, POST | Disponible | Bearer | examenes:leer, examenes:generar | esquemaGenerarExamen |
| Exámenes | `/examenes/generados/{id}` | GET | Disponible | Bearer | examenes:leer | — |
| Exámenes | `/examenes/generados/{id}/archivar` | POST | Disponible | Bearer | examenes:archivar | esquemaBodyVacioOpcional |
| Exámenes | `/examenes/generados/{id}/pdf` | GET | Disponible | Bearer | examenes:descargar | — |
| Exámenes | `/examenes/generados/{id}/regenerar` | POST | Disponible | Bearer | examenes:regenerar | esquemaRegenerarExamenGenerado |
| Exámenes | `/examenes/generados/folio/{folio}` | GET | Disponible | Bearer | examenes:leer | — |
| Exámenes | `/examenes/generados/lote` | POST | Disponible | Bearer | examenes:generar | esquemaGenerarExamenesLote |
| Exámenes | `/examenes/generados/lote/{loteId}/archivar` | POST | Parcial; revisar operaciones | Bearer | examenes:archivar | esquemaCambiarEstadoLotePdf |
| Exámenes | `/examenes/generados/lote/{loteId}/auditoria` | GET | Parcial; revisar operaciones | Bearer | examenes:leer | esquemaListarAuditoriaLotePdf |
| Exámenes | `/examenes/generados/lote/{loteId}/pdf` | GET | Disponible | Bearer | examenes:descargar | — |
| Exámenes | `/examenes/generados/lote/{loteId}/progreso` | GET | Disponible | Bearer | examenes:leer | — |
| Exámenes | `/examenes/generados/lote/{loteId}/restaurar` | POST | Parcial; revisar operaciones | Bearer | examenes:archivar | esquemaCambiarEstadoLotePdf |
| Exámenes | `/examenes/generados/lotes` | GET | Parcial; revisar operaciones | Bearer | examenes:leer | esquemaListarLotesExamenes |
| Exámenes | `/examenes/generados/purge` | POST | Disponible | Bearer | examenes:archivar | esquemaPurgarExamenesGenerados |
| Exámenes | `/examenes/plantillas` | GET, POST | Disponible | Bearer | plantillas:leer, plantillas:gestionar | esquemaCrearPlantilla |
| Exámenes | `/examenes/plantillas/{id}` | POST, GET | Disponible | Bearer | plantillas:gestionar, plantillas:leer | esquemaActualizarPlantilla |
| Exámenes | `/examenes/plantillas/{id}/archivar` | POST | Disponible | Bearer | plantillas:archivar | esquemaBodyVacioOpcional |
| Exámenes | `/examenes/plantillas/{id}/eliminar` | POST | Disponible | Bearer | plantillas:archivar | esquemaBodyVacioOpcional |
| Exámenes | `/examenes/plantillas/{id}/previsualizar` | GET | Disponible | Bearer | plantillas:previsualizar | — |
| Exámenes | `/examenes/plantillas/{id}/previsualizar/pdf` | GET | Disponible | Bearer | plantillas:previsualizar | — |
| Exámenes | `/examenes/plantillas/{id}/previsualizar/pdf/visual` | GET | Disponible | Bearer | plantillas:previsualizar | — |
| Hidratación | `/hidratacion-cursos/importar` | POST | Disponible | Bearer | evaluaciones:gestionar | esquemaHidratacionMultipart |
| Hidratación | `/hidratacion-cursos/preview` | POST | Disponible | Bearer | evaluaciones:gestionar | esquemaHidratacionMultipart |
| Lista académica | `/analiticas/lista-academica` | GET | Parcial; revisar operaciones | Bearer | analiticas:leer | — |
| Listas institucionales | `/listas-institucionales/generar` | GET | Disponible | Bearer | analiticas:leer | — |
| Listas institucionales | `/listas-institucionales/plantillas` | GET | Disponible | Bearer | analiticas:leer | — |
| OMR | `/omr/analizar` | POST | Disponible | Bearer | omr:analizar | esquemaAnalizarOmr |
| OMR | `/omr/ingestas` | POST | Parcial; revisar operaciones | Bearer | omr:analizar | — |
| OMR | `/omr/ingestas/{jobId}` | GET | Parcial; revisar operaciones | Bearer | omr:analizar | — |
| OMR | `/omr/ingestas/{jobId}/manifiesto` | GET | Parcial; revisar operaciones | Bearer | omr:analizar | — |
| OMR | `/omr/ingestas/{jobId}/originales/{fileId}` | GET | Parcial; revisar operaciones | Bearer | omr:analizar | — |
| OMR | `/omr/ingestas/{jobId}/paginas/{pageIndex}/resolver` | POST | Parcial; revisar operaciones | Bearer | omr:analizar | esquemaResolverPaginaIngestaOmr |
| OMR | `/omr/ingestas/{jobId}/paquetes/{packageId}` | GET | Parcial; revisar operaciones | Bearer | omr:analizar | — |
| OMR | `/omr/ingestas/por-clave/{clientRequestId}` | GET | Parcial; revisar operaciones | Bearer | omr:analizar | — |
| OMR | `/omr/jobs` | POST, GET | Disponible | Bearer | omr:analizar | esquemaCrearJobOmr, esquemaListarJobsOmr |
| OMR | `/omr/jobs/{jobId}` | GET | Disponible | Bearer | omr:analizar | — |
| OMR | `/omr/jobs/{jobId}/exceptions/{sheetSerial}/resolve` | POST | Disponible | Bearer | omr:analizar | esquemaResolverJobOmr |
| OMR | `/omr/jobs/{jobId}/finalize` | POST | Disponible | Bearer | omr:analizar | esquemaBodyVacioOpcional |
| OMR | `/omr/prevalidar-lote` | POST | Disponible | Bearer | omr:analizar | esquemaPrevalidarLoteOmr |
| Papelera | `/papelera` | GET | Disponible | Bearer | docentes:administrar | — |
| Papelera | `/papelera/{id}/restaurar` | POST | Disponible | Bearer | docentes:administrar | esquemaBodyVacioOpcional |
| Periodos | `/periodos` | GET, POST | Disponible | Bearer | periodos:leer, periodos:gestionar | esquemaCrearPeriodo |
| Periodos | `/periodos/{periodoId}/actualizar` | POST | Disponible | Bearer | periodos:gestionar | esquemaActualizarPeriodo |
| Periodos | `/periodos/{periodoId}/archivar` | POST | Disponible | Bearer | periodos:archivar | esquemaBodyVacioOpcional |
| Periodos | `/periodos/{periodoId}/eliminar` | POST | Disponible | Bearer | periodos:eliminar_dev | esquemaBodyVacioOpcional |
| Reactivos | `/banco-preguntas` | GET, POST | Disponible | Bearer | banco:leer, banco:gestionar | esquemaCrearPregunta |
| Reactivos | `/banco-preguntas/{preguntaId}/actualizar` | POST | Disponible | Bearer | banco:gestionar | esquemaActualizarPregunta |
| Reactivos | `/banco-preguntas/{preguntaId}/archivar` | POST | Disponible | Bearer | banco:archivar | esquemaBodyVacioOpcional |
| Reactivos | `/banco-preguntas/{preguntaId}/eliminar` | POST | Disponible | Bearer | banco:archivar | esquemaBodyVacioOpcional |
| Reactivos | `/banco-preguntas/importaciones` | GET | Parcial; revisar operaciones | Bearer | banco:leer | — |
| Reactivos | `/banco-preguntas/importaciones/{importId}` | GET | Parcial; revisar operaciones | Bearer | banco:leer | — |
| Reactivos | `/banco-preguntas/importaciones/{importId}/confirmar` | POST | Parcial; revisar operaciones | Bearer | banco:ingestar | esquemaConfirmarReactivos |
| Reactivos | `/banco-preguntas/importaciones/esquema` | GET | Parcial; revisar operaciones | Bearer | banco:leer | — |
| Reactivos | `/banco-preguntas/importaciones/plantilla.xlsx` | GET | Parcial; revisar operaciones | Bearer | banco:leer | — |
| Reactivos | `/banco-preguntas/importaciones/preview` | POST | Parcial; revisar operaciones | Bearer | banco:ingestar | esquemaPreviewImportacionReactivos |
| Reactivos | `/banco-preguntas/mover-tema` | POST | Disponible | Bearer | banco:gestionar | esquemaMoverPreguntasTemaBanco |
| Reactivos | `/banco-preguntas/quitar-tema` | POST | Disponible | Bearer | banco:gestionar | esquemaQuitarTemaBanco |
| Reactivos | `/banco-preguntas/reactivos` | GET | Parcial; revisar operaciones | Bearer | banco:leer | — |
| Reactivos | `/banco-preguntas/reactivos/{reactivoId}` | GET | Parcial; revisar operaciones | Bearer | banco:leer | — |
| Reactivos | `/banco-preguntas/reactivos/{reactivoId}/calibracion` | GET, POST | Parcial; revisar operaciones | Bearer | banco:calibracion:leer, banco:gestionar | esquemaRegistrarCalibracionReactivo |
| Reactivos | `/banco-preguntas/reactivos/{reactivoId}/publicar` | POST | Parcial; revisar operaciones | Bearer | banco:publicar | esquemaBodyVacioOpcional |
| Reactivos | `/banco-preguntas/reactivos/{reactivoId}/retirar` | POST | Parcial; revisar operaciones | Bearer | banco:publicar | esquemaBodyVacioOpcional |
| Reactivos | `/banco-preguntas/reactivos/{reactivoId}/revisar` | POST | Parcial; revisar operaciones | Bearer | banco:revisar | esquemaBodyVacioOpcional |
| Reactivos | `/banco-preguntas/reactivos/{reactivoId}/versiones` | GET | Parcial; revisar operaciones | Bearer | banco:leer | — |
| Reactivos | `/banco-preguntas/temas` | GET, POST | Disponible | Bearer | banco:leer, banco:gestionar | esquemaCrearTemaBanco |
| Reactivos | `/banco-preguntas/temas/{temaId}` | GET | Disponible | Bearer | banco:leer | — |
| Reactivos | `/banco-preguntas/temas/{temaId}/actualizar` | POST | Disponible | Bearer | banco:gestionar | esquemaActualizarTemaBanco |
| Reactivos | `/banco-preguntas/temas/{temaId}/archivar` | POST | Disponible | Bearer | banco:archivar | esquemaArchivarTemaBanco |
| Reactivos | `/banco-preguntas/temas/{temaId}/auditoria` | GET | Disponible | Bearer | banco:leer | esquemaListarAuditoriaTemaBanco |
| Recuperación | `/recuperacion/bundle/reconstruir` | POST | Disponible | Bearer | recuperacion:reconstruir | esquemaReconstruirBundle |
| Recuperación | `/recuperacion/bundles` | GET | Disponible | Bearer | recuperacion:leer | — |
| Recuperación | `/recuperacion/manifest/reconstruir` | POST | Disponible | Bearer | recuperacion:reconstruir | esquemaReconstruirManifest |
| Recuperación | `/recuperacion/noop` | POST | Disponible | Bearer | recuperacion:leer | esquemaBodyVacioOpcional |
| Recuperación | `/recuperacion/verificar` | POST | Disponible | Bearer | recuperacion:leer | esquemaVerificarRecuperacion |
| Sincronización | `/sincronizaciones` | GET | Disponible | Bearer | sincronizacion:listar | — |
| Sincronización | `/sincronizaciones/codigo-acceso` | POST, GET | Disponible | Bearer | calificaciones:publicar | esquemaGenerarCodigoAcceso, esquemaListarCodigosAcceso |
| Sincronización | `/sincronizaciones/codigo-acceso/{codigoAccesoId}` | GET | Disponible | Bearer | calificaciones:publicar | — |
| Sincronización | `/sincronizaciones/codigo-acceso/{codigoAccesoId}/expirar` | POST | Disponible | Bearer | calificaciones:publicar | — |
| Sincronización | `/sincronizaciones/local/configuracion` | GET | Disponible | Bearer | sincronizacion:listar | — |
| Sincronización | `/sincronizaciones/local/configuracion/carpeta` | POST | Disponible | Bearer | sincronizacion:importar | esquemaConfigurarCarpetaSincronizacion |
| Sincronización | `/sincronizaciones/local/exportar` | POST | Disponible | Bearer | sincronizacion:exportar | esquemaExportarInstantaneaLocal |
| Sincronización | `/sincronizaciones/local/importar` | POST | Disponible | Bearer | sincronizacion:importar | esquemaImportarInstantaneaLocal |
| Sincronización | `/sincronizaciones/local/lease/liberar` | POST | Disponible | Bearer | sincronizacion:importar | esquemaLeaseSincronizacion |
| Sincronización | `/sincronizaciones/local/lease/renovar` | POST | Disponible | Bearer | sincronizacion:importar | esquemaLeaseSincronizacion |
| Sincronización | `/sincronizaciones/local/nube/descargar` | GET | Disponible | Bearer | sincronizacion:importar | — |
| Sincronización | `/sincronizaciones/local/nube/importar` | POST | Disponible | Bearer | sincronizacion:importar | esquemaImportarInstantaneaNube |
| Sincronización | `/sincronizaciones/local/nube/publicar` | POST | Disponible | Bearer | sincronizacion:exportar | esquemaPublicarInstantaneaNube |
| Sincronización | `/sincronizaciones/paquete/exportar` | POST | Disponible | Bearer | sincronizacion:exportar | esquemaExportarPaquete |
| Sincronización | `/sincronizaciones/paquete/importar` | POST | Disponible | Bearer | sincronizacion:importar | esquemaImportarPaquete |
| Sincronización | `/sincronizaciones/publicar` | POST | Disponible | Bearer | calificaciones:publicar | esquemaPublicarResultados |
| Sincronización | `/sincronizaciones/pull` | POST | Disponible | Bearer | sincronizacion:pull | esquemaTraerPaquetesServidor |
| Sincronización | `/sincronizaciones/push` | POST | Disponible | Bearer | sincronizacion:push | esquemaEnviarPaqueteServidor |
| Sistema | `/salud` | GET | Disponible | Público | — | — |
| Sistema | `/salud/ip-local` | GET | Disponible | Público | — | — |
| Sistema | `/salud/live` | GET | Disponible | Público | — | — |
| Sistema | `/salud/metrics` | GET | Disponible | Público | — | — |
| Sistema | `/salud/qr` | GET | Disponible | Público | — | — |
| Sistema | `/salud/ready` | GET | Disponible | Público | — | — |
| Sistema | `/salud/version-info` | GET | Disponible | Público | — | — |
| Sistema | `/sincronizaciones/local/lease` | GET | Disponible | Bearer | sincronizacion:listar | — |
| Sistema | `/sincronizaciones/local/lease/adquirir` | POST | Disponible | Bearer | sincronizacion:importar | esquemaLeaseSincronizacion |
| Sistema | `/version` | GET | Disponible | Público | — | — |
| Temarios | `/temarios` | GET | Disponible | Bearer | temarios:leer | — |
| Temarios | `/temarios/{temarioId}` | GET, PUT | Parcial; revisar operaciones | Bearer | temarios:leer, temarios:gestionar | esquemaActualizarTemario |
| Temarios | `/temarios/{temarioId}/auditoria` | GET | Parcial; revisar operaciones | Bearer | temarios:leer | esquemaListarAuditoriaTemario |
| Temarios | `/temarios/{temarioId}/eliminar` | POST | Disponible | Bearer | temarios:gestionar | esquemaBodyVacioOpcional |
| Temarios | `/temarios/{temarioId}/nodos` | GET | Disponible | Bearer | temarios:leer | — |
| Temarios | `/temarios/desde-pdf` | POST | Disponible | Bearer | temarios:gestionar | esquemaCrearTemarioPdf |
| Temarios | `/temarios/manual` | POST | Disponible | Bearer | temarios:gestionar | esquemaCrearTemarioManual |
| Temarios | `/temarios/nodos/{nodoId}/estado` | POST | Disponible | Bearer | temarios:gestionar | esquemaActualizarEstadoNodo |
