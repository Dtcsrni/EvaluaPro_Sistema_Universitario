const PERMISOS_LECTURA = ['periodos:leer', 'temarios:leer', 'banco:leer', 'plantillas:leer', 'examenes:leer'];
const PERMISOS_AUTOCALIFICACION_OMR = ['omr:analizar', 'banco:leer', 'calificaciones:calificar'];

export function resolverPermisosSesion(argumentos = [], { defaultPermissions = true } = {}) {
  const especificados = argumentos.find((arg) => arg.startsWith('--permissions='))?.slice('--permissions='.length);
  const proposito = argumentos.find((arg) => arg.startsWith('--purpose='))?.slice('--purpose='.length);
  if (proposito && proposito !== 'omr-grading') throw new TypeError('purpose debe ser omr-grading.');
  if (especificados && proposito) throw new TypeError('Usa --purpose o --permissions, no ambos.');
  const permisos = especificados
    ? especificados.split(',').map((item) => item.trim()).filter(Boolean)
    : (proposito === 'omr-grading' ? PERMISOS_AUTOCALIFICACION_OMR : (defaultPermissions ? PERMISOS_LECTURA : []));
  return [...new Set(permisos)];
}
