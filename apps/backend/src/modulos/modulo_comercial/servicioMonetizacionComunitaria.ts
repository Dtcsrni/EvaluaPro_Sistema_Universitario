/**
 * Motor de monetizacion para usuarios de la Edicion Comunitaria.
 *
 * Objetivo:
 * - Recomendar un siguiente nivel comercial segun senales operativas.
 * - Mantener una entrada de bajo costo y rutas claras de crecimiento.
 */

export type PersonaComercial = 'docente' | 'coordinacion' | 'institucional' | 'socio_canal';

export type NivelComercial = {
  id: string;
  persona: PersonaComercial;
  orden: number;
  nombre: string;
  resumenValor: string;
  precioMensualMxn: { minimo: number; maximo: number };
  precioAnualMxn: { minimo: number; maximo: number };
  gatillosUpgrade: string[];
};

export type EstrategiaMonetizacion = {
  id: string;
  nombre: string;
  descripcion: string;
  margenBrutoObjetivoMinimo: number;
  aplicaPersonas: PersonaComercial[];
};

export type SenalesMonetizacion = {
  persona?: PersonaComercial;
  perfilCliente?: string;
  volumenDocentes?: number;
  volumenAlumnos?: number;
  incidenciasSoporteMes?: number;
  requiereCumplimiento?: boolean;
  requiereIntegraciones?: boolean;
  multipSede?: boolean;
  presupuestoMensualMxn?: number;
  usaEdicionComunitaria?: boolean;
};

export type RecomendacionMonetizacion = {
  ofertaPrincipal: NivelComercial;
  ofertasSecundarias: NivelComercial[];
  estrategiasPrioritarias: EstrategiaMonetizacion[];
  motivos: string[];
  guardrails: {
    margenBrutoMinimo: number;
    requiereConsentimientoPrueba35d: boolean;
    politicaDescuentos: string;
  };
};

