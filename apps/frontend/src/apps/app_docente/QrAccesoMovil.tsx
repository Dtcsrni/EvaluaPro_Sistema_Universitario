/**
 * QrAccesoMovil
 *
 * Responsabilidad: Modulo interno del sistema.
 * Limites: Mantener contrato y comportamiento observable del modulo.
 */
/* eslint-disable @typescript-eslint/no-unused-vars */
import type { ChangeEvent } from 'react';
import { useEffect, useMemo, useState } from 'react';
import { accionToastSesionParaError } from '../../servicios_api/clienteComun';
import { emitToast } from '../../ui/toast/toastBus';
import { Icono, Spinner } from '../../ui/iconos';
import { Boton } from '../../ui/ux/componentes/Boton';
import { InlineMensaje } from '../../ui/ux/componentes/InlineMensaje';
import { AyudaFormulario } from './AyudaFormulario';
import { clienteApi } from './clienteApiDocente';
import { registrarAccionDocente } from './telemetriaDocente';
import type {
  Alumno,
  PreviewCalificacion,
  ResultadoAnalisisOmr,
  ResultadoOmr,
  RevisionExamenOmr
} from './tipos';
import { esMensajeError, mensajeDeError } from './utilidades';
function detectarModoMovil() {
  if (typeof window === 'undefined') return false;
  const ua = String(navigator?.userAgent ?? '');
  const esUa = /Android|iPhone|iPad|iPod|Mobile/i.test(ua);
  const coarse = typeof window.matchMedia === 'function' && window.matchMedia('(pointer: coarse)').matches;
  const narrow = window.innerWidth <= 900;
  return esUa || (coarse && narrow);
}

