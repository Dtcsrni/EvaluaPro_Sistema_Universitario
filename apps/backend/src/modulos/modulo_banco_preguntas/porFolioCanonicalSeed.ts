type SeedOption = {
  texto: string;
  esCorrecta: boolean;
};

type SeedVersion = {
  numeroVersion: number;
  enunciado: string;
  opciones: SeedOption[];
};

type SeedQuestionDoc = {
  _id: string;
  docenteId: string;
  periodoId: string;
  tema: string;
  activo: boolean;
  versionActual: number;
  versiones: SeedVersion[];
};

type SeedTemaDoc = {
  _id: string;
  docenteId: string;
  periodoId: string;
  nombre: string;
  clave: string;
  activo: boolean;
};

type SeedPlantillaDoc = {
  _id: string;
  docenteId: string;
  periodoId: string;
  tipo: 'parcial' | 'global';
  titulo: string;
  tituloNormalizado: string;
  instrucciones: string;
  numeroPaginas: number;
  reactivosObjetivo: number;
  defaultVersionCount: number;
  answerKeyMode: 'digital' | 'scan_sheet';
  preguntasIds: string[];
  temas: string[];
  bookletConfig: {
    targetPages: number;
    densityMode: 'balanced' | 'compact' | 'relaxed';
    allowImages: boolean;
    imageBudgetPolicy: 'strict' | 'balanced';
    headerStyle: 'institutional' | 'compact';
    fontScale: number;
    lineSpacing: number;
    separateCoverPage: boolean;
  };
  omrConfig: {
    sheetFamilyCode: string;
    prefillMode: 'none' | 'roster' | 'per-student';
    identityMode: 'qr_plus_bubbled_id';
    allowBlankGenericSheets: boolean;
    versionMode: 'single' | 'multi_version';
    ignoreUnusedTrailingQuestions: boolean;
    captureMode: 'pdf_and_mobile';
  };
  configuracionPdf: {
    margenMm: number;
    layout: string;
  };
};

export type PorFolioCanonicalSeedPackage = {
  meta: {
    sourceRoot: string;
    sourceReports: string[];
    visibleQuestionRange: [number, number];
  };
  temaBanco: SeedTemaDoc;
  bancoPreguntas: SeedQuestionDoc[];
  examenPlantilla: SeedPlantillaDoc;
  answerKey: Record<number, 'A' | 'B' | 'C' | 'D' | 'E'>;
  questionOrder: Array<{
    numeroPregunta: number;
    preguntaId: string;
    correcta: 'A' | 'B' | 'C' | 'D' | 'E';
  }>;
};

type CanonicalQuestionDef = {
  numeroPregunta: number;
  preguntaId: string;
  enunciado: string;
  correcta: 'A' | 'B' | 'C' | 'D' | 'E';
  opciones: Record<'A' | 'B' | 'C' | 'D' | 'E', string>;
};

export const POR_FOLIO_CANONICAL_TOPIC_NAME = 'Primer Parcial - Logica de Programacion';
export const POR_FOLIO_CANONICAL_TOPIC_KEY = 'primer parcial - logica de programacion';
export const POR_FOLIO_CANONICAL_TEMPLATE_TITLE = 'Primer Parcial - Logica de Programacion - Canon Por Folio';
export const POR_FOLIO_CANONICAL_TEMPLATE_TITLE_NORMALIZED = 'primer parcial - logica de programacion - canon por folio';
export const POR_FOLIO_CANONICAL_TOPIC_ID = '65f000000000000000000010';
export const POR_FOLIO_CANONICAL_TEMPLATE_ID = '65f000000000000000000020';

