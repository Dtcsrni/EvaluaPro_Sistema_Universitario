/** Shell principal docente: sesion, permisos, carga base y composicion de secciones. */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { guardarTokenDocente, limpiarTokenDocente } from '../../servicios_api/clienteApi';
import { emitToast } from '../../ui/toast/toastBus';
import { Icono, Spinner } from '../../ui/iconos';
import { InlineMensaje } from '../../ui/ux/componentes/InlineMensaje';
import { clienteApi } from './clienteApiDocente';
import { ShellDocente } from './ShellDocente';
import { SeccionAutenticacion } from './SeccionAutenticacion';
import { SeccionAlumnos } from './SeccionAlumnos';
import { SeccionBanco } from './SeccionBanco';
import { SeccionCuenta } from './SeccionCuenta';
import { SeccionPlantillas } from './SeccionPlantillas';
import { SeccionPeriodos, SeccionPeriodosArchivados } from './SeccionPeriodos';
import { SeccionEntrega } from './SeccionEntregaInterna';
import { SeccionCalificaciones } from './SeccionCalificaciones';
import { SeccionSincronizacion } from './SeccionSincronizacion';
import { SeccionEvaluaciones } from './SeccionEvaluaciones';
import { usePermisosDocente } from './hooks/usePermisosDocente';
import { useSesionDocente } from './hooks/useSesionDocente';
import { registrarAccionDocente } from './telemetriaDocente';
import type {
  Alumno,
  Docente,
  ExamenGeneradoClave,
  Periodo,
  Plantilla,
  Pregunta,
  PreviewCalificacion,
  PreviewPlantilla,
  RespuestaSyncPull,
  RespuestaSyncPush,
  ResultadoAnalisisOmr,
  ResultadoOmr,
  RevisionExamenOmr,
  RevisionPaginaOmr,
  SolicitudRevisionAlumno
} from './tipos';
import {
  combinarRespuestasOmrPaginas,
  consolidarResultadoOmrExamen,
  construirClaveCorrectaExamen,
  normalizarResultadoOmr,
  obtenerVistaInicial
} from './utilidades';
export function AppDocente() {
  const [docente, setDocente] = useState<Docente | null>(null);
  const [vista, setVista] = useState(obtenerVistaInicial());
  const {
    puede,
    permisosUI,
    itemsVista,
    esAdmin,
    esDev,
    puedeEliminarMateriaDev,
    puedeEliminarAlumnoDev
  } = usePermisosDocente(docente);
  const avisarSinPermiso = useCallback((mensaje: string) => {
    emitToast({ level: 'warn', title: 'Sin permisos', message: mensaje, durationMs: 4200 });
  }, []);
  const enviarConPermiso = useCallback(
    <T,>(
      permiso: string,
      ruta: string,
      payload: unknown,
      mensaje: string,
      opciones?: { timeoutMs?: number }
    ): Promise<T> => {
      if (!puede(permiso)) {
        avisarSinPermiso(mensaje);
        return Promise.reject(new Error('SIN_PERMISO'));
      }
      return clienteApi.enviar(ruta, payload, opciones);
    },
    [avisarSinPermiso, puede]
  );
  const [alumnos, setAlumnos] = useState<Alumno[]>([]);
  const [periodos, setPeriodos] = useState<Periodo[]>([]);
  const [periodosArchivados, setPeriodosArchivados] = useState<Periodo[]>([]);
  const [plantillas, setPlantillas] = useState<Plantilla[]>([]);
  const [previewPorPlantillaId, setPreviewPorPlantillaId] = useState<Record<string, PreviewPlantilla>>({});
  const [cargandoPreviewPlantillaId, setCargandoPreviewPlantillaId] = useState<string | null>(null);
  const [plantillaPreviewId, setPlantillaPreviewId] = useState<string | null>(null);
  const [previewPdfUrlPorPlantillaId, setPreviewPdfUrlPorPlantillaId] = useState<Record<string, { booklet?: string; omrSheet?: string }>>({});
  const [cargandoPreviewPdfPlantillaId, setCargandoPreviewPdfPlantillaId] = useState<string | null>(null);
  const paginasEstimadasBackendPorTema = useMemo(() => {
    const mapa = new Map<string, number>();
    const listaPlantillas = Array.isArray(plantillas) ? plantillas : [];
    for (const plantilla of listaPlantillas) {
      const temas = Array.isArray((plantilla as unknown as { temas?: unknown[] }).temas)
        ? (((plantilla as unknown as { temas?: unknown[] }).temas ?? []) as unknown[])
            .map((t) => String(t ?? '').trim())
            .filter(Boolean)
        : [];
      if (temas.length !== 1) continue;
      const preview = previewPorPlantillaId[plantilla._id];
      if (!preview) continue;
      const paginas = Number(preview.bookletPreview?.pagesEstimated ?? 0);
      if (!Number.isFinite(paginas) || paginas <= 0) continue;
      const key = String(temas[0] ?? '').trim().replace(/\s+/g, ' ').toLowerCase();
      mapa.set(key, Math.floor(paginas));
    }
    return mapa;
  }, [plantillas, previewPorPlantillaId]);
  const [preguntas, setPreguntas] = useState<Pregunta[]>([]);
  const [resultadoOmr, setResultadoOmr] = useState<ResultadoOmr | null>(null);
  const [respuestasEditadas, setRespuestasEditadas] = useState<
    Array<{ numeroPregunta: number; opcion: string | null; confianza: number }>
  >([]);
  const [borradoresRespuestasOmr, setBorradoresRespuestasOmr] = useState<
    Record<string, Array<{ numeroPregunta: number; opcion: string | null; confianza: number }>>
  >({});
  const [revisionOmrConfirmada, setRevisionOmrConfirmada] = useState(false);
  const [examenIdOmr, setExamenIdOmr] = useState<string | null>(null);
  const [examenAlumnoId, setExamenAlumnoId] = useState<string | null>(null);
  const [paginaOmrActiva, setPaginaOmrActiva] = useState<number | null>(null);
  const [revisionesOmr, setRevisionesOmr] = useState<RevisionExamenOmr[]>([]);
  const [solicitudesRevision, setSolicitudesRevision] = useState<SolicitudRevisionAlumno[]>([]);
  const [marcaActualizacionCalificados, setMarcaActualizacionCalificados] = useState<number>(0);
  const [cargandoDatos, setCargandoDatos] = useState(false);
  const [ultimaActualizacionDatos, setUltimaActualizacionDatos] = useState<number | null>(null);
  function cerrarSesion() {
    // Best-effort: limpia refresh token server-side.
    void clienteApi.enviar('/autenticacion/salir', {});
    limpiarTokenDocente();
    setDocente(null);
    emitToast({ level: 'info', title: 'Sesion', message: 'Sesion cerrada', durationMs: 2200 });
    registrarAccionDocente('logout', true);
  }
  const tabsRef = useRef<Array<HTMLButtonElement | null>>([]);
  const montadoRef = useRef(true);
  // Nota UX: ocultamos el badge de estado API (no aporta al flujo docente).
  useEffect(() => {
    if (itemsVista.length === 0) return;
    const vistaBase = vista === 'periodos_archivados' ? 'periodos' : vista;
    if (!itemsVista.some((item) => item.id === vistaBase)) {
      setVista(itemsVista[0].id);
    }
  }, [itemsVista, vista]);
  useSesionDocente({ setDocente, onCerrarSesion: cerrarSesion, montadoRef });
  useEffect(() => {
    montadoRef.current = true;
    return () => {
      montadoRef.current = false;
    };
  }, []);
  const refrescarDatos = useCallback(async () => {
    if (!docente) return;
    if (montadoRef.current) setCargandoDatos(true);
    try {
      const tareas: Array<Promise<void>> = [];
      if (permisosUI.alumnos.leer) {
        tareas.push(
          clienteApi.obtener<{ alumnos: Alumno[] }>('/alumnos').then((al) => {
            if (montadoRef.current) setAlumnos(al.alumnos);
          })
        );
      } else {
        setAlumnos([]);
      }
      if (permisosUI.periodos.leer) {
        tareas.push(
          Promise.all([
            clienteApi.obtener<{ periodos?: Periodo[]; materias?: Periodo[] }>('/periodos?activo=1'),
            clienteApi.obtener<{ periodos?: Periodo[]; materias?: Periodo[] }>('/periodos?activo=0')
          ]).then(([peActivas, peArchivadas]) => {
            if (!montadoRef.current) return;
            const activas = (peActivas as unknown as { periodos?: Periodo[]; materias?: Periodo[] }).periodos ??
              (peActivas as unknown as { periodos?: Periodo[]; materias?: Periodo[] }).materias ??
              [];
            const archivadas = (peArchivadas as unknown as { periodos?: Periodo[]; materias?: Periodo[] }).periodos ??
              (peArchivadas as unknown as { periodos?: Periodo[]; materias?: Periodo[] }).materias ??
              [];
            const activasArray = Array.isArray(activas) ? activas : [];
            const archivadasArray = Array.isArray(archivadas) ? archivadas : [];
            const ids = (lista: Periodo[]) => lista.map((m) => m._id).filter(Boolean).sort().join('|');
            const mismoContenido = activasArray.length > 0 && ids(activasArray) === ids(archivadasArray);
            // Fallback: si el backend ignora ?activo y devuelve lo mismo, separa localmente.
            if (mismoContenido) {
              setPeriodos(activasArray.filter((m) => m.activo !== false));
              setPeriodosArchivados(activasArray.filter((m) => m.activo === false));
            } else {
              setPeriodos(activasArray);
              setPeriodosArchivados(archivadasArray);
            }
          })
        );
      } else {
        setPeriodos([]);
        setPeriodosArchivados([]);
      }
      if (permisosUI.plantillas.leer) {
        tareas.push(
          clienteApi.obtener<{ plantillas: Plantilla[] }>('/examenes/plantillas').then((pl) => {
            if (montadoRef.current) setPlantillas(pl.plantillas);
          })
        );
      } else {
        setPlantillas([]);
      }
      if (permisosUI.banco.leer) {
        tareas.push(
          clienteApi.obtener<{ preguntas: Pregunta[] }>('/banco-preguntas').then((pr) => {
            if (montadoRef.current) setPreguntas(pr.preguntas);
          })
        );
      } else {
        setPreguntas([]);
      }
      await Promise.all(tareas);
      setUltimaActualizacionDatos(Date.now());
    } finally {
      if (montadoRef.current) setCargandoDatos(false);
    }
  }, [docente, permisosUI.alumnos.leer, permisosUI.banco.leer, permisosUI.periodos.leer, permisosUI.plantillas.leer]);
  useEffect(() => {
    void refrescarDatos();
  }, [refrescarDatos]);
  useEffect(() => {
    if (!docente || vista !== 'calificaciones' || !permisosUI.calificaciones.calificar) return;
    void clienteApi
      .obtener<{ solicitudes: SolicitudRevisionAlumno[] }>('/calificaciones/revision/solicitudes')
      .then((respuesta) => {
        setSolicitudesRevision(Array.isArray(respuesta.solicitudes) ? respuesta.solicitudes : []);
      })
      .catch(() => {
        setSolicitudesRevision([]);
      });
  }, [docente, permisosUI.calificaciones.calificar, vista]);
  function refrescarMaterias() {
    if (!permisosUI.periodos.leer) {
      setPeriodos([]);
      setPeriodosArchivados([]);
      return Promise.resolve();
    }
    return Promise.all([
      clienteApi.obtener<{ periodos?: Periodo[]; materias?: Periodo[] }>('/periodos?activo=1'),
      clienteApi.obtener<{ periodos?: Periodo[]; materias?: Periodo[] }>('/periodos?activo=0')
    ]).then(([peActivas, peArchivadas]) => {
      const activas = peActivas.periodos ?? peActivas.materias ?? [];
      const archivadas = peArchivadas.periodos ?? peArchivadas.materias ?? [];
      const activasArray = Array.isArray(activas) ? activas : [];
      const archivadasArray = Array.isArray(archivadas) ? archivadas : [];
      const ids = (lista: Periodo[]) => lista.map((m) => m._id).filter(Boolean).sort().join('|');
      const mismoContenido = activasArray.length > 0 && ids(activasArray) === ids(archivadasArray);
      if (mismoContenido) {
        setPeriodos(activasArray.filter((m) => m.activo !== false));
        setPeriodosArchivados(activasArray.filter((m) => m.activo === false));
      } else {
        setPeriodos(activasArray);
        setPeriodosArchivados(archivadasArray);
      }
      setUltimaActualizacionDatos(Date.now());
    });
  }
  const examenOmrActivo = useMemo(
    () => revisionesOmr.find((item) => item.examenId === examenIdOmr) ?? null,
    [examenIdOmr, revisionesOmr]
  );
  const claveCorrectaOmrActiva = useMemo(
    () => (examenOmrActivo?.claveCorrectaPorNumero ? examenOmrActivo.claveCorrectaPorNumero : {}),
    [examenOmrActivo]
  );
  const ordenPreguntasClaveOmrActiva = useMemo(
    () =>
      Array.isArray(examenOmrActivo?.ordenPreguntas)
        ? examenOmrActivo!.ordenPreguntas
        : Object.keys(claveCorrectaOmrActiva)
            .map((n) => Number(n))
            .filter((n) => Number.isFinite(n))
            .sort((a, b) => a - b),
    [claveCorrectaOmrActiva, examenOmrActivo]
  );
  const respuestasCombinadasRevisionOmrActiva = useMemo(() => {
    if (!examenOmrActivo || !Array.isArray(examenOmrActivo.paginas)) return [];
    const combinadas = examenOmrActivo.paginas.flatMap((pagina) => {
      const numeroPagina = Number(pagina.numeroPagina);
      const llave = `${examenOmrActivo.examenId}::${numeroPagina}`;
      const borrador = borradoresRespuestasOmr[llave];
      if (Array.isArray(borrador)) return borrador;
      return Array.isArray(pagina.respuestas) ? pagina.respuestas : [];
    });
    return [...combinadas].sort((a, b) => Number(a.numeroPregunta) - Number(b.numeroPregunta));
  }, [borradoresRespuestasOmr, examenOmrActivo]);
  const respuestasCombinadasEstablesOmrActiva = useMemo(() => {
    if (!examenOmrActivo || !Array.isArray(examenOmrActivo.paginas)) return [];
    return combinarRespuestasOmrPaginas(examenOmrActivo.paginas);
  }, [examenOmrActivo]);
  const respuestasParaCalificarOmrActiva = useMemo(
    () => (Array.isArray(respuestasCombinadasEstablesOmrActiva) ? respuestasCombinadasEstablesOmrActiva : []),
    [respuestasCombinadasEstablesOmrActiva]
  );
  const resultadoParaCalificarOmrActiva = useMemo(() => {
    if (!examenOmrActivo || !Array.isArray(examenOmrActivo.paginas) || examenOmrActivo.paginas.length === 0) {
      return resultadoOmr;
    }
    return consolidarResultadoOmrExamen(examenOmrActivo.paginas) ?? resultadoOmr;
  }, [examenOmrActivo, resultadoOmr]);
  const ordenPreguntasCalificarOmrActiva = useMemo(() => {
    const numeros = new Set(
      respuestasParaCalificarOmrActiva
        .map((item) => Number(item.numeroPregunta))
        .filter((numero) => Number.isFinite(numero))
    );
    const filtrado = ordenPreguntasClaveOmrActiva.filter((numero) => numeros.has(Number(numero)));
    if (filtrado.length > 0) return filtrado;
    return [...numeros].sort((a, b) => a - b);
  }, [ordenPreguntasClaveOmrActiva, respuestasParaCalificarOmrActiva]);
  const claveCorrectaCalificarOmrActiva = useMemo(() => {
    const clave: Record<number, string> = {};
    for (const numero of ordenPreguntasCalificarOmrActiva) {
      if (claveCorrectaOmrActiva[numero]) clave[numero] = claveCorrectaOmrActiva[numero];
    }
    return clave;
  }, [claveCorrectaOmrActiva, ordenPreguntasCalificarOmrActiva]);
  const hayCambiosPendientesOmrActiva = useMemo(() => {
    if (!examenOmrActivo) return false;
    const paginaActual = Number(paginaOmrActiva);
    if (!Number.isFinite(paginaActual)) return false;
    const pagina = examenOmrActivo.paginas.find((item) => Number(item.numeroPagina) === paginaActual);
    if (!pagina) return false;
    const firma = (respuestas: Array<{ numeroPregunta: number; opcion: string | null }>) =>
      [...respuestas]
        .map((item) => `${Number(item.numeroPregunta)}:${item.opcion ?? ''}`)
        .sort()
        .join('|');
    return firma(respuestasEditadas) !== firma(pagina.respuestas);
  }, [examenOmrActivo, paginaOmrActiva, respuestasEditadas]);
  const normalizarRespuestasDetectadas = useCallback(
    (
      respuestas: Array<{ numeroPregunta: number; opcion: string | null; confianza?: number }> | undefined
    ): Array<{ numeroPregunta: number; opcion: string | null; confianza?: number }> => {
      if (!Array.isArray(respuestas)) return [];
      const normalizadas = new Map<number, { numeroPregunta: number; opcion: string | null; confianza?: number }>();
      for (const item of respuestas) {
        const numeroPregunta = Number(item?.numeroPregunta);
        if (!Number.isInteger(numeroPregunta) || numeroPregunta <= 0) continue;
        const opcionCruda = typeof item?.opcion === 'string' ? item.opcion.trim().toUpperCase() : '';
        const opcion = opcionCruda.length === 1 && ['A', 'B', 'C', 'D', 'E'].includes(opcionCruda) ? opcionCruda : null;
        const confianza = Number(item?.confianza);
        normalizadas.set(numeroPregunta, {
          numeroPregunta,
          opcion,
          ...(Number.isFinite(confianza) && confianza >= 0 && confianza <= 1 ? { confianza } : {})
        });
      }
      return [...normalizadas.values()].sort((a, b) => a.numeroPregunta - b.numeroPregunta);
    },
    []
  );
  const llaveBorradorOmr = useCallback((examenId: string, numeroPagina: number) => `${examenId}::${numeroPagina}`, []);
  const seleccionarRevisionOmr = useCallback(
    (examenId: string, numeroPagina: number) => {
      const examen = revisionesOmr.find((item) => item.examenId === examenId);
      if (!examen) return;
      const paginaObjetivo = Number(numeroPagina);
      const pagina = examen.paginas.find((item) => Number(item.numeroPagina) === paginaObjetivo);
      if (!pagina) return;
      setExamenIdOmr(examen.examenId);
      setExamenAlumnoId(examen.alumnoId ?? null);
      setPaginaOmrActiva(Number(pagina.numeroPagina));
      setResultadoOmr(pagina.resultado);
      const llave = llaveBorradorOmr(examen.examenId, Number(pagina.numeroPagina));
      const borrador = borradoresRespuestasOmr[llave];
      setRespuestasEditadas(Array.isArray(borrador) ? borrador : pagina.respuestas);
      setRevisionOmrConfirmada(Boolean(examen.revisionConfirmada));
    },
    [borradoresRespuestasOmr, llaveBorradorOmr, revisionesOmr]
  );
  const cargarRevisionHistoricaCalificada = useCallback(
    (payload: {
      examenId: string;
      folio: string;
      alumnoId: string | null;
      numeroPagina: number;
      respuestas: Array<{ numeroPregunta: number; opcion: string | null; confianza: number }>;
      paginas?: Array<{
        numeroPagina: number;
        respuestas: Array<{ numeroPregunta: number; opcion: string | null; confianza: number }>;
        resultado: ResultadoOmr;
        imagenBase64?: string;
      }>;
      claveCorrectaPorNumero: Record<number, string>;
      ordenPreguntas: number[];
      resultado: ResultadoOmr;
    }) => {
      const ahora = Date.now();
      const paginasEntrada = Array.isArray(payload.paginas) ? payload.paginas : [];
      const paginasNormalizadas: RevisionPaginaOmr[] =
        paginasEntrada.length > 0
          ? paginasEntrada
              .filter((pagina) => Number.isFinite(Number(pagina?.numeroPagina)) && Number(pagina.numeroPagina) > 0)
              .map((pagina) => ({
                numeroPagina: Number(pagina.numeroPagina),
                resultado: pagina.resultado,
                respuestas: Array.isArray(pagina.respuestas) ? pagina.respuestas : [],
                imagenBase64: String(pagina.imagenBase64 ?? '').trim() || undefined,
                actualizadoEn: ahora
              }))
          : [
              {
                numeroPagina: Number(payload.numeroPagina),
                resultado: payload.resultado,
                respuestas: Array.isArray(payload.respuestas) ? payload.respuestas : [],
                actualizadoEn: ahora
              }
            ];
      const paginaActivaInicial =
        [...paginasNormalizadas]
          .filter((pagina) => Number.isFinite(Number(pagina.numeroPagina)))
          .sort((a, b) => Number(a.numeroPagina) - Number(b.numeroPagina))[0] ?? null;
      setRevisionesOmr((prev) => {
        const indice = prev.findIndex((item) => item.examenId === payload.examenId);
        if (indice < 0) {
          return [
            {
              examenId: payload.examenId,
              folio: payload.folio,
              alumnoId: payload.alumnoId,
              paginas: paginasNormalizadas,
              claveCorrectaPorNumero: payload.claveCorrectaPorNumero,
              ordenPreguntas: payload.ordenPreguntas,
              revisionConfirmada: true,
              creadoEn: ahora,
              actualizadoEn: ahora
            },
            ...prev
          ];
        }
        const copia = [...prev];
        const actual = copia[indice];
        const paginasActuales = Array.isArray(actual.paginas) ? [...actual.paginas] : [];
        const mapaPaginas = new Map<number, RevisionPaginaOmr>();
        for (const pagina of paginasActuales) {
          const numero = Number(pagina.numeroPagina);
          if (!Number.isFinite(numero) || numero <= 0) continue;
          mapaPaginas.set(numero, pagina);
        }
        for (const pagina of paginasNormalizadas) {
          const numero = Number(pagina.numeroPagina);
          if (!Number.isFinite(numero) || numero <= 0) continue;
          mapaPaginas.set(numero, pagina);
        }
        const paginas = Array.from(mapaPaginas.values());
        paginas.sort((a, b) => Number(a.numeroPagina) - Number(b.numeroPagina));
        copia[indice] = {
          ...actual,
          folio: payload.folio || actual.folio,
          alumnoId: payload.alumnoId ?? actual.alumnoId ?? null,
          paginas,
          claveCorrectaPorNumero:
            Object.keys(payload.claveCorrectaPorNumero || {}).length > 0
              ? payload.claveCorrectaPorNumero
              : actual.claveCorrectaPorNumero,
          ordenPreguntas:
            Array.isArray(payload.ordenPreguntas) && payload.ordenPreguntas.length > 0
              ? payload.ordenPreguntas
              : actual.ordenPreguntas,
          revisionConfirmada: true,
          actualizadoEn: ahora
        };
        return copia;
      });
      setExamenIdOmr(payload.examenId);
      setExamenAlumnoId(payload.alumnoId);
      setPaginaOmrActiva(Number(paginaActivaInicial?.numeroPagina ?? payload.numeroPagina));
      setResultadoOmr(paginaActivaInicial?.resultado ?? payload.resultado);
      setRespuestasEditadas(
        Array.isArray(paginaActivaInicial?.respuestas)
          ? paginaActivaInicial.respuestas
          : Array.isArray(payload.respuestas)
            ? payload.respuestas
            : []
      );
      setRevisionOmrConfirmada(true);
      setBorradoresRespuestasOmr((prev) => {
        const siguiente = { ...prev };
        let huboCambios = false;
        for (const pagina of paginasNormalizadas) {
          const llave = llaveBorradorOmr(payload.examenId, Number(pagina.numeroPagina));
          if (llave in siguiente) {
            delete siguiente[llave];
            huboCambios = true;
          }
        }
        return huboCambios ? siguiente : prev;
      });
    },
    [llaveBorradorOmr]
  );
  const actualizarRespuestasOmrActivas = useCallback(
    (nuevas: Array<{ numeroPregunta: number; opcion: string | null; confianza: number }>) => {
      setRespuestasEditadas(nuevas);
      if (!examenIdOmr) return;
      const paginaObjetivo = Number(paginaOmrActiva);
      if (Number.isFinite(paginaObjetivo)) {
        const llave = llaveBorradorOmr(examenIdOmr, paginaObjetivo);
        setBorradoresRespuestasOmr((prev) => ({ ...prev, [llave]: nuevas }));
      }
      setRevisionOmrConfirmada(false);
      setRevisionesOmr((prev) =>
        prev.map((examen) => {
          if (examen.examenId !== examenIdOmr) return examen;
          return {
            ...examen,
            revisionConfirmada: false,
            actualizadoEn: Date.now()
          };
        })
      );
    },
    [examenIdOmr, llaveBorradorOmr, paginaOmrActiva]
  );
  const actualizarRespuestaPreguntaOmrActiva = useCallback(
    (numeroPregunta: number, opcion: string | null) => {
      const numero = Number(numeroPregunta);
      if (!Number.isFinite(numero) || numero <= 0) return;
      setRevisionOmrConfirmada(false);
      if (examenIdOmr) {
        setRevisionesOmr((prev) =>
          prev.map((examen) =>
            examen.examenId === examenIdOmr
              ? {
                  ...examen,
                  revisionConfirmada: false,
                  actualizadoEn: Date.now()
                }
              : examen
          )
        );
      }
      setRespuestasEditadas((prev) => {
        const siguiente = [...prev];
        const indice = siguiente.findIndex((item) => item.numeroPregunta === numero);
        if (indice >= 0) {
          siguiente[indice] = { ...siguiente[indice], opcion };
        } else {
          siguiente.push({ numeroPregunta: numero, opcion, confianza: 0 });
        }
        siguiente.sort((a, b) => a.numeroPregunta - b.numeroPregunta);
        if (examenIdOmr && Number.isFinite(Number(paginaOmrActiva))) {
          const llave = llaveBorradorOmr(examenIdOmr, Number(paginaOmrActiva));
          setBorradoresRespuestasOmr((actual) => ({ ...actual, [llave]: siguiente }));
        }
        return siguiente;
      });
    },
    [examenIdOmr, llaveBorradorOmr, paginaOmrActiva]
  );
  const confirmarRevisionOmrActiva = useCallback(
    (confirmada: boolean) => {
      setRevisionOmrConfirmada(confirmada);
      if (!examenIdOmr) return;
      const paginaObjetivo = Number(paginaOmrActiva);
      setRevisionesOmr((prev) =>
        prev.map((examen) => {
          if (examen.examenId !== examenIdOmr) return examen;
          if (!confirmada) {
            return { ...examen, revisionConfirmada: false, actualizadoEn: Date.now() };
          }
          const ahora = Date.now();
          const paginas = examen.paginas.map((pagina) => {
            const numeroPagina = Number(pagina.numeroPagina);
            const llave = llaveBorradorOmr(examen.examenId, numeroPagina);
            const esPaginaActiva = Number.isFinite(paginaObjetivo) && numeroPagina === paginaObjetivo;
            const respuestasPagina = esPaginaActiva
              ? respuestasEditadas
              : Array.isArray(borradoresRespuestasOmr[llave])
                ? borradoresRespuestasOmr[llave]
                : null;
            if (!Array.isArray(respuestasPagina)) return pagina;
            return {
              ...pagina,
              respuestas: respuestasPagina,
              resultado: {
                ...pagina.resultado,
                respuestasDetectadas: respuestasPagina
              },
              actualizadoEn: ahora
            };
          });
          return {
            ...examen,
            paginas,
            revisionConfirmada: true,
            actualizadoEn: ahora
          };
        })
      );
      if (confirmada) {
        setBorradoresRespuestasOmr((prev) => {
          const prefijo = `${examenIdOmr}::`;
          const llaves = Object.keys(prev).filter((llave) => llave.startsWith(prefijo));
          if (llaves.length === 0) return prev;
          const siguiente = { ...prev };
          for (const llave of llaves) {
            delete siguiente[llave];
          }
          return siguiente;
        });
      }
    },
    [borradoresRespuestasOmr, examenIdOmr, llaveBorradorOmr, paginaOmrActiva, respuestasEditadas]
  );
  const limpiarColaEscaneosOmr = useCallback(() => {
    const habiaElementos = revisionesOmr.length > 0 || Boolean(resultadoOmr);
    setRevisionesOmr([]);
    setBorradoresRespuestasOmr({});
    setResultadoOmr(null);
    setRespuestasEditadas([]);
    setRevisionOmrConfirmada(false);
    setExamenIdOmr(null);
    setExamenAlumnoId(null);
    setPaginaOmrActiva(null);
    if (habiaElementos) {
      emitToast({ level: 'info', title: 'Escaneo OMR', message: 'Cola de escaneos limpiada', durationMs: 2600 });
    }
  }, [revisionesOmr.length, resultadoOmr]);
  const contenido = docente ? (
    <div className="panel">
      <nav
        className="tabs tabs--scroll tabs--sticky"
        aria-label="Secciones del portal docente"
      >
        {itemsVista.map((item, idx) => (
          (() => {
            const activa = vista === item.id || (vista === 'periodos_archivados' && item.id === 'periodos');
            return (
          <button
            key={item.id}
            ref={(el) => {
              tabsRef.current[idx] = el;
            }}
            type="button"
            className={activa ? 'tab activa' : 'tab'}
            aria-current={activa ? 'page' : undefined}
            onKeyDown={(event) => {
              if (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight' && event.key !== 'Home' && event.key !== 'End') {
                return;
              }
              event.preventDefault();
              const ultimo = itemsVista.length - 1;
              let idxNuevo = idx;
              if (event.key === 'ArrowLeft') idxNuevo = Math.max(0, idx - 1);
              if (event.key === 'ArrowRight') idxNuevo = Math.min(ultimo, idx + 1);
              if (event.key === 'Home') idxNuevo = 0;
              if (event.key === 'End') idxNuevo = ultimo;
              const nuevoId = itemsVista[idxNuevo]?.id;
              if (!nuevoId) return;
              setVista(nuevoId);
              requestAnimationFrame(() => tabsRef.current[idxNuevo]?.focus());
            }}
            onClick={() => setVista(item.id)}
          >
            <Icono nombre={item.icono} />
            {item.label}
          </button>
            );
          })()
        ))}
      </nav>
      {cargandoDatos && (
        <div className="panel" aria-live="polite">
          <InlineMensaje tipo="info" leading={<Spinner />}>
            Cargando datos…
          </InlineMensaje>
        </div>
      )}
      {vista === 'banco' && (
        <SeccionBanco
          preguntas={preguntas}
          periodos={periodos}
          permisos={permisosUI}
          enviarConPermiso={enviarConPermiso}
          avisarSinPermiso={avisarSinPermiso}
          paginasEstimadasBackendPorTema={paginasEstimadasBackendPorTema}
          onRefrescar={() => {
            if (!permisosUI.banco.leer) {
              avisarSinPermiso('No tienes permiso para ver el banco.');
              return Promise.reject(new Error('SIN_PERMISO'));
            }
            return clienteApi.obtener<{ preguntas: Pregunta[] }>('/banco-preguntas').then((p) => setPreguntas(p.preguntas));
          }}
          onRefrescarPlantillas={() => {
            if (!permisosUI.plantillas.leer) {
              avisarSinPermiso('No tienes permiso para ver plantillas.');
              return Promise.reject(new Error('SIN_PERMISO'));
            }
            return clienteApi.obtener<{ plantillas: Plantilla[] }>('/examenes/plantillas').then((p) => setPlantillas(p.plantillas));
          }}
        />
      )}
      {vista === 'periodos' && (
        <SeccionPeriodos
          periodos={periodos}
          onRefrescar={refrescarMaterias}
          onVerArchivadas={() => setVista('periodos_archivados')}
          permisos={permisosUI}
          puedeEliminarMateriaDev={puedeEliminarMateriaDev}
          enviarConPermiso={enviarConPermiso}
          avisarSinPermiso={avisarSinPermiso}
        />
      )}
      {vista === 'periodos_archivados' && (
        <SeccionPeriodosArchivados
          periodos={periodosArchivados}
          onVerActivas={() => setVista('periodos')}
        />
      )}
      {vista === 'alumnos' && (
        <SeccionAlumnos
          alumnos={alumnos}
          periodosActivos={periodos}
          periodosTodos={[...periodos, ...periodosArchivados]}
          permisos={permisosUI}
          puedeEliminarAlumnoDev={puedeEliminarAlumnoDev}
          enviarConPermiso={enviarConPermiso}
          avisarSinPermiso={avisarSinPermiso}
          onRefrescar={() => {
            if (!permisosUI.alumnos.leer) {
              avisarSinPermiso('No tienes permiso para ver alumnos.');
              return Promise.reject(new Error('SIN_PERMISO'));
            }
            return clienteApi.obtener<{ alumnos: Alumno[] }>('/alumnos').then((p) => setAlumnos(p.alumnos));
          }}
        />
      )}
      {vista === 'plantillas' && (
        <SeccionPlantillas
          plantillas={plantillas}
          periodos={periodos}
          preguntas={preguntas}
          permisos={permisosUI}
          enviarConPermiso={enviarConPermiso}
          avisarSinPermiso={avisarSinPermiso}
          alumnos={alumnos}
          previewPorPlantillaId={previewPorPlantillaId}
          setPreviewPorPlantillaId={setPreviewPorPlantillaId}
          cargandoPreviewPlantillaId={cargandoPreviewPlantillaId}
          setCargandoPreviewPlantillaId={setCargandoPreviewPlantillaId}
          plantillaPreviewId={plantillaPreviewId}
          setPlantillaPreviewId={setPlantillaPreviewId}
          previewPdfUrlPorPlantillaId={previewPdfUrlPorPlantillaId}
          setPreviewPdfUrlPorPlantillaId={setPreviewPdfUrlPorPlantillaId}
          cargandoPreviewPdfPlantillaId={cargandoPreviewPdfPlantillaId}
          setCargandoPreviewPdfPlantillaId={setCargandoPreviewPdfPlantillaId}
          onRefrescar={() => {
            if (!permisosUI.plantillas.leer) {
              avisarSinPermiso('No tienes permiso para ver plantillas.');
              return Promise.reject(new Error('SIN_PERMISO'));
            }
            return clienteApi.obtener<{ plantillas: Plantilla[] }>('/examenes/plantillas').then((p) => setPlantillas(p.plantillas));
          }}
        />
      )}
      {vista === 'entrega' && (
        <SeccionEntrega
          alumnos={alumnos}
          plantillas={plantillas}
          periodos={periodos}
          permisos={permisosUI}
          avisarSinPermiso={avisarSinPermiso}
          enviarConPermiso={enviarConPermiso}
          onVincular={(folio, alumnoId) => {
            if (!permisosUI.entregas.gestionar) {
              avisarSinPermiso('No tienes permiso para vincular entregas.');
              return Promise.reject(new Error('SIN_PERMISO'));
            }
            return clienteApi.enviar('/entregas/vincular-folio', { folio, alumnoId });
          }}
        />
      )}
      {vista === 'calificaciones' && (
        <SeccionCalificaciones
          alumnos={alumnos}
          permisos={permisosUI}
          avisarSinPermiso={avisarSinPermiso}
          onAnalizar={async (folio, numeroPagina, imagenBase64, contexto) => {
            if (!permisosUI.omr.analizar) {
              avisarSinPermiso('No tienes permiso para analizar OMR.');
              throw new Error('SIN_PERMISO');
            }
            const respuesta = await clienteApi.enviar<ResultadoAnalisisOmr>('/omr/analizar', {
              folio,
              numeroPagina,
              imagenBase64
            });
            const resultadoNormalizado = normalizarResultadoOmr(respuesta?.resultado);
            const respuestaNormalizada: ResultadoAnalisisOmr = {
              ...respuesta,
              resultado: resultadoNormalizado
            };
            let claveCorrectaPorNumero: Record<number, string> = {};
            let ordenPreguntas: number[] = [];
            try {
              const examenPayload = await clienteApi.obtener<{ examen?: ExamenGeneradoClave }>(
                `/examenes/generados/folio/${encodeURIComponent(respuesta.folio)}`
              );
              const examenDetalle = examenPayload?.examen;
              let clave = construirClaveCorrectaExamen(examenDetalle, preguntas);
              if (Object.keys(clave.claveCorrectaPorNumero).length === 0 && examenDetalle?.periodoId) {
                const bancoPeriodo = await clienteApi.obtener<{ preguntas: Pregunta[] }>(
                  `/banco-preguntas?periodoId=${encodeURIComponent(String(examenDetalle.periodoId))}`
                );
                clave = construirClaveCorrectaExamen(examenDetalle, Array.isArray(bancoPeriodo?.preguntas) ? bancoPeriodo.preguntas : []);
              }
              claveCorrectaPorNumero = clave.claveCorrectaPorNumero;
              ordenPreguntas = clave.ordenPreguntas;
            } catch {
              claveCorrectaPorNumero = {};
              ordenPreguntas = [];
            }
            const ahora = Date.now();
            let revisionExamenConfirmada = resultadoNormalizado.estadoAnalisis === 'ok';
            let paginaInicioActiva = Number(respuesta.numeroPagina);
            let resultadoPaginaInicio = resultadoNormalizado;
            let respuestasPaginaInicio = resultadoNormalizado.respuestasDetectadas;
            let alumnoIdActivo = respuesta.alumnoId ?? null;
            setRevisionesOmr((prev) => {
              const siguiente = [...prev];
              const indiceExamen = siguiente.findIndex((item) => item.examenId === respuesta.examenId);
              const nuevaPagina: RevisionPaginaOmr = {
                numeroPagina: Number(respuesta.numeroPagina),
                resultado: resultadoNormalizado,
                respuestas: resultadoNormalizado.respuestasDetectadas,
                imagenBase64,
                nombreArchivo: contexto?.nombreArchivo,
                actualizadoEn: ahora
              };
              if (indiceExamen >= 0) {
                const examen = siguiente[indiceExamen];
                const paginaRespuesta = Number(respuesta.numeroPagina);
                const indicePagina = examen.paginas.findIndex((item) => Number(item.numeroPagina) === paginaRespuesta);
                const paginas = [...examen.paginas];
                if (indicePagina >= 0) {
                  paginas[indicePagina] = nuevaPagina;
                } else {
                  paginas.push(nuevaPagina);
                }
                paginas.sort((a, b) => Number(a.numeroPagina) - Number(b.numeroPagina));
                const requiereRevisionPagina = resultadoNormalizado.estadoAnalisis !== 'ok';
                const revisionConfirmada = requiereRevisionPagina ? false : examen.revisionConfirmada;
                revisionExamenConfirmada = revisionConfirmada;
                const paginaActivaActual = Number(paginaOmrActiva);
                const conservarPaginaActiva =
                  examenIdOmr === examen.examenId &&
                  Number.isFinite(paginaActivaActual) &&
                  paginas.some((item) => Number(item.numeroPagina) === paginaActivaActual);
                const paginaInicio = conservarPaginaActiva
                  ? (paginas.find((item) => Number(item.numeroPagina) === paginaActivaActual) ?? nuevaPagina)
                  : (paginas.find((item) => Number(item.numeroPagina) === 1) ?? paginas[0] ?? nuevaPagina);
                paginaInicioActiva = Number(paginaInicio.numeroPagina);
                resultadoPaginaInicio = paginaInicio.resultado;
                respuestasPaginaInicio = paginaInicio.respuestas;
                alumnoIdActivo = respuesta.alumnoId ?? examen.alumnoId ?? null;
                siguiente[indiceExamen] = {
                  ...examen,
                  folio: respuesta.folio || examen.folio,
                  alumnoId: respuesta.alumnoId ?? examen.alumnoId ?? null,
                  paginas,
                  claveCorrectaPorNumero:
                    Object.keys(claveCorrectaPorNumero).length > 0 ? claveCorrectaPorNumero : examen.claveCorrectaPorNumero,
                  ordenPreguntas: ordenPreguntas.length > 0 ? ordenPreguntas : examen.ordenPreguntas,
                  revisionConfirmada,
                  actualizadoEn: ahora
                };
              } else {
                revisionExamenConfirmada = resultadoNormalizado.estadoAnalisis === 'ok';
                paginaInicioActiva = Number(nuevaPagina.numeroPagina);
                resultadoPaginaInicio = nuevaPagina.resultado;
                respuestasPaginaInicio = nuevaPagina.respuestas;
                alumnoIdActivo = respuesta.alumnoId ?? null;
                siguiente.push({
                  examenId: respuesta.examenId,
                  folio: respuesta.folio,
                  alumnoId: respuesta.alumnoId ?? null,
                  paginas: [nuevaPagina],
                  claveCorrectaPorNumero,
                  ordenPreguntas,
                  revisionConfirmada: revisionExamenConfirmada,
                  creadoEn: ahora,
                  actualizadoEn: ahora
                });
              }
              siguiente.sort((a, b) => b.actualizadoEn - a.actualizadoEn);
              return siguiente;
            });
            setResultadoOmr(resultadoPaginaInicio);
            setRespuestasEditadas(respuestasPaginaInicio);
            if (Number.isFinite(Number(paginaInicioActiva))) {
              const llave = llaveBorradorOmr(respuesta.examenId, Number(paginaInicioActiva));
              setBorradoresRespuestasOmr((prev) => {
                if (!(llave in prev)) return prev;
                const siguiente = { ...prev };
                delete siguiente[llave];
                return siguiente;
              });
            }
            setRevisionOmrConfirmada(revisionExamenConfirmada);
            setExamenIdOmr(respuesta.examenId);
            setExamenAlumnoId(alumnoIdActivo);
            setPaginaOmrActiva(paginaInicioActiva);
            return respuestaNormalizada;
          }}
          onPrevisualizar={async (payload) => {
            if (!permisosUI.calificaciones.calificar) {
              avisarSinPermiso('No tienes permiso para calificar.');
              throw new Error('SIN_PERMISO');
            }
            const examenGeneradoId = String(payload.examenGeneradoId ?? '').trim();
            const revisionExamen = revisionesOmr.find((item) => item.examenId === examenGeneradoId);
            const respuestasConsolidadas = revisionExamen
              ? combinarRespuestasOmrPaginas(
                  revisionExamen.paginas.map((pagina) => {
                    const numeroPagina = Number(pagina.numeroPagina);
                    const llave = `${revisionExamen.examenId}::${numeroPagina}`;
                    const borrador = borradoresRespuestasOmr[llave];
                    return {
                      ...pagina,
                      respuestas: Array.isArray(borrador) ? borrador : pagina.respuestas
                    };
                  })
                )
              : [];
            const respuestasDetectadas = normalizarRespuestasDetectadas(
              Array.isArray(respuestasConsolidadas) && respuestasConsolidadas.length > 0
                ? respuestasConsolidadas
                : payload.respuestasDetectadas
            );
            return clienteApi.enviar<{ preview: PreviewCalificacion }>('/calificaciones/calificar', {
              ...payload,
              ...(respuestasDetectadas.length > 0 ? { respuestasDetectadas } : {}),
              soloPreview: true
            });
          }}
          resultado={resultadoOmr}
          onActualizar={actualizarRespuestasOmrActivas}
          onActualizarPregunta={actualizarRespuestaPreguntaOmrActiva}
          respuestasPaginaEditable={respuestasEditadas}
          claveCorrectaPorNumero={claveCorrectaOmrActiva}
          ordenPreguntasClave={ordenPreguntasClaveOmrActiva}
          revisionOmrConfirmada={revisionOmrConfirmada}
          hayCambiosPendientesOmrActiva={hayCambiosPendientesOmrActiva}
          onConfirmarRevisionOmr={confirmarRevisionOmrActiva}
          revisionesOmr={revisionesOmr}
          examenIdActivo={examenIdOmr}
          paginaActiva={paginaOmrActiva}
          onSeleccionarRevision={seleccionarRevisionOmr}
          examenId={examenIdOmr}
          alumnoId={examenAlumnoId}
          marcaActualizacionCalificados={marcaActualizacionCalificados}
          resultadoParaCalificar={resultadoParaCalificarOmrActiva}
          respuestasParaCalificar={respuestasParaCalificarOmrActiva}
          respuestasCombinadasRevision={respuestasCombinadasRevisionOmrActiva}
          claveCorrectaParaCalificar={claveCorrectaCalificarOmrActiva}
          ordenPreguntasParaCalificar={ordenPreguntasCalificarOmrActiva}
          onCalificar={async (payload) => {
            if (!permisosUI.calificaciones.calificar) {
              avisarSinPermiso('No tienes permiso para calificar.');
              return Promise.reject(new Error('SIN_PERMISO'));
            }
            const examenRevision = revisionesOmr.find((item) => item.examenId === payload.examenGeneradoId);
            const paginasOmr = (Array.isArray(examenRevision?.paginas) ? examenRevision.paginas : [])
              .map((pagina) => {
                const numeroPagina = Number(pagina.numeroPagina);
                const imagenBase64 = String(pagina.imagenBase64 ?? '').trim();
                if (!Number.isInteger(numeroPagina) || numeroPagina <= 0 || !imagenBase64) return null;
                return {
                  numeroPagina,
                  imagenBase64
                };
              })
              .filter(
                (
                  pagina
                ): pagina is {
                  numeroPagina: number;
                  imagenBase64: string;
                } => Boolean(pagina)
              );
            const payloadCalificacion: {
              examenGeneradoId: string;
              alumnoId?: string;
              aciertos?: number;
              totalReactivos?: number;
              bonoSolicitado?: number;
              evaluacionContinua?: number;
              proyecto?: number;
              retroalimentacion?: string;
              respuestasDetectadas?: Array<{ numeroPregunta: number; opcion: string | null; confianza?: number }>;
              omrAnalisis?: {
                estadoAnalisis: 'ok' | 'rechazado_calidad' | 'requiere_revision';
                calidadPagina: number;
                confianzaPromedioPagina?: number;
                ratioAmbiguas?: number;
                templateVersionDetectada?: 1 | 3;
                motivosRevision?: string[];
                revisionConfirmada?: boolean;
              };
              paginasOmr?: Array<{ numeroPagina: number; imagenBase64: string }>;
            } = {
              examenGeneradoId: String(payload.examenGeneradoId)
            };
            if (typeof payload.alumnoId === 'string' && payload.alumnoId.trim()) payloadCalificacion.alumnoId = payload.alumnoId.trim();
            if (Number.isFinite(Number(payload.aciertos))) payloadCalificacion.aciertos = Number(payload.aciertos);
            if (Number.isFinite(Number(payload.totalReactivos))) payloadCalificacion.totalReactivos = Number(payload.totalReactivos);
            if (Number.isFinite(Number(payload.bonoSolicitado))) payloadCalificacion.bonoSolicitado = Number(payload.bonoSolicitado);
            if (Number.isFinite(Number(payload.evaluacionContinua))) payloadCalificacion.evaluacionContinua = Number(payload.evaluacionContinua);
            if (Number.isFinite(Number(payload.proyecto))) payloadCalificacion.proyecto = Number(payload.proyecto);
            if (typeof payload.retroalimentacion === 'string') payloadCalificacion.retroalimentacion = payload.retroalimentacion;
            const respuestasDetectadasNormalizadas = normalizarRespuestasDetectadas(payload.respuestasDetectadas);
            if (respuestasDetectadasNormalizadas.length > 0) {
              payloadCalificacion.respuestasDetectadas = respuestasDetectadasNormalizadas;
            }
            if (payload.omrAnalisis) {
              const estado = payload.omrAnalisis.estadoAnalisis;
              if (estado === 'ok' || estado === 'rechazado_calidad' || estado === 'requiere_revision') {
                payloadCalificacion.omrAnalisis = {
                  estadoAnalisis: estado,
                  calidadPagina: Number(payload.omrAnalisis.calidadPagina ?? 0),
                  confianzaPromedioPagina: Number(payload.omrAnalisis.confianzaPromedioPagina ?? 0),
                  ratioAmbiguas: Number(payload.omrAnalisis.ratioAmbiguas ?? 0),
                  templateVersionDetectada: payload.omrAnalisis.templateVersionDetectada ?? 1,
                  motivosRevision: Array.isArray(payload.omrAnalisis.motivosRevision)
                    ? payload.omrAnalisis.motivosRevision
                        .map((motivo) => String(motivo ?? '').trim())
                        .filter((motivo) => motivo.length > 0)
                        .slice(0, 50)
                    : [],
                  revisionConfirmada: Boolean(payload.omrAnalisis.revisionConfirmada)
                };
              }
            }
            if (paginasOmr.length > 0) payloadCalificacion.paginasOmr = paginasOmr;
            const respuesta = await clienteApi.enviar('/calificaciones/calificar', payloadCalificacion);
            setMarcaActualizacionCalificados(Date.now());
            limpiarColaEscaneosOmr();
            return respuesta;
          }}
          solicitudesRevision={solicitudesRevision}
          onSincronizarSolicitudesRevision={async () => {
            if (!permisosUI.calificaciones.calificar) {
              avisarSinPermiso('No tienes permiso para revisar solicitudes.');
              throw new Error('SIN_PERMISO');
            }
            await clienteApi.enviar('/calificaciones/revision/solicitudes/sincronizar', {});
            const respuesta = await clienteApi.obtener<{ solicitudes: SolicitudRevisionAlumno[] }>('/calificaciones/revision/solicitudes');
            setSolicitudesRevision(Array.isArray(respuesta.solicitudes) ? respuesta.solicitudes : []);
            return respuesta;
          }}
          onResolverSolicitudRevision={async (id, estado, respuestaDocente) => {
            if (!permisosUI.calificaciones.calificar) {
              avisarSinPermiso('No tienes permiso para resolver solicitudes.');
              throw new Error('SIN_PERMISO');
            }
            await clienteApi.enviar(`/calificaciones/revision/solicitudes/${encodeURIComponent(id)}/resolver`, {
              estado,
              ...(respuestaDocente ? { respuestaDocente } : {})
            });
            const respuesta = await clienteApi.obtener<{ solicitudes: SolicitudRevisionAlumno[] }>('/calificaciones/revision/solicitudes');
            setSolicitudesRevision(Array.isArray(respuesta.solicitudes) ? respuesta.solicitudes : []);
            return respuesta;
          }}
          onLimpiarColaEscaneos={limpiarColaEscaneosOmr}
          onCargarRevisionHistoricaCalificada={cargarRevisionHistoricaCalificada}
        />
      )}
      {vista === 'evaluaciones' && (
        <SeccionEvaluaciones
          periodos={periodos}
          alumnos={alumnos}
          puedeGestionar={permisosUI.evaluaciones.gestionar}
          puedeClassroomConectar={permisosUI.classroom.conectar}
          puedeClassroomPull={permisosUI.classroom.pull}
        />
      )}
      {vista === 'publicar' && (
        <SeccionSincronizacion
          periodos={periodos}
          periodosArchivados={periodosArchivados}
          alumnos={alumnos}
          plantillas={plantillas}
          preguntas={preguntas}
          ultimaActualizacionDatos={ultimaActualizacionDatos}
          docenteCorreo={docente?.correo}
          onPublicar={(periodoId) => {
            if (!permisosUI.publicar.publicar) {
              avisarSinPermiso('No tienes permiso para publicar resultados.');
              return Promise.reject(new Error('SIN_PERMISO'));
            }
            return clienteApi.enviar('/sincronizaciones/publicar', { periodoId });
          }}
          onCodigo={(periodoId) => {
            if (!permisosUI.publicar.publicar) {
              avisarSinPermiso('No tienes permiso para generar codigos.');
              return Promise.reject(new Error('SIN_PERMISO'));
            }
            return clienteApi.enviar<{ codigo?: string; expiraEn?: string }>('/sincronizaciones/codigo-acceso', { periodoId });
          }}
          onExportarPaquete={(payload) => {
            if (!permisosUI.sincronizacion.exportar) {
              avisarSinPermiso('No tienes permiso para exportar.');
              return Promise.reject(new Error('SIN_PERMISO'));
            }
            return clienteApi.enviar<{
              paqueteBase64: string;
              checksumSha256: string;
              checksumGzipSha256?: string;
              exportadoEn: string;
              conteos: Record<string, number>;
            }>('/sincronizaciones/paquete/exportar', payload);
          }}
          onImportarPaquete={(payload) =>
            (async () => {
              if (!permisosUI.sincronizacion.importar) {
                avisarSinPermiso('No tienes permiso para importar.');
                throw new Error('SIN_PERMISO');
              }
              const respuesta = await clienteApi.enviar<
                | { mensaje?: string; resultados?: unknown[]; pdfsGuardados?: number }
                | { mensaje?: string; checksumSha256?: string; conteos?: Record<string, number> }
              >('/sincronizaciones/paquete/importar', payload);
              if (!payload?.dryRun) {
                await refrescarDatos();
              }
              return respuesta;
            })()
          }
          onPushServidor={(payload) => {
            if (!permisosUI.sincronizacion.push) {
              avisarSinPermiso('No tienes permiso para enviar al servidor.');
              return Promise.reject(new Error('SIN_PERMISO'));
            }
            return clienteApi.enviar<RespuestaSyncPush>('/sincronizaciones/push', payload);
          }}
          onPullServidor={(payload) => {
            if (!permisosUI.sincronizacion.pull) {
              avisarSinPermiso('No tienes permiso para traer del servidor.');
              return Promise.reject(new Error('SIN_PERMISO'));
            }
            return clienteApi.enviar<RespuestaSyncPull>('/sincronizaciones/pull', payload);
          }}
        />
      )}
      {vista === 'cuenta' && (
        <SeccionCuenta
          docente={docente}
          onDocenteActualizado={setDocente}
          esAdmin={esAdmin}
          esDev={esDev}
        />
      )}
    </div>
  ) : (
    <SeccionAutenticacion
      onIngresar={(token) => {
        guardarTokenDocente(token);
        clienteApi
          .obtener<{ docente: Docente }>('/autenticacion/perfil')
          .then((payload) => setDocente(payload.docente));
      }}
    />
  );
  return <ShellDocente docente={docente} onCerrarSesion={cerrarSesion}>{contenido}</ShellDocente>;
}
