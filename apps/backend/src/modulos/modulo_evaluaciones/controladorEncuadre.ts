/**
 * controladorEncuadre
 *
 * Responsabilidad: Controlador HTTP para el flujo de inicialización, consulta y firma de Encuadre Académico.
 * Limites: Delegar la lógica compleja de PDFs a servicioEncuadrePdf y base de datos a Prisma.
 */
import type { Response, Request } from 'express';
import type { SolicitudDocente } from '../modulo_autenticacion/middlewareAutenticacion';
import { obtenerDocenteId } from '../modulo_autenticacion/middlewareAutenticacion';
import { prisma } from '../../infraestructura/baseDatos/sqlite';
import { ErrorAplicacion } from '../../compartido/errores/errorAplicacion';
import {
  generarPdfEncuadreBase,
  registrarFirmaPdf,
  calcularHashFirma
} from './servicioEncuadrePdf';
import { enviarCorreo } from '../../infraestructura/correo/servicioCorreo';
import { configuracion } from '../../configuracion';
import fs from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';

/**
 * Inicializa el encuadre para un periodo.
 */
export async function inicializarEncuadre(req: SolicitudDocente, res: Response) {
  try {
    const docenteId = obtenerDocenteId(req);
    const {
      periodoId,
      carrera,
      clave = 'ISCF213',
      area = '',
      horasDocente = 50,
      horasIndependientes = 100,
      horasTotales,
      creditos = 6.25,
      objetivoGeneral = '(Sin especificar)',
      cicloLectivo = 'Del 18 de mayo al 26 de junio de 2026',
      // Datos institucionales parametrizables
      institucionNombre,
      institucionLema,
      logoBase64,
      logoCarreraBase64,
      // Ponderaciones configurables
      porcentajeExamenes,
      porcentajeEvalContinua,
      ponderacion1erParcial,
      ponderacion2doParcial,
      ponderacionGlobal,
      ponderacionExamenEscrito,
      ponderacionPractica,
      ejeFormacion
    } = req.body;

    if (!periodoId) {
      throw new ErrorAplicacion('DATOS_INVALIDOS', 'periodoId es requerido', 400);
    }

    const periodo = await prisma.periodo.findUnique({
      where: { id: periodoId },
      include: {
        docente: true,
        alumnos: {
          where: { activo: true },
          orderBy: { nombreCompleto: 'asc' }
        }
      }
    });

    if (!periodo) {
      throw new ErrorAplicacion('NO_ENCONTRADO', 'Periodo no encontrado', 404);
    }

    if (periodo.docenteId !== docenteId) {
      throw new ErrorAplicacion('ACCESO_DENEGADO', 'No tienes permisos para este periodo', 403);
    }

    // Limpiar encuadre anterior si existe
    await prisma.encuadreAcademico.deleteMany({
      where: { periodoId }
    });

    // Mapear alumnos para el PDF
    const alumnosPdf = periodo.alumnos.map(al => ({
      id: al.id,
      nombreCompleto: al.nombreCompleto,
      matricula: al.matricula,
      correo: al.correo
    }));

    // Convertir logos base64 a Buffer si existen
    let logoPngBuffer: Buffer | undefined;
    let logoCarreraBuffer: Buffer | undefined;

    if (typeof logoBase64 === 'string' && logoBase64.trim().length > 0) {
      const base64Data = logoBase64.replace(/^data:image\/[a-z]+;base64,/, '');
      logoPngBuffer = Buffer.from(base64Data, 'base64');
    }

    if (typeof logoCarreraBase64 === 'string' && logoCarreraBase64.trim().length > 0) {
      const base64Data = logoCarreraBase64.replace(/^data:image\/[a-z]+;base64,/, '');
      logoCarreraBuffer = Buffer.from(base64Data, 'base64');
    }

    // Generar PDF base
    const pdfBuffer = await generarPdfEncuadreBase({
      asignatura: periodo.nombre,
      docenteNombre: periodo.docente.nombreCompleto,
      carrera: carrera || 'Licenciatura en Ingenieria en Sistemas Computacionales',
      cicloLectivo,
      clave,
      area,
      horasDocente,
      horasIndependientes,
      horasTotales: horasTotales ?? (horasDocente + horasIndependientes),
      creditos,
      objetivoGeneral,
      ejeFormacion,
      // Datos institucionales (si no se envían, el servicio usa defaults de CUH)
      institucionNombre,
      institucionLema,
      logoPngBuffer,
      logoCarreraBuffer,
      // Ponderaciones (si no se envían, el servicio usa defaults estándar)
      porcentajeExamenes,
      porcentajeEvalContinua,
      ponderacion1erParcial,
      ponderacion2doParcial,
      ponderacionGlobal,
      ponderacionExamenEscrito,
      ponderacionPractica,
      alumnos: alumnosPdf
    });

    // Guardar archivo PDF en disco local
    const encuadresDir = path.resolve('apps/backend/data/encuadres');
    await fs.mkdir(encuadresDir, { recursive: true });

    // Prevenir path traversal en periodoId
    const safePeriodoId = String(periodoId).replace(/[^a-zA-Z0-9-]/g, '');
    if (safePeriodoId !== periodoId) {
      throw new ErrorAplicacion('DATOS_INVALIDOS', 'periodoId no válido', 400);
    }

    const pdfFullPath = path.resolve(encuadresDir, `${safePeriodoId}_encuadre_base.pdf`);
    if (!pdfFullPath.startsWith(encuadresDir)) {
      throw new ErrorAplicacion('ACCESO_DENEGADO', 'Ruta de archivo no permitida', 400);
    }

    const pdfRelativePath = `data/encuadres/${safePeriodoId}_encuadre_base.pdf`;
    await fs.writeFile(pdfFullPath, pdfBuffer);

    // Crear registro base del encuadre
    const ponderaciones = {
      examenes: 0.5,
      evaluacionContinua: 0.5,
      examenPrimerParcial: 0.2,
      examenSegundoParcial: 0.2,
      examenGlobal: 0.6,
      continuaExamenEscrito: 0.6,
      continuaPracticaProyecto: 0.4
    };

    const encuadre = await prisma.encuadreAcademico.create({
      data: {
        periodoId,
        docenteId,
        carrera: carrera || 'Licenciatura en Ingeniería en Sistemas Computacionales',
        asignatura: periodo.nombre,
        cicloLectivo,
        horasDocente,
        creditos,
        ponderaciones: JSON.stringify(ponderaciones),
        rutaPdf: pdfRelativePath,
        estado: 'pendiente_firmas'
      }
    });

    // Generar firma para el Docente
    const tokenDocente = crypto.randomUUID();
    await prisma.firmaEncuadre.create({
      data: {
        encuadreId: encuadre.id,
        rol: 'docente',
        usuarioId: docenteId,
        nombreFirmante: periodo.docente.nombreCompleto,
        correo: periodo.docente.correo,
        tokenFirma: tokenDocente,
        firmado: false
      }
    });

    // Generar firmas para los Alumnos
    const firmasAlumnos = await Promise.all(
      periodo.alumnos.map(alumno => {
        const tokenAlumno = crypto.randomUUID();
        return prisma.firmaEncuadre.create({
          data: {
            encuadreId: encuadre.id,
            rol: 'alumno',
            usuarioId: alumno.id,
            nombreFirmante: alumno.nombreCompleto,
            correo: alumno.correo,
            tokenFirma: tokenAlumno,
            firmado: false
          }
        });
      })
    );

    // Enviar correos de notificación con los enlaces de firma
    const appUrl = configuracion.passwordResetUrlBase || 'http://localhost:4519';

    // Correo al Docente
    const linkDocente = `${appUrl}/#/firmar-encuadre/${tokenDocente}`;
    const contenidoDocente = `Hola ${periodo.docente.nombreCompleto},\n\nSe ha generado el documento de encuadre académico para la asignatura "${periodo.nombre}" (${cicloLectivo}).\n\nPor favor, ingresa al siguiente enlace para revisarlo y firmarlo de conformidad:\n${linkDocente}\n\nSaludos,\nSistema EvaluaPro`;
    await enviarCorreo(periodo.docente.correo, `Firma de Encuadre Académico - ${periodo.nombre}`, contenidoDocente);

    // Correos a los Alumnos
    for (const firmaAlumno of firmasAlumnos) {
      const linkAlumno = `${appUrl}/#/firmar-encuadre/${firmaAlumno.tokenFirma}`;
      const contenidoAlumno = `Hola ${firmaAlumno.nombreFirmante},\n\nSe ha publicado el encuadre académico de la asignatura "${periodo.nombre}" (${cicloLectivo}) impartida por el profesor ${periodo.docente.nombreCompleto}.\n\nEs necesario que revises las ponderaciones y políticas descritas y firmes digitalmente de conformidad ingresando al siguiente enlace con tu correo institucional:\n${linkAlumno}\n\nAtentamente,\nCentro Universitario Hidalguense`;
      await enviarCorreo(firmaAlumno.correo, `Firma de Encuadre de Asignatura: ${periodo.nombre}`, contenidoAlumno);
    }

    res.json({
      success: true,
      encuadreId: encuadre.id,
      docenteToken: tokenDocente
    });
  } catch (error) {
    res.status(500).json({ error: error instanceof Error ? error.message : 'Error interno' });
  }
}

