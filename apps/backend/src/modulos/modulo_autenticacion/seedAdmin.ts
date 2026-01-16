import { Docente } from './modeloDocente';
import { crearHash } from './servicioHash';

function shouldSeed(): boolean {
  const env = String(process.env.NODE_ENV || '').toLowerCase();
  if (env !== 'production') return true;
  return String(process.env.SEED_ADMIN_FORCE || '').toLowerCase() === 'true';
}

function normalizeEmail(value: unknown): string {
  return String(value || '').trim().toLowerCase();
}

function normalizeName(value: unknown): string {
  return String(value || '').trim();
}

export async function seedAdminDocente() {
  if (!shouldSeed()) return;

  const correo = normalizeEmail(process.env.SEED_ADMIN_EMAIL);
  const contrasena = String(process.env.SEED_ADMIN_PASSWORD || '');
  const nombreCompleto = normalizeName(process.env.SEED_ADMIN_NOMBRE_COMPLETO || 'Administrador');

  if (!correo || !contrasena) return;

  const existente = await Docente.findOne({ correo });
  const nombresPartes = nombreCompleto.split(' ').map((p) => p.trim()).filter(Boolean);
  const nombres = nombresPartes.length ? nombresPartes.slice(0, -1).join(' ') || nombresPartes[0] : undefined;
  const apellidos = nombresPartes.length >= 2 ? nombresPartes.slice(-1).join(' ') : undefined;

  if (existente) {
    const rolesActuales = Array.isArray((existente as unknown as { roles?: unknown }).roles)
      ? ((existente as unknown as { roles?: string[] }).roles || [])
      : [];

    const debeAgregarAdmin = !rolesActuales.includes('admin');
    const debeAgregarDocente = !rolesActuales.includes('docente');

    const set: Record<string, unknown> = {};
    const roles = [...rolesActuales];
    if (debeAgregarAdmin) roles.push('admin');
    if (debeAgregarDocente) roles.push('docente');
    if (debeAgregarAdmin || debeAgregarDocente) set.roles = roles;

    if (!existente.hashContrasena) set.hashContrasena = await crearHash(contrasena);
    if (!existente.activo) set.activo = true;

    if (Object.keys(set).length) {
      await Docente.updateOne({ _id: existente._id }, { $set: set });
    }
    return;
  }

  const hashContrasena = await crearHash(contrasena);
  await Docente.create({
    ...(typeof nombres === 'string' && nombres ? { nombres } : {}),
    ...(typeof apellidos === 'string' && apellidos ? { apellidos } : {}),
    nombreCompleto,
    correo,
    hashContrasena,
    activo: true,
    roles: ['admin', 'docente'],
    ultimoAcceso: new Date()
  });
}
