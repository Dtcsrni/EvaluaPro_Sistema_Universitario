/**
 * Dominio de paquetes de sincronizacion (export/import).
 */
import { promises as fs } from 'fs';
import { gunzipSync, gzipSync } from 'zlib';
import { ErrorAplicacion } from '../../../compartido/errores/errorAplicacion';
import { guardarPdfExamen } from '../../../infraestructura/archivos/almacenLocal';
import { prisma } from '../../../infraestructura/baseDatos/sqlite';
import { Alumno } from '../../modulo_alumnos/modeloAlumno';
import { Periodo } from '../../modulo_alumnos/modeloPeriodo';
import { BanderaRevision } from '../../modulo_analiticas/modeloBanderaRevision';
import { BancoPregunta } from '../../modulo_banco_preguntas/modeloBancoPregunta';
import { Calificacion } from '../../modulo_calificacion/modeloCalificacion';
import { ExamenGenerado } from '../../modulo_generacion_pdf/modeloExamenGenerado';
import { ExamenPlantilla } from '../../modulo_generacion_pdf/modeloExamenPlantilla';
import { Entrega } from '../../modulo_vinculacion_entrega/modeloEntrega';
import { Sincronizacion } from '../modeloSincronizacion';
import {
  MAX_BASE64_CHARS,
  normalizarCorreo,
  obtenerCampo,
  obtenerIdTexto,
  parsearFechaIso,
  cifrarRespaldo,
  descifrarRespaldo,
  sha256Hex,
  sha256HexBuffer,
  upsertLwwPorUpdatedAt,
  type ModelLike,
  type PaqueteSincronizacionV2
} from '../sincronizacionInterna';
import type { PaqueteAssembler, PaqueteProcessor, ResultadoImportacionPaquete } from '../shared/tiposSync';

const MAX_PDFS = 120;
const MAX_TOTAL_COMPRESSED_BYTES = 25 * 1024 * 1024;
const BACKUP_LOGIC_FINGERPRINT = 'sync-v2-lww-updatedAt-schema2';

async function obtenerCorreoDocente(docenteId: string): Promise<string> {
  const docente = await prisma.docente.findUnique({ where: { id: docenteId }, select: { correo: true } });
  const correo = normalizarCorreo((docente as { correo?: unknown })?.correo);
  if (!correo) {
    throw new ErrorAplicacion('DOCENTE_NO_ENCONTRADO', 'Docente no encontrado', 404);
  }
  return correo;
}

export function validarTamanoPaqueteBase64(paqueteBase64: string) {
  if (!paqueteBase64) {
    throw new ErrorAplicacion('SYNC_PAQUETE_VACIO', 'Paquete vacio', 400);
  }
  if (paqueteBase64.length > MAX_BASE64_CHARS) {
    throw new ErrorAplicacion('SYNC_PAQUETE_GRANDE', 'Paquete demasiado grande', 413);
  }
}

