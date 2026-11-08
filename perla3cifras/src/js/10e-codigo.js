/* =====================================================================
   CÓDIGO 555
   Suma un código (por defecto 555) a los números de una lotería (por
   defecto la Lotería de Medellín).
   · Cifra por cifra, sin llevar: cada cifra + la del código, módulo 10.
     142 + 555 = 697 · 678 + 555 = 123.  Un código de una cifra (5) se
     aplica a todas las cifras (equivale a 555).
   · Suma normal: 678 + 555 = 1233 → se toman las 3 últimas cifras (233).
   Los resultados guardados no se modifican.
   ===================================================================== */
const Codigo = {
  conf() {
    const c = Store.config.codigo || {};
    return { codigo: c.codigo || '555', modo: c.modo || 'cifras', op: c.op === 'restar' ? 'restar' : 'sumar', loteria: c.loteria || 'Lotería de Medellín', ventana: +c.ventana || 10, filas: +c.filas || 30 };
  },
  async guardar(p) { await Store.setConfig('codigo', { ...this.conf(), ...p }); },
  valido(cod) { return /^\d{1,6}$/.test(String(cod || '')); },
  /** Aplica el código a un número (texto de cifras). */
  signo(op = this.conf().op) { return op === 'restar' ? '−' : '+'; },
  aplicar(n, cod = this.conf().codigo, modo = this.conf().modo, op = this.conf().op) {
    n = String(n); cod = String(cod);
    const s = op === 'restar' ? -1 : 1;
    if (modo === 'suma') {
      const L = Math.max(n.length, 3), M = 10 ** L;
      return String((((+n + s * +cod) % M) + M) % M).padStart(L, '0');
    }
    // cifra por cifra: un código de 1 cifra se repite; si es más corto que el número se alinea a la derecha
    const c = cod.length === 1 ? cod.repeat(n.length) : cod.padStart(n.length, '0').slice(-n.length);
    return n.split('').map((d, i) => String((+d + s * +c[i] + 10) % 10)).join('');
  },
  /** Combinaciones: el mismo número con sus cifras en otro orden (sin repetir, sin el propio número). */
  combinaciones(n) {
    const out = new Set(), a = String(n).split('');
    const perm = (pre, rest) => { if (!rest.length) { out.add(pre); return; } rest.forEach((d, i) => perm(pre + d, rest.slice(0, i).concat(rest.slice(i + 1)))); };
    if (a.length <= 6) perm('', a);
    out.delete(String(n)); return [...out];
  },
};