/**
 * Obtiene el estado de firmas de un encuadre para un periodo específico.
 */
export async function obtenerEstadoEncuadre(req: SolicitudDocente, res: Response) {
  try {
    const docenteId = obtenerDocenteId(req);
    const { periodoId } = req.params;

    if (!periodoId) {
      throw new ErrorAplicacion('DATOS_INVALIDOS', 'periodoId es requerido', 400);
    }

    const encuadre = await prisma.encuadreAcademico.findUnique({
      where: { periodoId: periodoId as string },
      include: {
        firmas: {
          orderBy: [
            { rol: 'desc' }, // docente primero
            { nombreFirmante: 'asc' }
          ]
        }
      }
    });

    if (!encuadre) {
      return res.status(404).json({ error: 'No se ha inicializado el encuadre para este periodo' });
    }

    if (encuadre.docenteId !== docenteId) {
      return res.status(403).json({ error: 'No tienes permisos sobre este periodo' });
    }

    res.json(encuadre);
  } catch (error) {
    res.status(500).json({ error: error instanceof Error ? error.message : 'Error interno' });
  }
}

/**
 * Endpoint público para obtener la información de firma por token.
 */
export async function obtenerDetallesFirmaEncuadrePublico(req: Request, res: Response) {
  try {
    const { token } = req.params;
    if (!token) {
      return res.status(400).json({ error: 'Token es requerido' });
    }

    const firma = await prisma.firmaEncuadre.findUnique({
      where: { tokenFirma: token as string },
      include: { encuadre: true }
    }) as any;

    if (!firma) {
      return res.status(404).json({ error: 'Token de firma inválido o no encontrado' });
    }

    res.json({
      firma: {
        id: firma.id,
        rol: firma.rol,
        nombreFirmante: firma.nombreFirmante,
        correo: firma.correo,
        firmado: firma.firmado,
        firmadoEn: firma.firmadoEn
      },
      encuadre: {
        id: firma.encuadre.id,
        asignatura: firma.encuadre.asignatura,
        carrera: firma.encuadre.carrera,
        cicloLectivo: firma.encuadre.cicloLectivo,
        horasDocente: firma.encuadre.horasDocente,
        creditos: firma.encuadre.creditos,
        estado: firma.encuadre.estado
      }
    });
  } catch (error) {
    res.status(500).json({ error: error instanceof Error ? error.message : 'Error interno' });
  }
}

