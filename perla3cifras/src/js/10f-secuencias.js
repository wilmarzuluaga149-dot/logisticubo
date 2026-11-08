/* =====================================================================
   SECUENCIAS
   A partir de la cifra con la que empieza el número (o la posición que
   se elija) se arma la secuencia 1,2,3,4,5,6,7,8,9,0:
     · Arriba:  desde la cifra hacia adelante hasta el 0   (6 → 6,7,8,9,0)
     · Abajo:   desde la cifra anterior hacia atrás hasta el 1 (6 → 5,4,3,2,1)
   Ejemplo con 613 y la primera cifra:
     arriba 613 · 713 · 813 · 913 · 013     abajo 513 · 413 · 313 · 213 · 113
   ===================================================================== */
const Secuencia = {
  /** Cifras de arriba (hasta el 0) y de abajo (hasta el 1) a partir de la cifra d. */
  cifras(d) {
    d = +d;
    const arriba = [], abajo = [];
    if (d === 0) arriba.push(0);
    else { for (let x = d; x <= 9; x++) arriba.push(x); arriba.push(0); }
    for (let x = (d === 0 ? 9 : d - 1); x >= 1; x--) abajo.push(x);
    return { arriba, abajo };
  },
  /** Columna de la hoja del usuario: todas las cifras bajan (dir −1) o suben (dir +1) de una en una, 10 filas.
   *  613 → 613, 502, 491, 380, 279, 168, 057, 946, 835, 724 */
  columna(n, dir = -1) {
    n = String(n);
    return Array.from({ length: 10 }, (_, i) => n.split('').map(ch => String(((+ch + dir * i) % 10 + 10) % 10)).join(''));
  },
  /** Suma fila por fila: a la fila 1 se le suma 1 en cada cifra, a la fila 2 se le suma 2… y a la fila 10 se le suma 0. */
  sumaFilas(col) {
    return col.map((x, i) => { const k = (i + 1) % 10; return { fila: i + 1, n: x, k, r: x.split('').map(ch => String((+ch + k) % 10)).join('') }; });
  },
  /** Patrón por cifra, por ejemplo "-6,+1,+3": a la primera cifra −6, a la segunda +1, a la tercera +3 (sin llevar). */
  leerPatron(txt) {
    const t = String(txt || '').match(/[+-]?\s*\d/g);
    return t ? t.map(x => +x.replace(/\s/g, '')) : null;
  },
  patronTexto(p) { return p.map(v => (v < 0 ? '−' : '+') + Math.abs(v)).join(' '); },
  aplicarPatron(n, p) {
    return String(n).split('').map((d, i) => { const v = p.length === 1 ? p[0] : (p[i] ?? 0); return String(((+d + v) % 10 + 10) % 10); }).join('');
  },
  /** Todas las combinaciones (órdenes de las cifras) de una lista de números, sin repetir. */
  combinarTodo(nums) {
    const out = new Set();
    for (const n of nums) { out.add(n); for (const c of Codigo.combinaciones(n)) out.add(c); }
    return [...out];
  },
  /** pos: 0, 1, 2… (cifra que avanza) o 'todas' (todas las cifras avanzan juntas desde la primera). */
  generar(n, pos = 0) {
    n = String(n);
    if (pos === 'todas') {
      const { arriba, abajo } = this.cifras(n[0]), base = +n[0];
      const mover = (v) => n.split('').map(ch => String((+ch + (v - base) + 10) % 10)).join('');
      return { arriba: arriba.map(mover), abajo: abajo.map(mover), cifra: n[0] };
    }
    const p = Math.min(+pos, n.length - 1), { arriba, abajo } = this.cifras(n[p]);
    const poner = (v) => n.slice(0, p) + v + n.slice(p + 1);
    return { arriba: arriba.map(poner), abajo: abajo.map(poner), cifra: n[p] };
  },
};

