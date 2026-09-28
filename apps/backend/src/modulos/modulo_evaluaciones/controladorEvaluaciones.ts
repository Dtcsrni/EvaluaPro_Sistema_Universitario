/**
 * controladorEvaluaciones
 *
 * Responsabilidad: Adaptador HTTP del dominio (parseo de entrada, invocacion de servicios y respuesta).
 * Limites: Evitar mover logica de negocio profunda a controlador.
 */
import type { Response } from 'express';
import { ErrorAplicacion } from '../../compartido/errores/errorAplicacion.js';
import { obtenerDocenteId, type SolicitudDocente } from '../modulo_autenticacion/middlewareAutenticacion.js';
import {
  CODIGOS_POLITICA,
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
  archivarPoliticaDocente,
  crearPoliticaDocente,
  listarAuditoriaPolitica,
  listarPoliticasDocente,
  obtenerPoliticaDocente,
  versionarPoliticaDocente
} from './servicioCrudPoliticasCalificacion.js';

const POLITICAS_BASE: Array<{
  codigo: CodigoPoliticaCalificacion;
  version: number;
  nombre: string;
  descripcion: string;
  parametros: Record<string, unknown>;
}> = [
  {
    codigo: 'POLICY_SV_EXCEL_2026',
    version: 1,
    nombre: 'Política Sistemas Visuales 2026 (Excel)',
    descripcion: 'Mantiene el contrato histórico del libro de calificaciones SV.',
    parametros: {
      tipo: 'sv_excel_contract',
      referencia: 'Sistemas_Visuales_Enero-Febrero-2026.xlsx'
    }
  },
  {
    codigo: 'POLICY_LISC_ENCUADRE_2026',
    version: 1,
    nombre: 'Política LISC Encuadre 2026',
    descripcion: 'Final 50% continua + 50% exámenes (20/20/60).',
    parametros: {
      tipo: 'lisc_encuadre',
      pesosGlobales: { continua: 0.5, examenes: 0.5 },
      pesosExamenes: { parcial1: 0.2, parcial2: 0.2, global: 0.6 }
    }
  }
];

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
          peso: numeroSeguro(item.ponderacion || 1)
        }))
        .filter((item) => item.fecha.getTime() <= fechaLimite.getTime());
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
  componentes: Array<{ corte?: unknown; examenCorteDecimal?: unknown; teoricoDecimal?: unknown; practicas?: unknown }>
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

    examenesPorCorte[corte] = round4(numeroSeguro(item.examenCorteDecimal));
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

  const [evidenciasRaw, componentesRaw] = await Promise.all([
    prisma.evidenciaEvaluacion.findMany({
      where: { docenteId, periodoId, alumnoId }
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
    componentes as Array<Record<string, unknown>>
  );

  const calculo = calcularPoliticaLisc({
    continuaPorCorte,
    examenesPorCorte,
    pesosGlobales: (config.pesosGlobales ?? {}) as { continua?: number; examenes?: number },
    pesosExamenes: (config.pesosExamenes ?? {}) as { parcial1?: number; parcial2?: number; global?: number },
    pesosContinua: ((config.pesosGlobales as Record<string, unknown> | undefined)?.continuaPorCorte ?? {}) as { c1?: number; c2?: number; c3?: number }
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
    finalRedondeada = redondearFinalInstitucional(finalDecimal);
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
    politicaCodigo: String(config.politicaCodigo ?? 'POLICY_LISC_ENCUADRE_2026'),
    politicaVersion: numeroSeguro(config.politicaVersion) || 1,
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
      politicaCodigo: String(config.politicaCodigo ?? 'POLICY_LISC_ENCUADRE_2026'),
      politicaVersion: numeroSeguro(config.politicaVersion) || 1,
      politicaId: ((config.reglasCierre ?? {}) as Record<string, unknown>).politicaId ?? null,
      reglas: config.reglasCierre ?? {},
      pesosGlobales: config.pesosGlobales ?? {},
      pesosExamenes: config.pesosExamenes ?? {},
      pesosContinuaPorCorte: (config.pesosGlobales as Record<string, unknown> | undefined)?.continuaPorCorte ?? { c1: 0.2, c2: 0.2, c3: 0.6 },
      formulas: {
        examenCorte: '0.6*teorico + 0.4*promedio(practicas)',
        bloqueExamenes: 'pesosExamenes.parcial1*parcial1 + pesosExamenes.parcial2*parcial2 + pesosExamenes.global*global',
        bloqueContinua: 'pesosContinuaPorCorte.c1*c1 + pesosContinuaPorCorte.c2*c2 + pesosContinuaPorCorte.c3*c3',
        final: 'pesosGlobales.continua*bloqueContinua + pesosGlobales.examenes*bloqueExamenes',
        redondeoFinal: 'si <6 floor, si >=6 round half-up'
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

async function calcularResumenSv(docenteId: string, periodoId: string, alumnoId: string) {
  const [configRaw, calificaciones] = await Promise.all([
    prisma.configuracionPeriodoEvaluacion.findUnique({ where: { docenteId_periodoId: { docenteId, periodoId } } }),
    prisma.calificacion.findMany({ where: { docenteId, periodoId, alumnoId }, orderBy: { createdAt: 'asc' } })
  ]);
  const config = mapearConfiguracionPrismaALean(configRaw);
  const parciales = calificaciones.filter((item) => item.tipoExamen === 'parcial');
  const global = calificaciones.find((item) => item.tipoExamen === 'global');

  const parcial1 = numeroSeguro(parciales[0]?.calificacionParcialTexto);
  const parcial2 = numeroSeguro(parciales[1]?.calificacionParcialTexto);
  const globalNota = numeroSeguro(global?.calificacionGlobalTexto);

  const pesoGlobal = numeroSeguro(config?.pesosExamenes?.pesoGlobal ?? 0.6);
  const pesoParciales = numeroSeguro(config?.pesosExamenes?.pesoParciales ?? 0.4);
  const bloqueExamenesDecimal = round4(globalNota * pesoGlobal + ((parcial1 + parcial2) / 2) * pesoParciales);
  const finalDecimal = round4(bloqueExamenesDecimal);
  const finalRedondeada = redondearFinalInstitucional(finalDecimal);

  const resumen = {
    docenteId,
    periodoId,
    alumnoId,
    politicaCodigo: String(config?.politicaCodigo ?? 'POLICY_SV_EXCEL_2026'),
    politicaVersion: numeroSeguro(config?.politicaVersion) || 1,
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
      fuente: 'sv_excel_legacy',
      politicaCodigo: String(config?.politicaCodigo ?? 'POLICY_SV_EXCEL_2026'),
      politicaVersion: numeroSeguro(config?.politicaVersion) || 1,
      politicaId: ((config?.reglasCierre ?? {}) as Record<string, unknown>).politicaId ?? null,
      pesosExamenes: { pesoGlobal, pesoParciales }
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

export async function listarPoliticasCalificacion(req: SolicitudDocente, res: Response) {
  const docenteId = obtenerDocenteId(req);
  const incluirArchivadas = String(req.query.incluirArchivadas ?? '') === 'true';
  const incluirVersiones = String(req.query.incluirVersiones ?? '') === 'true';
  const propias = await listarPoliticasDocente(docenteId, { incluirArchivadas, incluirVersiones });
  res.json({ politicas: [...POLITICAS_BASE.map((politica) => ({ ...politica, editable: false })), ...propias.map((politica) => ({ ...politica, editable: true }))] });
}

export async function obtenerPoliticaCalificacion(req: SolicitudDocente, res: Response) {
  const codigo = String(req.params.codigo ?? '').trim();
  const versionQuery = req.query.version === undefined ? undefined : Number(req.query.version);
  if (versionQuery !== undefined && (!Number.isInteger(versionQuery) || versionQuery < 1)) {
    throw new ErrorAplicacion('DATOS_INVALIDOS', 'version debe ser un entero positivo', 400);
  }
  const base = POLITICAS_BASE.find((politica) => politica.codigo === codigo);
  if (base) {
    if (versionQuery !== undefined && versionQuery !== base.version) throw new ErrorAplicacion('POLITICA_NO_ENCONTRADA', 'Política no encontrada', 404);
    res.json({ politica: { ...base, editable: false } });
    return;
  }
  const politica = await obtenerPoliticaDocente(obtenerDocenteId(req), codigo, versionQuery);
  res.json({ politica: { ...politica, editable: true } });
}

export async function listarAuditoriaPoliticaCalificacion(req: SolicitudDocente, res: Response) {
  const codigo = String(req.params.codigo ?? '').trim();
  const limiteQuery = req.query.limite === undefined ? undefined : Number(req.query.limite);
  if (limiteQuery !== undefined && (!Number.isInteger(limiteQuery) || limiteQuery < 1 || limiteQuery > 100)) {
    throw new ErrorAplicacion('DATOS_INVALIDOS', 'limite debe ser un entero entre 1 y 100', 400);
  }
  const docenteId = obtenerDocenteId(req);
  if (!POLITICAS_BASE.some((politica) => politica.codigo === codigo)) await obtenerPoliticaDocente(docenteId, codigo);
  const pagina = await listarAuditoriaPolitica(docenteId, codigo, {
    limite: limiteQuery,
    cursor: typeof req.query.cursor === 'string' ? req.query.cursor : undefined
  });
  res.json(pagina);
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
  const propias = await listarPoliticasDocente(docenteId);

  res.json({
    politicas: [...POLITICAS_BASE.map((politica) => ({ ...politica, editable: false })), ...propias.map((politica) => ({ ...politica, editable: true }))],
    configuracion: configuracion ?? null
  });
}

export async function crearPoliticaCalificacion(req: SolicitudDocente, res: Response) {
  const payload = req.body as Parameters<typeof crearPoliticaDocente>[1];
  if (CODIGOS_POLITICA.includes(payload.codigo as CodigoPoliticaCalificacion)) {
    throw new ErrorAplicacion('POLITICA_RESERVADA', 'El código corresponde a una política predefinida', 409);
  }
  const politica = await crearPoliticaDocente(obtenerDocenteId(req), payload);
  res.status(201).json({ politica: { ...politica, editable: true } });
}

export async function versionarPoliticaCalificacion(req: SolicitudDocente, res: Response) {
  const codigo = String(req.params.codigo ?? '').trim();
  if (CODIGOS_POLITICA.includes(codigo as CodigoPoliticaCalificacion)) {
    throw new ErrorAplicacion('POLITICA_RESERVADA', 'Las políticas predefinidas son inmutables', 409);
  }
  const politica = await versionarPoliticaDocente(obtenerDocenteId(req), codigo, req.body as Parameters<typeof versionarPoliticaDocente>[2]);
  res.json({ politica: { ...politica, editable: true } });
}

export async function archivarPoliticaCalificacion(req: SolicitudDocente, res: Response) {
  const codigo = String(req.params.codigo ?? '').trim();
  if (CODIGOS_POLITICA.includes(codigo as CodigoPoliticaCalificacion)) {
    throw new ErrorAplicacion('POLITICA_RESERVADA', 'Las políticas predefinidas no se pueden archivar', 409);
  }
  const politica = await archivarPoliticaDocente(obtenerDocenteId(req), codigo, req.body as Parameters<typeof archivarPoliticaDocente>[2]);
  res.json({ politica: { ...politica, editable: true } });
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

  const politicaCodigo = String(payload.politicaCodigo ?? '').trim();
  const politicaBase = POLITICAS_BASE.find((item) => item.codigo === politicaCodigo);
  const versionSolicitada = payload.politicaVersion === undefined ? undefined : numeroSeguro(payload.politicaVersion);
  let politicaVersion = 1;
  let politicaDocente: Awaited<ReturnType<typeof obtenerPoliticaDocente>> | null = null;
  if (politicaBase) {
    if (versionSolicitada !== undefined && versionSolicitada !== politicaBase.version) {
      throw new ErrorAplicacion('POLITICA_VERSION_INVALIDA', 'La versión predefinida solicitada no existe', 400);
    }
  } else {
    politicaDocente = await obtenerPoliticaDocente(docenteId, politicaCodigo, versionSolicitada);
    const vigente = versionSolicitada === undefined ? politicaDocente : await obtenerPoliticaDocente(docenteId, politicaCodigo);
    if (!politicaDocente.activa || politicaDocente.version !== vigente.version) {
      throw new ErrorAplicacion('POLITICA_VERSION_INACTIVA', 'El periodo solo puede seleccionar la versión activa más reciente', 409);
    }
    politicaVersion = politicaDocente.version;
  }

  const parametrosPolitica = politicaDocente?.parametros ?? {};
  const familiaPolitica = politicaDocente?.familia ?? (politicaCodigo === 'POLICY_LISC_ENCUADRE_2026' ? 'lisc_encuadre' : 'sv_excel_contract');

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

  const pesosGlobalesBase = familiaPolitica === 'lisc_encuadre'
    ? (politicaDocente ? parametrosPolitica.pesosGlobales ?? { continua: 0.5, examenes: 0.5 } : payload.pesosGlobales ?? { continua: 0.5, examenes: 0.5 })
    : { continua: 0.5, examenes: 0.5 };
  const pesosGlobales = familiaPolitica === 'lisc_encuadre' && politicaDocente
    ? { ...(pesosGlobalesBase as Record<string, unknown>), continuaPorCorte: parametrosPolitica.pesosContinua ?? { c1: 0.2, c2: 0.2, c3: 0.6 } }
    : pesosGlobalesBase;
  const pesosExamenes = familiaPolitica === 'lisc_encuadre'
    ? (politicaDocente ? parametrosPolitica.pesosExamenes ?? { parcial1: 0.2, parcial2: 0.2, global: 0.6 } : payload.pesosExamenes ?? { parcial1: 0.2, parcial2: 0.2, global: 0.6 })
    : (politicaDocente ? { pesoGlobal: parametrosPolitica.pesoGlobal ?? 0.6, pesoParciales: parametrosPolitica.pesoParciales ?? 0.4 } : { pesoGlobal: 0.6, pesoParciales: 0.4 });
  const reglasCierreBase = familiaPolitica === 'lisc_encuadre' && politicaDocente
    ? parametrosPolitica.reglasCierre ?? payload.reglasCierre ?? { requiereTeorico: true, requierePractica: true, requiereContinuaMinima: false, continuaMinima: 0 }
    : payload.reglasCierre ?? { requiereTeorico: true, requierePractica: true, requiereContinuaMinima: false, continuaMinima: 0 };
  const reglasCierre = politicaDocente
    ? { ...(reglasCierreBase as Record<string, unknown>), politicaId: politicaDocente.id }
    : reglasCierreBase;

  const update = {
    docenteId,
    periodoId,
    politicaCodigo,
    politicaVersion,
    cortes: JSON.stringify(cortesNormalizados.length > 0 ? cortesNormalizados : defaultCortes),
    pesosGlobales: JSON.stringify(pesosGlobales),
    pesosExamenes: JSON.stringify(pesosExamenes),
    reglasCierre: JSON.stringify(reglasCierre),
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
  const periodoId = String(req.query.periodoId ?? '').trim();
  const alumnoId = String(req.query.alumnoId ?? '').trim();
  const limite = Math.max(1, Math.min(400, numeroSeguro(req.query.limite) || 120));

  const evidenciasRaw = await prisma.evidenciaEvaluacion.findMany({
    where: {
      docenteId,
      ...(periodoId ? { periodoId } : {}),
      ...(alumnoId ? { alumnoId } : {})
    },
    orderBy: [
      { fechaEvidencia: 'desc' },
      { createdAt: 'desc' }
    ],
    take: limite
  });

  const evidencias = evidenciasRaw.map((ev) => {
    const classroom = ev.classroomData ? JSON.parse(ev.classroomData) : null;
    const metadata = ev.metadata ? JSON.parse(ev.metadata) : null;
    return {
      ...ev,
      classroom,
      classroomData: classroom,
      metadata
    };
  });

  res.json({ evidencias });
}

export async function crearEvidenciaEvaluacion(req: SolicitudDocente, res: Response) {
  const docenteId = obtenerDocenteId(req);
  const payload = req.body as Record<string, unknown>;

  const classroomObj = payload.classroom || payload.classroomData;
  const classroomDataStr = classroomObj ? JSON.stringify(classroomObj) : null;
  const metadataStr = payload.metadata ? JSON.stringify(payload.metadata) : null;

  const evidenciaRaw = await prisma.evidenciaEvaluacion.create({
    data: {
      docenteId,
      periodoId: String(payload.periodoId),
      alumnoId: String(payload.alumnoId),
      titulo: String(payload.titulo),
      descripcion: payload.descripcion ? String(payload.descripcion) : null,
      calificacionDecimal: payload.calificacionDecimal !== undefined ? Number(payload.calificacionDecimal) : null,
      ponderacion: payload.ponderacion !== undefined ? Number(payload.ponderacion) : 1.0,
      fechaEvidencia: payload.fechaEvidencia ? new Date(String(payload.fechaEvidencia)) : new Date(),
      corte: payload.corte !== undefined ? Number(payload.corte) : null,
      fuente: payload.fuente ? String(payload.fuente) : 'manual',
      estadoCaptura: payload.estadoCaptura ? String(payload.estadoCaptura) : 'calificada',
      classroomData: classroomDataStr,
      metadata: metadataStr
    }
  });

  const evidencia = {
    ...evidenciaRaw,
    classroom: classroomObj,
    classroomData: classroomObj,
    metadata: payload.metadata ?? null
  };

  res.status(201).json({ evidencia });
}

export async function upsertComponenteExamen(req: SolicitudDocente, res: Response) {
  const docenteId = obtenerDocenteId(req);
  const payload = req.body as Record<string, unknown>;
  const practicas = Array.isArray(payload.practicas)
    ? payload.practicas.map((item) => numeroSeguro(item)).filter((item) => Number.isFinite(item))
    : [];
  const teoricoDecimal = numeroSeguro(payload.teoricoDecimal);
  const practicaPromedioDecimal = round4(practicas.length > 0 ? practicas.reduce((s, n) => s + n, 0) / practicas.length : 0);
  const examenCorteDecimal = round4(calcularExamenCorte(teoricoDecimal, practicas));

  const update = {
    docenteId,
    periodoId: String(payload.periodoId),
    alumnoId: String(payload.alumnoId),
    corte: String(payload.corte),
    teoricoDecimal,
    practicas: JSON.stringify(practicas),
    practicaPromedioDecimal,
    examenCorteDecimal,
    origen: payload.origen ? String(payload.origen) : 'manual',
    examenGeneradoId: payload.examenGeneradoId ? String(payload.examenGeneradoId) : null,
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
  const politica = String(config?.politicaCodigo ?? 'POLICY_SV_EXCEL_2026');
  let familia = politica === 'POLICY_LISC_ENCUADRE_2026' ? 'lisc_encuadre' : politica === 'POLICY_SV_EXCEL_2026' ? 'sv_excel_contract' : '';
  if (!familia) {
    const version = numeroSeguro(config?.politicaVersion) || 1;
    const definicion = await obtenerPoliticaDocente(docenteId, politica, version);
    familia = definicion.familia;
  }

  const resumen = familia === 'lisc_encuadre'
    ? await calcularResumenLisc(docenteId, periodoId, alumnoId)
    : await calcularResumenSv(docenteId, periodoId, alumnoId);

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
