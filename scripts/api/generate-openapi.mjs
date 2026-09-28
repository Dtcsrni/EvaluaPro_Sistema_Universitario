import { readFile, writeFile } from 'node:fs/promises';
import process from 'node:process';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const entryPath = path.join(root, 'apps/backend/src/rutas.ts');
const entry = await readFile(entryPath, 'utf8');
const imports = new Map();
for (const match of entry.matchAll(/import\s+([A-Za-z_$][\w$]*)\s*(?:,\s*\{[^}]*\})?\s+from\s+['"]([^'"]+)['"]/g)) {
  if (match[2].includes('/rutas')) imports.set(match[1], `${match[2].replace(/^\./, 'apps/backend/src').replace(/\.js$/, '.ts')}`);
}

const mounts = [];
let authRequired = false;
for (const line of entry.split(/\r?\n/)) {
  if (line.includes('router.use(requerirDocente)')) authRequired = true;
  const mount = line.match(/router\.use\(['"]([^'"]+)['"],\s*([A-Za-z_$][\w$]*)\)/);
  if (mount && imports.has(mount[2])) mounts.push({ prefix: mount[1], file: imports.get(mount[2]), secured: authRequired });
}
mounts.push({ prefix: '/', file: 'apps/backend/src/rutas.ts', secured: false, inline: true });