export class DefaultPaqueteAssembler implements PaqueteAssembler {
  async generar(params: {
    docenteId: string;
    docenteCorreo?: string;
    periodoId?: string;
    desde?: Date | null;
    incluirPdfs: boolean;
  }) {
    const { docenteId, docenteCorreo, periodoId, desde, incluirPdfs } = params;
    const correo = docenteCorreo || (await obtenerCorreoDocente(docenteId));
    const filtroPeriodo = periodoId ? { _id: periodoId, docenteId } : { docenteId };
    const periodos = await Periodo.find(filtroPeriodo).lean();
    if (periodoId && periodos.length === 0) {
      throw new ErrorAplicacion('PERIODO_NO_ENCONTRADO', 'Periodo no encontrado', 404);
    }

    const periodoIds = periodos.map((p: unknown) => obtenerIdTexto(p)).filter(Boolean);
    const filtroDesde = (desde ? { updatedAt: { $gte: desde } } : {}) as Record<string, unknown>;
    const filtroPeriodoIds = periodoIds.length > 0 ? { periodoId: { $in: periodoIds } } : {};

    const [alumnos, bancoPreguntas, plantillas, examenes, calificaciones] = await Promise.all([
      Alumno.find({ docenteId, ...filtroPeriodoIds, ...filtroDesde }).lean(),
      BancoPregunta.find({ docenteId, ...filtroPeriodoIds, ...filtroDesde }).lean(),
      ExamenPlantilla.find({ docenteId, ...filtroPeriodoIds, ...filtroDesde }).lean(),
      ExamenGenerado.find({ docenteId, ...filtroPeriodoIds, ...filtroDesde }).lean(),
      Calificacion.find({ docenteId, ...filtroPeriodoIds, ...filtroDesde }).lean()
    ]);

    const examenesIds = examenes.map((e: unknown) => obtenerIdTexto(e)).filter(Boolean);
    const [entregas, banderas] = await Promise.all([
      examenesIds.length > 0
        ? Entrega.find({ docenteId, examenGeneradoId: { $in: examenesIds }, ...filtroDesde }).lean()
        : Promise.resolve([]),
      examenesIds.length > 0
        ? BanderaRevision.find({ docenteId, examenGeneradoId: { $in: examenesIds }, ...filtroDesde }).lean()
        : Promise.resolve([])
    ]);

    const pdfs: Array<{ examenGeneradoId: string; pdfComprimidoBase64: string; pdfSha256?: string }> = [];
    if (incluirPdfs) {
      let total = 0;
      for (const examen of examenes.slice(0, MAX_PDFS)) {
        const examenId = String((examen as unknown as { _id?: unknown })?._id ?? '').trim();
        const rutaPdf = String((examen as unknown as { rutaPdf?: unknown })?.rutaPdf ?? '').trim();
        if (!examenId || !rutaPdf) continue;
        try {
          const contenido = await fs.readFile(rutaPdf);
          const pdfSha256 = sha256HexBuffer(contenido);
          const comprimido = gzipSync(contenido);
          total += comprimido.length;
          if (total > MAX_TOTAL_COMPRESSED_BYTES) break;
          pdfs.push({ examenGeneradoId: examenId, pdfComprimidoBase64: comprimido.toString('base64'), pdfSha256 });
        } catch {
          // best-effort
        }
      }
    }

    const exportadoEn = new Date().toISOString();
    const paquete: PaqueteSincronizacionV2 = {
      schemaVersion: 2,
      exportadoEn,
      docenteId: String(docenteId),
      docenteCorreo: correo || undefined,
      ...(periodoId ? { periodoId } : {}),
      ...(desde ? { desde: desde.toISOString() } : {}),
      conteos: {
        periodos: periodos.length,
        alumnos: alumnos.length,
        bancoPreguntas: bancoPreguntas.length,
        plantillas: plantillas.length,
        examenes: examenes.length,
        entregas: (entregas as unknown[]).length,
        calificaciones: calificaciones.length,
        banderas: (banderas as unknown[]).length,
        pdfs: pdfs.length
      },
      periodos: periodos as unknown[],
      alumnos: alumnos as unknown[],
      bancoPreguntas: bancoPreguntas as unknown[],
      plantillas: plantillas as unknown[],
      examenes: (examenes as unknown[]) as Array<Record<string, unknown>>,
      entregas: entregas as unknown[],
      calificaciones: calificaciones as unknown[],
      banderas: banderas as unknown[],
      pdfs
    };

    const json = JSON.stringify(paquete);
    const checksumSha256 = sha256Hex(json);
    const gzipBytes = gzipSync(Buffer.from(json));
    const respaldoCifrado = cifrarRespaldo(gzipBytes, correo);
    const paqueteBase64 = respaldoCifrado.toString('base64');

    return {
      paquete,
      paqueteBase64,
      checksumSha256,
      checksumGzipSha256: sha256HexBuffer(respaldoCifrado),
      cifrado: true,
      exportadoEn
    };
  }
}

