import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { generarPdfExamen } from '../src/modulos/modulo_generacion_pdf/servicioGeneracionPdf.js';
import { rasterizarPdfParaPreview } from '../src/modulos/modulo_generacion_pdf/infra/rasterizadorPdfPreview.js';
import type { MapaVariante, PreguntaBase } from '../src/modulos/modulo_generacion_pdf/servicioVariantes.js';

const root = path.resolve(process.cwd(), '../..');
const outDir = path.resolve(
  process.env.OMR_VISUAL_QA_OUT_DIR ?? path.join(root, 'output', 'qa')
);
const logoIzquierdaPath = path.join(root, 'logos', 'logo_cuh.png');
const logoDerechaPath = path.join(root, 'logos', 'logo_sys.png');
const imagenRicaQa = `data:image/svg+xml;base64,${Buffer.from(
  '<svg xmlns="http://www.w3.org/2000/svg" width="420" height="70"><rect width="420" height="70" fill="#f4f8fb"/><circle cx="210" cy="35" r="22" fill="none" stroke="#187db4" stroke-width="3"/><path d="M80 35h260M210 12v46" stroke="#6d4bb5" stroke-width="3"/><text x="210" y="42" text-anchor="middle" font-family="Arial" font-size="18" fill="#17243a">f(x)</text></svg>'
).toString('base64')}`;

type ModoVisual = 'compacto' | 'rico' | 'largo' | 'extremo' | 'limite';

