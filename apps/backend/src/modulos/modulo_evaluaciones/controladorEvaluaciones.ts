import type { Response } from 'express';
import { ErrorAplicacion } from '../../compartido/errores/errorAplicacion';
import { obtenerDocenteId, type SolicitudDocente } from '../modulo_autenticacion/middlewareAutenticacion';
import { Calificacion } from '../modulo_calificacion/modeloCalificacion';
import { ComponenteExamen } from './modeloComponenteExamen';
import { ConfiguracionPeriodoEvaluacion } from './modeloConfiguracionPeriodoEvaluacion';
import { EvidenciaEvaluacion } from './modeloEvidenciaEvaluacion';
import {
  CODIGOS_POLITICA,
  PoliticaCalificacion,
  type CodigoPoliticaCalificacion
} from './modeloPoliticaCalificacion';
import { ResumenEvaluacionAlumno } from './modeloResumenEvaluacionAlumno';
import {
  calcularExamenCorte,
  calcularPoliticaLisc,
  promedioPonderado,
  redondearFinalInstitucional
} from './servicioPoliticasCalificacion';

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

async function asegurarPoliticasBase() {
  for (const politica of POLITICAS_BASE) {
    await PoliticaCalificacion.updateOne(
      { codigo: politica.codigo, version: politica.version },
      {
        $setOnInsert: {
          codigo: politica.codigo,
          version: politica.version,
          nombre: politica.nombre,
          descripcion: politica.descripcion,
          parametros: politica.parametros,
          activa: true
        }
      },
      { upsert: true }
    );
  }
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
  const config =
    (await ConfiguracionPeriodoEvaluacion.findOne({ docenteId, periodoId }).lean()) ??
    configDefaultLisc(docenteId, periodoId);

  const [evidencias, componentes] = await Promise.all([
    EvidenciaEvaluacion.find({ docenteId, periodoId, alumnoId }).lean(),
    ComponenteExamen.find({ docenteId, periodoId, alumnoId }).lean()
  ]);

  const continuaPorCorte = determinarContinuaPorCortes({
    evidencias: evidencias as Array<Record<string, unknown>>,
    cortesConfig: (config.cortes ?? []) as Array<Record<string, unknown>>
  });
  const { examenesPorCorte, estadoComponentes } = determinarExamenesPorCorte(
    componentes as Array<Record<string, unknown>>
  );

  const calculo = calcularPoliticaLisc({
    continuaPorCorte,
    examenesPorCorte,
    pesosGlobales: (config.pesosGlobales ?? {}) as { continua?: number; examenes?: number },
    pesosExamenes: (config.pesosExamenes ?? {}) as { parcial1?: number; parcial2?: number; global?: number }
  });

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
    politicaCodigo: 'POLICY_LISC_ENCUADRE_2026',
    politicaVersion: numeroSeguro(config.politicaVersion) || 1,
    continuaPorCorte: calculo.continuaPorCorte,
    examenesPorCorte: calculo.examenesPorCorte,
    bloqueContinuaDecimal: calculo.bloqueContinuaDecimal,
    bloqueExamenesDecimal: calculo.bloqueExamenesDecimal,
    finalDecimal: calculo.finalDecimal,
    finalRedondeada: calculo.finalRedondeada,
    estado,
    faltantes,
    auditoria: {
      politicaCodigo: 'POLICY_LISC_ENCUADRE_2026',
      politicaVersion: numeroSeguro(config.politicaVersion) || 1,
      reglas: config.reglasCierre ?? {},
      pesosGlobales: config.pesosGlobales ?? {},
      pesosExamenes: config.pesosExamenes ?? {},
      formulas: {
        examenCorte: '0.5*teorico + 0.5*promedio(practicas)',
        bloqueExamenes: '0.2*parcial1 + 0.2*parcial2 + 0.6*global',
        bloqueContinua: '0.2*c1 + 0.2*c2 + 0.6*c3',
        final: '0.5*bloqueContinua + 0.5*bloqueExamenes',
        redondeoFinal: 'si <6 floor, si >=6 round half-up'
      }
    },
    calculadoEn: new Date()
  };

  await ResumenEvaluacionAlumno.updateOne(
    { docenteId, periodoId, alumnoId },
    { $set: resumen },
    { upsert: true }
  );

  return resumen;
}

async function calcularResumenSv(docenteId: string, periodoId: string, alumnoId: string) {
  const calificaciones = await Calificacion.find({ docenteId, periodoId, alumnoId }).sort({ createdAt: 1 }).lean();
  const parciales = calificaciones.filter((item) => item.tipoExamen === 'parcial');
  const global = calificaciones.find((item) => item.tipoExamen === 'global');

  const parcial1 = numeroSeguro(parciales[0]?.calificacionParcialTexto);
  const parcial2 = numeroSeguro(parciales[1]?.calificacionParcialTexto);
  const globalNota = numeroSeguro(global?.calificacionGlobalTexto);

  const bloqueExamenesDecimal = round4(globalNota * 0.6 + ((parcial1 + parcial2) / 2) * 0.4);
  const finalDecimal = round4(bloqueExamenesDecimal);
  const finalRedondeada = redondearFinalInstitucional(finalDecimal);

  const resumen = {
    docenteId,
    periodoId,
    alumnoId,
    politicaCodigo: 'POLICY_SV_EXCEL_2026',
    politicaVersion: 1,
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
    faltantes: [],
    auditoria: {
      fuente: 'sv_excel_legacy'
    },
    calculadoEn: new Date()
  };

  await ResumenEvaluacionAlumno.updateOne(
    { docenteId, periodoId, alumnoId },
    { $set: resumen },
    { upsert: true }
  );

  return resumen;
}

