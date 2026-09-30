import { readFile } from 'node:fs/promises';
import process from 'node:process';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const spec = JSON.parse(await readFile(path.join(root, 'scripts/api/openapi.json'), 'utf8'));
const errors = [];
const methods = new Set(['get', 'post', 'put', 'patch', 'delete', 'head', 'options']);
if (spec.openapi !== '3.1.0') errors.push('OpenAPI debe declarar 3.1.0');
if (Object.keys(spec.paths ?? {}).length < 150) errors.push('El catálogo no incluye el conjunto completo de routers API');

let operations = 0;
const operationIds = new Set();
for (const [route, item] of Object.entries(spec.paths ?? {})) {
  for (const [method, operation] of Object.entries(item)) {
    if (!methods.has(method)) continue;
    operations += 1;
    if (!operation.operationId) errors.push(`${method.toUpperCase()} ${route}: falta operationId`);
    else if (operationIds.has(operation.operationId)) errors.push(`operationId duplicado: ${operation.operationId}`);
    else operationIds.add(operation.operationId);
    if (!operation.responses || !Object.keys(operation.responses).length) errors.push(`${method.toUpperCase()} ${route}: faltan respuestas`);
    if (operation['x-evaluapro-router'] && !operation.summary) errors.push(`${method.toUpperCase()} ${route}: ruta generada sin resumen`);
    const operationParameterKeys = new Set();
    for (const parameter of operation.parameters ?? []) {
      const resolved = parameter.$ref?.split('/').at(-1);
      const definition = resolved ? spec.components?.parameters?.[resolved] : parameter;
      if (!definition?.name || !definition?.in) continue;
      const key = `${definition.in}:${definition.name}`;
      if (operationParameterKeys.has(key)) errors.push(`${method.toUpperCase()} ${route}: parámetro duplicado ${key}`);
      operationParameterKeys.add(key);
    }
    for (const match of route.matchAll(/\{([^}]+)\}/g)) {
      const parameters = [...(operation.parameters ?? []), ...(item.parameters ?? [])];
      const declared = parameters.some((parameter) => {
        if (parameter.name === match[1]) return true;
        const ref = parameter.$ref?.split('/').at(-1);
        return ref && spec.components?.parameters?.[ref]?.name === match[1];
      });
      if (!declared) errors.push(`${method.toUpperCase()} ${route}: falta parámetro ${match[1]}`);
    }
  }
}

for (const [route, method, operationId] of [
  ['/banco-preguntas/importaciones/preview', 'post', 'previewReactiveImport'],
  ['/banco-preguntas/importaciones/{importId}/confirmar', 'post', 'confirmReactiveImport'],
  ['/examenes/generados/lote', 'post', 'generateExamBatch'],
  ['/omr/jobs/{jobId}', 'get', 'getOmrJob'],
  ['/omr/jobs/{jobId}/exceptions/{sheetSerial}/resolve', 'post', 'resolveOmrSheet'],
  ['/calificaciones/calificar', 'post', 'gradeExam'],
  ['/analiticas/lista-academica', 'get', 'getAcademicList']
]) {
  if (spec.paths?.[route]?.[method]?.operationId !== operationId) errors.push(`Falta operación crítica ${method.toUpperCase()} ${route}`);
}
const omrPagePreview = spec.paths?.['/omr/ingestas/{jobId}/paginas/{pageIndex}/preview']?.get;
if (omrPagePreview?.responses?.['200']?.content?.['image/png']?.schema?.format !== 'binary'
  || !omrPagePreview?.security?.some((security) => security.bearerAuth)
  || !omrPagePreview?.['x-evaluapro-permissions']?.includes('omr:analizar')) {
  errors.push('GET /omr/ingestas/{jobId}/paginas/{pageIndex}/preview: debe declarar PNG binario y autenticación omr:analizar');
}
const omrReferencePreview = spec.paths?.['/omr/ingestas/{jobId}/paginas/{pageIndex}/reference-preview']?.get;
const omrReferencePreviewQuery = new Map((omrReferencePreview?.parameters ?? []).filter((parameter) => parameter.in === 'query').map((parameter) => [parameter.name, parameter]));
if (omrReferencePreview?.responses?.['200']?.content?.['image/png']?.schema?.format !== 'binary'
  || !omrReferencePreview?.security?.some((security) => security.bearerAuth)
  || !omrReferencePreview?.['x-evaluapro-permissions']?.includes('omr:analizar')
  || omrReferencePreviewQuery.get('generatedAssessmentId')?.required !== false
  || omrReferencePreviewQuery.get('examPage')?.required !== false
  || omrReferencePreviewQuery.size !== 2) {
  errors.push('GET /omr/ingestas/{jobId}/paginas/{pageIndex}/reference-preview: debe declarar PNG binario, seguridad OMR y destino opcional de examen/página sin parámetros duplicados');
}