UI.views.codigo = (el) => {
  const c = Codigo.conf();
  const lot = Store.findLoteriaByName(c.loteria) || (UI.ctxLoteria ? Store.loteria(UI.ctxLoteria) : null) || Store.loterias[0];
  const sg = Codigo.signo(c.op);
  const ejemplo = ['142', '678', '007'].map(n => `${n} ${sg} ${c.codigo} = <b class="n3">${Codigo.aplicar(n)}</b>`).join(' · ');
  el.innerHTML = `
    <div class="card"><h2>${sg === '+' ? '＋' : '−'} Código ${U.esc(c.codigo)}</h2>
      <div class="sub">${c.op === 'restar' ? 'Resta' : 'Suma'} un código a los números de la lotería elegida y muestra sus combinaciones. El código es opcional: 555, 5 (se aplica a cada cifra), 613 o el que usted quiera. Los resultados guardados no se modifican.</div>
      <div class="toolbar">
        <label class="field grow">Lotería<select id="coL">${Store.loterias.map(l => `<option value="${l.id}" ${lot && l.id === lot.id ? 'selected' : ''}>${U.esc(l.nombre)}</option>`).join('')}</select></label>
        <label class="field">Código<input id="coC" class="num3" maxlength="6" inputmode="numeric" value="${U.esc(c.codigo)}" style="width:120px"></label>
        <label class="field">Operación<select id="coO"><option value="sumar" ${c.op === 'sumar' ? 'selected' : ''}>Sumar (+)</option><option value="restar" ${c.op === 'restar' ? 'selected' : ''}>Restar (−)</option></select></label>
        <label class="field">Forma<select id="coM"><option value="cifras" ${c.modo === 'cifras' ? 'selected' : ''}>Cifra por cifra (sin llevar ni pedir prestado)</option><option value="suma" ${c.modo === 'suma' ? 'selected' : ''}>Operación normal (3 últimas cifras)</option></select></label>
        <label class="field">Mostrar<select id="coF">${[30, 100, 300, 1000].map(v => `<option ${v === c.filas ? 'selected' : ''}>${v}</option>`).join('')}</select></label>
        <label class="field">¿Salió en los siguientes?<select id="coV">${[1, 5, 10, 30].map(v => `<option value="${v}" ${v === c.ventana ? 'selected' : ''}>${v} sorteo${v > 1 ? 's' : ''}</option>`).join('')}</select></label>
      </div>
      <div class="small muted">Ejemplos: ${ejemplo}</div>
    </div>
    ${lot ? '' : UI.needData(1, null)}
    <div id="coOut"></div>
    <div class="card"><h2>Aplicar el código a cualquier número</h2>
      <div class="toolbar"><label class="field grow">Números (2, 3 o 4 cifras)<input id="coN" placeholder="Ej.: 142 25 1234" inputmode="numeric"></label><button class="btn gold" id="coGo">${c.op === 'restar' ? 'RESTAR' : 'SUMAR'} ${U.esc(c.codigo)}</button></div>
      <div id="coNOut"></div>
    </div>`;
  const leer = async () => {
    const cod = UI.val('coC').trim();
    if (!Codigo.valido(cod)) { UI.toast('El código debe tener de 1 a 6 cifras (por ejemplo 555 o 5).', 'err'); return false; }
    const l = Store.loteria(+UI.val('coL'));
    await Codigo.guardar({ codigo: cod, modo: UI.val('coM'), op: UI.val('coO'), loteria: l ? l.nombre : c.loteria, filas: +UI.val('coF'), ventana: +UI.val('coV') });
    return true;
  };
  ['coL', 'coC', 'coO', 'coM', 'coF', 'coV'].forEach(id => document.getElementById(id).onchange = async () => { if (await leer()) UI.render(); });
  document.getElementById('coGo').onclick = () => {
    const toks = UI.val('coN').split(/[\s,;]+/).filter(Boolean), cf = Codigo.conf();
    const ok = toks.filter(t => /^\d{1,6}$/.test(t)), malos = toks.filter(t => !/^\d{1,6}$/.test(t));
    document.getElementById('coNOut').innerHTML = (malos.length ? `<div class="small warn">Se ignoraron: ${malos.map(U.esc).join(', ')}</div>` : '') +
      (ok.length ? UI.table(['Número', `${Codigo.signo()} ${U.esc(cf.codigo)}`, 'Combinaciones del resultado'], ok.map(n => { const t = Codigo.aplicar(n); return `<tr><td>${UI.num3(n)}</td><td>${UI.num3(t)}</td><td style="white-space:normal">${Codigo.combinaciones(t).map(x => `<span class="n3" style="font-size:13px;margin-right:8px">${x}</span>`).join('') || '<span class="muted">—</span>'}</td></tr>`; })) : '');
  };
  document.getElementById('coN').onkeydown = (e) => { if (e.key === 'Enter') document.getElementById('coGo').click(); };
  if (!lot) return;
  coDibujar(lot);
};

