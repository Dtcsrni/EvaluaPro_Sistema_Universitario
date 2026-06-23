import { promises as fs } from 'fs';
import { ErrorAplicacion } from '../../../../compartido/errores/errorAplicacion';
import { Alumno } from '../../../modulo_alumnos/modeloAlumno';
import { Periodo } from '../../../modulo_alumnos/modeloPeriodo';
import { Calificacion } from '../../../modulo_calificacion/modeloCalificacion';
import { BancoPregunta } from '../../../modulo_banco_preguntas/modeloBancoPregunta';
import { ExamenGenerado } from '../../../modulo_generacion_pdf/modeloExamenGenerado';
import { BanderaRevision } from '../../../modulo_analiticas/modeloBanderaRevision';
import { ResumenEvaluacionAlumno } from '../../../modulo_evaluaciones/modeloResumenEvaluacionAlumno';
import { CodigoAcceso } from '../../modeloCodigoAcceso';
import { Sincronizacion } from '../../modeloSincronizacion';
import { comprimirBase64, construirComparativaRespuestas } from '../../sincronizacionInterna';
import { crearClientePortal } from '../../infra/portalSyncClient';
import { leerCapturasOmrParaPortal } from '../../infra/omrCapturas';
import { syncClock } from '../../infra/repositoriosSync';
import { construirColeccionesAcademicasPortal } from '../../domain/portalAcademicoAssembler';