const openapiPath = path.join(root, 'scripts/api/openapi.json');
const catalogPath = path.join(root, 'scripts/api/CRUD_CATALOG.md');
const spec = JSON.parse(await readFile(openapiPath, 'utf8'));
const packageJson = JSON.parse(await readFile(path.join(root, 'package.json'), 'utf8'));
spec.info.version = packageJson.version;
spec.components ??= {};
spec.components.schemas ??= {};
spec.components.schemas.CodigoAccesoPublico = {
  type: 'object',
  required: ['id', 'docenteId', 'periodoId', 'expiraEn', 'usado', 'createdAt', 'updatedAt'],
  properties: {
    id: { type: 'string' }, docenteId: { type: 'string' }, periodoId: { type: 'string' },
    expiraEn: { type: 'string', format: 'date-time' }, usado: { type: 'boolean' },
    createdAt: { type: 'string', format: 'date-time' }, updatedAt: { type: 'string', format: 'date-time' }
  },
  additionalProperties: false
};
const responseJson = { description: 'Respuesta JSON definida por el controlador; ver validador y servicio indicados en metadatos.', content: { 'application/json': { schema: { type: 'object', additionalProperties: true } } } };
const responseError = { description: 'Error HTTP con envelope de aplicación, código y mensaje.', content: { 'application/json': { schema: { $ref: '#/components/schemas/ErrorEnvelope' } } } };
const safeId = (method, route) => `${method}_${route}`.replace(/[^A-Za-z0-9]+/g, '_').replace(/^_|_$/g, '');
const toOpenApiPath = (route) => route.replace(/:([A-Za-z0-9_]+)/g, '{$1}');
const queryParametersByValidator = {
  esquemaListarCodigosAcceso: [
    { name: 'periodoId', in: 'query', required: false, schema: { type: 'string' } },
    { name: 'estado', in: 'query', required: false, schema: { type: 'string', enum: ['vigente', 'expirado', 'usado'] } },
    { name: 'limite', in: 'query', required: false, schema: { type: 'integer', minimum: 1, maximum: 100, default: 25 } },
    { name: 'cursor', in: 'query', required: false, schema: { type: 'string', minLength: 1, maxLength: 256, pattern: '^[A-Za-z0-9_-]+$' } }
  ],
  esquemaListarEntregas: [
    { name: 'examenGeneradoId', in: 'query', required: false, schema: { type: 'string' } },
    { name: 'alumnoId', in: 'query', required: false, schema: { type: 'string' } },
    { name: 'periodoId', in: 'query', required: false, schema: { type: 'string' } },
    { name: 'loteId', in: 'query', required: false, schema: { type: 'string', minLength: 1, maxLength: 100 } },
    { name: 'estado', in: 'query', required: false, schema: { type: 'string', enum: ['pendiente', 'entregado'] } },
    { name: 'limite', in: 'query', required: false, schema: { type: 'integer', minimum: 1, maximum: 100, default: 25 } },
    { name: 'cursor', in: 'query', required: false, schema: { type: 'string', minLength: 1, maxLength: 256, pattern: '^[A-Za-z0-9_-]+$' } }
  ],
  esquemaListarExamenesGenerados: [
    { name: 'periodoId', in: 'query', required: false, schema: { type: 'string' } },
    { name: 'alumnoId', in: 'query', required: false, schema: { type: 'string' } },
    { name: 'plantillaId', in: 'query', required: false, schema: { type: 'string' } },
    { name: 'folio', in: 'query', required: false, schema: { type: 'string', minLength: 1, maxLength: 100 } },
    { name: 'archivado', in: 'query', required: false, schema: { type: 'string', enum: ['1', 'true', 'si', 's', '0', 'false', 'no', 'n'], default: 'false' } },
    { name: 'limite', in: 'query', required: false, schema: { type: 'integer', minimum: 1, maximum: 200, default: 100 } },
    { name: 'cursor', in: 'query', required: false, schema: { type: 'string', minLength: 1, maxLength: 256, pattern: '^[A-Za-z0-9_-]+$' } }
  ],
  esquemaListarLotesExamenes: [
    { name: 'plantillaId', in: 'query', required: false, schema: { type: 'string' } },
    { name: 'limite', in: 'query', required: false, schema: { type: 'integer', minimum: 1, maximum: 100, default: 25 } },
    { name: 'cursor', in: 'query', required: false, schema: { type: 'string', minLength: 1, maxLength: 256, pattern: '^[A-Za-z0-9_-]+$' } }
  ],
  esquemaListarJobsOmr: [
    { name: 'generatedAssessmentId', in: 'query', required: false, schema: { type: 'string', minLength: 1, maxLength: 200 } },
    { name: 'status', in: 'query', required: false, schema: { type: 'string', minLength: 1, maxLength: 32 } },
    { name: 'limite', in: 'query', required: false, schema: { type: 'integer', minimum: 1, maximum: 100, default: 50 } },
    { name: 'cursor', in: 'query', required: false, schema: { type: 'string', minLength: 1, maxLength: 256, pattern: '^[A-Za-z0-9_-]+$' } }
  ],
  esquemaListarEvidenciasEvaluacion: [
    { name: 'periodoId', in: 'query', required: false, schema: { type: 'string' } },
    { name: 'alumnoId', in: 'query', required: false, schema: { type: 'string' } },
    { name: 'limite', in: 'query', required: false, schema: { type: 'integer', minimum: 1, maximum: 400, default: 120 } },
    { name: 'cursor', in: 'query', required: false, schema: { type: 'string', minLength: 1, maxLength: 256, pattern: '^[A-Za-z0-9_-]+$' } }
  ]
};

const tagFor = (prefix) => {
  const labels = {
    '/salud': 'Sistema', '/autenticacion': 'Autenticación', '/alumnos': 'Alumnos', '/periodos': 'Periodos',
    '/banco-preguntas': 'Reactivos', '/examenes': 'Exámenes', '/entregas': 'Entregas', '/omr': 'OMR',
    '/calificaciones': 'Calificaciones', '/analiticas': 'Analíticas', '/sincronizaciones': 'Sincronización',
    '/evaluaciones': 'Evaluaciones', '/integraciones/classroom': 'Classroom', '/compliance': 'Cumplimiento',
    '/comercial': 'Comercial', '/admin-negocio': 'Administración comercial', '/recuperacion': 'Recuperación',
    '/asistencias': 'Asistencia', '/temarios': 'Temarios', '/hidratacion-cursos': 'Hidratación',
    '/listas-institucionales': 'Listas institucionales', '/papelera': 'Papelera', '/admin': 'Administración'
  };
  return labels[prefix] ?? 'API';
};

