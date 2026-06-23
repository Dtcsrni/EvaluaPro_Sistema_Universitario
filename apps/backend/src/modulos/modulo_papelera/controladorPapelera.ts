/**
 * Controlador de papelera (borrado suave).
 */
import type { Response } from 'express';
import { configuracion } from '../../configuracion';
import { ErrorAplicacion } from '../../compartido/errores/errorAplicacion';
import { obtenerDocenteId, type SolicitudDocente } from '../modulo_autenticacion/middlewareAutenticacion';
import { prisma } from '../../infraestructura/baseDatos/sqlite';

function validarAdminDev() {
  if (String(configuracion.entorno).toLowerCase() !== 'development') {
    throw new ErrorAplicacion('SOLO_DEV', 'Accion disponible solo en modo desarrollo', 403);
  }
}

async function restaurarPeriodo(p: any) {
  if (!p) return;
  const id = p.id ?? p._id;
  await prisma.periodo.upsert({
    where: { id },
    create: {
      id,
      docenteId: p.docenteId,
      nombre: p.nombre,
      nombreNormalizado: p.nombreNormalizado,
      fechaInicio: new Date(p.fechaInicio),
      fechaFin: new Date(p.fechaFin),
      grupos: typeof p.grupos === 'string' ? p.grupos : JSON.stringify(p.grupos || []),
      activo: p.activo !== false,
      archivadoEn: p.archivadoEn ? new Date(p.archivadoEn) : null,
      resumenArchivado: typeof p.resumenArchivado === 'string' ? p.resumenArchivado : JSON.stringify(p.resumenArchivado || null),
      createdAt: p.createdAt ? new Date(p.createdAt) : undefined,
      updatedAt: p.updatedAt ? new Date(p.updatedAt) : undefined,
    },
    update: {
      docenteId: p.docenteId,
      nombre: p.nombre,
      nombreNormalizado: p.nombreNormalizado,
      fechaInicio: new Date(p.fechaInicio),
      fechaFin: new Date(p.fechaFin),
      grupos: typeof p.grupos === 'string' ? p.grupos : JSON.stringify(p.grupos || []),
      activo: p.activo !== false,
      archivadoEn: p.archivadoEn ? new Date(p.archivadoEn) : null,
      resumenArchivado: typeof p.resumenArchivado === 'string' ? p.resumenArchivado : JSON.stringify(p.resumenArchivado || null),
      updatedAt: p.updatedAt ? new Date(p.updatedAt) : undefined,
    }
  });
}

async function restaurarAlumno(a: any) {
  if (!a) return;
  const id = a.id ?? a._id;
  await prisma.alumno.upsert({
    where: { id },
    create: {
      id,
      periodoId: a.periodoId,
      matricula: a.matricula,
      nombres: a.nombres,
      apellidos: a.apellidos,
      nombreCompleto: a.nombreCompleto,
      correo: a.correo,
      grupo: a.grupo,
      activo: a.activo !== false,
      createdAt: a.createdAt ? new Date(a.createdAt) : undefined,
      updatedAt: a.updatedAt ? new Date(a.updatedAt) : undefined,
    },
    update: {
      periodoId: a.periodoId,
      matricula: a.matricula,
      nombres: a.nombres,
      apellidos: a.apellidos,
      nombreCompleto: a.nombreCompleto,
      correo: a.correo,
      grupo: a.grupo,
      activo: a.activo !== false,
      updatedAt: a.updatedAt ? new Date(a.updatedAt) : undefined,
    }
  });
}

