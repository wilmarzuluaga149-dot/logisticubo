/* =====================================================================
   REEMPLAZOS
   El usuario define cómo se reemplaza cada número que ingresa:
   · Tabla de cifras (0–9): cada cifra se cambia por otra (o por varias
     opciones, generando todas las combinaciones). Ej.: 1→7, 4→9, 2→5
     convierte 142 en 795.
   · Tabla de números: un número completo se reemplaza por otros.
     Ej.: 142 = 381, 517.
   Los resultados guardados NUNCA se modifican: el reemplazo es una
   herramienta de consulta y se puede mostrar junto a los pronósticos.
   ===================================================================== */
const Reemp = {
  PRESETS: {
    espejo5: { nombre: 'Espejo (+5)', f: d => (d + 5) % 10 },
    comp9: { nombre: 'Complemento a 9', f: d => 9 - d },
    mas1: { nombre: 'Siguiente (+1)', f: d => (d + 1) % 10 },
    menos1: { nombre: 'Anterior (−1)', f: d => (d + 9) % 10 },
  },
  conf() {
    const r = Store.config.reemplazos || {};
    return { cifras: r.cifras || {}, numeros: r.numeros || {}, enPronosticos: !!r.enPronosticos };
  },
  async guardar(parcial) { await Store.setConfig('reemplazos', { ...this.conf(), ...parcial }); },
  tieneTabla() { const c = this.conf(); return Object.values(c.cifras).some(v => v && v.length) || Object.keys(c.numeros).length > 0; },
  /** Opciones de una cifra según la tabla (si no tiene reemplazo, queda igual). */
  opciones(d, cifras) { const v = cifras[d]; return v && v.length ? v : [d]; },
  /** Reemplazo cifra por cifra: devuelve todas las combinaciones (máx. 1000). */
  porCifras(n, cifras = this.conf().cifras) {
    if (!Object.values(cifras).some(v => v && v.length)) return [];
    let out = [''];
    for (const ch of n) { const next = []; for (const pre of out) for (const op of this.opciones(ch, cifras)) next.push(pre + op); out = next.slice(0, 1000); }
    return [...new Set(out)];
  },
  porNumero(n, numeros = this.conf().numeros) { return numeros[n] || []; },
  /** Todos los reemplazos de un número (sin repetir y sin el propio número). */
  todos(n) { return [...new Set([...this.porCifras(n), ...this.porNumero(n)])].filter(x => x !== n); },
  /** Lee una lista de números escrita o pegada (separados por espacios, comas o líneas).
   *  Se conservan tal como se escriben: de 1 a 6 cifras (25, 142, 1234…), sin rellenar con ceros. */
  leerNumeros(txt) {
    const ok = [], malos = [];
    for (const t of String(txt).split(/[\s,;|]+/).filter(Boolean)) { if (/^\d{1,6}$/.test(t)) ok.push(t); else malos.push(t); }
    return { ok: [...new Set(ok)], malos };
  },
  /** Texto "142 = 381, 517" por líneas -> objeto. */
  parseTablaNumeros(txt) {
    const out = {}, errores = [];
    String(txt).split(/\r?\n/).forEach((linea, i) => {
      if (!linea.trim()) return;
      const m = linea.split(/=|:|→|->/);
      if (m.length < 2) { errores.push(`Línea ${i + 1}: falta el signo "=" (ejemplo: 142 = 381, 517)`); return; }
      const de = /^\d{1,6}$/.test(m[0].trim()) ? m[0].trim() : null;
      const a = this.leerNumeros(m.slice(1).join(' '));
      if (!de) { errores.push(`Línea ${i + 1}: número inválido "${m[0].trim()}"`); return; }
      if (!a.ok.length) { errores.push(`Línea ${i + 1}: no hay números de reemplazo`); return; }
      out[de] = [...new Set([...(out[de] || []), ...a.ok])];
    });
    return { tabla: out, errores };
  },
  tablaNumerosTexto(numeros = this.conf().numeros) { return Object.keys(numeros).sort().map(k => `${k} = ${numeros[k].join(', ')}`).join('\n'); },
  /** Línea compacta para mostrar junto a un candidato. */
  etiqueta(n) {
    const r = this.todos(n);
    if (!r.length) return '';
    return `<span class="reemp">↻ ${r.slice(0, 8).map(x => `<b>${x}</b>`).join(' ')}${r.length > 8 ? ` +${r.length - 8}` : ''}</span>`;
  },
};

const ReV = { texto: '', resultados: null };