export async function listarPoliticasCalificacion(_req: SolicitudDocente, res: Response) {
  await asegurarPoliticasBase();
  const politicas = await PoliticaCalificacion.find({ activa: true }).sort({ codigo: 1, version: -1 }).lean();
  res.json({ politicas });
}

export async function obtenerContextoEvaluacionesV2(req: SolicitudDocente, res: Response) {
  const docenteId = obtenerDocenteId(req);
  const periodoId = String(req.query.periodoId ?? '').trim();

  await asegurarPoliticasBase();
  const [politicas, configuracion] = await Promise.all([
    PoliticaCalificacion.find({ activa: true }).sort({ codigo: 1, version: -1 }).lean(),
    periodoId ? ConfiguracionPeriodoEvaluacion.findOne({ docenteId, periodoId }).lean() : Promise.resolve(null)
  ]);

  res.json({
    politicas,
    configuracion: configuracion ?? null
  });
}

export async function crearPoliticaCalificacion(req: SolicitudDocente, res: Response) {
  const politica = await PoliticaCalificacion.create(req.body);
  res.status(201).json({ politica });
}

export async function obtenerConfiguracionPeriodo(req: SolicitudDocente, res: Response) {
  const docenteId = obtenerDocenteId(req);
  const periodoId = String(req.query.periodoId ?? '').trim();
  if (!periodoId) {
    throw new ErrorAplicacion('DATOS_INVALIDOS', 'periodoId requerido', 400);
  }

  const config = await ConfiguracionPeriodoEvaluacion.findOne({ docenteId, periodoId }).lean();
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
  if (!CODIGOS_POLITICA.includes(politicaCodigo as CodigoPoliticaCalificacion)) {
    throw new ErrorAplicacion('DATOS_INVALIDOS', 'politicaCodigo invalido', 400);
  }

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

  const update = {
    docenteId,
    periodoId,
    politicaCodigo,
    politicaVersion: numeroSeguro(payload.politicaVersion) || 1,
    cortes: cortesNormalizados.length > 0 ? cortesNormalizados : configDefaultLisc(docenteId, periodoId).cortes,
    pesosGlobales: payload.pesosGlobales ?? { continua: 0.5, examenes: 0.5 },
    pesosExamenes: payload.pesosExamenes ?? { parcial1: 0.2, parcial2: 0.2, global: 0.6 },
    reglasCierre:
      payload.reglasCierre ?? {
        requiereTeorico: true,
        requierePractica: true,
        requiereContinuaMinima: false,
        continuaMinima: 0
      },
    activo: payload.activo === false ? false : true
  };

  const configuracion = await ConfiguracionPeriodoEvaluacion.findOneAndUpdate(
    { docenteId, periodoId },
    { $set: update },
    { upsert: true, returnDocument: 'after' }
  ).lean();

  res.json({ configuracion });
}

export async function listarEvidenciasEvaluacion(req: SolicitudDocente, res: Response) {
  const docenteId = obtenerDocenteId(req);
  const periodoId = String(req.query.periodoId ?? '').trim();
  const alumnoId = String(req.query.alumnoId ?? '').trim();
  const limite = Math.max(1, Math.min(400, numeroSeguro(req.query.limite) || 120));

  const filtro: Record<string, unknown> = { docenteId };
  if (periodoId) filtro.periodoId = periodoId;
  if (alumnoId) filtro.alumnoId = alumnoId;

  const evidencias = await EvidenciaEvaluacion.find(filtro).sort({ fechaEvidencia: -1, createdAt: -1 }).limit(limite).lean();
  res.json({ evidencias });
}

export async function crearEvidenciaEvaluacion(req: SolicitudDocente, res: Response) {
  const docenteId = obtenerDocenteId(req);
  const payload = req.body as Record<string, unknown>;
  const evidencia = await EvidenciaEvaluacion.create({
    ...payload,
    docenteId,
    fechaEvidencia: payload.fechaEvidencia ? new Date(String(payload.fechaEvidencia)) : new Date(),
    fuente: payload.fuente ?? 'manual'
  });
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

  const componente = await ComponenteExamen.findOneAndUpdate(
    {
      docenteId,
      periodoId: String(payload.periodoId),
      alumnoId: String(payload.alumnoId),
      corte: String(payload.corte)
    },
    {
      $set: {
        docenteId,
        periodoId: String(payload.periodoId),
        alumnoId: String(payload.alumnoId),
        corte: String(payload.corte),
        teoricoDecimal,
        practicas,
        practicaPromedioDecimal,
        examenCorteDecimal,
        origen: payload.origen ?? 'manual',
        examenGeneradoId: payload.examenGeneradoId ?? undefined,
        metadata: payload.metadata ?? undefined
      }
    },
    { upsert: true, returnDocument: 'after' }
  ).lean();

  res.status(201).json({ componente });
}

export async function obtenerResumenEvaluacionAlumno(req: SolicitudDocente, res: Response) {
  const docenteId = obtenerDocenteId(req);
  const alumnoId = String(req.params.alumnoId ?? '').trim();
  const periodoId = String(req.query.periodoId ?? '').trim();

  if (!alumnoId || !periodoId) {
    throw new ErrorAplicacion('DATOS_INVALIDOS', 'alumnoId y periodoId son requeridos', 400);
  }

  const config = await ConfiguracionPeriodoEvaluacion.findOne({ docenteId, periodoId }).lean();
  const politica = String(config?.politicaCodigo ?? 'POLICY_SV_EXCEL_2026');

  const resumen = politica === 'POLICY_LISC_ENCUADRE_2026'
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
