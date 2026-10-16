import { esquemaIdAcademicoOpenApi } from './openapi-primitives.mjs';

const strictObject = (required, properties) => ({
  type: 'object',
  ...(required.length ? { required } : {}),
  properties,
  additionalProperties: false
});

const body = (schema) => ({
  required: true,
  content: { 'application/json': { schema } }
});

const esquemaActividad = strictObject(
  ['courseId', 'courseWorkId'],
  {
    courseId: { type: 'string', minLength: 1, maxLength: 128 },
    courseWorkId: {
      type: 'string', minLength: 1, maxLength: 128,
      description: 'No se puede repetir junto con el mismo courseId dentro de la solicitud.'
    },
    tituloEvidencia: { type: 'string', minLength: 1, maxLength: 180 },
    descripcionEvidencia: { type: 'string', maxLength: 600 },
    ponderacion: { type: 'number', minimum: 0, maximum: 100 },
    corte: { type: 'integer', minimum: 1, maximum: 3, description: 'Parcial al que se asigna la actividad.' },
    destinoColumna: {
      type: ['string', 'null'],
      enum: ['Tareas y Ejercicios 2do Parcial', 'Practica 2do Parcial', 'Excluir', null]
    },
    activo: { type: 'boolean' },
    incluirEnPromedio: { type: 'boolean' },
    faltantesConfirmados: { type: 'array', maxItems: 500, items: { type: 'string', minLength: 1, maxLength: 128 } }
  }
);

export const contratoImportacionClassroomRequestBody = body(strictObject(
  ['periodoId', 'actividades'],
  {
    periodoId: esquemaIdAcademicoOpenApi,
    actividades: { type: 'array', minItems: 1, maxItems: 100, items: esquemaActividad },
    limiteSubmissions: { type: 'integer', minimum: 1, maximum: 500 }
  }
));

const contratoImportacionClassroomJobRequestBody = body(strictObject(
  ['clientRequestId', 'planHash', 'periodoId', 'actividades'],
  {
    clientRequestId: { type: 'string', format: 'uuid', description: 'Clave estable para repetir con seguridad la misma petición.' },
    planHash: { type: 'string', pattern: '^[a-f0-9]{64}$', description: 'Huella SHA-256 del preview que aprobó el docente; se revalida antes de escribir.' },
    periodoId: esquemaIdAcademicoOpenApi,
    actividades: { type: 'array', minItems: 1, maxItems: 100, items: esquemaActividad },
    limiteSubmissions: { type: 'integer', minimum: 1, maximum: 500 }
  }
));

export const contratoMapeoAlumnosClassroomRequestBody = body(strictObject(
  ['periodoId', 'asignaciones'],
  {
    periodoId: esquemaIdAcademicoOpenApi,
    asignaciones: {
      type: 'array',
      maxItems: 500,
      items: strictObject(['classroomUserId'], {
        classroomUserId: {
          type: 'string', minLength: 1, maxLength: 128,
          description: 'Identidad única dentro de alumnos en esta solicitud.'
        },
        alumnoId: { anyOf: [esquemaIdAcademicoOpenApi, { type: 'null' }] }
      })
    }
  }
));

export const contratoImportarAlumnosClassroomRequestBody = body(strictObject(
  ['periodoId', 'alumnos'],
  {
    periodoId: esquemaIdAcademicoOpenApi,
    alumnos: {
      type: 'array', minItems: 1, maxItems: 500,
      items: strictObject(['classroomUserId'], {
        classroomUserId: {
          type: 'string', minLength: 1, maxLength: 128,
          description: 'Identidad única dentro de alumnos en esta solicitud.'
        },
        matricula: { type: ['string', 'null'], maxLength: 64 }
      })
    }
  }
));

