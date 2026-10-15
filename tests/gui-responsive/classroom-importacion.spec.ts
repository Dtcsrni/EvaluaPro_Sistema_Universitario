import { expect, test } from '@playwright/test';

const periodoId = 'periodo-classroom-e2e';
const courseId = 'curso-classroom-e2e';
const courseWorkId = 'actividad-classroom-e2e';
const submissionId = 'entrega-classroom-e2e';

test('sincroniza Classroom con preview, confirmación, job durable y relectura de evidencia', async ({ page }) => {
  let jobPolls = 0;
  let jobPayload: Record<string, unknown> | null = null;
  let importacionTerminada = false;
  const headers = {
    'access-control-allow-origin': 'http://127.0.0.1:4192',
    'access-control-allow-credentials': 'true',
    'access-control-allow-methods': 'GET,POST,PUT,OPTIONS',
    'access-control-allow-headers': 'Authorization, Content-Type, If-None-Match'
  };
  const json = (body: unknown, status = 200) => ({
    status,
    headers,
    contentType: 'application/json',
    body: JSON.stringify(body)
  });

  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.addInitScript(() => localStorage.setItem('tokenDocente', 'classroom-e2e-token'));
  await page.route('**/api/**', async (route) => {
    const { pathname } = new URL(route.request().url());
    const method = route.request().method();
    if (method === 'OPTIONS') return route.fulfill({ status: 204, headers });

    if (pathname.endsWith('/autenticacion/perfil')) return route.fulfill(json({ docente: {
      id: 'docente-classroom-e2e',
      nombreCompleto: 'Docente E2E',
      correo: 'docente@classroom-e2e.local',
      permisos: ['periodos:leer', 'alumnos:leer', 'classroom:pull', 'evaluaciones:leer', 'calificaciones:calificar'],
      roles: ['docente']
    } }));
    if (pathname.endsWith('/autenticacion/capacidades-integraciones')) return route.fulfill(json({
      capacidadesIntegraciones: { classroomBackend: true, passwordLoginAllowed: true }
    }));
    if (pathname.endsWith('/periodos') || pathname.endsWith('/periodos/')) return route.fulfill(json({ periodos: [
      { _id: periodoId, nombre: 'Materia Classroom E2E', activo: true, grupos: ['A'] }
    ] }));
    if (pathname.endsWith('/alumnos') || pathname.endsWith('/alumnos/')) return route.fulfill(json({ alumnos: [
      { _id: 'alumno-classroom-e2e', periodoId, nombreCompleto: 'Ana E2E', matricula: 'E2E-001' }
    ] }));
    if (pathname.endsWith('/evaluaciones/evidencias')) return route.fulfill(json({ evidencias: importacionTerminada ? [{
      id: 'evidencia-classroom-e2e', alumnoId: 'alumno-classroom-e2e', titulo: 'Actividad Classroom E2E',
      fechaEvidencia: '2026-10-14T12:00:00.000Z', calificacionDecimal: 9, estadoCaptura: 'calificada',
      fuente: 'classroom', classroom: {
        courseId, courseWorkId, submissionId, courseWorkTitle: 'Actividad Classroom E2E',
        assignedGrade: 90, maxPoints: 100, submissionState: 'TURNED_IN'
      }
    }] : [], nextCursor: null }));
    if (pathname.endsWith('/v2/classroom/estado')) return route.fulfill(json({ estado: {
      conectado: true, identidadCoincidente: true, correoLogin: 'docente@classroom-e2e.local',
      correoGoogle: 'docente@classroom-e2e.local'
    } }));
    if (pathname.endsWith('/v2/classroom/cursos')) return route.fulfill(json({ cursos: [
      { id: courseId, name: 'Curso Classroom E2E', courseState: 'ACTIVE' }
    ] }));
    if (pathname.endsWith(`/v2/classroom/cursos/${courseId}/actividades`)) return route.fulfill(json({ actividades: [
      { id: courseWorkId, title: 'Actividad Classroom E2E', state: 'PUBLISHED', maxPoints: 100, mapeo: { corte: 2 } }
    ] }));
    if (pathname.endsWith(`/v2/classroom/cursos/${courseId}/alumnos`)) return route.fulfill(json({ alumnosClassroom: [] }));
    if (pathname.endsWith('/v2/classroom/importaciones/preview') && method === 'POST') return route.fulfill(json({
      planHash: 'a'.repeat(64), totalActividades: 1, graded: 1, pending: 0, unmatched: 0,
      wouldCreate: 1, wouldUpdate: 0, importadas: 0, actualizadas: 0, errores: [],
      actividades: [{ courseId, courseWorkId, courseWorkTitle: 'Actividad Classroom E2E', corte: 2, submissions: [{
        submissionId, alumnoId: 'alumno-classroom-e2e', alumnoNombre: 'Ana E2E', estadoClassroom: 'TURNED_IN'
      }] }]
    }));
    if (pathname.endsWith('/v2/classroom/importaciones/jobs') && method === 'POST') {
      jobPayload = route.request().postDataJSON() as Record<string, unknown>;
      return route.fulfill(json({ jobId: 'job-classroom-e2e', estado: 'queued', progreso: 0, total: 1 }, 202));
    }
    if (pathname.endsWith('/v2/classroom/importaciones/jobs/job-classroom-e2e') && method === 'GET') {
      jobPolls += 1;
      if (jobPolls === 1) return route.fulfill(json({
        jobId: 'job-classroom-e2e', estado: 'running', progreso: 0, total: 1
      }));
      importacionTerminada = true;
      return route.fulfill(json({
        jobId: 'job-classroom-e2e', estado: 'succeeded', progreso: 1, total: 1,
        resultado: {
          totalActividades: 1, importadas: 1, actualizadas: 0, errores: [],
          actividades: [{ courseId, courseWorkId, courseWorkTitle: 'Actividad Classroom E2E', corte: 2,
            destinoColumna: 'Tareas y Ejercicios 2do Parcial', submissions: [{
              submissionId, alumnoId: 'alumno-classroom-e2e', alumnoNombre: 'Ana E2E',
              estadoClassroom: 'TURNED_IN', assignedGrade: 90, maxPoints: 100
            }] }]
        }
      }));
    }
    return route.fulfill(json({}));
  });

  await page.goto('/');
  await page.getByRole('button', { name: 'Classroom', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Google Classroom', exact: true })).toBeVisible();
  await expect(page.getByText('Cuenta conectada')).toBeVisible();
  await expect(page.getByText('docente@classroom-e2e.local').first()).toBeVisible();
  await page.getByRole('button', { name: 'Calificaciones', exact: true }).click();
  await page.getByRole('navigation', { name: 'Espacios de calificaciones' }).getByRole('button', { name: /05 Classroom/ }).click();

  const classroom = page.locator('.calificaciones-workspace-view');
  await expect(classroom.getByRole('heading', { name: 'Calificaciones asignadas y evidencias' })).toBeVisible();
  await classroom.getByRole('combobox', { name: 'Curso de Classroom' }).selectOption(courseId);
  await classroom.getByRole('button', { name: 'Previsualizar evaluación continua' }).click();
  await expect(classroom).toContainText('1 actividades · 1 calificadas');
  await classroom.getByRole('button', { name: 'Confirmar y sincronizar selección' }).click();

  const confirmation = page.getByRole('alertdialog', { name: 'Actualizar evaluación continua' });
  await expect(confirmation).toBeVisible();
  await confirmation.getByRole('button', { name: 'Sincronizar selección' }).click();
  await expect(classroom).toContainText('Sincronización completada. Nuevas: 1; actualizadas: 0. Evidencias releídas.');
  await expect(classroom).toContainText('90 / 100');

  expect(jobPayload).toMatchObject({ periodoId, planHash: 'a'.repeat(64) });
  expect(jobPayload?.clientRequestId).toMatch(/^[0-9a-f-]{36}$/i);
  expect(jobPolls).toBeGreaterThanOrEqual(2);
  expect(await page.evaluate((key) => localStorage.getItem(key), `evaluapro.classroom.importRequest:${periodoId}`)).toBeNull();
});
