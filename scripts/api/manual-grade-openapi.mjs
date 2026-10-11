import { esquemaIdAcademicoOpenApi } from './openapi-primitives.mjs';

const objectIdSchema = esquemaIdAcademicoOpenApi;

const commonProperties = {
  periodoId: objectIdSchema,
  alumnoId: objectIdSchema,
  version: { type: 'integer', minimum: 1, description: 'Versión esperada para control de concurrencia.' },
  clientRequestId: { type: 'string', format: 'uuid', description: 'UUID estable para recuperar reintentos idempotentes.' }
};

const required = ['periodoId', 'alumnoId', 'componente', 'calificacion', 'clientRequestId'];

function variant(componente, calificacion) {
  return {
    type: 'object',
    required,
    properties: {
      ...commonProperties,
      componente: { type: 'string', const: componente },
      calificacion
    },
    additionalProperties: false
  };
}

export const contratoCalificacionListaRequestBody = {
  required: true,
  content: {
    'application/json': {
      schema: {
        oneOf: [
          variant('Practica 2do Parcial', { type: 'number', minimum: 0, maximum: 10 }),
          variant('Exámen 2do Parcial', { type: 'number', minimum: 0, maximum: 5.25 }),
          variant('Exámen Global', { type: 'number', minimum: 0, maximum: 5 }),
          variant('Bono extracurricular', { type: 'number', minimum: 0, maximum: 1 }),
          variant('Solicitud Extra', { type: 'number', enum: [0, 1] })
        ],
        description: 'La nota respeta el límite de su componente. Enviar version cuando se actualiza un registro existente.'
      }
    }
  }
};

export const contratoCalificacionListaResponse = {
  schema: {
    type: 'object',
    required: ['calificacion'],
    properties: {
      calificacion: {
        type: 'object',
        required: ['id', 'docenteId', 'periodoId', 'alumnoId', 'componente', 'calificacion', 'version', 'auditoria', 'capturadoPor', 'createdAt', 'updatedAt'],
        properties: {
          id: { type: 'string' },
          docenteId: { type: 'string' },
          periodoId: objectIdSchema,
          alumnoId: objectIdSchema,
          componente: { type: 'string', enum: ['Practica 2do Parcial', 'Exámen 2do Parcial', 'Exámen Global', 'Bono extracurricular', 'Solicitud Extra'] },
          calificacion: { type: 'number', minimum: 0, maximum: 10 },
          version: { type: 'integer', minimum: 1 },
          auditoria: { type: 'string' },
          capturadoPor: { type: 'string' },
          createdAt: { type: 'string', format: 'date-time' },
          updatedAt: { type: 'string', format: 'date-time' }
        },
        additionalProperties: false
      },
      repetida: { type: 'boolean', const: true, description: 'Indica que clientRequestId recuperó una escritura previa.' }
    },
    additionalProperties: false
  }
};

export const contratoPreviewBonoRequestBody = {
  required: true,
  content: {
    'application/json': {
      schema: {
        type: 'object',
        required: ['periodoId', 'alumnoId', 'bono'],
        properties: {
          periodoId: objectIdSchema,
          alumnoId: objectIdSchema,
          bono: { type: 'number', minimum: 0, maximum: 1 }
        },
        additionalProperties: false
      }
    }
  }
};

const componentesDistribucion = {
  type: 'object',
  required: ['examenGlobal', 'continuaGlobal', 'examenParcial2', 'continuaParcial2', 'examenParcial1', 'continuaParcial1'],
  properties: Object.fromEntries(['examenGlobal', 'continuaGlobal', 'examenParcial2', 'continuaParcial2', 'examenParcial1', 'continuaParcial1']
    .map((nombre) => [nombre, { type: 'number', minimum: 0 }])),
  additionalProperties: false
};