const enteroContador = { type: 'integer', minimum: 0 };
const numeroNoNegativo = { type: 'number', minimum: 0 };
const resumenAlumno = strictObject(
  ['alumnoId', 'alumnoNombre', 'puntosObtenidos', 'puntosPosibles', 'actividadesCalificadas', 'actividadesFaltantesConfirmadas'],
  {
    alumnoId: esquemaIdAcademicoOpenApi,
    alumnoNombre: { type: 'string' },
    puntosObtenidos: numeroNoNegativo,
    puntosPosibles: numeroNoNegativo,
    promedioSobre10: numeroNoNegativo,
    continuaSobre5: numeroNoNegativo,
    promedio: numeroNoNegativo,
    actividadesCalificadas: enteroContador,
    actividadesFaltantesConfirmadas: enteroContador
  }
);

export const esquemaResultadoSyncClassroom = strictObject(
  ['tipo', 'periodoId', 'totalActividades', 'submissionsProcesadas', 'matched', 'unmatched', 'pending', 'graded', 'wouldCreate', 'wouldUpdate', 'importadas', 'actualizadas', 'omitidas', 'actividades', 'promediosEvaluacionContinuaTercerParcial', 'acumuladoTareasSegundoParcial', 'errores'],
  {
    tipo: { type: 'string', enum: ['preview', 'ejecucion'] },
    periodoId: esquemaIdAcademicoOpenApi,
    totalActividades: enteroContador,
    submissionsProcesadas: enteroContador,
    matched: enteroContador,
    unmatched: enteroContador,
    pending: enteroContador,
    graded: enteroContador,
    wouldCreate: enteroContador,
    wouldUpdate: enteroContador,
    importadas: enteroContador,
    actualizadas: enteroContador,
    omitidas: enteroContador,
    actividades: {
      type: 'array',
      items: strictObject(
        ['courseId', 'courseWorkId', 'submissionsProcesadas', 'matched', 'unmatched', 'pending', 'graded', 'wouldCreate', 'wouldUpdate', 'importadas', 'actualizadas', 'omitidas', 'submissions', 'errors'],
        {
          courseId: { type: 'string' },
          courseName: { type: 'string' },
          courseWorkId: { type: 'string' },
          courseWorkTitle: { type: 'string' },
          tituloEvidencia: { type: 'string' },
          corte: { type: 'integer', minimum: 1, maximum: 3 },
          destinoColumna: { type: ['string', 'null'], enum: ['Tareas y Ejercicios 2do Parcial', 'Practica 2do Parcial', 'Excluir', null] },
          submissionsProcesadas: enteroContador,
          matched: enteroContador,
          unmatched: enteroContador,
          pending: enteroContador,
          graded: enteroContador,
          wouldCreate: enteroContador,
          wouldUpdate: enteroContador,
          importadas: enteroContador,
          actualizadas: enteroContador,
          omitidas: enteroContador,
          submissions: {
            type: 'array',
            items: strictObject(
              ['submissionId', 'classroomUserId', 'matchStrategy', 'estadoCaptura', 'graded', 'pending', 'wouldCreate', 'wouldUpdate', 'vencida', 'puedeConfirmarFaltante', 'faltanteExplicito'],
              {
                submissionId: { type: 'string' },
                classroomUserId: { type: 'string' },
                studentName: { type: 'string' },
                studentEmail: { type: 'string' },
                alumnoId: { anyOf: [esquemaIdAcademicoOpenApi, { type: 'null' }] },
                alumnoNombre: { anyOf: [{ type: 'string' }, { type: 'null' }] },
                matchStrategy: { type: 'string', enum: ['manual', 'email', 'matricula', 'none'] },
                estadoCaptura: { type: 'string', enum: ['pendiente', 'calificada'] },
                graded: { type: 'boolean' },
                pending: { type: 'boolean' },
                wouldCreate: { type: 'boolean' },
                wouldUpdate: { type: 'boolean' },
                calificacionDecimal: { type: 'number' },
                puntosObtenidos: { type: 'number' },
                puntosPosibles: { type: 'number', minimum: 0 },
                vencida: { type: 'boolean' },
                puedeConfirmarFaltante: { type: 'boolean' },
                faltanteExplicito: { type: 'boolean' },
                estadoClassroom: { type: 'string' },
                fechaVencimiento: { type: 'string', format: 'date-time' }
              }
            )
          },
          errors: { type: 'array', items: strictObject(['mensaje'], { mensaje: { type: 'string' } }) }
        }
      )
    },
    promediosEvaluacionContinuaTercerParcial: { type: 'array', items: resumenAlumno },
    acumuladoTareasSegundoParcial: { type: 'array', items: resumenAlumno },
    errores: {
      type: 'array',
      items: strictObject(['courseId', 'courseWorkId', 'mensaje'], {
        courseId: { type: 'string' }, courseWorkId: { type: 'string' }, mensaje: { type: 'string' }
      })
    }
  }
);

