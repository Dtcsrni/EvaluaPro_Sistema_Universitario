/**
 * controladorEvaluaciones
 *
 * Responsabilidad: Adaptador HTTP del dominio (parseo de entrada, invocacion de servicios y respuesta).
 * Limites: Evitar mover logica de negocio profunda a controlador.
 */
import type { Response } from 'express';
import { Buffer } from 'node:buffer';
import { createHash } from 'node:crypto';
import { ErrorAplicacion } from '../../compartido/errores/errorAplicacion.js';
import { obtenerDocenteId, type SolicitudDocente } from '../modulo_autenticacion/middlewareAutenticacion.js';
import {
  type CodigoPoliticaCalificacion
} from './modeloPoliticaCalificacion.js';
import {
  calcularExamenCorte,
  calcularPoliticaLisc,
  promedioPonderado,
  redondearFinalInstitucional
} from './servicioPoliticasCalificacion.js';
import { prisma } from '../../infraestructura/baseDatos/sqlite.js';
import {
  esquemaArchivarEvidencia,
  esquemaCrearPolitica,
  esquemaListarEvidenciasEvaluacion,
  esquemaRestaurarEvidencia
} from './validacionesEvaluaciones.js';

const POLITICAS_BASE: Array<{
  codigo: CodigoPoliticaCalificacion;
  version: number;
  nombre: string;
  descripcion: string;
  familia: 'sv_excel_contract' | 'lisc_encuadre';
  parametros: Record<string, unknown>;
}> = [
  {
    codigo: 'POLICY_SV_EXCEL_2026',
    version: 1,
    nombre: 'Política Sistemas Visuales 2026 (Excel)',
    descripcion: 'Mantiene el contrato histórico del libro de calificaciones SV.',
    familia: 'sv_excel_contract',
    parametros: {
      tipo: 'sv_excel_contract',
      referencia: 'Sistemas_Visuales_Enero-Febrero-2026.xlsx',
      pesosExamen: { global: 0.6, parciales: 0.4 }
    }
  },
  {
    codigo: 'POLICY_LISC_ENCUADRE_2026',
    version: 1,
    nombre: 'Política LISC Encuadre 2026',
    descripcion: 'Final 50% continua + 50% exámenes (20/20/60).',
    familia: 'lisc_encuadre',
    parametros: {
      tipo: 'lisc_encuadre',
      pesosGlobales: { continua: 0.5, examenes: 0.5 },
      pesosExamenes: { parcial1: 0.2, parcial2: 0.2, global: 0.6 },
      pesosContinuaCortes: { c1: 0.2, c2: 0.2, c3: 0.6 },
      pesosComponentesExamen: { teorico: 0.6, practicas: 0.4 },
      umbralAprobacion: 6
    }
  }
];

type PoliticaPersistida = {
  id: string;
  docenteId: string;
  nombre: string;
  configuracion: string;
  createdAt: Date;
  updatedAt: Date;
};

type DefinicionPolitica = {
  codigo: string;
  version: number;
  nombre: string;
  descripcion: string;
  familia: 'sv_excel_contract' | 'lisc_encuadre';
  parametros: Record<string, any>;
  activa: boolean;
  clientRequestId?: string;
  archivadaEn?: string;
  actorDocenteId?: string;
};

