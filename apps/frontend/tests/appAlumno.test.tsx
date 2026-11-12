/**
 * appAlumno.test
 *
 * Responsabilidad: Modulo interno del sistema.
 * Limites: Mantener contrato y comportamiento observable del modulo.
 */
// Pruebas basicas de la app alumno.
import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { AppAlumno } from '../src/apps/app_alumno/AppAlumno';
import { TemaProvider } from '../src/tema/TemaProvider';

describe('AppAlumno', () => {
  it('muestra formulario de acceso sin token', () => {
    render(
      <TemaProvider>
        <AppAlumno />
      </TemaProvider>
    );

    const formulario = screen.getByRole('form', { name: /Ingresa al portal/i });
    expect(formulario).toBeInTheDocument();
    expect(formulario.querySelector('h2')).toHaveTextContent('Ingresa al portal');
    expect(document.querySelector('.auth-grid--alumno')?.firstElementChild).toBe(formulario);
    expect(screen.getByLabelText(/Código de acceso/)).toBeInTheDocument();
    expect(screen.getByRole('textbox', { name: /Matrícula/ })).toBeInTheDocument();
  });

  it('muestra boton salir con token', () => {
    localStorage.setItem('tokenAlumno', 'token-falso');
    render(
      <TemaProvider>
        <AppAlumno />
      </TemaProvider>
    );

    expect(screen.getByText('Salir')).toBeInTheDocument();
  });

  it('muestra estado sin resultados con token', () => {
    localStorage.setItem('tokenAlumno', 'token-falso');
    render(
      <TemaProvider>
        <AppAlumno />
      </TemaProvider>
    );

    expect(screen.getByText('Sin resultados')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Recargar' })).toBeInTheDocument();
  });
});
