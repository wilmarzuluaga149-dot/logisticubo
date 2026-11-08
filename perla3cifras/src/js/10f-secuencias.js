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

const SeV = { texto: '', pos: '0' };
UI.views.secuencias = (el) => {
  const L = UI.ctxLoteria;
  el.innerHTML = `
    <div class="card"><h2>⇅ Secuencias</h2>
      <div class="sub">Escriba uno o varios números (2, 3 o 4 cifras). Desde la cifra con la que empieza, la secuencia sigue <b>hacia arriba hasta el 0</b> y <b>hacia abajo hasta el 1</b>. Ejemplo: 613 → arriba 613, 713, 813, 913, 013 · abajo 513, 413, 313, 213, 113.</div>
      <div class="toolbar">
        <label class="field grow">Números<input id="seN" value="${U.esc(SeV.texto)}" placeholder="Ej.: 613   o varios: 613 142 25" inputmode="numeric" autocomplete="off"></label>
        <label class="field">Cifra que avanza<select id="seP"><option value="0" ${SeV.pos === '0' ? 'selected' : ''}>La primera (con la que empieza)</option><option value="1" ${SeV.pos === '1' ? 'selected' : ''}>La segunda</option><option value="2" ${SeV.pos === '2' ? 'selected' : ''}>La tercera</option><option value="todas" ${SeV.pos === 'todas' ? 'selected' : ''}>Todas las cifras a la vez</option></select></label>
        <button class="btn gold big" id="seGo">VER SECUENCIA</button>
        <button class="btn" id="seX" disabled>Exportar a Excel</button>
      </div>
      <div class="small muted">Veces que salió cada número en: <b>${L ? U.esc(Store.loteriaNombre(L)) : 'todas las loterías'}</b> (cámbiela arriba en «Lotería activa»).</div>
      <div id="seOut"></div>
    </div>`;
  let ultimo = null;
  const ver = () => {
    SeV.texto = UI.val('seN'); SeV.pos = UI.val('seP');
    const toks = SeV.texto.split(/[\s,;]+/).filter(Boolean), ok = toks.filter(t => /^\d{1,6}$/.test(t)), malos = toks.filter(t => !/^\d{1,6}$/.test(t));
    const box = document.getElementById('seOut');
    if (!ok.length) { box.innerHTML = malos.length ? `<div class="note warn">No se reconocieron números válidos.</div>` : ''; return; }
    const st = Stats.get(L, '', '');
    const veces = n => n.length >= 3 ? `<span class="small muted">${st.freq[+n.slice(-3)]}×</span>` : '';
    const pos = SeV.pos === 'todas' ? 'todas' : +SeV.pos;
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
  document.getElementById('seX').onclick = () => {
    try {
      if (!ultimo) return;
      const aoa = [['NUMERO', 'DIRECCION', 'ORDEN', 'SECUENCIA']];
      for (const s of ultimo) { s.arriba.forEach((x, i) => aoa.push([s.n, 'ARRIBA', i + 1, x])); s.abajo.forEach((x, i) => aoa.push([s.n, 'ABAJO', i + 1, x])); }
      const wb = XL.book(); XLSX.utils.book_append_sheet(wb, XL.sheet(aoa, [0, 3], [10, 12, 8, 12]), 'SECUENCIAS'); XL.save(wb, `PERLA3_SECUENCIAS_${U.stamp()}.xlsx`);
    } catch (err) { UI.toast(err.message, 'err'); }
  };
  if (SeV.texto) ver();
};