function crearPreguntas(total: number, modo: ModoVisual): PreguntaBase[] {
  const enunciadosRicos = [
    '<strong>Reactivo 1.</strong> <em>¿Qué principio conserva la evidencia de una decisión?</em>',
    '<strong>Reactivo 2.</strong> ¿Qué paso precede a transformar un dato?',
    '<strong>Reactivo 3.</strong> ¿Qué salida revela una condición incumplida?',
    '<strong>Reactivo 4.</strong> ¿Qué ventaja ofrece separar validación y registro?',
    '<strong>Reactivo 5.</strong> ¿Qué propiedad hace reproducible una función?',
    '<strong>Reactivo 6.</strong> ¿Qué decisión conserva el contexto de un dato?',
    '<strong>Reactivo 7.</strong> ¿Cómo se corrige una entrada conservando su motivo?',
    '<strong>Reactivo 8.</strong> ¿Qué evidencia permite reconstruir una transformación?',
    '<strong>Reactivo 9.</strong> ¿Qué criterio resuelve un conflicto entre reglas?',
    '<strong>Reactivo 10.</strong> Determina el resultado final de la función.',
    '<strong>Reactivo 11.</strong> ¿Cómo se representa una ausencia de datos?',
    '<strong>Reactivo 12.</strong> ¿Qué estructura relaciona entrada, regla y resultado?',
    '<strong>Reactivo 13.</strong> ¿Qué debe comprobarse antes de dividir?',
    '<strong>Reactivo 14.</strong> Verifica la restricción de esta fórmula <span data-latex="\\frac{x^2+1}{y_1}">\\(fórmula\\)</span>.',
    '<strong>Reactivo 15.</strong> Observa el diagrama y elige la dirección del flujo.',
    '<strong>Reactivo 16.</strong> ¿Qué distingue una regla explícita en código?',
    '<strong>Reactivo 17.</strong> ¿Qué control evita un ciclo indefinido?',
    '<strong>Reactivo 18.</strong> ¿Qué hacer ante evidencia ambigua?',
    '<strong>Reactivo 19.</strong> ¿Qué orden localiza la primera divergencia?',
    '<strong>Reactivo 20.</strong> Analiza el fragmento JavaScript y determina su resultado.',
    '<strong>Reactivo 21.</strong> ¿Qué valida una respuesta única?',
    '<strong>Reactivo 22.</strong> ¿Qué concluyes sin evidencia del origen?',
    '<strong>Reactivo 23.</strong> ¿Qué cambio evita alterar el tipo del dato?',
    '<strong>Reactivo 24.</strong> ¿Qué conserva el diagnóstico ante una excepción?',
    '<strong>Reactivo 25.</strong> ¿Qué demuestra que una decisión es auditable?'
  ];
  const enunciadosLargos = [
    'Analiza el registro de una decisión y determina qué principio permite conservar la evidencia necesaria para verificarla después.',
    'Examina el proceso de transformación de un dato y selecciona el paso que debe ocurrir antes de modificar su valor original.',
    'Considera una condición que no se cumple y elige qué salida permite identificar el problema sin perder el contexto del análisis.',
    'Compara validación y registro para determinar qué ventaja aporta separar ambas tareas dentro de un flujo controlado.',
    'Evalúa las propiedades de una función y selecciona la que permite repetir el mismo cálculo con entradas equivalentes.',
    'Analiza una decisión que depende de información previa y determina qué elemento conserva el contexto necesario para interpretarla.',
    'Revisa una entrada que debe corregirse y elige el procedimiento que conserva tanto su motivo como la evidencia del cambio.',
    'Examina los datos disponibles y selecciona la evidencia que permite reconstruir una transformación desde el origen hasta el resultado.',
    'Analiza un conflicto entre reglas y determina qué criterio debe aplicarse para obtener una decisión consistente y verificable.',
    'Observa el cálculo realizado y selecciona el resultado que corresponde después de procesar todos los valores recibidos.',
    'Considera un sistema sin información disponible y determina cómo debe representarse la ausencia sin confundirla con un valor válido.',
    'Relaciona entrada, regla y resultado para identificar la estructura que permite explicar una decisión de manera completa.',
    'Antes de ejecutar una división, analiza el dato recibido y selecciona la comprobación que evita un resultado inválido.',
    'Examina la fórmula propuesta y determina qué restricción debe verificarse para que el cálculo sea válido en el escenario descrito.',
    'Observa el diagrama y selecciona la dirección del flujo que coincide con la secuencia de procesamiento indicada en el caso.',
    'Analiza un fragmento de código y determina qué característica distingue una regla explícita de una decisión implícita.',
    'Considera un ciclo que podría repetirse indefinidamente y selecciona el control que garantiza una terminación verificable.',
    'Examina evidencia ambigua y elige la acción que permite documentar la incertidumbre antes de aceptar una conclusión.',
    'Analiza varias decisiones consecutivas y determina qué orden permite localizar la primera divergencia del comportamiento esperado.',
    'Observa el fragmento de JavaScript y selecciona el resultado que se obtiene al ejecutar la operación con todos sus valores.',
    'Considera una pregunta con una sola respuesta válida y determina qué comprobación evita aceptar alternativas contradictorias.',
    'Examina una conclusión cuyo origen no está documentado y selecciona qué información falta para considerarla verificable.',
    'Analiza un cambio de datos y determina qué medida evita alterar accidentalmente el tipo requerido por el contrato.',
    'Considera una excepción durante el procesamiento y selecciona qué evidencia debe conservarse para mantener el diagnóstico.',
    'Examina una decisión que debe auditarse y determina qué registro demuestra que el criterio aplicado fue consistente.'
  ];

  return Array.from({ length: total }, (_valor, indice) => {
    const numero = indice + 1;
    const enunciado = modo === 'compacto'
        ? `Pregunta ${numero}: selecciona la opción correcta.`
        : modo === 'rico'
          ? `${enunciadosRicos[indice] ?? `<strong>Reactivo ${numero}.</strong> Selecciona la respuesta correcta con base en el criterio indicado.`}${numero === 10 || numero === 20 ? '\n```js\nconst total = valores.reduce((s, v) => s + v, 0);\n```' : ''}`
          : modo === 'largo'
            ? `<strong>Reactivo ${numero}.</strong> ${enunciadosLargos[indice] ?? 'Analiza el escenario completo y selecciona la respuesta que conserva una decisión verificable.'}`
          : modo === 'extremo'
          ? `Reactivo ${numero}: **analiza con cuidado** el escenario descrito, identifica las restricciones relevantes y selecciona la respuesta que conserva la trazabilidad del proceso sin confundir datos, reglas y resultado final.`
          : `Reactivo ${numero}: **analiza** el caso y selecciona la alternativa que mantiene la trazabilidad, la consistencia y una decisión verificable bajo las restricciones indicadas.`;

    const opciones = modo === 'compacto'
      ? ['Opción A', 'Opción B', 'Opción C', 'Opción D', 'Opción E']
      : modo === 'rico' || modo === 'largo'
        ? [
          '<strong>Conserva la entrada.</strong>',
          '<em>Valida la condición.</em>',
          '<u>Aplica el criterio.</u>',
          'Detiene el flujo.',
          'Resultado verificable.'
        ]
        : modo === 'extremo'
          ? [
          'Mantiene el valor original, registra la decisión y reporta el motivo de forma verificable.',
          'Cambia el valor antes de validarlo y oculta el estado intermedio.',
          'Usa una condición distinta a la declarada en el escenario.',
          'Descarta el contexto y conserva únicamente el resultado final.',
          'Repite la operación sin límite y no informa el resultado.'
          ]
          : [
            'Conserva el dato original, valida la entrada y documenta la decisión con evidencia suficiente para repetir el análisis.',
            'Modifica el dato antes de validarlo y oculta el estado intermedio, aunque después parezca correcto.',
            'Aplica una condición distinta a la declarada y deja sin explicar el criterio que produjo la decisión.',
            'Descarta el contexto y conserva solo el resultado final, aunque ya no pueda verificarse su origen.',
            'Repite la operación sin límite y omite el registro necesario para detectar una inconsistencia.'
          ];

    return {
      id: `qa-${modo}-${numero}`,
      imagenUrl: modo === 'rico' && numero === 15 ? imagenRicaQa : undefined,
      enunciado: (modo === 'extremo' && numero % 4 === 0) || (modo === 'limite' && numero % 3 === 0)
        ? `${enunciado}\n\`\`\`pseudo\nsi entrada es válida entonces\n  registrar(resultado)\n  conservar(trazabilidad)\nfin\`\`\``
        : enunciado,
      opciones: opciones.map((texto, opcion) => ({ texto, esCorrecta: opcion === indice % 5 }))
    };
  });
}

