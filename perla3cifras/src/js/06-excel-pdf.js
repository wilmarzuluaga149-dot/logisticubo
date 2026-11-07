/* =====================================================================
   Integración con Excel 365 (SheetJS) e informes PDF (jsPDF)
   Los números de tres cifras siempre se escriben como TEXTO (formato @).
   ===================================================================== */
const XL = {
  ok() { return typeof XLSX !== 'undefined'; },
  need() { if (!this.ok()) throw new Error('La librería de Excel (SheetJS) no está disponible.'); },

  /** Crea una hoja a partir de filas (arreglo de arreglos). textCols: índices de columnas a forzar como texto. */
  sheet(aoa, textCols = [], widths = null) {
    const ws = XLSX.utils.aoa_to_sheet(aoa);
    const range = XLSX.utils.decode_range(ws['!ref'] || 'A1');
    for (let R = 1; R <= range.e.r; R++) for (const C of textCols) {
      const addr = XLSX.utils.encode_cell({ r: R, c: C }); const cell = ws[addr];
      if (cell && cell.v !== '' && cell.v != null) { cell.t = 's'; cell.v = String(cell.v); cell.z = '@'; }
    }
    ws['!cols'] = (widths || aoa[0].map(h => Math.max(10, String(h).length + 2))).map(w => ({ wch: w }));
    if (aoa.length > 1) ws['!autofilter'] = { ref: XLSX.utils.encode_range({ s: { r: 0, c: 0 }, e: { r: 0, c: aoa[0].length - 1 } }) };
    return ws;
  },
  save(wb, name) {
    this.need();
    const out = XLSX.write(wb, { bookType: 'xlsx', type: 'array', compression: true });
    U.download(new Blob([out], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }), name);
  },
  book() { this.need(); const wb = XLSX.utils.book_new(); wb.Props = { Title: 'PERLA 3 CIFRAS PRO', Author: 'PERLA 3 CIFRAS PRO', CreatedDate: new Date() }; return wb; },

  /* ---------- Hojas ---------- */
  hojaResultados(rows) {
    const idx = Hits.indexByDraw();
    const aoa = [['FECHA', 'LOTERIA', 'NUMERO', 'A', 'B', 'C', 'ACIERTOS_A1', 'ACIERTOS_A2', 'ACIERTOS_A3', 'ALGORITMO_1', 'ALGORITMO_2', 'ALGORITMO_3', 'D_GANADOR', 'C_GANADOR']];
    for (const r of rows) {
      const info = UI.drawHits(r, idx);
      aoa.push([r.fecha, Store.loteriaNombre(r.loteriaId), r.numero, r.numero[0], r.numero[1], r.numero[2],
        info.txt[1], info.txt[2], info.txt[3], info.top[1], info.top[2], info.top[3], info.D.join(' '), info.C.join(' ')]);
    }
    return this.sheet(aoa, [2, 3, 4, 5, 9, 10, 11], [12, 26, 9, 4, 4, 4, 12, 12, 12, 12, 12, 12, 12, 12]);
  },
  hojaEstadisticas(st) {
    const aoa = [['SECCION', 'CLAVE', 'FRECUENCIA', 'PORCENTAJE', 'TEORICO', 'SORTEOS_SIN_SALIR']];
    aoa.push(['RESUMEN', 'Sorteos analizados', st.n, '', '', '']);
    for (let i = 0; i < 1000; i++) aoa.push(['NUMERO', U.pad3(i), st.freq[i], st.n ? +(st.freq[i] / st.n * 100).toFixed(3) : 0, 0.1, st.gap[i] === null ? 'nunca' : st.gap[i]]);
    for (let p = 0; p < 3; p++) for (let d = 0; d < 10; d++) aoa.push(['POSICION_' + Stats.POS[p], String(d), st.pos[p][d], st.n ? +(st.pos[p][d] / st.n * 100).toFixed(2) : 0, 10, st.posGap[p][d] === null ? 'nunca' : st.posGap[p][d]]);
    for (const [nm] of Stats.PAIRS) for (let i = 0; i < 100; i++) aoa.push(['PAREJA_' + nm, String(i).padStart(2, '0'), st.pairs[nm][i], st.n ? +(st.pairs[nm][i] / st.n * 100).toFixed(2) : 0, 1, '']);
    for (const [k, v] of [...st.ternas.entries()].sort((a, b) => b[1] - a[1])) aoa.push(['TERNA', k, v, +(v / st.n * 100).toFixed(2), +(U.nPerms(k) / 10).toFixed(1), '']);
    for (const k in st.patterns) aoa.push(['REPETICION', k, st.patterns[k], st.n ? +(st.patterns[k] / st.n * 100).toFixed(2) : 0, Stats.theory.patterns[k] * 100, '']);
    for (const k in st.parity) aoa.push(['PARIDAD', k, st.parity[k], st.n ? +(st.parity[k] / st.n * 100).toFixed(2) : 0, 12.5, '']);
    st.sums.forEach((v, i) => aoa.push(['SUMA_CIFRAS', String(i), v, st.n ? +(v / st.n * 100).toFixed(2) : 0, +(Stats.theory.sums[i] * 100).toFixed(2), '']));
    return this.sheet(aoa, [1], [16, 20, 12, 12, 10, 18]);
  },
  hojaPronosticos(prons, conRazon = true) {
    const aoa = [['ID', 'ALGORITMO', 'LOTERIA', 'FECHA_OBJETIVO', 'DATOS_HASTA', 'SORTEOS_USADOS', 'ORIGEN', 'GENERADO', 'POSICION', 'CANDIDATO', 'PUNTUACION', 'RESULTADO', 'ESTADO', 'EXPLICACION']];
    for (const p of prons) {
      const ev = Hits.evaluate(p);
      p.candidatos.forEach((c, i) => {
        let est = ev.estado === 'pendiente' ? 'PENDIENTE' : '';
        if (ev.estado === 'evaluado') est = c.n === ev.resultado ? 'D-GANADOR' : (U.isPerm(c.n, ev.resultado) && ev.combinado ? 'C-GANADOR' : 'SIN ACIERTO');
        aoa.push([p.id, 'A' + p.algoritmo, Store.loteriaNombre(p.loteriaId), p.fechaObjetivo, p.fechaCorte || '', p.nHist, U.origenTxt(p.origen), p.creado, i + 1, c.n, c.score, ev.resultado || '', est, conRazon ? (c.razon || '') : '']);
      });
    }
    return this.sheet(aoa, [9, 11], [6, 10, 22, 13, 13, 10, 16, 22, 9, 11, 11, 11, 13, 80]);
  },
  hojaAlgoritmo(alg, prons) {
    const aoa = [['FECHA_OBJETIVO', 'LOTERIA', 'ORIGEN', 'CANDIDATOS', 'TOP_1', 'LISTA', 'RESULTADO', 'D', 'C', 'MEJOR_COINCIDENCIA_POSICIONAL']];
    for (const p of prons.filter(x => x.algoritmo === alg)) {
      const ev = Hits.evaluate(p);
      aoa.push([p.fechaObjetivo, Store.loteriaNombre(p.loteriaId), U.origenTxt(p.origen), p.candidatos.length, p.candidatos[0]?.n || '',
        p.candidatos.map(c => c.n).join(' '), ev.resultado || '', ev.directo ? 'SI' : (ev.estado === 'evaluado' ? 'NO' : ''), ev.combinado ? 'SI' : (ev.estado === 'evaluado' ? 'NO' : ''), ev.estado === 'evaluado' ? ev.mejorPos : '']);
    }
    return this.sheet(aoa, [4, 5, 6], [13, 22, 16, 11, 8, 60, 11, 5, 5, 14]);
  },
  hojaAciertos(f) {
    const { lista } = Hits.summary(f);
    const aoa = [['FECHA', 'LOTERIA', 'ALGORITMO', 'TIPO', 'RESULTADO', 'CANDIDATO', 'POSICION_EN_LISTA', 'ORIGEN']];
    for (const { p, ev } of lista) {
      const cand = ev.directo ? ev.resultado : p.candidatos[ev.rankC - 1]?.n;
      aoa.push([p.fechaObjetivo, Store.loteriaNombre(p.loteriaId), 'A' + p.algoritmo, ev.directo ? 'D-GANADOR' : 'C-GANADOR', ev.resultado, cand || '', ev.directo ? ev.rank : ev.rankC, U.origenTxt(p.origen)]);
    }
    return this.sheet(aoa, [4, 5], [12, 22, 10, 12, 10, 10, 16, 16]);
  },
  hojaComparativo(f) {
    const { per } = Hits.summary(f);
    const aoa = [['ALGORITMO', 'NOMBRE', 'PRONOSTICOS', 'EVALUADOS', 'CANDIDATOS', 'ACIERTOS_D', 'ACIERTOS_C', 'PORC_ACIERTO', 'ESPERADO_AZAR_D', 'ESPERADO_AZAR_C', 'INDICE_VS_AZAR', 'ULTIMO_ACIERTO', 'RACHA_MAX_SIN_ACIERTO']];
    for (const a of [1, 2, 3]) {
      const s = per[a];
      aoa.push(['A' + a, Algo.NOMBRES[a], s.pronosticos, s.evaluados, s.candidatos, s.D, s.C, +(s.pctAcierto * 100).toFixed(2), +s.eD.toFixed(3), +s.eC.toFixed(3), s.indice === null ? '' : +s.indice.toFixed(2), s.ultimo || '', s.maxSin]);
    }
    return this.sheet(aoa, [], [10, 24, 12, 11, 11, 11, 11, 13, 16, 16, 15, 15, 22]);
  },
  hojaInfo(extra = []) {
    return this.sheet([['PERLA 3 CIFRAS PRO', ''], ['Versión', APP_VERSION], ['Exportado', new Date().toLocaleString('es-CO')],
      ['Aviso', 'Análisis estadístico. Los pronósticos no garantizan premios.'], ...extra], [], [22, 70]);
  },

  /** Libro completo con las 8 hojas estándar. */
  libroCompleto(f = {}) {
    const wb = this.book();
    const rows = Store.resultadosDe(f.loteriaId ?? null, f);
    const prons = Hits.filter(f).sort((a, b) => (a.fechaObjetivo < b.fechaObjetivo ? -1 : 1));
    XLSX.utils.book_append_sheet(wb, this.hojaResultados(rows), 'RESULTADOS');
    XLSX.utils.book_append_sheet(wb, this.hojaEstadisticas(Stats.compute(rows)), 'ESTADISTICAS');
    for (const a of [1, 2, 3]) XLSX.utils.book_append_sheet(wb, this.hojaAlgoritmo(a, prons), 'ALGORITMO_' + a);
    XLSX.utils.book_append_sheet(wb, this.hojaPronosticos(prons.filter(p => p.origen !== 'backtest').concat(prons.filter(p => p.origen === 'backtest').slice(-300))), 'PRONOSTICOS');
    XLSX.utils.book_append_sheet(wb, this.hojaAciertos(f), 'ACIERTOS');
    XLSX.utils.book_append_sheet(wb, this.hojaComparativo(f), 'COMPARATIVO');
    XLSX.utils.book_append_sheet(wb, this.hojaInfo([['Filtro lotería', f.loteriaId ? Store.loteriaNombre(f.loteriaId) : 'Todas'], ['Desde', f.desde || '—'], ['Hasta', f.hasta || '—']]), 'INFO');
    return wb;
  },

  plantilla() {
    const wb = this.book();
    const ws = this.sheet([['FECHA', 'LOTERIA', 'NUMERO'], ['2026-01-05', 'Mi Lotería', '007'], ['2026-01-06', 'Mi Lotería', '025'], ['07/01/2026', 'Mi Lotería', '089']], [2], [14, 26, 10]);
    XLSX.utils.book_append_sheet(wb, ws, 'RESULTADOS');
    XLSX.utils.book_append_sheet(wb, this.sheet([['INSTRUCCIONES'], ['1. Una fila por sorteo: FECHA, LOTERIA, NUMERO.'], ['2. FECHA en formato AAAA-MM-DD o DD/MM/AAAA.'], ['3. Formatee la columna NUMERO como TEXTO para conservar ceros (007).'], ['4. Si el número llega como 7, la aplicación lo completa a 007.'], ['5. Borre estas filas de ejemplo antes de importar.']], [], [80]), 'INSTRUCCIONES');
    return wb;
  },

  /* ---------- Importación ---------- */
  /** Lee un archivo y devuelve {headers, rows(arreglo de arreglos), sheetNames} */
  async leer(file, sheetName) {
    const name = file.name.toLowerCase();
    if (name.endsWith('.csv') || name.endsWith('.txt')) {
      const text = await XL.readText(file);
      const aoa = XL.parseCSV(text);
      return { aoa, sheetNames: ['CSV'], sheet: 'CSV' };
    }
    this.need();
    const buf = await file.arrayBuffer();
    const wb = XLSX.read(buf, { type: 'array', cellDates: false, raw: false, cellText: false });
    const sn = sheetName && wb.SheetNames.includes(sheetName) ? sheetName : (wb.SheetNames.includes('RESULTADOS') ? 'RESULTADOS' : wb.SheetNames[0]);
    const aoa = XLSX.utils.sheet_to_json(wb.Sheets[sn], { header: 1, raw: true, defval: '', blankrows: false });
    return { aoa, sheetNames: wb.SheetNames, sheet: sn, file };
  },
  async readText(file) {
    const buf = await file.arrayBuffer();
    let text = new TextDecoder('utf-8', { fatal: false }).decode(buf);
    if (text.includes('�')) text = new TextDecoder('windows-1252').decode(buf); // CSV guardado por Excel en ANSI
    return text.replace(/^﻿/, '');
  },
  /** Analizador CSV propio (conserva ceros iniciales y no reinterpreta fechas). */
  parseCSV(text) {
    const first = text.split(/\r?\n/).find(l => l.trim()) || '';
    const cand = [';', ',', '\t', '|'];
    const delim = cand.map(d => [d, first.split(d).length]).sort((a, b) => b[1] - a[1])[0][0];
    const rows = []; let row = [], cur = '', q = false;
    for (let i = 0; i < text.length; i++) {
      const ch = text[i];
      if (q) { if (ch === '"') { if (text[i + 1] === '"') { cur += '"'; i++; } else q = false; } else cur += ch; }
      else if (ch === '"') q = true;
      else if (ch === delim) { row.push(cur); cur = ''; }
      else if (ch === '\n' || ch === '\r') { if (ch === '\r' && text[i + 1] === '\n') i++; row.push(cur); if (row.some(c => c.trim() !== '')) rows.push(row); row = []; cur = ''; }
      else cur += ch;
    }
    row.push(cur); if (row.some(c => c.trim() !== '')) rows.push(row);
    return rows.map(r => r.map(c => c.trim().replace(/^=?"(.*)"$/, '$1')));
  },
  /** Detecta columnas por nombre de encabezado. */
  detectar(headers) {
    const h = headers.map(x => U.normText(x));
    // Se prueba cada palabra en orden de prioridad: primero coincidencia exacta, luego parcial
    const find = (...keys) => {
      for (const k of keys) { const i = h.indexOf(k); if (i >= 0) return i; }
      for (const k of keys) { const i = h.findIndex(x => x.includes(k)); if (i >= 0) return i; }
      return -1;
    };
    let fecha = find('fecha', 'fecha_sorteo', 'date', 'dia');
    let numero = find('numero', 'numero_ganador', 'resultado', 'ganador', 'number', 'cifras', 'num', 'premio');
    let loteria = find('loteria', 'lottery', 'juego', 'sorteo', 'nombre');
    if (numero === loteria) loteria = -1;
    if (fecha === numero) fecha = -1;
    return { fecha, loteria, numero, hasHeader: fecha >= 0 || numero >= 0 };
  },
  /** Convierte filas a registros validados. map: {fecha, loteria, numero}, opts: {loteriaFija, formatoFecha, ultimas3, hasHeader} */
  /** Archivos de premios (mayor, secos, extras...): deja solo el PREMIO MAYOR de los sorteos ordinarios. */
  filtroPremios(aoa, hasHeader) {
    if (!hasHeader || !aoa.length) return null;
    const h = aoa[0].map(x => U.normText(x));
    const cp = h.findIndex(x => x.includes('premio')), cs = h.findIndex(x => x === 'sorteo' || x.startsWith('sorteo') || x.includes('n. sorteo'));
    if (cp < 0) return null;
    const esMayor = v => { const t = U.normText(v); return /^(gran\s+)?(premio\s+)?mayor/.test(t) && !/anterior|posterior|aproxim|igual serie/.test(t); };
    const body = aoa.slice(1);
    if (!body.some(r => esMayor(r[cp]))) return null;
    const keep = body.filter(r => esMayor(r[cp]) && (cs < 0 || /^\s*\d+\s*$/.test(String(r[cs] ?? ''))));
    return { aoa: [aoa[0], ...keep], total: body.length, mayores: keep.length };
  },
  mapear(aoa, map, opts) {
    const pf = XL.filtroPremios(aoa, opts.hasHeader);
    if (pf) aoa = pf.aoa;
    const out = [], errores = [], nuevasLot = new Set();
    const start = opts.hasHeader ? 1 : 0;
    const vistos = new Set();
    for (let i = start; i < aoa.length; i++) {
      const row = aoa[i];
      const fila = i + 1;
      const fecha = U.parseDate(row[map.fecha], opts.formatoFecha);
      const numero = U.normNum(row[map.numero], { ultimas3: opts.ultimas3 });
      let lotNombre = map.loteria >= 0 ? String(row[map.loteria] ?? '').trim() : '';
      if (!lotNombre) lotNombre = opts.loteriaNombreFija || (opts.loteriaFija ? Store.loteriaNombre(opts.loteriaFija) : '');
      if (!fecha) { errores.push({ fila, motivo: `Fecha inválida: "${row[map.fecha] ?? ''}"` }); continue; }
      if (!numero) { errores.push({ fila, motivo: `Número inválido: "${row[map.numero] ?? ''}"` }); continue; }
      if (!lotNombre) { errores.push({ fila, motivo: 'Sin lotería' }); continue; }
      if (fecha > U.addDays(U.todayISO(), 1)) { errores.push({ fila, motivo: `Fecha futura: ${fecha}` }); continue; }
      const k = U.normText(lotNombre) + '|' + fecha;
      if (vistos.has(k)) { errores.push({ fila, motivo: `Duplicado dentro del archivo (${lotNombre} ${fecha})` }); continue; }
      vistos.add(k);
      if (!Store.findLoteriaByName(lotNombre)) nuevasLot.add(lotNombre);
      out.push({ fecha, loteria: lotNombre, numero });
    }
    return { registros: out, errores, nuevasLot: [...nuevasLot], filtroPremios: pf };
  },
};

