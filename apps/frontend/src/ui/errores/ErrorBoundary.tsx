import type { ReactNode } from 'react';
import React from 'react';

type Props = {
  children: ReactNode;
  titulo?: string;
};

type State = {
  error: Error | null;
  info: React.ErrorInfo | null;
};

export class ErrorBoundary extends React.Component<Props, State> {
  state: State = {
    error: null,
    info: null
  };

  static getDerivedStateFromError(error: Error): Partial<State> {
    return { error };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    this.setState({ info });
    // Mantenerlo simple: consola en dev/prod para poder depurar.
    // Si en el futuro existe un servicio de logs, se integra aqui.
    // eslint-disable-next-line no-console
    console.error('[UI] Error no capturado', error, info);
  }

  private recargar = () => {
    if (typeof window !== 'undefined') window.location.reload();
  };

  render() {
    const { error, info } = this.state;

    if (!error) return this.props.children;

    const titulo = this.props.titulo || 'Ocurrio un error inesperado';
    const mostrarDetalle = Boolean(import.meta.env.DEV);

    return (
      <main className="page">
        <section className="card anim-entrada" role="alert" aria-live="assertive">
          <p className="eyebrow">Error</p>
          <h1>{titulo}</h1>
          <p>
            La pantalla se detuvo por un fallo de la aplicacion. Puedes recargar para intentar de nuevo.
          </p>

          <div className="tabs error-boundary__acciones">
            <button className="tab activa" type="button" onClick={this.recargar}>
              Recargar
            </button>
          </div>

          {mostrarDetalle && (
            <details className="error-boundary__detalles">
              <summary className="error-boundary__summary">
                Detalles tecnicos (solo dev)
              </summary>
              <pre className="error-boundary__pre">
                {String(error?.stack || error?.message || error)}
                {'\n'}
                {info?.componentStack ? info.componentStack.trim() : ''}
              </pre>
            </details>
          )}
        </section>
      </main>
    );
  }
}
