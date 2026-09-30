import fs from 'node:fs/promises';
import path from 'node:path';
import { generarPdfExamen } from '../src/modulos/modulo_generacion_pdf/servicioGeneracionPdf.js';
import type { MapaVariante, PreguntaBase } from '../src/modulos/modulo_generacion_pdf/servicioVariantes.js';

// El runner ESM compila este script a un directorio temporal; la ruta de
// `import.meta.url` ya no apunta al checkout canónico. El proceso siempre se
// ejecuta desde apps/backend, por lo que el repositorio se resuelve desde CWD.
const root = path.resolve(process.cwd(), '../..');
const outputPath = process.env.OMR_TV4_VISUAL_OUT ?? path.join(root, 'output', 'qa', 'omr-plantilla-actualizada.pdf');
const perfilVisual = String(process.env.OMR_TV4_VISUAL_PROFILE ?? 'normal').trim().toLowerCase();
const usarFormatoRico = perfilVisual === 'rich';
const usarContenidoCorto = perfilVisual === 'short';

const enunciadoCorto = (numero: number) => `Pregunta de prueba ${numero}: elige la respuesta correcta.`;
const enunciadoRico = (numero: number) =>
  `<strong>Reactivo ${numero}</strong>: resuelve <span data-latex="\\frac{x^2+1}{y_1}">\\(formula\\)</span> y selecciona la opción <em>correcta</em>.`;
const opcionRica = (letra: string, numero: number) => {
  const muestras = {
    A: `<strong>Resultado</strong> ${numero}: H<sub>2</sub>O + <span data-latex="\\alpha+\\beta">\\(formula\\)</span>.`,
    B: `<em>Alternativa ${letra}</em>: <u>condición válida</u>.`,
    C: `<strong>Criterio</strong> <sub>c</sub>: <span data-latex="x^2+1">\\(formula\\)</span>.`,
    D: `\`total = ${numero} * 2\`; <em>determinista</em>.`,
    E: `<u>Conclusión</u>: <span data-latex="y_1 \\ne 0">\\(formula\\)</span>.`
  } as const;
  return muestras[letra as keyof typeof muestras] ?? `<strong>Opción ${letra}</strong> del reactivo ${numero}.`;
};
const opcionLargaNormal = 'Opción A con texto suficientemente largo para comprobar el envolvimiento tipográfico y la separación visual.';
const opcionSimple = (letra: string) => `Opción ${letra}`;
const svgDataUrl = (svg: string) => `data:image/svg+xml;base64,${Buffer.from(svg).toString('base64')}`;
const imagenFormula = svgDataUrl(
  '<svg xmlns="http://www.w3.org/2000/svg" width="640" height="180" viewBox="0 0 640 180">' +
  '<text x="320" y="106" text-anchor="middle" font-family="serif" font-size="50" fill="#141f33">f(x) = (x<tspan baseline-shift="super" font-size="32">2</tspan> + 1) / y<tspan baseline-shift="sub" font-size="32">1</tspan></text></svg>'
);
const imagenDiagrama = svgDataUrl(
  '<svg xmlns="http://www.w3.org/2000/svg" width="640" height="180" viewBox="0 0 640 180">' +
  '<rect x="55" y="62" width="150" height="56" rx="8" fill="none" stroke="#0f7a63" stroke-width="4"/>' +
  '<rect x="435" y="62" width="150" height="56" rx="8" fill="none" stroke="#0f7a63" stroke-width="4"/>' +
  '<path d="M205 90 H435 M395 72 L435 90 L395 108" fill="none" stroke="#0f7a63" stroke-width="5"/>' +
  '<text x="130" y="98" text-anchor="middle" font-family="sans-serif" font-size="24" fill="#141f33">entrada</text>' +
  '<text x="510" y="98" text-anchor="middle" font-family="sans-serif" font-size="24" fill="#141f33">salida</text></svg>'
);