function mapaPara(preguntas: PreguntaBase[]): MapaVariante {
  return {
    ordenPreguntas: preguntas.map((pregunta) => pregunta.id),
    ordenOpcionesPorPregunta: Object.fromEntries(preguntas.map((pregunta) => [pregunta.id, [0, 1, 2, 3, 4]]))
  };
}

async function generar(nombre: string, modo: ModoVisual, totalPreguntas: number, totalPaginas: number, fontScale = 1, lineSpacing = 1) {
  const preguntas = crearPreguntas(totalPreguntas, modo);
  const resultado = await generarPdfExamen({
    titulo: modo === 'extremo' || modo === 'limite' ? 'Evaluación integral de diseño y desarrollo de sistemas' : 'Evaluación de control y fundamentos',
    folio: `QA-OMR-${modo.toUpperCase()}-2026`,
    examId: `qa-${modo}-2026`,
    preguntas,
    mapaVariante: mapaPara(preguntas),
    tipoExamen: 'parcial',
    totalPaginas,
    margenMm: 10,
    templateVersion: 4,
    // Todas las muestras deben probar el único perfil OMR operativo de la
    // plantilla canónica. No se permite que un caso rico vuelva a una
    // geometría vertical histórica solo por cambiar el modo visual.
    bookletConfig: {
      densityMode: 'compact',
      fontScale,
      lineSpacing,
      logos: { izquierdaPath: logoIzquierdaPath, derechaPath: logoDerechaPath }
    },
    encabezado: {
      institucion: modo === 'extremo'
        ? 'Centro Universitario Hidalguense - Facultad de Ingeniería y Ciencias Aplicadas'
        : modo === 'limite'
          ? 'Centro Universitario Hidalguense - Facultad de Ingeniería, Ciencias Aplicadas y Transformación Digital'
          : 'Centro Universitario Hidalguense',
      lema: 'Sapientia est nostra fortis',
      materia: modo === 'extremo' || modo === 'limite'
        ? 'Diseño y Desarrollo de Aplicaciones Web - Arquitectura, calidad y trazabilidad de sistemas'
        : 'Diseño de Sistemas',
      docente: 'Erick Renato Vega Cerón',
      instrucciones: 'Lea detenidamente cada reactivo, razone antes de responder y marque una sola respuesta dentro del círculo. Si cambia, borre por completo la marca anterior.',
      mostrarInstrucciones: true,
      mostrarMarcaInstitucional: true,
      alumno: { nombre: '', grupo: '' }
    }
  });
  const pdfPath = path.join(outDir, `${nombre}.pdf`);
  const mapPath = path.join(outDir, `${nombre}.layout.json`);
  await fs.writeFile(pdfPath, resultado.pdfBytes);
  const colisiones = resultado.mapaOmr.paginas.flatMap((pagina) => pagina.layoutDebug?.collisionBoxes ?? []);
  if (resultado.preguntasRestantes !== 0) {
    throw new Error(`${nombre}: quedaron ${resultado.preguntasRestantes} preguntas sin mapear`);
  }
  if (colisiones.length !== 0) {
    throw new Error(`${nombre}: se detectaron ${colisiones.length} colisiones de layout`);
  }
  await fs.writeFile(mapPath, JSON.stringify({
    paginas: resultado.paginas,
    metricasPaginas: resultado.metricasPaginas,
    metricasLayout: resultado.metricasLayout,
    preguntasRestantes: resultado.preguntasRestantes,
    mapaOmr: resultado.mapaOmr
  }, null, 2));
  return {
    nombre,
    pdfPath,
    paginas: resultado.paginas.length,
    preguntasPorPagina: resultado.paginas.map((pagina) => pagina.preguntasAl >= pagina.preguntasDel ? pagina.preguntasAl - pagina.preguntasDel + 1 : 0),
    colisiones,
    preguntasRestantes: resultado.preguntasRestantes,
    metricasPaginas: resultado.metricasPaginas
  };
}

