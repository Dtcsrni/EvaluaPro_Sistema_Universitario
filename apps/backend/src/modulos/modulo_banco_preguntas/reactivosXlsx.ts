import ExcelJS from 'exceljs';
import { ErrorAplicacion } from '../../compartido/errores/errorAplicacion.js';
import { validarReactivosBatch, type ReactivosBatch } from './reactivosContrato.js';

const HEADERS_LOTE = ['campo', 'valor'] as const;
const HEADERS_REACTIVOS_LEGACY = [
  'externalKey', 'itemId', 'expectedVersion', 'enunciado',
  'opcionA', 'opcionB', 'opcionC', 'opcionD', 'opcionE',
  'respuestaCorrecta', 'difficultyHypothesis', 'cognitiveLevel',
  'competenciesJson', 'tagsJson', 'notes', 'confidence'
] as const;
const HEADERS_REACTIVOS = [
  'externalKey', 'itemId', 'expectedVersion', 'temaId', 'enunciado',
  'opcionA', 'opcionB', 'opcionC', 'opcionD', 'opcionE',
  'respuestaCorrecta', 'difficultyHypothesis', 'cognitiveLevel',
  'competenciesJson', 'tagsJson', 'notes', 'confidence'
] as const;
const CAMPOS_LOTE = [
  'contract', 'schemaVersion', 'batchId', 'periodoId', 'temaIds',
  'generator', 'generatorModel', 'generatedAt', 'sourceDocumentSha256'
] as const;

function errorXlsx(codigo: string, mensaje: string): never {
  throw new ErrorAplicacion(codigo, mensaje, 400);
}

function textoCelda(value: ExcelJS.CellValue | undefined, campo: string, opcional = false): string {
  if (value === null || value === undefined || value === '') {
    if (opcional) return '';
    return errorXlsx('REACTIVOS_XLSX_CAMPO_REQUERIDO', `Falta el valor ${campo}`);
  }
  if (typeof value !== 'string') return errorXlsx('REACTIVOS_XLSX_TIPO_INVALIDO', `${campo} debe ser texto y no fórmula`);
  return value.trim();
}

function celdasFila(sheet: ExcelJS.Worksheet, rowNumber: number): ExcelJS.Cell[] {
  const row = sheet.getRow(rowNumber);
  return Array.from({ length: Math.max(row.cellCount, sheet.columnCount) }, (_, index) => row.getCell(index + 1));
}

function filaVacia(cells: ExcelJS.Cell[]): boolean {
  return cells.every((cell) => cell.value === null || cell.value === undefined || cell.value === '');
}

function validarEncabezados(sheet: ExcelJS.Worksheet, expected: readonly string[], legacy?: readonly string[]): Map<string, number> {
  if (sheet.state !== 'visible') return errorXlsx('REACTIVOS_XLSX_HOJA_OCULTA', `La hoja ${sheet.name} debe estar visible`);
  const allowedColumnCounts = [expected.length, ...(legacy ? [legacy.length] : [])];
  if (sheet.rowCount < 1 || !allowedColumnCounts.includes(sheet.columnCount)) return errorXlsx('REACTIVOS_XLSX_ENCABEZADOS_INVALIDOS', `La hoja ${sheet.name} debe contener exactamente ${expected.length} columnas`);
  const actual = celdasFila(sheet, 1).map((cell) => textoCelda(cell.value, `${sheet.name}!fila 1`));
  const coincide = (headers: readonly string[]) => actual.length === headers.length && actual.every((header, index) => header === headers[index]);
  if (new Set(actual).size !== actual.length || (!coincide(expected) && (!legacy || !coincide(legacy)))) {
    return errorXlsx('REACTIVOS_XLSX_ENCABEZADOS_INVALIDOS', `La hoja ${sheet.name} requiere encabezados exactos: ${expected.join(', ')}`);
  }
  if (sheet.model.merges?.length) return errorXlsx('REACTIVOS_XLSX_CELDAS_COMBINADAS', `La hoja ${sheet.name} no admite celdas combinadas`);
  return new Map(actual.map((header, index) => [header, index + 1]));
}

