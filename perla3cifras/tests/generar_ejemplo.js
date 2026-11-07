// Genera los archivos de DATOS DE EJEMPLO (ficticios, pseudoaleatorios) en ../datos_ejemplo
const XLSX = require('xlsx'), fs = require('fs'), path = require('path');
let a = 777; const rnd = () => { a |= 0; a = (a + 0x6D2B79F5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
const rows = [['FECHA', 'LOTERIA', 'NUMERO']];
for (const lot of ['EJEMPLO Archivo Tarde', 'EJEMPLO Archivo Noche']) {
  const d = new Date(Date.UTC(2025, 0, 1));
  for (let i = 0; i < 365; i++) { rows.push([d.toISOString().slice(0, 10), lot, String(Math.floor(rnd() * 1000)).padStart(3, '0')]); d.setUTCDate(d.getUTCDate() + 1); }
}
const out = path.join(__dirname, '../datos_ejemplo');
fs.writeFileSync(path.join(out, 'EJEMPLO_resultados_ficticios.csv'), '﻿' + rows.map(r => r.join(';')).join('\r\n') + '\r\n');
const ws = XLSX.utils.aoa_to_sheet(rows);
for (let r = 1; r < rows.length; r++) { const c = ws[XLSX.utils.encode_cell({ r, c: 2 })]; c.t = 's'; c.z = '@'; }
ws['!cols'] = [{ wch: 12 }, { wch: 24 }, { wch: 9 }];
const wb = XLSX.utils.book_new(); XLSX.utils.book_append_sheet(wb, ws, 'RESULTADOS');
XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet([['AVISO'], ['DATOS DE EJEMPLO FICTICIOS generados al azar para probar la importación.'], ['No corresponden a ningún sorteo real.']]), 'AVISO');
XLSX.writeFile(wb, path.join(out, 'EJEMPLO_resultados_ficticios.xlsx'));
console.log('ok', rows.length - 1, 'filas');