async function restaurarBancoPregunta(bp: any) {
  if (!bp) return;
  const id = bp.id ?? bp._id;
  await prisma.bancoPregunta.upsert({
    where: { id },
    create: {
      id,
      docenteId: bp.docenteId,
      periodoId: bp.periodoId,
      tema: bp.tema,
      activo: bp.activo !== false,
      archivadoEn: bp.archivadoEn ? new Date(bp.archivadoEn) : null,
      recoverySource: typeof bp.recoverySource === 'string' ? bp.recoverySource : JSON.stringify(bp.recoverySource || null),
      versionActual: bp.versionActual ?? 1,
      createdAt: bp.createdAt ? new Date(bp.createdAt) : undefined,
      updatedAt: bp.updatedAt ? new Date(bp.updatedAt) : undefined,
    },
    update: {
      docenteId: bp.docenteId,
      periodoId: bp.periodoId,
      tema: bp.tema,
      activo: bp.activo !== false,
      archivadoEn: bp.archivadoEn ? new Date(bp.archivadoEn) : null,
      recoverySource: typeof bp.recoverySource === 'string' ? bp.recoverySource : JSON.stringify(bp.recoverySource || null),
      versionActual: bp.versionActual ?? 1,
      updatedAt: bp.updatedAt ? new Date(bp.updatedAt) : undefined,
    }
  });

  if (Array.isArray(bp.versiones)) {
    for (const v of bp.versiones) {
      const vId = v.id ?? v._id;
      await prisma.versionPregunta.upsert({
        where: { id: vId },
        create: {
          id: vId,
          preguntaId: id,
          numeroVersion: v.numeroVersion,
          enunciado: v.enunciado,
          imagenUrl: v.imagenUrl,
          createdAt: v.createdAt ? new Date(v.createdAt) : undefined,
          updatedAt: v.updatedAt ? new Date(v.updatedAt) : undefined,
        },
        update: {
          numeroVersion: v.numeroVersion,
          enunciado: v.enunciado,
          imagenUrl: v.imagenUrl,
          updatedAt: v.updatedAt ? new Date(v.updatedAt) : undefined,
        }
      });

      if (Array.isArray(v.opciones)) {
        for (const o of v.opciones) {
          const oId = o.id ?? o._id;
          await prisma.opcionPregunta.upsert({
            where: { id: oId },
            create: {
              id: oId,
              versionPreguntaId: vId,
              texto: o.texto,
              esCorrecta: o.esCorrecta,
              createdAt: o.createdAt ? new Date(o.createdAt) : undefined,
              updatedAt: o.updatedAt ? new Date(o.updatedAt) : undefined,
            },
            update: {
              texto: o.texto,
              esCorrecta: o.esCorrecta,
              updatedAt: o.updatedAt ? new Date(o.updatedAt) : undefined,
            }
          });
        }
      }
    }
  }
}

async function restaurarTemaBanco(t: any) {
  if (!t) return;
  const id = t.id ?? t._id;
  await prisma.temaBanco.upsert({
    where: { id },
    create: {
      id,
      docenteId: t.docenteId,
      periodoId: t.periodoId,
      nombre: t.nombre,
      clave: t.clave,
      activo: t.activo !== false,
      archivadoEn: t.archivadoEn ? new Date(t.archivadoEn) : null,
      createdAt: t.createdAt ? new Date(t.createdAt) : undefined,
      updatedAt: t.updatedAt ? new Date(t.updatedAt) : undefined,
    },
    update: {
      docenteId: t.docenteId,
      periodoId: t.periodoId,
      nombre: t.nombre,
      clave: t.clave,
      activo: t.activo !== false,
      archivadoEn: t.archivadoEn ? new Date(t.archivadoEn) : null,
      updatedAt: t.updatedAt ? new Date(t.updatedAt) : undefined,
    }
  });
}

