#!/usr/bin/env node
/**
 * preflight-global-prod
 *
 * Responsabilidad: Modulo interno del sistema.
 * Limites: Mantener contrato y comportamiento observable del modulo.
 */
/**
 * preflight-global-prod
 *
 * Responsabilidad: Modulo interno del sistema.
 * Limites: Mantener contrato y comportamiento observable del modulo.
 */
/**
 * Preflight operativo para habilitar generacion de examenes globales en produccion.
 *
 * Modo por defecto:
 * - readonly: no muta datos, valida precondiciones y previsualizacion de plantillas globales.
 *
 * Modo opcional:
 * - smoke: genera un examen real con una plantilla global y lo archiva al final.
 *
 * Uso:
 * node scripts/release/preflight-global-prod.mjs --periodo-id=<id> --api-base=https://api.ejemplo.com/api --token=<jwt> [--modo=readonly|smoke] [--alumno-id=<id>]
 */
import fs from 'node:fs/promises';
import path from 'node:path';

function leerArg(nombre, fallback = '') {
  const prefijo = `--${nombre}=`;
  const valor = process.argv.find((arg) => arg.startsWith(prefijo));
  return valor ? valor.slice(prefijo.length) : fallback;
}

function ahoraIso() {
  return new Date().toISOString();
}

function boolStr(valor) {
  return valor ? 'ok' : 'fallo';
}

async function escribirJson(ruta, payload) {
  await fs.mkdir(path.dirname(ruta), { recursive: true });
  await fs.writeFile(ruta, `${JSON.stringify(payload, null, 2)}\n`, 'utf8');
}

