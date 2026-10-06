/** Seccion de escaneo OMR y revision manual (orquestacion UI). */
import type { ChangeEvent } from 'react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { accionToastSesionParaError, ErrorRemoto } from '../../servicios_api/clienteComun';
import { useConfirmDialog } from '../../ui/feedback/ConfirmDialogProvider';
import { emitToast } from '../../ui/toast/toastBus';
import { Icono } from '../../ui/iconos';
import { Boton } from '../../ui/ux/componentes/Boton';
import { InlineMensaje } from '../../ui/ux/componentes/InlineMensaje';
import { registrarAccionDocente } from './telemetriaDocente';
import {
  analizarOmrConFallbackPie,
  calcularRecortesPieOmr,
  cargarModuloTesseract,
  leerTextosConOcrDetallado,
  qrIdentificaPagina,
  resolverReferenciaPieOmr,
  type ReferenciaPieOmr
} from './ocrTexto';
import type {
  Alumno,
  PreviewCalificacion,
  ResultadoAnalisisOmr,
  ResultadoOmr,
  RevisionExamenOmr
} from './tipos';
import { esMensajeError, mensajeDeError } from './utilidades';
import { evaluarCalidadCaptura, type CalidadCaptura } from './QrAccesoMovil';
import { PanelRevisionVisualOmr } from './PanelRevisionVisualOmr';

export { QrAccesoMovil } from './QrAccesoMovil';

const UMBRAL_OCR_PIE = 75;

async function leerReferenciaPieDeImagen(imagenBase64: string): Promise<ReferenciaPieOmr | null> {
  if (typeof window === 'undefined' || !imagenBase64.startsWith('data:image/')) return null;
  try {
    const imagen = await new Promise<HTMLImageElement>((resolve, reject) => {
      const elemento = new Image();
      elemento.onload = () => resolve(elemento);
      elemento.onerror = () => reject(new Error('No se pudo cargar la captura para OCR'));
      elemento.src = imagenBase64;
    });
    const ancho = Number(imagen.naturalWidth || imagen.width);
    const alto = Number(imagen.naturalHeight || imagen.height);
    if (ancho < 160 || alto < 240) return null;

    // El pie cambia de borde cuando una captura queda apaisada. Buscar solo
    // franjas periféricas excluye fiduciales, respuestas y el contenido central.
    const recortes = calcularRecortesPieOmr(ancho, alto);
    if (recortes.length === 0) return null;
    const escala = 2;
    const imagenesRecortadas: string[] = [];
    for (const recorte of recortes) {
      const x = Math.floor(ancho * recorte.left);
      const y = Math.floor(alto * recorte.top);
      const anchoRecorte = Math.max(1, Math.floor(ancho * recorte.width));
      const altoRecorte = Math.max(1, Math.floor(alto * recorte.height));
      const girado = recorte.rotacionGrados === 90 || recorte.rotacionGrados === 270;
      const canvas = document.createElement('canvas');
      canvas.width = (girado ? altoRecorte : anchoRecorte) * escala;
      canvas.height = (girado ? anchoRecorte : altoRecorte) * escala;
      const contexto = canvas.getContext('2d');
      if (!contexto) return null;
      contexto.fillStyle = '#fff';
      contexto.fillRect(0, 0, canvas.width, canvas.height);
      contexto.translate(canvas.width / 2, canvas.height / 2);
      contexto.rotate(recorte.rotacionGrados * Math.PI / 180);
      contexto.drawImage(
        imagen,
        x,
        y,
        anchoRecorte,
        altoRecorte,
        -anchoRecorte * escala / 2,
        -altoRecorte * escala / 2,
        anchoRecorte * escala,
        altoRecorte * escala
      );
      imagenesRecortadas.push(canvas.toDataURL('image/png'));
    }

    const modulo = await cargarModuloTesseract();
    const lecturas = await leerTextosConOcrDetallado(imagenesRecortadas, modulo.createWorker);
    return resolverReferenciaPieOmr(lecturas, UMBRAL_OCR_PIE);
  } catch {
    return null;
  }
}

