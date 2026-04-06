import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { SeccionAlumnos } from '../src/apps/app_docente/SeccionAlumnos';
import { SeccionCalificaciones } from '../src/apps/app_docente/SeccionCalificaciones';
import { SeccionCalificar } from '../src/apps/app_docente/SeccionCalificar';
import { SeccionCuenta } from '../src/apps/app_docente/SeccionCuenta';
import { SeccionEntrega } from '../src/apps/app_docente/SeccionEntregaInterna';
import { SeccionPaqueteSincronizacion } from '../src/apps/app_docente/SeccionPaqueteSincronizacion';
import { SeccionPublicar } from '../src/apps/app_docente/SeccionPublicar';
import { SeccionRegistroEntrega } from '../src/apps/app_docente/SeccionRegistroEntrega';
import { SeccionSincronizacion } from '../src/apps/app_docente/SeccionSincronizacion';
import { SeccionSincronizacionEquipos } from '../src/apps/app_docente/SeccionSincronizacionEquipos';
import type {
  Alumno,
  Docente,
  Periodo,
  PermisosUI,
  Plantilla,
  RespuestaSyncPull,
  RespuestaSyncPush
} from '../src/apps/app_docente/tipos';

vi.mock('@react-oauth/google', () => ({
  GoogleLogin: () => <button type="button">Google Login</button>
}));

const permisos: PermisosUI = {
  periodos: { leer: true, gestionar: true, archivar: true },
  alumnos: { leer: true, gestionar: true },
  banco: { leer: true, gestionar: true, archivar: true },
  plantillas: { leer: true, gestionar: true, archivar: true, previsualizar: true },
  examenes: { leer: true, generar: true, archivar: true, regenerar: true, descargar: true },
  entregas: { gestionar: true },
  omr: { analizar: true },
  calificaciones: { calificar: true },
  publicar: { publicar: true },
  sincronizacion: { listar: true, exportar: true, importar: true, push: true, pull: true },
  cuenta: { leer: true, actualizar: true }
};

const periodo = { _id: 'per-1', nombre: 'Periodo 1', grupos: ['A'] } as unknown as Periodo;
const alumno = {
  _id: 'alu-1',
  nombreCompleto: 'Alumno Uno',
  matricula: 'A001',
  grupo: 'A',
  periodoId: 'per-1'
} as unknown as Alumno;
const plantilla = {
  _id: 'pla-1',
  titulo: 'Parcial 1',
  tipo: 'parcial',
  periodoId: 'per-1',
  temas: ['Tema']
} as unknown as Plantilla;
const enviarConPermiso = vi.fn(async () => ({}));
const avisarSinPermiso = vi.fn();