function idPolitica(docenteId: string, codigo: string, version: number): string {
  const bytes = createHash('sha256').update(`${docenteId}\0${codigo}\0${version}`).digest('hex').slice(0, 32).split('');
  bytes[12] = '5';
  bytes[16] = ((Number.parseInt(bytes[16], 16) & 0x3) | 0x8).toString(16);
  const hex = bytes.join('');
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

function leerDefinicionPolitica(registro: PoliticaPersistida): DefinicionPolitica {
  try {
    return JSON.parse(registro.configuracion) as DefinicionPolitica;
  } catch {
    throw new ErrorAplicacion('POLITICA_INVALIDA', 'La configuración almacenada de la política no es válida', 500);
  }
}

function serializarPolitica(registro: PoliticaPersistida) {
  return { id: registro.id, ...leerDefinicionPolitica(registro), creadaEn: registro.createdAt, actualizadaEn: registro.updatedAt };
}

function parametrosPredeterminados(familia: DefinicionPolitica['familia'], recibidos: Record<string, any> = {}) {
  return familia === 'lisc_encuadre'
    ? {
        pesosGlobales: { continua: 0.5, examenes: 0.5, ...recibidos.pesosGlobales },
        pesosExamenes: { parcial1: 0.2, parcial2: 0.2, global: 0.6, ...recibidos.pesosExamenes },
        pesosContinuaCortes: { c1: 0.2, c2: 0.2, c3: 0.6, ...recibidos.pesosContinuaCortes },
        pesosComponentesExamen: { teorico: 0.6, practicas: 0.4, ...recibidos.pesosComponentesExamen },
        umbralAprobacion: recibidos.umbralAprobacion ?? 6
      }
    : { pesosExamen: { global: 0.6, parciales: 0.4, ...recibidos.pesosExamen } };
}

function jsonCanonico(valor: unknown): string {
  if (Array.isArray(valor)) return `[${valor.map(jsonCanonico).join(',')}]`;
  if (valor && typeof valor === 'object') {
    const entradas = Object.entries(valor as Record<string, unknown>).sort(([a], [b]) => a.localeCompare(b));
    return `{${entradas.map(([clave, item]) => `${JSON.stringify(clave)}:${jsonCanonico(item)}`).join(',')}}`;
  }
  return JSON.stringify(valor);
}

function jsonPersistidoCoincide(persistido: string | null, valor: unknown): boolean {
  if (persistido === null || valor === null || valor === undefined) return persistido === null && (valor === null || valor === undefined);
  try { return jsonCanonico(JSON.parse(persistido)) === jsonCanonico(valor); } catch { return false; }
}

const CORTES_DEFAULT = [
  { numero: 1, nombre: 'Primer parcial', pesoContinua: 0.5, pesoExamen: 0.5, pesoBloqueExamenes: 0.2 },
  { numero: 2, nombre: 'Segundo parcial', pesoContinua: 0.5, pesoExamen: 0.5, pesoBloqueExamenes: 0.2 },
  { numero: 3, nombre: 'Global', pesoContinua: 0.5, pesoExamen: 0.5, pesoBloqueExamenes: 0.6 }
];
const CORTES_EXAMEN = ['parcial1', 'parcial2', 'global'] as const;
type CorteExamen = (typeof CORTES_EXAMEN)[number];
type EstadoComponentesExamen = Record<
  CorteExamen,
  { presente: boolean; teoricoCapturado: boolean; practicasCapturadas: number }
>;

function esCorteExamen(valor: string): valor is CorteExamen {
  return CORTES_EXAMEN.includes(valor as CorteExamen);
}

function mapearConfiguracionPrismaALean(config: any) {
  if (!config) return null;
  return {
    ...config,
    cortes: config.cortes ? JSON.parse(config.cortes) : [],
    pesosGlobales: config.pesosGlobales ? JSON.parse(config.pesosGlobales) : {},
    pesosExamenes: config.pesosExamenes ? JSON.parse(config.pesosExamenes) : {},
    reglasCierre: config.reglasCierre ? JSON.parse(config.reglasCierre) : {}
  };
}


function numeroSeguro(valor: unknown): number {
  const n = Number(valor);
  return Number.isFinite(n) ? n : 0;
}

function round4(value: number): number {
  return Number(Number(value || 0).toFixed(4));
}

function parseFecha(valor: unknown): Date | null {
  const f = valor ? new Date(String(valor)) : null;
  return f && Number.isFinite(f.getTime()) ? f : null;
}

function evidenciaCuentaEnPromedio(evidencia: Record<string, unknown>): boolean {
  const fuente = String(evidencia.fuente ?? 'manual').trim().toLowerCase();
  const estadoCaptura = String(evidencia.estadoCaptura ?? 'calificada').trim().toLowerCase();
  if (fuente === 'classroom' && estadoCaptura !== 'calificada') {
    return false;
  }
  return Number.isFinite(Number(evidencia.calificacionDecimal));
}

function configDefaultLisc(docenteId: string, periodoId: string) {
  return {
    docenteId,
    periodoId,
    politicaCodigo: 'POLICY_LISC_ENCUADRE_2026',
    politicaVersion: 1,
    cortes: CORTES_DEFAULT.map((corte, idx) => ({
      ...corte,
      fechaCorte: new Date(Date.UTC(new Date().getUTCFullYear(), idx + 1, 1))
    })),
    pesosGlobales: { continua: 0.5, examenes: 0.5 },
    pesosExamenes: { parcial1: 0.2, parcial2: 0.2, global: 0.6 },
    reglasCierre: {
      requiereTeorico: true,
      requierePractica: true,
      requiereContinuaMinima: false,
      continuaMinima: 0
    },
    activo: true
  };
}

function determinarContinuaPorCortes(params: {
  evidencias: Array<{ fechaEvidencia?: unknown; corte?: unknown; calificacionDecimal?: unknown; ponderacion?: unknown }>;
  cortesConfig: Array<{ numero?: unknown; fechaCorte?: unknown }>;
}) {
  const evidencias = Array.isArray(params.evidencias) ? params.evidencias : [];
  const cortesConfig = (Array.isArray(params.cortesConfig) ? params.cortesConfig : [])
    .map((c) => ({ numero: Number(c.numero), fechaCorte: parseFecha(c.fechaCorte) }))
    .filter((c) => Number.isInteger(c.numero) && c.numero >= 1 && c.numero <= 3)
    .sort((a, b) => Number(a.numero) - Number(b.numero));

  const out = { c1: 0, c2: 0, c3: 0 };

  if (cortesConfig.length > 0 && cortesConfig.every((c) => Boolean(c.fechaCorte))) {
    for (const corte of cortesConfig) {
      const fechaLimite = corte.fechaCorte as Date;
      const lista = evidencias
        .filter((item) => evidenciaCuentaEnPromedio(item as Record<string, unknown>))
        .map((item) => ({
          fecha: parseFecha(item.fechaEvidencia) ?? new Date(0),
          valor: numeroSeguro(item.calificacionDecimal),
          peso: numeroSeguro(item.ponderacion || 1),
          corteExplicito: Number(item.corte)
        }))
        .filter((item) => {
          const tieneCorteExplicito = Number.isInteger(item.corteExplicito) && item.corteExplicito >= 1 && item.corteExplicito <= 3;
          return tieneCorteExplicito
            ? item.corteExplicito === corte.numero
            : item.fecha.getTime() <= fechaLimite.getTime();
        });
      const promedio = promedioPonderado(lista.map((item) => ({ valor: item.valor, peso: item.peso })));
      if (corte.numero === 1) out.c1 = round4(promedio);
      if (corte.numero === 2) out.c2 = round4(promedio);
      if (corte.numero === 3) out.c3 = round4(promedio);
    }
    return out;
  }

  // Fallback por etiqueta de corte explícita
  const porCorte = (numero: number) => {
    const lista = evidencias
      .filter((item) => evidenciaCuentaEnPromedio(item as Record<string, unknown>))
      .filter((item) => Number(item.corte) === numero)
      .map((item) => ({ valor: numeroSeguro(item.calificacionDecimal), peso: numeroSeguro(item.ponderacion || 1) }));
    return round4(promedioPonderado(lista));
  };

  out.c1 = porCorte(1);
  out.c2 = porCorte(2);
  out.c3 = porCorte(3);
  return out;
}

function determinarExamenesPorCorte(
  componentes: Array<{ corte?: unknown; examenCorteDecimal?: unknown; teoricoDecimal?: unknown; practicas?: unknown }>,
  pesosComponentes: { teorico?: number; practicas?: number } = {}
): {
  examenesPorCorte: { parcial1: number; parcial2: number; global: number };
  estadoComponentes: EstadoComponentesExamen;
} {
  const examenesPorCorte = { parcial1: 0, parcial2: 0, global: 0 };
  const estadoComponentes: EstadoComponentesExamen = {
    parcial1: { presente: false, teoricoCapturado: false, practicasCapturadas: 0 },
    parcial2: { presente: false, teoricoCapturado: false, practicasCapturadas: 0 },
    global: { presente: false, teoricoCapturado: false, practicasCapturadas: 0 }
  };

  for (const item of Array.isArray(componentes) ? componentes : []) {
    const corte = String(item.corte || '').trim().toLowerCase();
    if (!esCorteExamen(corte)) continue;
    const practicas = Array.isArray(item.practicas)
      ? item.practicas.map((valor) => Number(valor)).filter((valor) => Number.isFinite(valor))
      : [];

    const teorico = Number(item.teoricoDecimal);
    examenesPorCorte[corte] = round4(Number.isFinite(teorico)
      ? calcularExamenCorte(teorico, practicas, pesosComponentes)
      : numeroSeguro(item.examenCorteDecimal));
    estadoComponentes[corte] = {
      presente: true,
      teoricoCapturado: Number.isFinite(Number(item.teoricoDecimal)),
      practicasCapturadas: practicas.length
    };
  }
  return { examenesPorCorte, estadoComponentes };
}

function faltantesLisc(params: {
  config: Record<string, unknown> | null;
  continuaPorCorte: { c1: number; c2: number; c3: number };
  estadoComponentes: EstadoComponentesExamen;
}) {
  const faltantes: string[] = [];
  const reglas = ((params.config?.reglasCierre ?? {}) as Record<string, unknown>) || {};
  const requiereTeorico = reglas.requiereTeorico !== false;
  const requierePractica = reglas.requierePractica !== false;
  const requiereComponente = requiereTeorico || requierePractica;

  for (const corte of CORTES_EXAMEN) {
    const estado = params.estadoComponentes[corte];
    if (requiereComponente && !estado.presente) {
      faltantes.push(`examen.${corte}.componente`);
      continue;
    }
    if (requiereTeorico && estado.presente && !estado.teoricoCapturado) {
      faltantes.push(`examen.${corte}.teorico`);
    }
    if (requierePractica && estado.presente && estado.practicasCapturadas <= 0) {
      faltantes.push(`examen.${corte}.practica`);
    }
  }

  if (reglas.requiereContinuaMinima === true) {
    const minima = numeroSeguro(reglas.continuaMinima);
    if (numeroSeguro(params.continuaPorCorte.c1) < minima) faltantes.push('continua.c1.minima');
    if (numeroSeguro(params.continuaPorCorte.c2) < minima) faltantes.push('continua.c2.minima');
    if (numeroSeguro(params.continuaPorCorte.c3) < minima) faltantes.push('continua.c3.minima');
  }

  return faltantes;
}

async function calcularResumenLisc(docenteId: string, periodoId: string, alumnoId: string) {
  const configRaw = await prisma.configuracionPeriodoEvaluacion.findUnique({
    where: {
      docenteId_periodoId: {
        docenteId,
        periodoId
      }
    }
  });

  const config = mapearConfiguracionPrismaALean(configRaw) ?? configDefaultLisc(docenteId, periodoId);
  const codigo = String(config.politicaCodigo ?? 'POLICY_LISC_ENCUADRE_2026');
  const version = numeroSeguro(config.politicaVersion) || 1;
  const politica = await obtenerDefinicionPolitica(docenteId, codigo, version);
  const parametros = parametrosPredeterminados('lisc_encuadre', politica.parametros);

  const [evidenciasRaw, componentesRaw] = await Promise.all([
    prisma.evidenciaEvaluacion.findMany({
      where: { docenteId, periodoId, alumnoId, archivadaEn: null }
    }),
    prisma.componenteExamen.findMany({
      where: { docenteId, periodoId, alumnoId }
    })
  ]);

  const evidencias = evidenciasRaw.map((ev) => ({
    ...ev,
    classroom: ev.classroomData ? JSON.parse(ev.classroomData) : null,
    classroomData: ev.classroomData ? JSON.parse(ev.classroomData) : null,
    metadata: ev.metadata ? JSON.parse(ev.metadata) : null
  }));

  const componentes = componentesRaw.map((comp) => ({
    ...comp,
    practicas: comp.practicas ? JSON.parse(comp.practicas) : [],
    metadata: comp.metadata ? JSON.parse(comp.metadata) : null
  }));

  const continuaPorCorte = determinarContinuaPorCortes({
    evidencias,
    cortesConfig: (config.cortes ?? []) as Array<Record<string, unknown>>
  });
  const { examenesPorCorte, estadoComponentes } = determinarExamenesPorCorte(
    componentes as Array<Record<string, unknown>>,
    parametros.pesosComponentesExamen
  );

  const calculo = calcularPoliticaLisc({
    continuaPorCorte,
    examenesPorCorte,
    pesosGlobales: (config.pesosGlobales ?? {}) as { continua?: number; examenes?: number },
    pesosExamenes: (config.pesosExamenes ?? {}) as { parcial1?: number; parcial2?: number; global?: number },
    pesosContinuaCortes: parametros.pesosContinuaCortes,
    umbralAprobacion: parametros.umbralAprobacion
  });

  // Regla de Asistencia CUH: 4 o más faltas pierde derecho a examen
  const faltasCount = await prisma.asistenciaRegistro.count({
    where: {
      periodoId,
      alumnoId,
      estado: 'F'
    }
  });
  const sinDerecho = faltasCount >= 4;

  let finalDecimal = calculo.finalDecimal;
  let finalRedondeada = calculo.finalRedondeada;
  let bloqueExamenesDecimal = calculo.bloqueExamenesDecimal;
  let examenesPorCorteFinal = { ...calculo.examenesPorCorte };

  if (sinDerecho) {
    bloqueExamenesDecimal = 0;
    examenesPorCorteFinal = { parcial1: 0, parcial2: 0, global: 0 };
    // Recalcular nota final: bloqueContinua * pesoContinua + 0
    const pesoContinua = Number(config.pesosGlobales?.continua ?? 0.5);
    finalDecimal = Number((calculo.bloqueContinuaDecimal * pesoContinua).toFixed(4));
    // Importamos redondearFinalInstitucional para asegurar consistencia
    const { redondearFinalInstitucional } = await import('./servicioPoliticasCalificacion.js');
    finalRedondeada = redondearFinalInstitucional(finalDecimal, parametros.umbralAprobacion);
  }

  const faltantes = faltantesLisc({
    config: config as Record<string, unknown>,
    continuaPorCorte,
    estadoComponentes
  });
  const estado = faltantes.length === 0 ? 'completo' : 'incompleto';

  const resumen = {
    docenteId,
    periodoId,
    alumnoId,
    politicaCodigo: codigo,
    politicaVersion: version,
    continuaPorCorte: calculo.continuaPorCorte,
    examenesPorCorte: examenesPorCorteFinal,
    bloqueContinuaDecimal: calculo.bloqueContinuaDecimal,
    bloqueExamenesDecimal: bloqueExamenesDecimal,
    finalDecimal,
    finalRedondeada,
    estado,
    faltantes,
    sinDerecho,
    faltas: faltasCount,
    auditoria: {
      politicaId: politica.id ?? null,
      politicaCodigo: codigo,
      politicaVersion: version,
      reglas: config.reglasCierre ?? {},
      pesosGlobales: config.pesosGlobales ?? {},
      pesosExamenes: config.pesosExamenes ?? {},
      parametros: politica.parametros,
      formulas: {
        examenCorte: `${parametros.pesosComponentesExamen.teorico}*teorico + ${parametros.pesosComponentesExamen.practicas}*promedio(practicas)`,
        bloqueExamenes: `${parametros.pesosExamenes.parcial1}*parcial1 + ${parametros.pesosExamenes.parcial2}*parcial2 + ${parametros.pesosExamenes.global}*global`,
        bloqueContinua: `${parametros.pesosContinuaCortes.c1}*c1 + ${parametros.pesosContinuaCortes.c2}*c2 + ${parametros.pesosContinuaCortes.c3}*c3`,
        final: `${config.pesosGlobales?.continua}*bloqueContinua + ${config.pesosGlobales?.examenes}*bloqueExamenes`,
        redondeoFinal: `si <${parametros.umbralAprobacion} floor, si >=${parametros.umbralAprobacion} round half-up`
      }
    },
    calculadoEn: new Date()
  };

  const dbData = {
    docenteId,
    periodoId,
    alumnoId,
    politicaCodigo: resumen.politicaCodigo,
    politicaVersion: resumen.politicaVersion,
    continuaPorCorte: JSON.stringify(resumen.continuaPorCorte),
    examenesPorCorte: JSON.stringify(resumen.examenesPorCorte),
    bloqueContinuaDecimal: resumen.bloqueContinuaDecimal,
    bloqueExamenesDecimal: resumen.bloqueExamenesDecimal,
    finalDecimal: resumen.finalDecimal,
    finalRedondeada: resumen.finalRedondeada,
    estado: resumen.estado,
    faltantes: JSON.stringify(resumen.faltantes),
    auditoria: JSON.stringify(resumen.auditoria),
    calculadoEn: resumen.calculadoEn
  };

  await prisma.resumenEvaluacionAlumno.upsert({
    where: {
      docenteId_periodoId_alumnoId: {
        docenteId,
        periodoId,
        alumnoId
      }
    },
    update: dbData,
    create: dbData
  });

  return resumen;
}

async function calcularResumenSv(docenteId: string, periodoId: string, alumnoId: string, politica: DefinicionPolitica & { id?: string }) {
  const calificaciones = await prisma.calificacion.findMany({
    where: { docenteId, periodoId, alumnoId },
    orderBy: { createdAt: 'asc' }
  });
  const parciales = calificaciones.filter((item) => item.tipoExamen === 'parcial');
  const global = calificaciones.find((item) => item.tipoExamen === 'global');

  const parcial1 = numeroSeguro(parciales[0]?.calificacionParcialTexto);
  const parcial2 = numeroSeguro(parciales[1]?.calificacionParcialTexto);
  const globalNota = numeroSeguro(global?.calificacionGlobalTexto);

  const parametros = parametrosPredeterminados('sv_excel_contract', politica.parametros);
  const bloqueExamenesDecimal = round4(globalNota * parametros.pesosExamen.global + ((parcial1 + parcial2) / 2) * parametros.pesosExamen.parciales);
  const finalDecimal = round4(bloqueExamenesDecimal);
  const finalRedondeada = redondearFinalInstitucional(finalDecimal);

  const resumen = {
    docenteId,
    periodoId,
    alumnoId,
    politicaCodigo: politica.codigo,
    politicaVersion: politica.version,
    continuaPorCorte: {
      c1: numeroSeguro(parciales[0]?.evaluacionContinuaTexto),
      c2: numeroSeguro(parciales[1]?.evaluacionContinuaTexto),
      c3: numeroSeguro(global?.proyectoTexto)
    },
    examenesPorCorte: {
      parcial1,
      parcial2,
      global: globalNota
    },
    bloqueContinuaDecimal: 0,
    bloqueExamenesDecimal,
    finalDecimal,
    finalRedondeada,
    estado: 'completo',
    faltantes: [] as string[],
    auditoria: {
      politicaId: politica.id ?? null,
      politicaCodigo: politica.codigo,
      politicaVersion: politica.version,
      parametros: politica.parametros,
      formula: `${parametros.pesosExamen.global}*global + ${parametros.pesosExamen.parciales}*promedio(parciales)`,
      fuente: 'sv_excel_legacy'
    },
    calculadoEn: new Date()
  };

  const dbData = {
    docenteId,
    periodoId,
    alumnoId,
    politicaCodigo: resumen.politicaCodigo,
    politicaVersion: resumen.politicaVersion,
    continuaPorCorte: JSON.stringify(resumen.continuaPorCorte),
    examenesPorCorte: JSON.stringify(resumen.examenesPorCorte),
    bloqueContinuaDecimal: resumen.bloqueContinuaDecimal,
    bloqueExamenesDecimal: resumen.bloqueExamenesDecimal,
    finalDecimal: resumen.finalDecimal,
    finalRedondeada: resumen.finalRedondeada,
    estado: resumen.estado,
    faltantes: JSON.stringify(resumen.faltantes),
    auditoria: JSON.stringify(resumen.auditoria),
    calculadoEn: resumen.calculadoEn
  };

  await prisma.resumenEvaluacionAlumno.upsert({
    where: {
      docenteId_periodoId_alumnoId: {
        docenteId,
        periodoId,
        alumnoId
      }
    },
    update: dbData,
    create: dbData
  });

  return resumen;
}

const CODIGOS_SISTEMA = new Set(POLITICAS_BASE.map((politica) => politica.codigo));

async function listarPoliticasDocente(docenteId: string): Promise<PoliticaPersistida[]> {
  return prisma.politicaCalificacion.findMany({ where: { docenteId }, orderBy: [{ createdAt: 'asc' }, { id: 'asc' }] });
}

async function obtenerDefinicionPolitica(
  docenteId: string,
  codigo: string,
  version: number
): Promise<DefinicionPolitica & { id?: string }> {
  const base = POLITICAS_BASE.find((item) => item.codigo === codigo && item.version === version);
  if (base) return { ...base, activa: true };
  const registro = await prisma.politicaCalificacion.findUnique({ where: { id: idPolitica(docenteId, codigo, version) } });
  if (!registro || registro.docenteId !== docenteId) {
    throw new ErrorAplicacion('POLITICA_NO_ENCONTRADA', 'No existe esa versión de política para el docente', 404);
  }
  const definicion = leerDefinicionPolitica(registro);
  if (definicion.codigo !== codigo || definicion.version !== version) {
    throw new ErrorAplicacion('POLITICA_INVALIDA', 'La identidad de la versión de política no coincide', 500);
  }
  return { ...definicion, id: registro.id };
}

async function validarPoliticaAsignable(docenteId: string, codigo: string, version: number) {
  if (CODIGOS_SISTEMA.has(codigo)) {
    if (version !== 1) throw new ErrorAplicacion('POLITICA_NO_ENCONTRADA', 'La versión de política de sistema no existe', 404);
    return obtenerDefinicionPolitica(docenteId, codigo, version);
  }
  const registros = (await listarPoliticasDocente(docenteId))
    .map((registro) => ({ registro, definicion: leerDefinicionPolitica(registro) }))
    .filter((item) => item.definicion.codigo === codigo)
    .sort((a, b) => b.definicion.version - a.definicion.version);
  const actual = registros[0];
  if (!actual || actual.definicion.version !== version || !actual.definicion.activa) {
    throw new ErrorAplicacion('POLITICA_NO_ASIGNABLE', 'Solo se puede asignar la versión activa más reciente de una política propia', 409);
  }
  return { ...actual.definicion, id: actual.registro.id };
}

export async function listarPoliticasCalificacion(req: SolicitudDocente, res: Response) {
  const docenteId = obtenerDocenteId(req);
  const registros = await listarPoliticasDocente(docenteId);
  const porCodigo = new Map<string, PoliticaPersistida[]>();
  for (const registro of registros) {
    const definicion = leerDefinicionPolitica(registro);
    const anteriores = porCodigo.get(definicion.codigo) ?? [];
    anteriores.push(registro);
    porCodigo.set(definicion.codigo, anteriores);
  }
  const todasPropias = [...porCodigo.values()].flat().map((registro) => serializarPolitica(registro));
  const propias = [...porCodigo.values()].map((versiones) => {
    const latest = versiones.map((registro) => ({ registro, definicion: leerDefinicionPolitica(registro) }))
      .sort((a, b) => b.definicion.version - a.definicion.version)[0];
    return serializarPolitica(latest.registro);
  }).filter((politica) => req.query.incluirArchivadas === 'true' || politica.activa);
  const propiasRespuesta = req.query.incluirVersiones === 'true'
    ? todasPropias.filter((politica) => req.query.incluirArchivadas === 'true' || politica.activa)
    : propias;
  res.json({ politicas: [...POLITICAS_BASE.map((p) => ({ ...p, activa: true, sistema: true })), ...propiasRespuesta] });
}

export async function obtenerPoliticaCalificacion(req: SolicitudDocente, res: Response) {
  const version = req.query.version === undefined ? 1 : Number(req.query.version);
  if (!Number.isInteger(version) || version < 1) throw new ErrorAplicacion('DATOS_INVALIDOS', 'version debe ser un entero positivo', 400);
  const politica = await obtenerDefinicionPolitica(
    obtenerDocenteId(req),
    String(req.params.codigo),
    version
  );
  res.json({ politica });
}

export async function obtenerContextoEvaluacionesV2(req: SolicitudDocente, res: Response) {
  const docenteId = obtenerDocenteId(req);
  const periodoId = String(req.query.periodoId ?? '').trim();

  const configRaw = periodoId
    ? await prisma.configuracionPeriodoEvaluacion.findUnique({
        where: {
          docenteId_periodoId: {
            docenteId,
            periodoId
          }
        }
      })
    : null;

  const configuracion = mapearConfiguracionPrismaALean(configRaw);

  const listado = await listarPoliticasDocente(docenteId);
  const politicasPorCodigo = new Map<string, PoliticaPersistida>();
  for (const registro of listado) {
    const definicion = leerDefinicionPolitica(registro);
    const actual = politicasPorCodigo.get(definicion.codigo);
    if (!actual || leerDefinicionPolitica(actual).version < definicion.version) politicasPorCodigo.set(definicion.codigo, registro);
  }
  const politicasPropias = [...politicasPorCodigo.values()].map(serializarPolitica).filter((politica) => politica.activa);
  res.json({
    politicas: [...POLITICAS_BASE.map((p) => ({ ...p, activa: true, sistema: true })), ...politicasPropias],
    configuracion: configuracion ?? null
  });
}

export async function crearPoliticaCalificacion(req: SolicitudDocente, res: Response) {
  const docenteId = obtenerDocenteId(req);
  const payload = esquemaCrearPolitica.parse(req.body);
  if (req.method === 'PUT' && String(req.params.codigo) !== payload.codigo) {
    throw new ErrorAplicacion('CODIGO_POLITICA_NO_COINCIDE', 'El código de la ruta y del cuerpo debe coincidir', 400);
  }
  if (CODIGOS_SISTEMA.has(payload.codigo)) {
    throw new ErrorAplicacion('CODIGO_POLITICA_RESERVADO', 'Los códigos de políticas de sistema están reservados', 409);
  }
  const registros = await listarPoliticasDocente(docenteId);
  const versiones = registros.map((registro) => leerDefinicionPolitica(registro)).filter((item) => item.codigo === payload.codigo);
  const anterior = versiones.sort((a, b) => b.version - a.version)[0];
  const esVersionado = req.method === 'PUT';
  if (payload.clientRequestId) {
    const repetida = registros.find((registro) => leerDefinicionPolitica(registro).clientRequestId === payload.clientRequestId);
    if (repetida) {
      const existente = leerDefinicionPolitica(repetida);
      const esperada = {
        codigo: payload.codigo,
        nombre: payload.nombre,
        descripcion: payload.descripcion ?? '',
        familia: payload.familia,
        parametros: parametrosPredeterminados(payload.familia, payload.parametros as Record<string, any> | undefined),
        activa: true,
        version: existente.version
      };
      const recibida = {
        codigo: existente.codigo,
        nombre: existente.nombre,
        descripcion: existente.descripcion,
        familia: existente.familia,
        parametros: existente.parametros,
        activa: existente.activa,
        version: existente.version
      };
      if (jsonCanonico(esperada) !== jsonCanonico(recibida)) {
        throw new ErrorAplicacion('IDEMPOTENCIA_CONFLICTO', 'clientRequestId ya fue usado con otro contenido', 409);
      }
      res.json({ politica: serializarPolitica(repetida) });
      return;
    }
  }
  if (esVersionado && !anterior) throw new ErrorAplicacion('POLITICA_NO_ENCONTRADA', 'No existe la política que se intenta versionar', 404);
  if (!esVersionado && anterior) throw new ErrorAplicacion('POLITICA_YA_EXISTE', 'El código ya existe; use PUT para crear una nueva versión', 409);
  if (anterior && anterior.familia !== payload.familia) {
    throw new ErrorAplicacion('FAMILIA_POLITICA_INMUTABLE', 'La familia de cálculo no puede cambiar entre versiones', 409);
  }
  const version = (anterior?.version ?? 0) + 1;
  const parametros = parametrosPredeterminados(payload.familia, payload.parametros as Record<string, any> | undefined);
  const definicion: DefinicionPolitica & { clientRequestId?: string } = {
    codigo: payload.codigo,
    version,
    nombre: payload.nombre,
    descripcion: payload.descripcion ?? '',
    familia: payload.familia,
    parametros,
    activa: true,
    actorDocenteId: docenteId,
    ...(payload.clientRequestId ? { clientRequestId: payload.clientRequestId } : {})
  };
  const id = idPolitica(docenteId, payload.codigo, version);
  const configuracion = JSON.stringify(definicion);
  try {
    const registro = await prisma.politicaCalificacion.create({
      data: { id, docenteId, nombre: payload.nombre, configuracion }
    });
    res.status(201).json({ politica: serializarPolitica(registro) });
  } catch (error) {
    if ((error as { code?: string })?.code !== 'P2002') throw error;
    const existente = await prisma.politicaCalificacion.findUnique({ where: { id } });
    if (!existente || existente.configuracion !== configuracion) {
      throw new ErrorAplicacion('POLITICA_VERSION_CONFLICTO', 'La versión ya existe con contenido distinto', 409);
    }
    res.json({ politica: serializarPolitica(existente) });
  }
}

export async function archivarPoliticaCalificacion(req: SolicitudDocente, res: Response) {
  const docenteId = obtenerDocenteId(req);
  const codigo = String(req.params.codigo);
  if (CODIGOS_SISTEMA.has(codigo)) throw new ErrorAplicacion('POLITICA_SISTEMA_INMUTABLE', 'No se pueden archivar políticas de sistema', 409);
  const registros = await listarPoliticasDocente(docenteId);
  const versiones = registros.map((registro) => ({ registro, definicion: leerDefinicionPolitica(registro) }))
    .filter((item) => item.definicion.codigo === codigo)
    .sort((a, b) => b.definicion.version - a.definicion.version);
  const actual = versiones[0];
  if (!actual) throw new ErrorAplicacion('POLITICA_NO_ENCONTRADA', 'No existe esa política para el docente', 404);
  if (!actual.definicion.activa) {
    res.json({ politica: serializarPolitica(actual.registro) });
    return;
  }
  const version = actual.definicion.version + 1;
  const definicionAnterior = { ...actual.definicion };
  delete definicionAnterior.clientRequestId;
  const definicion = {
    ...definicionAnterior,
    version,
    activa: false,
    actorDocenteId: docenteId,
    archivadaEn: new Date().toISOString()
  };
  const id = idPolitica(docenteId, codigo, version);
  const registro = await prisma.politicaCalificacion.create({
    data: { id, docenteId, nombre: definicion.nombre, configuracion: JSON.stringify(definicion) }
  });
  res.json({ politica: serializarPolitica(registro) });
}

export async function obtenerConfiguracionPeriodo(req: SolicitudDocente, res: Response) {
  const docenteId = obtenerDocenteId(req);
  const periodoId = String(req.query.periodoId ?? '').trim();
  if (!periodoId) {
    throw new ErrorAplicacion('DATOS_INVALIDOS', 'periodoId requerido', 400);
  }

  const configRaw = await prisma.configuracionPeriodoEvaluacion.findUnique({
    where: {
      docenteId_periodoId: {
        docenteId,
        periodoId
      }
    }
  });
  const config = mapearConfiguracionPrismaALean(configRaw);
  res.json({ configuracion: config ?? null });
}

export async function guardarConfiguracionPeriodo(req: SolicitudDocente, res: Response) {
  const docenteId = obtenerDocenteId(req);
  const payload = req.body as Record<string, unknown>;
  const periodoId = String(payload.periodoId ?? '').trim();
  if (!periodoId) {
    throw new ErrorAplicacion('DATOS_INVALIDOS', 'periodoId requerido', 400);
  }
  const periodo = await prisma.periodo.findFirst({ where: { id: periodoId, docenteId } });
  if (!periodo) throw new ErrorAplicacion('PERIODO_NO_ENCONTRADO', 'El periodo no pertenece al docente', 404);

  const politicaCodigo = String(payload.politicaCodigo ?? '').trim();
  const politicaVersion = numeroSeguro(payload.politicaVersion) || 1;
  const politica = await validarPoliticaAsignable(docenteId, politicaCodigo, politicaVersion);

  const cortesPayload = Array.isArray(payload.cortes) ? payload.cortes : [];
  const cortesNormalizados = cortesPayload.map((item) => {
    const corte = item as Record<string, unknown>;
    return {
      numero: numeroSeguro(corte.numero),
      nombre: String(corte.nombre ?? '').trim() || undefined,
      fechaCorte: new Date(String(corte.fechaCorte)),
      pesoContinua: Number(corte.pesoContinua ?? 0.5),
      pesoExamen: Number(corte.pesoExamen ?? 0.5),
      pesoBloqueExamenes: Number(corte.pesoBloqueExamenes ?? 0)
    };
  });

  const defaultCortes = configDefaultLisc(docenteId, periodoId).cortes;

  const update = {
    docenteId,
    periodoId,
    politicaCodigo,
    politicaVersion,
    cortes: JSON.stringify(cortesNormalizados.length > 0 ? cortesNormalizados : defaultCortes),
    pesosGlobales: JSON.stringify(payload.pesosGlobales ?? politica.parametros.pesosGlobales ?? { continua: 0.5, examenes: 0.5 }),
    pesosExamenes: JSON.stringify(payload.pesosExamenes ?? politica.parametros.pesosExamenes ?? { parcial1: 0.2, parcial2: 0.2, global: 0.6 }),
    reglasCierre: JSON.stringify(
      payload.reglasCierre ?? {
        requiereTeorico: true,
        requierePractica: true,
        requiereContinuaMinima: false,
        continuaMinima: 0
      }
    ),
    activo: payload.activo === false ? false : true
  };

  const configuracionRaw = await prisma.configuracionPeriodoEvaluacion.upsert({
    where: {
      docenteId_periodoId: {
        docenteId,
        periodoId
      }
    },
    update,
    create: update
  });

  const configuracion = mapearConfiguracionPrismaALean(configuracionRaw);

  res.json({ configuracion });
}

export async function listarEvidenciasEvaluacion(req: SolicitudDocente, res: Response) {
  const docenteId = obtenerDocenteId(req);
  const filtros = res.locals.validatedQuery ?? esquemaListarEvidenciasEvaluacion.parse(req.query);
  let cursor: { id: string; fechaEvidencia: Date; createdAt: Date } | undefined;
  if (filtros.cursor) {
    try {
      const decoded = JSON.parse(Buffer.from(filtros.cursor, 'base64url').toString('utf8')) as {
        id?: unknown; fechaEvidencia?: unknown; createdAt?: unknown;
      };
      const fechaEvidencia = new Date(String(decoded.fechaEvidencia ?? ''));
      const createdAt = new Date(String(decoded.createdAt ?? ''));
      if (typeof decoded.id !== 'string' || !/^[A-Za-z0-9_-]{1,100}$/.test(decoded.id)
        || !Number.isFinite(fechaEvidencia.getTime()) || !Number.isFinite(createdAt.getTime())) throw new Error('invalid cursor');
      cursor = { id: decoded.id, fechaEvidencia, createdAt };
    } catch {
      throw new ErrorAplicacion('EVIDENCIA_CURSOR_INVALIDO', 'El cursor de evidencias no es válido', 400);
    }
  }

  const evidenciasRaw = await prisma.evidenciaEvaluacion.findMany({
    where: {
      docenteId,
      ...(filtros.incluirArchivadas ? {} : { archivadaEn: null }),
      ...(filtros.periodoId ? { periodoId: filtros.periodoId } : {}),
      ...(filtros.alumnoId ? { alumnoId: filtros.alumnoId } : {}),
      ...(cursor ? { OR: [
        { fechaEvidencia: { lt: cursor.fechaEvidencia } },
        { fechaEvidencia: cursor.fechaEvidencia, createdAt: { lt: cursor.createdAt } },
        { fechaEvidencia: cursor.fechaEvidencia, createdAt: cursor.createdAt, id: { lt: cursor.id } }
      ] } : {})
    },
    orderBy: [
      { fechaEvidencia: 'desc' },
      { createdAt: 'desc' },
      { id: 'desc' }
    ],
    take: filtros.limite + 1
  });
  const hayMas = evidenciasRaw.length > filtros.limite;
  const pagina = evidenciasRaw.slice(0, filtros.limite);

  const evidencias = pagina.map((ev) => {
    const classroom = ev.classroomData ? JSON.parse(ev.classroomData) : null;
    const metadata = ev.metadata ? JSON.parse(ev.metadata) : null;
    const auditoriaCambios = ev.auditoriaCambios ? JSON.parse(ev.auditoriaCambios) : [];
    return {
      ...ev,
      classroom,
      classroomData: classroom,
      metadata,
      auditoriaCambios
    };
  });

  const ultimo = hayMas ? pagina[pagina.length - 1] : undefined;
  const nextCursor = ultimo
    ? Buffer.from(JSON.stringify({
        id: ultimo.id,
        fechaEvidencia: ultimo.fechaEvidencia.toISOString(),
        createdAt: ultimo.createdAt.toISOString()
      }), 'utf8').toString('base64url')
    : null;
  res.json({ evidencias, nextCursor });
}

export async function crearEvidenciaEvaluacion(req: SolicitudDocente, res: Response) {
  const docenteId = obtenerDocenteId(req);
  const payload = req.body as Record<string, unknown>;
  const periodoId = String(payload.periodoId);
  const alumnoId = String(payload.alumnoId);
  const periodo = await prisma.periodo.findFirst({ where: { id: periodoId, docenteId } });
  const alumno = await prisma.alumno.findFirst({
    where: { id: alumnoId, periodo: { is: { id: periodoId, docenteId } } }
  });
  if (!periodo || !alumno) throw new ErrorAplicacion('RECURSO_NO_ENCONTRADO', 'El periodo o alumno no pertenece al docente', 404);

  const classroomObj = payload.classroom || payload.classroomData;
  const classroomDataStr = classroomObj ? JSON.stringify(classroomObj) : null;
  const metadataStr = payload.metadata ? JSON.stringify(payload.metadata) : null;
  const idSolicitud = typeof payload.clientRequestId === 'string' ? payload.clientRequestId : undefined;
  const fechaEvidencia = payload.fechaEvidencia ? new Date(String(payload.fechaEvidencia)) : new Date();
  const coincideSolicitud = (existente: NonNullable<Awaited<ReturnType<typeof prisma.evidenciaEvaluacion.findUnique>>>) =>
    existente.docenteId === docenteId
    && existente.periodoId === periodoId
    && existente.alumnoId === alumnoId
    && existente.titulo === String(payload.titulo)
    && existente.descripcion === (payload.descripcion ? String(payload.descripcion) : null)
    && existente.calificacionDecimal === (payload.calificacionDecimal !== undefined ? Number(payload.calificacionDecimal) : null)
    && existente.ponderacion === (payload.ponderacion !== undefined ? Number(payload.ponderacion) : 1)
    && (payload.fechaEvidencia === undefined || existente.fechaEvidencia.getTime() === fechaEvidencia.getTime())
    && existente.corte === (payload.corte !== undefined ? Number(payload.corte) : null)
    && existente.fuente === (payload.fuente ? String(payload.fuente) : 'manual')
    && existente.estadoCaptura === (payload.estadoCaptura ? String(payload.estadoCaptura) : 'calificada')
    && jsonPersistidoCoincide(existente.classroomData, classroomObj)
    && jsonPersistidoCoincide(existente.metadata, payload.metadata);
  if (idSolicitud) {
    const existente = await prisma.evidenciaEvaluacion.findUnique({ where: { id: idSolicitud } });
    if (existente) {
      if (!coincideSolicitud(existente)) throw new ErrorAplicacion('IDEMPOTENCIA_CONFLICTO', 'clientRequestId ya fue usado con otro contenido', 409);
      const classroom = existente.classroomData ? JSON.parse(existente.classroomData) : null;
      const metadata = existente.metadata ? JSON.parse(existente.metadata) : null;
      res.json({ evidencia: { ...existente, classroom, classroomData: classroom, metadata } });
      return;
    }
  }

  let evidenciaRaw;
  try {
    evidenciaRaw = await prisma.evidenciaEvaluacion.create({
      data: {
      ...(idSolicitud ? { id: idSolicitud } : {}),
      docenteId,
      auditoriaCambios: JSON.stringify([{ tipo: 'creacion', actorDocenteId: docenteId, fecha: new Date().toISOString() }]),
      periodoId,
      alumnoId,
      titulo: String(payload.titulo),
      descripcion: payload.descripcion ? String(payload.descripcion) : null,
      calificacionDecimal: payload.calificacionDecimal !== undefined ? Number(payload.calificacionDecimal) : null,
      ponderacion: payload.ponderacion !== undefined ? Number(payload.ponderacion) : 1.0,
      fechaEvidencia,
      corte: payload.corte !== undefined ? Number(payload.corte) : null,
      fuente: payload.fuente ? String(payload.fuente) : 'manual',
      estadoCaptura: payload.estadoCaptura ? String(payload.estadoCaptura) : 'calificada',
      classroomData: classroomDataStr,
        metadata: metadataStr
      }
    });
  } catch (error) {
    if ((error as { code?: string })?.code !== 'P2002' || !idSolicitud) throw error;
    const existente = await prisma.evidenciaEvaluacion.findUnique({ where: { id: idSolicitud } });
    if (!existente || !coincideSolicitud(existente)) {
      throw new ErrorAplicacion('IDEMPOTENCIA_CONFLICTO', 'clientRequestId ya fue usado con otro contenido', 409);
    }
    const classroom = existente.classroomData ? JSON.parse(existente.classroomData) : null;
    const metadata = existente.metadata ? JSON.parse(existente.metadata) : null;
    res.json({ evidencia: { ...existente, classroom, classroomData: classroom, metadata } });
    return;
  }

  const evidencia = {
    ...evidenciaRaw,
    classroom: classroomObj,
    classroomData: classroomObj,
    metadata: payload.metadata ?? null
  };

  res.status(201).json({ evidencia });
}

export async function obtenerEvidenciaEvaluacion(req: SolicitudDocente, res: Response) {
  const docenteId = obtenerDocenteId(req);
  const evidencia = await prisma.evidenciaEvaluacion.findFirst({
    where: { id: String(req.params.evidenciaId), docenteId }
  });
  if (!evidencia) throw new ErrorAplicacion('EVIDENCIA_NO_ENCONTRADA', 'No existe esa evidencia para el docente', 404);
  const classroom = evidencia.classroomData ? JSON.parse(evidencia.classroomData) : null;
  const metadata = evidencia.metadata ? JSON.parse(evidencia.metadata) : null;
  const auditoriaCambios = evidencia.auditoriaCambios ? JSON.parse(evidencia.auditoriaCambios) : [];
  res.json({ evidencia: { ...evidencia, classroom, classroomData: classroom, metadata, auditoriaCambios } });
}

export async function actualizarEvidenciaEvaluacion(req: SolicitudDocente, res: Response) {
  const docenteId = obtenerDocenteId(req);
  const evidenciaId = String(req.params.evidenciaId);
  const payload = req.body as Record<string, unknown>;
  const existente = await prisma.evidenciaEvaluacion.findFirst({ where: { id: evidenciaId, docenteId } });
  if (!existente) throw new ErrorAplicacion('EVIDENCIA_NO_ENCONTRADA', 'No existe esa evidencia para el docente', 404);
  if (existente.fuente !== 'manual') throw new ErrorAplicacion('EVIDENCIA_PROTEGIDA', 'Las evidencias Classroom se corrigen desde su flujo de sincronización', 409);
  if (existente.archivadaEn) throw new ErrorAplicacion('EVIDENCIA_ARCHIVADA', 'Restaura la evidencia antes de modificarla', 409);
  if (existente.updatedAt.toISOString() !== String(payload.expectedUpdatedAt)) {
    throw new ErrorAplicacion('CONFLICTO_CONCURRENCIA', 'La evidencia cambió; vuelve a cargarla antes de editar', 409);
  }
  const periodoId = String(payload.periodoId);
  const alumnoId = String(payload.alumnoId);
  const alumno = await prisma.alumno.findFirst({ where: { id: alumnoId, periodo: { is: { id: periodoId, docenteId } } } });
  if (!alumno) throw new ErrorAplicacion('RECURSO_NO_ENCONTRADO', 'El alumno no pertenece al periodo del docente', 404);

  const ahora = new Date();
  const auditoria = existente.auditoriaCambios ? JSON.parse(existente.auditoriaCambios) as unknown[] : [];
  auditoria.push({
    tipo: 'actualizacion', actorDocenteId: docenteId, fecha: ahora.toISOString(), motivo: String(payload.motivoCambio),
    antes: {
      periodoId: existente.periodoId, alumnoId: existente.alumnoId, titulo: existente.titulo,
      calificacionDecimal: existente.calificacionDecimal, ponderacion: existente.ponderacion,
      fechaEvidencia: existente.fechaEvidencia.toISOString(), corte: existente.corte
    },
    despues: {
      periodoId, alumnoId, titulo: String(payload.titulo), calificacionDecimal: Number(payload.calificacionDecimal),
      ponderacion: Number(payload.ponderacion ?? 1), fechaEvidencia: payload.fechaEvidencia ?? existente.fechaEvidencia.toISOString(),
      corte: payload.corte === undefined ? null : Number(payload.corte)
    }
  });
  const resultado = await prisma.evidenciaEvaluacion.updateMany({
    where: { id: evidenciaId, docenteId, updatedAt: existente.updatedAt, archivadaEn: null },
    data: {
      periodoId,
      alumnoId,
      titulo: String(payload.titulo),
      descripcion: payload.descripcion ? String(payload.descripcion) : null,
      calificacionDecimal: Number(payload.calificacionDecimal),
      ponderacion: Number(payload.ponderacion ?? 1),
      fechaEvidencia: payload.fechaEvidencia ? new Date(String(payload.fechaEvidencia)) : existente.fechaEvidencia,
      corte: payload.corte === undefined ? null : Number(payload.corte),
      metadata: payload.metadata ? JSON.stringify(payload.metadata) : null,
      auditoriaCambios: JSON.stringify(auditoria),
      updatedAt: ahora
    }
  });
  if (resultado.count !== 1) throw new ErrorAplicacion('CONFLICTO_CONCURRENCIA', 'La evidencia cambió durante la edición', 409);
  const actualizada = await prisma.evidenciaEvaluacion.findUniqueOrThrow({ where: { id: evidenciaId } });
  res.json({ evidencia: { ...actualizada, metadata: actualizada.metadata ? JSON.parse(actualizada.metadata) : null, auditoriaCambios: auditoria } });
}

export async function archivarEvidenciaEvaluacion(req: SolicitudDocente, res: Response) {
  const docenteId = obtenerDocenteId(req);
  const evidenciaId = String(req.params.evidenciaId);
  const payload = esquemaArchivarEvidencia.parse(req.body);
  const existente = await prisma.evidenciaEvaluacion.findFirst({ where: { id: evidenciaId, docenteId } });
  if (!existente) throw new ErrorAplicacion('EVIDENCIA_NO_ENCONTRADA', 'No existe esa evidencia para el docente', 404);
  if (existente.fuente !== 'manual') throw new ErrorAplicacion('EVIDENCIA_PROTEGIDA', 'No se archivan evidencias Classroom mediante CRUD genérico', 409);
  if (existente.archivadaEn) {
    res.json({ evidencia: existente });
    return;
  }
  const ahora = new Date();
  const auditoria = existente.auditoriaCambios ? JSON.parse(existente.auditoriaCambios) as unknown[] : [];
  auditoria.push({ tipo: 'archivo', actorDocenteId: docenteId, fecha: ahora.toISOString(), motivo: payload.motivo });
  const resultado = await prisma.evidenciaEvaluacion.updateMany({
    where: { id: evidenciaId, docenteId, updatedAt: existente.updatedAt, archivadaEn: null },
    data: {
      archivadaEn: ahora, archivadaPorDocenteId: docenteId, motivoArchivo: payload.motivo,
      auditoriaCambios: JSON.stringify(auditoria), updatedAt: ahora
    }
  });
  if (resultado.count !== 1) throw new ErrorAplicacion('CONFLICTO_CONCURRENCIA', 'La evidencia cambió durante el archivo', 409);
  res.json({ evidencia: await prisma.evidenciaEvaluacion.findUniqueOrThrow({ where: { id: evidenciaId } }) });
}

export async function restaurarEvidenciaEvaluacion(req: SolicitudDocente, res: Response) {
  const docenteId = obtenerDocenteId(req);
  const evidenciaId = String(req.params.evidenciaId);
  const payload = esquemaRestaurarEvidencia.parse(req.body);
  const existente = await prisma.evidenciaEvaluacion.findFirst({ where: { id: evidenciaId, docenteId } });
  if (!existente) throw new ErrorAplicacion('EVIDENCIA_NO_ENCONTRADA', 'No existe esa evidencia para el docente', 404);
  if (existente.fuente !== 'manual') throw new ErrorAplicacion('EVIDENCIA_PROTEGIDA', 'No se restauran evidencias Classroom mediante CRUD genérico', 409);
  if (!existente.archivadaEn) {
    res.json({ evidencia: existente });
    return;
  }
  const ahora = new Date();
  const auditoria = existente.auditoriaCambios ? JSON.parse(existente.auditoriaCambios) as unknown[] : [];
  auditoria.push({ tipo: 'restauracion', actorDocenteId: docenteId, fecha: ahora.toISOString(), motivo: payload.motivo });
  const resultado = await prisma.evidenciaEvaluacion.updateMany({
    where: { id: evidenciaId, docenteId, updatedAt: existente.updatedAt, archivadaEn: { not: null } },
    data: {
      archivadaEn: null, archivadaPorDocenteId: null, motivoArchivo: null,
      auditoriaCambios: JSON.stringify(auditoria), updatedAt: ahora
    }
  });
  if (resultado.count !== 1) throw new ErrorAplicacion('CONFLICTO_CONCURRENCIA', 'La evidencia cambió durante la restauración', 409);
  res.json({ evidencia: await prisma.evidenciaEvaluacion.findUniqueOrThrow({ where: { id: evidenciaId } }) });
}

export async function upsertComponenteExamen(req: SolicitudDocente, res: Response) {
  const docenteId = obtenerDocenteId(req);
  const payload = req.body as Record<string, unknown>;
  const periodoId = String(payload.periodoId);
  const alumnoId = String(payload.alumnoId);
  const periodo = await prisma.periodo.findFirst({ where: { id: periodoId, docenteId }, select: { id: true } });
  if (!periodo) throw new ErrorAplicacion('PERIODO_NO_ENCONTRADO', 'Periodo no encontrado para este docente', 404);
  const alumno = await prisma.alumno.findFirst({ where: { id: alumnoId, periodoId }, select: { id: true } });
  if (!alumno) throw new ErrorAplicacion('ALUMNO_NO_ENCONTRADO', 'El alumno no pertenece al periodo seleccionado', 404);
  const examenGeneradoId = payload.examenGeneradoId ? String(payload.examenGeneradoId) : null;
  if (examenGeneradoId) {
    const examenFuente = await prisma.examenGenerado.findFirst({
      where: {
        id: examenGeneradoId,
        docenteId,
        periodoId,
        OR: [{ alumnoId: null }, { alumnoId }]
      },
      select: { id: true }
    });
    if (!examenFuente) {
      throw new ErrorAplicacion('EXAMEN_FUENTE_INCOMPATIBLE', 'El examen fuente debe pertenecer al mismo docente y periodo, y estar sin alumno asignado o asignado al alumno seleccionado.', 409);
    }
  }
  const practicas = Array.isArray(payload.practicas)
    ? payload.practicas.map((item) => numeroSeguro(item)).filter((item) => Number.isFinite(item))
    : [];
  const teoricoDecimal = numeroSeguro(payload.teoricoDecimal);
  const practicaPromedioDecimal = round4(practicas.length > 0 ? practicas.reduce((s, n) => s + n, 0) / practicas.length : 0);
  const configuracionPeriodo = await prisma.configuracionPeriodoEvaluacion.findUnique({
    where: { docenteId_periodoId: { docenteId, periodoId: String(payload.periodoId) } }
  });
  const codigoPolitica = String(configuracionPeriodo?.politicaCodigo ?? 'POLICY_LISC_ENCUADRE_2026');
  const versionPolitica = numeroSeguro(configuracionPeriodo?.politicaVersion) || 1;
  const politica = await obtenerDefinicionPolitica(docenteId, codigoPolitica, versionPolitica);
  const parametros = politica.familia === 'lisc_encuadre'
    ? parametrosPredeterminados('lisc_encuadre', politica.parametros).pesosComponentesExamen
    : { teorico: 0.6, practicas: 0.4 };
  const examenCorteDecimal = round4(calcularExamenCorte(teoricoDecimal, practicas, parametros));

  const update = {
    docenteId,
    periodoId,
    alumnoId,
    corte: String(payload.corte),
    teoricoDecimal,
    practicas: JSON.stringify(practicas),
    practicaPromedioDecimal,
    examenCorteDecimal,
    origen: payload.origen ? String(payload.origen) : 'manual',
    examenGeneradoId,
    metadata: payload.metadata ? JSON.stringify(payload.metadata) : null
  };

  const componenteRaw = await prisma.componenteExamen.upsert({
    where: {
      docenteId_periodoId_alumnoId_corte: {
        docenteId,
        periodoId: String(payload.periodoId),
        alumnoId: String(payload.alumnoId),
        corte: String(payload.corte)
      }
    },
    update,
    create: update
  });

  const componente = {
    ...componenteRaw,
    practicas,
    metadata: payload.metadata ?? null
  };

  res.status(201).json({ componente });
}

export async function obtenerResumenEvaluacionAlumno(req: SolicitudDocente, res: Response) {
  const docenteId = obtenerDocenteId(req);
  const alumnoId = String(req.params.alumnoId ?? '').trim();
  const periodoId = String(req.query.periodoId ?? '').trim();

  if (!alumnoId || !periodoId) {
    throw new ErrorAplicacion('DATOS_INVALIDOS', 'alumnoId y periodoId son requeridos', 400);
  }

  const configRaw = await prisma.configuracionPeriodoEvaluacion.findUnique({
    where: {
      docenteId_periodoId: {
        docenteId,
        periodoId
      }
    }
  });
  const config = mapearConfiguracionPrismaALean(configRaw);
  const politicaCodigo = String(config?.politicaCodigo ?? 'POLICY_SV_EXCEL_2026');
  const politicaVersion = numeroSeguro(config?.politicaVersion) || 1;
  const definicion = await obtenerDefinicionPolitica(docenteId, politicaCodigo, politicaVersion);

  const resumen = definicion.familia === 'lisc_encuadre'
    ? await calcularResumenLisc(docenteId, periodoId, alumnoId)
    : await calcularResumenSv(docenteId, periodoId, alumnoId, definicion);

  res.json({ resumen });
}

export async function guardarPoliticaEvaluacionesV2(req: SolicitudDocente, res: Response) {
  await guardarConfiguracionPeriodo(req, res);
}

export async function guardarEvidenciaEvaluacionesV2(req: SolicitudDocente, res: Response) {
  await crearEvidenciaEvaluacion(req, res);
}

export async function guardarComponenteExamenV2(req: SolicitudDocente, res: Response) {
  await upsertComponenteExamen(req, res);
}

export async function obtenerResumenEvaluacionesV2(req: SolicitudDocente, res: Response) {
  await obtenerResumenEvaluacionAlumno(req, res);
}