async function restaurarExamenPlantilla(ep: any) {
  if (!ep) return;
  const id = ep.id ?? ep._id;
  await prisma.examenPlantilla.upsert({
    where: { id },
    create: {
      id,
      docenteId: ep.docenteId,
      periodoId: ep.periodoId,
      tipo: ep.tipo,
      titulo: ep.titulo,
      tituloNormalizado: ep.tituloNormalizado,
      instrucciones: ep.instrucciones,
      numeroPaginas: ep.numeroPaginas ?? 1,
      reactivosObjetivo: ep.reactivosObjetivo ?? 20,
      defaultVersionCount: ep.defaultVersionCount ?? 1,
      answerKeyMode: ep.answerKeyMode ?? 'digital',
      temas: typeof ep.temas === 'string' ? ep.temas : JSON.stringify(ep.temas || []),
      archivadoEn: ep.archivadoEn ? new Date(ep.archivadoEn) : null,
      bookletConfig: typeof ep.bookletConfig === 'string' ? ep.bookletConfig : JSON.stringify(ep.bookletConfig || {}),
      omrConfig: typeof ep.omrConfig === 'string' ? ep.omrConfig : JSON.stringify(ep.omrConfig || {}),
      configuracionPdf: typeof ep.configuracionPdf === 'string' ? ep.configuracionPdf : JSON.stringify(ep.configuracionPdf || {}),
      createdAt: ep.createdAt ? new Date(ep.createdAt) : undefined,
      updatedAt: ep.updatedAt ? new Date(ep.updatedAt) : undefined,
    },
    update: {
      docenteId: ep.docenteId,
      periodoId: ep.periodoId,
      tipo: ep.tipo,
      titulo: ep.titulo,
      tituloNormalizado: ep.tituloNormalizado,
      instrucciones: ep.instrucciones,
      numeroPaginas: ep.numeroPaginas ?? 1,
      reactivosObjetivo: ep.reactivosObjetivo ?? 20,
      defaultVersionCount: ep.defaultVersionCount ?? 1,
      answerKeyMode: ep.answerKeyMode ?? 'digital',
      temas: typeof ep.temas === 'string' ? ep.temas : JSON.stringify(ep.temas || []),
      archivadoEn: ep.archivadoEn ? new Date(ep.archivadoEn) : null,
      bookletConfig: typeof ep.bookletConfig === 'string' ? ep.bookletConfig : JSON.stringify(ep.bookletConfig || {}),
      omrConfig: typeof ep.omrConfig === 'string' ? ep.omrConfig : JSON.stringify(ep.omrConfig || {}),
      configuracionPdf: typeof ep.configuracionPdf === 'string' ? ep.configuracionPdf : JSON.stringify(ep.configuracionPdf || {}),
      updatedAt: ep.updatedAt ? new Date(ep.updatedAt) : undefined,
    }
  });

  const preguntasIds = ep.preguntasIds ?? ep.preguntas;
  if (Array.isArray(preguntasIds)) {
    for (let i = 0; i < preguntasIds.length; i++) {
      const preguntaId = String(preguntasIds[i]);
      await prisma.preguntaPlantilla.upsert({
        where: { plantillaId_preguntaId: { plantillaId: id, preguntaId } },
        create: {
          plantillaId: id,
          preguntaId,
          orden: i
        },
        update: {
          orden: i
        }
      });
    }
  }
}

