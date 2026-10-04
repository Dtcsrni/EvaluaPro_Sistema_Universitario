# Catálogo de rutas y operaciones API

Generado desde los routers backend. 240 rutas documentadas; las operaciones CRUD y de dominio se muestran tal como existen. Este catálogo no inventa endpoints para modelos sin una ruta montada.

Los permisos y validadores se leen de los middlewares y llamadas `validarCuerpo` de cada router. Los schemas detallados de flujos críticos están en [`openapi.json`](./openapi.json); un validador `esquema...` apunta a la definición Zod del backend cuando el contrato amplio todavía no exporta campos en JSON Schema.

| Módulo | Ruta | Métodos | Sesión | Permisos | Validador de cuerpo |
| --- | --- | --- | --- | --- | --- |
| Administración | `/admin/docentes` | GET | Bearer | docentes:administrar | — |
| Administración | `/admin/docentes/{docenteId}` | POST | Bearer | docentes:administrar | esquemaActualizarDocenteAdmin |
| Administración comercial | `/admin-negocio/auditoria` | GET | Bearer | comercial:auditoria:leer | — |
| Administración comercial | `/admin-negocio/campanas` | GET, POST | Bearer | comercial:campanas:leer, comercial:campanas:gestionar | esquemaCrearCampana |
| Administración comercial | `/admin-negocio/campanas/{id}` | PATCH, POST | Bearer | comercial:campanas:gestionar | esquemaActualizarCampana |
| Administración comercial | `/admin-negocio/cobranza` | GET | Bearer | comercial:cobranza:leer | — |
| Administración comercial | `/admin-negocio/cobranza/ciclo/ejecutar` | POST | Bearer | comercial:cobranza:gestionar | esquemaEjecutarCicloCobranza |
| Administración comercial | `/admin-negocio/cobranza/mercadopago/preferencia` | POST | Bearer | comercial:cobranza:gestionar | esquemaCrearPreferenciaMercadoPago |
| Administración comercial | `/admin-negocio/consentimientos` | POST | Bearer | comercial:suscripciones:gestionar | esquemaConsentimientoComercial |
| Administración comercial | `/admin-negocio/cupones` | GET, POST | Bearer | comercial:cupones:leer, comercial:cupones:gestionar | esquemaCrearCupon |
| Administración comercial | `/admin-negocio/cupones/{id}` | PATCH, POST | Bearer | comercial:cupones:gestionar | esquemaActualizarCupon |
| Administración comercial | `/admin-negocio/dashboard/resumen` | GET | Bearer | comercial:metricas:leer | — |
| Administración comercial | `/admin-negocio/licencias` | GET | Bearer | comercial:licencias:leer | — |
| Administración comercial | `/admin-negocio/licencias/{id}/reasignar-dispositivo` | POST | Bearer | comercial:licencias:gestionar | esquemaReasignarLicenciaDispositivo |
| Administración comercial | `/admin-negocio/licencias/{id}/revocar` | POST | Bearer | comercial:licencias:revocar | esquemaRevocarLicencia |
| Administración comercial | `/admin-negocio/licencias/generar` | POST | Bearer | comercial:licencias:gestionar | esquemaGenerarLicencia |
| Administración comercial | `/admin-negocio/metricas/churn` | GET | Bearer | comercial:metricas:leer | — |
| Administración comercial | `/admin-negocio/metricas/conversion` | GET | Bearer | comercial:metricas:leer | — |
| Administración comercial | `/admin-negocio/metricas/guardrails` | GET | Bearer | comercial:metricas:leer | — |
| Administración comercial | `/admin-negocio/metricas/ltv-cac` | GET | Bearer | comercial:metricas:leer | — |
| Administración comercial | `/admin-negocio/metricas/mrr` | GET | Bearer | comercial:metricas:leer | — |
| Administración comercial | `/admin-negocio/planes` | GET, POST | Bearer | comercial:planes:leer, comercial:planes:gestionar | esquemaCrearPlan |
| Administración comercial | `/admin-negocio/planes/{id}` | PATCH, POST | Bearer | comercial:planes:gestionar | esquemaActualizarPlan |
| Administración comercial | `/admin-negocio/plantillas-notificacion` | GET, POST | Bearer | comercial:campanas:leer, comercial:campanas:gestionar | esquemaCrearPlantillaNotificacion |
| Administración comercial | `/admin-negocio/plantillas-notificacion/{id}` | PATCH, POST | Bearer | comercial:campanas:gestionar | esquemaActualizarPlantillaNotificacion |
| Administración comercial | `/admin-negocio/suscripciones` | GET, POST | Bearer | comercial:suscripciones:leer, comercial:suscripciones:gestionar | esquemaCrearSuscripcion |
| Administración comercial | `/admin-negocio/suscripciones/{id}/aplicar-cupon` | POST | Bearer | comercial:suscripciones:gestionar | esquemaAplicarCupon |
| Administración comercial | `/admin-negocio/suscripciones/{id}/cambiar-plan` | POST | Bearer | comercial:suscripciones:gestionar | esquemaCambiarPlan |
| Administración comercial | `/admin-negocio/suscripciones/{id}/estado` | POST | Bearer | comercial:suscripciones:gestionar | esquemaActualizarEstadoSuscripcion |
| Administración comercial | `/admin-negocio/tenants` | GET, POST | Bearer | comercial:tenants:leer, comercial:tenants:gestionar | esquemaCrearTenant |
| Administración comercial | `/admin-negocio/tenants/{id}` | PATCH, POST | Bearer | comercial:tenants:gestionar | esquemaActualizarTenant |
| Alumnos | `/alumnos` | GET, POST | Bearer | alumnos:leer, alumnos:gestionar | esquemaCrearAlumno |
| Alumnos | `/alumnos/{alumnoId}` | GET | Bearer | alumnos:leer | — |
| Alumnos | `/alumnos/{alumnoId}/actualizar` | POST | Bearer | alumnos:gestionar | esquemaActualizarAlumno |
| Alumnos | `/alumnos/{alumnoId}/eliminar` | POST | Bearer | alumnos:eliminar_dev | esquemaBodyVacioOpcional |
| Alumnos | `/alumnos/reinscribir-grupo-archivado` | POST | Bearer | alumnos:gestionar | esquemaReinscribirGrupoArchivado |
| Analíticas | `/analiticas/banderas` | GET, POST | Bearer | analiticas:leer | esquemaCrearBandera |
| Analíticas | `/analiticas/calificaciones-csv` | GET | Bearer | analiticas:leer | — |
| Analíticas | `/analiticas/calificaciones-xlsx` | GET | Bearer | analiticas:leer | — |
| Analíticas | `/analiticas/eventos-uso` | POST | Bearer | analiticas:leer | esquemaRegistrarEventosUso |
| Analíticas | `/analiticas/exportar-csv` | POST | Bearer | analiticas:leer | esquemaExportarCsv |
| Analíticas | `/analiticas/lista-academica-csv` | GET | Bearer | analiticas:leer | — |
| Analíticas | `/analiticas/lista-academica-docx` | GET | Bearer | analiticas:leer | — |
| Analíticas | `/analiticas/lista-academica-firma` | GET | Bearer | analiticas:leer | — |
| Analíticas | `/analiticas/lista-academica/bono/preview` | POST | Bearer | calificaciones:calificar | esquemaPreviewBonoExtracurricular |
| Analíticas | `/analiticas/lista-academica/calificaciones` | POST | Bearer | calificaciones:calificar | esquemaGuardarCalificacionLista |
| API | `/comercial-publico/licencias/activar` | POST | Público | — | esquemaActivarLicencia |
| API | `/comercial-publico/licencias/heartbeat` | POST | Público | — | esquemaHeartbeatLicencia |
| API | `/comercial-publico/mercadopago/webhook` | POST | Público | — | esquemaWebhookMercadoPago |
| API | `/evaluaciones-publicas/encuadre/firmar/{token}` | GET, POST | Público | — | esquemaVacio |
| API | `/evaluaciones-publicas/encuadre/pdf/{token}` | GET | Público | — | — |
| API | `/metrics` | GET | Público | — | — |
| API | `/preflight` | GET | Bearer | — | — |
| Asistencia | `/asistencias/derecho-examen/{alumnoId}` | GET | Bearer | asistencias:leer | — |
| Asistencia | `/asistencias/excepciones` | GET, POST | Bearer | asistencias:leer, asistencias:gestionar | esquemaCrearExcepcion |
| Asistencia | `/asistencias/excepciones/{excepcionId}/eliminar` | POST | Bearer | asistencias:gestionar | esquemaBodyVacioOpcional |
| Asistencia | `/asistencias/reglas` | GET, POST | Bearer | asistencias:leer, asistencias:gestionar | esquemaCrearRegla |
| Asistencia | `/asistencias/reglas/{reglaId}/eliminar` | POST | Bearer | asistencias:gestionar | esquemaBodyVacioOpcional |
| Asistencia | `/asistencias/resumen` | GET | Bearer | asistencias:leer | — |
| Asistencia | `/asistencias/sesiones` | GET, POST | Bearer | asistencias:leer, asistencias:gestionar | esquemaCrearSesion |
| Asistencia | `/asistencias/sesiones/{sesionId}/eliminar` | POST | Bearer | asistencias:gestionar | esquemaBodyVacioOpcional |
| Asistencia | `/asistencias/sesiones/{sesionId}/registros` | GET, POST | Bearer | asistencias:leer, asistencias:gestionar | esquemaGuardarRegistros |
| Autenticación | `/autenticacion/accesos-directos/regenerar` | POST | Bearer | cuenta:actualizar | esquemaBodyVacioOpcional |
| Autenticación | `/autenticacion/capacidades-integraciones` | GET | Público | — | — |
| Autenticación | `/autenticacion/definir-contrasena` | POST | Bearer | cuenta:actualizar | esquemaDefinirContrasenaDocente |
| Autenticación | `/autenticacion/google` | POST | Público | — | esquemaIngresarDocenteGoogle |
| Autenticación | `/autenticacion/ingresar` | POST | Público | — | esquemaIngresarDocente |
| Autenticación | `/autenticacion/perfil` | GET | Bearer | cuenta:leer | — |
| Autenticación | `/autenticacion/preferencias/pdf` | POST | Bearer | cuenta:actualizar | esquemaActualizarPreferenciasPdf |
| Autenticación | `/autenticacion/recuperar-contrasena-google` | POST | Público | — | esquemaRecuperarContrasenaGoogle |
| Autenticación | `/autenticacion/refrescar` | POST | Público | — | esquemaBodyVacioOpcional |
| Autenticación | `/autenticacion/registrar` | POST | Público | — | esquemaRegistrarDocente |
| Autenticación | `/autenticacion/registrar-google` | POST | Público | — | esquemaRegistrarDocenteGoogle |
| Autenticación | `/autenticacion/restablecer-contrasena` | POST | Público | — | esquemaRestablecerContrasena |
| Autenticación | `/autenticacion/salir` | POST | Público | — | esquemaBodyVacioOpcional |
| Autenticación | `/autenticacion/solicitar-recuperacion-contrasena` | POST | Público | — | esquemaSolicitarRecuperacionContrasena |
| Calificaciones | `/calificaciones/calificar` | POST | Bearer | calificaciones:calificar | esquemaCalificarExamen |
| Calificaciones | `/calificaciones/examen/{examenGeneradoId}` | GET | Bearer | calificaciones:calificar | — |
| Calificaciones | `/calificaciones/revision/solicitudes` | GET | Bearer | calificaciones:calificar | — |
| Calificaciones | `/calificaciones/revision/solicitudes/{id}/resolver` | POST | Bearer | calificaciones:calificar | esquemaResolverSolicitudRevision |
| Calificaciones | `/calificaciones/revision/solicitudes/sincronizar` | POST | Bearer | calificaciones:calificar | esquemaSincronizarSolicitudesRevision |
| Classroom | `/evaluaciones/v2/classroom/cursos` | GET | Bearer | classroom:pull | — |
| Classroom | `/evaluaciones/v2/classroom/cursos/{courseId}/actividades` | GET | Bearer | classroom:pull | — |
| Classroom | `/evaluaciones/v2/classroom/cursos/{courseId}/alumnos` | GET | Bearer | classroom:pull | — |
| Classroom | `/evaluaciones/v2/classroom/cursos/{courseId}/importar-alumnos` | POST | Bearer | classroom:pull | esquemaImportarAlumnosClassroom |
| Classroom | `/evaluaciones/v2/classroom/estado` | GET | Bearer | classroom:pull | — |
| Classroom | `/integraciones/classroom/mapear` | GET, POST | Bearer | classroom:pull | esquemaMapearClassroom |
| Classroom | `/integraciones/classroom/oauth/callback` | GET | Público | — | — |
| Classroom | `/integraciones/classroom/oauth/iniciar` | GET | Bearer | classroom:conectar | — |
| Classroom | `/integraciones/classroom/pull` | POST | Bearer | classroom:pull | esquemaPullClassroom |
| Comercial | `/comercial/monetizacion-comunitaria/estrategias` | GET | Bearer | analiticas:leer | — |
| Comercial | `/comercial/monetizacion-comunitaria/ofertas` | GET | Bearer | analiticas:leer | — |
| Comercial | `/comercial/monetizacion-comunitaria/recomendacion` | POST | Bearer | analiticas:leer | esquemaRecomendacionMonetizacion |
| Cumplimiento | `/compliance/audit-log` | GET | Bearer | compliance:leer | — |
| Cumplimiento | `/compliance/dsr` | POST | Bearer | compliance:gestionar | esquemaCrearDsr |
| Cumplimiento | `/compliance/purge` | POST | Bearer | compliance:expurgar | esquemaPurgeCompliance |
| Cumplimiento | `/compliance/status` | GET | Bearer | compliance:leer | — |
| Entregas | `/entregas` | GET | Bearer | entregas:gestionar | esquemaListarEntregas |
| Entregas | `/entregas/{entregaId}` | GET | Bearer | entregas:gestionar | — |
| Entregas | `/entregas/deshacer-folio` | POST | Bearer | entregas:gestionar | esquemaDeshacerEntregaPorFolio |
| Entregas | `/entregas/vincular` | POST | Bearer | entregas:gestionar | esquemaVincularEntrega |
| Entregas | `/entregas/vincular-folio` | POST | Bearer | entregas:gestionar | esquemaVincularEntregaPorFolio |
| Evaluaciones | `/evaluaciones/alumnos/{alumnoId}/resumen` | GET | Bearer | evaluaciones:leer | — |
| Evaluaciones | `/evaluaciones/configuracion-periodo` | GET, POST | Bearer | evaluaciones:leer, evaluaciones:gestionar | esquemaConfigurarPeriodo |
| Evaluaciones | `/evaluaciones/encuadre/estado/{periodoId}` | GET | Bearer | evaluaciones:leer | — |
| Evaluaciones | `/evaluaciones/encuadre/inicializar` | POST | Bearer | evaluaciones:gestionar | esquemaInicializarEncuadre |
| Evaluaciones | `/evaluaciones/evidencias` | GET, POST | Bearer | evaluaciones:leer, evaluaciones:gestionar | esquemaListarEvidenciasEvaluacion, esquemaCrearEvidencia |
| Evaluaciones | `/evaluaciones/evidencias/{evidenciaId}` | GET, PUT | Bearer | evaluaciones:leer, evaluaciones:gestionar | esquemaActualizarEvidencia |
| Evaluaciones | `/evaluaciones/evidencias/{evidenciaId}/archivar` | POST | Bearer | evaluaciones:gestionar | esquemaArchivarEvidencia |
| Evaluaciones | `/evaluaciones/evidencias/{evidenciaId}/restaurar` | POST | Bearer | evaluaciones:gestionar | esquemaRestaurarEvidencia |
| Evaluaciones | `/evaluaciones/examenes/componentes` | POST | Bearer | evaluaciones:gestionar | esquemaComponenteExamen |
| Evaluaciones | `/evaluaciones/politicas` | GET, POST | Bearer | evaluaciones:leer, evaluaciones:gestionar | esquemaCrearPolitica |
| Evaluaciones | `/evaluaciones/politicas/{codigo}` | GET, PUT, DELETE | Bearer | evaluaciones:leer, evaluaciones:gestionar | esquemaCrearPolitica |
| Evaluaciones | `/evaluaciones/v2/alumnos/{alumnoId}/resumen` | GET | Bearer | evaluaciones:leer | — |
| Evaluaciones | `/evaluaciones/v2/classroom/cursos/{courseId}/mapeo-alumnos` | PUT | Bearer | classroom:pull | esquemaActualizarMapeoAlumnosCurso |
| Evaluaciones | `/evaluaciones/v2/classroom/importaciones/ejecutar` | POST | Bearer | classroom:pull | esquemaEjecutarImportacionClassroom |
| Evaluaciones | `/evaluaciones/v2/classroom/importaciones/historial` | GET | Bearer | classroom:pull | — |
| Evaluaciones | `/evaluaciones/v2/classroom/importaciones/preview` | POST | Bearer | classroom:pull | esquemaPreviewImportacionClassroom |
| Evaluaciones | `/evaluaciones/v2/classroom/mapeos` | GET | Bearer | classroom:pull | — |
| Evaluaciones | `/evaluaciones/v2/classroom/oauth/desconectar` | POST | Bearer | classroom:conectar | esquemaBodyVacioOpcional |
| Evaluaciones | `/evaluaciones/v2/classroom/oauth/iniciar` | GET | Bearer | classroom:conectar | — |
| Evaluaciones | `/evaluaciones/v2/contexto` | GET | Bearer | evaluaciones:leer | — |
| Evaluaciones | `/evaluaciones/v2/evidencias` | POST | Bearer | evaluaciones:gestionar | esquemaCrearEvidencia |
| Evaluaciones | `/evaluaciones/v2/examenes/componentes` | POST | Bearer | evaluaciones:gestionar | esquemaComponenteExamen |
| Evaluaciones | `/evaluaciones/v2/politica` | POST | Bearer | evaluaciones:gestionar | esquemaConfigurarPeriodo |
| Exámenes | `/examenes/generados` | GET, POST | Bearer | examenes:leer, examenes:generar | esquemaListarExamenesGenerados, esquemaGenerarExamen |
| Exámenes | `/examenes/generados/{id}` | GET | Bearer | examenes:leer | — |
| Exámenes | `/examenes/generados/{id}/archivar` | POST | Bearer | examenes:archivar | esquemaBodyVacioOpcional |
| Exámenes | `/examenes/generados/{id}/pdf` | GET | Bearer | examenes:descargar | — |
| Exámenes | `/examenes/generados/{id}/regenerar` | POST | Bearer | examenes:regenerar | esquemaRegenerarExamenGenerado |
| Exámenes | `/examenes/generados/folio/{folio}` | GET | Bearer | examenes:leer | — |
| Exámenes | `/examenes/generados/lote` | POST | Bearer | examenes:generar | esquemaGenerarExamenesLote |
| Exámenes | `/examenes/generados/lote/{loteId}/archivar` | POST | Bearer | examenes:archivar | esquemaCambiarEstadoLotePdf |
| Exámenes | `/examenes/generados/lote/{loteId}/auditoria` | GET | Bearer | examenes:leer | esquemaListarAuditoriaLotePdf |
| Exámenes | `/examenes/generados/lote/{loteId}/pdf` | GET | Bearer | examenes:descargar | — |
| Exámenes | `/examenes/generados/lote/{loteId}/progreso` | GET | Bearer | examenes:leer | — |
| Exámenes | `/examenes/generados/lote/{loteId}/restaurar` | POST | Bearer | examenes:archivar | esquemaCambiarEstadoLotePdf |
| Exámenes | `/examenes/generados/lotes` | GET | Bearer | examenes:leer | esquemaListarLotesExamenes |
| Exámenes | `/examenes/generados/purge` | POST | Bearer | examenes:archivar | esquemaPurgarExamenesGenerados |
| Exámenes | `/examenes/plantillas` | GET, POST | Bearer | plantillas:leer, plantillas:gestionar | esquemaCrearPlantilla |
| Exámenes | `/examenes/plantillas/{id}` | POST, GET | Bearer | plantillas:gestionar, plantillas:leer | esquemaActualizarPlantilla |
| Exámenes | `/examenes/plantillas/{id}/archivar` | POST | Bearer | plantillas:archivar | esquemaBodyVacioOpcional |
| Exámenes | `/examenes/plantillas/{id}/eliminar` | POST | Bearer | plantillas:archivar | esquemaBodyVacioOpcional |
| Exámenes | `/examenes/plantillas/{id}/previsualizar` | GET | Bearer | plantillas:previsualizar | — |
| Exámenes | `/examenes/plantillas/{id}/previsualizar/pdf` | GET | Bearer | plantillas:previsualizar | — |
| Exámenes | `/examenes/plantillas/{id}/previsualizar/pdf/visual` | GET | Bearer | plantillas:previsualizar | — |
| Hidratación | `/hidratacion-cursos/importar` | POST | Bearer | evaluaciones:gestionar, banco:ingestar | esquemaHidratacionMultipart |
| Hidratación | `/hidratacion-cursos/preview` | POST | Bearer | evaluaciones:gestionar | esquemaHidratacionMultipart |
| Lista académica | `/analiticas/lista-academica` | GET | Bearer | analiticas:leer | — |
| Listas institucionales | `/listas-institucionales/generar` | GET | Bearer | analiticas:leer | — |
| Listas institucionales | `/listas-institucionales/plantillas` | GET | Bearer | analiticas:leer | — |
| OMR | `/omr/analizar` | POST | Bearer | omr:analizar | esquemaAnalizarOmr |
| OMR | `/omr/ingestas` | POST | Bearer | omr:analizar | — |
| OMR | `/omr/ingestas/{jobId}` | GET | Bearer | omr:analizar | — |
| OMR | `/omr/ingestas/{jobId}/manifiesto` | GET | Bearer | omr:analizar | — |
| OMR | `/omr/ingestas/{jobId}/originales/{fileId}` | GET | Bearer | omr:analizar | — |
| OMR | `/omr/ingestas/{jobId}/paginas/{pageIndex}/preview` | GET | Bearer | omr:analizar | — |
| OMR | `/omr/ingestas/{jobId}/paginas/{pageIndex}/reference-preview` | GET | Bearer | omr:analizar | — |
| OMR | `/omr/ingestas/{jobId}/paginas/{pageIndex}/resolver` | POST | Bearer | omr:analizar | esquemaResolverPaginaIngestaOmr |
| OMR | `/omr/ingestas/{jobId}/paquetes/{packageId}` | GET | Bearer | omr:analizar | — |
| OMR | `/omr/ingestas/{jobId}/reintentar` | POST | Bearer | omr:analizar | esquemaReintentarIngestaOmr |
| OMR | `/omr/ingestas/por-clave/{clientRequestId}` | GET | Bearer | omr:analizar | — |
| OMR | `/omr/ingestas/prevalidar-referencia` | POST | Bearer | omr:analizar | esquemaPrevalidarReferenciaIngestaOmr |
| OMR | `/omr/jobs` | POST, GET | Bearer | omr:analizar | esquemaCrearJobOmr |
| OMR | `/omr/jobs/{jobId}` | GET | Bearer | omr:analizar | — |
| OMR | `/omr/jobs/{jobId}/exceptions/{sheetSerial}/resolve` | POST | Bearer | omr:analizar | esquemaResolverJobOmr |
| OMR | `/omr/jobs/{jobId}/finalize` | POST | Bearer | omr:analizar | esquemaBodyVacioOpcional |
| OMR | `/omr/prevalidar-lote` | POST | Bearer | omr:analizar | esquemaPrevalidarLoteOmr |
| Papelera | `/papelera` | GET | Bearer | docentes:administrar | — |
| Papelera | `/papelera/{id}/restaurar` | POST | Bearer | docentes:administrar | esquemaBodyVacioOpcional |
| Periodos | `/periodos` | GET, POST | Bearer | periodos:leer, periodos:gestionar | esquemaCrearPeriodo |
| Periodos | `/periodos/{periodoId}/actualizar` | POST | Bearer | periodos:gestionar | esquemaActualizarPeriodo |
| Periodos | `/periodos/{periodoId}/archivar` | POST | Bearer | periodos:archivar | esquemaBodyVacioOpcional |
| Periodos | `/periodos/{periodoId}/eliminar` | POST | Bearer | periodos:eliminar_dev | esquemaBodyVacioOpcional |
| Periodos | `/periodos/{periodoId}/portada` | GET, PUT, DELETE | Bearer | periodos:leer, periodos:gestionar | esquemaBodyVacioOpcional |
| Reactivos | `/banco-preguntas` | GET, POST | Bearer | banco:leer, banco:gestionar | esquemaCrearPregunta |
| Reactivos | `/banco-preguntas/{preguntaId}/actualizar` | POST | Bearer | banco:gestionar | esquemaActualizarPregunta |
| Reactivos | `/banco-preguntas/{preguntaId}/archivar` | POST | Bearer | banco:archivar | esquemaBodyVacioOpcional |
| Reactivos | `/banco-preguntas/{preguntaId}/eliminar` | POST | Bearer | banco:archivar | esquemaBodyVacioOpcional |
| Reactivos | `/banco-preguntas/importaciones` | GET | Bearer | banco:leer | — |
| Reactivos | `/banco-preguntas/importaciones/{importId}` | GET | Bearer | banco:leer | — |
| Reactivos | `/banco-preguntas/importaciones/{importId}/confirmar` | POST | Bearer | banco:ingestar | esquemaConfirmarReactivos |
| Reactivos | `/banco-preguntas/importaciones/esquema` | GET | Bearer | banco:leer | — |
| Reactivos | `/banco-preguntas/importaciones/plantilla.xlsx` | GET | Bearer | banco:leer | — |
| Reactivos | `/banco-preguntas/importaciones/preview` | POST | Bearer | banco:ingestar | esquemaPreviewImportacionReactivos |
| Reactivos | `/banco-preguntas/mover-tema` | POST | Bearer | banco:gestionar | esquemaMoverPreguntasTemaBanco |
| Reactivos | `/banco-preguntas/quitar-tema` | POST | Bearer | banco:gestionar | esquemaQuitarTemaBanco |
| Reactivos | `/banco-preguntas/reactivos` | GET | Bearer | banco:leer | — |
| Reactivos | `/banco-preguntas/reactivos/{reactivoId}` | GET | Bearer | banco:leer | — |
| Reactivos | `/banco-preguntas/reactivos/{reactivoId}/calibracion` | GET, POST | Bearer | banco:calibracion:leer, banco:gestionar | esquemaRegistrarCalibracionReactivo |
| Reactivos | `/banco-preguntas/reactivos/{reactivoId}/publicar` | POST | Bearer | banco:publicar | esquemaBodyVacioOpcional |
| Reactivos | `/banco-preguntas/reactivos/{reactivoId}/retirar` | POST | Bearer | banco:publicar | esquemaBodyVacioOpcional |
| Reactivos | `/banco-preguntas/reactivos/{reactivoId}/revisar` | POST | Bearer | banco:revisar | esquemaBodyVacioOpcional |
| Reactivos | `/banco-preguntas/reactivos/{reactivoId}/versiones` | GET | Bearer | banco:leer | — |
| Reactivos | `/banco-preguntas/temas` | GET, POST | Bearer | banco:leer, banco:gestionar | esquemaCrearTemaBanco |
| Reactivos | `/banco-preguntas/temas/{temaId}` | GET | Bearer | banco:leer | — |
| Reactivos | `/banco-preguntas/temas/{temaId}/actualizar` | POST | Bearer | banco:gestionar | esquemaActualizarTemaBanco |
| Reactivos | `/banco-preguntas/temas/{temaId}/archivar` | POST | Bearer | banco:archivar | esquemaArchivarTemaBanco |
| Reactivos | `/banco-preguntas/temas/{temaId}/auditoria` | GET | Bearer | banco:leer | esquemaListarAuditoriaTemaBanco |
| Recuperación | `/recuperacion/bundle/reconstruir` | POST | Bearer | recuperacion:reconstruir | esquemaReconstruirBundle |
| Recuperación | `/recuperacion/bundles` | GET | Bearer | recuperacion:leer | — |
| Recuperación | `/recuperacion/manifest/reconstruir` | POST | Bearer | recuperacion:reconstruir | esquemaReconstruirManifest |
| Recuperación | `/recuperacion/noop` | POST | Bearer | recuperacion:leer | esquemaBodyVacioOpcional |
| Recuperación | `/recuperacion/verificar` | POST | Bearer | recuperacion:leer | esquemaVerificarRecuperacion |
| Sincronización | `/sincronizaciones` | GET | Bearer | sincronizacion:listar | — |
| Sincronización | `/sincronizaciones/codigo-acceso` | POST, GET | Bearer | calificaciones:publicar | esquemaGenerarCodigoAcceso, esquemaListarCodigosAcceso |
| Sincronización | `/sincronizaciones/codigo-acceso/{codigoAccesoId}` | GET | Bearer | calificaciones:publicar | — |
| Sincronización | `/sincronizaciones/codigo-acceso/{codigoAccesoId}/expirar` | POST | Bearer | calificaciones:publicar | esquemaBodyVacioOpcional |
| Sincronización | `/sincronizaciones/local/configuracion` | GET | Bearer | sincronizacion:listar | — |
| Sincronización | `/sincronizaciones/local/configuracion/carpeta` | POST | Bearer | sincronizacion:importar | esquemaConfigurarCarpetaSincronizacion |
| Sincronización | `/sincronizaciones/local/exportar` | POST | Bearer | sincronizacion:exportar | esquemaExportarInstantaneaLocal |
| Sincronización | `/sincronizaciones/local/importar` | POST | Bearer | sincronizacion:importar | esquemaImportarInstantaneaLocal |
| Sincronización | `/sincronizaciones/local/lease/liberar` | POST | Bearer | sincronizacion:importar | esquemaLeaseSincronizacion |
| Sincronización | `/sincronizaciones/local/lease/renovar` | POST | Bearer | sincronizacion:importar | esquemaLeaseSincronizacion |
| Sincronización | `/sincronizaciones/local/nube/descargar` | GET | Bearer | sincronizacion:importar | — |
| Sincronización | `/sincronizaciones/local/nube/importar` | POST | Bearer | sincronizacion:importar | esquemaImportarInstantaneaNube |
| Sincronización | `/sincronizaciones/local/nube/publicar` | POST | Bearer | sincronizacion:exportar | esquemaPublicarInstantaneaNube |
| Sincronización | `/sincronizaciones/paquete/exportar` | POST | Bearer | sincronizacion:exportar | esquemaExportarPaquete |
| Sincronización | `/sincronizaciones/paquete/importar` | POST | Bearer | sincronizacion:importar | esquemaImportarPaquete |
| Sincronización | `/sincronizaciones/publicar` | POST | Bearer | calificaciones:publicar | esquemaPublicarResultados |
| Sincronización | `/sincronizaciones/pull` | POST | Bearer | sincronizacion:pull | esquemaTraerPaquetesServidor |
| Sincronización | `/sincronizaciones/push` | POST | Bearer | sincronizacion:push | esquemaEnviarPaqueteServidor |
| Sistema | `/salud` | GET | Público | — | — |
| Sistema | `/salud/ip-local` | GET | Público | — | — |
| Sistema | `/salud/live` | GET | Público | — | — |
| Sistema | `/salud/metrics` | GET | Público | — | — |
| Sistema | `/salud/qr` | GET | Público | — | — |
| Sistema | `/salud/ready` | GET | Público | — | — |
| Sistema | `/salud/version-info` | GET | Público | — | — |
| Sistema | `/sincronizaciones/local/lease` | GET | Bearer | sincronizacion:listar | — |
| Sistema | `/sincronizaciones/local/lease/adquirir` | POST | Bearer | sincronizacion:importar | esquemaLeaseSincronizacion |
| Sistema | `/version` | GET | Público | — | — |
| Temarios | `/temarios` | GET | Bearer | temarios:leer | — |
| Temarios | `/temarios/{temarioId}` | GET, PUT | Bearer | temarios:leer, temarios:gestionar | esquemaActualizarTemario |
| Temarios | `/temarios/{temarioId}/auditoria` | GET | Bearer | temarios:leer | esquemaListarAuditoriaTemario |
| Temarios | `/temarios/{temarioId}/eliminar` | POST | Bearer | temarios:gestionar | esquemaEliminarTemario |
| Temarios | `/temarios/{temarioId}/nodos` | GET | Bearer | temarios:leer | — |
| Temarios | `/temarios/desde-pdf` | POST | Bearer | temarios:gestionar | esquemaCrearTemarioPdf |
| Temarios | `/temarios/manual` | POST | Bearer | temarios:gestionar | esquemaCrearTemarioManual |
| Temarios | `/temarios/nodos/{nodoId}/estado` | POST | Bearer | temarios:gestionar | esquemaActualizarEstadoNodo |