const preguntas: PreguntaBase[] = [
  {
    id: 'visual-tv4-1',
    enunciado: usarFormatoRico ? enunciadoRico(1) : usarContenidoCorto ? enunciadoCorto(1) : 'Pregunta de prueba 1: seleccione la opción correcta.',
    opciones: [
      { texto: usarFormatoRico ? opcionRica('A', 1) : usarContenidoCorto ? opcionSimple('A') : opcionLargaNormal, esCorrecta: true },
      { texto: usarFormatoRico ? opcionRica('B', 1) : opcionSimple('B'), esCorrecta: false },
      { texto: usarFormatoRico ? opcionRica('C', 1) : opcionSimple('C'), esCorrecta: false },
      { texto: usarFormatoRico ? opcionRica('D', 1) : opcionSimple('D'), esCorrecta: false },
      { texto: usarFormatoRico ? opcionRica('E', 1) : opcionSimple('E'), esCorrecta: false }
    ]
  },
  {
    id: 'visual-tv4-2',
    enunciado: usarFormatoRico ? enunciadoRico(2) : usarContenidoCorto ? enunciadoCorto(2) : 'Pregunta de prueba 2: seleccione la opción correcta.',
    opciones: [
      { texto: usarFormatoRico ? opcionRica('A', 2) : usarContenidoCorto ? opcionSimple('A') : opcionLargaNormal, esCorrecta: false },
      { texto: usarFormatoRico ? opcionRica('B', 2) : opcionSimple('B'), esCorrecta: true },
      { texto: usarFormatoRico ? opcionRica('C', 2) : opcionSimple('C'), esCorrecta: false },
      { texto: usarFormatoRico ? opcionRica('D', 2) : opcionSimple('D'), esCorrecta: false },
      { texto: usarFormatoRico ? opcionRica('E', 2) : opcionSimple('E'), esCorrecta: false }
    ]
  },
  {
    id: 'visual-tv4-3',
    enunciado: usarFormatoRico ? enunciadoRico(3) : usarContenidoCorto ? enunciadoCorto(3) : 'Pregunta de prueba 3: seleccione la opción correcta.',
    opciones: [
      { texto: usarFormatoRico ? opcionRica('A', 3) : usarContenidoCorto ? opcionSimple('A') : opcionLargaNormal, esCorrecta: false },
      { texto: usarFormatoRico ? opcionRica('B', 3) : opcionSimple('B'), esCorrecta: false },
      { texto: usarFormatoRico ? opcionRica('C', 3) : opcionSimple('C'), esCorrecta: true },
      { texto: usarFormatoRico ? opcionRica('D', 3) : opcionSimple('D'), esCorrecta: false },
      { texto: usarFormatoRico ? opcionRica('E', 3) : opcionSimple('E'), esCorrecta: false }
    ]
  },
  {
    id: 'visual-tv4-4',
    enunciado: usarFormatoRico
      ? `<strong>Analiza</strong> el planteamiento y elige el procedimiento que mejor lo resuelve: <span data-latex="\\sqrt{a^2+b^2}">\\(formula\\)</span>.`
      : usarContenidoCorto
        ? enunciadoCorto(4)
        : 'Analice cuidadosamente el siguiente planteamiento y seleccione la respuesta que mejor representa el procedimiento correcto para resolverlo:',
    opciones: [
      { texto: usarFormatoRico ? opcionRica('A', 4) : usarContenidoCorto ? opcionSimple('A') : opcionLargaNormal, esCorrecta: false },
      { texto: usarFormatoRico ? opcionRica('B', 4) : opcionSimple('B'), esCorrecta: false },
      { texto: usarFormatoRico ? opcionRica('C', 4) : opcionSimple('C'), esCorrecta: false },
      { texto: usarFormatoRico ? opcionRica('D', 4) : opcionSimple('D'), esCorrecta: true },
      { texto: usarFormatoRico ? opcionRica('E', 4) : opcionSimple('E'), esCorrecta: false }
    ]
  },
  {
    id: 'visual-tv4-5',
    enunciado: usarFormatoRico
      ? '<strong>JavaScript:</strong> analiza este fragmento y determina el valor final de `total`.\n```js\nconst valores = [1, 2, 3];\nconst total = valores.map(x => x * 2).reduce((a, b) => a + b, 0);\n```'
      : 'Examine el comportamiento del siguiente algoritmo y seleccione el resultado correcto.',
    opciones: [
      { texto: usarFormatoRico ? opcionRica('A', 5) : 'Resultado 12.', esCorrecta: true },
      { texto: usarFormatoRico ? opcionRica('B', 5) : 'Resultado 6.', esCorrecta: false },
      { texto: usarFormatoRico ? opcionRica('C', 5) : 'Se produce un error de sintaxis.', esCorrecta: false },
      { texto: usarFormatoRico ? opcionRica('D', 5) : 'El arreglo queda vacío.', esCorrecta: false },
      { texto: usarFormatoRico ? opcionRica('E', 5) : 'El resultado es indefinido.', esCorrecta: false }
    ]
  },
  {
    id: 'visual-tv4-6',
    imagenUrl: imagenFormula,
    enunciado: usarFormatoRico
      ? '<em>Observa la fórmula</em> y elige la transformación equivalente.'
      : 'Observe la fórmula y elija la transformación equivalente.',
    opciones: [
      { texto: usarFormatoRico ? opcionRica('A', 6) : 'Se conserva la igualdad para todo y<sub>1</sub> != 0.', esCorrecta: false },
      { texto: usarFormatoRico ? opcionRica('B', 6) : 'La expresión siempre es cero.', esCorrecta: false },
      { texto: usarFormatoRico ? opcionRica('C', 6) : 'El denominador puede ser cero sin restricción.', esCorrecta: false },
      { texto: usarFormatoRico ? opcionRica('D', 6) : 'El resultado no depende de x.', esCorrecta: false },
      { texto: usarFormatoRico ? opcionRica('E', 6) : 'La expresión no está definida si y<sub>1</sub> = 0.', esCorrecta: true }
    ]
  },
  {
    id: 'visual-tv4-7',
    imagenUrl: imagenDiagrama,
    enunciado: usarFormatoRico
      ? '<strong>Diagrama:</strong> identifica la dirección del flujo entre los componentes.'
      : 'Identifique la dirección del flujo entre los componentes del diagrama.',
    opciones: [
      { texto: usarFormatoRico ? opcionRica('A', 7) : 'La salida alimenta a la entrada.', esCorrecta: false },
      { texto: usarFormatoRico ? opcionRica('B', 7) : 'La entrada se transforma en salida.', esCorrecta: true },
      { texto: usarFormatoRico ? opcionRica('C', 7) : 'No existe comunicación entre los bloques.', esCorrecta: false },
      { texto: usarFormatoRico ? opcionRica('D', 7) : 'El flujo ocurre únicamente de derecha a izquierda.', esCorrecta: false },
      { texto: usarFormatoRico ? opcionRica('E', 7) : 'Ambos bloques son independientes.', esCorrecta: false }
    ]
  }
];

