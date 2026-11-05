import { render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { TooltipLayer } from '../src/ui/ux/tooltip/TooltipLayer';

const innerHeightOriginal = window.innerHeight;

afterEach(() => {
  Object.defineProperty(window, 'innerHeight', { configurable: true, value: innerHeightOriginal });
});

describe('TooltipLayer', () => {
  it('actualiza el texto cuando cambia la etiqueta accesible del control enfocado', async () => {
    render(
      <>
        <button type="button" aria-label="Editar Ana María Gómez Ruiz">Editar</button>
        <TooltipLayer />
      </>
    );

    const boton = screen.getByRole('button', { name: 'Editar Ana María Gómez Ruiz' });
    boton.focus();
    const tooltip = await screen.findByRole('tooltip');
    expect(tooltip).toHaveTextContent('Editar Ana María Gómez Ruiz');

    boton.setAttribute('aria-label', 'Editar Ana Elena Gómez Ruiz');

    await waitFor(() => expect(tooltip).toHaveTextContent('Editar Ana Elena Gómez Ruiz'));
    expect(boton).toHaveFocus();
  });

  it('coloca debajo del control enfocado cuando está en la mitad inferior y hay espacio', async () => {
    Object.defineProperty(window, 'innerHeight', { configurable: true, value: 600 });
    render(
      <>
        <button type="button" aria-label="Editar Ana Elena Gómez Ruiz">Editar</button>
        <TooltipLayer />
      </>
    );

    const boton = screen.getByRole('button', { name: 'Editar Ana Elena Gómez Ruiz' });
    boton.getBoundingClientRect = () => ({
      x: 100, y: 408, width: 100, height: 32, top: 408, right: 200, bottom: 440, left: 100,
      toJSON: () => ({})
    });
    boton.focus();

    expect(await screen.findByRole('tooltip')).toHaveClass('tooltip-bottom');
  });

  it('mantiene el tooltip arriba si el espacio inferior no alcanza', async () => {
    Object.defineProperty(window, 'innerHeight', { configurable: true, value: 600 });
    render(
      <>
        <button type="button" aria-label="Editar Ana Elena Gómez Ruiz">Editar</button>
        <TooltipLayer />
      </>
    );

    const boton = screen.getByRole('button', { name: 'Editar Ana Elena Gómez Ruiz' });
    boton.getBoundingClientRect = () => ({
      x: 100, y: 550, width: 100, height: 32, top: 550, right: 200, bottom: 582, left: 100,
      toJSON: () => ({})
    });
    boton.focus();

    expect(await screen.findByRole('tooltip')).toHaveClass('tooltip-top');
  });
});
