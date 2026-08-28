/**
 * useOmrWorkflowState.ts
 *
 * Hook especializado para encapsular la gestión de estado y flujos reactivos del workflow OMR:
 * - Resultados de análisis y digitalización
 * - Respuestas editadas y borradores por página
 * - Confirmación de revisión y selección de examen/página activa
 * - Histórico de revisiones y sincronización de calificaciones
 * - Cálculos derivados (claves autoritativas, combinación de páginas, ordenamiento y detección de cambios)
 */
import { useCallback, useMemo, useState } from 'react';
import type {
  ResultadoOmr,
  RevisionExamenOmr,
  RevisionPaginaOmr,
  SolicitudRevisionAlumno
} from '../tipos';
import {
  combinarRespuestasOmrPaginas,
  consolidarResultadoOmrExamen
} from '../utilidades';

export type RespuestaOmrItem = {
  numeroPregunta: number;
  opcion: string | null;
  confianza: number;
};

export function useOmrWorkflowState() {
  const [resultadoOmr, setResultadoOmr] = useState<ResultadoOmr | null>(null);
  const [respuestasEditadas, setRespuestasEditadas] = useState<RespuestaOmrItem[]>([]);
  const [borradoresRespuestasOmr, setBorradoresRespuestasOmr] = useState<Record<string, RespuestaOmrItem[]>>({});
  const [revisionOmrConfirmada, setRevisionOmrConfirmada] = useState(false);
  const [examenIdOmr, setExamenIdOmr] = useState<string | null>(null);
  const [examenAlumnoId, setExamenAlumnoId] = useState<string | null>(null);
  const [paginaOmrActiva, setPaginaOmrActiva] = useState<number | null>(null);
  const [revisionesOmr, setRevisionesOmr] = useState<RevisionExamenOmr[]>([]);
  const [solicitudesRevision, setSolicitudesRevision] = useState<SolicitudRevisionAlumno[]>([]);
  const [marcaActualizacionCalificados, setMarcaActualizacionCalificados] = useState<number>(0);

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

  return {
    resultadoOmr,
    setResultadoOmr,
    respuestasEditadas,
    setRespuestasEditadas,
    borradoresRespuestasOmr,
    setBorradoresRespuestasOmr,
    revisionOmrConfirmada,
    setRevisionOmrConfirmada,
    examenIdOmr,
    setExamenIdOmr,
    examenAlumnoId,
    setExamenAlumnoId,
    paginaOmrActiva,
    setPaginaOmrActiva,
    revisionesOmr,
    setRevisionesOmr,
    solicitudesRevision,
    setSolicitudesRevision,
    marcaActualizacionCalificados,
    setMarcaActualizacionCalificados,
    examenOmrActivo,
    claveCorrectaOmrActiva,
    ordenPreguntasClaveOmrActiva,
    respuestasCombinadasRevisionOmrActiva,
    respuestasCombinadasEstablesOmrActiva,
    respuestasParaCalificarOmrActiva,
    resultadoParaCalificarOmrActiva,
    ordenPreguntasCalificarOmrActiva,
    claveCorrectaCalificarOmrActiva,
    hayCambiosPendientesOmrActiva,
    llaveBorradorOmr,
    seleccionarRevisionOmr,
    cargarRevisionHistoricaCalificada,
    actualizarRespuestasOmrActivas,
    actualizarRespuestaPreguntaOmrActiva,
    confirmarRevisionOmrActiva
  };
}