const SeV = { texto: '', pos: '0', modo: 'baja', codigo: '613', patron: '-6,+1,+3' };
UI.views.secuencias = (el) => {
  const L = UI.ctxLoteria;
  el.innerHTML = `
    <div class="card"><h2>⇅ Secuencias</h2>
      <div class="sub">Escriba uno o varios números de tres cifras (por ejemplo 755). <b>Columna (bajan):</b> las tres cifras bajan de una en una a la vez, 10 filas: 613 → 502 → 491 → 380 → 279 → 168 → 057 → 946 → 835 → 724. También puede elegir que suban, o la secuencia por cifra (arriba hasta el 0, abajo hasta el 1).</div>
      <div class="toolbar">
        <label class="field grow">Números<input id="seN" value="${U.esc(SeV.texto)}" placeholder="Ej.: 613   o varios: 613 142 25" inputmode="numeric" autocomplete="off"></label>
        <label class="field">Forma<select id="seM"><option value="baja" ${SeV.modo === 'baja' ? 'selected' : ''}>Columna: todas las cifras bajan de 1 en 1</option><option value="sube" ${SeV.modo === 'sube' ? 'selected' : ''}>Columna: todas las cifras suben de 1 en 1</option><option value="cifra" ${SeV.modo === 'cifra' ? 'selected' : ''}>Por cifra: arriba hasta el 0 y abajo hasta el 1</option></select></label>
        <label class="field" id="seAw" ${SeV.modo === 'cifra' ? 'hidden' : ''}>Por cifra<input id="seA" value="${U.esc(SeV.patron)}" style="width:120px;font:700 16px var(--mono);text-align:center" title="Lo que se suma o resta a cada cifra, en orden: primera, segunda, tercera. Ejemplo: -6,+1,+3"></label>
        <label class="field" id="seCw" ${SeV.modo === 'cifra' ? 'hidden' : ''}>Restar<input id="seC" class="num3" maxlength="6" inputmode="numeric" value="${U.esc(SeV.codigo)}" style="width:110px" title="Se suma y se resta a cada número de la secuencia, cifra por cifra, sin llevar"></label>
        <label class="field" id="sePw" ${SeV.modo === 'cifra' ? '' : 'hidden'}>Cifra que avanza<select id="seP"><option value="0" ${SeV.pos === '0' ? 'selected' : ''}>La primera (con la que empieza)</option><option value="1" ${SeV.pos === '1' ? 'selected' : ''}>La segunda</option><option value="2" ${SeV.pos === '2' ? 'selected' : ''}>La tercera</option><option value="todas" ${SeV.pos === 'todas' ? 'selected' : ''}>Todas las cifras a la vez</option></select></label>
        <button class="btn gold big" id="seGo">VER SECUENCIA</button>
        <button class="btn" id="seX" disabled>Exportar a Excel</button>
      </div>
      <div class="small muted">Veces que salió cada número en: <b>${L ? U.esc(Store.loteriaNombre(L)) : 'todas las loterías'}</b> (cámbiela arriba en «Lotería activa»).</div>
      <div id="seOut"></div>
    </div>`;
  let ultimo = null;
  const ver = () => {
    SeV.texto = UI.val('seN'); SeV.pos = UI.val('seP'); SeV.modo = UI.val('seM');
    const codTxt = UI.val('seC').trim(); if (/^\d{1,6}$/.test(codTxt)) SeV.codigo = codTxt; else if (codTxt) UI.toast('El número para sumar y restar debe tener de 1 a 6 cifras.', 'err');
    document.getElementById('seCw').hidden = SeV.modo === 'cifra'; document.getElementById('seAw').hidden = SeV.modo === 'cifra';
    const patTxt = UI.val('seA').trim(), patOk = Secuencia.leerPatron(patTxt);
    if (patOk) SeV.patron = patTxt; else if (patTxt) UI.toast('Escriba el patrón por cifra así: -6,+1,+3', 'err');
    document.getElementById('sePw').hidden = SeV.modo !== 'cifra';
    const toks = SeV.texto.split(/[\s,;]+/).filter(Boolean), ok = toks.filter(t => /^\d{1,6}$/.test(t)), malos = toks.filter(t => !/^\d{1,6}$/.test(t));
    const box = document.getElementById('seOut');
    if (!ok.length) { box.innerHTML = malos.length ? `<div class="note warn">No se reconocieron números válidos.</div>` : ''; return; }
    const st = Stats.get(L, '', '');
    const veces = n => n.length >= 3 ? `<span class="small muted">${st.freq[+n.slice(-3)]}×</span>` : '';
    const pos = SeV.pos === 'todas' ? 'todas' : +SeV.pos;
    if (SeV.modo !== 'cifra') {
      const dir = SeV.modo === 'sube' ? 1 : -1;
      ultimo = ok.map(n => ({ n, arriba: Secuencia.columna(n, dir), abajo: [], columna: true }));
      box.innerHTML = (malos.length ? `<div class="small warn">Se ignoraron: ${malos.map(U.esc).join(', ')}</div>` : '') +
        ultimo.map(s => {
          const filas = Secuencia.sumaFilas(s.arriba), res = [...new Set(filas.map(f => f.r))], comb = Secuencia.combinarTodo(res);
          s.filas = filas; s.resultados = res; s.combinados = comb;
          const cod = SeV.codigo, pat = Secuencia.leerPatron(SeV.patron) || [-6, 1, 3], patT = Secuencia.patronTexto(pat);
          const mas = s.arriba.map(x => Secuencia.aplicarPatron(x, pat)), menos = s.arriba.map(x => Codigo.aplicar(x, cod, 'cifras', 'restar'));
          const combPM = Secuencia.combinarTodo([...new Set([...mas, ...menos])]);
          s.mas = mas; s.menos = menos; s.combPM = combPM;
          const colOp = (titulo, sub, arr, op) => `<div class="seq-col"><div class="seq-col-h"><b>${titulo}</b><div class="small muted">${sub}</div></div>${arr.map((r, i) => `<div class="seq-col-r"><span class="small muted" style="width:96px;white-space:nowrap">${s.arriba[i]} ${op}</span><span class="seq-dig">${r.split('').join('</span><span class="seq-dig">')}</span>${veces(r)}</div>`).join('')}</div>`;
          return `<div class="card" style="margin-top:12px"><h3 style="margin-top:0">Base ${UI.num3(s.n)}</h3>
          <div class="seq-cols" style="margin-top:0">
            <div class="seq-col"><div class="seq-col-h"><b>1. Secuencia</b><div class="small muted">${dir < 0 ? '▼ bajan' : '▲ suben'}</div></div>${s.arriba.map((x, i) => `<div class="seq-col-r ${i ? '' : 'first'}"><span class="seq-dig">${x.split('').join('</span><span class="seq-dig">')}</span>${veces(x)}</div>`).join('')}</div>
            ${colOp('2. Aplicando ' + patT, '1.ª cifra ' + patT.split(' ')[0] + ' · 2.ª ' + (patT.split(' ')[1] || '') + ' · 3.ª ' + (patT.split(' ')[2] || '') + ', sin llevar', mas, patT)}
            ${colOp('3. Restando ' + U.esc(cod), 'cifra por cifra, sin pedir prestado', menos, '− ' + U.esc(cod))}
            <div class="seq-col"><div class="seq-col-h"><b>4. Suma fila por fila</b><div class="small muted">fila 1 +1 … fila 10 +0</div></div>${filas.map(f => `<div class="seq-col-r"><span class="small muted" style="width:86px;white-space:nowrap">${f.n} + ${f.k}${f.k}${f.k}</span><span class="seq-dig">${f.r.split('').join('</span><span class="seq-dig">')}</span>${veces(f.r)}</div>`).join('')}</div>
            <div class="seq-col" style="flex:1;min-width:220px"><div class="seq-col-h"><b>5. Combinado total</b><div class="small muted">de la suma fila por fila: ${res.length} resultado${res.length > 1 ? 's' : ''} → ${comb.length} combinaciones</div></div>
              ${res.length === 1 && dir < 0 ? `<div class="note" style="margin:6px 0">Con la columna que baja, todas las filas dan el mismo número: base + 111 = <b>${res[0]}</b>.</div>` : ''}
              <div class="seq-nums">${comb.map(x => `<span class="seq-n">${UI.num3(x)} ${veces(x)}</span>`).join('')}</div>
              <div class="seq-col-h" style="margin-top:14px"><b>6. Combinado de «${patT}» y «−${U.esc(cod)}»</b><div class="small muted">${combPM.length} números sin repetir</div></div>
              <div class="seq-nums">${combPM.map(x => `<span class="seq-n">${UI.num3(x)} ${veces(x)}</span>`).join('')}</div></div>
          </div></div>`;
        }).join('');
      document.getElementById('seX').disabled = false;
      return;
    }
    ultimo = ok.map(n => ({ n, ...Secuencia.generar(n, pos) }));
    box.innerHTML = (malos.length ? `<div class="small warn">Se ignoraron: ${malos.map(U.esc).join(', ')}</div>` : '') + ultimo.map(s => `
      <div class="card" style="margin-top:12px">
        <h3 style="margin-top:0">${UI.num3(s.n)} · empieza en <span class="dg">${s.cifra}</span></h3>
        <div class="seq-fila"><span class="seq-et">▲ Arriba</span><span class="small muted">${Secuencia.cifras(s.cifra).arriba.join(', ')}</span></div>
        <div class="seq-nums">${s.arriba.map(x => `<span class="seq-n">${UI.num3(x)} ${veces(x)}</span>`).join('')}</div>
        <div class="seq-fila"><span class="seq-et">▼ Abajo</span><span class="small muted">${Secuencia.cifras(s.cifra).abajo.join(', ')}</span></div>
        <div class="seq-nums">${s.abajo.map(x => `<span class="seq-n">${UI.num3(x)} ${veces(x)}</span>`).join('') || '<span class="muted">—</span>'}</div>
      </div>`).join('');
    document.getElementById('seX').disabled = false;
  };
  document.getElementById('seGo').onclick = ver;
  document.getElementById('seN').onkeydown = (e) => { if (e.key === 'Enter') ver(); };
  document.getElementById('seP').onchange = () => { if (UI.val('seN')) ver(); };
  document.getElementById('seC').onchange = () => { if (UI.val('seN')) ver(); };
  document.getElementById('seA').onchange = () => { if (UI.val('seN')) ver(); };
  document.getElementById('seA').onkeydown = (e) => { if (e.key === 'Enter') ver(); };
  document.getElementById('seC').onkeydown = (e) => { if (e.key === 'Enter') ver(); };
  document.getElementById('seM').onchange = () => { document.getElementById('seCw').hidden = UI.val('seM') === 'cifra'; document.getElementById('seAw').hidden = UI.val('seM') === 'cifra'; document.getElementById('sePw').hidden = UI.val('seM') !== 'cifra'; SeV.modo = UI.val('seM'); if (UI.val('seN')) ver(); };
  document.getElementById('seX').onclick = () => {
    try {
      if (!ultimo) return;
      const aoa = [['NUMERO', 'DIRECCION', 'ORDEN', 'SECUENCIA']];
      for (const s of ultimo) {
        s.arriba.forEach((x, i) => aoa.push([s.n, s.columna ? (SeV.modo === 'sube' ? 'COLUMNA (SUBEN)' : 'COLUMNA (BAJAN)') : 'ARRIBA', i + 1, x]));
        s.abajo.forEach((x, i) => aoa.push([s.n, 'ABAJO', i + 1, x]));
        (s.filas || []).forEach(f => aoa.push([s.n, 'SUMA FILA ' + f.fila + ' (+' + f.k + f.k + f.k + ')', f.fila, f.r]));
        (s.mas || []).forEach((x, i) => aoa.push([s.n, 'APLICANDO ' + SeV.patron, i + 1, x]));
        (s.menos || []).forEach((x, i) => aoa.push([s.n, 'RESTANDO ' + SeV.codigo, i + 1, x]));
        (s.combinados || []).forEach((x, i) => aoa.push([s.n, 'COMBINADO TOTAL', i + 1, x]));
        (s.combPM || []).forEach((x, i) => aoa.push([s.n, 'COMBINADO ' + SeV.patron + ' Y -' + SeV.codigo, i + 1, x]));
      }
      const wb = XL.book(); XLSX.utils.book_append_sheet(wb, XL.sheet(aoa, [0, 3], [10, 12, 8, 12]), 'SECUENCIAS'); XL.save(wb, `PERLA3_SECUENCIAS_${U.stamp()}.xlsx`);
    } catch (err) { UI.toast(err.message, 'err'); }
  };
  if (SeV.texto) ver();
};
