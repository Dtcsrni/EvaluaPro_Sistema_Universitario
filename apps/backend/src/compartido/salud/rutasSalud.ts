/**
 * Endpoint de salud para monitoreo de API y base de datos.
 */
import { Router } from 'express';
import mongoose from 'mongoose';
import os from 'node:os';
import fs from 'node:fs';
import path from 'node:path';
import QRCode from 'qrcode';
import type { RespuestaLiveness, RespuestaReadiness, RespuestaSalud } from '../tipos/observabilidad';
import { exportarMetricasPrometheus } from '../observabilidad/metrics';

const router = Router();
type TecnologiaVersion = { id: string; label: string; logoUrl: string; website: string };
type VersionMetadata = { appVersion: string; displayVersion: string };

function leerPackageMetadata(raiz: string) {
  let appName = 'evaluapro';
  let appVersion = '0.0.0';
  let authorName = '';
  let repositoryUrl = '';
  try {
    const pkg = JSON.parse(fs.readFileSync(path.join(raiz, 'package.json'), 'utf8'));
    appName = String(pkg?.name || appName);
    appVersion = String(pkg?.version || appVersion);
    authorName = typeof pkg?.author === 'string'
      ? String(pkg.author)
      : String(pkg?.author?.name || '');
    repositoryUrl = String(pkg?.repository?.url || '').trim();
  } catch {
    // fallback
  }
  return { appName, appVersion, authorName, repositoryUrl };
}

function mapTecnologias(raw: unknown[]): TecnologiaVersion[] {
  return raw
    .map((item: unknown) => {
      const entry = item as Record<string, unknown>;
      return {
        id: String(entry.id || '').trim(),
        label: String(entry.label || '').trim(),
        logoUrl: String(entry.logoUrl || '').trim(),
        website: String(entry.website || '').trim()
      };
    })
    .filter((item: TecnologiaVersion) => item.id && item.label && item.logoUrl);
}

function leerCatalogoVersion(raiz: string, fallbackRepositoryUrl: string) {
  let repositoryUrl = fallbackRepositoryUrl;
  let technologies: TecnologiaVersion[] = [];
  try {
    const catalog = JSON.parse(fs.readFileSync(path.join(raiz, 'config', 'version-catalog.json'), 'utf8'));
    repositoryUrl = String(catalog?.repositoryUrl || repositoryUrl || '').trim();
    const rawTech = Array.isArray(catalog?.technologies) ? catalog.technologies : [];
    technologies = mapTecnologias(rawTech as unknown[]);
  } catch {
    // fallback
  }
  return { repositoryUrl, technologies };
}

function leerVersionMetadata(raiz: string, fallbackVersion: string): VersionMetadata {
  try {
    const raw = fs.readFileSync(path.join(raiz, 'config', 'app-version.json'), 'utf8');
    const parsed = JSON.parse(raw);
    return {
      appVersion: String(parsed?.version || fallbackVersion || '0.0.0'),
      displayVersion: String(parsed?.displayVersion || parsed?.version || fallbackVersion || '0.0.0')
    };
  } catch {
    return {
      appVersion: fallbackVersion || '0.0.0',
      displayVersion: fallbackVersion || '0.0.0'
    };
  }
}

function leerChangelog(raiz: string) {
  try {
    return fs.readFileSync(path.join(raiz, 'CHANGELOG.md'), 'utf8').slice(0, 24_000);
  } catch {
    return '';
  }
}

function buscarRaizRepo(inicio: string) {
  let actual = inicio;
  for (let i = 0; i < 10; i += 1) {
    const hasPkg = fs.existsSync(path.join(actual, 'package.json'));
    const hasChangelog = fs.existsSync(path.join(actual, 'CHANGELOG.md'));
    if (hasPkg && hasChangelog) return actual;
    const next = path.dirname(actual);
    if (next === actual) break;
    actual = next;
  }
  return path.resolve(inicio, '../../../../..');
}

export function obtenerVersionInfo() {
  const raiz = buscarRaizRepo(process.cwd());
  const pkg = leerPackageMetadata(raiz);
  const versionMeta = leerVersionMetadata(raiz, pkg.appVersion);
  const catalogo = leerCatalogoVersion(raiz, pkg.repositoryUrl);
  const changelog = leerChangelog(raiz);

  const developerName = String(process.env.EVALUAPRO_DEVELOPER_NAME || pkg.authorName || 'Equipo EvaluaPro').trim();
  const developerRole = String(process.env.EVALUAPRO_DEVELOPER_ROLE || 'Desarrollo').trim();

  return {
    app: {
      name: pkg.appName,
      version: versionMeta.appVersion,
      displayVersion: versionMeta.displayVersion
    },
    repositoryUrl: catalogo.repositoryUrl || 'https://github.com/Dtcsrni',
    technologies: catalogo.technologies,
    developer: {
      nombre: developerName || 'Equipo EvaluaPro',
      rol: developerRole || 'Desarrollo'
    },
    system: {
      node: process.version,
      platform: process.platform,
      arch: process.arch,
      hostname: os.hostname(),
      env: process.env.NODE_ENV ?? 'development',
      uptimeSec: Math.floor(process.uptime()),
      generatedAt: new Date().toISOString()
    },
    changelog
  };
}