let routeCount = 0;
const missingSources = [];
const registeredOperations = new Set();
for (const mount of mounts) {
  const sourcePath = path.join(root, mount.file);
  let source;
  try { source = await readFile(sourcePath, 'utf8'); } catch { missingSources.push(mount.file); continue; }
  const declarations = [...source.matchAll(/router\.(get|post|put|patch|delete|head|options)\(\s*(['"])([^'"]+)\2/g)];
  for (const declaration of declarations) {
    const method = declaration[1].toLowerCase();
    const relative = declaration[3];
    const fullRoute = mount.prefix === '/' ? relative : `${mount.prefix === '/' ? '' : mount.prefix}${relative === '/' ? '' : relative.startsWith('/') ? relative : `/${relative}`}`;
    const fullPath = toOpenApiPath(fullRoute || '/');
    registeredOperations.add(`${fullPath} ${method}`);
    const item = spec.paths[fullPath] ?? (spec.paths[fullPath] = {});
    const nextRoute = source.indexOf('router.', declaration.index + declaration[0].length);
    const definition = source.slice(declaration.index, nextRoute === -1 ? undefined : nextRoute);
    const secured = mount.secured || /requerirDocente\s*,|requerirPermiso\s*\(/.test(definition);
    const permissions = [...definition.matchAll(/requerirPermiso\(['"]([^'"]+)['"]\)/g)].map((itemMatch) => itemMatch[1]);
    const validators = [...definition.matchAll(/validarCuerpo\((\w+)|validarQueryRobusto\((\w+)/g)].map((itemMatch) => itemMatch[1] ?? itemMatch[2]);
    const uploadFields = [...definition.matchAll(/[A-Za-z_$][\w$]*\.(single|array)\(['"]([^'"]+)['"](?:,\s*(\d+))?/g)];
    const queryParameters = validators.flatMap((validator) => queryParametersByValidator[validator] ?? []);
    const pathParameters = [...fullPath.matchAll(/\{([^}]+)\}/g)].map((match) => ({
      name: match[1], in: 'path', required: true,
      schema: { type: 'string', ...(match[1] === 'reactivoId' && fullPath.startsWith('/banco-preguntas/reactivos/') ? { format: 'uuid' } : {}) }
    }));
    const uploadProperties = Object.fromEntries(uploadFields.map((match) => [match[2], match[1] === 'array'
      ? { type: 'array', items: { type: 'string', format: 'binary' }, maxItems: Number(match[3] || 1) }
      : { type: 'string', format: 'binary' }]));
    const summary = `${method.toUpperCase()} ${fullPath}`;
    const rutaDeclarada = item[method] ?? {};
    for (const parameter of pathParameters) {
      const existing = rutaDeclarada.parameters?.find((itemParameter) => itemParameter.name === parameter.name && itemParameter.in === 'path');
      if (existing && parameter.schema.format) existing.schema = { ...existing.schema, ...parameter.schema };
    }
    rutaDeclarada['x-evaluapro-router'] = mount.file;
    if (permissions.length) rutaDeclarada['x-evaluapro-permissions'] = [...new Set(permissions)];
    else delete rutaDeclarada['x-evaluapro-permissions'];
    if (validators.length) rutaDeclarada['x-evaluapro-validators'] = [...new Set(validators)];
    else delete rutaDeclarada['x-evaluapro-validators'];
    if (uploadFields.length) rutaDeclarada['x-evaluapro-upload-fields'] = uploadFields.map((match) => match[2]);
    else delete rutaDeclarada['x-evaluapro-upload-fields'];
    const necesitaBearer = mount.secured || /requerirDocente\s*,|requerirPermiso\s*\(/.test(definition);
    if (necesitaBearer) rutaDeclarada.security = [{ bearerAuth: [] }];
    else delete rutaDeclarada.security;
    if (fullPath === '/omr/ingestas' && method === 'post') {
      rutaDeclarada.requestBody = {
        required: true,
        content: {
          'multipart/form-data': {
            schema: {
              type: 'object',
              required: ['generatedAssessmentId', 'clientRequestId', 'archivos'],
              properties: {
                generatedAssessmentId: { type: 'string', minLength: 1, maxLength: 200 },
                clientRequestId: { type: 'string', format: 'uuid' },
                archivos: { type: 'array', minItems: 1, maxItems: 10, items: { type: 'string', format: 'binary' } }
              }
            }
          }
        }
      };
    }
    if (fullPath === '/sincronizaciones/codigo-acceso' && method === 'post') {
      rutaDeclarada.requestBody = {
        required: true,
        content: {
          'application/json': {
            schema: {
              type: 'object',
              required: ['periodoId'],
              additionalProperties: false,
              properties: {
                periodoId: {
                  type: 'string',
                  anyOf: [
                    { pattern: '^[0-9a-fA-F]{24}$' },
                    { format: 'uuid' }
                  ]
                },
                clientRequestId: { type: 'string', format: 'uuid' }
              }
            }
          }
        }
      };
      rutaDeclarada.responses = {
        '201': responseJson,
        '400': responseError,
        '401': responseError,
        '403': responseError,
        '404': responseError,
        '409': responseError,
        default: responseError
      };
    }
    if (fullPath === '/examenes/generados' && method === 'post') {
      rutaDeclarada.requestBody = {
        required: true,
        content: {
          'application/json': {
            schema: {
              type: 'object',
              required: ['plantillaId'],
              additionalProperties: false,
              properties: {
                plantillaId: { type: 'string', minLength: 1 },
                clientRequestId: { type: 'string', format: 'uuid', description: 'Clave estable opcional; si se envía, también se usa como ID del examen para recuperar reintentos.' }
              }
            }
          }
        }
      };
      rutaDeclarada.responses = {
        '201': responseJson,
        '400': responseError,
        '401': responseError,
        '403': responseError,
        '409': responseError,
        default: responseError
      };
    }
    if (fullPath === '/examenes/generados' && method === 'post') {
      rutaDeclarada.requestBody = {
        required: true,
        content: {
          'application/json': {
            schema: {
              type: 'object',
              required: ['plantillaId'],
              additionalProperties: false,
              properties: {
                plantillaId: { type: 'string', minLength: 1 },
                clientRequestId: { type: 'string', format: 'uuid', description: 'Clave estable opcional; también se usa como ID del examen para recuperar reintentos.' }
              }
            }
          }
        }
      };
      rutaDeclarada.responses = {
        '201': responseJson,
        '400': responseError,
        '401': responseError,
        '403': responseError,
        '409': responseError,
        default: responseError
      };
    }
    if (fullPath === '/examenes/generados' && method === 'get') {
      rutaDeclarada.responses = {
        ...(rutaDeclarada.responses ?? {}),
        '200': {
          description: 'Página de exámenes generados del docente con cursor estable.',
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['examenes', 'nextCursor'],
                properties: {
                  examenes: { type: 'array', items: { type: 'object', additionalProperties: true } },
                  nextCursor: { type: ['string', 'null'] }
                },
                additionalProperties: false
              }
            }
          }
        }
      };
    }
    if (fullPath === '/examenes/generados/lotes' && method === 'get') {
      rutaDeclarada.responses = {
        ...(rutaDeclarada.responses ?? {}),
        '200': {
          description: 'Página de paquetes de examen consolidados del docente.',
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['lotes', 'nextCursor'],
                properties: {
                  lotes: {
                    type: 'array',
                    items: {
                      type: 'object',
                      required: ['loteId', 'plantillaId', 'sha256', 'totalPaginas', 'totalExamenes', 'pdfUrl', 'progresoUrl'],
                      properties: {
                        loteId: { type: 'string' }, plantillaId: { type: 'string' }, sha256: { type: 'string', pattern: '^[a-f0-9]{64}$' },
                        totalPaginas: { type: 'integer' }, totalExamenes: { type: 'integer' }, pdfUrl: { type: 'string' }, progresoUrl: { type: 'string' },
                        createdAt: { type: 'string', format: 'date-time' }, updatedAt: { type: 'string', format: 'date-time' }
                      },
                      additionalProperties: false
                    }
                  },
                  nextCursor: { type: ['string', 'null'] }
                },
                additionalProperties: false
              }
            }
          }
        }
      };
    }
    if (fullPath === '/omr/jobs' && method === 'get') {
      rutaDeclarada.responses = {
        ...(rutaDeclarada.responses ?? {}),
        '200': {
          description: 'Página de jobs OMR del docente, con filtros por evaluación/estado y cursor estable.',
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['jobs', 'nextCursor'],
                properties: {
                  jobs: { type: 'array', items: { type: 'object', additionalProperties: true } },
                  nextCursor: { type: ['string', 'null'], maxLength: 256, pattern: '^[A-Za-z0-9_-]+$' }
                },
                additionalProperties: false
              }
            }
          }
        }
      };
    }
    if (fullPath === '/entregas' && method === 'get') {
      rutaDeclarada.responses = {
        ...(rutaDeclarada.responses ?? {}),
        '200': {
          description: 'Página de entregas del docente, con filtros y cursor estable.',
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['entregas', 'nextCursor'],
                properties: {
                  entregas: { type: 'array', items: { type: 'object', additionalProperties: true } },
                  nextCursor: { type: ['string', 'null'], maxLength: 256, pattern: '^[A-Za-z0-9_-]+$' }
                },
                additionalProperties: false
              }
            }
          }
        }
      };
    }
    if (fullPath === '/entregas/{entregaId}' && method === 'get') {
      rutaDeclarada.responses = {
        ...(rutaDeclarada.responses ?? {}),
        '200': {
          description: 'Entrega del docente con resumen seguro de alumno y examen asociado.',
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['entrega'],
                properties: { entrega: { type: 'object', additionalProperties: true } },
                additionalProperties: false
              }
            }
          }
        }
      };
    }
    if (fullPath === '/sincronizaciones/codigo-acceso' && method === 'get') {
      rutaDeclarada.responses = {
        ...(rutaDeclarada.responses ?? {}),
        '200': {
          description: 'Página de códigos de acceso propios; los secretos nunca se incluyen.',
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['codigosAcceso', 'nextCursor'],
                properties: {
                  codigosAcceso: { type: 'array', items: { $ref: '#/components/schemas/CodigoAccesoPublico' } },
                  nextCursor: { type: ['string', 'null'], maxLength: 256, pattern: '^[A-Za-z0-9_-]+$' }
                },
                additionalProperties: false
              }
            }
          }
        }
      };
    }
    if (fullPath === '/sincronizaciones/codigo-acceso/{codigoAccesoId}' && method === 'get') {
      rutaDeclarada.responses = {
        ...(rutaDeclarada.responses ?? {}),
        '200': {
          description: 'Metadatos del código de acceso propio; el secreto no se devuelve.',
          content: { 'application/json': { schema: { type: 'object', required: ['codigoAcceso'], properties: { codigoAcceso: { $ref: '#/components/schemas/CodigoAccesoPublico' } }, additionalProperties: false } } }
        }
      };
    }
    if (fullPath === '/sincronizaciones/codigo-acceso/{codigoAccesoId}/expirar' && method === 'post') {
      rutaDeclarada.responses = {
        ...(rutaDeclarada.responses ?? {}),
        '200': {
          description: 'Expiración idempotente; la transición y su evento de auditoría se escriben juntas.',
          content: { 'application/json': { schema: { type: 'object', required: ['actualizado', 'estado', 'expiraEn'], properties: { actualizado: { type: 'boolean' }, estado: { type: 'string', enum: ['expirado', 'usado'] }, expiraEn: { type: 'string', format: 'date-time' } }, additionalProperties: false } } }
        }
      };
    }
    if (fullPath === '/evaluaciones/evidencias' && method === 'get') {
      rutaDeclarada.responses = {
        ...(rutaDeclarada.responses ?? {}),
        '200': {
          description: 'Página de evidencias de evaluación del docente autenticado.',
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['evidencias', 'nextCursor'],
                properties: {
                  evidencias: { type: 'array', items: { type: 'object', additionalProperties: true } },
                  nextCursor: { type: ['string', 'null'] }
                },
                additionalProperties: false
              }
            }
          }
        }
      };
    }
    if (queryParameters.length) {
      const existingParameters = rutaDeclarada.parameters ?? pathParameters;
      const existingKeys = new Set(existingParameters.map(({ name, in: location }) => `${location}:${name}`));
      rutaDeclarada.parameters = [...existingParameters, ...queryParameters.filter(({ name, in: location }) => !existingKeys.has(`${location}:${name}`))];
    }
    if (item[method]) {
      item[method] = rutaDeclarada;
      routeCount += 1;
      continue;
    }
    const operation = {
      tags: [tagFor(mount.prefix)],
      operationId: safeId(method, fullPath),
      summary,
      description: 'Operación registrada en el router backend. El schema de entrada estricto, si aplica, se identifica en x-evaluapro-validators; las reglas de negocio y estados los define el controlador/servicio canónico.',
      ...(secured ? { security: [{ bearerAuth: [] }] } : {}),
      ...(pathParameters.length || queryParameters.length ? { parameters: [...pathParameters, ...queryParameters] } : {}),
      ...(['post', 'put', 'patch', 'delete'].includes(method) ? {
        requestBody: {
          required: false,
          content: {
            'application/json': { schema: { type: 'object', additionalProperties: true } },
            ...(uploadFields.length ? { 'multipart/form-data': { schema: { type: 'object', properties: uploadProperties } } } : {})
          }
        }
      } : {}),
      responses: {
        '200': responseJson,
        ...(secured ? { '401': responseError, '403': responseError } : {}),
        default: responseError
      },
      'x-evaluapro-router': mount.file,
      ...(permissions.length ? { 'x-evaluapro-permissions': [...new Set(permissions)] } : {}),
      ...(validators.length ? { 'x-evaluapro-validators': [...new Set(validators)] } : {}),
      ...(uploadFields.length ? { 'x-evaluapro-upload-fields': uploadFields.map((match) => match[2]) } : {})
    };
    if (fullPath === '/omr/ingestas' && method === 'post') {
      operation.requestBody = {
        required: true,
        content: {
          'multipart/form-data': {
            schema: {
              type: 'object',
              required: ['generatedAssessmentId', 'clientRequestId', 'archivos'],
              properties: {
                generatedAssessmentId: { type: 'string', minLength: 1, maxLength: 200 },
                clientRequestId: { type: 'string', format: 'uuid' },
                archivos: { type: 'array', minItems: 1, maxItems: 10, items: { type: 'string', format: 'binary' } }
              }
            }
          }
        }
      };
    }
    item[method] = operation;
    routeCount += 1;
  }
}

