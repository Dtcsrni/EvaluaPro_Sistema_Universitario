import { Dpapi, isPlatformSupported } from '@primno/dpapi';
import { ErrorAplicacion } from '../../compartido/errores/errorAplicacion.js';
import { descifrarTexto } from '../../compartido/seguridad/cifrado.js';

const PREFIJO_DPAPI = 'dpapi:v1:';
const ENTROPIA = Buffer.from('EvaluaPro/Classroom/OAuthToken/v1', 'utf8');

export type TokenClassroomDescifrado = { token: string; migrado: boolean };

function requerirDpapi(): void {
  if (process.platform !== 'win32' || !isPlatformSupported) {
    throw new ErrorAplicacion(
      'CLASSROOM_DPAPI_NO_DISPONIBLE',
      'El almacenamiento seguro de Classroom requiere la instalación Windows compatible de EvaluaPro.',
      503
    );
  }
}

export function protegerTokenClassroom(token: string): string {
  const valor = String(token || '');
  if (!valor) throw new ErrorAplicacion('CLASSROOM_TOKEN_INVALIDO', 'Google no devolvió un token válido.', 502);
  requerirDpapi();
  try {
    const cifrado = Dpapi.protectData(Buffer.from(valor, 'utf8'), ENTROPIA, 'CurrentUser');
    return `${PREFIJO_DPAPI}${Buffer.from(cifrado).toString('base64')}`;
  } catch {
    throw new ErrorAplicacion('CLASSROOM_DPAPI_CIFRADO_ERROR', 'Windows no pudo proteger el token de Classroom para este usuario.', 503);
  }
}

export function descifrarTokenClassroom(valor: string, llaveLegacy?: string): TokenClassroomDescifrado {
  const cifrado = String(valor || '');
  if (cifrado.startsWith(PREFIJO_DPAPI)) {
    requerirDpapi();
    const base64 = cifrado.slice(PREFIJO_DPAPI.length);
    if (!base64 || !/^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/.test(base64)) {
      throw new ErrorAplicacion('CLASSROOM_DPAPI_DATO_INVALIDO', 'El token protegido de Classroom está dañado; vuelve a vincular la cuenta.', 409);
    }
    try {
      const claro = Dpapi.unprotectData(Buffer.from(base64, 'base64'), ENTROPIA, 'CurrentUser');
      const token = Buffer.from(claro).toString('utf8');
      if (!token) throw new Error('empty token');
      return { token, migrado: false };
    } catch {
      throw new ErrorAplicacion('CLASSROOM_DPAPI_IDENTIDAD_ERROR', 'Windows no pudo recuperar el token con el usuario actual. Vuelve a vincular la cuenta Classroom.', 409);
    }
  }

  if (!llaveLegacy) {
    throw new ErrorAplicacion('CLASSROOM_REAUTORIZAR', 'No se puede migrar el token Classroom existente sin su llave anterior. Vuelve a vincular la misma cuenta; el registro se conservará.', 409);
  }
  try {
    const token = descifrarTexto(cifrado, llaveLegacy);
    if (!token) throw new Error('empty token');
    return { token, migrado: true };
  } catch {
    throw new ErrorAplicacion('CLASSROOM_REAUTORIZAR', 'No se puede migrar el token Classroom existente con la llave anterior disponible. Vuelve a vincular la misma cuenta; el registro se conservará.', 409);
  }
}

export function esTokenClassroomDpapi(valor: string): boolean {
  return String(valor || '').startsWith(PREFIJO_DPAPI);
}
