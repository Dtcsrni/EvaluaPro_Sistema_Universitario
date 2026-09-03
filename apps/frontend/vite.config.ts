/**
 * vite.config
 *
 * Responsabilidad: Modulo interno del sistema.
 * Limites: Mantener contrato y comportamiento observable del modulo.
 */
// Configuracion Vite para el servidor de desarrollo y build.
import { defineConfig, loadEnv, type Plugin } from 'vite';
import react from '@vitejs/plugin-react';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

type MetaApp = {
  appVersion: string;
  displayVersion: string;
  appName: string;
  developerName: string;
};

type OmrVersionPolicy = {
  active?: {
    templateVersion?: number;
    contractId?: string;
    displayLabel?: string;
  };
};

function leerMetaApp(envDir: string): MetaApp {
  const fallback: MetaApp = { appVersion: '0.0.0', displayVersion: '0.0.0', appName: 'evaluapro', developerName: '' };
  try {
    const pkgRaw = fs.readFileSync(path.join(envDir, 'package.json'), 'utf8');
    const pkg = JSON.parse(pkgRaw);
    let displayVersion = String(pkg?.version || fallback.displayVersion);
    try {
      const versionMetaRaw = fs.readFileSync(path.join(envDir, 'config', 'app-version.json'), 'utf8');
      const versionMeta = JSON.parse(versionMetaRaw);
      displayVersion = String(versionMeta?.displayVersion || displayVersion);
    } catch {
      // fallback to package version
    }
    return {
      appVersion: String(pkg?.version || fallback.appVersion),
      displayVersion,
      appName: String(pkg?.name || fallback.appName),
      developerName: typeof pkg?.author === 'string' ? String(pkg.author) : String(pkg?.author?.name || '')
    };
  } catch {
    return fallback;
  }
}

function resolverHttps(env: Record<string, string>) {
  const flagHttps = String(env.VITE_HTTPS || '').trim();
  const usarHttps = /^(1|true|si|yes)$/i.test(flagHttps);
  if (!usarHttps) return false;

  const certPath = String(env.VITE_HTTPS_CERT_PATH || '').trim();
  const keyPath = String(env.VITE_HTTPS_KEY_PATH || '').trim();
  const certReady = Boolean(certPath && keyPath && fs.existsSync(certPath) && fs.existsSync(keyPath));
  if (!certReady) return false;

  return {
    cert: fs.readFileSync(certPath),
    key: fs.readFileSync(keyPath)
  };
}

function leerPoliticaOmr(envDir: string) {
  const policyPath = path.join(envDir, 'config', 'omr-version-policy.json');
  const policy = JSON.parse(fs.readFileSync(policyPath, 'utf8')) as OmrVersionPolicy;
  const version = Number(policy.active?.templateVersion);
  const contractId = String(policy.active?.contractId || '').trim();
  const displayLabel = String(policy.active?.displayLabel || '').trim();
  if (version !== 4 || contractId !== 'omr-canonical-v4' || displayLabel !== 'OMR canónico · v4') {
    throw new Error('La política OMR no declara exactamente el contrato canónico activo esperado.');
  }
  return { version, contractId, displayLabel };
}

function sincronizarPublicoSinReemplazo(publicDir: string, outDir: string) {
  if (!fs.existsSync(publicDir)) return;

  const recorrer = (directorio: string): string[] => fs.readdirSync(directorio, { withFileTypes: true }).flatMap((entrada) => {
    const absoluto = path.join(directorio, entrada.name);
    if (entrada.isDirectory()) return recorrer(absoluto);
    return entrada.isFile() ? [absoluto] : [];
  });

  for (const origen of recorrer(publicDir)) {
    const relativo = path.relative(publicDir, origen);
    const destino = path.join(outDir, relativo);
    fs.mkdirSync(path.dirname(destino), { recursive: true });

    if (!fs.existsSync(destino)) {
      fs.copyFileSync(origen, destino);
      continue;
    }

    const contenidoOrigen = fs.readFileSync(origen);
    const contenidoDestino = fs.readFileSync(destino);
    if (Buffer.compare(contenidoOrigen, contenidoDestino) === 0) continue;

    throw new Error(
      `El estático público ${relativo} cambió mientras la salida estaba en uso. ` +
      'Cierra el host que sirve EvaluaPro y vuelve a ejecutar el build.'
    );
  }
}