describe('cobertura dominios docente', () => {
  it('renderiza SeccionAlumnos', () => {
    render(
      <SeccionAlumnos
        alumnos={[alumno]}
        periodosActivos={[periodo]}
        periodosTodos={[periodo]}
        onRefrescar={() => {}}
        permisos={permisos}
        puedeEliminarAlumnoDev={false}
        enviarConPermiso={enviarConPermiso}
        avisarSinPermiso={avisarSinPermiso}
      />
    );
    expect(screen.getByRole('heading', { level: 2, name: /Alumnos/i })).toBeInTheDocument();
  });

  it('renderiza SeccionCuenta', () => {
    render(
      <SeccionCuenta
        docente={
          {
            id: 'doc-1',
            nombreCompleto: 'Docente Uno',
            correo: 'doc@local.test',
            permisos: [],
            roles: ['docente']
          } as unknown as Docente
        }
        onDocenteActualizado={() => {}}
        esAdmin={false}
        esDev={false}
      />
    );
    expect(screen.getByRole('heading', { name: /Cuenta/i })).toBeInTheDocument();
  });

  it('renderiza SeccionRegistroEntrega', () => {
    render(
      <SeccionRegistroEntrega
        alumnos={[alumno]}
        onVincular={async () => ({})}
        puedeGestionar
        avisarSinPermiso={() => {}}
        examenesPorFolio={new Map()}
      />
    );
    expect(screen.getByRole('heading', { name: /Registro de entrega/i })).toBeInTheDocument();
  });

  it('renderiza SeccionEntrega', () => {
    render(
      <SeccionEntrega
        alumnos={[alumno]}
        plantillas={[plantilla]}
        periodos={[periodo]}
        onVincular={async () => ({})}
        permisos={permisos}
        avisarSinPermiso={() => {}}
        enviarConPermiso={enviarConPermiso}
      />
    );
    expect(screen.getByRole('heading', { name: /Entrega de examenes/i })).toBeInTheDocument();
  });

  it('renderiza SeccionCalificar', () => {
    render(
      <SeccionCalificar
        examenId={null}
        alumnoId={null}
        resultadoOmr={null}
        revisionOmrConfirmada={false}
        respuestasDetectadas={[]}
        claveCorrectaPorNumero={{}}
        ordenPreguntasClave={[]}
        onCalificar={async () => ({})}
        puedeCalificar
        avisarSinPermiso={() => {}}
      />
    );
    expect(screen.getByRole('heading', { name: /Calificar examen/i })).toBeInTheDocument();
  });

  it('asigna 5.00 con todos los aciertos y deshabilita bonus', () => {
    render(
      <SeccionCalificar
        examenId="ex-1"
        alumnoId="alu-1"
        resultadoOmr={null}
        revisionOmrConfirmada
        respuestasDetectadas={[
          { numeroPregunta: 1, opcion: 'A', confianza: 0.9 },
          { numeroPregunta: 2, opcion: 'B', confianza: 0.9 }
        ]}
        claveCorrectaPorNumero={{ 1: 'A', 2: 'B' }}
        ordenPreguntasClave={[1, 2]}
        onCalificar={async () => ({})}
        puedeCalificar
        avisarSinPermiso={() => {}}
      />
    );

    expect(screen.getByText(/Calificación final: 5\.00 \/ 5\.00/i)).toBeInTheDocument();
    expect(screen.getByRole('checkbox')).toBeDisabled();
    expect(screen.getByText(/Bonus deshabilitado: la calificación del examen ya es 5\.00\./i)).toBeInTheDocument();
  });

  it('renderiza SeccionCalificaciones', () => {
    render(
      <SeccionCalificaciones
        alumnos={[alumno]}
        onAnalizar={async () => ({})}
        onPrevisualizar={async () => ({ preview: { aciertos: 0, totalReactivos: 0 } as unknown as Record<string, unknown> })}
        resultado={null}
        onActualizar={() => {}}
        onActualizarPregunta={() => {}}
        revisionOmrConfirmada={false}
        onConfirmarRevisionOmr={() => {}}
        revisionesOmr={[]}
        examenIdActivo={null}
        paginaActiva={null}
        onSeleccionarRevision={() => {}}
        claveCorrectaPorNumero={{}}
        ordenPreguntasClave={[]}
        examenId={null}
        alumnoId={null}
        resultadoParaCalificar={null}
        respuestasParaCalificar={[]}
        onCalificar={async () => ({})}
        permisos={permisos}
        avisarSinPermiso={() => {}}
      />
    );
    expect(screen.getByRole('heading', { name: /Calificaciones/i })).toBeInTheDocument();
  });

  it('renderiza SeccionPublicar', () => {
    render(
      <SeccionPublicar periodos={[periodo]} onPublicar={async () => ({})} onCodigo={async () => ({ codigo: 'ABC123' })} />
    );
    expect(screen.getByRole('heading', { name: /Publicar en portal/i })).toBeInTheDocument();
  });

  it('renderiza SeccionPaqueteSincronizacion', () => {
    render(
      <SeccionPaqueteSincronizacion
        periodos={[periodo]}
        docenteCorreo="doc@local.test"
        onExportar={async () => ({
          paqueteBase64: 'YWJj',
          checksumSha256: 'hash',
          exportadoEn: new Date().toISOString(),
          conteos: {}
        })}
        onImportar={async () => ({ mensaje: 'ok' })}
      />
    );
    expect(screen.getByRole('heading', { name: /Backups y exportaciones/i })).toBeInTheDocument();
  });

  it('renderiza SeccionSincronizacionEquipos', () => {
    render(
      <SeccionSincronizacionEquipos
        onPushServidor={async () => ({ mensaje: 'ok' } as unknown as RespuestaSyncPush)}
        onPullServidor={async () => ({ mensaje: 'ok' } as unknown as RespuestaSyncPull)}
      />
    );
    expect(screen.getByRole('heading', { name: /Sincronizacion entre equipos/i })).toBeInTheDocument();
  });

  it('renderiza SeccionSincronizacion', () => {
    render(
      <SeccionSincronizacion
        periodos={[periodo]}
        periodosArchivados={[]}
        alumnos={[alumno]}
        plantillas={[plantilla]}
        preguntas={[]}
        ultimaActualizacionDatos={Date.now()}
        docenteCorreo="doc@local.test"
        onPublicar={async () => ({})}
        onCodigo={async () => ({ codigo: 'XYZ999', expiraEn: new Date().toISOString() })}
        onExportarPaquete={async () => ({
          paqueteBase64: 'YWJj',
          checksumSha256: 'hash',
          exportadoEn: new Date().toISOString(),
          conteos: {}
        })}
        onImportarPaquete={async () => ({ mensaje: 'ok' })}
        onPushServidor={async () => ({ mensaje: 'ok' } as unknown as RespuestaSyncPush)}
        onPullServidor={async () => ({ mensaje: 'ok' } as unknown as RespuestaSyncPull)}
      />
    );
    expect(screen.getByRole('heading', { name: /Sincronizaci.n.*estado de datos/i })).toBeInTheDocument();
  });
});