UI.views.reemplazos = (el) => {
  const c = Reemp.conf(), L = UI.ctxLoteria;
  el.innerHTML = `
    <div class="card"><h2>↻ Reemplazar números</h2>
      <div class="sub">Escriba o pegue uno o varios números de <b>2, 3 o 4 cifras</b> (también 1, 5 o 6). Cada cifra se convierte con la tabla de abajo, en los dos sentidos (0↔5, 1↔6, 2↔7, 3↔8, 4↔9). Los resultados guardados no se modifican.</div>
      <div class="toolbar">
        <label class="field grow">Números<input id="reNums" value="${U.esc(ReV.texto)}" placeholder="Ej.: 142   o varios: 25 142 1234" inputmode="numeric" autocomplete="off"></label>
        <button class="btn gold big" id="reGo">REEMPLAZAR</button>
        <button class="btn" id="reXls" ${ReV.resultados ? '' : 'disabled'}>Exportar a Excel</button>
      </div>
      <div class="small muted">Estadísticas de la lotería activa: <b>${L ? U.esc(Store.loteriaNombre(L)) : 'todas las loterías'}</b> (cámbiela arriba).</div>
      <div id="reOut"></div>
    </div>
    <div class="grid g2">
      <div class="card"><h2>Tabla de cifras (0–9)</h2>
        <div class="sub">Escriba por qué cifra se cambia cada una. Puede poner varias separadas por coma (1 → 7,8) y se generan todas las combinaciones. Vacío = no se cambia.</div>
        <div class="re-cifras">${[...'0123456789'].map(d => `<label class="field"><span><span class="dg">${d}</span> se cambia por</span><input data-cifra="${d}" value="${U.esc((c.cifras[d] || []).join(','))}" maxlength="19" inputmode="numeric" placeholder="${d}"></label>`).join('')}</div>
        <div class="toolbar" style="margin-top:10px">
          <button class="btn green" id="reSaveC">Guardar tabla de cifras</button>
          ${Object.entries(Reemp.PRESETS).map(([k, p]) => `<button class="btn sm" data-preset="${k}">${p.nombre}</button>`).join('')}
          <button class="btn sm danger" id="reClrC">Vaciar</button>
        </div>
      </div>
      <div class="card"><h2>Tabla de números</h2>
        <div class="sub">Una línea por número: <code>número = reemplazos</code>. Ejemplo: <code>142 = 381, 517</code></div>
        <textarea id="reTablaN" placeholder="142 = 381, 517&#10;007 = 700, 070">${U.esc(Reemp.tablaNumerosTexto(c.numeros))}</textarea>
        <div id="reErrN" class="small bad"></div>
        <div class="toolbar" style="margin-top:10px"><button class="btn green" id="reSaveN">Guardar tabla de números</button><span class="small muted">${Object.keys(c.numeros).length} números con reemplazo</span></div>
      </div>
    </div>
    <div class="card"><label class="field"><span><input type="checkbox" id="reEnPron" ${c.enPronosticos ? 'checked' : ''}> Mostrar el número reemplazado junto a cada candidato en los pronósticos (Generar, Algoritmos e Importar y analizar)</span></label></div>`;

  const leerCifras = () => {
    const out = {}, malos = [];
    UI.$$('[data-cifra]', el).forEach(i => {
      const v = i.value.split(/[\s,;]+/).filter(Boolean);
      const ok = v.filter(x => /^\d$/.test(x));
      if (ok.length !== v.length) malos.push(i.dataset.cifra);
      if (ok.length) out[i.dataset.cifra] = [...new Set(ok)];
    });
    if (malos.length) throw new Error('Use solo cifras de 0 a 9 (separadas por coma) en: ' + malos.join(', '));
    return out;
  };
  const mostrar = () => {
    const box = document.getElementById('reOut');
    const { ok, malos } = Reemp.leerNumeros(UI.val('reNums'));
    ReV.texto = UI.val('reNums');
    if (!ok.length) { box.innerHTML = malos.length ? `<div class="note warn">No se reconocieron números válidos (${malos.map(U.esc).join(', ')}).</div>` : ''; ReV.resultados = null; return; }
    if (!Reemp.tieneTabla()) { box.innerHTML = '<div class="note warn">Todavía no hay reemplazos: llene la tabla de cifras o la de números (abajo) y pulse Guardar.</div>'; ReV.resultados = null; return; }
    const st = Stats.get(L, '', '');
    // Estadística en la lotería activa: números de 3 cifras directamente; de 4 cifras, por sus 3 últimas
    const info = (n) => {
      if (n.length < 3) return '';
      const k = +n.slice(-3), f = st.freq[k], g = st.gap[k];
      return `<span class="small muted">${n.length > 3 ? '(' + n.slice(-3) + ') ' : ''}${f} ${f === 1 ? 'vez' : 'veces'}${g === null ? ' · nunca' : ' · hace ' + g + ' sorteos'}</span>`;
    };
    ReV.resultados = ok.map(n => ({ n, cif: Reemp.porCifras(n), num: Reemp.porNumero(n) }));
    box.innerHTML = (malos.length ? `<div class="small warn">Se ignoraron: ${malos.map(U.esc).join(', ')}</div>` : '') + UI.table(['Número', 'Cifra por cifra', 'Por tabla de números', { t: 'Total', c: 'r' }],
      ReV.resultados.map(r => `<tr><td>${UI.num3(r.n)}<div>${info(r.n)}</div></td>
        <td style="white-space:normal">${r.cif.length ? r.cif.slice(0, 60).map(x => `<span style="display:inline-block;margin:2px 8px 2px 0">${UI.num3(x)} ${info(x)}</span>`).join('') + (r.cif.length > 60 ? `<div class="small muted">… y ${r.cif.length - 60} más (ver Excel)</div>` : '') : '<span class="muted">—</span>'}</td>
        <td style="white-space:normal">${r.num.length ? r.num.map(x => `<span style="display:inline-block;margin:2px 8px 2px 0">${UI.num3(x)} ${info(x)}</span>`).join('') : '<span class="muted">—</span>'}</td>
        <td class="r">${new Set([...r.cif, ...r.num].filter(x => x !== r.n)).size}</td></tr>`));
    document.getElementById('reXls').disabled = false;
  };
  document.getElementById('reGo').onclick = mostrar;
  document.getElementById('reNums').onkeydown = (e) => { if (e.key === 'Enter') mostrar(); };
  document.getElementById('reSaveC').onclick = async () => { try { await Reemp.guardar({ cifras: leerCifras() }); UI.toast('Tabla de cifras guardada.'); mostrar(); } catch (err) { UI.toast(err.message, 'err'); } };
  document.getElementById('reClrC').onclick = async () => { if (await UI.confirm('¿Vaciar la tabla de cifras?', { danger: true, ok: 'Vaciar' })) { await Reemp.guardar({ cifras: {} }); UI.render(); } };
  UI.$$('[data-preset]', el).forEach(b => b.onclick = () => { const f = Reemp.PRESETS[b.dataset.preset].f; UI.$$('[data-cifra]', el).forEach(i => { i.value = String(f(+i.dataset.cifra)); }); UI.toast('Tabla llenada con «' + Reemp.PRESETS[b.dataset.preset].nombre + '». Pulse Guardar para conservarla.', 'ok', 5000); });
  document.getElementById('reSaveN').onclick = async () => {
    const { tabla, errores } = Reemp.parseTablaNumeros(UI.val('reTablaN'));
    document.getElementById('reErrN').innerHTML = errores.map(U.esc).join('<br>');
    if (errores.length) { UI.toast('Revise la tabla de números: ' + errores.length + ' líneas con error.', 'err'); return; }
    await Reemp.guardar({ numeros: tabla }); UI.toast(`Tabla de números guardada (${Object.keys(tabla).length} números).`); UI.render();
  };
  document.getElementById('reEnPron').onchange = async (e) => { await Reemp.guardar({ enPronosticos: e.target.checked }); UI.toast(e.target.checked ? 'Los pronósticos mostrarán los números reemplazados.' : 'Los pronósticos ya no muestran reemplazos.'); };
  document.getElementById('reXls').onclick = () => {
    try {
      if (!ReV.resultados) return;
      const aoa = [['NUMERO', 'TIPO', 'REEMPLAZO']];
      for (const r of ReV.resultados) { for (const x of r.cif) aoa.push([r.n, 'CIFRA POR CIFRA', x]); for (const x of r.num) aoa.push([r.n, 'TABLA DE NUMEROS', x]); }
      const wb = XL.book(); XLSX.utils.book_append_sheet(wb, XL.sheet(aoa, [0, 2], [10, 20, 12]), 'REEMPLAZOS'); XL.save(wb, `PERLA3_REEMPLAZOS_${U.stamp()}.xlsx`);
    } catch (err) { UI.toast(err.message, 'err'); }
  };
  if (ReV.texto) mostrar();
};