function coDibujar(lot) {
  const c = Codigo.conf(), rows = Store.resultadosDe(lot.id), st = Stats.get(lot.id, '', ''), V = c.ventana;
  const box = document.getElementById('coOut');
  if (!rows.length) { box.innerHTML = UI.needData(1, lot.id); return; }
  // ¿El número con código salió en los V sorteos siguientes? (directo o combinado) — comparado con el azar
  let evaluados = 0, sd = 0, sc = 0, eD = 0, eC = 0;
  const filas = rows.map((r, i) => {
    const t = Codigo.aplicar(r.numero), sig = rows.slice(i + 1, i + 1 + V);
    let d = null, cmb = null;
    sig.forEach((s, j) => { if (d === null && s.numero === t) d = j + 1; else if (cmb === null && s.numero !== t && U.isPerm(s.numero, t)) cmb = j + 1; });
    if (sig.length === V) {
      evaluados++; if (d !== null) sd++; else if (cmb !== null) sc++;
      eD += 1 - (999 / 1000) ** V; eC += 1 - (1 - (U.nPerms(t) - 1) / 1000) ** V;
    }
    return { r, t, d, cmb, completo: sig.length === V };
  });
  const ult = rows[rows.length - 1], tUlt = Codigo.aplicar(ult.numero), prox = nextDrawDate(lot.id);
  const cons = Algo.consenso(Algo.historyBefore(lot.id, prox), { k: 5, seed: `${lot.id}|${prox}`, fechaObjetivo: prox });
  const info = n => `${st.freq[+n]} ${st.freq[+n] === 1 ? 'vez' : 'veces'}${st.gap[+n] === null ? ' · nunca' : ' · hace ' + st.gap[+n] + ' sorteos'}`;
  const indice = (eD + eC) ? (sd + sc) / (eD + eC) : null;
  box.innerHTML = `
    <div class="card consenso"><h2>★ Para el próximo sorteo (${U.DIAS[U.weekday(prox)]} ${U.fmtDate(prox)}) · ${U.esc(lot.nombre)}</h2>
      <div class="cons-top">
        <div class="cons-main"><div class="small muted">Último resultado ${UI.num3(ult.numero)} (${U.fmtDate(ult.fecha)}) ${Codigo.signo()} ${U.esc(c.codigo)} =</div><div class="big-num">${tUlt}</div><div class="small muted">${info(tUlt)}</div><div class="small" style="margin-top:6px">Combinaciones: ${Codigo.combinaciones(tUlt).map(x => `<b class="n3" style="font-size:13px">${x}</b>`).join(' ')}</div></div>
        <div><h3 style="margin-top:0">Números de consenso ${Codigo.signo()} ${U.esc(c.codigo)}</h3>
          ${UI.table(['Consenso', `${Codigo.signo()} código`, 'Combinaciones', 'Historial del número con código'], cons.map(x => { const t = Codigo.aplicar(x.n); return `<tr><td>${UI.num3(x.n)}</td><td>${UI.num3(t)}</td><td class="small">${Codigo.combinaciones(t).join(' ')}</td><td class="small muted">${info(t)}</td></tr>`; }))}</div>
      </div>
      <div class="note" style="margin-top:10px">¿Sirve el código? En ${U.fmt(evaluados)} sorteos de ${U.esc(lot.nombre)}, el número con código salió en los ${V} sorteo${V > 1 ? 's' : ''} siguientes <b>${sd}</b> veces directo y <b>${sc}</b> combinado; por azar se esperaban <b>${(eD + eC).toFixed(1)}</b> → índice <b>${indice === null ? '—' : indice.toFixed(2) + '×'}</b> (1,00× = igual que el azar).</div>
    </div>
    <div class="card"><h2>Resultados de ${U.esc(lot.nombre)} ${Codigo.signo()} ${U.esc(c.codigo)} (últimos ${Math.min(c.filas, rows.length)})</h2>
      <div class="toolbar"><button class="btn" id="coXls">Exportar a Excel (todos)</button></div>
      ${UI.table(['Fecha', 'Número', `${Codigo.signo()} ${U.esc(c.codigo)}`, 'Combinaciones', { t: 'A', c: 'c' }, { t: 'B', c: 'c' }, { t: 'C', c: 'c' }, `¿Salió después? (${V})`, 'Historial del número con código'],
        filas.slice(-c.filas).reverse().map(f => `<tr><td>${U.fmtDate(f.r.fecha)}</td><td>${UI.num3(f.r.numero)}</td><td>${UI.num3(f.t)}</td><td class="small">${Codigo.combinaciones(f.t).join(' ')}</td>${[0, 1, 2].map(p => `<td class="c"><span class="dg">${f.t[p]}</span></td>`).join('')}
          <td>${f.d !== null ? `<span class="badge d">DIRECTO a los ${f.d}</span>` : f.cmb !== null ? `<span class="badge c">COMBINADO a los ${f.cmb}</span>` : f.completo ? '<span class="muted">no</span>' : '<span class="muted">pendiente</span>'}</td><td class="small muted">${info(f.t)}</td></tr>`))}
    </div>`;
  document.getElementById('coXls').onclick = () => {
    try {
      const aoa = [['FECHA', 'LOTERIA', 'NUMERO', 'OPERACION', 'CODIGO', 'FORMA', 'NUMERO_CON_CODIGO', 'COMBINACIONES', 'SALIO_DIRECTO_EN', 'SALIO_COMBINADO_EN']];
      for (const f of filas) aoa.push([f.r.fecha, lot.nombre, f.r.numero, c.op === 'restar' ? 'RESTAR' : 'SUMAR', c.codigo, c.modo === 'suma' ? 'NORMAL' : 'CIFRA POR CIFRA', f.t, Codigo.combinaciones(f.t).join(' '), f.d ?? '', f.cmb ?? '']);
      const wb = XL.book(); XLSX.utils.book_append_sheet(wb, XL.sheet(aoa, [2, 4, 6], [12, 24, 9, 10, 8, 16, 18, 26, 16, 18]), 'CODIGO');
      XL.save(wb, `PERLA3_CODIGO_${U.slug(c.codigo)}_${U.slug(lot.nombre)}_${U.stamp()}.xlsx`);
    } catch (err) { UI.toast(err.message, 'err'); }
  };
}
