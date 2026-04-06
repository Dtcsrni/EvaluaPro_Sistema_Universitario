import mongoose from 'mongoose';
import { conectarBaseDatos } from '../src/infraestructura/baseDatos/mongoose';
import { listarBundlesRecuperables } from '../src/modulos/modulo_recuperacion_examenes/servicioRecuperacionExamenes';

type Args = {
  actorDocenteId: string;
  actorRoles: string[];
};

function parseArgs(argv: string[]): Args {
  const args: Args = {
    actorDocenteId: '',
    actorRoles: ['admin']
  };
  for (let i = 2; i < argv.length; i += 1) {
    const key = argv[i];
    const value = argv[i + 1];
    if ((key === '--actor-docente-id' || key === '--docente-id') && value) {
      args.actorDocenteId = value;
      i += 1;
      continue;
    }
    if ((key === '--roles' || key === '--actor-roles') && value) {
      args.actorRoles = value
        .split(',')
        .map((role) => role.trim())
        .filter(Boolean);
      i += 1;
    }
  }
  if (!args.actorDocenteId) {
    throw new Error('Falta --actor-docente-id');
  }
  return args;
}

async function main() {
  const args = parseArgs(process.argv);
  await conectarBaseDatos();
  try {
    const bundles = await listarBundlesRecuperables({
      actorDocenteId: args.actorDocenteId,
      actorRoles: args.actorRoles
    });
    console.log(JSON.stringify({ bundles }, null, 2));
  } finally {
    await mongoose.disconnect();
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