export const contratoPreviewBonoResponse = {
  description: 'Distribución calculada sin escritura; requiere confirmación explícita para guardar.',
  content: {
    'application/json': {
      schema: {
        type: 'object',
        required: ['preview'],
        properties: {
          preview: {
            type: 'object',
            required: ['alumnoId', 'bonoSolicitado', 'bonoAplicado', 'bonoDistribucion', 'parcial1', 'parcial2', 'parcial3', 'calificacionFinalCurso', 'escalaMaxima', 'regla', 'requiereConfirmacion'],
            properties: {
              alumnoId: objectIdSchema,
              bonoSolicitado: { type: 'string', pattern: '^\\d+(?:\\.\\d+)?$' },
              bonoAplicado: { type: 'string', pattern: '^\\d+(?:\\.\\d+)?$' },
              bonoDistribucion: componentesDistribucion,
              parcial1: { type: 'string', pattern: '^(?:\\d+(?:\\.\\d+)?|)$' },
              parcial2: { type: 'string', pattern: '^(?:\\d+(?:\\.\\d+)?|)$' },
              parcial3: { type: 'string', pattern: '^(?:\\d+(?:\\.\\d+)?|)$' },
              calificacionFinalCurso: { type: 'string', pattern: '^(?:\\d+(?:\\.\\d+)?|)$' },
              escalaMaxima: { type: 'integer', const: 10 },
              regla: { type: 'string', const: 'continua-primero; global-c3, p2, p1' },
              requiereConfirmacion: { type: 'boolean', const: true }
            },
            additionalProperties: false
          }
        },
        additionalProperties: false
      }
    }
  }
};

export function aplicarContratoCalificacionLista(spec) {
  const operacion = spec.paths?.['/analiticas/lista-academica/calificaciones']?.post;
  if (!operacion) throw new Error('No existe POST /analiticas/lista-academica/calificaciones en OpenAPI.');
  operacion.summary = 'Registrar calificación manual en la lista académica';
  operacion.description = 'Crea o actualiza una calificación por alumno y componente. Usa version para evitar sobrescribir cambios concurrentes y conserva el mismo clientRequestId al reintentar una solicitud incierta.';
  operacion.requestBody = structuredClone(contratoCalificacionListaRequestBody);
  operacion.responses = {
    ...operacion.responses,
    '200': {
      description: 'Calificación actualizada o resultado idempotente recuperado.',
      content: { 'application/json': structuredClone(contratoCalificacionListaResponse) }
    },
    '201': {
      description: 'Calificación creada.',
      content: { 'application/json': structuredClone(contratoCalificacionListaResponse) }
    },
    '400': { $ref: '#/components/responses/Error' },
    '404': { $ref: '#/components/responses/Error' },
    '409': { $ref: '#/components/responses/Error' }
  };
}

export function aplicarContratoPreviewBono(spec) {
  const operacion = spec.paths?.['/analiticas/lista-academica/bono/preview']?.post;
  if (!operacion) throw new Error('No existe POST /analiticas/lista-academica/bono/preview en OpenAPI.');
  operacion.summary = 'Previsualizar distribución del bono extracurricular';
  operacion.description = 'Calcula el reparto por alumno sin modificar calificaciones. Devuelve la distribución y los parciales resultantes conforme a la prioridad configurada.';
  operacion.requestBody = structuredClone(contratoPreviewBonoRequestBody);
  operacion.responses = { ...operacion.responses, '200': structuredClone(contratoPreviewBonoResponse) };
}

const asignacionBonoLista = {
  type: 'object',
  required: ['examenGlobal', 'continuaGlobal', 'examenParcial2', 'continuaParcial2', 'examenParcial1', 'continuaParcial1'],
  properties: Object.fromEntries(['examenGlobal', 'continuaGlobal', 'examenParcial2', 'continuaParcial2', 'examenParcial1', 'continuaParcial1']
    .map((nombre) => [nombre, { type: 'number', minimum: 0 }])),
  additionalProperties: false
};

