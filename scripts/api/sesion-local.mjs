#!/usr/bin/env node
import { EvaluaproClient } from './evaluapro-client.mjs';

const [comando = 'help', ...argumentos] = process.argv.slice(2);
const baseUrl = process.env.EVALUAPRO_URL || 'http://127.0.0.1:4000';
const equipoId = process.env.EVALUAPRO_EQUIPO_ID;
const permisosLectura = ['periodos:leer', 'temarios:leer', 'banco:leer', 'plantillas:leer', 'examenes:leer'];

function cliente() { return new EvaluaproClient({ baseUrl, equipoId }); }
function ayuda() {
  console.log('Uso: node scripts/api/sesion-local.mjs <authorize|status|revoke> [--permissions=p1,p2]');
  console.log('authorize solicita consentimiento en EvaluaPro; status y revoke usan Windows Credential Manager.');
}

try {
  if (comando === 'authorize') {
    const especificados = argumentos.find((arg) => arg.startsWith('--permissions='))?.slice('--permissions='.length);
    const permisos = especificados ? especificados.split(',').map((item) => item.trim()).filter(Boolean) : permisosLectura;
    const api = cliente();
    const solicitud = await api.solicitarAutorizacionApi({
      nombreCliente: 'EvaluaPro API CLI', permisos,
      alCrearSolicitud: ({ codigo, expiraEn }) => {
        console.log(`En EvaluaPro abre Cuenta > Acceso de clientes API locales e ingresa: ${codigo}`);
        console.log(`El código vence a las ${new Date(expiraEn).toLocaleTimeString()}. Autoriza solo los permisos necesarios.`);
        console.log('Esperando aprobación…');
      }
    });
    const resultado = await solicitud.esperarAprobacion();
    console.log(`Autorización guardada en Windows Credential Manager (credencial ${resultado.credencialId}).`);
    console.log('El token de acceso permanece solo en memoria y no se imprime.');
  } else if (comando === 'status') {
    const api = cliente();
    if (!await api.recuperarSesionApi()) {
      console.log('No hay una credencial API local guardada para este servidor.');
      process.exitCode = 1;
    } else {
      const estado = await api.preflight();
      console.log(JSON.stringify({ authenticated: estado.authenticated, permissions: estado.permissions, api: estado.version?.version }, null, 2));
    }
  } else if (comando === 'revoke') {
    const api = cliente();
    if (!await api.recuperarSesionApi()) {
      console.log('No hay una credencial API local guardada para este servidor.');
    } else if (await api.revocarSesionApi()) {
      console.log('Credencial revocada y eliminada de Windows Credential Manager.');
    }
  } else {
    ayuda();
    if (comando !== 'help') process.exitCode = 2;
  }
} catch (error) {
  const message = error instanceof Error ? error.message : 'Error del cliente API local.';
  console.error(message);
  process.exitCode = 1;
}