const cantidadVisual = Math.max(1, Number.parseInt(process.env.OMR_TV4_VISUAL_COUNT ?? String(preguntas.length), 10) || preguntas.length);
const preguntasParaRender = Array.from({ length: cantidadVisual }, (_valor, indice) => {
  const base = preguntas[indice % preguntas.length]!;
  return indice < preguntas.length
    ? base
    : {
        enunciado: usarFormatoRico ? enunciadoRico(indice + 1) : `Reactivo ${indice + 1}: seleccione la opción correcta.`,
        opciones: ['A', 'B', 'C', 'D', 'E'].map((letra, opcion) => ({
          texto: usarFormatoRico ? opcionRica(letra, indice + 1) : `Opción ${letra}.`,
          esCorrecta: opcion === ((indice + 1) % 5)
        })),
        id: `visual-tv4-${indice + 1}`,
        imagenUrl: usarFormatoRico
          ? (indice + 1 === 6 ? imagenFormula : indice + 1 === 7 ? imagenDiagrama : undefined)
          : undefined
  };
});

if (usarFormatoRico) {
  const tieneFormatoRico = (texto: string) =>
    /<\s*(strong|em|u|sub|sup|span)\b|```|`[^`]+`/i.test(String(texto));
  const reactivosSinFormato = preguntasParaRender.filter((pregunta) =>
    !tieneFormatoRico(pregunta.enunciado) || pregunta.opciones.some((opcion) => !tieneFormatoRico(opcion.texto))
  );
  if (reactivosSinFormato.length > 0) {
    throw new Error(`La muestra rica contiene reactivos sin formato enriquecido: ${reactivosSinFormato.map((p) => p.id).join(', ')}`);
  }
}

const mapaVariante: MapaVariante = {
  ordenPreguntas: preguntasParaRender.map((pregunta) => pregunta.id),
  ordenOpcionesPorPregunta: Object.fromEntries(preguntasParaRender.map((pregunta) => [pregunta.id, [0, 1, 2, 3, 4]]))
};

const resultado = await generarPdfExamen({
  titulo: 'Evaluación integral de diseño y desarrollo de sistemas',
  folio: 'VISUAL-TV4-003',
  examId: 'visual-tv4-003',
  preguntas: preguntasParaRender,
  mapaVariante,
  tipoExamen: 'parcial',
  totalPaginas: 2,
  margenMm: 10,
  templateVersion: 4,
  bookletConfig: {
    densityMode: 'compact',
    fontScale: 1,
    lineSpacing: 1,
    logos: {
      izquierdaPath: path.join(root, 'logos', 'logo_cuh.png'),
      derechaPath: path.join(root, 'logos', 'logo_sys.png')
    }
  },
  encabezado: {
    institucion: 'Centro Universitario Hidalguense',
    lema: 'Sapientia est nostra fortis',
    materia: 'Diseño y Desarrollo de Aplicaciones Web',
    docente: 'Erick Renato Vega Cerón',
    instrucciones: 'Lea cada reactivo con atención. Marque una sola respuesta rellenando completamente el círculo, sin invadir sus bordes. Revise su nombre, grupo y folio antes de entregar la hoja.',
    mostrarInstrucciones: true,
    mostrarMarcaInstitucional: true,
    alumno: { nombre: '', grupo: '' }
  }
});

const colisiones = resultado.mapaOmr.paginas.flatMap((pagina) => pagina.layoutDebug?.collisionBoxes ?? []);
if (resultado.preguntasRestantes !== 0) throw new Error(`Preguntas sin mapear: ${resultado.preguntasRestantes}`);
if (colisiones.length !== 0) throw new Error(`Colisiones de layout: ${colisiones.length}`);

await fs.mkdir(path.dirname(outputPath), { recursive: true });
await fs.writeFile(outputPath, resultado.pdfBytes);
await fs.writeFile(
  outputPath.replace(/\.pdf$/i, '.layout.json'),
  JSON.stringify({ paginas: resultado.paginas, metricasPaginas: resultado.metricasPaginas, mapaOmr: resultado.mapaOmr }, null, 2)
);
process.stdout.write(`${JSON.stringify({ outputPath, paginas: resultado.paginas.length, colisiones: colisiones.length, preguntasRestantes: resultado.preguntasRestantes })}\n`);