const QUESTION_DEFS: CanonicalQuestionDef[] = [
  {
    numeroPregunta: 1,
    preguntaId: '65f100000000000000000001',
    enunciado: 'Cual afirmacion describe mejor una constante en programacion?',
    correcta: 'E',
    opciones: {
      A: 'Es una variable global que solo existe dentro de un ciclo.',
      B: 'Es una variable que cambia automaticamente segun el tipo de dato.',
      C: 'Es una instruccion que siempre se ejecuta al final del programa.',
      D: 'Es un dato que se almacena unicamente en arreglos.',
      E: 'Es un valor que no debe modificarse durante la ejecucion y suele declararse con un identificador representativo.'
    }
  },
  {
    numeroPregunta: 2,
    preguntaId: '65f100000000000000000002',
    enunciado: 'Se declara un arreglo de 5 enteros: int v[5]. En un esquema tipico de indices desde 0, cual es el ultimo indice valido?',
    correcta: 'D',
    opciones: {
      A: '0',
      B: '5',
      C: '1',
      D: '4',
      E: 'No hay ultimo indice; depende del valor almacenado.'
    }
  },
  {
    numeroPregunta: 3,
    preguntaId: '65f100000000000000000003',
    enunciado: 'Se pide validar que calif este en el rango 0 a 100 (inclusive). Cual condicion es correcta para detectar que el valor es invalido?',
    correcta: 'B',
    opciones: {
      A: '(calif > 0) AND (calif < 100)',
      B: '(calif < 0) OR (calif > 100)',
      C: '(calif >= 0) OR (calif <= 100)',
      D: '(calif == 0) OR (calif == 100)',
      E: '(calif < 0) AND (calif > 100)'
    }
  },
  {
    numeroPregunta: 4,
    preguntaId: '65f100000000000000000004',
    enunciado: 'Necesitas almacenar el grupo sanguineo de una persona con un solo caracter (por ejemplo: A, B, O). Que tipo de dato primitivo es el mas adecuado?',
    correcta: 'C',
    opciones: {
      A: 'float',
      B: 'string',
      C: 'char',
      D: 'int',
      E: 'boolean'
    }
  },
  {
    numeroPregunta: 5,
    preguntaId: '65f100000000000000000005',
    enunciado: 'Dados: x = 8, y = 3, z = 3. Evalua la expresion logica: (x >= 8) AND (y < 3 OR z = 3).',
    correcta: 'B',
    opciones: {
      A: 'Verdadero solo si x > 8',
      B: 'Verdadero',
      C: 'No se puede determinar sin conocer el lenguaje',
      D: 'Falso',
      E: 'Error por tipo de dato'
    }
  },
  {
    numeroPregunta: 6,
    preguntaId: '65f100000000000000000006',
    enunciado: 'Dados a = 2, b = 3, c = 4, cual es el valor de la expresion a + b x c?',
    correcta: 'C',
    opciones: {
      A: '24',
      B: '9',
      C: '14',
      D: '20',
      E: '18'
    }
  },
  {
    numeroPregunta: 7,
    preguntaId: '65f100000000000000000007',
    enunciado: 'Quieres almacenar calificaciones donde dimension 1 = parcial (3 parciales: 0..2), dimension 2 = materia (5 materias: 0..4), dimension 3 = alumno (N alumnos: 0..N-1). Cual declaracion representa mejor ese modelo?',
    correcta: 'D',
    opciones: {
      A: 'calif[N][3][5]',
      B: 'calif[3][N][5]',
      C: 'calif[5][N][3]',
      D: 'calif[3][5][N]',
      E: 'calif[5][3][N]'
    }
  },
  {
    numeroPregunta: 8,
    preguntaId: '65f100000000000000000008',
    enunciado: 'Cual definicion describe mejor un algoritmo en el contexto de Logica de Programacion?',
    correcta: 'A',
    opciones: {
      A: 'Una serie de pasos finita, ordenada y no ambigua para resolver un problema',
      B: 'Una base de datos con tablas relacionadas',
      C: 'Un conjunto de variables declaradas al inicio del programa',
      D: 'Un diagrama que siempre usa simbolos geometricos',
      E: 'Un programa escrito en C o Java que compila sin errores'
    }
  },
  {
    numeroPregunta: 9,
    preguntaId: '65f100000000000000000009',
    enunciado: 'En el contexto de pseudocodigo, que parte se considera el argumento de la sentencia de salida? Ejemplo: Imprimir "Hola"',
    correcta: 'D',
    opciones: {
      A: 'No existe argumento en sentencias de salida',
      B: 'Todo el renglon completo es el argumento',
      C: 'Imprimir',
      D: '"Hola"',
      E: 'El punto y coma (;)'
    }
  },
  {
    numeroPregunta: 10,
    preguntaId: '65f10000000000000000000a',
    enunciado: 'Cual estructura garantiza que el bloque de instrucciones se ejecute al menos una vez, aunque la condicion sea falsa desde el inicio?',
    correcta: 'C',
    opciones: {
      A: 'switch',
      B: 'while',
      C: 'do-while',
      D: 'if-then',
      E: 'for'
    }
  },
  {
    numeroPregunta: 11,
    preguntaId: '65f10000000000000000000b',
    enunciado: 'Cuantas veces se ejecuta el bloque si el ciclo es? Para i = 1 hasta 10 / (bloque) / FinPara',
    correcta: 'D',
    opciones: {
      A: '0',
      B: '9',
      C: '11',
      D: '10',
      E: 'Depende del valor de i al final'
    }
  },
  {
    numeroPregunta: 12,
    preguntaId: '65f10000000000000000000c',
    enunciado: 'En pseudocodigo, que condicion compara correctamente si x es igual a 10 (sin asignar)?',
    correcta: 'D',
    opciones: {
      A: 'x == 10',
      B: '10 = x = true',
      C: 'x <= 10',
      D: 'x = 10',
      E: 'x := 10'
    }
  },
  {
    numeroPregunta: 13,
    preguntaId: '65f10000000000000000000d',
    enunciado: 'Si a es int y b es float, que tipo de dato suele tener el resultado de a + b en la mayoria de lenguajes?',
    correcta: 'B',
    opciones: {
      A: 'int, porque a manda',
      B: 'float, porque se promueve al tipo con decimales',
      C: 'boolean, porque es una operacion logica',
      D: 'Depende: siempre queda como string',
      E: 'char, si a es menor a 256'
    }
  },
  {
    numeroPregunta: 14,
    preguntaId: '65f10000000000000000000e',
    enunciado: 'Se declara un arreglo bidimensional calif[3][5], donde fila = parcial (0..2) y columna = materia (0..4). Cual pseudocodigo recorre primero parciales (filas) y luego materias (columnas), sin salirse de rango?',
    correcta: 'E',
    opciones: {
      A: 'Para p = 0 hasta 3; Para m = 0 hasta 4; calif[p][m] = 0',
      B: 'Para p = 0 hasta 2; Para m = 0 hasta 5; calif[p][m] = 0',
      C: 'Para p = 0 hasta 2; Para m = 0 hasta 4; calif[m][p] = 0',
      D: 'Para p = 1 hasta 3; Para m = 1 hasta 5; calif[p][m] = 0',
      E: 'Para p = 0 hasta 2; Para m = 0 hasta 4; calif[p][m] = 0'
    }
  },
  {
    numeroPregunta: 15,
    preguntaId: '65f10000000000000000000f',
    enunciado: 'Necesitas almacenar la cantidad de alumnos inscritos (un conteo: 0, 1, 2, 3, ...). Que tipo de dato es el mas adecuado?',
    correcta: 'C',
    opciones: {
      A: 'boolean',
      B: 'string',
      C: 'int',
      D: 'char',
      E: 'float'
    }
  },
  {
    numeroPregunta: 16,
    preguntaId: '65f100000000000000000010',
    enunciado: 'Se requiere clasificar una calificacion calif (0 a 100) asi: Si calif >= 70 => "Aprobado", en caso contrario => "No aprobado". Cual bloque es el correcto?',
    correcta: 'C',
    opciones: {
      A: "Si calif > 70 Entonces Imprimir 'Aprobado' SiNo Imprimir 'No aprobado' FinSi",
      B: "Si calif == 70 Entonces Imprimir 'Aprobado' SiNo Imprimir 'No aprobado' FinSi",
      C: "Si calif >= 70 Entonces Imprimir 'Aprobado' SiNo Imprimir 'No aprobado' FinSi",
      D: "Si calif >= 70 Entonces Imprimir 'No aprobado' SiNo Imprimir 'Aprobado' FinSi",
      E: "Si calif < 70 Entonces Imprimir 'Aprobado' SiNo Imprimir 'No aprobado' FinSi"
    }
  }
];