const reactivosList = spec.paths?.['/banco-preguntas/reactivos']?.get;
const reactivosQueryNames = new Set((reactivosList?.parameters ?? []).filter((parameter) => parameter.in === 'query').map((parameter) => parameter.name));
for (const name of ['periodoId', 'temaId', 'estado', 'limite', 'cursor']) {
  if (!reactivosQueryNames.has(name)) errors.push(`GET /banco-preguntas/reactivos: falta filtro ${name}`);
}
if (!reactivosList?.security?.some((security) => security.bearerAuth) || !reactivosList?.['x-evaluapro-permissions']?.includes('banco:leer')) {
  errors.push('GET /banco-preguntas/reactivos: requiere bearer y permiso banco:leer');
}
const reactivosListSchema = reactivosList?.responses?.['200']?.content?.['application/json']?.schema;
if (reactivosListSchema?.properties?.reactivos?.items?.$ref !== '#/components/schemas/ReactivoCanonico'
  || !Object.hasOwn(reactivosListSchema?.properties ?? {}, 'nextCursor')) {
  errors.push('GET /banco-preguntas/reactivos: respuesta debe declarar ReactivoCanonico y nextCursor');
}
const reactivoDetail = spec.paths?.['/banco-preguntas/reactivos/{reactivoId}']?.get;
const reactivoIdParameter = reactivoDetail?.parameters?.find((parameter) => parameter.name === 'reactivoId' && parameter.in === 'path');
if (reactivoIdParameter?.schema?.format !== 'uuid') errors.push('GET /banco-preguntas/reactivos/{reactivoId}: reactivoId debe ser UUID');
if (!reactivoDetail?.security?.some((security) => security.bearerAuth) || !reactivoDetail?.['x-evaluapro-permissions']?.includes('banco:leer')) {
  errors.push('GET /banco-preguntas/reactivos/{reactivoId}: requiere bearer y permiso banco:leer');
}
const reactivoDetailSchema = reactivoDetail?.responses?.['200']?.content?.['application/json']?.schema;
if (reactivoDetailSchema?.properties?.reactivo?.allOf?.[0]?.$ref !== '#/components/schemas/ReactivoCanonico'
  || !spec.components?.schemas?.ReactivoVersionActual) {
  errors.push('GET /banco-preguntas/reactivos/{reactivoId}: respuesta debe declarar reactivo y su versión actual');
}
const omrReviewSchema = spec.components?.schemas?.OmrReviewResponse;
if (!omrReviewSchema?.required?.includes('opcionDetectada')
  || !omrReviewSchema?.properties?.estadoRespuesta?.enum?.includes('doble_marca')
  || omrReviewSchema?.properties?.candidatas?.maxItems !== 3
  || omrReviewSchema?.properties?.candidatas?.items?.$ref !== '#/components/schemas/OmrReviewCandidate') {
  errors.push('OMR: respuesta de revisión debe exponer estado, detección original y hasta tres candidatas tipadas');
}
for (const [route, method] of [
  ['/omr/jobs/{jobId}', 'get'],
  ['/omr/ingestas/{jobId}', 'get']
]) {
  const schema = spec.paths?.[route]?.[method]?.responses?.['200']?.content?.['application/json']?.schema;
  if (schema?.properties?.job?.properties?.pages?.items?.properties?.responses?.items?.$ref !== '#/components/schemas/OmrReviewResponse') {
    errors.push(`${method.toUpperCase()} ${route}: debe exponer evidencia de revisión OMR tipada`);
  }
}
const examenesGeneradosList = spec.paths?.['/examenes/generados']?.get;
const examenesGeneradosQueryNames = new Set((examenesGeneradosList?.parameters ?? []).filter((parameter) => parameter.in === 'query').map((parameter) => parameter.name));
for (const name of ['periodoId', 'alumnoId', 'plantillaId', 'folio', 'archivado', 'limite', 'cursor']) {
  if (!examenesGeneradosQueryNames.has(name)) errors.push(`GET /examenes/generados: falta filtro ${name}`);
}
if (examenesGeneradosList?.parameters?.find((parameter) => parameter.name === 'limite')?.schema?.maximum !== 200) {
  errors.push('GET /examenes/generados: el límite debe estar acotado a 200');
}
const examenesGeneradosResponse = examenesGeneradosList?.responses?.['200']?.content?.['application/json']?.schema;
if (examenesGeneradosResponse?.properties?.examenes?.type !== 'array'
  || !examenesGeneradosResponse?.required?.includes('nextCursor')
  || !examenesGeneradosResponse?.properties?.nextCursor?.type?.includes('null')) {
  errors.push('GET /examenes/generados: respuesta debe declarar página y nextCursor nullable');
}
const lotesExamenesList = spec.paths?.['/examenes/generados/lotes']?.get;
const lotesExamenesQueryNames = new Set((lotesExamenesList?.parameters ?? []).filter((parameter) => parameter.in === 'query').map((parameter) => parameter.name));
for (const name of ['plantillaId', 'limite', 'cursor']) {
  if (!lotesExamenesQueryNames.has(name)) errors.push(`GET /examenes/generados/lotes: falta filtro ${name}`);
}
const lotesExamenesResponse = lotesExamenesList?.responses?.['200']?.content?.['application/json']?.schema;
if (!lotesExamenesList?.security?.some((security) => security.bearerAuth)
  || !lotesExamenesList?.['x-evaluapro-permissions']?.includes('examenes:leer')
  || lotesExamenesResponse?.properties?.lotes?.type !== 'array'
  || !lotesExamenesResponse?.required?.includes('nextCursor')) {
  errors.push('GET /examenes/generados/lotes: debe paginar paquetes del docente con permiso examenes:leer');
}
const evidenciasList = spec.paths?.['/evaluaciones/evidencias']?.get;
const evidenciasQueryNames = new Set((evidenciasList?.parameters ?? []).filter((parameter) => parameter.in === 'query').map((parameter) => parameter.name));
for (const name of ['periodoId', 'alumnoId', 'limite', 'cursor']) {
  if (!evidenciasQueryNames.has(name)) errors.push(`GET /evaluaciones/evidencias: falta filtro ${name}`);
}
const evidenciasResponse = evidenciasList?.responses?.['200']?.content?.['application/json']?.schema;
if (!evidenciasList?.security?.some((security) => security.bearerAuth)
  || !evidenciasList?.['x-evaluapro-permissions']?.includes('evaluaciones:leer')
  || evidenciasResponse?.properties?.evidencias?.type !== 'array'
  || !evidenciasResponse?.required?.includes('nextCursor')) {
  errors.push('GET /evaluaciones/evidencias: debe paginar la lectura del docente con permiso evaluaciones:leer');
}
const generarExamenIndividual = spec.paths?.['/examenes/generados']?.post;
const generarExamenIndividualBody = generarExamenIndividual?.requestBody?.content?.['application/json']?.schema;
if (!generarExamenIndividual?.requestBody?.required
  || !generarExamenIndividualBody?.required?.includes('plantillaId')
  || generarExamenIndividualBody?.properties?.clientRequestId?.format !== 'uuid'
  || !generarExamenIndividual?.responses?.['201']
  || !generarExamenIndividual?.responses?.['409']) {
  errors.push('POST /examenes/generados: contrato debe documentar plantilla, clave UUID opcional y conflicto de idempotencia');
}
const generarCodigoAcceso = spec.paths?.['/sincronizaciones/codigo-acceso']?.post;
const generarCodigoAccesoBody = generarCodigoAcceso?.requestBody?.content?.['application/json']?.schema;
if (!generarCodigoAcceso?.requestBody?.required
  || !generarCodigoAccesoBody?.required?.includes('periodoId')
  || generarCodigoAccesoBody?.properties?.clientRequestId?.format !== 'uuid'
  || !generarCodigoAcceso?.responses?.['201']) {
  errors.push('POST /sincronizaciones/codigo-acceso: contrato debe exigir periodo y documentar idempotencia UUID/201');
}
if (operations < 200) errors.push(`Cobertura insuficiente: ${operations} operaciones API`);
if (errors.length) {
  console.error(errors.map((error) => `- ${error}`).join('\n'));
  process.exitCode = 1;
} else {
  console.log(`OpenAPI ${spec.openapi}: ${Object.keys(spec.paths).length} rutas, ${operations} operaciones; IDs y parámetros consistentes.`);
}
