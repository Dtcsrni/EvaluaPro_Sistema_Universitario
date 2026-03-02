/**
 * vite.config
 *
 * Responsabilidad: Modulo interno del sistema.
 * Limites: Mantener contrato y comportamiento observable del modulo.
 */
// Configuracion Vite para el servidor de desarrollo y build.
import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export default defineConfig(({ mode }) => {
  const envDir = path.resolve(__dirname, '..', '..');
  const env = loadEnv(mode, envDir, '');
  let appVersion = '0.0.0';
  let appName = 'evaluapro';
  let developerName = '';
  try {
    const pkgRaw = fs.readFileSync(path.join(envDir, 'package.json'), 'utf8');
    const pkg = JSON.parse(pkgRaw);
    appVersion = String(pkg?.version || appVersion);
    appName = String(pkg?.name || appName);
    developerName = typeof pkg?.author === 'string'
      ? String(pkg.author)
      : String(pkg?.author?.name || '');
  } catch {
    // fallback values
  }
  const developerNameResolved = String(env.EVALUAPRO_DEVELOPER_NAME || developerName || 'Equipo EvaluaPro');
  const developerRoleResolved = String(env.EVALUAPRO_DEVELOPER_ROLE || 'Desarrollo');
  const flagHttps = String(env.VITE_HTTPS || '').trim();
  const usarHttps = /^(1|true|si|yes)$/i.test(flagHttps);

  const certPath = String(env.VITE_HTTPS_CERT_PATH || '').trim();
  const keyPath = String(env.VITE_HTTPS_KEY_PATH || '').trim();
  const certReady = Boolean(
    usarHttps &&
    certPath &&
    keyPath &&
    fs.existsSync(certPath) &&
    fs.existsSync(keyPath)
  );

  const httpsConfig = certReady
    ? {
        cert: fs.readFileSync(certPath),
        key: fs.readFileSync(keyPath)
      }
    : false;

  const plugins = [react()];

  return {
    plugins,
    // En monorepos, centralizamos variables en el `.env` del root.
    // Esto permite que `VITE_*` se tome del mismo archivo que usa docker compose.
    envDir,
    define: {
      'import.meta.env.VITE_APP_VERSION': JSON.stringify(appVersion),
      'import.meta.env.VITE_APP_NAME': JSON.stringify(appName),
      'import.meta.env.VITE_DEVELOPER_NAME': JSON.stringify(developerNameResolved),
      'import.meta.env.VITE_DEVELOPER_ROLE': JSON.stringify(developerRoleResolved)
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
      chunkSizeWarningLimit: 600
    }
  };
});