router.get('/', (_req, res) => {
  const estado = mongoose.connection.readyState; // 0,1,2,3
  const textoEstado = ['desconectado', 'conectado', 'conectando', 'desconectando'][estado] ?? 'desconocido';
  const payload: RespuestaSalud & { db: { estado: number; descripcion: string } } = {
    estado: 'ok',
    tiempoActivo: process.uptime(),
    db: { estado, descripcion: textoEstado }
  };
  res.json(payload);
});

router.get('/live', (_req, res) => {
  const payload: RespuestaLiveness = {
    estado: 'ok',
    tiempoActivo: process.uptime(),
    servicio: 'api-docente',
    env: process.env.NODE_ENV ?? 'development'
  };
  res.json(payload);
});

router.get('/ready', (_req, res) => {
  const estado = mongoose.connection.readyState; // 0,1,2,3
  const textoEstado = ['desconectado', 'conectado', 'conectando', 'desconectando'][estado] ?? 'desconocido';
  const lista = estado === 1;
  const payload: RespuestaReadiness = {
    estado: lista ? 'ok' : 'degradado',
    tiempoActivo: process.uptime(),
    dependencies: {
      mongodb: {
        status: lista ? 'ok' : 'fail',
        ready: lista,
        state: estado,
        description: textoEstado
      }
    },
    dependencias: {
      db: {
        estado,
        descripcion: textoEstado,
        lista
      }
    }
  };
  res.status(lista ? 200 : 503).json(payload);
});

router.get('/metrics', (_req, res) => {
  const estadoDb = mongoose.connection.readyState;
  const payload = `${exportarMetricasPrometheus()}\n\n# HELP evaluapro_db_ready_state Estado de conexión MongoDB (0-3)\n# TYPE evaluapro_db_ready_state gauge\nevaluapro_db_ready_state ${estadoDb}\n`;
  res.setHeader('Content-Type', 'text/plain; version=0.0.4; charset=utf-8');
  res.send(payload);
});

router.get('/version-info', (_req, res) => {
  res.json(obtenerVersionInfo());
});

function esIpPrivada(ip: string) {
  if (ip.startsWith('10.')) return true;
  if (ip.startsWith('192.168.')) return true;
  if (ip.startsWith('172.')) {
    const seg = Number(ip.split('.')[1] ?? -1);
    return seg >= 16 && seg <= 31;
  }
  return false;
}

function obtenerIpsLocales() {
  const hostEnv = String(process.env.HOST_IP || '').trim();
  const hostIp = /^[0-9.]+$/.test(hostEnv) ? hostEnv : '';
  const redes = os.networkInterfaces();
  const ips: string[] = [];
  for (const entradas of Object.values(redes)) {
    for (const item of entradas ?? []) {
      if (!item || item.internal) continue;
      if (item.family !== 'IPv4') continue;
      ips.push(item.address);
    }
  }
  const unicas = Array.from(new Set(ips));
  if (hostIp && !unicas.includes(hostIp)) {
    unicas.unshift(hostIp);
  }
  const privadas = unicas.filter((ip) => esIpPrivada(ip));
  const publicas = unicas.filter((ip) => !esIpPrivada(ip));
  const preferida = hostIp || privadas[0] || publicas[0] || null;
  return { ips: [...privadas, ...publicas], preferida };
}

router.get('/ip-local', (_req, res) => {
  res.json(obtenerIpsLocales());
});

router.get('/qr', async (req, res) => {
  const texto = typeof req.query.texto === 'string' ? req.query.texto.trim() : '';
  if (!texto) {
    res.status(400).json({ error: { codigo: 'QR_TEXTO_VACIO', mensaje: 'texto requerido' } });
    return;
  }
  try {
    const buffer = await QRCode.toBuffer(texto, {
      margin: 1,
      width: 360,
      errorCorrectionLevel: 'H',
      color: { dark: '#000000', light: '#FFFFFF' }
    });
    res.setHeader('Content-Type', 'image/png');
    res.setHeader('Cache-Control', 'no-store');
    res.setHeader('Cross-Origin-Resource-Policy', 'cross-origin');
    res.send(buffer);
  } catch (error) {
    res.status(500).json({ error: { codigo: 'QR_FALLO', mensaje: error instanceof Error ? error.message : 'Error' } });
  }
});

export default router;
