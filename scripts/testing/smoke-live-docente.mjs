#!/usr/bin/env node
/**
 * smoke-live-docente
 *
 * Responsabilidad: Modulo interno del sistema.
 * Limites: Mantener contrato y comportamiento observable del modulo.
 */
/**
 * Smoke test de integracion real para servidor estatico + backend + db.
 * Valida que no haya regresiones de pantalla en negro ni 'Sin conexion'.
 */
import http from 'node:http';

function get(url) {
  return new Promise((resolve, reject) => {
    http.get(url, (res) => {
      let data = '';
      res.on('data', (c) => data += c);
      res.on('end', () => resolve({ status: res.statusCode, headers: res.headers, body: data }));
    }).on('error', reject);
  });
}

function post(url, payload) {
  return new Promise((resolve, reject) => {
    const raw = JSON.stringify(payload);
    const u = new URL(url);
    const req = http.request({
      hostname: u.hostname,
      port: u.port,
      path: u.pathname,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(raw)
      }
    }, (res) => {
      let data = '';
      res.on('data', (c) => data += c);
      res.on('end', () => resolve({ status: res.statusCode, headers: res.headers, body: data }));
    });
    req.on('error', reject);
    req.write(raw);
    req.end();
  });
}

async function runSmoke() {
  console.log('[SMOKE] 1. Verificando HTML en http://127.0.0.1:4173/...');
  const htmlRes = await get('http://127.0.0.1:4173/');
  if (htmlRes.status !== 200) throw new Error('HTML devolvio status ' + htmlRes.status);
  
  const scriptMatch = htmlRes.body.match(/src="(\/assets\/[^"]+\.js)"/);
  if (!scriptMatch || !scriptMatch[1]) throw new Error('No se encontro script JS principal en index.html');
  const scriptPath = scriptMatch[1];

  console.log('[SMOKE] 2. Verificando tipo MIME del script ' + scriptPath + '...');
  const jsRes = await get('http://127.0.0.1:4173' + scriptPath);
  const ct = String(jsRes.headers['content-type'] || '');
  if (!ct.includes('javascript')) {
    throw new Error('El script devolvio Content-Type no ejecutable: ' + ct + ' (Riesgo de pantalla en negro)');
  }

  console.log('[SMOKE] 3. Verificando API de salud /api/salud/ via proxy...');
  const saludRes = await get('http://127.0.0.1:4173/api/salud/');
  if (saludRes.status !== 200) throw new Error('/api/salud devolvio ' + saludRes.status);
  const saludJson = JSON.parse(saludRes.body);
  if (saludJson.db?.estado !== 1) throw new Error('La base de datos SQLite no esta conectada');

  console.log('[SMOKE] 4. Verificando endpoint de ingreso /api/autenticacion/ingresar...');
  const authRes = await post('http://127.0.0.1:4173/api/autenticacion/ingresar', {
    correo: 'smoke.test@evaluapro.test',
    contrasena: 'password123'
  });
  if (authRes.status === 500 || authRes.status === 502) {
    throw new Error('Endpoint de autenticacion arrojo error de servidor/conexion: ' + authRes.status + ' - ' + authRes.body);
  }

  console.log('[SMOKE] PASSED: Todos los guardrails de conexion y assets pasaron exitosamente.');
}

runSmoke().catch((err) => {
  console.error('[SMOKE FAILED]', err.message);
  process.exit(1);
});