const NIVELES_COMERCIALES: NivelComercial[] = [
  {
    id: 'docente_esencial',
    persona: 'docente',
    orden: 1,
    nombre: 'Docente Esencial',
    resumenValor: 'Entrada comercial de bajo costo para docente individual.',
    precioMensualMxn: { minimo: 129, maximo: 219 },
    precioAnualMxn: { minimo: 1290, maximo: 2190 },
    gatillosUpgrade: ['mayor volumen de grupos', 'necesidad de automatizacion adicional']
  },
  {
    id: 'docente_impulso',
    persona: 'docente',
    orden: 2,
    nombre: 'Docente Impulso',
    resumenValor: 'Mas productividad para carga operativa recurrente.',
    precioMensualMxn: { minimo: 249, maximo: 399 },
    precioAnualMxn: { minimo: 2490, maximo: 3990 },
    gatillosUpgrade: ['reportes mas frecuentes', 'incremento de incidencias operativas']
  },
  {
    id: 'docente_rendimiento',
    persona: 'docente',
    orden: 3,
    nombre: 'Docente Rendimiento',
    resumenValor: 'Operacion intensiva con analitica y control reforzado.',
    precioMensualMxn: { minimo: 449, maximo: 699 },
    precioAnualMxn: { minimo: 4490, maximo: 6990 },
    gatillosUpgrade: ['multiples periodos activos', 'demanda de trazabilidad extendida']
  },
  {
    id: 'docente_acompanamiento',
    persona: 'docente',
    orden: 4,
    nombre: 'Docente Acompanamiento',
    resumenValor: 'Servicio guiado y soporte prioritario para alta exigencia.',
    precioMensualMxn: { minimo: 799, maximo: 1399 },
    precioAnualMxn: { minimo: 7990, maximo: 13990 },
    gatillosUpgrade: ['soporte prioritario', 'adopcion asistida']
  },
  {
    id: 'coordinacion_esencial',
    persona: 'coordinacion',
    orden: 1,
    nombre: 'Coordinacion Esencial',
    resumenValor: 'Estandarizacion inicial para equipos academicos pequenos.',
    precioMensualMxn: { minimo: 1490, maximo: 2490 },
    precioAnualMxn: { minimo: 14900, maximo: 24900 },
    gatillosUpgrade: ['crecimiento de docentes', 'seguimiento por periodo']
  },
  {
    id: 'coordinacion_control',
    persona: 'coordinacion',
    orden: 2,
    nombre: 'Coordinacion Control',
    resumenValor: 'Tableros operativos y trazabilidad para coordinacion activa.',
    precioMensualMxn: { minimo: 2990, maximo: 4490 },
    precioAnualMxn: { minimo: 29900, maximo: 44900 },
    gatillosUpgrade: ['mayor complejidad de operacion', 'integraciones prioritarias']
  },
  {
    id: 'coordinacion_gestion',
    persona: 'coordinacion',
    orden: 3,
    nombre: 'Coordinacion Gestion',
    resumenValor: 'Productividad avanzada para alta recurrencia operativa.',
    precioMensualMxn: { minimo: 4990, maximo: 7490 },
    precioAnualMxn: { minimo: 49900, maximo: 74900 },
    gatillosUpgrade: ['incremento de incidencias', 'escalamiento de cobertura']
  },
  {
    id: 'coordinacion_acompanamiento',
    persona: 'coordinacion',
    orden: 4,
    nombre: 'Coordinacion Acompanamiento',
    resumenValor: 'Operacion asistida con mesa prioritaria y adopcion guiada.',
    precioMensualMxn: { minimo: 7990, maximo: 12990 },
    precioAnualMxn: { minimo: 79900, maximo: 129900 },
    gatillosUpgrade: ['SLA reforzado', 'capacitacion continua de equipo']
  },
  {
    id: 'institucional_esencial',
    persona: 'institucional',
    orden: 1,
    nombre: 'Institucional Esencial',
    resumenValor: 'Cobertura base con controles de gobierno y continuidad.',
    precioMensualMxn: { minimo: 14990, maximo: 24990 },
    precioAnualMxn: { minimo: 149900, maximo: 249900 },
    gatillosUpgrade: ['auditoria formal', 'demanda de SLA institucional']
  },
  {
    id: 'institucional_integral',
    persona: 'institucional',
    orden: 2,
    nombre: 'Institucional Integral',
    resumenValor: 'Endurecimiento operativo y soporte institucional ampliado.',
    precioMensualMxn: { minimo: 29990, maximo: 49990 },
    precioAnualMxn: { minimo: 299900, maximo: 499900 },
    gatillosUpgrade: ['cumplimiento avanzado', 'integraciones administrativas']
  },
  {
    id: 'institucional_multisede',
    persona: 'institucional',
    orden: 3,
    nombre: 'Institucional Multisede',
    resumenValor: 'Operacion centralizada para campus y sedes distribuidas.',
    precioMensualMxn: { minimo: 49990, maximo: 84990 },
    precioAnualMxn: { minimo: 499900, maximo: 849900 },
    gatillosUpgrade: ['gobierno multi-campus', 'politicas compartidas por sede']
  },
  {
    id: 'institucional_sector_publico',
    persona: 'institucional',
    orden: 4,
    nombre: 'Institucional Sector Publico',
    resumenValor: 'Paquete de cumplimiento reforzado para sujetos obligados.',
    precioMensualMxn: { minimo: 69990, maximo: 119990 },
    precioAnualMxn: { minimo: 699900, maximo: 1199900 },
    gatillosUpgrade: ['requerimientos regulatorios estrictos', 'evidencia documental reforzada']
  },
  {
    id: 'socio_operador',
    persona: 'socio_canal',
    orden: 1,
    nombre: 'Socio Operador',
    resumenValor: 'Operacion de cuentas de terceros en alcance inicial.',
    precioMensualMxn: { minimo: 9990, maximo: 19990 },
    precioAnualMxn: { minimo: 99900, maximo: 199900 },
    gatillosUpgrade: ['crecimiento de cartera', 'servicios recurrentes de implementacion']
  },
  {
    id: 'socio_crecimiento',
    persona: 'socio_canal',
    orden: 2,
    nombre: 'Socio Crecimiento',
    resumenValor: 'Escalamiento comercial con cartera en expansion.',
    precioMensualMxn: { minimo: 24990, maximo: 39990 },
    precioAnualMxn: { minimo: 249900, maximo: 399900 },
    gatillosUpgrade: ['cuentas enterprise', 'soporte preventa recurrente']
  },
  {
    id: 'socio_marca_blanca',
    persona: 'socio_canal',
    orden: 3,
    nombre: 'Socio Marca Blanca',
    resumenValor: 'Comercializacion con identidad del socio bajo contrato.',
    precioMensualMxn: { minimo: 39990, maximo: 69990 },
    precioAnualMxn: { minimo: 399900, maximo: 699900 },
    gatillosUpgrade: ['necesidad de personalizacion profunda', 'ciclo comercial complejo']
  },
  {
    id: 'socio_oem_integrado',
    persona: 'socio_canal',
    orden: 4,
    nombre: 'Socio OEM Integrado',
    resumenValor: 'Integracion OEM para oferta de terceros.',
    precioMensualMxn: { minimo: 69990, maximo: 119990 },
    precioAnualMxn: { minimo: 699900, maximo: 1199900 },
    gatillosUpgrade: ['acuerdos de integracion avanzada', 'obligaciones contractuales extendidas']
  }
];