async function restaurarExamenGenerado(eg: any) {
  if (!eg) return;
  const id = eg.id ?? eg._id;
  await prisma.examenGenerado.upsert({
    where: { id },
    create: {
      id,
      docenteId: eg.docenteId,
      periodoId: eg.periodoId,
      plantillaId: eg.plantillaId,
      alumnoId: eg.alumnoId,
      loteId: eg.loteId,
      origenGeneracion: eg.origenGeneracion ?? 'individual',
      folio: eg.folio,
      estado: eg.estado ?? 'generado',
      entregadoEn: eg.entregadoEn ? new Date(eg.entregadoEn) : null,
      mapaVariante: typeof eg.mapaVariante === 'string' ? eg.mapaVariante : JSON.stringify(eg.mapaVariante || {}),
      mapaOmr: typeof eg.mapaOmr === 'string' ? eg.mapaOmr : JSON.stringify(eg.mapaOmr || null),
      paginas: typeof eg.paginas === 'string' ? eg.paginas : JSON.stringify(eg.paginas || []),
      rutaPdf: eg.rutaPdf,
      bookletArtifact: typeof eg.bookletArtifact === 'string' ? eg.bookletArtifact : JSON.stringify(eg.bookletArtifact || null),
      omrSheetArtifact: typeof eg.omrSheetArtifact === 'string' ? eg.omrSheetArtifact : JSON.stringify(eg.omrSheetArtifact || null),
      studentPacketArtifacts: typeof eg.studentPacketArtifacts === 'string' ? eg.studentPacketArtifacts : JSON.stringify(eg.studentPacketArtifacts || []),
      studentPacketZipArtifact: typeof eg.studentPacketZipArtifact === 'string' ? eg.studentPacketZipArtifact : JSON.stringify(eg.studentPacketZipArtifact || null),
      manifestArtifact: typeof eg.manifestArtifact === 'string' ? eg.manifestArtifact : JSON.stringify(eg.manifestArtifact || null),
      answerKeyArtifact: typeof eg.answerKeyArtifact === 'string' ? eg.answerKeyArtifact : JSON.stringify(eg.answerKeyArtifact || null),
      recoveryKeyId: eg.recoveryKeyId,
      recoveryManifestHash: eg.recoveryManifestHash,
      recoveryManifest: typeof eg.recoveryManifest === 'string' ? eg.recoveryManifest : JSON.stringify(eg.recoveryManifest || null),
      recoveryBundleId: eg.recoveryBundleId,
      recoveryBundleHash: eg.recoveryBundleHash,
      reconstructedFrom: typeof eg.reconstructedFrom === 'string' ? eg.reconstructedFrom : JSON.stringify(eg.reconstructedFrom || null),
      questionMap: typeof eg.questionMap === 'string' ? eg.questionMap : JSON.stringify(eg.questionMap || null),
      answerKeySet: typeof eg.answerKeySet === 'string' ? eg.answerKeySet : JSON.stringify(eg.answerKeySet || null),
      versionSet: typeof eg.versionSet === 'string' ? eg.versionSet : JSON.stringify(eg.versionSet || []),
      sheetInstances: typeof eg.sheetInstances === 'string' ? eg.sheetInstances : JSON.stringify(eg.sheetInstances || []),
      generationSeed: eg.generationSeed,
      previewFingerprint: eg.previewFingerprint,
      statisticsSummary: typeof eg.statisticsSummary === 'string' ? eg.statisticsSummary : JSON.stringify(eg.statisticsSummary || null),
      omrRuntimeVersion: eg.omrRuntimeVersion,
      retentionStatus: eg.retentionStatus ?? 'active',
      artifactsPurgedAt: eg.artifactsPurgedAt ? new Date(eg.artifactsPurgedAt) : null,
      artifactsPurgeReason: eg.artifactsPurgeReason,
      generadoEn: eg.generadoEn ? new Date(eg.generadoEn) : new Date(),
      descargadoEn: eg.descargadoEn ? new Date(eg.descargadoEn) : null,
      archivadoEn: eg.archivadoEn ? new Date(eg.archivadoEn) : null,
      createdAt: eg.createdAt ? new Date(eg.createdAt) : undefined,
      updatedAt: eg.updatedAt ? new Date(eg.updatedAt) : undefined,
    },
    update: {
      docenteId: eg.docenteId,
      periodoId: eg.periodoId,
      plantillaId: eg.plantillaId,
      alumnoId: eg.alumnoId,
      loteId: eg.loteId,
      origenGeneracion: eg.origenGeneracion ?? 'individual',
      folio: eg.folio,
      estado: eg.estado ?? 'generado',
      entregadoEn: eg.entregadoEn ? new Date(eg.entregadoEn) : null,
      mapaVariante: typeof eg.mapaVariante === 'string' ? eg.mapaVariante : JSON.stringify(eg.mapaVariante || {}),
      mapaOmr: typeof eg.mapaOmr === 'string' ? eg.mapaOmr : JSON.stringify(eg.mapaOmr || null),
      paginas: typeof eg.paginas === 'string' ? eg.paginas : JSON.stringify(eg.paginas || []),
      rutaPdf: eg.rutaPdf,
      bookletArtifact: typeof eg.bookletArtifact === 'string' ? eg.bookletArtifact : JSON.stringify(eg.bookletArtifact || null),
      omrSheetArtifact: typeof eg.omrSheetArtifact === 'string' ? eg.omrSheetArtifact : JSON.stringify(eg.omrSheetArtifact || null),
      studentPacketArtifacts: typeof eg.studentPacketArtifacts === 'string' ? eg.studentPacketArtifacts : JSON.stringify(eg.studentPacketArtifacts || []),
      studentPacketZipArtifact: typeof eg.studentPacketZipArtifact === 'string' ? eg.studentPacketZipArtifact : JSON.stringify(eg.studentPacketZipArtifact || null),
      manifestArtifact: typeof eg.manifestArtifact === 'string' ? eg.manifestArtifact : JSON.stringify(eg.manifestArtifact || null),
      answerKeyArtifact: typeof eg.answerKeyArtifact === 'string' ? eg.answerKeyArtifact : JSON.stringify(eg.answerKeyArtifact || null),
      recoveryKeyId: eg.recoveryKeyId,
      recoveryManifestHash: eg.recoveryManifestHash,
      recoveryManifest: typeof eg.recoveryManifest === 'string' ? eg.recoveryManifest : JSON.stringify(eg.recoveryManifest || null),
      recoveryBundleId: eg.recoveryBundleId,
      recoveryBundleHash: eg.recoveryBundleHash,
      reconstructedFrom: typeof eg.reconstructedFrom === 'string' ? eg.reconstructedFrom : JSON.stringify(eg.reconstructedFrom || null),
      questionMap: typeof eg.questionMap === 'string' ? eg.questionMap : JSON.stringify(eg.questionMap || null),
      answerKeySet: typeof eg.answerKeySet === 'string' ? eg.answerKeySet : JSON.stringify(eg.answerKeySet || null),
      versionSet: typeof eg.versionSet === 'string' ? eg.versionSet : JSON.stringify(eg.versionSet || []),
      sheetInstances: typeof eg.sheetInstances === 'string' ? eg.sheetInstances : JSON.stringify(eg.sheetInstances || []),
      generationSeed: eg.generationSeed,
      previewFingerprint: eg.previewFingerprint,
      statisticsSummary: typeof eg.statisticsSummary === 'string' ? eg.statisticsSummary : JSON.stringify(eg.statisticsSummary || null),
      omrRuntimeVersion: eg.omrRuntimeVersion,
      retentionStatus: eg.retentionStatus ?? 'active',
      artifactsPurgedAt: eg.artifactsPurgedAt ? new Date(eg.artifactsPurgedAt) : null,
      artifactsPurgeReason: eg.artifactsPurgeReason,
      generadoEn: eg.generadoEn ? new Date(eg.generadoEn) : new Date(),
      descargadoEn: eg.descargadoEn ? new Date(eg.descargadoEn) : null,
      archivadoEn: eg.archivadoEn ? new Date(eg.archivadoEn) : null,
      updatedAt: eg.updatedAt ? new Date(eg.updatedAt) : undefined,
    }
  });
}

