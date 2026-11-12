import { readdirSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { render } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { Check, IconoCampo, IconoLucide } from '../src/ui/iconosCatalogo';
import { Icono, NOMBRES_ICONO, normalizarTamanoIcono, Spinner, TAMANOS_ICONO } from '../src/ui/iconos';

describe('iconografía compartida', () => {
  it('aplica el sistema compartido a los SVG de interfaz escritos en línea', () => {
    const archivos: string[] = [];
    const recorrer = (directorio: string) => {
      for (const entrada of readdirSync(directorio, { withFileTypes: true })) {
        const ruta = `${directorio}/${entrada.name}`;
        if (entrada.isDirectory()) recorrer(ruta);
        else if (/\.(?:tsx?|css)$/.test(entrada.name)) archivos.push(ruta);
      }
    };
    recorrer(resolve(process.cwd(), 'src'));

    const iconosEnLinea = archivos.flatMap((archivo) => {
      const contenido = readFileSync(archivo, 'utf8');
      return [...contenido.matchAll(/<svg\b[^>]*>/g)]
        .map(([etiqueta]) => ({ archivo, etiqueta }))
        .filter(({ etiqueta }) => !/\b(?:circular-chart|auth-qr-svg|data-illustration)\b/.test(etiqueta));
    });

    const svgDeInterfazFueraDelCatalogo = archivos.flatMap((archivo) => {
      const contenido = readFileSync(archivo, 'utf8');
      return [...contenido.matchAll(/<svg\b[^>]*>/g)]
        .filter(([etiqueta]) => {
          const excepcionIlustracion = archivo.endsWith('/ui/iconos.tsx') && /\bdata-illustration="no-results"/.test(etiqueta);
          const excepcionQr = archivo.endsWith('/apps/app_docente/SeccionAutenticacion.tsx') && /\bauth-qr-svg\b/.test(etiqueta);
          const excepcionGrafica = archivo.endsWith('/apps/app_docente/SeccionPeriodos.tsx') && /\bcircular-chart\b/.test(etiqueta);
          return !(excepcionIlustracion || excepcionQr || excepcionGrafica);
        })
        .map(([etiqueta]) => `${archivo}: ${etiqueta}`);
    });

    expect(iconosEnLinea).toEqual([]);
    expect(svgDeInterfazFueraDelCatalogo).toEqual([]);
    const emojiIcono = /\p{Extended_Pictographic}/u;
    const iconoTextoSinCatalogo = /<(?:div|span)[^>]*className="[^"]*(?:icon|arrow|chevron)[^"]*"[^>]*>\s*(?:➔|➜|→|←|✕|✖|✓|✔)\s*<\//;
    const iconoEstadoSinCatalogo = /<(?:button|div|span)[^>]*className="[^"]*(?:badge|status|estado)[^"]*"[^>]*>\s*[●✓✔✗✕✖]\s*[A-Za-zÁÉÍÓÚáéíóúñ]/;
    const chevronTextoSinCatalogo = /<(?:span|small)[^>]*>[^<]*[▾▼⌄][^<]*<\/(?:span|small)>/;
    const tiposCampo = /\bauth-input-box--(?:user|mail|shield|key|book|calendar|tags|select|group|search|id)\b/;
    for (const archivo of archivos) {
      const contenido = readFileSync(archivo, 'utf8');
      expect(contenido, archivo).not.toMatch(emojiIcono);
      expect(contenido, `${archivo}: usa Icono o IconoLucide para símbolos de interfaz`).not.toMatch(iconoTextoSinCatalogo);
      expect(contenido, `${archivo}: evita glifos Unicode como iconos de estado`).not.toMatch(iconoEstadoSinCatalogo);
      expect(contenido, `${archivo}: usa el icono compartido para desplegables`).not.toMatch(chevronTextoSinCatalogo);
      for (const campo of contenido.matchAll(/<div className="([^"]*\bauth-input-box\b[^"]*)">([\s\S]*?)<\/div>/g)) {
        if (!tiposCampo.test(campo[1])) continue;
        expect(campo[2], `${archivo}: ${campo[1]}`).toMatch(/<Icono(?:Campo|Lucide)?\b/);
      }
    }
    for (const archivo of archivos) {
      const fuente = readFileSync(archivo, 'utf8');
      const contenido = archivo.endsWith('/ui/iconos.tsx')
        ? fuente.split('export function IlustracionSinResultados')[0]
        : fuente;
      for (const trazo of contenido.matchAll(/\bstrokeWidth="([\d.]+)"/g)) {
        expect(trazo[1], `${archivo}: ${trazo[0]}`).toBe('2');
      }
      for (const trazo of contenido.matchAll(/\bstrokeWidth=\{([\d.]+)\}/g)) {
        expect(trazo[1], `${archivo}: ${trazo[0]}`).toBe('2');
      }
    }
  });

  it('mantiene las importaciones Lucide de producto detrás de adaptadores compartidos', () => {
    const archivos: string[] = [];
    const recorrer = (directorio: string) => {
      for (const entrada of readdirSync(directorio, { withFileTypes: true })) {
        const ruta = `${directorio}/${entrada.name}`;
        if (entrada.isDirectory()) recorrer(ruta);
        else if (/\.(?:tsx?|jsx?)$/.test(entrada.name)) archivos.push(ruta);
      }
    };
    recorrer(resolve(process.cwd(), 'src'));

    const adaptadoresLucide = new Set([
      resolve(process.cwd(), 'src/ui/IconoLucide.tsx'),
      resolve(process.cwd(), 'src/ui/iconos.tsx'),
      resolve(process.cwd(), 'src/ui/iconosCatalogo.ts')
    ]);
    const importacionesDirectas = archivos.flatMap((archivo) => {
      const contenido = readFileSync(archivo, 'utf8');
      return /from\s*['"]lucide-react['"]/.test(contenido) && !adaptadoresLucide.has(resolve(archivo))
        ? [archivo]
        : [];
    });

    expect(importacionesDirectas).toEqual([]);
  });

  it('aplica el emblema compartido a las cabeceras principales con icono', () => {
    const pantallas = [
      'SeccionPeriodos.tsx',
      'SeccionAlumnos.tsx',
      'SeccionAsistencias.tsx',
      'SeccionTemarios.tsx',
      'SeccionCuenta.tsx',
      'SeccionEntregaInterna.tsx',
      'SeccionEvaluaciones.tsx',
      'SeccionPlantillas.tsx',
      'SeccionSincronizacion.tsx',
      'features/banco/components/BancoFormularioPregunta.tsx'
    ];
    for (const pantalla of pantallas) {
      const ruta = resolve(process.cwd(), 'src/apps/app_docente', pantalla);
      expect(readFileSync(ruta, 'utf8'), pantalla).toContain('icono-seccion-orb');
    }

    const estilos = readFileSync(resolve(process.cwd(), 'src/styles/iconography.css'), 'utf8');
    expect(estilos).toContain('inline-size: 52px');
    expect(estilos).toContain('block-size: 52px');
    expect(estilos).toContain('border-radius: 50%');
    expect(estilos).toContain('inline-size: 24px');
    expect(estilos).toContain('block-size: 24px');
  });

  it('normaliza tamaños a la escala común con un ajuste máximo de 2 px', () => {
    expect(TAMANOS_ICONO).toEqual([14, 16, 20, 24, 28, 32]);
    expect(normalizarTamanoIcono()).toBe(20);
    for (let size = 12; size <= 32; size += 1) {
      const normalized = normalizarTamanoIcono(size);
      expect(TAMANOS_ICONO).toContain(normalized);
      expect(Math.abs(normalized - size)).toBeLessThanOrEqual(2);
    }
    expect(normalizarTamanoIcono(18)).toBe(20);
    expect(normalizarTamanoIcono(26)).toBe(28);
  });

  it('aplica la misma escala a iconos de producto y Lucide', () => {
    const { container } = render(
      <>
        <Icono nombre="calificar" size={18} className="test-icono-producto" />
        <IconoLucide icon={Check} size={18} className="test-icono" />
        <Spinner size={18} />
      </>
    );
    const iconos = [...container.querySelectorAll('svg')];
    expect(iconos.map((icon) => icon.getAttribute('width'))).toEqual(['20', '20', '20']);
    expect(iconos[0].classList.contains('icono')).toBe(true);
    expect(iconos[0].classList.contains('test-icono-producto')).toBe(true);
    expect(iconos[1].classList.contains('icono')).toBe(true);
    expect(iconos[1].classList.contains('test-icono')).toBe(true);
    expect(iconos[1].getAttribute('stroke-width')).toBe('2');
    expect(iconos[2].classList.contains('icono')).toBe(true);
    expect(iconos[2].getAttribute('stroke-width')).toBe('2');
  });

  it('renderiza cada icono de producto con la misma geometría Lucide', () => {
    const { container } = render(
      <>{NOMBRES_ICONO.map((nombre) => <Icono key={nombre} nombre={nombre} />)}</>
    );
    const iconos = [...container.querySelectorAll('svg')];

    expect(iconos).toHaveLength(NOMBRES_ICONO.length);
    for (const icono of iconos) {
      expect(icono.classList.contains('icono')).toBe(true);
      expect(icono.getAttribute('viewBox')).toBe('0 0 24 24');
      expect(icono.getAttribute('width')).toBe('20');
      expect(icono.getAttribute('height')).toBe('20');
      expect(icono.getAttribute('stroke-width')).toBe('2');
      expect(icono.getAttribute('stroke-linecap')).toBe('round');
      expect(icono.getAttribute('stroke-linejoin')).toBe('round');
      expect(icono.getAttribute('aria-hidden')).toBe('true');
    }
  });

  it('conserva el nombre accesible al marcar un icono como informativo', () => {
    const { getByRole } = render(
      <Icono nombre="ok" ariaHidden={false} title="Calificación guardada" />
    );
    expect(getByRole('img', { name: 'Calificación guardada' })).toBeTruthy();
  });

  it('mantiene los iconos decorativos de los campos dentro del catálogo accesible', () => {
    const tipos = ['user', 'mail', 'shield', 'key', 'book', 'calendar', 'tags', 'select', 'group', 'search', 'id'] as const;
    const { container } = render(
      <>{tipos.map((nombre) => <IconoCampo key={nombre} nombre={nombre} />)}</>
    );
    const iconos = [...container.querySelectorAll('svg')];

    expect(iconos).toHaveLength(tipos.length);
    for (const icono of iconos) {
      expect(icono.getAttribute('width')).toBe('16');
      expect(icono.getAttribute('stroke-width')).toBe('2');
      expect(icono.classList.contains('icono')).toBe(true);
      expect(icono.getAttribute('aria-hidden')).toBe('true');
    }
  });
});