function pluginPublicoWindowsSeguro(): Plugin {
  let outDir = '';
  return {
    name: 'evaluapro-public-assets-windows-safe',
    apply: 'build',
    configResolved(config) {
      outDir = path.resolve(config.root, config.build.outDir);
    },
    writeBundle() {
      sincronizarPublicoSinReemplazo(path.resolve(__dirname, 'public'), outDir);
    }
  };
}

export function validarGoogleBuild(env: Record<string, string>) {
  const requireGoogleOAuth = /^(1|true|si|yes|on)$/i.test(String(env.REQUIRE_GOOGLE_OAUTH || '').trim());
  const clientId = String(env.VITE_GOOGLE_CLIENT_ID || '').trim();
  const backendClientId = String(env.GOOGLE_OAUTH_CLIENT_ID || '').trim();
  if (requireGoogleOAuth && !clientId) {
    throw new Error('REQUIRE_GOOGLE_OAUTH esta activo, pero falta VITE_GOOGLE_CLIENT_ID para el build frontend.');
  }
  if (requireGoogleOAuth && backendClientId && clientId !== backendClientId) {
    throw new Error('VITE_GOOGLE_CLIENT_ID debe coincidir con GOOGLE_OAUTH_CLIENT_ID cuando Google OAuth es obligatorio.');
  }
  return { requireGoogleOAuth, configured: Boolean(clientId) };
}

export default defineConfig(({ mode }) => {
  const envDir = path.resolve(__dirname, '..', '..');
  const env = loadEnv(mode, envDir, '');
  validarGoogleBuild(env);
  const { appVersion, displayVersion, appName, developerName } = leerMetaApp(envDir);
  const omrPolicy = leerPoliticaOmr(envDir);
  const developerNameResolved = String(env.EVALUAPRO_DEVELOPER_NAME || developerName || 'Equipo EvaluaPro');
  const developerRoleResolved = String(env.EVALUAPRO_DEVELOPER_ROLE || 'Desarrollo');
  const httpsConfig = resolverHttps(env);

  const plugins = [react(), ...(process.platform === 'win32' ? [pluginPublicoWindowsSeguro()] : [])];

  return {
    plugins,
    // En monorepos, centralizamos variables en el `.env` del root.
    // Esto permite que `VITE_*` se tome del mismo archivo que usa docker compose.
    envDir,
    define: {
      'import.meta.env.VITE_APP_VERSION': JSON.stringify(appVersion),
      'import.meta.env.VITE_APP_DISPLAY_VERSION': JSON.stringify(displayVersion),
      'import.meta.env.VITE_APP_NAME': JSON.stringify(appName),
      'import.meta.env.VITE_DEVELOPER_NAME': JSON.stringify(developerNameResolved),
      'import.meta.env.VITE_DEVELOPER_ROLE': JSON.stringify(developerRoleResolved),
      'import.meta.env.VITE_OMR_CANONICAL_VERSION': JSON.stringify(String(omrPolicy.version)),
      'import.meta.env.VITE_OMR_CANONICAL_CONTRACT_ID': JSON.stringify(omrPolicy.contractId),
      'import.meta.env.VITE_OMR_CANONICAL_DISPLAY_LABEL': JSON.stringify(omrPolicy.displayLabel)
    },
    server: {
      host: true,
      port: 5173,
      strictPort: true,
      https: httpsConfig,
      proxy: {
        '/api': {
          target: String(env.VITE_API_PROXY_TARGET || 'http://localhost:4000'),
          changeOrigin: true
        }
      },
      hmr: {
        overlay: false
      }
    },
    preview: {
      host: true,
      port: 4173,
      strictPort: true,
      https: httpsConfig
    },
    build: {
      // En Windows un host estático puede mantener abierto el directorio de salida.
      // Los assets tienen hash y el index nuevo deja sin referencia los anteriores.
      emptyOutDir: process.platform !== 'win32',
      copyPublicDir: process.platform !== 'win32',
      chunkSizeWarningLimit: 600,
      rollupOptions: {
        output: {
          manualChunks(id) {
            if (id.includes('node_modules')) {
              if (id.includes('react') || id.includes('react-dom') || id.includes('react-router-dom')) {
                return 'vendor-react';
              }
              if (id.includes('lucide-react')) {
                return 'vendor-icons';
              }
              return 'vendor-libs';
            }
          }
        }
      }
    }
  };
});