async function restaurarEntrega(ent: any) {
  if (!ent) return;
  const id = ent.id ?? ent._id;
  await prisma.entrega.upsert({
    where: { id },
    create: {
      id,
      examenGeneradoId: ent.examenGeneradoId,
      alumnoId: ent.alumnoId,
      docenteId: ent.docenteId,
      estado: ent.estado ?? 'pendiente',
      fechaEntrega: ent.fechaEntrega ? new Date(ent.fechaEntrega) : null,
      acordeonEntregado: ent.acordeonEntregado === true,
      bonoAcordeon: ent.bonoAcordeon ?? 0,
      motivoDeshacer: ent.motivoDeshacer,
      createdAt: ent.createdAt ? new Date(ent.createdAt) : undefined,
      updatedAt: ent.updatedAt ? new Date(ent.updatedAt) : undefined,
    },
    update: {
      examenGeneradoId: ent.examenGeneradoId,
      alumnoId: ent.alumnoId,
      docenteId: ent.docenteId,
      estado: ent.estado ?? 'pendiente',
      fechaEntrega: ent.fechaEntrega ? new Date(ent.fechaEntrega) : null,
      acordeonEntregado: ent.acordeonEntregado === true,
      bonoAcordeon: ent.bonoAcordeon ?? 0,
      motivoDeshacer: ent.motivoDeshacer,
      updatedAt: ent.updatedAt ? new Date(ent.updatedAt) : undefined,
    }
  });
}