export function QrAccesoMovil({ vista }: { vista: 'entrega' | 'calificaciones' }) {
  const [urlMovil, setUrlMovil] = useState('');
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState('');
  const [qrFallo, setQrFallo] = useState(false);
  const [esMovil, setEsMovil] = useState(() => detectarModoMovil());
  const usarHttps = /^(1|true|si|yes)$/i.test(String(import.meta.env.VITE_HTTPS || '').trim());
  const [hostManual, setHostManual] = useState(() => {
    if (typeof window === 'undefined') return '';
    return localStorage.getItem('qrHostDocente') ?? '';
  });

  function normalizarHostManual(valor: string) {
    return valor.trim().replace(/^https?:\/\//i, '').replace(/\/.*$/, '');
  }

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const refrescar = () => setEsMovil(detectarModoMovil());
    window.addEventListener('resize', refrescar);
    window.addEventListener('orientationchange', refrescar);
    return () => {
      window.removeEventListener('resize', refrescar);
      window.removeEventListener('orientationchange', refrescar);
    };
  }, []);

  useEffect(() => {
    if (esMovil) return;
    let activo = true;
    queueMicrotask(() => {
      if (!activo) return;
      setQrFallo(false);
      setError('');
      setCargando(true);
    });
    const params = new URLSearchParams(window.location.search);
    params.set('vista', vista);
    const qs = params.toString();
    const ruta = window.location.pathname || '/';
    const puerto = window.location.port ? `:${window.location.port}` : '';
    const protocolo = usarHttps ? 'https:' : window.location.protocol;
    const construirUrl = (host: string) => `${protocolo}//${host}${puerto}${ruta}${qs ? `?${qs}` : ''}`;
    const construirUrlDesdeHost = (host: string) => {
      const limpio = normalizarHostManual(host);
      if (!limpio) return '';
      const tienePuerto = limpio.includes(':');
      const hostFinal = tienePuerto ? limpio : `${limpio}${puerto}`;
      return `${protocolo}//${hostFinal}${ruta}${qs ? `?${qs}` : ''}`;
    };
    const hostManualLimpio = normalizarHostManual(hostManual);
    const hostname = window.location.hostname;

    if (hostManualLimpio) {
      const url = construirUrlDesdeHost(hostManualLimpio);
      const timer = window.setTimeout(() => {
        if (!activo) return;
        setUrlMovil(url);
        setCargando(false);
      }, 0);
      return () => {
        activo = false;
        window.clearTimeout(timer);
      };
    }

    if (hostname && hostname !== 'localhost' && hostname !== '127.0.0.1') {
    const url = `${protocolo}//${window.location.host}${ruta}${qs ? `?${qs}` : ''}`;
    const timer = window.setTimeout(() => {
      if (!activo) return;
      setUrlMovil(url);
        setCargando(false);
      }, 0);
      return () => {
        activo = false;
        window.clearTimeout(timer);
      };
    }

    fetch(`${clienteApi.baseApi}/salud/ip-local`)
      .then((resp) => (resp.ok ? resp.json() : Promise.reject(new Error('Respuesta invalida'))))
      .then((data) => {
        if (!activo) return;
        const ips: string[] = Array.isArray(data?.ips)
          ? (data.ips as unknown[]).map((ip) => String(ip || '').trim()).filter(Boolean)
          : [];
        const esPreferida = (ip: string) => ip.startsWith('192.168.') || ip.startsWith('10.');
        const esDocker = (ip: string) => /^172\.(1[6-9]|2\d|3[0-1])\./.test(ip);
        const ipPreferida = ips.find(esPreferida);
        const ip = String(ipPreferida || ips.find((val) => !esDocker(val)) || data?.preferida || ips[0] || '').trim();
        if (!ip) throw new Error('Sin IP local');
        if (esDocker(ip) && !ipPreferida) {
          setError('Detecte una IP de Docker. Escribe la IP de tu PC para generar el QR.');
          setUrlMovil('');
          return;
        }
        setUrlMovil(construirUrl(ip));
      })
      .catch(() => {
        if (!activo) return;
        setError('No se pudo detectar la IP local. Usa la IP de tu PC en lugar de localhost.');
        setUrlMovil(`${protocolo}//${window.location.host}${ruta}${qs ? `?${qs}` : ''}`);
      })
      .finally(() => {
        if (!activo) return;
        setCargando(false);
      });

    return () => {
      activo = false;
    };
  }, [vista, hostManual, esMovil, usarHttps]);

  if (esMovil) return null;

  const urlQr = urlMovil ? `${clienteApi.baseApi}/salud/qr?texto=${encodeURIComponent(urlMovil)}` : '';
  const mostrarFallback = Boolean((error || qrFallo) && urlMovil);
  const mostrarInput = Boolean(error || qrFallo || hostManual);

  return (
    <div className="item-glass guia-card guia-card--qr">
      <div className="guia-card__header">
        <span className="chip chip-static" aria-hidden="true">
          <Icono nombre="escaneo" /> QR movil
        </span>
      </div>
      {cargando && (
        <InlineMensaje tipo="info" leading={<Spinner />}>
          Generando QR de acceso...
        </InlineMensaje>
      )}
      {!cargando && urlQr && (
        <div className="guia-qr">
          <img className="guia-qr__img" src={urlQr} alt="QR para abrir en movil" onError={() => setQrFallo(true)} />
          {mostrarFallback && (
            <div className="nota">
              Fallback manual: <span className="guia-qr__url">{urlMovil}</span>
            </div>
          )}
        </div>
      )}
      {(error || qrFallo) && (
        <>
          <InlineMensaje tipo="warning">
            {error || 'No se pudo generar el QR. Usa el enlace manual para abrir en el movil.'}
          </InlineMensaje>
        </>
      )}
      {mostrarInput && (
        <>
          <label className="campo">
            IP o host del PC para QR
            <input
              type="text"
              value={hostManual}
              onChange={(event) => {
                const valor = event.target.value;
                setHostManual(valor);
                if (typeof window !== 'undefined') {
                  const limpio = normalizarHostManual(valor);
                  if (limpio) localStorage.setItem('qrHostDocente', limpio);
                  else localStorage.removeItem('qrHostDocente');
                }
              }}
              placeholder="192.168.1.50 o mi-pc.local"
            />
          </label>
        </>
      )}
    </div>
  );
}