const ESTRATEGIAS_MONETIZACION: EstrategiaMonetizacion[] = [
  {
    id: 'conversion_nivel_entrada',
    nombre: 'Conversion a nivel de entrada',
    descripcion: 'Mover usuarios comunitarios con uso recurrente a un nivel de bajo costo.',
    margenBrutoObjetivoMinimo: 0.6,
    aplicaPersonas: ['docente', 'coordinacion', 'institucional', 'socio_canal']
  },
  {
    id: 'servicios_incorporacion',
    nombre: 'Servicios de incorporacion acelerada',
    descripcion: 'Cobrar acompanamiento inicial para reducir friccion y tiempo a valor.',
    margenBrutoObjetivoMinimo: 0.6,
    aplicaPersonas: ['docente', 'coordinacion', 'institucional']
  },
  {
    id: 'paquetes_cumplimiento',
    nombre: 'Paquetes de cumplimiento',
    descripcion: 'Monetizar evidencia operativa y documental en clientes con auditoria.',
    margenBrutoObjetivoMinimo: 0.6,
    aplicaPersonas: ['coordinacion', 'institucional', 'socio_canal']
  },
  {
    id: 'migracion_asistida',
    nombre: 'Migracion asistida comunitaria a comercial',
    descripcion: 'Servicio formal de migracion de datos, configuracion y continuidad.',
    margenBrutoObjetivoMinimo: 0.6,
    aplicaPersonas: ['docente', 'coordinacion', 'institucional']
  },
  {
    id: 'formacion_certificada',
    nombre: 'Formacion certificada por rol',
    descripcion: 'Monetizar cursos y certificaciones para adopcion y operacion estable.',
    margenBrutoObjetivoMinimo: 0.6,
    aplicaPersonas: ['docente', 'coordinacion', 'institucional']
  },
  {
    id: 'ecosistema_socios',
    nombre: 'Ecosistema de socios de canal',
    descripcion: 'Expandir ingresos con socios operadores, crecimiento y OEM.',
    margenBrutoObjetivoMinimo: 0.6,
    aplicaPersonas: ['socio_canal', 'institucional']
  },
  {
    id: 'soporte_premium',
    nombre: 'Soporte premium opcional',
    descripcion: 'Monetizar urgencia operativa sin forzar upgrade inmediato.',
    margenBrutoObjetivoMinimo: 0.6,
    aplicaPersonas: ['docente', 'coordinacion', 'institucional', 'socio_canal']
  },
  {
    id: 'prueba_35_dias',
    nombre: 'Prueba de 35 dias con consentimiento',
    descripcion: 'Capturar senales de uso para personalizar oferta y elevar conversion.',
    margenBrutoObjetivoMinimo: 0.6,
    aplicaPersonas: ['docente', 'coordinacion', 'institucional', 'socio_canal']
  }
];