export class DefaultPaqueteProcessor implements PaqueteProcessor {
  async procesar(params: {
    docenteId: string;
    paqueteBase64: string;
    checksumEsperado?: string;
    docenteCorreo?: string;
    dryRun: boolean;
    registroId?: unknown;
  }): Promise<ResultadoImportacionPaquete> {
    const { docenteId, paqueteBase64, checksumEsperado, docenteCorreo, dryRun, registroId } = params;
    validarTamanoPaqueteBase64(paqueteBase64);

    const paqueteBytes = Buffer.from(paqueteBase64, 'base64');
    const correoActual = await obtenerCorreoDocente(String(docenteId));
    const { gzipBytes } = descifrarRespaldo(paqueteBytes, correoActual);
    const buffer = gunzipSync(gzipBytes);
    const json = buffer.toString('utf8');
    const parsed = JSON.parse(json) as PaqueteSincronizacionV2;

    const checksumActual = sha256Hex(json);
    if (checksumEsperado && checksumEsperado.toLowerCase() !== checksumActual.toLowerCase()) {
      throw new ErrorAplicacion('SYNC_CHECKSUM', 'Checksum invalido: el paquete parece corrupto o fue modificado', 400);
    }

    if (!parsed || parsed.schemaVersion !== 2) {
      throw new ErrorAplicacion('SYNC_VERSION', 'Version de paquete no soportada', 400);
    }

    const docenteIdActual = String(docenteId);
    const docenteIdPaquete = String(parsed.docenteId || '').trim();
    if (!docenteIdPaquete) {
      throw new ErrorAplicacion('SYNC_DOCENTE_MISMATCH', 'El paquete no corresponde a este docente', 403);
    }

    const correoPaquete = normalizarCorreo(parsed.docenteCorreo || docenteCorreo);
    const idsCoinciden = docenteIdPaquete === docenteIdActual;
    const correosCoinciden = Boolean(correoPaquete && correoPaquete === correoActual);

    if (!idsCoinciden && !correosCoinciden) {
      throw new ErrorAplicacion('SYNC_DOCENTE_MISMATCH', 'El paquete no corresponde a este docente', 403);
    }

    const assertDocente = (docs: Array<Record<string, unknown>>, nombre: string, docenteEsperado: string) => {
      for (const doc of docs) {
        const d = String(obtenerCampo(doc, 'docenteId') ?? '');
        if (d && d !== docenteEsperado) {
          throw new ErrorAplicacion('SYNC_DOCENTE_MISMATCH', `El paquete contiene ${nombre} de otro docente`, 403);
        }
      }
    };

    const examenesDocs = Array.isArray(parsed.examenes) ? parsed.examenes : [];
    const examenesIds = examenesDocs.map((e) => obtenerIdTexto(e)).filter(Boolean);

    const resultados = [] as Array<Record<string, unknown>>;
    const periodosDocs = (Array.isArray(parsed.periodos) ? parsed.periodos : []) as Array<Record<string, unknown>>;
    const alumnosDocs = (Array.isArray(parsed.alumnos) ? parsed.alumnos : []) as Array<Record<string, unknown>>;
    const bancoDocs = (Array.isArray(parsed.bancoPreguntas) ? parsed.bancoPreguntas : []) as Array<Record<string, unknown>>;
    const plantillasDocs = (Array.isArray(parsed.plantillas) ? parsed.plantillas : []) as Array<Record<string, unknown>>;
    const entregasDocs = (Array.isArray(parsed.entregas) ? parsed.entregas : []) as Array<Record<string, unknown>>;
    const calificacionesDocs = (Array.isArray(parsed.calificaciones) ? parsed.calificaciones : []) as Array<Record<string, unknown>>;
    const banderasDocs = (Array.isArray(parsed.banderas) ? parsed.banderas : []) as Array<Record<string, unknown>>;

    assertDocente(periodosDocs, 'periodos', docenteIdPaquete);
    assertDocente(alumnosDocs, 'alumnos', docenteIdPaquete);
    assertDocente(bancoDocs, 'bancoPreguntas', docenteIdPaquete);
    assertDocente(plantillasDocs, 'plantillas', docenteIdPaquete);
    assertDocente(examenesDocs, 'examenes', docenteIdPaquete);
    assertDocente(entregasDocs, 'entregas', docenteIdPaquete);
    assertDocente(calificacionesDocs, 'calificaciones', docenteIdPaquete);
    assertDocente(banderasDocs, 'banderas', docenteIdPaquete);

    const forzarDocenteId = (docs: Array<Record<string, unknown>>, nuevoDocenteId: string) => {
      for (const doc of docs) {
        if (!doc || typeof doc !== 'object') continue;
        if (Object.prototype.hasOwnProperty.call(doc, 'docenteId')) {
          (doc as Record<string, unknown>).docenteId = nuevoDocenteId;
        }
      }
    };

    if (!idsCoinciden && correosCoinciden) {
      forzarDocenteId(periodosDocs, docenteIdActual);
      forzarDocenteId(alumnosDocs, docenteIdActual);
      forzarDocenteId(bancoDocs, docenteIdActual);
      forzarDocenteId(plantillasDocs, docenteIdActual);
      forzarDocenteId(examenesDocs, docenteIdActual);
      forzarDocenteId(entregasDocs, docenteIdActual);
      forzarDocenteId(calificacionesDocs, docenteIdActual);
      forzarDocenteId(banderasDocs, docenteIdActual);
    }

    if (dryRun) {
      if (registroId) {
        await Sincronizacion.updateOne(
          { _id: registroId },
          {
            $set: {
              estado: 'exitoso',
              tipo: 'paquete_validar',
              detalles: {
                checksum: checksumActual,
                checksumProvisto: checksumEsperado || null,
                conteos: parsed.conteos
              }
            }
          }
        );
      }
      return {
        mensaje: 'Paquete valido',
        checksumSha256: checksumActual,
        conteos: parsed.conteos
      };
    }

    resultados.push(await upsertLwwPorUpdatedAt({ modelName: 'Periodo', Model: Periodo as unknown as ModelLike, docs: periodosDocs }));
    resultados.push(await upsertLwwPorUpdatedAt({ modelName: 'Alumno', Model: Alumno as unknown as ModelLike, docs: alumnosDocs }));
    resultados.push(await upsertLwwPorUpdatedAt({ modelName: 'BancoPregunta', Model: BancoPregunta as unknown as ModelLike, docs: bancoDocs }));
    resultados.push(await upsertLwwPorUpdatedAt({ modelName: 'ExamenPlantilla', Model: ExamenPlantilla as unknown as ModelLike, docs: plantillasDocs }));
    resultados.push(await upsertLwwPorUpdatedAt({ modelName: 'ExamenGenerado', Model: ExamenGenerado as unknown as ModelLike, docs: examenesDocs }));

    const entregasFiltradas = entregasDocs.filter((e) => examenesIds.includes(String(obtenerCampo(e, 'examenGeneradoId') ?? '')));
    const banderasFiltradas = banderasDocs.filter((b) => examenesIds.includes(String(obtenerCampo(b, 'examenGeneradoId') ?? '')));
    const calificacionesFiltradas = calificacionesDocs.filter((c) => examenesIds.includes(String(obtenerCampo(c, 'examenGeneradoId') ?? '')));

    resultados.push(await upsertLwwPorUpdatedAt({ modelName: 'Entrega', Model: Entrega as unknown as ModelLike, docs: entregasFiltradas }));
    resultados.push(await upsertLwwPorUpdatedAt({ modelName: 'Calificacion', Model: Calificacion as unknown as ModelLike, docs: calificacionesFiltradas }));
    resultados.push(await upsertLwwPorUpdatedAt({ modelName: 'BanderaRevision', Model: BanderaRevision as unknown as ModelLike, docs: banderasFiltradas }));

    let pdfsGuardados = 0;
    const pdfs = Array.isArray(parsed.pdfs) ? parsed.pdfs : [];
    for (const item of pdfs) {
      const examenGeneradoId = String(obtenerCampo(item, 'examenGeneradoId') ?? '').trim();
      const pdfB64 = String(obtenerCampo(item, 'pdfComprimidoBase64') ?? '').trim();
      const pdfSha256Esperado = String(obtenerCampo(item, 'pdfSha256') ?? '').trim();
      if (!examenGeneradoId || !pdfB64) continue;

      const examen = await ExamenGenerado.findById(examenGeneradoId).lean();
      if (!examen) continue;

      try {
        const pdfBytes = gunzipSync(Buffer.from(pdfB64, 'base64'));
        if (pdfSha256Esperado) {
          const actual = sha256HexBuffer(Buffer.from(pdfBytes));
          if (actual.toLowerCase() !== pdfSha256Esperado.toLowerCase()) {
            continue;
          }
        }
        const folio = String(obtenerCampo(examen, 'folio') ?? 'examen').trim() || 'examen';
        const nombre = `examen_folio-${folio}.pdf`;
        const rutaPdf = await guardarPdfExamen(nombre, Buffer.from(pdfBytes));
        await ExamenGenerado.updateOne({ _id: examenGeneradoId, docenteId }, { $set: { rutaPdf } }).catch(() => {
          // no-op
        });
        pdfsGuardados += 1;
      } catch {
        // omitir
      }
    }

    if (registroId) {
      await Sincronizacion.updateOne(
        { _id: registroId },
        { $set: { estado: 'exitoso', detalles: { resultados, pdfsGuardados, conteos: parsed.conteos } } }
      );
    }

    return { mensaje: 'Paquete importado', resultados, pdfsGuardados };
  }
}