export const respuestaSyncClassroom = {
  description: 'Resumen de actividades, entregas, vínculos, notas proyectadas y errores de sincronización.',
  content: { 'application/json': { schema: { $ref: '#/components/schemas/ClassroomGradeSyncResult' } } }
};

export const respuestaHistorialSyncClassroom = {
  description: 'Hasta 20 vistas previas e importaciones de la materia seleccionada, ordenadas por fecha descendente.',
  content: {
    'application/json': {
      schema: strictObject(['historial'], {
        historial: {
          type: 'array',
          maxItems: 20,
          items: strictObject(['_id', 'tipo', 'periodoId', 'courseIds', 'courseWorkIds', 'resumen', 'errores', 'ejecutadoEn'], {
            _id: { type: 'string' },
            tipo: { type: 'string', enum: ['preview', 'ejecucion'] },
            periodoId: esquemaIdAcademicoOpenApi,
            courseIds: { type: 'array', items: { type: 'string' } },
            courseWorkIds: { type: 'array', items: { type: 'string' } },
            resumen: strictObject([], Object.fromEntries([
              'totalActividades', 'submissionsProcesadas', 'matched', 'unmatched', 'pending', 'graded',
              'wouldCreate', 'wouldUpdate', 'importadas', 'actualizadas', 'omitidas'
            ].map((campo) => [campo, enteroContador]))),
            errores: { type: 'array', items: strictObject(['mensaje'], { mensaje: { type: 'string' } }) },
            ejecutadoEn: { type: ['string', 'null'], format: 'date-time' }
          })
        }
      })
    }
  }
};

export const respuestaInicioOauthClassroom = {
  description: 'URL de autorización OAuth y estado de conexión actual.',
  content: {
    'application/json': {
      schema: strictObject(['url', 'conectado', 'correoGoogle'], {
        url: { type: 'string', format: 'uri' },
        conectado: { type: 'boolean' },
        correoGoogle: { type: ['string', 'null'] }
      })
    }
  }
};

export const respuestaMapeosClassroom = {
  description: 'Vínculos heredados de actividades Classroom; este endpoint está marcado como deprecado.',
  content: {
    'application/json': {
      schema: strictObject(['conectado', 'correoGoogle', 'mapeos', 'deprecado'], {
        conectado: { type: 'boolean' },
        correoGoogle: { type: ['string', 'null'] },
        mapeos: { type: 'array', items: { type: 'object', additionalProperties: true } },
        deprecado: { type: 'boolean', const: true }
      })
    }
  }
};

const esquemaEvidenciaEvaluacion = strictObject(
  [
    'id', 'docenteId', 'periodoId', 'alumnoId', 'titulo', 'descripcion', 'calificacionDecimal', 'ponderacion',
    'fechaEvidencia', 'corte', 'fuente', 'estadoCaptura', 'classroomData', 'classroom', 'metadata', 'archivadaEn',
    'archivadaPorDocenteId', 'motivoArchivo', 'auditoriaCambios', 'createdAt', 'updatedAt'
  ],
  {
    id: { type: 'string' },
    docenteId: { type: 'string' },
    periodoId: { type: 'string', pattern: '^[0-9a-fA-F]{24}$' },
    alumnoId: { type: 'string', pattern: '^[0-9a-fA-F]{24}$' },
    titulo: { type: 'string' },
    descripcion: { type: ['string', 'null'] },
    calificacionDecimal: { type: ['number', 'null'] },
    ponderacion: { type: 'number' },
    fechaEvidencia: { type: 'string', format: 'date-time' },
    corte: { type: ['integer', 'null'], minimum: 1, maximum: 3 },
    fuente: { type: 'string', enum: ['manual', 'classroom'] },
    estadoCaptura: { type: 'string', enum: ['pendiente', 'calificada'] },
    classroomData: { type: ['object', 'null'], additionalProperties: true },
    classroom: { type: ['object', 'null'], additionalProperties: true },
    metadata: { type: ['object', 'null'], additionalProperties: true },
    archivadaEn: { type: ['string', 'null'], format: 'date-time' },
    archivadaPorDocenteId: { type: ['string', 'null'] },
    motivoArchivo: { type: ['string', 'null'] },
    auditoriaCambios: { type: 'array', items: { type: 'object', additionalProperties: true } },
    createdAt: { type: 'string', format: 'date-time' },
    updatedAt: { type: 'string', format: 'date-time' }
  }
);