const columnasStringLista = [
  'matricula', 'apellidoPaterno', 'apellidoMaterno', 'nombre', 'grupo', 'parcial1',
  'examenPrimerParcialLista', 'continuaPrimerParcialLista', 'parcial2', 'tareasYEjercicios2doParcial',
  'practica2doParcial', 'evaluacionContinua2doParcial', 'examen2doParcial', 'examen2doParcialAutomatico',
  'calificacionSegundoParcial', 'examenGlobalComponente', 'examenGlobalLista', 'continuaTercerParcialLista',
  'calificacionTercerParcial', 'bonoExtracurricular', 'bonoExtracurricularSolicitado',
  'calificacionFinalCurso', 'calificacionFinalCursoActa', 'global', 'final', 'observaciones', 'conformidadAlumno'
];

const filaListaAcademica = {
  type: 'object',
  required: [
    ...columnasStringLista,
    'examenGlobalListaVersion', 'bonoExtracurricularVersion', 'extraDisponible', 'solicitaExtra',
    'solicitudExtraVersion', 'resultadosExtraordinarios', 'practica2doParcialVersion', 'examen2doParcialVersion'
  ],
  properties: {
    alumnoId: objectIdSchema,
    ...Object.fromEntries(columnasStringLista.map((nombre) => [nombre, { type: 'string' }])),
    examenGlobalListaVersion: { anyOf: [{ type: 'integer', minimum: 1 }, { type: 'null' }] },
    bonoExtracurricularVersion: { anyOf: [{ type: 'integer', minimum: 1 }, { type: 'null' }] },
    bonoDistribucion: asignacionBonoLista,
    extraDisponible: { type: 'boolean' },
    solicitaExtra: { type: 'boolean' },
    solicitudExtraVersion: { anyOf: [{ type: 'integer', minimum: 1 }, { type: 'null' }] },
    resultadosExtraordinarios: {
      type: 'array',
      items: {
        type: 'object',
        required: ['claseRegistro', 'folio', 'calificacionSobre5', 'calificacionSobre10', 'estadoAprobatorio', 'origen'],
        properties: {
          claseRegistro: { type: 'string', enum: ['interno', 'externo'] },
          examenGeneradoId: { type: 'string' },
          loteId: { anyOf: [{ type: 'string' }, { type: 'null' }] },
          folio: { type: 'string' },
          calificacionSobre5: { type: 'string' },
          calificacionSobre10: { type: 'string' },
          estadoAprobatorio: { type: 'string', enum: ['Aprobatoria', 'No aprobatoria'] },
          origen: { type: 'string' },
          fuenteArchivo: { type: 'string' },
          documentoSha256: { type: 'string', pattern: '^[a-fA-F0-9]{64}$' }
        },
        additionalProperties: false
      }
    },
    practica2doParcialVersion: { anyOf: [{ type: 'integer', minimum: 1 }, { type: 'null' }] },
    examen2doParcialVersion: { anyOf: [{ type: 'integer', minimum: 1 }, { type: 'null' }] }
  },
  additionalProperties: false
};

export const contratoConsultaListaResponse = {
  description: 'Calificaciones y lista por alumno, con versiones de concurrencia, distribución del bono y proyección final.',
  content: {
    'application/json': {
      schema: {
        type: 'object',
        required: ['filas'],
        properties: { filas: { type: 'array', items: filaListaAcademica } },
        additionalProperties: false
      }
    }
  }
};

export function aplicarContratoConsultaLista(spec) {
  const operacion = spec.paths?.['/analiticas/lista-academica']?.get;
  if (!operacion) throw new Error('No existe GET /analiticas/lista-academica en OpenAPI.');
  const parametroPeriodo = spec.components?.parameters?.PeriodoId;
  if (!parametroPeriodo) throw new Error('No existe el parámetro OpenAPI PeriodoId.');
  operacion.parameters = [
    ...(operacion.parameters ?? []).filter((parameter) =>
      parameter.$ref !== '#/components/parameters/PeriodoId' && !(parameter.in === 'query' && parameter.name === 'periodoId')),
    { ...structuredClone(parametroPeriodo), required: true }
  ];
  operacion.summary = 'Consultar calificaciones y lista académica';
  operacion.description = 'Devuelve los componentes capturados, calificaciones por parcial, versiones, distribución del bono y proyección final por alumno.';
  operacion.responses = { ...operacion.responses, '200': structuredClone(contratoConsultaListaResponse) };
}