async function restaurarCalificacion(c: any) {
  if (!c) return;
  const id = c.id ?? c._id;
  await prisma.calificacion.upsert({
    where: { id },
    create: {
      id,
      docenteId: c.docenteId,
      periodoId: c.periodoId,
      examenGeneradoId: c.examenGeneradoId,
      alumnoId: c.alumnoId,
      tipoExamen: c.tipoExamen,
      totalReactivos: c.totalReactivos,
      aciertos: c.aciertos,
      fraccion: typeof c.fraccion === 'string' ? c.fraccion : JSON.stringify(c.fraccion || {}),
      calificacionExamenTexto: c.calificacionExamenTexto,
      bonoTexto: c.bonoTexto,
      calificacionExamenFinalTexto: c.calificacionExamenFinalTexto,
      evaluacionContinuaTexto: c.evaluacionContinuaTexto,
      proyectoTexto: c.proyectoTexto,
      calificacionParcialTexto: c.calificacionParcialTexto,
      calificacionGlobalTexto: c.calificacionGlobalTexto,
      retroalimentacion: c.retroalimentacion,
      respuestasDetectadas: typeof c.respuestasDetectadas === 'string' ? c.respuestasDetectadas : JSON.stringify(c.respuestasDetectadas || null),
      omrAuditoria: typeof c.omrAuditoria === 'string' ? c.omrAuditoria : JSON.stringify(c.omrAuditoria || null),
      politicaId: c.politicaId,
      versionPolitica: c.versionPolitica,
      componentesExamen: typeof c.componentesExamen === 'string' ? c.componentesExamen : JSON.stringify(c.componentesExamen || null),
      bloqueContinuaDecimal: c.bloqueContinuaDecimal,
      bloqueExamenesDecimal: c.bloqueExamenesDecimal,
      finalDecimal: c.finalDecimal,
      finalRedondeada: c.finalRedondeada,
      createdAt: c.createdAt ? new Date(c.createdAt) : undefined,
      updatedAt: c.updatedAt ? new Date(c.updatedAt) : undefined,
    },
    update: {
      docenteId: c.docenteId,
      periodoId: c.periodoId,
      examenGeneradoId: c.examenGeneradoId,
      alumnoId: c.alumnoId,
      tipoExamen: c.tipoExamen,
      totalReactivos: c.totalReactivos,
      aciertos: c.aciertos,
      fraccion: typeof c.fraccion === 'string' ? c.fraccion : JSON.stringify(c.fraccion || {}),
      calificacionExamenTexto: c.calificacionExamenTexto,
      bonoTexto: c.bonoTexto,
      calificacionExamenFinalTexto: c.calificacionExamenFinalTexto,
      evaluacionContinuaTexto: c.evaluacionContinuaTexto,
      proyectoTexto: c.proyectoTexto,
      calificacionParcialTexto: c.calificacionParcialTexto,
      calificacionGlobalTexto: c.calificacionGlobalTexto,
      retroalimentacion: c.retroalimentacion,
      respuestasDetectadas: typeof c.respuestasDetectadas === 'string' ? c.respuestasDetectadas : JSON.stringify(c.respuestasDetectadas || null),
      omrAuditoria: typeof c.omrAuditoria === 'string' ? c.omrAuditoria : JSON.stringify(c.omrAuditoria || null),
      politicaId: c.politicaId,
      versionPolitica: c.versionPolitica,
      componentesExamen: typeof c.componentesExamen === 'string' ? c.componentesExamen : JSON.stringify(c.componentesExamen || null),
      bloqueContinuaDecimal: c.bloqueContinuaDecimal,
      bloqueExamenesDecimal: c.bloqueExamenesDecimal,
      finalDecimal: c.finalDecimal,
      finalRedondeada: c.finalRedondeada,
      updatedAt: c.updatedAt ? new Date(c.updatedAt) : undefined,
    }
  });
}

async function restaurarBanderaRevision(b: any) {
  if (!b) return;
  const id = b.id ?? b._id;
  await prisma.banderaRevision.upsert({
    where: { id },
    create: {
      id,
      examenGeneradoId: b.examenGeneradoId,
      alumnoId: b.alumnoId,
      docenteId: b.docenteId,
      motivo: b.motivo,
      createdAt: b.createdAt ? new Date(b.createdAt) : undefined,
      updatedAt: b.updatedAt ? new Date(b.updatedAt) : undefined,
    },
    update: {
      examenGeneradoId: b.examenGeneradoId,
      alumnoId: b.alumnoId,
      docenteId: b.docenteId,
      motivo: b.motivo,
      updatedAt: b.updatedAt ? new Date(b.updatedAt) : undefined,
    }
  });
}

async function restaurarCodigoAcceso(ca: any) {
  if (!ca) return;
  const id = ca.id ?? ca._id;
  await prisma.codigoAcceso.upsert({
    where: { id },
    create: {
      id,
      docenteId: ca.docenteId,
      periodoId: ca.periodoId,
      codigo: ca.codigo,
      expiraEn: new Date(ca.expiraEn),
      usado: ca.usado === true,
      createdAt: ca.createdAt ? new Date(ca.createdAt) : undefined,
      updatedAt: ca.updatedAt ? new Date(ca.updatedAt) : undefined,
    },
    update: {
      docenteId: ca.docenteId,
      periodoId: ca.periodoId,
      codigo: ca.codigo,
      expiraEn: new Date(ca.expiraEn),
      usado: ca.usado === true,
      updatedAt: ca.updatedAt ? new Date(ca.updatedAt) : undefined,
    }
  });
}