function buildOptions(def: CanonicalQuestionDef): SeedOption[] {
  return (['A', 'B', 'C', 'D', 'E'] as const).map((letter) => ({
    texto: def.opciones[letter],
    esCorrecta: letter === def.correcta
  }));
}

export function buildPorFolioCanonicalSeed(args: {
  docenteId: string;
  periodoId: string;
}): PorFolioCanonicalSeedPackage {
  const docenteId = String(args.docenteId ?? '').trim();
  const periodoId = String(args.periodoId ?? '').trim();

  if (!docenteId) throw new Error('docenteId es requerido');
  if (!periodoId) throw new Error('periodoId es requerido');

  const bancoPreguntas: SeedQuestionDoc[] = QUESTION_DEFS.map((def) => ({
    _id: def.preguntaId,
    docenteId,
    periodoId,
    tema: POR_FOLIO_CANONICAL_TOPIC_NAME,
    activo: true,
    versionActual: 1,
    versiones: [
      {
        numeroVersion: 1,
        enunciado: def.enunciado,
        opciones: buildOptions(def)
      }
    ]
  }));

  const answerKey = Object.fromEntries(
    QUESTION_DEFS.map((def) => [def.numeroPregunta, def.correcta])
  ) as Record<number, 'A' | 'B' | 'C' | 'D' | 'E'>;

  return {
    meta: {
      sourceRoot: 'omr_samples_tv3/images/Por Folio',
      sourceReports: [
        'reports/qa/latest/por_folio_analysis_from_zero.json',
        'reports/qa/latest/por_folio_answer_key_rationale.json'
      ],
      visibleQuestionRange: [1, 16]
    },
    temaBanco: {
      _id: POR_FOLIO_CANONICAL_TOPIC_ID,
      docenteId,
      periodoId,
      nombre: POR_FOLIO_CANONICAL_TOPIC_NAME,
      clave: POR_FOLIO_CANONICAL_TOPIC_KEY,
      activo: true
    },
    bancoPreguntas,
    examenPlantilla: {
      _id: POR_FOLIO_CANONICAL_TEMPLATE_ID,
      docenteId,
      periodoId,
      tipo: 'parcial',
      titulo: POR_FOLIO_CANONICAL_TEMPLATE_TITLE,
      tituloNormalizado: POR_FOLIO_CANONICAL_TEMPLATE_TITLE_NORMALIZED,
      instrucciones: 'Rellena un solo circulo por pregunta.',
      numeroPaginas: 2,
      reactivosObjetivo: QUESTION_DEFS.length,
      defaultVersionCount: 1,
      answerKeyMode: 'scan_sheet',
      preguntasIds: QUESTION_DEFS.map((def) => def.preguntaId),
      temas: [POR_FOLIO_CANONICAL_TOPIC_NAME],
      bookletConfig: {
        targetPages: 2,
        densityMode: 'balanced',
        allowImages: false,
        imageBudgetPolicy: 'strict',
        headerStyle: 'institutional',
        fontScale: 1,
        lineSpacing: 1.1,
        separateCoverPage: false
      },
      omrConfig: {
        sheetFamilyCode: 'S50_5A_ID5_VR6',
        prefillMode: 'none',
        identityMode: 'qr_plus_bubbled_id',
        allowBlankGenericSheets: true,
        versionMode: 'single',
        ignoreUnusedTrailingQuestions: true,
        captureMode: 'pdf_and_mobile'
      },
      configuracionPdf: {
        margenMm: 10,
        layout: 'parcial'
      }
    },
    answerKey,
    questionOrder: QUESTION_DEFS.map((def) => ({
      numeroPregunta: def.numeroPregunta,
      preguntaId: def.preguntaId,
      correcta: def.correcta
    }))
  };
}

export const POR_FOLIO_CANONICAL_QUESTION_COUNT = QUESTION_DEFS.length;
export const POR_FOLIO_CANONICAL_ANSWER_KEY = Object.freeze(
  Object.fromEntries(QUESTION_DEFS.map((def) => [def.numeroPregunta, def.correcta]))
) as Readonly<Record<number, 'A' | 'B' | 'C' | 'D' | 'E'>>;