async function main() {
  const apiBase = (leerArg('api-base', process.env.RELEASE_GATE_API_BASE || 'http://localhost:3000/api') || '').replace(/\/+$/, '');
  const token = leerArg('token', process.env.RELEASE_GATE_DOCENTE_TOKEN || process.env.DOCENTE_TOKEN || '');
  const periodoId = leerArg('periodo-id', process.env.RELEASE_GATE_PERIODO_ID || '');
  const modo = (leerArg('modo', 'readonly') || 'readonly').toLowerCase();
  const alumnoIdArg = leerArg('alumno-id', '');
  const timeoutMs = Number(leerArg('timeout-ms', '20000')) || 20000;
  const salida = path.resolve(process.cwd(), 'reports/qa/latest/preflight-global-prod.json');

  if (!token) {
    console.error('[preflight-global] FALLO: token requerido (--token o RELEASE_GATE_DOCENTE_TOKEN)');
    process.exit(1);
  }
  if (!periodoId) {
    console.error('[preflight-global] FALLO: periodoId requerido (--periodo-id)');
    process.exit(1);
  }
  if (!['readonly', 'smoke'].includes(modo)) {
    console.error('[preflight-global] FALLO: modo invalido. Usa readonly o smoke.');
    process.exit(1);
  }

  const abort = new AbortController();
  const timer = setTimeout(() => abort.abort(), timeoutMs);

  const encabezadosBase = {
    Authorization: `Bearer ${token}`
  };

  async function requestJson(ruta, opciones = {}) {
    const res = await fetch(`${apiBase}${ruta}`, {
      ...opciones,
      headers: {
        ...encabezadosBase,
        ...(opciones.body ? { 'Content-Type': 'application/json' } : {}),
        ...(opciones.headers || {})
      },
      signal: abort.signal
    });
    const texto = await res.text();
    let data = null;
    try {
      data = texto ? JSON.parse(texto) : null;
    } catch {
      data = { raw: texto };
    }
    return { ok: res.ok, status: res.status, data, headers: res.headers };
  }

  const checks = [];
  const reporte = {
    generadoEn: ahoraIso(),
    apiBase,
    periodoId,
    modo,
    estado: 'fallo',
    checks,
    resumen: {}
  };

  function pushCheck(nombre, ok, detalle = {}) {
    checks.push({
      nombre,
      estado: boolStr(ok),
      ...detalle
    });
  }

  try {
    // 1) Salud operativa basica
    const live = await requestJson('/salud/live');
    pushCheck('salud_live', live.ok, { status: live.status });

    const ready = await requestJson('/salud/ready');
    pushCheck('salud_ready', ready.ok, { status: ready.status, detalle: ready.data });

    const metrics = await fetch(`${apiBase}/metrics`, {
      headers: encabezadosBase,
      signal: abort.signal
    });
    pushCheck('metrics_disponible', metrics.ok, { status: metrics.status });

    // 2) Periodo, alumnos y banco por materia/curso
    const periodosResp = await requestJson('/periodos?activo=1');
    const periodos = Array.isArray(periodosResp.data?.periodos) ? periodosResp.data.periodos : [];
    const periodo = periodos.find((p) => String(p?._id) === periodoId);
    pushCheck('periodo_activo_disponible', Boolean(periodo), { totalPeriodosActivos: periodos.length });

    const alumnosResp = await requestJson(`/alumnos?periodoId=${encodeURIComponent(periodoId)}`);
    const alumnos = Array.isArray(alumnosResp.data?.alumnos) ? alumnosResp.data.alumnos : [];
    pushCheck('alumnos_en_periodo', alumnos.length > 0, { totalAlumnos: alumnos.length });

    const preguntasResp = await requestJson(`/banco-preguntas?periodoId=${encodeURIComponent(periodoId)}&activo=1`);
    const preguntas = Array.isArray(preguntasResp.data?.preguntas) ? preguntasResp.data.preguntas : [];
    pushCheck('banco_preguntas_activo', preguntas.length > 0, { totalPreguntas: preguntas.length });

    const temasResp = await requestJson(`/banco-preguntas/temas?periodoId=${encodeURIComponent(periodoId)}`);
    const temas = Array.isArray(temasResp.data?.temas) ? temasResp.data.temas : [];
    pushCheck('temas_banco', temas.length > 0, { totalTemas: temas.length });

    // 3) Plantillas globales y previsualizacion
    const plantillasResp = await requestJson(`/examenes/plantillas?periodoId=${encodeURIComponent(periodoId)}`);
    const plantillas = Array.isArray(plantillasResp.data?.plantillas) ? plantillasResp.data.plantillas : [];
    const plantillasGlobales = plantillas.filter(
      (p) => p && p.tipo === 'global' && !p.archivadoEn && String(p.periodoId || '') === periodoId
    );
    pushCheck('plantillas_globales_activas', plantillasGlobales.length > 0, {
      totalPlantillas: plantillas.length,
      totalGlobalesActivas: plantillasGlobales.length
    });

    const validacionesPlantillas = [];
    for (const plantilla of plantillasGlobales) {
      const plantillaId = String(plantilla._id || '');
      const tienePreguntas = Array.isArray(plantilla.preguntasIds) && plantilla.preguntasIds.length > 0;
      const tieneTemas = Array.isArray(plantilla.temas) && plantilla.temas.length > 0;
      const paginasValidas = Number(plantilla.numeroPaginas || 0) >= 1;

      const pre = await requestJson(`/examenes/plantillas/${encodeURIComponent(plantillaId)}/previsualizar`);
      const okPlantilla = (tienePreguntas || tieneTemas) && paginasValidas && pre.ok;

      validacionesPlantillas.push({
        plantillaId,
        titulo: String(plantilla.titulo || ''),
        tienePreguntas,
        tieneTemas,
        numeroPaginas: Number(plantilla.numeroPaginas || 0),
        previsualizacionStatus: pre.status,
        ok: okPlantilla
      });
      pushCheck(`plantilla_global_${plantillaId}`, okPlantilla, {
        titulo: String(plantilla.titulo || ''),
        numeroPaginas: Number(plantilla.numeroPaginas || 0),
        previsualizacionStatus: pre.status
      });
    }

    // 4) Smoke opcional (muta datos de forma controlada)
    let smoke = null;
    if (modo === 'smoke') {
      const plantilla = plantillasGlobales[0];
      const alumno = alumnoIdArg
        ? alumnos.find((a) => String(a?._id) === alumnoIdArg)
        : alumnos.find((a) => a && a.activo !== false) || alumnos[0];

      if (!plantilla) {
        pushCheck('smoke_generacion_global', false, { motivo: 'No hay plantilla global activa para smoke' });
      } else if (!alumno) {
        pushCheck('smoke_generacion_global', false, { motivo: 'No hay alumno disponible para smoke' });
      } else {
        const generarResp = await requestJson('/examenes/generados', {
          method: 'POST',
          body: JSON.stringify({
            plantillaId: String(plantilla._id),
            alumnoId: String(alumno._id)
          })
        });

        const examen = generarResp.data?.examen;
        const examenId = String(examen?._id || '');
        const folio = String(examen?.folio || '');
        const generoOk = generarResp.ok && examenId && folio;
        pushCheck('smoke_generacion_global', generoOk, {
          status: generarResp.status,
          examenId,
          folio
        });

        let descargaOk = false;
        let archivarOk = false;

        if (generoOk) {
          const pdfResp = await fetch(`${apiBase}/examenes/generados/${encodeURIComponent(examenId)}/pdf`, {
            headers: encabezadosBase,
            signal: abort.signal
          });
          const contentType = pdfResp.headers.get('content-type') || '';
          const contentDisposition = pdfResp.headers.get('content-disposition') || '';
          descargaOk = pdfResp.ok && contentType.toLowerCase().includes('pdf');
          pushCheck('smoke_descarga_pdf_global', descargaOk, {
            status: pdfResp.status,
            contentType,
            contentDisposition
          });

          const archivarResp = await requestJson(`/examenes/generados/${encodeURIComponent(examenId)}/archivar`, {
            method: 'POST',
            body: JSON.stringify({})
          });
          archivarOk = archivarResp.ok;
          pushCheck('smoke_archivar_examen_global', archivarOk, {
            status: archivarResp.status
          });
        }

        smoke = {
          examenId,
          folio,
          descargaOk,
          archivarOk
        };
      }
    }

    const fallos = checks.filter((item) => item.estado !== 'ok');
    reporte.estado = fallos.length === 0 ? 'ok' : 'fallo';
    reporte.resumen = {
      totalChecks: checks.length,
      checksOk: checks.length - fallos.length,
      checksFallo: fallos.length,
      totalPlantillasGlobales: plantillasGlobales.length,
      totalPreguntasBanco: preguntas.length,
      totalAlumnos: alumnos.length
    };
    reporte.detalle = {
      plantillas: validacionesPlantillas,
      smoke
    };

    await escribirJson(salida, reporte);
    console.log(`[preflight-global] ${reporte.estado.toUpperCase()} -> ${salida}`);
    if (fallos.length > 0) {
      process.exit(1);
    }
  } catch (error) {
    reporte.estado = 'fallo';
    reporte.error = error instanceof Error ? { mensaje: error.message, stack: error.stack } : { mensaje: String(error) };
    await escribirJson(salida, reporte);
    console.error(`[preflight-global] FALLO -> ${salida}`);
    console.error(error);
    process.exit(1);
  } finally {
    clearTimeout(timer);
  }
}

await main();