if (missingSources.length) throw new Error(`No se encontraron routers montados: ${[...new Set(missingSources)].join(', ')}`);
const methodLabels = { get: 'GET', post: 'POST', put: 'PUT', patch: 'PATCH', delete: 'DELETE', head: 'HEAD', options: 'OPTIONS' };
const pendingOperations = [];
for (const [route, pathItem] of Object.entries(spec.paths)) {
  for (const [method, operation] of Object.entries(pathItem)) {
    if (!methodLabels[method] || !operation['x-evaluapro-router']) continue;
    if (registeredOperations.has(`${route} ${method}`)) {
      delete operation['x-evaluapro-status'];
      delete operation['x-evaluapro-available'];
      delete operation.deprecated;
      continue;
    }
    operation['x-evaluapro-status'] = 'pending-router';
    operation['x-evaluapro-available'] = false;
    operation.deprecated = true;
    pendingOperations.push({ route, method });
  }
}
const document = `${JSON.stringify(spec, null, 2)}\n`;
const catalogRows = [];
for (const [route, pathItem] of Object.entries(spec.paths)) {
  const operations = Object.entries(pathItem).filter(([method]) => methodLabels[method]);
  if (!operations.length) continue;
  const operation = operations[0][1];
  const permissions = [...new Set(operations.flatMap(([, value]) => value['x-evaluapro-permissions'] ?? []))];
  const validators = [...new Set(operations.flatMap(([, value]) => value['x-evaluapro-validators'] ?? []))];
  const hasPending = operations.some(([, value]) => value['x-evaluapro-status'] === 'pending-router');
  catalogRows.push({
    tag: operation.tags?.[0] ?? 'API',
    route,
    methods: operations.map(([method]) => methodLabels[method]).join(', '),
    auth: operations.some(([, value]) => value.security?.some((security) => security.bearerAuth)) ? 'Bearer' : 'Público',
    permissions: permissions.join(', ') || '—',
    validators: validators.join(', ') || '—',
    status: hasPending ? 'Parcial; revisar operaciones' : 'Disponible'
  });
}
catalogRows.sort((a, b) => a.tag.localeCompare(b.tag, 'es') || a.route.localeCompare(b.route, 'es'));
const catalog = [
  '# Catálogo de rutas y operaciones API',
  '',
  `Generado desde los routers backend. ${routeCount} declaraciones montadas y ${pendingOperations.length} operaciones OpenAPI pendientes de router; las operaciones CRUD/acciones aparecen marcadas cuando aún no se pueden invocar. No usar operaciones con estado \`pending-router\`.`,
  '',
  'Los permisos y validadores se leen de los middlewares y llamadas `validarCuerpo` de cada router. Los schemas detallados de flujos críticos están en [`openapi.json`](./openapi.json); un validador `esquema...` apunta a la definición Zod del backend cuando el contrato amplio todavía no exporta campos en JSON Schema.',
  '',
  '| Módulo | Ruta | Métodos | Estado | Sesión | Permisos | Validador de cuerpo |',
  '| --- | --- | --- | --- | --- | --- | --- |',
  ...catalogRows.map((row) => `| ${row.tag} | \`${row.route}\` | ${row.methods} | ${row.status} | ${row.auth} | ${row.permissions} | ${row.validators} |`),
  ''
].join('\n');
if (process.argv.includes('--write')) {
  await writeFile(openapiPath, document, 'utf8');
  await writeFile(catalogPath, catalog, 'utf8');
  console.log(`OpenAPI actualizado: ${routeCount} declaraciones montadas; ${pendingOperations.length} operaciones pendientes de router.`);
} else {
  const current = await readFile(openapiPath, 'utf8');
  const currentCatalog = await readFile(catalogPath, 'utf8').catch(() => '');
  if (current !== document || currentCatalog !== catalog) {
    console.error('openapi.json o CRUD_CATALOG.md están desactualizados respecto a routers y permisos. Ejecuta npm run api:openapi:write y revisa el diff.');
    process.exitCode = 1;
  } else {
    console.log(`OpenAPI sincronizado: ${routeCount} declaraciones montadas; ${pendingOperations.length} operaciones pendientes de router.`);
  }
}