await fs.mkdir(outDir, { recursive: true });
const modoQa: ModoVisual = process.env.OMR_VISUAL_QA_MODE === 'extremo'
  ? 'extremo'
  : process.env.OMR_VISUAL_QA_MODE === 'largo'
    ? 'largo'
    : 'rico';
const fontScaleQa = Number.isFinite(Number(process.env.OMR_VISUAL_QA_FONT_SCALE))
  ? Number(process.env.OMR_VISUAL_QA_FONT_SCALE)
  : 1;
const lineSpacingQa = Number.isFinite(Number(process.env.OMR_VISUAL_QA_LINE_SPACING))
  ? Number(process.env.OMR_VISUAL_QA_LINE_SPACING)
  : 1;
const resultados = [
  await generar('omr-tv4-base-capacity', modoQa, 25, 2, fontScaleQa, lineSpacingQa)
];

// Los rasterizados son evidencia temporal de inspección, no entregables. Se
// generan en secuencia y se eliminan al finalizar para dejar un único PDF base
// y su mapa de trazabilidad en output/qa.
const rasterTempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'evaluapro-omr-visual-raster-'));
try {
  for (const rasterDpi of [150, 300]) {
    const rasterDir = path.join(rasterTempDir, `raster-${rasterDpi}`);
    await fs.mkdir(rasterDir, { recursive: true });
    for (const resultado of resultados) {
      const pdfBytes = await fs.readFile(resultado.pdfPath);
      const raster = await rasterizarPdfParaPreview(pdfBytes, { dpi: rasterDpi });
      for (const pagina of raster.paginas) {
        const imagen = Buffer.from(pagina.dataUrl.split(',', 2)[1] ?? '', 'base64');
        await fs.writeFile(path.join(rasterDir, `${resultado.nombre}-${pagina.numero}.png`), imagen);
      }
    }
  }
} finally {
  await fs.rm(rasterTempDir, { recursive: true, force: true });
}

process.stdout.write(`${JSON.stringify(resultados, null, 2)}\n`);