export async function publicarResultadosUseCase(params: { docenteId: string; periodoId: string }) {
  const { docenteId, periodoId } = params;
  const portal = crearClientePortal('PORTAL_NO_CONFIG');

  const periodo = await Periodo.findOne({ _id: periodoId, docenteId }).lean();
  if (!periodo) {
    throw new ErrorAplicacion('PERIODO_NO_ENCONTRADO', 'Periodo no encontrado', 404);
  }

  const alumnos = await Alumno.find({ docenteId, periodoId }).lean();
  const calificaciones = await Calificacion.find({ docenteId, periodoId }).lean();
  const resumenesEvaluacion = await ResumenEvaluacionAlumno.find({ docenteId, periodoId }).lean();
  const banderas = await BanderaRevision.find({ docenteId }).lean();
  const examenes = await ExamenGenerado.find({ docenteId, periodoId }).lean();

  const resumenPorAlumno = new Map<string, any>(
    resumenesEvaluacion.map((item: any) => [
      String(item.alumnoId),
      {
        politicaId: String(item.politicaCodigo || '').trim() || undefined,
        versionPolitica: Number(item.politicaVersion),
        componentesExamen: item.examenesPorCorte,
        bloqueContinuaDecimal: Number(item.bloqueContinuaDecimal),
        bloqueExamenesDecimal: Number(item.bloqueExamenesDecimal),
        finalDecimal: Number(item.finalDecimal),
        finalRedondeada: Number(item.finalRedondeada)
      }
    ])
  );

  const capturasOmrPorExamen = new Map<string, Awaited<ReturnType<typeof leerCapturasOmrParaPortal>>>();
  for (const examen of examenes) {
    const examenId = String((examen as unknown as { _id?: unknown })?._id ?? '').trim();
    const folio = String((examen as unknown as { folio?: unknown })?.folio ?? '').trim();
    if (!examenId || !folio) continue;
    const capturas = await leerCapturasOmrParaPortal(folio);
    if (capturas.length > 0) capturasOmrPorExamen.set(examenId, capturas);
  }

  const examenesMap = new Map<string, Record<string, unknown>>(examenes.map((examen: any) => [String(examen._id), examen as Record<string, unknown>]));
  const preguntasIds = Array.from(
    new Set(
      examenes
        .flatMap((examen: any) => {
          const orden = (examen.mapaVariante?.ordenPreguntas ?? []) as unknown[];
          return Array.isArray(orden) ? orden : [];
        })
        .map((id: any) => String(id))
        .filter(Boolean)
    )
  );
  const preguntasDb = preguntasIds.length ? await BancoPregunta.find({ _id: { $in: preguntasIds } }).lean() : [];
  const codigo = await CodigoAcceso.findOne({ docenteId, periodoId, usado: false }).lean();

  const examenesPayload: Array<Record<string, unknown>> = [];
  for (const examen of examenes) {
    let pdfComprimidoBase64: string | undefined;
    if (examen.rutaPdf) {
      try {
        const contenido = await fs.readFile(examen.rutaPdf);
        pdfComprimidoBase64 = comprimirBase64(contenido);
      } catch {
        // best-effort
      }
    }
    examenesPayload.push({
      examenGeneradoId: examen._id,
      folio: examen.folio,
      pdfComprimidoBase64
    });
  }

  const payload = {
    schemaVersion: 3,
    docenteId,
    periodo: { _id: periodo._id },
    alumnos: alumnos.map((alumno: any) => ({
      _id: alumno._id,
      matricula: alumno.matricula,
      nombreCompleto: alumno.nombreCompleto,
      grupo: alumno.grupo
    })),
    calificaciones: calificaciones.map((calificacion: any) => ({
      ...(() => {
        const resumenAlumno = resumenPorAlumno.get(String(calificacion.alumnoId));
        const respuestasDetectadas = Array.isArray(calificacion.respuestasDetectadas)
          ? (calificacion.respuestasDetectadas as Array<{ numeroPregunta?: unknown; opcion?: unknown; confianza?: unknown }>)
              .map((respuesta: any) => ({
                numeroPregunta: Number(respuesta?.numeroPregunta),
                opcion: typeof respuesta?.opcion === 'string' ? respuesta.opcion.toUpperCase() : null,
                ...(typeof respuesta?.confianza === 'number' ? { confianza: respuesta.confianza } : {})
              }))
              .filter((respuesta: any) => Number.isInteger(respuesta.numeroPregunta) && respuesta.numeroPregunta > 0)
          : [];

        return {
          politicaId: resumenAlumno?.politicaId ?? calificacion.politicaId,
          versionPolitica:
            Number.isFinite(Number(resumenAlumno?.versionPolitica)) && Number(resumenAlumno?.versionPolitica) > 0
              ? Number(resumenAlumno?.versionPolitica)
              : calificacion.versionPolitica,
          componentesExamen: resumenAlumno?.componentesExamen ?? calificacion.componentesExamen,
          bloqueContinuaDecimal:
            Number.isFinite(Number(resumenAlumno?.bloqueContinuaDecimal))
              ? Number(resumenAlumno?.bloqueContinuaDecimal)
              : calificacion.bloqueContinuaDecimal,
          bloqueExamenesDecimal:
            Number.isFinite(Number(resumenAlumno?.bloqueExamenesDecimal))
              ? Number(resumenAlumno?.bloqueExamenesDecimal)
              : calificacion.bloqueExamenesDecimal,
          finalDecimal:
            Number.isFinite(Number(resumenAlumno?.finalDecimal))
              ? Number(resumenAlumno?.finalDecimal)
              : calificacion.finalDecimal,
          finalRedondeada:
            Number.isFinite(Number(resumenAlumno?.finalRedondeada))
              ? Number(resumenAlumno?.finalRedondeada)
              : calificacion.finalRedondeada,
          respuestasDetectadas,
          comparativaRespuestas: construirComparativaRespuestas(
            examenesMap.get(String(calificacion.examenGeneradoId)),
            preguntasDb as Array<Record<string, unknown>>,
            respuestasDetectadas
          )
        };
      })(),
      docenteId: calificacion.docenteId,
      alumnoId: calificacion.alumnoId,
      examenGeneradoId: calificacion.examenGeneradoId,
      tipoExamen: calificacion.tipoExamen,
      totalReactivos: calificacion.totalReactivos,
      aciertos: calificacion.aciertos,
      calificacionExamenFinalTexto: calificacion.calificacionExamenFinalTexto,
      calificacionParcialTexto: calificacion.calificacionParcialTexto,
      calificacionGlobalTexto: calificacion.calificacionGlobalTexto,
      evaluacionContinuaTexto: calificacion.evaluacionContinuaTexto,
      proyectoTexto: calificacion.proyectoTexto,
      omrCapturas: capturasOmrPorExamen.get(String(calificacion.examenGeneradoId)) ?? [],
      omrAuditoria: calificacion.omrAuditoria && typeof calificacion.omrAuditoria === 'object' ? calificacion.omrAuditoria : undefined
    })),
    examenes: examenesPayload,
    banderas: banderas.map((bandera: any) => ({
      examenGeneradoId: bandera.examenGeneradoId,
      alumnoId: bandera.alumnoId,
      tipo: bandera.tipo,
      severidad: bandera.severidad,
      descripcion: bandera.descripcion,
      sugerencia: bandera.sugerencia
    })),
    codigoAcceso: codigo ? { codigo: codigo.codigo, expiraEn: codigo.expiraEn } : null,
    ...construirColeccionesAcademicasPortal({
      periodo: periodo as unknown as Record<string, unknown>,
      alumnos: alumnos as unknown as Array<Record<string, unknown>>,
      calificaciones: calificaciones as unknown as Array<Record<string, unknown>>,
      examenes: examenes as unknown as Array<Record<string, unknown>>
    })
  };

  const respuesta = await portal.postJson<Record<string, unknown>>('/api/portal/sincronizar', payload);

  const estado = respuesta.ok ? 'exitoso' : 'fallido';
  await Sincronizacion.create({
    docenteId,
    estado,
    tipo: 'publicacion',
    detalles: { periodoId, status: respuesta.status },
    ejecutadoEn: syncClock.now()
  });

  if (!respuesta.ok) {
    console.error('PORTAL SYNC FAILED:', { status: respuesta.status, payload: respuesta.payload });
    throw new ErrorAplicacion('PUBLICACION_FALLIDA', 'No se pudo publicar en la nube', 502);
  }

  return { mensaje: 'Publicacion enviada' };
}
