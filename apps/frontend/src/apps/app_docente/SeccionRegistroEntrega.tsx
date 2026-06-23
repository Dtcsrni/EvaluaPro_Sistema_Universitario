/**
 * SeccionRegistroEntrega
 *
 * Responsabilidad: Seccion funcional del shell docente.
 * Limites: Conservar UX y permisos; extraer logica compleja a hooks/components.
 */
 
/**
 * App docente: panel basico para banco, examenes, entrega y calificacion.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { guardarTokenDocente, limpiarTokenDocente, obtenerTokenDocente } from '../../servicios_api/clienteApi';
import { accionToastSesionParaError, mensajeUsuarioDeErrorConSugerencia, onSesionInvalidada } from '../../servicios_api/clienteComun';
import { emitToast } from '../../ui/toast/toastBus';
import { Icono, Spinner } from '../../ui/iconos';
import { Boton } from '../../ui/ux/componentes/Boton';
import { InlineMensaje } from '../../ui/ux/componentes/InlineMensaje';
import { TemaBoton } from '../../tema/TemaBoton';
import { AyudaFormulario } from './AyudaFormulario';
import { clienteApi } from './clienteApiDocente';
import { SeccionAutenticacion } from './SeccionAutenticacion';
import { SeccionAlumnos } from './SeccionAlumnos';
import { SeccionBanco } from './SeccionBanco';
import { SeccionCuenta } from './SeccionCuenta';
import { QrAccesoMovil, SeccionEscaneo } from './SeccionEscaneo';
import { SeccionPlantillas } from './SeccionPlantillas';
import { SeccionPeriodos, SeccionPeriodosArchivados } from './SeccionPeriodos';
import { registrarAccionDocente } from './telemetriaDocente';
import type {
  Alumno,
  Docente,
  EnviarConPermiso,
  ExamenGeneradoClave,
  Periodo,
  PermisosUI,
  Plantilla,
  Pregunta,
  PreviewCalificacion,
  PreviewPlantilla,
  RegistroSincronizacion,
  RespuestaSyncPull,
  RespuestaSyncPush,
  ResultadoAnalisisOmr,
  ResultadoOmr,
  RevisionExamenOmr,
  RevisionPaginaOmr
} from './tipos';
import {
  combinarRespuestasOmrPaginas,
  construirClaveCorrectaExamen,
  consolidarResultadoOmrExamen,
  esMensajeError,
  etiquetaMateria,
  mensajeDeError,
  normalizarResultadoOmr,
  obtenerSesionDocenteId,
  obtenerVistaInicial,
} from './utilidades';


export function SeccionRegistroEntrega({
  alumnos,
  onVincular,
  puedeGestionar,
  avisarSinPermiso,
  examenesPorFolio
}: {
  alumnos: Alumno[];
  onVincular: (
    folio: string,
    alumnoId: string,
    opciones?: { acordeonEntregado?: boolean; bonoAcordeon?: number }
  ) => Promise<unknown>;
  puedeGestionar: boolean;
  avisarSinPermiso: (mensaje: string) => void;
  examenesPorFolio: Map<string, { alumnoId?: string | null }>;
}) {
  const BONUS_ACORDEON = 0.25;

  type ResultadoLote = {
    id: string;
    nombre: string;
    estado: 'procesando' | 'vinculado' | 'pendiente_alumno' | 'error';
    archivo?: File;
    folio?: string;
    alumnoId?: string;
    sugerenciaAlumnoId?: string;
    acordeonEntregado?: boolean;
    bonoAcordeon?: number;
    previewUrl?: string;
    previewEncabezadoUrl?: string;
    mensaje?: string;
  };

  const [folio, setFolio] = useState('');
  const [alumnoId, setAlumnoId] = useState('');
  const [mensaje, setMensaje] = useState('');
  const [vinculando, setVinculando] = useState(false);
  const [procesandoLote, setProcesandoLote] = useState(false);
  const [resultadosLote, setResultadosLote] = useState<ResultadoLote[]>([]);
  const [indiceMesaTrabajo, setIndiceMesaTrabajo] = useState(0);
  const [verHojaCompletaMesa, setVerHojaCompletaMesa] = useState(false);
  const resultadosLoteRef = useRef<ResultadoLote[]>([]);
  const [scanError, setScanError] = useState('');
  const [escaneando, setEscaneando] = useState(false);
  const inputCamRef = useRef<HTMLInputElement | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const rafRef = useRef<number | null>(null);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const jsQrRef = useRef<((data: Uint8ClampedArray, width: number, height: number, options?: { inversionAttempts?: 'dontInvert' | 'onlyInvert' | 'attemptBoth' | 'invertFirst' }) => { data: string } | null) | null>(null);
  type BarcodeDetectorCtor = new (opts: { formats: string[] }) => {
    detect: (img: ImageBitmapSource) => Promise<Array<{ rawValue?: string }>>;
  };

  const puedeVincular = Boolean(folio.trim() && alumnoId);
  const bloqueoEdicion = !puedeGestionar;
  const inputCarpetaRef = useRef<HTMLInputElement | null>(null);
  const ocrModuloRef = useRef<unknown>(null);
  type OcrResult = { data?: { text?: string } };
  type OcrModule = {
    recognize?: (image: string, languages?: string) => Promise<OcrResult>;
  };

  function prepararAudio() {
    if (typeof window === 'undefined') return;
    try {
      const ctx = audioCtxRef.current ?? new AudioContext();
      audioCtxRef.current = ctx;
      if (ctx.state === 'suspended') void ctx.resume();
    } catch {
      // ignore
    }
  }

  function reproducirSonido(tipo: 'scan' | 'ok') {
    if (typeof window === 'undefined') return;
    try {
      const ctx = audioCtxRef.current ?? new AudioContext();
      audioCtxRef.current = ctx;
      if (ctx.state === 'suspended') void ctx.resume();
      if (ctx.state === 'suspended') return;
      const ahora = ctx.currentTime;
      const salida = ctx.createGain();
      salida.gain.setValueAtTime(0.0001, ahora);
      salida.gain.exponentialRampToValueAtTime(0.08, ahora + 0.02);
      salida.gain.exponentialRampToValueAtTime(0.0001, ahora + 0.35);
      salida.connect(ctx.destination);

      const frecuencias = tipo === 'scan' ? [523.25, 659.25] : [440, 554.37, 659.25];
      const duracion = tipo === 'scan' ? 0.28 : 0.38;
      for (const freq of frecuencias) {
        const osc = ctx.createOscillator();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(freq, ahora);
        osc.connect(salida);
        osc.start(ahora);
        osc.stop(ahora + duracion);
      }
    } catch {
      // ignore
    }
  }

  useEffect(() => {
    const folioLimpio = folio.trim().toUpperCase();
    if (!folioLimpio) return;
    const examen = examenesPorFolio.get(folioLimpio);
    const alumnoDetectado = String(examen?.alumnoId ?? '').trim();
    if (alumnoDetectado && alumnoDetectado !== alumnoId) {
      setAlumnoId(alumnoDetectado);
    }
  }, [alumnoId, examenesPorFolio, folio]);

  async function ejecutarVinculacion(folioValor: string, alumnoValor: string, origen: 'manual' | 'auto') {
    if (!folioValor || !alumnoValor) return;
    try {
      const inicio = Date.now();
      if (!puedeGestionar) {
        avisarSinPermiso('No tienes permiso para vincular entregas.');
        return;
      }
      setVinculando(true);
      setMensaje('');
      await onVincular(folioValor.trim(), alumnoValor);
      setMensaje('Entrega vinculada');
      emitToast({ level: 'ok', title: 'Entrega', message: origen === 'auto' ? 'Entrega vinculada automaticamente' : 'Entrega vinculada', durationMs: 2200 });
      reproducirSonido('ok');
      registrarAccionDocente('vincular_entrega', true, Date.now() - inicio);
    } catch (error) {
      const msg = mensajeDeError(error, 'No se pudo vincular');
      setMensaje(msg);
      emitToast({
        level: 'error',
        title: 'No se pudo vincular',
        message: msg,
        durationMs: 5200,
        action: accionToastSesionParaError(error, 'docente')
      });
      registrarAccionDocente('vincular_entrega', false);
    } finally {
      setVinculando(false);
    }
  }

  async function manejarFolioDetectado(folioDetectado: string) {
    setScanError('');
    setFolio(folioDetectado);
    reproducirSonido('scan');
    const alumnoDetectado = await resolverAlumnoPorFolio(folioDetectado);
    if (alumnoDetectado) {
      setAlumnoId(alumnoDetectado);
      await ejecutarVinculacion(folioDetectado, alumnoDetectado, 'auto');
      return;
    }
    emitToast({ level: 'ok', title: 'QR', message: 'Folio capturado. Selecciona el alumno para vincular.', durationMs: 2400 });
  }

  async function resolverAlumnoPorFolio(folioDetectado: string) {
    const folioNormalizado = String(folioDetectado ?? '').trim().toUpperCase();
    if (!folioNormalizado) return '';
    let alumnoDetectado = String(examenesPorFolio.get(folioNormalizado)?.alumnoId ?? '').trim();
    if (!alumnoDetectado) {
      try {
        const payload = await clienteApi.obtener<{ examen?: { alumnoId?: string | null } }>(
          `/examenes/generados/folio/${encodeURIComponent(folioNormalizado)}`
        );
        alumnoDetectado = String(payload?.examen?.alumnoId ?? '').trim();
      } catch {
        // ignore
      }
    }
    return alumnoDetectado;
  }

  function normalizarTexto(valor: string) {
    return String(valor || '')
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toUpperCase()
      .replace(/[^A-Z0-9\s]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
  }

  function tokenizar(valor: string) {
    return normalizarTexto(valor)
      .split(' ')
      .map((t) => t.trim())
      .filter((t) => t.length >= 3);
  }

  async function leerTextoOcrNombreGrupo(file: File) {
    if (typeof window === 'undefined') return '';
    try {
      const img = await cargarImagen(file);
      const ancho = Number((img as HTMLImageElement).naturalWidth || img.width || 0);
      const alto = Number((img as HTMLImageElement).naturalHeight || img.height || 0);
      if (ancho <= 0 || alto <= 0) return '';

      const canvas = document.createElement('canvas');
      canvas.width = ancho;
      canvas.height = alto;
      const ctx = canvas.getContext('2d');
      if (!ctx) return '';
      ctx.drawImage(img, 0, 0, ancho, alto);

      const topY = Math.max(0, Math.floor(alto * 0.08));
      const cropH = Math.max(180, Math.floor(alto * 0.34));
      const cropCanvas = document.createElement('canvas');
      cropCanvas.width = ancho;
      cropCanvas.height = cropH;
      const cropCtx = cropCanvas.getContext('2d');
      if (!cropCtx) return '';
      cropCtx.drawImage(canvas, 0, topY, ancho, cropH, 0, 0, ancho, cropH);

      const dataUrl = cropCanvas.toDataURL('image/png');
      const specifier = 'tesseract.js';
      const modulo =
        (ocrModuloRef.current as OcrModule | null) ?? (await import(/* @vite-ignore */ specifier));
      ocrModuloRef.current = modulo;
      const recognize = modulo.recognize;
      if (typeof recognize !== 'function') return '';

      const resultado = await recognize(dataUrl, 'spa+eng');
      const text = String(resultado?.data?.text ?? '').trim();
      return text;
    } catch {
      return '';
    }
  }

  async function sugerirAlumnoPorOcr(file: File) {
    const textoRaw = await leerTextoOcrNombreGrupo(file);
    const texto = normalizarTexto(textoRaw);
    if (!texto) return { alumnoId: '', confidence: 0, motivo: 'Sin texto OCR legible' };

    let mejor: { alumnoId: string; score: number; nombre: string; grupo?: string } | null = null;
    let segundo = 0;

    for (const alumno of Array.isArray(alumnos) ? alumnos : []) {
      const alumnoId = String(alumno._id || '').trim();
      if (!alumnoId) continue;

      let score = 0;
      const matricula = normalizarTexto(String(alumno.matricula || ''));
      const grupo = normalizarTexto(String(alumno.grupo || ''));
      const tokensNombre = tokenizar(String(alumno.nombreCompleto || ''));

      if (matricula && texto.includes(matricula)) score += 6;
      if (grupo && texto.includes(grupo)) score += 3;
      for (const tok of tokensNombre.slice(0, 4)) {
        if (texto.includes(tok)) score += 2;
      }

      if (!mejor || score > mejor.score) {
        segundo = mejor?.score ?? 0;
        mejor = { alumnoId, score, nombre: String(alumno.nombreCompleto || ''), grupo: String(alumno.grupo || '') };
      } else if (score > segundo) {
        segundo = score;
      }
    }

    if (!mejor || mejor.score < 5 || mejor.score - segundo < 2) {
      return { alumnoId: '', confidence: 0, motivo: 'Sin coincidencia OCR confiable' };
    }

    const confidence = Math.min(0.99, Math.max(0.55, mejor.score / 14));
    return {
      alumnoId: mejor.alumnoId,
      confidence,
      motivo: `Sugerencia OCR: ${mejor.nombre}${mejor.grupo ? ` (${mejor.grupo})` : ''}`
    };
  }

  function extraerFolioDesdeQr(texto: string) {
    const limpio = String(texto ?? '').trim();
    if (!limpio) return '';
    const upper = limpio.toUpperCase();
    const matchExamen = upper.match(/EXAMEN:([^:\s]+)(:P\d+)?/);
    if (matchExamen?.[1]) return String(matchExamen[1] ?? '').trim();
    const matchFolio = upper.match(/\bFOLIO[-_ ]?[A-Z0-9]+\b/);
    if (matchFolio?.[0]) return matchFolio[0].replace(/\s+/g, '').trim();
    if (/^https?:\/\//i.test(upper)) return '';
    if (upper.startsWith('EXAMEN:')) {
      const partes = upper.split(':');
      return String(partes[1] ?? '').trim();
    }
    return upper;
  }

  async function cargarImagen(file: File): Promise<HTMLImageElement> {
    return await new Promise((resolve, reject) => {
      const url = URL.createObjectURL(file);
      const img = new Image();
      img.onload = () => {
        URL.revokeObjectURL(url);
        resolve(img);
      };
      img.onerror = (err) => {
        URL.revokeObjectURL(url);
        reject(err);
      };
      img.src = url;
    });
  }

  const crearPreviewEncabezadoUrl = useCallback(async (file: File): Promise<string> => {
    const img = await cargarImagen(file);
    const ancho = Number((img as HTMLImageElement).naturalWidth || img.width || 0);
    const alto = Number((img as HTMLImageElement).naturalHeight || img.height || 0);
    if (ancho <= 0 || alto <= 0) return URL.createObjectURL(file);

    const topY = Math.max(0, Math.floor(alto * 0.02));
    const cropH = Math.max(260, Math.floor(alto * 0.44));
    const canvas = document.createElement('canvas');
    canvas.width = ancho;
    canvas.height = cropH;
    const ctx = canvas.getContext('2d');
    if (!ctx) return URL.createObjectURL(file);
    ctx.drawImage(img, 0, topY, ancho, cropH, 0, 0, ancho, cropH);

    const blob = await new Promise<Blob | null>((resolve) => {
      canvas.toBlob((out) => resolve(out), 'image/jpeg', 0.95);
    });
    if (!blob) return URL.createObjectURL(file);
    return URL.createObjectURL(blob);
  }, []);

  async function leerQrConBarcodeDetector(file: File) {
    if (typeof window === 'undefined') return '';
    const Detector = (window as unknown as { BarcodeDetector?: BarcodeDetectorCtor }).BarcodeDetector;
    if (!Detector || typeof createImageBitmap !== 'function') return '';
    try {
      const detector = new Detector({ formats: ['qr_code'] });
      const bitmap = await createImageBitmap(file);
      const codigos = await detector.detect(bitmap);
      if (typeof bitmap.close === 'function') bitmap.close();
      return String(codigos?.[0]?.rawValue ?? '').trim();
    } catch {
      return '';
    }
  }

  async function leerQrConJsQr(file: File) {
    if (typeof window === 'undefined') return '';
    const { default: jsQR } = await import('jsqr');
    const source = typeof createImageBitmap === 'function' ? await createImageBitmap(file) : await cargarImagen(file);
    const width = 'width' in source ? Number(source.width) : Number((source as HTMLImageElement).naturalWidth);
    const height = 'height' in source ? Number(source.height) : Number((source as HTMLImageElement).naturalHeight);
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d');
    if (!ctx) return '';
    ctx.drawImage(source, 0, 0, width, height);
    if ('close' in source && typeof source.close === 'function') source.close();
    const imageData = ctx.getImageData(0, 0, width, height);
    const resultado = jsQR(imageData.data, imageData.width, imageData.height, { inversionAttempts: 'attemptBoth' });
    return String(resultado?.data ?? '').trim();
  }

  async function asegurarJsQr() {
    if (jsQrRef.current) return jsQrRef.current;
    const { default: jsQR } = await import('jsqr');
    jsQrRef.current = jsQR;
    return jsQR;
  }

  function detenerCamara() {
    if (rafRef.current !== null) {
      window.cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    }
    if (mediaStreamRef.current) {
      for (const track of mediaStreamRef.current.getTracks()) {
        track.stop();
      }
      mediaStreamRef.current = null;
    }
    setEscaneando(false);
  }

  async function esperarVideoRef() {
    for (let intento = 0; intento < 8; intento += 1) {
      const video = videoRef.current;
      if (video) return video;
      await new Promise<void>((resolve) => window.requestAnimationFrame(() => resolve()));
    }
    return null;
  }

  async function iniciarCamara() {
    setScanError('');
    if (!navigator?.mediaDevices?.getUserMedia) {
      setScanError('Este navegador no permite camara en vivo. Usa foto.');
      inputCamRef.current?.click();
      return;
    }
    if (typeof window !== 'undefined' && !window.isSecureContext) {
      setScanError('La camara en vivo suele requerir HTTPS. Si falla, usa foto.');
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } });
      mediaStreamRef.current = stream;
      setEscaneando(true);
      const video = await esperarVideoRef();
      if (!video) {
        detenerCamara();
        setScanError('No se pudo iniciar la vista previa de la camara. Usa foto.');
        inputCamRef.current?.click();
        return;
      }
      video.muted = true;
      video.autoplay = true;
      video.playsInline = true;
      video.srcObject = stream;
      await video.play();
      const jsQR = await asegurarJsQr();
      const scan = () => {
        const currentVideo = videoRef.current;
        if (!currentVideo || !mediaStreamRef.current) return;
        if (currentVideo.readyState < 2) {
          rafRef.current = window.requestAnimationFrame(scan);
          return;
        }
        const width = currentVideo.videoWidth || 0;
        const height = currentVideo.videoHeight || 0;
        if (!width || !height) {
          rafRef.current = window.requestAnimationFrame(scan);
          return;
        }
        const canvas = canvasRef.current ?? document.createElement('canvas');
        canvasRef.current = canvas;
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          rafRef.current = window.requestAnimationFrame(scan);
          return;
        }
        ctx.drawImage(currentVideo, 0, 0, width, height);
        const imageData = ctx.getImageData(0, 0, width, height);
        const resultado = jsQR(imageData.data, imageData.width, imageData.height, { inversionAttempts: 'attemptBoth' });
        const valor = String(resultado?.data ?? '').trim();
        const folioDetectado = extraerFolioDesdeQr(valor);
        if (folioDetectado) {
          void manejarFolioDetectado(folioDetectado);
          detenerCamara();
          return;
        }
        rafRef.current = window.requestAnimationFrame(scan);
      };
      rafRef.current = window.requestAnimationFrame(scan);
    } catch (error) {
      detenerCamara();
      const msg = mensajeUsuarioDeErrorConSugerencia(error, 'No se pudo abrir la camara. Usa foto.');
      setScanError(msg);
      inputCamRef.current?.click();
    }
  }

  async function analizarQrDesdeImagen(file: File) {
    if (typeof window === 'undefined') return;
    try {
      let valor = await leerQrConBarcodeDetector(file);
      if (!valor) {
        valor = await leerQrConJsQr(file);
      }
      if (!valor) {
        setScanError('No se detecto ningun QR. Intenta de nuevo con buena luz.');
        return;
      }
      const folioDetectado = extraerFolioDesdeQr(valor);
      if (!folioDetectado) {
        const esUrl = /^https?:\/\//i.test(valor);
        setScanError(esUrl
          ? 'Se detecto un enlace (QR de acceso). Escanea el QR del examen.'
          : 'No se detecto un folio valido. Escanea el QR del examen.');
        return;
      }
      await manejarFolioDetectado(folioDetectado);
    } catch (error) {
      const msg = mensajeUsuarioDeErrorConSugerencia(error, 'No se pudo leer el QR. Intenta de nuevo o captura el folio manualmente.');
      setScanError(msg);
    }
  }

  async function procesarLoteImagenes(files: File[]) {
    if (!puedeGestionar) {
      avisarSinPermiso('No tienes permiso para vincular entregas.');
      return;
    }
    if (files.length === 0) return;

    setScanError('');
    setProcesandoLote(true);
    setIndiceMesaTrabajo(0);
    const itemsIniciales: ResultadoLote[] = files.map((file, indice) => ({
      id: `${Date.now()}-${indice}`,
      nombre: file.name,
      archivo: file,
      estado: 'procesando',
      acordeonEntregado: false,
      bonoAcordeon: BONUS_ACORDEON,
      previewUrl: URL.createObjectURL(file)
    }));
    setResultadosLote(itemsIniciales);

    let porRevisar = 0;
    let pendientes = 0;
    let conError = 0;

    for (let indice = 0; indice < files.length; indice += 1) {
      const file = files[indice];
      try {
        let valor = await leerQrConBarcodeDetector(file);
        if (!valor) valor = await leerQrConJsQr(file);
        if (!valor) {
          conError += 1;
          setResultadosLote((prev) => prev.map((item, idx) => (
            idx === indice
              ? { ...item, estado: 'error', mensaje: 'No se detecto ningun QR' }
              : item
          )));
          continue;
        }

        const folioDetectado = extraerFolioDesdeQr(valor);
        if (!folioDetectado) {
          conError += 1;
          setResultadosLote((prev) => prev.map((item, idx) => (
            idx === indice
              ? { ...item, estado: 'error', mensaje: 'QR sin folio valido' }
              : item
          )));
          continue;
        }

        const alumnoDetectado = await resolverAlumnoPorFolio(folioDetectado);
        if (!alumnoDetectado) {
          const sugerencia = await sugerirAlumnoPorOcr(file);
          pendientes += 1;
          porRevisar += 1;
          setResultadosLote((prev) => prev.map((item, idx) => (
            idx === indice
              ? {
                  ...item,
                  estado: 'pendiente_alumno',
                  folio: folioDetectado,
                  sugerenciaAlumnoId: sugerencia.alumnoId || undefined,
                  alumnoId: sugerencia.alumnoId || undefined,
                  mensaje: sugerencia.alumnoId
                    ? `${sugerencia.motivo} · confirma manualmente`
                    : 'Selecciona alumno manualmente'
                }
              : item
          )));
          if (!folio.trim()) setFolio(folioDetectado);
          if (sugerencia.alumnoId && !alumnoId) setAlumnoId(sugerencia.alumnoId);
          continue;
        }

        porRevisar += 1;
        setResultadosLote((prev) => prev.map((item, idx) => (
          idx === indice
            ? {
                ...item,
                estado: 'pendiente_alumno',
                folio: folioDetectado,
                alumnoId: alumnoDetectado,
                mensaje: 'Alumno preseleccionado por folio; confirma en mesa de trabajo'
              }
            : item
        )));
      } catch (error) {
        conError += 1;
        setResultadosLote((prev) => prev.map((item, idx) => (
          idx === indice
            ? { ...item, estado: 'error', mensaje: mensajeDeError(error, 'No se pudo procesar la imagen') }
            : item
        )));
      }
    }

    setProcesandoLote(false);
    const resumen = `Por revisar: ${porRevisar} · Pendientes: ${pendientes} · Errores: ${conError}`;
    emitToast({ level: conError > 0 ? 'warn' : 'ok', title: 'Lote de entrega', message: resumen, durationMs: 4200 });
  }

  async function reintentarErroresLote() {
    if (procesandoLote) return;
    const errores = resultadosLote.filter((item) => item.estado === 'error' && item.archivo);
    if (errores.length === 0) return;

    setScanError('');
    setProcesandoLote(true);
    setResultadosLote((prev) => prev.map((item) => {
      if (item.estado !== 'error' || !item.archivo) return item;
      return { ...item, estado: 'procesando', mensaje: undefined, folio: undefined, alumnoId: undefined };
    }));

    let porRevisar = 0;
    let pendientes = 0;
    let conError = 0;

    for (const itemError of errores) {
      try {
        const file = itemError.archivo;
        if (!file) {
          conError += 1;
          setResultadosLote((prev) => prev.map((item) => (
            item.id === itemError.id ? { ...item, estado: 'error', mensaje: 'Archivo no disponible para reintento' } : item
          )));
          continue;
        }

        let valor = await leerQrConBarcodeDetector(file);
        if (!valor) valor = await leerQrConJsQr(file);
        if (!valor) {
          conError += 1;
          setResultadosLote((prev) => prev.map((item) => (
            item.id === itemError.id ? { ...item, estado: 'error', mensaje: 'No se detecto ningun QR' } : item
          )));
          continue;
        }

        const folioDetectado = extraerFolioDesdeQr(valor);
        if (!folioDetectado) {
          conError += 1;
          setResultadosLote((prev) => prev.map((item) => (
            item.id === itemError.id ? { ...item, estado: 'error', mensaje: 'QR sin folio valido' } : item
          )));
          continue;
        }

        const alumnoDetectado = await resolverAlumnoPorFolio(folioDetectado);
        if (!alumnoDetectado) {
          const sugerencia = await sugerirAlumnoPorOcr(file);
          pendientes += 1;
          porRevisar += 1;
          setResultadosLote((prev) => prev.map((item) => (
            item.id === itemError.id
              ? {
                  ...item,
                  estado: 'pendiente_alumno',
                  folio: folioDetectado,
                  alumnoId: sugerencia.alumnoId || undefined,
                  sugerenciaAlumnoId: sugerencia.alumnoId || undefined,
                  mensaje: sugerencia.alumnoId
                    ? `${sugerencia.motivo} · confirma manualmente`
                    : 'Selecciona alumno manualmente'
                }
              : item
          )));
          if (!folio.trim()) setFolio(folioDetectado);
          if (sugerencia.alumnoId && !alumnoId) setAlumnoId(sugerencia.alumnoId);
          continue;
        }

        porRevisar += 1;
        setResultadosLote((prev) => prev.map((item) => (
          item.id === itemError.id
            ? {
                ...item,
                estado: 'pendiente_alumno',
                folio: folioDetectado,
                alumnoId: alumnoDetectado,
                mensaje: 'Alumno preseleccionado por folio; confirma en mesa de trabajo'
              }
            : item
        )));
      } catch (error) {
        conError += 1;
        setResultadosLote((prev) => prev.map((item) => (
          item.id === itemError.id
            ? { ...item, estado: 'error', mensaje: mensajeDeError(error, 'No se pudo reprocesar la imagen') }
            : item
        )));
      }
    }

    setProcesandoLote(false);
    const resumen = `Reintento · Por revisar: ${porRevisar} · Pendientes: ${pendientes} · Errores: ${conError}`;
    emitToast({ level: conError > 0 ? 'warn' : 'ok', title: 'Lote de entrega', message: resumen, durationMs: 4200 });
  }

  function limpiarResultadosLote() {
    if (procesandoLote) return;
    for (const item of resultadosLote) {
      if (item.previewUrl) {
        URL.revokeObjectURL(item.previewUrl);
      }
      if (item.previewEncabezadoUrl) {
        URL.revokeObjectURL(item.previewEncabezadoUrl);
      }
    }
    setResultadosLote([]);
    setIndiceMesaTrabajo(0);
    setScanError('');
  }

  const idsPendientesMesa = useMemo(
    () => resultadosLote.filter((item) => item.estado === 'pendiente_alumno').map((item) => item.id),
    [resultadosLote]
  );

  useEffect(() => {
    if (indiceMesaTrabajo >= idsPendientesMesa.length) {
      setIndiceMesaTrabajo(Math.max(0, idsPendientesMesa.length - 1));
    }
  }, [idsPendientesMesa.length, indiceMesaTrabajo]);

  const itemMesaActual = useMemo(
    () => resultadosLote.find((item) => item.id === idsPendientesMesa[indiceMesaTrabajo]) ?? null,
    [resultadosLote, idsPendientesMesa, indiceMesaTrabajo]
  );

  useEffect(() => {
    setVerHojaCompletaMesa(false);
  }, [itemMesaActual?.id]);

  useEffect(() => {
    resultadosLoteRef.current = resultadosLote;
  }, [resultadosLote]);

  useEffect(() => {
    return () => {
      for (const item of resultadosLoteRef.current) {
        if (item.previewUrl) URL.revokeObjectURL(item.previewUrl);
        if (item.previewEncabezadoUrl) URL.revokeObjectURL(item.previewEncabezadoUrl);
      }
    };
  }, []);

  const actualizarItemLote = useCallback((itemId: string, patch: Partial<ResultadoLote>) => {
    setResultadosLote((prev) => prev.map((item) => (item.id === itemId ? { ...item, ...patch } : item)));
  }, []);

  useEffect(() => {
    if (!itemMesaActual || itemMesaActual.previewEncabezadoUrl || !itemMesaActual.archivo) return;
    let cancelado = false;

    void crearPreviewEncabezadoUrl(itemMesaActual.archivo)
      .then((url) => {
        if (cancelado) {
          URL.revokeObjectURL(url);
          return;
        }
        actualizarItemLote(itemMesaActual.id, { previewEncabezadoUrl: url });
      })
      .catch(() => {
        // ignore
      });

    return () => {
      cancelado = true;
    };
  }, [actualizarItemLote, crearPreviewEncabezadoUrl, itemMesaActual]);

  async function vincularItemMesaTrabajoActual() {
    if (!itemMesaActual) return;
    const folioValor = String(itemMesaActual.folio || '').trim();
    const alumnoValor = String(itemMesaActual.alumnoId || '').trim();
    if (!folioValor || !alumnoValor) {
      emitToast({
        level: 'warn',
        title: 'Mesa de trabajo',
        message: 'Selecciona un alumno antes de vincular esta imagen.',
        durationMs: 2600
      });
      return;
    }
    try {
      await onVincular(folioValor, alumnoValor, {
        acordeonEntregado: Boolean(itemMesaActual.acordeonEntregado),
        bonoAcordeon: itemMesaActual.acordeonEntregado
          ? Number(itemMesaActual.bonoAcordeon || BONUS_ACORDEON)
          : 0
      });
      actualizarItemLote(itemMesaActual.id, {
        estado: 'vinculado',
        mensaje: itemMesaActual.acordeonEntregado
          ? `Vinculado con acordeón (+${Number(itemMesaActual.bonoAcordeon || BONUS_ACORDEON).toFixed(2)})`
          : 'Vinculado'
      });
      emitToast({ level: 'ok', title: 'Entrega', message: 'Ítem vinculado', durationMs: 1800 });
    } catch (error) {
      actualizarItemLote(itemMesaActual.id, {
        estado: 'error',
        mensaje: mensajeDeError(error, 'No se pudo vincular este ítem')
      });
      emitToast({
        level: 'error',
        title: 'Entrega',
        message: mensajeDeError(error, 'No se pudo vincular este ítem'),
        durationMs: 4200
      });
    }
  }

  function abrirCamara() {
    setScanError('');
    prepararAudio();
    void iniciarCamara();
  }

  useEffect(() => {
    return () => {
      detenerCamara();
    };
  }, []);

  async function vincular() {
    await ejecutarVinculacion(folio.trim(), alumnoId, 'manual');
  }

  return (
    <div className="panel entregas-panel entregas-panel--registro">
      <h2>
        <Icono nombre="recepcion" /> Registro de entrega
      </h2>
      <AyudaFormulario titulo="Para que sirve y como llenarlo">
        <p>
          <b>Proposito:</b> vincular el folio del examen entregado (papel) con el alumno correcto. Esto evita errores al calificar.
        </p>
        <ul className="lista">
          <li>
            <b>Folio:</b> copialo exactamente del examen (o del QR).
          </li>
          <li>
            <b>Alumno:</b> selecciona al alumno que entrego ese examen.
          </li>
        </ul>
        <p>
          Ejemplo: folio <code>FOLIO-000123</code> y alumno <code>2024-001 - Ana Maria</code>.
        </p>
      </AyudaFormulario>
      <div className="subpanel guia-visual entregas-guia">
        <h3>
          <Icono nombre="recepcion" /> Guia rapida (movil o manual)
        </h3>
        <div className="guia-flujo" aria-hidden="true">
          <Icono nombre="pdf" />
          <Icono nombre="chevron" className="icono icono--muted" />
          <Icono nombre="escaneo" />
          <Icono nombre="chevron" className="icono icono--muted" />
          <Icono nombre="alumno" />
          <span>Examen a folio a alumno</span>
        </div>
        <div className="guia-grid">
          <QrAccesoMovil vista="entrega" />
          <div className="item-glass guia-card">
            <div className="guia-card__header">
              <span className="chip chip-static" aria-hidden="true">
                <Icono nombre="escaneo" /> Con movil
              </span>
            </div>
            <ul className="guia-pasos">
              <li className="guia-paso">
                <span className="paso-num">1</span>
                <div>
                  <div className="paso-titulo">Abre la vista en el movil</div>
                  <p className="nota">
                    Si ya estas en movil, el QR no se muestra. Si estas en PC, escanea el QR para abrir esta vista en el telefono.
                  </p>
                </div>
              </li>
              <li className="guia-paso">
                <span className="paso-num">2</span>
                <div>
                  <div className="paso-titulo">Escanea el QR del examen</div>
                  <p className="nota">
                    Usa la camara del celular (desde la app o la camara del sistema) para leer el folio.
                  </p>
                </div>
              </li>
              <li className="guia-paso">
                <span className="paso-num">3</span>
                <div>
                  <div className="paso-titulo">Selecciona al alumno</div>
                  <p className="nota">Vincula y confirma para evitar errores de calificacion.</p>
                </div>
              </li>
            </ul>
          </div>
          <div className="item-glass guia-card">
            <div className="guia-card__header">
              <span className="chip chip-static" aria-hidden="true">
                <Icono nombre="recepcion" /> Manual
              </span>
            </div>
            <ul className="guia-pasos">
              <li className="guia-paso">
                <span className="paso-num">1</span>
                <div>
                  <div className="paso-titulo">Ubica el folio impreso</div>
                  <p className="nota">Copialo tal cual aparece en la hoja.</p>
                </div>
              </li>
              <li className="guia-paso">
                <span className="paso-num">2</span>
                <div>
                  <div className="paso-titulo">Captura folio y alumno</div>
                  <p className="nota">Elige el alumno correcto antes de vincular.</p>
                </div>
              </li>
              <li className="guia-paso">
                <span className="paso-num">3</span>
                <div>
                  <div className="paso-titulo">Vincula y guarda</div>
                  <p className="nota">Confirma el mensaje de Entrega vinculada.</p>
                </div>
              </li>
            </ul>
          </div>
        </div>
      </div>
      <div className="subpanel entregas-scan">
        <div className="item-row">
          <div>
            <h3>Escaneo y captura</h3>
            <p className="nota">Usa cámara en vivo, imagen única o lote de imágenes para acelerar la recepción.</p>
          </div>
          <div className="item-actions">
            <Boton type="button" icono={<Icono nombre="escaneo" />} onClick={abrirCamara}>
              Escanear QR del examen
            </Boton>
          </div>
        </div>
        {escaneando && (
          <div className="item-glass guia-card entregas-scan__camera">
            <div className="guia-card__header">
              <span className="chip chip-static" aria-hidden="true">
                <Icono nombre="escaneo" /> Camara activa
              </span>
              <Boton type="button" variante="secundario" onClick={detenerCamara}>
                Cerrar camara
              </Boton>
            </div>
            <video ref={videoRef} autoPlay muted playsInline className="registro-entrega-video" />
            <div className="nota">Apunta al QR del examen para capturar el folio.</div>
          </div>
        )}
        <input
          ref={inputCamRef}
          className="input-file-oculto"
          aria-label="Capturar imagen para lectura de QR"
          type="file"
          accept="image/*"
          onChange={(event) => {
            const file = event.target.files?.[0];
            if (!file) return;
            void analizarQrDesdeImagen(file);
            event.currentTarget.value = '';
          }}
        />
        {scanError && (
          <InlineMensaje tipo="warning">
            {scanError}
          </InlineMensaje>
        )}

        <label className="campo">
          Lote de imagenes (bulk)
          <input
            type="file"
            accept="image/*"
            multiple
            disabled={bloqueoEdicion || procesandoLote}
            onChange={(event) => {
              const archivos = Array.from(event.currentTarget.files ?? []);
              if (archivos.length > 0) {
                void procesarLoteImagenes(archivos);
              }
              event.currentTarget.value = '';
            }}
          />
        </label>

        <label className="campo">
          Carpeta de imagenes (bulk)
          <input
            ref={inputCarpetaRef}
            type="file"
            accept="image/*"
            multiple
            disabled={bloqueoEdicion || procesandoLote}
            {...({ webkitdirectory: 'true', directory: 'true' } as unknown as Record<string, string>)}
            onChange={(event) => {
              const archivos = Array.from(event.currentTarget.files ?? []).filter((f) => /^image\//i.test(String(f.type || '')));
              if (archivos.length > 0) {
                void procesarLoteImagenes(archivos);
              }
              event.currentTarget.value = '';
            }}
          />
        </label>
        {procesandoLote && (
          <p className="mensaje" role="status">
            <Spinner /> Procesando lote de imagenes…
          </p>
        )}
        {resultadosLote.length > 0 && (
          <div className="resultado">
            <h3>Resultado del lote</h3>
            {itemMesaActual && (
              <div className="item-glass entregas-vinculacion__item">
                <div className="item-row">
                  <div>
                    <div className="item-title">Mesa de trabajo · {indiceMesaTrabajo + 1}/{idsPendientesMesa.length}</div>
                    <div className="item-sub">{itemMesaActual.nombre}</div>
                    {itemMesaActual.folio && <div className="item-sub">Folio: {itemMesaActual.folio}</div>}
                    {itemMesaActual.mensaje && <div className="item-sub">{itemMesaActual.mensaje}</div>}
                  </div>
                </div>
                {(itemMesaActual.previewEncabezadoUrl || itemMesaActual.previewUrl) && (
                  <div className="entregas-vinculacion__preview">
                    <div className="item-row entregas-vinculacion__preview-header">
                      <div className="item-sub">
                        {verHojaCompletaMesa ? 'Hoja completa' : 'Encabezado del examen (vista ampliada)'}
                      </div>
                      <div className="item-actions">
                        <Boton
                          type="button"
                          variante="secundario"
                          onClick={() => setVerHojaCompletaMesa((v) => !v)}
                        >
                          {verHojaCompletaMesa ? 'Ver encabezado' : 'Ver hoja completa'}
                        </Boton>
                      </div>
                    </div>
                    <img
                      src={verHojaCompletaMesa
                        ? itemMesaActual.previewUrl
                        : (itemMesaActual.previewEncabezadoUrl || itemMesaActual.previewUrl)}
                      alt={verHojaCompletaMesa ? `Captura completa ${itemMesaActual.nombre}` : `Encabezado ${itemMesaActual.nombre}`}
                      className="entregas-vinculacion__preview-image"
                    />
                  </div>
                )}
                <div className="entregas-vinculacion__form entregas-vinculacion__form--spaced">
                  <label className="campo">
                    Alumno
                    <select
                      value={String(itemMesaActual.alumnoId ?? '')}
                      onChange={(event) => actualizarItemLote(itemMesaActual.id, { alumnoId: event.target.value })}
                      disabled={bloqueoEdicion || procesandoLote}
                    >
                      <option value="">Selecciona</option>
                      {alumnos.map((alumno) => (
                        <option key={alumno._id} value={alumno._id}>
                          {alumno.matricula} - {alumno.nombreCompleto}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className="campo entregas-vinculacion__checkbox-field">
                    <span>Acordeón entregado</span>
                    <label className="entregas-vinculacion__checkbox-label">
                      <input
                        type="checkbox"
                        checked={Boolean(itemMesaActual.acordeonEntregado)}
                        onChange={(event) =>
                          actualizarItemLote(itemMesaActual.id, {
                            acordeonEntregado: event.target.checked,
                            bonoAcordeon: BONUS_ACORDEON
                          })
                        }
                        disabled={bloqueoEdicion || procesandoLote}
                      />
                      <span>Aplicar +{BONUS_ACORDEON.toFixed(2)} en calificación de examen</span>
                    </label>
                  </label>
                </div>
                <div className="item-actions entregas-vinculacion__nav">
                  <Boton
                    type="button"
                    variante="secundario"
                    disabled={bloqueoEdicion || procesandoLote || indiceMesaTrabajo <= 0}
                    onClick={() => setIndiceMesaTrabajo((actual) => Math.max(0, actual - 1))}
                  >
                    Anterior
                  </Boton>
                  <Boton
                    type="button"
                    icono={<Icono nombre="recepcion" />}
                    disabled={bloqueoEdicion || procesandoLote || !itemMesaActual.folio || !itemMesaActual.alumnoId}
                    onClick={() => void vincularItemMesaTrabajoActual()}
                  >
                    Vincular y continuar
                  </Boton>
                  <Boton
                    type="button"
                    variante="secundario"
                    disabled={bloqueoEdicion || procesandoLote || indiceMesaTrabajo >= idsPendientesMesa.length - 1}
                    onClick={() => setIndiceMesaTrabajo((actual) => Math.min(idsPendientesMesa.length - 1, actual + 1))}
                  >
                    Siguiente
                  </Boton>
                </div>
              </div>
            )}
            <div className="item-actions">
              {resultadosLote.some((item) => item.estado === 'error') && (
                <Boton
                  type="button"
                  variante="secundario"
                  disabled={procesandoLote}
                  onClick={() => void reintentarErroresLote()}
                >
                  Reintentar solo errores ({resultadosLote.filter((item) => item.estado === 'error').length})
                </Boton>
              )}
              <Boton
                type="button"
                variante="secundario"
                disabled={procesandoLote}
                onClick={limpiarResultadosLote}
              >
                Limpiar resultados
              </Boton>
            </div>
            <ul className="lista lista-items">
              {resultadosLote.map((item) => (
                <li key={item.id}>
                  <div className="item-glass">
                    <div className="item-row">
                      <div>
                        <div className="item-title">{item.nombre}</div>
                        <div className="item-sub">
                          {item.estado === 'procesando' && 'Procesando…'}
                          {item.estado === 'vinculado' && 'Vinculado'}
                          {item.estado === 'pendiente_alumno' && 'Pendiente de alumno'}
                          {item.estado === 'error' && 'Error'}
                        </div>
                        {item.folio && <div className="item-sub">Folio: {item.folio}</div>}
                        {item.alumnoId && <div className="item-sub">Alumno seleccionado: {item.alumnoId}</div>}
                        {item.acordeonEntregado && <div className="item-sub">Acordeón: +{Number(item.bonoAcordeon || BONUS_ACORDEON).toFixed(2)}</div>}
                        {item.mensaje && <div className="item-sub">{item.mensaje}</div>}
                      </div>
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
      <div className="subpanel entregas-vinculacion">
        <h3>Vinculación manual</h3>
        <div className="entregas-vinculacion__form">
          <label className="campo">
            Folio
            <input value={folio} onChange={(event) => setFolio(event.target.value)} disabled={bloqueoEdicion} />
          </label>
          <label className="campo">
            Alumno
            <select value={alumnoId} onChange={(event) => setAlumnoId(event.target.value)} disabled={bloqueoEdicion}>
              <option value="">Selecciona</option>
              {alumnos.map((alumno) => (
                <option key={alumno._id} value={alumno._id}>
                  {alumno.matricula} - {alumno.nombreCompleto}
                </option>
              ))}
            </select>
          </label>
        </div>
        <div className="acciones">
          <Boton
            type="button"
            icono={<Icono nombre="recepcion" />}
            cargando={vinculando}
            disabled={!puedeVincular || bloqueoEdicion}
            onClick={vincular}
          >
            {vinculando ? 'Vinculando…' : 'Vincular'}
          </Boton>
        </div>
      </div>
      {mensaje && (
        <p className={esMensajeError(mensaje) ? 'mensaje error' : 'mensaje ok'} role="status">
          {mensaje}
        </p>
      )}
    </div>
  );
}
