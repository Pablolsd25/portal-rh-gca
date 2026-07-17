import ExcelJS from 'exceljs';
import type { ListaPreciosMeta, Material } from '@/lib/listaPrecios';

const YELLOW = 'FFFFFF00';
const HEADER_FILL = 'FF1F4E79';
const CHANNEL_FILL = 'FF2E75B6';

function money(n: number | null | undefined): number | null {
  if (n == null || !Number.isFinite(n)) return null;
  return Math.round(n * 10000) / 10000;
}

/** Genera el Excel con el mismo layout: Materialista / Edo. Mex / CDMX + IVA + Neto. */
export async function buildListaPreciosWorkbook(
  meta: ListaPreciosMeta,
  materiales: Material[],
): Promise<ExcelJS.Buffer> {
  const wb = new ExcelJS.Workbook();
  wb.creator = 'Portal GCA';
  wb.created = new Date();

  const ws = wb.addWorksheet('CONCENTRADORA', {
    views: [{ state: 'frozen', ySplit: 8 }],
    pageSetup: { orientation: 'landscape', fitToPage: true, fitToWidth: 1, fitToHeight: 0 },
  });

  ws.getColumn(1).width = 3;
  ws.getColumn(2).width = 55;
  for (const c of [3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15]) {
    ws.getColumn(c).width = c === 3 ? 12 : 12;
  }

  ws.mergeCells('C3:G3');
  const title = ws.getCell('C3');
  title.value = meta.empresa;
  title.font = { bold: true, size: 14, color: { argb: 'FF1F4E79' } };
  title.alignment = { horizontal: 'center' };

  ws.getCell('B6').value = meta.fecha_vigencia ? new Date(`${meta.fecha_vigencia}T12:00:00`) : new Date();
  ws.getCell('B6').numFmt = 'DD/MM/YYYY';
  ws.getCell('B6').font = { bold: true };

  ws.mergeCells('C6:G6');
  ws.getCell('C6').value = 'MATERIALISTA';
  ws.getCell('C6').font = { bold: true, color: { argb: 'FFFFFFFF' } };
  ws.getCell('C6').fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: CHANNEL_FILL } };
  ws.getCell('C6').alignment = { horizontal: 'center' };

  ws.mergeCells('I6:K6');
  ws.getCell('I6').value = 'EDO. MEX';
  ws.getCell('I6').font = { bold: true, color: { argb: 'FFFFFFFF' } };
  ws.getCell('I6').fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: CHANNEL_FILL } };
  ws.getCell('I6').alignment = { horizontal: 'center' };

  ws.mergeCells('M6:O6');
  ws.getCell('M6').value = 'CDMX';
  ws.getCell('M6').font = { bold: true, color: { argb: 'FFFFFFFF' } };
  ws.getCell('M6').fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: CHANNEL_FILL } };
  ws.getCell('M6').alignment = { horizontal: 'center' };

  const headers = [
    [, 'DESCRIPCION', 'UNIDAD', 'ACTUAL', 'PRECIO', 'IVA 16%', 'NETO', 'ACTUAL', 'PRECIO', 'IVA 16%', 'NETO', 'ACTUAL', 'PRECIO', 'IVA 16%', 'NETO'],
  ];
  const hdrRow = ws.getRow(8);
  headers[0].forEach((h, i) => {
    if (!h) return;
    const cell = hdrRow.getCell(i + 1);
    cell.value = h;
    cell.font = { bold: true, color: { argb: 'FFFFFFFF' }, size: 10 };
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: HEADER_FILL } };
    cell.alignment = { horizontal: 'center' };
  });

  let r = 9;
  for (const m of materiales) {
    const row = ws.getRow(r);
    row.getCell(2).value = m.descripcion + (m.notas ? `  (${m.notas})` : '');
    row.getCell(3).value = m.unidad;

    const e = money(m.precio_materialista);
    const i = money(m.precio_edo_mex);
    const cdmx = money(m.precio_cdmx);

    row.getCell(5).value = e;
    row.getCell(6).value = e == null ? null : { formula: `E${r}*0.16` };
    row.getCell(7).value = e == null ? null : { formula: `E${r}+F${r}` };

    row.getCell(9).value = i;
    row.getCell(10).value = i == null ? null : { formula: `I${r}*0.16` };
    row.getCell(11).value = i == null ? null : { formula: `I${r}+J${r}` };

    row.getCell(13).value = cdmx;
    row.getCell(14).value = cdmx == null ? null : { formula: `M${r}*0.16` };
    row.getCell(15).value = cdmx == null ? null : { formula: `M${r}+N${r}` };

    for (const col of [5, 6, 7, 9, 10, 11, 13, 14, 15]) {
      row.getCell(col).numFmt = '#,##0.00';
    }

    if (m.destacado) {
      for (let col = 2; col <= 15; col++) {
        row.getCell(col).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: YELLOW } };
      }
    }
    if (!m.disponible) {
      row.getCell(2).font = { italic: true, color: { argb: 'FF888888' } };
    }

    r += 1;
  }

  const foot = r + 1;
  ws.getCell(`B${foot}`).value = '** PRECIOS SUJETOS A CAMBIO SIN PREVIO AVISO';
  ws.getCell(`B${foot}`).font = { bold: true, size: 10 };
  ws.getCell(`B${foot + 1}`).value = '** FLETE EN EL AREA METROPOLITANA SIN CARGO';
  ws.getCell(`B${foot + 2}`).value = '*** LOS CAMBIOS APARECEN EN SOMBRA';
  if (meta.notas) {
    ws.getCell(`B${foot + 3}`).value = meta.notas;
    ws.getCell(`B${foot + 3}`).font = { italic: true, size: 9, color: { argb: 'FF555555' } };
  }

  return wb.xlsx.writeBuffer();
}