/**
 * Endpoint público para descargar el PDF actual del encuadre.
 */
export async function descargarPdfEncuadrePublico(req: Request, res: Response) {
  try {
    const { token } = req.params;
    if (!token) {
      return res.status(400).json({ error: 'Token es requerido' });
    }

    const firma = await prisma.firmaEncuadre.findUnique({
      where: { tokenFirma: token as string },
      include: { encuadre: true }
    }) as any;

    if (!firma || !firma.encuadre.rutaPdf) {
      return res.status(404).json({ error: 'Archivo no encontrado o inválido' });
    }

    const encuadresDir = path.resolve('apps/backend/data/encuadres');
    const pdfFullPath = path.resolve('apps/backend', firma.encuadre.rutaPdf);
    if (!pdfFullPath.startsWith(encuadresDir)) {
      return res.status(400).json({ error: 'Acceso denegado a la ruta del archivo' });
    }
    try {
      await fs.access(pdfFullPath);
    } catch {
      return res.status(404).json({ error: 'El archivo físico del PDF no existe' });
    }

    res.setHeader('Content-Type', 'application/pdf');
    res.sendFile(pdfFullPath);
  } catch (error) {
    res.status(500).json({ error: error instanceof Error ? error.message : 'Error interno' });
  }
}

/**
 * Endpoint público para firmar digitalmente el encuadre.
 */
