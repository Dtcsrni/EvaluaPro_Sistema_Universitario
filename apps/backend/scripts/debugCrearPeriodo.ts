import mongoose from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';
import request from 'supertest';
import { crearApp } from '../src/app';

async function main() {
  process.env.NODE_ENV = 'test';

  const servidor = await MongoMemoryServer.create();
  await mongoose.connect(servidor.getUri());

  const app = crearApp();

  const reg = await request(app)
    .post('/api/autenticacion/registrar')
    .send({ nombreCompleto: 'Docente', correo: 'debug@local.test', contrasena: 'Secreto123!' });

  console.log('registrar', reg.status, reg.body);

  const token = reg.body.token;
  const per = await request(app)
    .post('/api/periodos')
    .set({ Authorization: `Bearer ${token}` })
    .send({ nombre: 'Periodo A', fechaInicio: '2025-01-01', fechaFin: '2025-06-01' });

  console.log('crear periodo', per.status, JSON.stringify(per.body, null, 2));

  await mongoose.disconnect();
  await servidor.stop();
}

main().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
