import { spawn, execSync } from 'node:child_process';
import fs from 'node:fs/promises';
import path from 'node:path';

const API_BASE = 'http://localhost:4000/api';
const JWT_SECRETO = 'secreto-release-1.0.0-gate';

function getWslIp() {
  try {
    const stdout = execSync('wsl -d Ubuntu ip addr show eth0').toString();
    const match = stdout.match(/inet\s+([\d\.]+)/);
    if (match && match[1]) {
      return match[1].trim();
    }
  } catch (err) {
    console.error('[Runner] Error al obtener IP de WSL:', err.message);
  }
  return '127.0.0.1';
}

async function waitApiReady() {
  const limit = 30;
  for (let i = 0; i < limit; i += 1) {
    try {
      const res = await fetch('http://localhost:4000/api/salud/live');
      if (res.ok) {
        console.log('[Runner] API está lista y respondiendo en el puerto 4000.');
        return;
      }
    } catch {
      // Ignorar y reintentar
    }
    await new Promise((resolve) => setTimeout(resolve, 500));
  }
  throw new Error('API no se levantó a tiempo en http://localhost:4000');
}

async function postJson(url, body, token = '') {
  const headers = { 'Content-Type': 'application/json' };
  if (token) headers['Authorization'] = `Bearer ${token}`;
  
  const res = await fetch(url, {
    method: 'POST',
    headers,
    body: JSON.stringify(body)
  });
  if (!res.ok) {
    const txt = await res.text();
    throw new Error(`Error en POST ${url}: [${res.status}] ${txt}`);
  }
  return res.json();
}

async function main() {
  const wslIp = getWslIp();
  console.log(`[Runner] IP de WSL2 detectada: ${wslIp}`);
  const mongoUri = `mongodb://${wslIp}:27017/evaluapro_prod`;
  console.log(`[Runner] MONGODB_URI: ${mongoUri}`);

  console.log('[Runner] Iniciando API docente en modo producción local...');
  
  const apiProcess = spawn('node', ['apps/backend/dist/index.js'], {
    cwd: process.cwd(),
    env: {
      ...process.env,
      NODE_ENV: 'production',
      PUERTO_API: '4000',
      MONGODB_URI: mongoUri,
      JWT_SECRETO: JWT_SECRETO,
      CORS_ORIGENES: 'http://localhost:4173',
      PORTAL_ALUMNO_URL: 'http://localhost:4518',
      PORTAL_ALUMNO_API_KEY: 'local-piloto-api-key',
      PORTAL_API_KEY: 'local-portal-api-key'
    },
    stdio: 'inherit'
  });

  apiProcess.on('error', (err) => {
    console.error('[Runner] Error en el proceso de la API:', err);
  });

  try {
    await waitApiReady();
    
    console.log('[Runner] Creando escenario docente funcional...');
    
    // Generar correo dinámico
    const emailDocente = `evaluador-${Date.now()}@release.test`;
    console.log(`[Runner] Usando correo docente: ${emailDocente}`);
    
    // 1. Registrar docente
    const regRes = await postJson(`${API_BASE}/autenticacion/registrar`, {
      nombreCompleto: 'Docente Evaluador',
      correo: emailDocente,
      contrasena: 'Secreto123!'
    });
    const token = regRes.token;
    console.log('[Runner] Docente registrado con éxito.');

    // 2. Crear período operativo
    const perRes = await postJson(`${API_BASE}/periodos`, {
      nombre: 'Periodo de Validacion 2026',
      fechaInicio: '2026-01-01',
      fechaFin: '2026-06-01',
      grupos: ['A']
    }, token);
    const periodoId = perRes.periodo._id;
    console.log(`[Runner] Periodo operativo creado con ID: ${periodoId}`);

    // 3. Crear alumno
    const aluRes = await postJson(`${API_BASE}/alumnos`, {
      periodoId,
      matricula: 'CUH512410168',
      nombreCompleto: 'Alumno Release 1.0.0',
      correo: 'alumno-prod@prueba.test',
      grupo: 'A'
    }, token);
    const alumnoId = aluRes.alumno._id;
    console.log(`[Runner] Alumno registrado con ID: ${alumnoId}`);

    // 4. Crear 8 preguntas en el banco (densidad óptima de 1 página)
    const preguntasIds = [];
    for (let i = 0; i < 8; i += 1) {
      const pregRes = await postJson(`${API_BASE}/banco-preguntas`, {
        periodoId,
        enunciado: `Pregunta de validacion numero ${i + 1}`,
        opciones: [
          { texto: 'Opcion A (Correcta)', esCorrecta: true },
          { texto: 'Opcion B', esCorrecta: false },
          { texto: 'Opcion C', esCorrecta: false },
          { texto: 'Opcion D', esCorrecta: false },
          { texto: 'Opcion E', esCorrecta: false }
        ]
      }, token);
      preguntasIds.push(pregRes.pregunta._id);
    }
    console.log('[Runner] 8 preguntas creadas en el banco.');

    // 5. Crear plantilla de examen
    const planRes = await postJson(`${API_BASE}/examenes/plantillas`, {
      periodoId,
      tipo: 'parcial',
      titulo: 'Examen Parcial Release',
      numeroPaginas: 1,
      preguntasIds
    }, token);
    const plantillaId = planRes.plantilla._id;
    console.log(`[Runner] Plantilla de examen creada con ID: ${plantillaId}`);

    // 6. Generar examen individual
    const examRes = await postJson(`${API_BASE}/examenes/generados`, {
      plantillaId
    }, token);
    const examenId = examRes.examenGenerado._id;
    const folio = examRes.examenGenerado.folio;
    console.log(`[Runner] Examen generado con ID: ${examenId} y Folio: ${folio}`);

    // 7. Vincular entrega
    await postJson(`${API_BASE}/entregas/vincular-folio`, {
      folio,
      alumnoId
    }, token);
    console.log('[Runner] Entrega vinculada.');

    // 8. Calificar
    await postJson(`${API_BASE}/calificaciones/calificar`, {
      examenGeneradoId: examenId,
      alumnoId,
      aciertos: 8,
      totalReactivos: 8,
      bonoSolicitado: 0,
      evaluacionContinua: 5
    }, token);
    console.log('[Runner] Examen calificado.');

    console.log('[Runner] Escenario docente completado en producción local.');
    console.log('[Runner] Ejecutando orquestador del release gate...');
    
    // Invocamos el orquestador del gate con los parámetros correspondientes
    await new Promise((resolve, reject) => {
      const gateProcess = spawn('node', [
        'scripts/release/gate-prod-flow.mjs',
        '--version=1.0.0',
        `--periodo-id=${periodoId}`,
        '--manual=docs/release/manual/prod-flow.json',
        '--api-base=http://localhost:4000/api',
        `--token=${token}`,
        `--docente-id=${emailDocente}`,
        '--commit=local-release'
      ], {
        cwd: process.cwd(),
        env: {
          ...process.env,
          RELEASE_GATE_DOCENTE_HASH_SALT: 'release-gate-salt'
        },
        stdio: 'inherit'
      });

      gateProcess.on('exit', (code) => {
        if (code === 0) {
          console.log('[Runner] Orquestador de gate finalizado exitosamente.');
          resolve();
        } else {
          reject(new Error(`Orquestador falló con código de salida: ${code}`));
        }
      });

      gateProcess.on('error', reject);
    });
    
  } finally {
    console.log('[Runner] Deteniendo API docente de producción local...');
    apiProcess.kill();
  }
}

main().catch((err) => {
  console.error('[Runner] Error en la ejecución del script:', err);
  process.exit(1);
});
