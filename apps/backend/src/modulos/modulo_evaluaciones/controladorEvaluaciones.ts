/**
 * controladorEvaluaciones
 *
 * Responsabilidad: Adaptador HTTP del dominio (parseo de entrada, invocacion de servicios y respuesta).
 * Limites: Evitar mover logica de negocio profunda a controlador.
 */
import type { Response } from 'express';
import { ErrorAplicacion } from '../../compartido/errores/errorAplicacion';
import { obtenerDocenteId, type SolicitudDocente } from '../modulo_autenticacion/middlewareAutenticacion';
import {
  CODIGOS_POLITICA,
  type CodigoPoliticaCalificacion
} from './modeloPoliticaCalificacion';
import {
  calcularExamenCorte,
  calcularPoliticaLisc,
  promedioPonderado,
  redondearFinalInstitucional
} from './servicioPoliticasCalificacion';
import { prisma } from '../../infraestructura/baseDatos/sqlite';

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
  const calificaciones = await prisma.calificacion.findMany({
    where: { docenteId, periodoId, alumnoId },
    orderBy: { createdAt: 'asc' }
  });
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
    faltantes: [] as string[],
    auditoria: {
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

export async function listarPoliticasCalificacion(_req: SolicitudDocente, res: Response) {
  res.json({ politicas: POLITICAS_BASE });
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

  res.json({
    politicas: POLITICAS_BASE,
    configuracion: configuracion ?? null
  });
}

export async function crearPoliticaCalificacion(_req: SolicitudDocente, res: Response) {
  res.sendStatus(501);
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

  const defaultCortes = configDefaultLisc(docenteId, periodoId).cortes;

  const update = {
    docenteId,
    periodoId,
    politicaCodigo,
    politicaVersion: numeroSeguro(payload.politicaVersion) || 1,
    cortes: JSON.stringify(cortesNormalizados.length > 0 ? cortesNormalizados : defaultCortes),
    pesosGlobales: JSON.stringify(payload.pesosGlobales ?? { continua: 0.5, examenes: 0.5 }),
    pesosExamenes: JSON.stringify(payload.pesosExamenes ?? { parcial1: 0.2, parcial2: 0.2, global: 0.6 }),
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