export function parsearDesdeRaw(desdeRaw: string): Date | null {
  return desdeRaw ? parsearFechaIso(desdeRaw) : null;
}

export function validarBackupMetaImportacion(backupMetaRaw: unknown, ahoraMs: number = Date.now()) {
  if (!backupMetaRaw || typeof backupMetaRaw !== 'object') {
    return;
  }

  const expiresAtRaw = String(obtenerCampo(backupMetaRaw, 'expiresAt') ?? '').trim();
  if (!expiresAtRaw) {
    throw new ErrorAplicacion('SYNC_BACKUP_META_INVALIDA', 'Backup invalido: falta backupMeta.expiresAt', 400);
  }

  const expiresAtMs = new Date(expiresAtRaw).getTime();
  if (!Number.isFinite(expiresAtMs)) {
    throw new ErrorAplicacion('SYNC_BACKUP_META_INVALIDA', 'Backup invalido: backupMeta.expiresAt no es una fecha valida', 400);
  }

  if (ahoraMs > expiresAtMs) {
    throw new ErrorAplicacion('SYNC_BACKUP_EXPIRADO', 'Backup expirado: genera un nuevo backup antes de importar', 409);
  }

  const fingerprint = String(obtenerCampo(backupMetaRaw, 'businessLogicFingerprint') ?? '').trim();
  if (fingerprint && fingerprint !== BACKUP_LOGIC_FINGERPRINT) {
    throw new ErrorAplicacion(
      'SYNC_BACKUP_INVALIDADO',
      'Backup invalidado: cambio de logica de negocio detectado; exporta un backup nuevo',
      409
    );
  }
}

export function resolverDesdeSincronizacion(desdeRaw: unknown): { desdeRawStr: string; desde: Date | null } {
  const desdeRawStr = String(desdeRaw ?? '').trim();
  const desde = parsearDesdeRaw(desdeRawStr);
  if (desdeRawStr && !desde) {
    throw new ErrorAplicacion('SYNC_DESDE_INVALIDO', 'Parametro "desde" invalido', 400);
  }
  return { desdeRawStr, desde };
}
