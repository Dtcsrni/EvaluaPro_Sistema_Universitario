/**
 * servicioExportacionDocx
 *
 * Responsabilidad: Servicio de dominio/aplicacion con reglas de negocio reutilizables.
 * Limites: Mantener invariantes del dominio y errores controlados.
 */
import { Document, Packer, Paragraph, Table, TableCell, TableRow, TextRun, WidthType } from 'docx';
import type { ListaAcademicaFila } from './tiposListaAcademica';

function celdaEncabezado(texto: string) {
  return new TableCell({
    children: [new Paragraph({ children: [new TextRun({ text: texto, bold: true })] })]
  });
}

function celdaDato(texto: string) {
  return new TableCell({
    children: [new Paragraph(String(texto ?? ''))]
  });
}

export async function generarDocxListaAcademica(columnas: string[], filas: ListaAcademicaFila[]): Promise<Buffer> {
  const filaEncabezado = new TableRow({
    children: columnas.map((columna) => celdaEncabezado(columna))
  });

  const filasTabla = filas.map(
    (fila) =>
      new TableRow({
        children: columnas.map((columna) => celdaDato(fila[columna as keyof ListaAcademicaFila] ?? ''))
      })
  );

  const tabla = new Table({
    rows: [filaEncabezado, ...filasTabla],
    width: {
      size: 100,
      type: WidthType.PERCENTAGE
    }
  });

  const doc = new Document({
    creator: 'EvaluaPro',
    description: 'Lista academica firmada',
    title: 'Lista academica',
    revision: 1,
    lastModifiedBy: 'EvaluaPro',
    sections: [
      {
        children: [
          new Paragraph({
            children: [new TextRun({ text: 'Lista Academica', bold: true })]
          }),
          new Paragraph(''),
          tabla
        ]
      }
    ]
  });

  return Packer.toBuffer(doc);
}
