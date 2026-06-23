/**
 * auth-reset-password
 *
 * Responsabilidad: Modulo interno del sistema.
 * Limites: Mantener contrato y comportamiento observable del modulo.
 */
import mongoose from 'mongoose';
import { Docente } from '../src/modulos/modulo_autenticacion/modeloDocente';
import { crearHash } from '../src/modulos/modulo_autenticacion/servicioHash';

type Opciones = {
  correo: string;
  nuevaContrasena: string;
  mongoUri: string;
};

function parseArgs(argv: string[]): Opciones {
  const args = argv.slice(2);
  let correo = '';
  let nuevaContrasena = '';
  let mongoUri = process.env.MONGODB_URI_HOST || 'mongodb://localhost:27017/evaluapro';

  for (let i = 0; i < args.length; i += 1) {
    const arg = args[i];
    const next = args[i + 1];
    if ((arg === '--correo' || arg === '-c') && next) {
      correo = next;
      i += 1;
      continue;
    }
    if ((arg === '--password' || arg === '-p') && next) {
      nuevaContrasena = next;
      i += 1;
      continue;
    }
    if (arg === '--mongo' && next) {
      mongoUri = next;
      i += 1;
    }
  }

  const correoNormalizado = String(correo || '').trim().toLowerCase();
  if (!correoNormalizado.includes('@')) {
    throw new Error('Debes indicar --correo con un email valido.');
  }
  if (String(nuevaContrasena || '').trim().length < 8) {
    throw new Error('La nueva contrasena debe tener al menos 8 caracteres (--password).');
  }

  return { correo: correoNormalizado, nuevaContrasena, mongoUri };
}

async function main() {
  const options = parseArgs(process.argv);
  await mongoose.connect(options.mongoUri);
  try {
    const docente = await Docente.findOne({ correo: options.correo });
    if (!docente) {
      throw new Error(`No existe docente para el correo: ${options.correo}`);
    }

    docente.hashContrasena = await crearHash(options.nuevaContrasena);
    docente.activo = true;
    docente.ultimoAcceso = new Date();
    await docente.save();

    process.stdout.write(
      `${JSON.stringify({
        ok: true,
        mensaje: 'Contrasena actualizada correctamente.',
        correo: options.correo,
        docenteId: String(docente._id)
      })}\n`
    );
  } finally {
    await mongoose.disconnect().catch(() => undefined);
  }
}

main().catch((error) => {
  process.stderr.write(`${JSON.stringify({ ok: false, error: error instanceof Error ? error.message : String(error) })}\n`);
  process.exit(1);
});