function nivelesPorPersona(persona: PersonaComercial): NivelComercial[] {
  return NIVELES_COMERCIALES.filter((nivel) => nivel.persona === persona).sort((a, b) => a.orden - b.orden);
}

function resolverPersona(senales: SenalesMonetizacion): PersonaComercial {
  if (senales.persona) return senales.persona;
  if (senales.multipSede || senales.requiereCumplimiento) return 'institucional';
  if ((senales.volumenDocentes ?? 0) >= 5) return 'coordinacion';
  return 'docente';
}

function resolverOrdenObjetivo(persona: PersonaComercial, senales: SenalesMonetizacion): number {
  let orden = 1;
  const volumenDocentes = senales.volumenDocentes ?? 0;
  const volumenAlumnos = senales.volumenAlumnos ?? 0;
  const incidencias = senales.incidenciasSoporteMes ?? 0;
  const presupuesto = senales.presupuestoMensualMxn ?? 0;

  if (volumenAlumnos >= 150 || volumenDocentes >= 10) orden += 1;
  if (incidencias >= 8 || senales.requiereIntegraciones) orden += 1;
  if (senales.requiereCumplimiento || senales.multipSede) orden += 1;

  if (presupuesto > 0) {
    if (persona === 'docente' && presupuesto < 230) orden = 1;
    if (persona === 'coordinacion' && presupuesto < 2600) orden = 1;
    if (persona === 'institucional' && presupuesto < 26000) orden = 1;
    if (persona === 'socio_canal' && presupuesto < 21000) orden = Math.min(orden, 2);
  }

  return Math.max(1, Math.min(4, orden));
}

function estrategiasPorPersona(persona: PersonaComercial): EstrategiaMonetizacion[] {
  return ESTRATEGIAS_MONETIZACION.filter((estrategia) => estrategia.aplicaPersonas.includes(persona));
}

function construirMotivos(persona: PersonaComercial, orden: number, senales: SenalesMonetizacion): string[] {
  const motivos: string[] = [];
  motivos.push(`Persona detectada: ${persona}.`);
  motivos.push(`Nivel recomendado por senales operativas: ${orden}.`);

  if (senales.usaEdicionComunitaria) {
    motivos.push('Se detecta uso comunitario, priorizar oferta de entrada con upgrade progresivo.');
  }
  if ((senales.incidenciasSoporteMes ?? 0) >= 8) {
    motivos.push('Incidencias altas, conviene agregar soporte y servicio de acompanamiento.');
  }
  if (senales.requiereCumplimiento) {
    motivos.push('Hay requerimiento de cumplimiento; priorizar paquete con evidencia y trazabilidad.');
  }
  if (senales.requiereIntegraciones) {
    motivos.push('La necesidad de integraciones acelera el valor de niveles intermedios o altos.');
  }

  return motivos;
}

export function listarNivelesComerciales(): NivelComercial[] {
  return [...NIVELES_COMERCIALES];
}

export function listarEstrategiasMonetizacion(): EstrategiaMonetizacion[] {
  return [...ESTRATEGIAS_MONETIZACION];
}

export function recomendarMonetizacionComunitaria(senales: SenalesMonetizacion): RecomendacionMonetizacion {
  const persona = resolverPersona(senales);
  const ordenObjetivo = resolverOrdenObjetivo(persona, senales);
  const nivelesPersona = nivelesPorPersona(persona);
  const ofertaPrincipal = nivelesPersona.find((nivel) => nivel.orden === ordenObjetivo) ?? nivelesPersona[0];
  const ofertasSecundarias = nivelesPersona.filter((nivel) => nivel.id !== ofertaPrincipal.id);
  const estrategiasPrioritarias = estrategiasPorPersona(persona).slice(0, 4);

  return {
    ofertaPrincipal,
    ofertasSecundarias,
    estrategiasPrioritarias,
    motivos: construirMotivos(persona, ofertaPrincipal.orden, senales),
    guardrails: {
      margenBrutoMinimo: 0.6,
      requiereConsentimientoPrueba35d: true,
      politicaDescuentos: 'No aprobar descuentos por debajo del margen bruto minimo del 60%.'
    }
  };
}