/* ------------------------------ PDF ------------------------------ */
const PDF = {
  ok() { return !!(window.jspdf && window.jspdf.jsPDF); },
  /** Crea un PDF con secciones: [{titulo, texto?, tabla?:{head, body}}] */
  build(titulo, secciones, nombre) {
    if (!this.ok()) { UI.toast('La librería PDF no está disponible; se abrirá la impresión del navegador.', 'warn'); window.print(); return; }
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF({ unit: 'pt', format: 'a4' });
    const W = doc.internal.pageSize.getWidth();
    const header = () => {
      doc.setFillColor(11, 20, 36); doc.rect(0, 0, W, 54, 'F');
      doc.setFillColor(179, 139, 18); doc.rect(0, 54, W, 3, 'F');
      doc.setTextColor(217, 181, 74); doc.setFont('helvetica', 'bold'); doc.setFontSize(15);
      doc.text('PERLA 3 CIFRAS PRO', 36, 33);
      doc.setTextColor(230, 236, 245); doc.setFontSize(10); doc.setFont('helvetica', 'normal');
      doc.text(titulo, W - 36, 33, { align: 'right' });
    };
    header();
    let y = 80;
    doc.setTextColor(60, 60, 60); doc.setFontSize(9);
    doc.text(`Generado: ${new Date().toLocaleString('es-CO')}  ·  Versión ${APP_VERSION}`, 36, y); y += 18;
    for (const s of secciones) {
      if (y > 760) { doc.addPage(); header(); y = 80; }
      doc.setTextColor(140, 105, 10); doc.setFont('helvetica', 'bold'); doc.setFontSize(12);
      doc.text(s.titulo, 36, y); y += 14;
      doc.setFont('helvetica', 'normal'); doc.setFontSize(9.5); doc.setTextColor(40, 40, 40);
      if (s.texto) { const lines = doc.splitTextToSize(s.texto, W - 72); doc.text(lines, 36, y); y += lines.length * 12 + 6; }
      if (s.tabla && doc.autoTable) {
        doc.autoTable({
          startY: y, head: [s.tabla.head], body: s.tabla.body, margin: { left: 36, right: 36, top: 70 },
          styles: { fontSize: 8, cellPadding: 3, overflow: 'linebreak' }, headStyles: { fillColor: [22, 35, 58], textColor: [217, 181, 74] },
          alternateRowStyles: { fillColor: [244, 246, 250] }, columnStyles: s.tabla.colStyles || {},
          didDrawPage: (d) => { if (d.pageNumber > 1) header(); },
        });
        y = doc.lastAutoTable.finalY + 18;
      }
    }
    const pages = doc.getNumberOfPages();
    for (let i = 1; i <= pages; i++) {
      doc.setPage(i); doc.setFontSize(8); doc.setTextColor(120, 120, 120);
      doc.text('Herramienta de análisis estadístico. Los pronósticos no garantizan premios: cada sorteo es aleatorio e independiente.', 36, 820);
      doc.text(`Página ${i} de ${pages}`, W - 36, 820, { align: 'right' });
    }
    U.download(doc.output('blob'), nombre);
  },
};