export const respuestaEvidenciasEvaluacion = {
  description: 'Página de evidencias de evaluación del docente autenticado.',
  content: {
    'application/json': {
      schema: strictObject(['evidencias', 'nextCursor'], {
        evidencias: { type: 'array', items: structuredClone(esquemaEvidenciaEvaluacion) },
        nextCursor: { type: ['string', 'null'] }
      })
    }
  }
};

const esquemaAlumnoLocalClassroom = strictObject(['_id', 'nombreCompleto'], {
  _id: { type: 'string' },
  nombreCompleto: { type: 'string' },
  matricula: { type: 'string' },
  correo: { type: 'string', format: 'email' }
});

const esquemaFilaRosterClassroom = strictObject(
  ['classroomUserId', 'alumnoIdConfirmado', 'alumnoConfirmado', 'alumnoIdSugerido', 'alumnoSugerido', 'matchStrategy'],
  {
    classroomUserId: { type: 'string' },
    fullName: { type: 'string' },
    emailAddress: { type: 'string', format: 'email' },
    alumnoIdConfirmado: { type: ['string', 'null'] },
    alumnoConfirmado: { anyOf: [structuredClone(esquemaAlumnoLocalClassroom), { type: 'null' }] },
    alumnoIdSugerido: { type: ['string', 'null'] },
    alumnoSugerido: { anyOf: [structuredClone(esquemaAlumnoLocalClassroom), { type: 'null' }] },
    matchStrategy: { type: 'string', enum: ['manual', 'email', 'matricula', 'none'] }
  }
);

const esquemaRosterClassroom = strictObject(['courseId', 'alumnosLocales', 'alumnosClassroom'], {
  courseId: { type: 'string' },
  alumnosLocales: { type: 'array', items: structuredClone(esquemaAlumnoLocalClassroom) },
  alumnosClassroom: { type: 'array', items: structuredClone(esquemaFilaRosterClassroom) }
});

