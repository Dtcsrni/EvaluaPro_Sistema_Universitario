import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { RichTextEditor } from '../src/apps/app_docente/features/banco/components/RichTextEditor';

describe('RichTextEditor keyboard toolbar', () => {
  it('uses one tab stop and arrow, Home, End navigation while keeping the LaTeX disclosure named', async () => {
    const user = userEvent.setup();
    render(
      <RichTextEditor
        id="answer-editor"
        value=""
        onChange={vi.fn()}
        placeholder="Escribe la respuesta"
        ariaLabel="Respuesta del reactivo"
      />
    );

    const toolbar = screen.getByRole('toolbar', { name: 'Formato de texto' });
    const bold = screen.getByRole('button', { name: 'Negrita' });
    const italic = screen.getByRole('button', { name: 'Cursiva' });
    const underline = screen.getByRole('button', { name: 'Subrayado' });
    const latexToggle = screen.getByRole('button', { name: 'Insertar fórmula LaTeX' });
    const latexPanel = document.getElementById('answer-editor-latex');
    const editor = screen.getByRole('textbox', { name: 'Respuesta del reactivo' });
    const controls = [bold, italic, underline, screen.getByRole('button', { name: 'Subíndice' }), screen.getByRole('button', { name: 'Superíndice' }), latexToggle];

    expect(toolbar).toHaveAttribute('aria-orientation', 'horizontal');
    expect(controls.map((button) => button.tabIndex)).toEqual([0, -1, -1, -1, -1, -1]);
    expect(latexToggle).toHaveAttribute('aria-expanded', 'false');
    expect(latexToggle).toHaveAttribute('aria-controls', 'answer-editor-latex');
    expect(latexPanel).toHaveAttribute('hidden');

    await user.tab();
    expect(bold).toHaveFocus();
    await user.keyboard('{ArrowRight}');
    expect(italic).toHaveFocus();
    await user.keyboard('{ArrowLeft}');
    expect(bold).toHaveFocus();
    await user.keyboard('{ArrowLeft}');
    expect(latexToggle).toHaveFocus();
    await user.keyboard('{Home}');
    expect(bold).toHaveFocus();
    await user.keyboard('{End}');
    expect(latexToggle).toHaveFocus();
    expect(controls.filter((button) => button.tabIndex === 0)).toHaveLength(1);
    await user.tab();
    expect(editor).toHaveFocus();
    await user.tab({ shift: true });
    expect(latexToggle).toHaveFocus();

    await user.keyboard('{Enter}');
    expect(latexToggle).toHaveAttribute('aria-expanded', 'true');
    expect(screen.getByRole('group', { name: 'Insertar fórmula LaTeX' })).toBe(latexPanel);
    expect(latexPanel).not.toHaveAttribute('hidden');
    expect(latexToggle).toHaveFocus();
  });
});