export async function firmarEncuadrePublico(req: Request, res: Response) {
  try {
    const { token } = req.params;
    if (!token) {
      return res.status(400).json({ error: 'Token es requerido' });
    }

    const firma = await prisma.firmaEncuadre.findUnique({
      where: { tokenFirma: token as string },
      include: { encuadre: true }
    }) as any;

    if (!firma) {
      return res.status(404).json({ error: 'Firma no encontrada' });
    }

    if (firma.firmado) {
      return res.status(400).json({ error: 'Este encuadre ya ha sido firmado por usted' });
    }

    const ip = String(req.headers['x-forwarded-for'] || req.socket.remoteAddress || '127.0.0.1').split(',')[0].trim();
    const fecha = new Date();
    const hash = calcularHashFirma(configuracion.jwtSecreto || 'test_secret', {
      usuarioId: firma.usuarioId,
      correo: firma.correo,
      fecha: fecha.toISOString(),
      direccionIp: ip
    });

    // Determinar el índice del alumno en el PDF
    let alumnoIndex = 0;
    if (firma.rol === 'alumno') {
      const alumnosPeriodo = await prisma.firmaEncuadre.findMany({
        where: { encuadreId: firma.encuadreId, rol: 'alumno' },
        orderBy: { nombreFirmante: 'asc' }
      });
      alumnoIndex = alumnosPeriodo.findIndex(f => f.usuarioId === firma.usuarioId);
      if (alumnoIndex === -1) {
        alumnoIndex = 0;
      }
    }

    // Cargar y estampar el PDF
    const encuadresDir = path.resolve('apps/backend/data/encuadres');
    const pdfFullPath = path.resolve('apps/backend', firma.encuadre.rutaPdf || '');
    if (!pdfFullPath.startsWith(encuadresDir)) {
      return res.status(400).json({ error: 'Acceso denegado a la ruta del archivo' });
    }
    let pdfBuffer: Buffer;
    try {
      pdfBuffer = await fs.readFile(pdfFullPath);
    } catch {
      return res.status(404).json({ error: 'No se encontró el archivo base del encuadre' });
    }

    const pdfFirmadoBuffer = await registrarFirmaPdf(pdfBuffer, {
      rol: firma.rol as 'docente' | 'alumno',
      usuarioId: firma.usuarioId,
      nombreFirmante: firma.nombreFirmante,
      correo: firma.correo,
      ip,
      hash,
      fecha,
      alumnoIndex
    });

    // Guardar el PDF actualizado
    await fs.writeFile(pdfFullPath, pdfFirmadoBuffer);

    // Guardar la firma en la base de datos
    await prisma.firmaEncuadre.update({
      where: { id: firma.id },
      data: {
        firmado: true,
        firmadoEn: fecha,
        direccionIp: ip,
        hashIntegridad: hash
      }
    });

    // Verificar si se completaron todas las firmas
    const firmasPendientes = await prisma.firmaEncuadre.count({
      where: { encuadreId: firma.encuadreId, firmado: false }
    });

    if (firmasPendientes === 0) {
      await prisma.encuadreAcademico.update({
        where: { id: firma.encuadreId },
        data: { estado: 'completado' }
      });
    }

    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: error instanceof Error ? error.message : 'Error interno' });
  }
}