export const respuestasCatalogoClassroom = {
  estado: {
    description: 'Estado del vínculo Classroom y última sincronización del docente.',
    content: { 'application/json': { schema: strictObject(['estado'], {
      estado: strictObject(['conectado', 'correoGoogle', 'googleUserId', 'ultimaSincronizacionEn', 'ultimoError'], {
        conectado: { type: 'boolean' },
        correoGoogle: { type: ['string', 'null'], format: 'email' },
        googleUserId: { type: ['string', 'null'] },
        ultimaSincronizacionEn: { type: ['string', 'null'], format: 'date-time' },
        ultimoError: { type: ['string', 'null'] }
      })
    }) } }
  },
  cursos: {
    description: 'Cursos activos visibles para la integración del docente.',
    content: { 'application/json': { schema: strictObject(['cursos'], {
      cursos: { type: 'array', items: strictObject(['id', 'name', 'courseState'], {
        id: { type: 'string' },
        name: { type: 'string' },
        section: { type: 'string' },
        descriptionHeading: { type: 'string' },
        updateTime: { type: 'string', format: 'date-time' },
        courseState: { type: 'string' }
      }) }
    }) } }
  },
  actividades: {
    description: 'Actividades disponibles del curso y su asignación local por periodo.',
    content: { 'application/json': { schema: strictObject(['actividades'], {
      actividades: { type: 'array', items: strictObject(['id', 'title'], {
        id: { type: 'string' },
        title: { type: 'string' },
        description: { type: 'string' },
        maxPoints: { type: 'number' },
        state: { type: 'string' },
        updateTime: { type: 'string', format: 'date-time' },
        alternateLink: { type: 'string', format: 'uri' },
        mapeo: { anyOf: [strictObject([], {
          tituloEvidencia: { type: 'string' },
          descripcionEvidencia: { type: 'string' },
          ponderacion: { type: 'number' },
          corte: { type: 'integer', minimum: 1, maximum: 3 },
          destinoColumna: { type: 'string', enum: ['Tareas y Ejercicios 2do Parcial', 'Practica 2do Parcial', 'Excluir'] },
          activo: { type: 'boolean' }
        }), { type: 'null' }] }
      }) }
    }) } }
  },
  roster: {
    description: 'Roster de Classroom, lista local y coincidencias confirmadas o sugeridas.',
    content: { 'application/json': { schema: structuredClone(esquemaRosterClassroom) } }
  },
  importarAlumnos: {
    description: 'Conteos de alumnos importados y roster resultante tras conservar vínculos anteriores.',
    content: { 'application/json': { schema: strictObject(['creados', 'actualizados', 'conservados', 'totalProcesados', 'roster'], {
      creados: { type: 'integer', minimum: 0 },
      actualizados: { type: 'integer', minimum: 0 },
      conservados: { type: 'integer', minimum: 0 },
      totalProcesados: { type: 'integer', minimum: 0 },
      roster: structuredClone(esquemaRosterClassroom)
    }) } }
  }
};

function obtenerOperacion(spec, ruta, metodo) {
  const operation = spec.paths?.[ruta]?.[metodo];
  if (!operation) throw new Error(`No existe ${metodo.toUpperCase()} ${ruta} en OpenAPI.`);
  return operation;
}

function aplicarContratoHistorialClassroom(spec) {
  const historial = spec.paths?.['/evaluaciones/v2/classroom/importaciones/historial']?.get;
  if (!historial) throw new Error('No existe GET /evaluaciones/v2/classroom/importaciones/historial en OpenAPI.');
  historial.parameters = [
    ...(historial.parameters ?? []).filter((parameter) => parameter.name !== 'periodoId'),
    { name: 'periodoId', in: 'query', required: true, schema: structuredClone(esquemaIdAcademicoOpenApi) }
  ];
  historial.responses = { ...historial.responses, '200': structuredClone(respuestaHistorialSyncClassroom) };
}