export async function listarPapelera(req: SolicitudDocente, res: Response) {
  validarAdminDev();
  const docenteId = obtenerDocenteId(req);
  const limite = Number(req.query.limite ?? 50);

  const items = await prisma.papeleraItem.findMany({
    where: { docenteId },
    orderBy: { createdAt: 'desc' },
    take: limite > 0 ? limite : 50
  });

  const mappedItems = items.map((item) => ({
    _id: item.id,
    id: item.id,
    docenteId: item.docenteId,
    tipo: item.tipo,
    entidadId: item.itemId,
    payload: JSON.parse(item.datosJson),
    eliminadoEn: item.createdAt,
    expiraEn: new Date(item.createdAt.getTime() + 45 * 24 * 60 * 60 * 1000), // 45 days TTL mock
    createdAt: item.createdAt,
    updatedAt: item.createdAt
  }));

  res.json({ items: mappedItems });
}

export async function restaurarPapelera(req: SolicitudDocente, res: Response) {
  validarAdminDev();
  const docenteId = obtenerDocenteId(req);
  const id = String(req.params.id ?? '').trim();

  const item = await prisma.papeleraItem.findFirst({
    where: { id, docenteId }
  });
  if (!item) {
    throw new ErrorAplicacion('PAPELERA_NO_ENCONTRADA', 'Elemento no encontrado en papelera', 404);
  }

  const payload = JSON.parse(item.datosJson);
  const tipo = item.tipo;

  if (tipo === 'plantilla') {
    if (payload.plantilla) await restaurarExamenPlantilla(payload.plantilla);
    if (Array.isArray(payload.examenes)) {
      for (const e of payload.examenes) await restaurarExamenGenerado(e);
    }
    if (Array.isArray(payload.entregas)) {
      for (const ent of payload.entregas) await restaurarEntrega(ent);
    }
    if (Array.isArray(payload.calificaciones)) {
      for (const c of payload.calificaciones) await restaurarCalificacion(c);
    }
    if (Array.isArray(payload.banderas)) {
      for (const b of payload.banderas) await restaurarBanderaRevision(b);
    }
  } else if (tipo === 'alumno') {
    if (payload.alumno) await restaurarAlumno(payload.alumno);
    if (Array.isArray(payload.examenes)) {
      for (const e of payload.examenes) await restaurarExamenGenerado(e);
    }
    if (Array.isArray(payload.entregas)) {
      for (const ent of payload.entregas) await restaurarEntrega(ent);
    }
    if (Array.isArray(payload.calificaciones)) {
      for (const c of payload.calificaciones) await restaurarCalificacion(c);
    }
    if (Array.isArray(payload.banderas)) {
      for (const b of payload.banderas) await restaurarBanderaRevision(b);
    }
  } else if (tipo === 'periodo') {
    if (payload.periodo) await restaurarPeriodo(payload.periodo);
    if (Array.isArray(payload.alumnos)) {
      for (const a of payload.alumnos) await restaurarAlumno(a);
    }
    if (Array.isArray(payload.bancoPreguntas)) {
      for (const bp of payload.bancoPreguntas) await restaurarBancoPregunta(bp);
    }
    if (Array.isArray(payload.temas)) {
      for (const t of payload.temas) await restaurarTemaBanco(t);
    }
    if (Array.isArray(payload.plantillas)) {
      for (const ep of payload.plantillas) await restaurarExamenPlantilla(ep);
    }
    if (Array.isArray(payload.examenes)) {
      for (const e of payload.examenes) await restaurarExamenGenerado(e);
    }
    if (Array.isArray(payload.entregas)) {
      for (const ent of payload.entregas) await restaurarEntrega(ent);
    }
    if (Array.isArray(payload.calificaciones)) {
      for (const c of payload.calificaciones) await restaurarCalificacion(c);
    }
    if (Array.isArray(payload.banderas)) {
      for (const b of payload.banderas) await restaurarBanderaRevision(b);
    }
    if (Array.isArray(payload.codigosAcceso)) {
      for (const ca of payload.codigosAcceso) await restaurarCodigoAcceso(ca);
    }
  } else {
    throw new ErrorAplicacion('PAPELERA_TIPO', 'Tipo de papelera no soportado', 400);
  }

  await prisma.papeleraItem.delete({
    where: { id }
  });

  res.json({ ok: true });
}