export function SeccionEscaneo({
  alumnos,
  onAnalizar,
  onPrevisualizar,
  resultado,
  onActualizar,
  onActualizarPregunta,
  respuestasPaginaEditable,
  respuestasCombinadas,
  claveCorrectaPorNumero,
  ordenPreguntasClave,
  revisionOmrConfirmada,
  hayCambiosPendientesOmrActiva = false,
  onConfirmarRevisionOmr,
  revisionesOmr,
  examenIdActivo,
  paginaActiva,
  onSeleccionarRevision,
  puedeAnalizar,
  puedeCalificar,
  avisarSinPermiso
}: {
  alumnos: Alumno[];
  onAnalizar: (
    folio: string,
    numeroPagina: number,
    imagenBase64: string,
    contexto?: { nombreArchivo?: string }
  ) => Promise<ResultadoAnalisisOmr>;
  onPrevisualizar: (payload: {
    examenGeneradoId: string;
    alumnoId?: string | null;
    respuestasDetectadas?: Array<{ numeroPregunta: number; opcion: string | null; confianza?: number }>;
  }) => Promise<{ preview: PreviewCalificacion }>;
  resultado: ResultadoOmr | null;
  onActualizar: (respuestas: Array<{ numeroPregunta: number; opcion: string | null; confianza: number }>) => void;
  onActualizarPregunta: (numeroPregunta: number, opcion: string | null) => void;
  respuestasPaginaEditable: Array<{ numeroPregunta: number; opcion: string | null; confianza: number }>;
  respuestasCombinadas: Array<{ numeroPregunta: number; opcion: string | null; confianza: number }>;
  claveCorrectaPorNumero: Record<number, string>;
  ordenPreguntasClave: number[];
  revisionOmrConfirmada: boolean;
  hayCambiosPendientesOmrActiva?: boolean;
  onConfirmarRevisionOmr: (confirmada: boolean) => void;
  revisionesOmr: RevisionExamenOmr[];
  examenIdActivo: string | null;
  paginaActiva: number | null;
  onSeleccionarRevision: (examenId: string, numeroPagina: number) => void;
  puedeAnalizar: boolean;
  puedeCalificar: boolean;
  avisarSinPermiso: (mensaje: string) => void;
}) {
  const confirm = useConfirmDialog();
  const [folio, setFolio] = useState('');
  const [numeroPagina, setNumeroPagina] = useState(0);
  const [imagenBase64, setImagenBase64] = useState('');
  const [calidadCaptura, setCalidadCaptura] = useState<CalidadCaptura | null>(null);
  const [mensaje, setMensaje] = useState('');
  const [analizando, setAnalizando] = useState(false);
  const [bloqueoManual, setBloqueoManual] = useState(false);
  const [fuenteIdentificacion, setFuenteIdentificacion] = useState<'qr' | 'ocr' | null>(null);
  const [procesandoLote, setProcesandoLote] = useState(false);
  const [soloPendientes, setSoloPendientes] = useState(false);
  const [lote, setLote] = useState<
    Array<{
      id: string;
      nombre: string;
      imagenBase64: string;
      estado: 'pendiente' | 'analizando' | 'precalificando' | 'listo' | 'error';
      mensaje?: string;
      folio?: string;
      numeroPagina?: number;
      alumnoId?: string | null;
      preview?: PreviewCalificacion | null;
      calidad?: CalidadCaptura;
    }>
  >([]);

  const respuestasCombinadasSeguras = useMemo(
    () => (Array.isArray(respuestasCombinadas) ? respuestasCombinadas : []),
    [respuestasCombinadas]
  );
  const respuestasPaginaEditableSeguras = useMemo(
    () => (Array.isArray(respuestasPaginaEditable) ? respuestasPaginaEditable : []),
    [respuestasPaginaEditable]
  );
  const ordenPreguntasClaveSegura = useMemo(
    () => (Array.isArray(ordenPreguntasClave) ? ordenPreguntasClave : []),
    [ordenPreguntasClave]
  );
  const revisionesSeguras = useMemo(() => (Array.isArray(revisionesOmr) ? revisionesOmr : []), [revisionesOmr]);
  const motivosCaptura = Array.isArray(calidadCaptura?.motivos) ? calidadCaptura!.motivos : [];
  const puedeAnalizarImagen = Boolean(imagenBase64) && Boolean(calidadCaptura?.aprobada);
  const bloqueoAnalisis = !puedeAnalizar;
  const paginaManual = Number.isFinite(numeroPagina) ? Math.max(0, Math.floor(numeroPagina)) : 0;
  const mapaAlumnos = useMemo(() => new Map(alumnos.map((item) => [item._id, item.nombreCompleto])), [alumnos]);
  const paginaDetectadaQr = useMemo(() => {
    const qrTexto = String(resultado?.qrTexto ?? '').trim();
    if (!qrTexto) return null;
    const match = /:P(\d+)(?::|$)/i.exec(qrTexto);
    if (!match?.[1]) return null;
    const pagina = Number(match[1]);
    return Number.isFinite(pagina) && pagina > 0 ? pagina : null;
  }, [resultado?.qrTexto]);
  const advertenciasResultado = Array.isArray(resultado?.advertencias) ? resultado.advertencias : [];
  const rescateExperimentalAplicado = advertenciasResultado.some((advertencia) =>
    advertencia.startsWith('Rescate OMR aceptado por consenso independiente entre escala y homografia')
    || /^P\d+:\s*(?:rescate|refinamiento local)/i.test(advertencia)
  );
  const qrSinValidar = advertenciasResultado.some((advertencia) =>
    advertencia.startsWith('No se detecto QR en la imagen')
    || advertencia.startsWith('El QR no coincide con el examen esperado')
  );
  const revisionesOrdenadas = useMemo(
    () => [...revisionesSeguras].sort((a, b) => b.actualizadoEn - a.actualizadoEn),
    [revisionesSeguras]
  );
  const examenAutoInicializadoRef = useRef<string | null>(null);
  const autoAnalisisLotePendienteRef = useRef(false);

  useEffect(() => {
    if (revisionesOrdenadas.length === 0) return;
    const examenObjetivo =
      (examenIdActivo ? revisionesOrdenadas.find((item) => item.examenId === examenIdActivo) : null) ?? revisionesOrdenadas[0];
    if (!examenObjetivo || examenObjetivo.paginas.length === 0) return;
    const paginasOrdenadas = [...examenObjetivo.paginas].sort((a, b) => Number(a.numeroPagina) - Number(b.numeroPagina));
    const paginaUno = paginasOrdenadas.find((pagina) => Number(pagina.numeroPagina) === 1)?.numeroPagina;
    const primeraDisponible = paginasOrdenadas[0]?.numeroPagina;
    const paginaInicio = Number.isFinite(Number(paginaUno)) ? Number(paginaUno) : Number(primeraDisponible);
    if (!Number.isFinite(paginaInicio)) return;
    const cambioExamen = examenAutoInicializadoRef.current !== examenObjetivo.examenId;
    const paginaActual = Number(paginaActiva);
    const paginaActualEsValida = Number.isFinite(paginaActual)
      ? examenObjetivo.paginas.some((pagina) => Number(pagina.numeroPagina) === paginaActual)
      : false;

    if (!examenIdActivo || cambioExamen) {
      examenAutoInicializadoRef.current = examenObjetivo.examenId;
      if (paginaActual !== paginaInicio) {
        onSeleccionarRevision(examenObjetivo.examenId, paginaInicio);
      }
      return;
    }

    if (!paginaActualEsValida) {
      onSeleccionarRevision(examenObjetivo.examenId, paginaInicio);
    }
  }, [examenIdActivo, onSeleccionarRevision, paginaActiva, revisionesOrdenadas]);
  const paginaRevisionActiva = useMemo(() => {
    if (!examenIdActivo || !Number.isFinite(Number(paginaActiva))) return null;
    const examen = revisionesSeguras.find((item) => item.examenId === examenIdActivo);
    if (!examen) return null;
    return examen.paginas.find((pagina) => Number(pagina.numeroPagina) === Number(paginaActiva)) ?? null;
  }, [examenIdActivo, paginaActiva, revisionesSeguras]);

  useEffect(() => {
    setZoomImagen(1);
  }, [examenIdActivo, paginaActiva]);
  const hayCambiosPendientesPagina = useMemo(() => {
    if (!paginaRevisionActiva) return false;
    const firma = (respuestas: Array<{ numeroPregunta: number; opcion: string | null }>) =>
      [...respuestas]
        .map((item) => `${Number(item.numeroPregunta)}:${item.opcion ?? ''}`)
        .sort()
        .join('|');
    return firma(respuestasPaginaEditableSeguras) !== firma(paginaRevisionActiva.respuestas);
  }, [paginaRevisionActiva, respuestasPaginaEditableSeguras]);
  const hayCambiosPendientesExamen = Boolean(examenIdActivo) && (hayCambiosPendientesOmrActiva || hayCambiosPendientesPagina);
  const examenRevisionActivo = useMemo(() => {
    if (!examenIdActivo) return null;
    return revisionesSeguras.find((item) => item.examenId === examenIdActivo) ?? null;
  }, [examenIdActivo, revisionesSeguras]);
  const resumenEstadoExamen = useMemo(() => {
    const mapearEstado = (estadoBase: 'ok' | 'rechazado_calidad' | 'requiere_revision', confirmada: boolean) => {
      if (estadoBase === 'ok') return 'ok' as const;
      if (confirmada) return 'revisado_manual' as const;
      return 'requiere_revision' as const;
    };
    const paginas = Array.isArray(examenRevisionActivo?.paginas) ? examenRevisionActivo.paginas : [];
    if (paginas.length === 0) {
      const estadoBase = (resultado?.estadoAnalisis ?? 'requiere_revision') as 'ok' | 'rechazado_calidad' | 'requiere_revision';
      const estadoEtiqueta = mapearEstado(estadoBase, revisionOmrConfirmada);
      return {
        estadoEtiqueta,
        calidadPromedio: Number.isFinite(Number(resultado?.calidadPagina)) ? Number(resultado?.calidadPagina) : 0,
        confianzaPromedio: Number.isFinite(Number(resultado?.confianzaPromedioPagina))
          ? Number(resultado?.confianzaPromedioPagina)
          : 0,
        ratioAmbiguasPromedio: Number.isFinite(Number(resultado?.ratioAmbiguas)) ? Number(resultado?.ratioAmbiguas) : 0
      };
    }
    const estadoBaseExamen = paginas.every((pagina) => pagina.resultado.estadoAnalisis === 'ok') ? 'ok' : 'requiere_revision';
    const estadoEtiqueta = mapearEstado(estadoBaseExamen, Boolean(examenRevisionActivo?.revisionConfirmada));
    const divisor = Math.max(1, paginas.length);
    const calidadPromedio =
      paginas.reduce(
        (acumulado, pagina) => acumulado + (Number.isFinite(Number(pagina.resultado.calidadPagina)) ? Number(pagina.resultado.calidadPagina) : 0),
        0
      ) / divisor;
    const confianzaPromedio =
      paginas.reduce(
        (acumulado, pagina) =>
          acumulado +
          (Number.isFinite(Number(pagina.resultado.confianzaPromedioPagina))
            ? Number(pagina.resultado.confianzaPromedioPagina)
            : 0),
        0
      ) / divisor;
    const ratioAmbiguasPromedio =
      paginas.reduce(
        (acumulado, pagina) => acumulado + (Number.isFinite(Number(pagina.resultado.ratioAmbiguas)) ? Number(pagina.resultado.ratioAmbiguas) : 0),
        0
      ) / divisor;
    return { estadoEtiqueta, calidadPromedio, confianzaPromedio, ratioAmbiguasPromedio };
  }, [examenRevisionActivo, resultado, revisionOmrConfirmada]);
  const estadoAnalisisTexto =
    resumenEstadoExamen.estadoEtiqueta === 'ok'
      ? 'OK'
      : resumenEstadoExamen.estadoEtiqueta === 'revisado_manual'
        ? 'Revisado manual'
        : 'En revisión';
  const estadoAnalisisClase = resumenEstadoExamen.estadoEtiqueta === 'ok' ? 'ok' : 'warning';
  const claveCorrectaRevision = useMemo(() => {
    const claveExamen = examenRevisionActivo?.claveCorrectaPorNumero;
    if (claveExamen && Object.keys(claveExamen).length > 0) return claveExamen;
    return claveCorrectaPorNumero;
  }, [claveCorrectaPorNumero, examenRevisionActivo]);
  const totalPaginasExamenActivo = useMemo(() => {
    if (!examenRevisionActivo) return 0;
    return Array.isArray(examenRevisionActivo.paginas) ? examenRevisionActivo.paginas.length : 0;
  }, [examenRevisionActivo]);
  const paginasExamenActivoOrdenadas = useMemo(() => {
    if (!examenRevisionActivo || !Array.isArray(examenRevisionActivo.paginas)) return [] as number[];
    return [...examenRevisionActivo.paginas]
      .map((pagina) => Number(pagina.numeroPagina))
      .filter((numero) => Number.isFinite(numero))
      .sort((a, b) => a - b);
  }, [examenRevisionActivo]);
  const indicePaginaActiva = useMemo(() => {
    const actual = Number(paginaActiva);
    if (!Number.isFinite(actual)) return -1;
    return paginasExamenActivoOrdenadas.findIndex((numero) => numero === actual);
  }, [paginaActiva, paginasExamenActivoOrdenadas]);
  const paginaAnterior = indicePaginaActiva > 0 ? paginasExamenActivoOrdenadas[indicePaginaActiva - 1] : null;
  const paginaSiguiente =
    indicePaginaActiva >= 0 && indicePaginaActiva < paginasExamenActivoOrdenadas.length - 1
      ? paginasExamenActivoOrdenadas[indicePaginaActiva + 1]
      : null;
  const respuestasPaginaOrdenadas = useMemo(
    () => [...respuestasPaginaEditableSeguras].sort((a, b) => a.numeroPregunta - b.numeroPregunta),
    [respuestasPaginaEditableSeguras]
  );
  const respuestasPaginaPorNumero = useMemo(
    () => new Map(respuestasPaginaOrdenadas.map((item) => [item.numeroPregunta, item])),
    [respuestasPaginaOrdenadas]
  );
  const respuestasExamenDinamicasOrdenadas = useMemo(() => {
    if (respuestasCombinadasSeguras.length > 0) {
      return [...respuestasCombinadasSeguras].sort((a, b) => a.numeroPregunta - b.numeroPregunta);
    }
    if (examenRevisionActivo && Array.isArray(examenRevisionActivo.paginas)) {
      const paginaActivaNum = Number(paginaActiva);
      const combinadas = examenRevisionActivo.paginas.flatMap((pagina) =>
        Number.isFinite(paginaActivaNum) && Number(pagina.numeroPagina) === paginaActivaNum
          ? respuestasPaginaEditableSeguras
          : Array.isArray(pagina.respuestas)
            ? pagina.respuestas
            : []
      );
      return [...combinadas].sort((a, b) => a.numeroPregunta - b.numeroPregunta);
    }
    return [...respuestasCombinadasSeguras].sort((a, b) => a.numeroPregunta - b.numeroPregunta);
  }, [examenRevisionActivo, paginaActiva, respuestasCombinadasSeguras, respuestasPaginaEditableSeguras]);
  const respuestasExamenPorNumero = useMemo(
    () => new Map(respuestasExamenDinamicasOrdenadas.map((item) => [item.numeroPregunta, item])),
    [respuestasExamenDinamicasOrdenadas]
  );
  const ordenRevisionExamen = useMemo(() => {
    const ordenExamenActivo = Array.isArray(examenRevisionActivo?.ordenPreguntas)
      ? examenRevisionActivo.ordenPreguntas.filter((numero) => Number.isFinite(Number(numero)))
      : [];
    if (ordenExamenActivo.length > 0) return ordenExamenActivo;
    if (ordenPreguntasClaveSegura.length > 0) return ordenPreguntasClaveSegura;
    const numerosRespuestas = respuestasExamenDinamicasOrdenadas.map((item) => item.numeroPregunta);
    const numerosClave = Object.keys(claveCorrectaRevision)
      .map((numero) => Number(numero))
      .filter((numero) => Number.isFinite(numero));
    return Array.from(new Set([...numerosClave, ...numerosRespuestas])).sort((a, b) => a - b);
  }, [claveCorrectaRevision, examenRevisionActivo, ordenPreguntasClaveSegura, respuestasExamenDinamicasOrdenadas]);
  const ordenRevisionPagina = useMemo(() => {
    const numerosPagina = new Set(respuestasPaginaOrdenadas.map((item) => item.numeroPregunta));
    const ordenFiltrado = ordenRevisionExamen.filter((numeroPregunta) => numerosPagina.has(numeroPregunta));
    if (ordenFiltrado.length > 0) return ordenFiltrado;
    return [...numerosPagina].sort((a, b) => a - b);
  }, [ordenRevisionExamen, respuestasPaginaOrdenadas]);
  const filasRevision = useMemo(
    () =>
      ordenRevisionPagina.map((numeroPregunta) => {
        const detectada = respuestasPaginaPorNumero.get(numeroPregunta);
        const confianza = Number.isFinite(Number(detectada?.confianza)) ? Number(detectada?.confianza) : 0;
        const opcion = typeof detectada?.opcion === 'string' && detectada.opcion ? detectada.opcion : null;
        const correcta = claveCorrectaRevision[numeroPregunta] ?? null;
        const esDudosa = !opcion || confianza < 0.75;
        const tieneClave = Boolean(correcta);
        const esCorrecta = Boolean(tieneClave && opcion && opcion === correcta);
        const requiereAtencion = !tieneClave || !opcion || confianza < 0.75 || !esCorrecta;
        return { numeroPregunta, opcion, confianza, correcta, tieneClave, esDudosa, esCorrecta, requiereAtencion };
      }),
    [claveCorrectaRevision, ordenRevisionPagina, respuestasPaginaPorNumero]
  );
  const resumenRevision = useMemo(
    () => ({
      total: filasRevision.length,
      pendientes: filasRevision.filter((fila) => fila.requiereAtencion).length,
      conClave: filasRevision.filter((fila) => fila.tieneClave).length,
      sinClave: filasRevision.filter((fila) => !fila.tieneClave).length
    }),
    [filasRevision]
  );
  const preguntasMostradas = soloPendientes ? filasRevision.filter((fila) => fila.requiereAtencion) : filasRevision;
  const resumenCalificacionDinamica = useMemo(() => {
    if (!ordenRevisionExamen.length) {
      return { total: 0, aciertos: 0, contestadas: 0, notaSobre5: 0 };
    }
    const normalizar = (valor: string | null | undefined) => {
      const limpio = String(valor ?? '').trim().toUpperCase();
      return limpio.length > 0 ? limpio : null;
    };
    let aciertos = 0;
    let contestadas = 0;
    for (const numeroPregunta of ordenRevisionExamen) {
      const correcta = normalizar(claveCorrectaRevision[numeroPregunta] ?? null);
      const detectada = normalizar(respuestasExamenPorNumero.get(numeroPregunta)?.opcion ?? null);
      if (detectada) contestadas += 1;
      if (correcta && detectada && detectada === correcta) aciertos += 1;
    }
    const total = ordenRevisionExamen.length;
    const notaSobre5 = Number(((aciertos / Math.max(1, total)) * 5).toFixed(2));
    return { total, aciertos, contestadas, notaSobre5 };
  }, [claveCorrectaRevision, ordenRevisionExamen, respuestasExamenPorNumero]);
  const paginasPendientes = useMemo(
    () =>
      revisionesOrdenadas.reduce(
        (acumulado, examen) => acumulado + examen.paginas.filter((pagina) => pagina.resultado.estadoAnalisis !== 'ok').length,
        0
      ),
    [revisionesOrdenadas]
  );
  const totalPaginasRevision = useMemo(
    () => revisionesOrdenadas.reduce((acumulado, examen) => acumulado + examen.paginas.length, 0),
    [revisionesOrdenadas]
  );

  async function leerArchivoBase64(archivo: File): Promise<string> {
    const leer = () =>
      new Promise<string>((resolve, reject) => {
        const lector = new FileReader();
        lector.onload = () => resolve(String(lector.result || ''));
        lector.onerror = () => reject(new Error('No se pudo leer el archivo'));
        lector.readAsDataURL(archivo);
      });

    const dataUrl = await leer();
    if (!dataUrl.startsWith('data:image/')) return dataUrl;

    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const imagen = new Image();
      imagen.onload = () => resolve(imagen);
      imagen.onerror = () => reject(new Error('No se pudo cargar la imagen'));
      imagen.src = dataUrl;
    });

    const maxDimension = 1600;
    const escala = Math.min(1, maxDimension / Math.max(img.width, img.height));
    const ancho = Math.max(1, Math.round(img.width * escala));
    const alto = Math.max(1, Math.round(img.height * escala));
    const canvas = document.createElement('canvas');
    canvas.width = ancho;
    canvas.height = alto;
    const ctx = canvas.getContext('2d');
    if (!ctx) return dataUrl;
    ctx.drawImage(img, 0, 0, ancho, alto);

    const maxChars = 1_900_000;
    let calidad = 0.85;
    let comprimida = canvas.toDataURL('image/jpeg', calidad);
    while (comprimida.length > maxChars && calidad > 0.55) {
      calidad = Math.max(0.55, calidad - 0.1);
      comprimida = canvas.toDataURL('image/jpeg', calidad);
    }
    return comprimida.length > maxChars ? dataUrl : comprimida;
  }

  const analizarConFallbackDePie = useCallback(async (
    folioManual: string,
    paginaManualValor: number,
    imagen: string,
    contexto?: { nombreArchivo?: string }
  ): Promise<{ respuesta: ResultadoAnalisisOmr; referenciaPie: ReferenciaPieOmr | null }> => {
    const resultado = await analizarOmrConFallbackPie({
      folioManual: folioManual,
      paginaManual: paginaManualValor,
      analizar: (folio, pagina) => onAnalizar(folio, pagina, imagen, contexto),
      leerPie: () => leerReferenciaPieDeImagen(imagen),
      tieneQr: (respuesta) => qrIdentificaPagina(
        respuesta.resultado.qrTexto,
        respuesta.resultado.advertencias
      ),
      puedeUsarFallback: (error) =>
        error instanceof ErrorRemoto && ['EXAMEN_NO_ENCONTRADO', 'PAGINA_NO_VALIDA'].includes(
          String(error.detalle.codigo ?? '').toUpperCase()
        )
    });
    return { respuesta: resultado.resultado, referenciaPie: resultado.referenciaPie };
  }, [onAnalizar]);

  async function cargarArchivo(event: ChangeEvent<HTMLInputElement>) {
    const archivo = event.target.files?.[0];
    if (!archivo) return;
    setBloqueoManual(false);
    setFuenteIdentificacion(null);
    onConfirmarRevisionOmr(false);
    const base64 = await leerArchivoBase64(archivo);
    setImagenBase64(base64);
    try {
      const calidad = await evaluarCalidadCaptura(base64);
      setCalidadCaptura(calidad);
      if (!calidad.aprobada) {
        setMensaje('La imagen no cumple calidad minima. Corrige y vuelve a capturar.');
      }
    } catch {
      setCalidadCaptura(null);
      setMensaje('No se pudo evaluar la calidad de la imagen.');
    }
  }

  async function cargarLote(event: ChangeEvent<HTMLInputElement>) {
    const archivos = Array.from(event.target.files ?? []);
    event.target.value = '';
    if (archivos.length === 0) return;
    const nuevos: typeof lote = [];
    for (const archivo of archivos) {
      const base64 = await leerArchivoBase64(archivo);
      let calidad: CalidadCaptura | undefined;
      try {
        calidad = await evaluarCalidadCaptura(base64);
      } catch {
        calidad = undefined;
      }
      const aprobada = Boolean(calidad?.aprobada);
      nuevos.push({
        id: `${archivo.name}-${archivo.size}-${archivo.lastModified}-${Math.random().toString(16).slice(2)}`,
        nombre: archivo.name,
        imagenBase64: base64,
        estado: 'pendiente',
        mensaje: aprobada ? '' : `Advertencia de calidad: ${calidad?.motivos.join(' ') || 'Revisar enfoque/iluminacion.'}`,
        preview: null,
        calidad
      });
    }
    setLote((prev) => [...nuevos, ...prev]);
    autoAnalisisLotePendienteRef.current = true;
  }

  async function analizar() {
    try {
      const inicio = Date.now();
      if (!puedeAnalizar) {
        avisarSinPermiso('No tienes permiso para analizar OMR.');
        return;
      }
      if (!calidadCaptura?.aprobada) {
        setMensaje('La captura no pasa el control de calidad. Ajusta enfoque/iluminacion y reintenta.');
        return;
      }
      setAnalizando(true);
      setMensaje('');
      const { respuesta, referenciaPie } = await analizarConFallbackDePie(
        folio,
        paginaManual,
        imagenBase64
      );
      onConfirmarRevisionOmr(false);
      if (respuesta.resultado.qrTexto || referenciaPie) {
        setBloqueoManual(true);
        setFuenteIdentificacion(referenciaPie ? 'ocr' : 'qr');
        setFolio(referenciaPie?.folio ?? respuesta.folio);
        setNumeroPagina(referenciaPie?.numeroPagina ?? respuesta.numeroPagina);
      }
      setMensaje(referenciaPie
        ? `El QR no validó la identidad; folio ${referenciaPie.folio} y página ${referenciaPie.numeroPagina} recuperados del pie por OCR. Verifica la hoja antes de confirmar.`
        : 'Analisis completado');
      emitToast({ level: 'ok', title: 'Escaneo', message: 'Analisis completado', durationMs: 2200 });
      registrarAccionDocente('analizar_omr', true, Date.now() - inicio);
    } catch (error) {
      const msg = mensajeDeError(error, 'No se pudo analizar');
      setMensaje(msg);
      emitToast({
        level: 'error',
        title: 'No se pudo analizar',
        message: msg,
        durationMs: 5200,
        action: accionToastSesionParaError(error, 'docente')
      });
      registrarAccionDocente('analizar_omr', false);
    } finally {
      setAnalizando(false);
    }
  }

  const analizarLote = useCallback(async () => {
    if (procesandoLote || lote.length === 0) return;
    if (!puedeAnalizar) {
      avisarSinPermiso('No tienes permiso para analizar OMR.');
      return;
    }
    if (!puedeCalificar) {
      avisarSinPermiso('No tienes permiso para previsualizar calificaciones.');
      return;
    }
    setProcesandoLote(true);
    for (const item of lote) {
      if (item.estado === 'listo') continue;
      setLote((prev) => prev.map((i) => (i.id === item.id ? { ...i, estado: 'analizando', mensaje: '' } : i)));
      try {
        const folioEnvio = folio.trim();
        const paginaEnvio = paginaManual > 0 ? paginaManual : 0;
        const { respuesta, referenciaPie } = await analizarConFallbackDePie(
          folioEnvio,
          paginaEnvio,
          item.imagenBase64,
          { nombreArchivo: item.nombre }
        );
        if (respuesta.resultado.estadoAnalisis !== 'ok') {
          const motivo = respuesta.resultado.motivosRevision?.[0] || `Estado ${respuesta.resultado.estadoAnalisis}`;
          setLote((prev) =>
            prev.map((i) => (i.id === item.id ? {
              ...i,
              estado: 'error',
              mensaje: `${referenciaPie ? `Identidad recuperada por OCR (${referenciaPie.folio}, página ${referenciaPie.numeroPagina}). ` : ''}Requiere revisión manual: ${motivo}`
            } : i))
          );
          continue;
        }
        setLote((prev) => prev.map((i) => (i.id === item.id ? { ...i, estado: 'precalificando' } : i)));
        const preview = await onPrevisualizar({
          examenGeneradoId: respuesta.examenId,
          alumnoId: respuesta.alumnoId ?? undefined,
          respuestasDetectadas: respuesta.resultado.respuestasDetectadas
        });
        setLote((prev) =>
          prev.map((i) =>
            i.id === item.id
              ? {
                  ...i,
                  estado: 'listo',
                  folio: respuesta.folio,
                  numeroPagina: respuesta.numeroPagina,
                  alumnoId: respuesta.alumnoId ?? null,
                  mensaje: referenciaPie
                    ? `Identidad recuperada por OCR del pie (${referenciaPie.folio}, página ${referenciaPie.numeroPagina}); verifica el original.`
                    : '',
                  preview: preview.preview
                }
              : i
          )
        );
      } catch (error) {
        const msg = mensajeDeError(error, 'No se pudo analizar');
        setLote((prev) => prev.map((i) => (i.id === item.id ? { ...i, estado: 'error', mensaje: msg } : i)));
      }
    }
    setProcesandoLote(false);
  }, [analizarConFallbackDePie, avisarSinPermiso, folio, lote, onPrevisualizar, paginaManual, procesandoLote, puedeAnalizar, puedeCalificar]);

  useEffect(() => {
    if (!autoAnalisisLotePendienteRef.current) return;
    if (procesandoLote || lote.length === 0 || bloqueoAnalisis || !puedeCalificar) return;
    autoAnalisisLotePendienteRef.current = false;
    void analizarLote();
  }, [analizarLote, bloqueoAnalisis, lote.length, procesandoLote, puedeCalificar]);

  return (
    <div className="panel calif-omr-panel anim-fade-in">
      <div className="banco-section-title">
        <div className="banco-section-title__wrap">
          <span className="banco-section-pill">
            <span className="banco-section-pill__dot" aria-hidden="true" />
            <span>Motor Óptico OMR</span>
          </span>
          <h2 className="entregas-title-heading">
            <Icono nombre="escaneo" /> Escaneo y revisión OMR
          </h2>
          <p className="nota">Captura por página, revisa por examen y confirma manualmente sólo los casos dudosos.</p>
        </div>
        <div className="banco-section-side-meta">
          <span className="banco-counter-tag">{revisionesOrdenadas.length} en cola</span>
          <span className="banco-counter-tag banco-counter-tag--cyan">{totalPaginasRevision} procesadas</span>
          <span className="banco-counter-tag banco-counter-tag--amber">{paginasPendientes} pendientes</span>
        </div>
      </div>

      <div className="calif-captura-grid">
        <div className="calif-captura-card">
          <div className="calif-captura-card__head">
            <span className="banco-section-pill">
              <span className="banco-section-pill__dot" aria-hidden="true" />
              <span>Escaneo Individual</span>
            </span>
            <span className="banco-counter-tag">Cámara / Archivo</span>
          </div>
          <h3>Captura individual</h3>
          <div className="grid grid--2">
            <label className="campo">
              <span>Folio</span>
              <input
                value={folio}
                onChange={(event) => setFolio(event.target.value)}
                placeholder="Auto por QR o escribir..."
                disabled={bloqueoManual || bloqueoAnalisis}
                className="calif-folio-input"
              />
            </label>
            <label className="campo">
              <span>Página</span>
              <input
                type="number"
                min={0}
                value={numeroPagina}
                onChange={(event) => setNumeroPagina(Number(event.target.value))}
                placeholder="0 = detectar QR"
                disabled={bloqueoManual || bloqueoAnalisis}
              />
            </label>
          </div>
          {bloqueoManual && (
            <InlineMensaje tipo="info">
              {fuenteIdentificacion === 'ocr'
                ? 'QR no legible: folio/página recuperados por OCR del pie. Verifica la identidad en el original.'
                : 'QR detectado: se bloqueó el folio/página para evitar errores.'}
              <button type="button" className="link" onClick={() => setBloqueoManual(false)}>
                Editar manualmente
              </button>
            </InlineMensaje>
          )}
          <div className="calif-dropzone-wrap">
            <label className="calif-dropzone">
              <span className="calif-dropzone__icon">
                <Icono nombre="escaneo" />
              </span>
              <span className="calif-dropzone__title">Cargar imagen o foto del examen</span>
              <span className="calif-dropzone__sub">Formatos JPG, PNG, WEBP de alta resolución</span>
              <input type="file" accept="image/*" onChange={cargarArchivo} disabled={bloqueoAnalisis} className="calif-dropzone__input" />
            </label>
          </div>
          {calidadCaptura && (
            <InlineMensaje tipo={calidadCaptura.aprobada ? 'ok' : 'warning'}>
              Calidad captura: nitidez {Math.round(calidadCaptura.blurVar)} · brillo {Math.round(calidadCaptura.brilloMedio)} · hoja{' '}
              {(calidadCaptura.areaHojaRatio * 100).toFixed(0)}%.
              {motivosCaptura.length > 0 ? ` ${motivosCaptura.join(' ')}` : ' Lista para analizar.'}
            </InlineMensaje>
          )}
          <div className="item-actions">
            <Boton
              type="button"
              icono={<Icono nombre="escaneo" />}
              cargando={analizando}
              disabled={!puedeAnalizar || !puedeAnalizarImagen}
              onClick={analizar}
            >
              {analizando ? 'Analizando…' : 'Analizar página'}
            </Boton>
          </div>
        </div>

        <div className="calif-captura-card">
          <div className="calif-captura-card__head">
            <span className="banco-section-pill banco-section-pill--amber">
              <span className="banco-section-pill__dot" aria-hidden="true" />
              <span>Procesamiento Masivo</span>
            </span>
            <span className="banco-counter-tag">Lote ({lote.length})</span>
          </div>
          <h3>Lote de imagenes</h3>
          <div className="calif-dropzone-wrap">
            <label className="calif-dropzone">
              <span className="calif-dropzone__icon">
                <Icono nombre="pdf" />
              </span>
              <span className="calif-dropzone__title">Cargar lote de imágenes escaneadas</span>
              <span className="calif-dropzone__sub">Selecciona múltiples archivos a la vez</span>
              <input type="file" accept="image/*" multiple onChange={cargarLote} disabled={bloqueoAnalisis} className="calif-dropzone__input" />
            </label>
          </div>
          <div className="item-actions">
            <Boton
              type="button"
              icono={<Icono nombre="escaneo" />}
              cargando={procesandoLote}
              disabled={lote.length === 0 || bloqueoAnalisis || !puedeCalificar}
              onClick={analizarLote}
            >
              {procesandoLote ? 'Analizando lote…' : `Analizar lote (${lote.length})`}
            </Boton>
          </div>
          {lote.length > 0 && (
            <div className="resultado">
              <h3>Procesamiento en lote</h3>
              <progress
                value={lote.filter((i) => i.estado === 'listo' || i.estado === 'error').length}
                max={lote.length}
              />
              <ul className="lista lista-items">
                {lote.map((item) => (
                  <li key={item.id}>
                    <div className="item-glass calif-lote-item">
                      <div className="item-row calif-lote-item__row">
                        <div className="calif-lote-item__meta">
                          <div className="item-title">{item.nombre}</div>
                          <div className="item-sub">
                            {item.estado === 'pendiente' && 'En cola'}
                            {item.estado === 'analizando' && 'Analizando…'}
                            {item.estado === 'precalificando' && 'Precalificando…'}
                            {item.estado === 'listo' && 'Listo'}
                            {item.estado === 'error' && `Error: ${item.mensaje ?? ''}`}
                          </div>
                          {item.estado !== 'error' && item.mensaje && <div className="item-sub">{item.mensaje}</div>}
                          {item.folio && (
                            <div className="item-sub">
                              Folio {item.folio} · P{item.numeroPagina ?? '-'} ·{' '}
                              {item.alumnoId ? mapaAlumnos.get(item.alumnoId) ?? item.alumnoId : 'Alumno sin vincular'}
                            </div>
                          )}
                          {item.preview && (
                            <div className="item-sub">
                              Aciertos {item.preview.aciertos}/{item.preview.totalReactivos} · {item.preview.calificacionExamenFinalTexto ?? '-'}
                            </div>
                          )}
                        </div>
                        <div className="item-actions calif-lote-item__preview-wrap">
                          <img
                            src={item.imagenBase64}
                            alt={`preview ${item.nombre}`}
                            className="calif-lote-item__preview"
                          />
                        </div>
                      </div>
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      </div>
      {revisionesOrdenadas.length > 0 && (
        <div className="resultado">
          <h3>Cola de revisión por examen y página</h3>
          <ul className="lista lista-items">
            {revisionesOrdenadas.map((examen) => {
              const paginasOrdenadas = [...examen.paginas].sort((a, b) => a.numeroPagina - b.numeroPagina);
              const pendientes = paginasOrdenadas.filter((pagina) => pagina.resultado.estadoAnalisis !== 'ok').length;
              const esActivo = examen.examenId === examenIdActivo;
              return (
                <li key={examen.examenId}>
                  <div className="item-glass revision-omr-examen">
                    <div className="item-row">
                      <div>
                        <div className="item-title">Folio {examen.folio}</div>
                        <div className="item-sub">
                          {examen.alumnoId ? (mapaAlumnos.get(examen.alumnoId) ?? examen.alumnoId) : 'Alumno sin vincular'}
                        </div>
                        <div className="item-meta">
                          <span>{paginasOrdenadas.length} página(s)</span>
                          <span>{pendientes} pendiente(s) de revisión</span>
                          <span>{examen.revisionConfirmada ? 'Revisión confirmada' : 'Revisión sin confirmar'}</span>
                          {esActivo && hayCambiosPendientesExamen ? <span className="badge warning">Cambios pendientes</span> : null}
                        </div>
                      </div>
                      <div className="item-actions revision-pills-wrap">
                        {paginasOrdenadas.map((pagina) => {
                          const activa = esActivo && Number(paginaActiva) === Number(pagina.numeroPagina);
                          const estado = pagina.resultado.estadoAnalisis === 'ok' ? 'ok' : 'revision';
                          return (
                            <button
                              key={`${examen.examenId}-${pagina.numeroPagina}`}
                              type="button"
                              className={`revision-pill revision-pill--${estado}${activa ? ' activa' : ''}`}
                              onClick={() => onSeleccionarRevision(examen.examenId, Number(pagina.numeroPagina))}
                            >
                              P{pagina.numeroPagina}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  </div>
                </li>
              );
            })}
          </ul>
        </div>
      )}
      {mensaje && (
        <InlineMensaje tipo={esMensajeError(mensaje) ? 'error' : 'ok'}>{mensaje}</InlineMensaje>
      )}

      {resultado && (
        <div className="resultado">
          <div className="calif-section-title">
            <div>
              <h3>Mesa de revisión manual</h3>
              <p className="nota">Contrasta imagen, lectura OMR y clave oficial en un tablero único antes de confirmar la revisión.</p>
            </div>
          </div>
          <div className="item-actions">
            <span className={`badge ${hayCambiosPendientesExamen ? 'warning' : 'ok'}`}>
              {hayCambiosPendientesExamen ? 'Cambios pendientes sin confirmar' : 'Sin cambios pendientes'}
            </span>
            <Boton
              type="button"
              variante="secundario"
              disabled={!examenIdActivo || paginaAnterior === null}
              onClick={() => {
                if (!examenIdActivo || paginaAnterior === null) return;
                onSeleccionarRevision(examenIdActivo, paginaAnterior);
              }}
            >
              Página anterior
            </Boton>
            <span className="item-sub">
              Página {indicePaginaActiva >= 0 ? indicePaginaActiva + 1 : '-'} de {paginasExamenActivoOrdenadas.length || '-'}
            </span>
            <Boton
              type="button"
              variante="secundario"
              disabled={!examenIdActivo || paginaSiguiente === null}
              onClick={() => {
                if (!examenIdActivo || paginaSiguiente === null) return;
                onSeleccionarRevision(examenIdActivo, paginaSiguiente);
              }}
            >
              Página siguiente
            </Boton>
            {paginaRevisionActiva && (
              <Boton
                type="button"
                variante="secundario"
                onClick={() => {
                  onActualizar(paginaRevisionActiva.respuestas);
                  onConfirmarRevisionOmr(false);
                }}
              >
                Restablecer página
              </Boton>
            )}
            <Boton
              type="button"
              variante={revisionOmrConfirmada ? 'secundario' : 'primario'}
              onClick={async () => {
                if (revisionOmrConfirmada && !hayCambiosPendientesExamen) {
                  const confirmarModificacion = await confirm({
                    title: 'Habilitar edición de revisión',
                    message: 'La revisión ya estaba confirmada.',
                    details: ['Si continúas, se reabrirá la edición y luego tendrás que confirmar otra vez.'],
                    confirmLabel: 'Sí, editar revisión',
                    tone: 'warning'
                  });
                  if (!confirmarModificacion) return;
                  onConfirmarRevisionOmr(false);
                  return;
                }
                onConfirmarRevisionOmr(true);
              }}
            >
              {revisionOmrConfirmada
                ? hayCambiosPendientesExamen
                  ? 'Guardar cambios pendientes'
                  : 'Revisión confirmada'
                : 'Confirmar revisión'}
            </Boton>
          </div>
          <div className="item-sub">
            Examen activo: <b>{examenIdActivo ?? '-'}</b> · Página activa: <b>{paginaActiva ?? '-'}</b>
            {totalPaginasExamenActivo > 0 ? (
              <>
                {' '}
                de <b>{totalPaginasExamenActivo}</b>
              </>
            ) : null}
            {paginaRevisionActiva?.nombreArchivo ? ` · Archivo: ${paginaRevisionActiva.nombreArchivo}` : ''}
          </div>
          <div className="item-sub">
            Estado <span className={`badge ${estadoAnalisisClase}`}>{estadoAnalisisTexto}</span> · Calidad{' '}
            promedio {Math.round(resumenEstadoExamen.calidadPromedio * 100)}% · Confianza media examen{' '}
            {Math.round(resumenEstadoExamen.confianzaPromedio * 100)}% · Ambiguas promedio{' '}
            {(resumenEstadoExamen.ratioAmbiguasPromedio * 100).toFixed(1)}%
          </div>
          {paginaDetectadaQr !== null && (
            <div className="item-sub">
              Página detectada por QR: <b>{paginaDetectadaQr}</b>
              {Number.isFinite(Number(paginaActiva)) && Number(paginaActiva) !== paginaDetectadaQr
                ? ' · No coincide con la página activa'
                : ' · Coincide con la página activa'}
            </div>
          )}
          <div className="item-sub">
            Orden de preguntas: {examenRevisionActivo?.ordenPreguntas?.length ? 'propio del examen activo' : 'referencia general'} · Reactivos en revisión:{' '}
            {ordenRevisionExamen.length}
          </div>
          {revisionOmrConfirmada ? (
            <div className="item-sub">Si modificas una revisión confirmada, se solicitará reconfirmación antes de guardar cambios.</div>
          ) : null}
          <div className="item-meta">
            <span>Aciertos: {resumenCalificacionDinamica.aciertos}/{resumenCalificacionDinamica.total}</span>
            <span>Contestadas: {resumenCalificacionDinamica.contestadas}</span>
            <span>Calificación final: {resumenCalificacionDinamica.notaSobre5.toFixed(2)} / 5.00</span>
          </div>
          <div className="omr-review-toolbar" aria-label="Herramientas de revisión visual">
            <div className="omr-review-toolbar__summary">
              <span className="omr-review-toolbar__eyebrow">Comparación visual</span>
              <strong>{resumenRevision.pendientes} pregunta(s) requieren atención</strong>
              <span className="item-sub">
                {resumenRevision.conClave} con clave oficial · {resumenRevision.sinClave} sin clave
              </span>
            </div>
            <label className="omr-review-filter">
              <input type="checkbox" checked={soloPendientes} onChange={(event) => setSoloPendientes(event.target.checked)} />
              <span>Mostrar solo pendientes</span>
            </label>
          </div>
          <PanelRevisionVisualOmr
            imagenRevisionBase64={paginaRevisionActiva?.imagenBase64}
            paginaSeleccionada={Boolean(paginaRevisionActiva)}
            imagenCaptura={imagenBase64}
            examenId={examenIdActivo}
            numeroPagina={paginaActiva}
            preguntas={preguntasMostradas}
            totalPreguntas={resumenRevision.total}
            soloPendientes={soloPendientes}
            onActualizarPregunta={onActualizarPregunta}
            onConfirmarRevisionOmr={onConfirmarRevisionOmr}
          />
          {advertenciasResultado.length > 0 && (
            <div className="alerta">
              {rescateExperimentalAplicado || qrSinValidar ? (
                <div className="omr-experimental-note" role="note">
                  <span className="omr-experimental-note__badge">Experimental</span>
                  <span>
                    {rescateExperimentalAplicado
                      ? 'Se aplicó una heurística de rescate OMR; su validación se limita al dataset disponible. '
                      : ''}
                    {qrSinValidar
                      ? 'El QR no validó la identidad de la hoja: corrobora folio y página en el documento original. '
                      : ''}
                    Compara las marcas con la imagen antes de confirmar o guardar la calificación.
                  </span>
                </div>
              ) : null}
              {advertenciasResultado.map((mensajeItem, idx) => (
                <p key={idx}>{mensajeItem}</p>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