export type CalidadCaptura = {
  blurVar: number;
  brilloMedio: number;
  areaHojaRatio: number;
  aprobada: boolean;
  motivos: string[];
};

const UMBRAL_BLUR = 120;
const UMBRAL_BRILLO_MIN = 70;
const UMBRAL_BRILLO_MAX = 210;
const UMBRAL_AREA_HOJA = 0.65;

export async function evaluarCalidadCaptura(dataUrl: string): Promise<CalidadCaptura> {
  const imagen = await new Promise<HTMLImageElement>((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('No se pudo cargar la imagen'));
    img.src = dataUrl;
  });
  const maxDimension = 1200;
  const escala = Math.min(1, maxDimension / Math.max(imagen.width, imagen.height));
  const width = Math.max(1, Math.round(imagen.width * escala));
  const height = Math.max(1, Math.round(imagen.height * escala));
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  if (!ctx) {
    return { blurVar: 0, brilloMedio: 0, areaHojaRatio: 0, aprobada: false, motivos: ['No se pudo evaluar la imagen'] };
  }
  ctx.drawImage(imagen, 0, 0, width, height);
  const raw = ctx.getImageData(0, 0, width, height).data;
  const gray = new Uint8ClampedArray(width * height);
  let suma = 0;
  for (let i = 0, p = 0; i < gray.length; i += 1, p += 4) {
    const v = (raw[p] * 77 + raw[p + 1] * 150 + raw[p + 2] * 29) >> 8;
    gray[i] = v;
    suma += v;
  }
  const brilloMedio = suma / Math.max(1, gray.length);

  let lapSum = 0;
  let lapSumSq = 0;
  let gradMinX = width;
  let gradMinY = height;
  let gradMaxX = 0;
  let gradMaxY = 0;
  let gradCount = 0;
  for (let y = 1; y < height - 1; y += 1) {
    for (let x = 1; x < width - 1; x += 1) {
      const c = gray[y * width + x];
      const lap =
        gray[y * width + (x - 1)] +
        gray[y * width + (x + 1)] +
        gray[(y - 1) * width + x] +
        gray[(y + 1) * width + x] -
        4 * c;
      lapSum += lap;
      lapSumSq += lap * lap;

      const gx = gray[y * width + (x + 1)] - gray[y * width + (x - 1)];
      const gy = gray[(y + 1) * width + x] - gray[(y - 1) * width + x];
      const g = Math.abs(gx) + Math.abs(gy);
      if (g > 42) {
        gradCount += 1;
        if (x < gradMinX) gradMinX = x;
        if (x > gradMaxX) gradMaxX = x;
        if (y < gradMinY) gradMinY = y;
        if (y > gradMaxY) gradMaxY = y;
      }
    }
  }
  const lapMean = lapSum / Math.max(1, (width - 2) * (height - 2));
  const blurVar = Math.max(0, lapSumSq / Math.max(1, (width - 2) * (height - 2)) - lapMean * lapMean);
  const bboxArea =
    gradCount > 50 && gradMaxX > gradMinX && gradMaxY > gradMinY ? (gradMaxX - gradMinX + 1) * (gradMaxY - gradMinY + 1) : 0;
  const areaHojaRatio = bboxArea / Math.max(1, width * height);

  const motivos: string[] = [];
  if (blurVar < UMBRAL_BLUR) motivos.push('Enfoca mejor la camara (imagen borrosa).');
  if (brilloMedio < UMBRAL_BRILLO_MIN) motivos.push('Mejora la iluminacion (imagen oscura).');
  if (brilloMedio > UMBRAL_BRILLO_MAX) motivos.push('Reduce el brillo o evita reflejos.');
  if (areaHojaRatio < UMBRAL_AREA_HOJA) motivos.push('Ajusta el encuadre para incluir toda la hoja.');

  return {
    blurVar,
    brilloMedio,
    areaHojaRatio,
    aprobada: motivos.length === 0,
    motivos
  };
}
