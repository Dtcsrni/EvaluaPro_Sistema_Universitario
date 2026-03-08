import { useCallback, useMemo, useState } from 'react';
import { emitToast } from '../../ui/toast/toastBus';
import { Boton } from '../../ui/ux/componentes/Boton';
import { InlineMensaje } from '../../ui/ux/componentes/InlineMensaje';
import { Icono } from '../../ui/iconos';
import { registrarAccionDocente } from './telemetriaDocente';
import type { Docente } from './tipos';

const DEFAULT_OMR_HUMAN_REVIEW_URL = 'http://127.0.0.1:4310';

export function SeccionRehidratacionLotes({
  docente,
  esAdmin,
  puedeUsar
}: {
  docente: Docente | null;
  esAdmin: boolean;
  puedeUsar: boolean;
}) {
  const [mostrarModuloEmbebido, setMostrarModuloEmbebido] = useState(false);
  const urlRevisionHumana = useMemo(() => {
    const valor = String(import.meta.env.VITE_OMR_HUMAN_REVIEW_URL || DEFAULT_OMR_HUMAN_REVIEW_URL).trim();
    return valor.replace(/\/+$/, '');
  }, []);
  const tipoAcceso = esAdmin ? 'Administrador' : 'Docente con plan de recuperacion habilitado';

  const abrirHerramienta = useCallback(() => {
    if (!urlRevisionHumana) {
      emitToast({
        level: 'warn',
        title: 'Rehidratacion del lote',
        message: 'No se encontro una URL configurada para la herramienta de recuperacion.',
        durationMs: 3600
      });
      return;
    }
    const nuevaVentana = window.open(urlRevisionHumana, '_blank', 'noopener,noreferrer');
    if (!nuevaVentana) {
      emitToast({
        level: 'warn',
        title: 'Rehidratacion del lote',
        message: 'El navegador bloqueo la nueva pestana. Permite popups e intenta de nuevo.',
        durationMs: 4200
      });
      return;
    }
    registrarAccionDocente('rehidratacion_lote_open', true);
  }, [urlRevisionHumana]);

  if (!puedeUsar) {
    return (
      <section className="panel">
        <InlineMensaje tipo="error">
          Esta capacidad de rehidratacion solo esta disponible para administradores o docentes con recuperacion de lotes habilitada.
        </InlineMensaje>
      </section>
    );
  }

  return (
    <>
      <section className="panel calificaciones-hero">
        <div className="calificaciones-hero__head">
          <h2>
            <Icono nombre="pdf" /> Rehidratacion canonica del lote
          </h2>
          <p className="nota">
            Recupera banco de reactivos, respuestas correctas, permutaciones y examenes sinteticos a partir de lotes de fotos
            generados por versiones recientes y compatibles del sistema.
          </p>
        </div>
        <div className="calificaciones-kpi" aria-live="polite">
          <div className="calificaciones-kpi__item"><span>Tipo de acceso</span><b>{tipoAcceso}</b></div>
          <div className="calificaciones-kpi__item"><span>Uso esperado</span><b>Recuperacion forense</b></div>
          <div className="calificaciones-kpi__item"><span>Entrada principal</span><b>Lotes de fotografias</b></div>
          <div className="calificaciones-kpi__item"><span>Salida objetivo</span><b>Banco y examenes rehidratados</b></div>
        </div>
        <div className="item-meta calificaciones-hero__meta">
          <span className="badge warning">No es un flujo de calificacion diaria</span>
          <span className="badge ok">Usuario actual: {docente?.correo ?? 'sin sesion'}</span>
        </div>
      </section>

      <section className="panel calificaciones-human-review-panel">
        <div className="calificaciones-human-review-panel__head">
          <div className="calificaciones-human-review-panel__title">
            <h3>
              <Icono nombre="escaneo" /> Herramienta de reconstruccion visual por lote
            </h3>
            <p className="nota">
              Esta herramienta existe para rehidratar correctamente un lote cuando se perdieron los datos originales de generacion.
              Permite validar pagina por pagina el contenido real del examen fotografiado y usar esa evidencia para reconstruir la base canonica.
            </p>
          </div>
          <span className={mostrarModuloEmbebido ? 'badge ok' : 'badge warning'}>
            {mostrarModuloEmbebido ? 'Modulo embebido activo' : 'Modulo disponible'}
          </span>
        </div>

        <div className="calificaciones-human-review-panel__summary">
          <div className="calificaciones-human-review-panel__summary-card">
            <span>Reconstruye</span>
            <strong>Preguntas, opciones, respuesta correcta y variantes reales del lote perdido</strong>
          </div>
          <div className="calificaciones-human-review-panel__summary-card">
            <span>Compara contra</span>
            <strong>Fotos del examen, evidencia por pagina y, cuando exista, PDF fuente compatible</strong>
          </div>
          <div className="calificaciones-human-review-panel__summary-card">
            <span>Produce</span>
            <strong>Base canonica confiable para generar examenes sinteticos y medir el reconocimiento visual</strong>
          </div>
        </div>

        <div className="item-meta calificaciones-human-review-panel__meta">
          <span>URL configurada: <code>{urlRevisionHumana}</code></span>
          <span>Compatibilidad esperada: lotes generados por versiones recientes del sistema con formato aun reconocible.</span>
        </div>

        <div className="item-actions calificaciones-human-review-panel__actions">
          <Boton
            type="button"
            onClick={() => {
              setMostrarModuloEmbebido((valorActual) => {
                const siguiente = !valorActual;
                registrarAccionDocente(siguiente ? 'rehidratacion_lote_embed_open' : 'rehidratacion_lote_embed_close', true);
                return siguiente;
              });
            }}
          >
            <Icono nombre="calificar" />
            {mostrarModuloEmbebido ? 'Ocultar modulo embebido' : 'Mostrar modulo embebido'}
          </Boton>
          <Boton type="button" variante="secundario" onClick={abrirHerramienta}>
            <Icono nombre="entrar" />
            Abrir herramienta en pestana nueva
          </Boton>
        </div>

        {mostrarModuloEmbebido ? (
          <div className="calificaciones-human-review-panel__frame-wrap">
            <iframe
              className="calificaciones-human-review-panel__frame"
              title="Rehidratacion canonica del lote"
              src={urlRevisionHumana}
              loading="lazy"
              referrerPolicy="no-referrer"
            />
          </div>
        ) : null}

        <InlineMensaje tipo="info">
          Si la herramienta no abre o no carga dentro del portal, inicia el servidor local con{' '}
          <code>npm -C apps/backend run omr:tv3:review:ui</code>.
        </InlineMensaje>
      </section>
    </>
  );
}
