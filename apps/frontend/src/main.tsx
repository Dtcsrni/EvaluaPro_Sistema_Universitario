/**
 * Punto de entrada React que monta la app en #root.
 */
import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import './styles.css';
import './pwa';
import { ConfirmDialogProvider } from './ui/feedback/ConfirmDialogProvider';
import { ToastProvider } from './ui/toast/ToastProvider';
import { ErrorBoundary } from './ui/errores/ErrorBoundary';

ReactDOM.createRoot(document.getElementById('root') as HTMLElement).render(
  <React.StrictMode>
    <ErrorBoundary>
      <ToastProvider>
        <ConfirmDialogProvider>
          <App />
        </ConfirmDialogProvider>
      </ToastProvider>
    </ErrorBoundary>
  </React.StrictMode>
);
