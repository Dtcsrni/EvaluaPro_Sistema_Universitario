const respuestasArchivo = {
  xlsx: {
    description: 'Archivo XLSX de calificaciones del periodo seleccionado.',
    content: {
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': {
        schema: { type: 'string', format: 'binary' }
      }
    }
  },
  csv: {
    description: 'Archivo CSV de calificaciones del periodo seleccionado.',
    content: {
      'text/csv': {
        schema: { type: 'string' }
      }
    }
  }
};

export function aplicarContratoExportacionCalificaciones(spec) {
  const parametroPeriodo = spec.components?.parameters?.PeriodoId;
  if (!parametroPeriodo) throw new Error('No existe el parámetro OpenAPI PeriodoId.');

  for (const [formato, ruta] of [
    ['csv', '/analiticas/calificaciones-csv'],
    ['xlsx', '/analiticas/calificaciones-xlsx']
  ]) {
    const operacion = spec.paths?.[ruta]?.get;
    if (!operacion) throw new Error(`No existe GET ${ruta} en OpenAPI.`);
    operacion.summary = `Descargar calificaciones en ${formato.toUpperCase()}`;
    operacion.description = 'Descarga el reporte del periodo y respeta el permiso analiticas:leer.';
    operacion.parameters = [
      ...(operacion.parameters ?? []).filter((parameter) =>
        parameter.$ref !== '#/components/parameters/PeriodoId' && !(parameter.in === 'query' && parameter.name === 'periodoId')),
      { ...structuredClone(parametroPeriodo), required: true }
    ];
    operacion.responses = {
      ...operacion.responses,
      '200': structuredClone(respuestasArchivo[formato])
    };
  }
}

export const contratosExportacionCalificaciones = respuestasArchivo;