function aplicarContratoHistorialEntregaClassroom(spec) {
  const ruta = '/evaluaciones/v2/classroom/alumnos/{alumnoId}/entregas/{submissionId}/historial';
  spec.paths ??= {};
  spec.paths[ruta] ??= {};
  spec.paths[ruta].get = {
    operationId: 'get_evaluaciones_v2_classroom_alumnos_alumnoId_entregas_submissionId_historial',
    summary: 'Consultar el historial de una entrega de Classroom',
    description: 'Devuelve versiones ligeras observadas para una entrega, incluidas reentregas pendientes de autorización. El alcance se limita al docente autenticado y a un alumno del periodo indicado.',
    tags: ['Classroom'],
    security: [{ bearerAuth: [] }],
    parameters: [
      { name: 'alumnoId', in: 'path', required: true, schema: structuredClone(esquemaIdAcademicoOpenApi) },
      { name: 'submissionId', in: 'path', required: true, schema: { type: 'string', minLength: 1, maxLength: 128 } },
      { name: 'periodoId', in: 'query', required: true, schema: structuredClone(esquemaIdAcademicoOpenApi) },
      { name: 'courseId', in: 'query', required: true, schema: { type: 'string', minLength: 1, maxLength: 128 } },
      { name: 'courseWorkId', in: 'query', required: true, schema: { type: 'string', minLength: 1, maxLength: 128 } },
      { name: 'limite', in: 'query', required: false, schema: { type: 'integer', minimum: 1, maximum: 100, default: 20 } },
      { name: 'cursor', in: 'query', required: false, schema: { type: 'string', maxLength: 36, pattern: '^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-8][0-9a-fA-F]{3}-[89aAbB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}$' } }
    ],
    responses: {
      '200': { description: 'Historial paginado de la entrega.', content: { 'application/json': { schema: strictObject(['eventos', 'nextCursor'], {
        eventos: { type: 'array', items: strictObject(['id', 'corte', 'puntosObtenidos', 'puntosPosibles', 'calificacionSobre10', 'estado', 'estadoClassroom', 'importacionId', 'observadoEn', 'capturadoPor'], {
          id: { type: 'string' }, corte: { type: ['integer', 'null'] }, puntosObtenidos: { type: ['number', 'null'] },
          puntosPosibles: { type: ['number', 'null'] }, calificacionSobre10: { type: ['number', 'null'] },
          estado: { type: 'string', enum: ['pendiente', 'calificada', 'revision_pendiente', 'faltante_confirmado'] },
          estadoClassroom: { type: ['string', 'null'] }, importacionId: { type: 'string' },
          observadoEn: { type: 'string', format: 'date-time' }, capturadoPor: { type: 'string' }
        }) }, nextCursor: { type: ['string', 'null'] }
      }) } } },
      '400': { $ref: '#/components/responses/Error' }, '401': { $ref: '#/components/responses/Error' },
      '403': { $ref: '#/components/responses/Error' }, '404': { $ref: '#/components/responses/Error' }
    }
  };
}

function aplicarContratoConsultaEvidenciasEvaluacion(spec) {
  const operacion = obtenerOperacion(spec, '/evaluaciones/evidencias', 'get');
  const filtros = [
    ['periodoId', { type: 'string', pattern: '^[0-9a-fA-F]{24}$' }],
    ['alumnoId', { type: 'string', pattern: '^[0-9a-fA-F]{24}$' }],
    ['incluirArchivadas', { type: 'string', enum: ['true', 'false'] }],
    ['limite', { type: 'integer', minimum: 1, maximum: 400, default: 120 }],
    ['cursor', { type: 'string', minLength: 1, maxLength: 256, pattern: '^[A-Za-z0-9_-]+$' }]
  ];
  operacion.parameters = [
    ...(operacion.parameters ?? []).filter(({ name }) => !filtros.some(([filtro]) => filtro === name)),
    ...filtros.map(([name, schema]) => ({ name, in: 'query', required: false, schema }))
  ];
  operacion.responses = { ...operacion.responses, '200': structuredClone(respuestaEvidenciasEvaluacion) };
}

function aplicarContratosOauthClassroom(spec) {
  const oauthStart = spec.paths?.['/evaluaciones/v2/classroom/oauth/iniciar']?.get;
  if (!oauthStart) throw new Error('No existe GET /evaluaciones/v2/classroom/oauth/iniciar en OpenAPI.');
  oauthStart.summary = 'Iniciar conexión con Google Classroom';
  oauthStart.responses = { ...oauthStart.responses, '200': structuredClone(respuestaInicioOauthClassroom) };

  const oauthDisconnect = spec.paths?.['/evaluaciones/v2/classroom/oauth/desconectar']?.post;
  if (!oauthDisconnect) throw new Error('No existe POST /evaluaciones/v2/classroom/oauth/desconectar en OpenAPI.');
  oauthDisconnect.summary = 'Desconectar Google Classroom';
  delete oauthDisconnect.responses['200'];
  oauthDisconnect.responses = {
    ...oauthDisconnect.responses,
    '204': { description: 'Integración desconectada correctamente; no contiene cuerpo.' }
  };

  const mapeos = spec.paths?.['/evaluaciones/v2/classroom/mapeos']?.get;
  if (!mapeos) throw new Error('No existe GET /evaluaciones/v2/classroom/mapeos en OpenAPI.');
  mapeos.parameters = [
    ...(mapeos.parameters ?? []).filter((parameter) => parameter.name !== 'periodoId'),
    { name: 'periodoId', in: 'query', required: false, schema: structuredClone(esquemaIdAcademicoOpenApi) }
  ];
  mapeos.responses = { ...mapeos.responses, '200': structuredClone(respuestaMapeosClassroom) };
}