export async function parsearXlsxReactivos(buffer: Buffer): Promise<ReactivosBatch> {
  const workbook = new ExcelJS.Workbook();
  try {
    await workbook.xlsx.load(buffer as unknown as Parameters<typeof workbook.xlsx.load>[0]);
  } catch {
    return errorXlsx('REACTIVOS_XLSX_INVALIDO', 'El archivo no es un libro XLSX válido');
  }
  const hojas = workbook.worksheets;
  if (hojas.length !== 2 || hojas.some((sheet) => !['Lote', 'Reactivos'].includes(sheet.name))) {
    return errorXlsx('REACTIVOS_XLSX_HOJAS_INVALIDAS', 'El libro debe tener únicamente las hojas visibles Lote y Reactivos');
  }
  const loteSheet = workbook.getWorksheet('Lote')!;
  const reactivosSheet = workbook.getWorksheet('Reactivos')!;
  const loteHeaders = validarEncabezados(loteSheet, HEADERS_LOTE);
  const reactivoHeaders = validarEncabezados(reactivosSheet, HEADERS_REACTIVOS, HEADERS_REACTIVOS_LEGACY);
  if (loteSheet.rowCount > CAMPOS_LOTE.length + 1) return errorXlsx('REACTIVOS_XLSX_LIMITE_EXCEDIDO', 'La hoja Lote contiene más campos de los permitidos');
  if (reactivosSheet.rowCount > 501) return errorXlsx('REACTIVOS_XLSX_LIMITE_EXCEDIDO', 'El archivo no puede superar 500 reactivos');

  const loteValues = new Map<string, string>();
  for (let rowNumber = 2; rowNumber <= loteSheet.rowCount; rowNumber += 1) {
    const cells = celdasFila(loteSheet, rowNumber);
    if (filaVacia(cells)) continue;
    const campo = textoCelda(cells[(loteHeaders.get('campo') ?? 1) - 1]?.value, `Lote!A${rowNumber}`);
    const valorCrudo = cells[(loteHeaders.get('valor') ?? 2) - 1]?.value;
    const valor = campo === 'schemaVersion' && valorCrudo === 1
      ? '1'
      : textoCelda(valorCrudo, `Lote!B${rowNumber}`, true);
    if (!(CAMPOS_LOTE as readonly string[]).includes(campo)) return errorXlsx('REACTIVOS_XLSX_CAMPO_DESCONOCIDO', `Campo de lote desconocido: ${campo}`);
    if (loteValues.has(campo)) return errorXlsx('REACTIVOS_XLSX_CAMPO_DUPLICADO', `El campo ${campo} está repetido en Lote`);
    loteValues.set(campo, valor);
  }
  for (const required of ['contract', 'schemaVersion', 'batchId', 'periodoId', 'temaIds', 'generator', 'generatedAt']) {
    if (!loteValues.get(required)) return errorXlsx('REACTIVOS_XLSX_CAMPO_REQUERIDO', `Falta ${required} en la hoja Lote`);
  }
  let temaIds: unknown;
  try { temaIds = JSON.parse(loteValues.get('temaIds')!); } catch { return errorXlsx('REACTIVOS_XLSX_TEMA_IDS_INVALIDOS', 'temaIds debe ser un arreglo JSON de IDs canónicos'); }
  if (!Array.isArray(temaIds) || temaIds.some((id) => typeof id !== 'string')) return errorXlsx('REACTIVOS_XLSX_TEMA_IDS_INVALIDOS', 'temaIds debe ser un arreglo JSON de IDs canónicos');
  const schemaVersion = loteValues.get('schemaVersion');
  if (schemaVersion !== '1') return errorXlsx('REACTIVOS_XLSX_VERSION_NO_SOPORTADA', 'schemaVersion debe ser 1');

  const items: Array<Record<string, unknown>> = [];
  for (let rowNumber = 2; rowNumber <= reactivosSheet.rowCount; rowNumber += 1) {
    const cells = celdasFila(reactivosSheet, rowNumber);
    if (filaVacia(cells)) continue;
    const get = (header: typeof HEADERS_REACTIVOS[number] | typeof HEADERS_REACTIVOS_LEGACY[number], optional = false) => {
      const column = reactivoHeaders.get(header);
      return textoCelda(column ? cells[column - 1]?.value : undefined, `Reactivos!${header}${rowNumber}`, optional);
    };
    const itemIdText = get('itemId', true);
    const versionValue = cells[(reactivoHeaders.get('expectedVersion') ?? 1) - 1]?.value;
    if (versionValue !== null && versionValue !== undefined && versionValue !== '' && typeof versionValue !== 'number') {
      return errorXlsx('REACTIVOS_XLSX_VERSION_INVALIDA', `expectedVersion debe ser entero positivo en la fila ${rowNumber}`);
    }
    const confidenceValue = cells[(reactivoHeaders.get('confidence') ?? 1) - 1]?.value;
    if (typeof confidenceValue !== 'number' || !Number.isFinite(confidenceValue)) return errorXlsx('REACTIVOS_XLSX_CONFIANZA_INVALIDA', `confidence debe ser número entre 0 y 1 en la fila ${rowNumber}`);
    const expectedVersion = versionValue === null || versionValue === undefined || versionValue === '' ? null : versionValue;
    if (expectedVersion !== null && (!Number.isSafeInteger(expectedVersion) || expectedVersion < 1)) return errorXlsx('REACTIVOS_XLSX_VERSION_INVALIDA', `expectedVersion debe ser entero positivo en la fila ${rowNumber}`);
    const parseArray = (header: 'competenciesJson' | 'tagsJson') => {
      const value = get(header, true);
      if (!value) return [];
      try {
        const parsed: unknown = JSON.parse(value);
        if (!Array.isArray(parsed) || parsed.some((entry) => typeof entry !== 'string')) throw new Error();
        return parsed;
      } catch { return errorXlsx('REACTIVOS_XLSX_JSON_COLUMNA_INVALIDO', `${header} debe ser un arreglo JSON de textos en la fila ${rowNumber}`); }
    };
    const correcta = get('respuestaCorrecta');
    const keys = ['A', 'B', 'C', 'D', 'E'] as const;
    if (!(keys as readonly string[]).includes(correcta)) return errorXlsx('REACTIVOS_XLSX_CLAVE_INVALIDA', `respuestaCorrecta debe ser A, B, C, D o E en la fila ${rowNumber}`);
    const difficulty = get('difficultyHypothesis', true);
    const cognitiveLevel = get('cognitiveLevel', true);
    const temaId = get('temaId', true);
    const item = {
      externalKey: get('externalKey'),
      itemId: itemIdText || null,
      expectedVersion,
      ...(temaId ? { temaId } : {}),
      format: 'omr.mcq5',
      stem: { format: 'richtext', value: get('enunciado') },
      options: keys.map((key) => ({ key, value: get(`opcion${key}` as typeof HEADERS_REACTIVOS[number]), isCorrect: correcta === key })),
      metadata: {
        ...(difficulty ? { difficultyHypothesis: difficulty } : {}),
        ...(cognitiveLevel ? { cognitiveLevel } : {}),
        ...(get('competenciesJson', true) ? { competencies: parseArray('competenciesJson') } : {}),
        ...(get('tagsJson', true) ? { tags: parseArray('tagsJson') } : {})
      },
      provenance: { origin: 'imported', confidence: confidenceValue, notes: get('notes', true) }
    };
    items.push(item);
    if (items.length > 500) return errorXlsx('REACTIVOS_XLSX_LIMITE_EXCEDIDO', 'El lote no puede superar 500 reactivos');
  }
  if (items.length === 0) return errorXlsx('REACTIVOS_XLSX_SIN_REACTIVOS', 'La hoja Reactivos no contiene filas de reactivos');

  return validarReactivosBatch({
    contract: loteValues.get('contract'),
    schemaVersion: 1,
    batchId: loteValues.get('batchId'),
    target: { periodoId: loteValues.get('periodoId'), temaIds },
    source: {
      kind: 'imported',
      generator: loteValues.get('generator'),
      ...(loteValues.get('generatorModel') ? { generatorModel: loteValues.get('generatorModel') } : {}),
      generatedAt: loteValues.get('generatedAt'),
      ...(loteValues.get('sourceDocumentSha256') ? { sourceDocumentSha256: loteValues.get('sourceDocumentSha256') } : {})
    },
    items
  });
}

export async function crearPlantillaXlsxReactivos(): Promise<Buffer> {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'EvaluaPro';
  const lote = workbook.addWorksheet('Lote');
  lote.addRow([...HEADERS_LOTE]);
  for (const campo of CAMPOS_LOTE) lote.addRow([campo, campo === 'contract' ? 'evaluapro.reactivos.batch' : campo === 'schemaVersion' ? 1 : '']);
  lote.getColumn(1).width = 28;
  lote.getColumn(2).width = 58;
  const reactivos = workbook.addWorksheet('Reactivos');
  reactivos.addRow([...HEADERS_REACTIVOS]);
  reactivos.getRow(1).eachCell((cell) => { cell.font = { bold: true }; cell.alignment = { wrapText: true }; });
  reactivos.views = [{ state: 'frozen', ySplit: 1 }];
  reactivos.autoFilter = { from: 'A1', to: `${String.fromCharCode(64 + HEADERS_REACTIVOS.length)}1` };
  reactivos.columns = HEADERS_REACTIVOS.map((header) => ({ header, key: header, width: header === 'enunciado' ? 48 : header.startsWith('opcion') ? 32 : 22 }));
  return Buffer.from(await workbook.xlsx.writeBuffer());
}