function aplicarContratosCatalogoClassroom(spec) {
  const operaciones = [
    ['/evaluaciones/v2/classroom/estado', 'get', respuestasCatalogoClassroom.estado],
    ['/evaluaciones/v2/classroom/cursos', 'get', respuestasCatalogoClassroom.cursos],
    ['/evaluaciones/v2/classroom/cursos/{courseId}/actividades', 'get', respuestasCatalogoClassroom.actividades],
    ['/evaluaciones/v2/classroom/cursos/{courseId}/alumnos', 'get', respuestasCatalogoClassroom.roster],
    ['/evaluaciones/v2/classroom/cursos/{courseId}/mapeo-alumnos', 'put', respuestasCatalogoClassroom.roster],
    ['/evaluaciones/v2/classroom/cursos/{courseId}/importar-alumnos', 'post', respuestasCatalogoClassroom.importarAlumnos]
  ];
  for (const [route, method, response] of operaciones) {
    const operation = obtenerOperacion(spec, route, method);
    operation.responses = { ...operation.responses, '200': structuredClone(response) };
  }

  const actividad = obtenerOperacion(spec, '/evaluaciones/v2/classroom/cursos/{courseId}/actividades', 'get');
  const roster = obtenerOperacion(spec, '/evaluaciones/v2/classroom/cursos/{courseId}/alumnos', 'get');
  actividad.parameters = [
    ...(actividad.parameters ?? []).filter(({ name, in: ubicacion }) => !(name === 'periodoId' && ubicacion === 'query')),
    { name: 'periodoId', in: 'query', required: false, schema: { type: 'string', pattern: '^[0-9a-fA-F]{24}$' } }
  ];
  roster.parameters = [
    ...(roster.parameters ?? []).filter(({ name, in: ubicacion }) => !(name === 'periodoId' && ubicacion === 'query')),
    { name: 'periodoId', in: 'query', required: true, schema: { type: 'string', pattern: '^[0-9a-fA-F]{24}$' } }
  ];
  obtenerOperacion(spec, '/evaluaciones/v2/classroom/cursos/{courseId}/mapeo-alumnos', 'put').responses = {
    ...obtenerOperacion(spec, '/evaluaciones/v2/classroom/cursos/{courseId}/mapeo-alumnos', 'put').responses,
    '409': { $ref: '#/components/responses/Error' }
  };
}

function aplicarContratosImportacionClassroom(spec) {
  const contracts = [
    ['/evaluaciones/v2/classroom/importaciones/jobs', 'post', contratoImportacionClassroomJobRequestBody,
      'Iniciar o recuperar importación Classroom', 'Crea una operación durable local. El mismo clientRequestId con el mismo contenido devuelve el job existente; con contenido distinto responde 409. No publica notas en Classroom.'],
    ['/evaluaciones/v2/classroom/importaciones/preview', 'post', contratoImportacionClassroomRequestBody,
      'Previsualizar importación de actividades Classroom', 'Calcula la vista previa sin guardar calificaciones. Cada actividad puede asignarse al parcial 1, 2 o 3. Rechaza pares curso/actividad repetidos antes de consultar Classroom.'],
    ['/evaluaciones/v2/classroom/importaciones/ejecutar', 'post', contratoImportacionClassroomRequestBody,
      'Confirmar importación de actividades Classroom', 'Guarda la importación confirmada y conserva la asignación de parcial de cada actividad. Rechaza pares curso/actividad repetidos antes de consultar Classroom o escribir evidencias.'],
    ['/evaluaciones/v2/classroom/cursos/{courseId}/mapeo-alumnos', 'put', contratoMapeoAlumnosClassroomRequestBody,
      'Guardar vínculo de alumnos Classroom', 'Reemplaza el conjunto de vínculos del curso: las identidades omitidas quedan sin vincular. Cada identidad Classroom y cada alumno local solo pueden aparecer una vez.'],
    ['/evaluaciones/v2/classroom/cursos/{courseId}/importar-alumnos', 'post', contratoImportarAlumnosClassroomRequestBody,
      'Importar alumnos desde Classroom', 'Incorpora identidades del roster actual al periodo docente. Deriva nombre y correo desde Classroom, conserva los vínculos de alumnos que no forman parte de la selección y rechaza identidades ajenas al curso o repetidas antes de escribir. Solo admite matrícula opcional y requiere gestión de alumnos.']
  ];
  for (const [route, method, requestBody, summary, description] of contracts) {
    const operation = obtenerOperacion(spec, route, method);
    operation.requestBody = structuredClone(requestBody);
    operation.summary = summary;
    operation.description = description;
    if (route.endsWith('/importaciones/preview') || route.endsWith('/importaciones/ejecutar')) {
      operation.responses = { ...operation.responses, '200': structuredClone(respuestaSyncClassroom) };
    }
    if (route.endsWith('/importaciones/jobs')) {
      operation.responses = {
        ...operation.responses,
        '202': { description: 'Importación en cola o en ejecución', content: { 'application/json': { schema: { $ref: '#/components/schemas/ClassroomImportJob' } } } },
        '200': { description: 'Job existente ya completado', content: { 'application/json': { schema: { $ref: '#/components/schemas/ClassroomImportJob' } } } },
        '409': { $ref: '#/components/responses/Error' }
      };
    }
    if (route.endsWith('/mapeo-alumnos')) {
      operation.responses = { ...operation.responses, '409': { $ref: '#/components/responses/Error' } };
    }
  }
  const consultaJob = obtenerOperacion(spec, '/evaluaciones/v2/classroom/importaciones/jobs/{jobId}', 'get');
  consultaJob.summary = 'Consultar job de importación Classroom';
  consultaJob.description = 'Devuelve estado y resultado seguro del job solo al docente propietario. Las lecturas pueden repetirse; no reinician la importación.';
  consultaJob.responses = {
    ...consultaJob.responses,
    '200': { description: 'Estado actual del job', content: { 'application/json': { schema: { $ref: '#/components/schemas/ClassroomImportJob' } } } },
    '404': { $ref: '#/components/responses/Error' }
  };
}

export function aplicarContratosClassroomGrades(spec) {
  spec.components ??= {};
  spec.components.schemas ??= {};
  for (const [ruta, pathItem] of Object.entries(spec.paths ?? {})) {
    if (!ruta.startsWith('/evaluaciones/v2/classroom/')) continue;
    for (const operation of Object.values(pathItem)) {
      if (operation && typeof operation === 'object' && 'operationId' in operation) operation.tags = ['Classroom'];
    }
  }
  spec.components.schemas.ClassroomGradeSyncResult = structuredClone(esquemaResultadoSyncClassroom);
  spec.components.schemas.EvidenciaEvaluacion = structuredClone(esquemaEvidenciaEvaluacion);
  spec.components.schemas.ClassroomRoster = structuredClone(esquemaRosterClassroom);
  spec.components.schemas.ClassroomImportJob = {
    type: 'object',
    required: ['jobId', 'estado', 'progreso', 'total', 'reutilizado'],
    properties: {
      jobId: { type: 'string', format: 'uuid' },
      estado: { type: 'string', enum: ['queued', 'running', 'succeeded', 'partial', 'failed'] },
      progreso: { type: 'integer', minimum: 0 },
      total: { type: 'integer', minimum: 1 },
      reutilizado: { type: 'boolean' },
      error: { type: ['string', 'null'] },
      resultado: { type: ['object', 'null'] }
    }
  };
  aplicarContratoConsultaEvidenciasEvaluacion(spec);
  aplicarContratoHistorialClassroom(spec);
  aplicarContratoHistorialEntregaClassroom(spec);
  aplicarContratosOauthClassroom(spec);
  aplicarContratosCatalogoClassroom(spec);
  aplicarContratosImportacionClassroom(spec);
}
