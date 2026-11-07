/* =====================================================================
   Infraestructura de interfaz: menú, navegación, modales, avisos, gráficos
   ===================================================================== */
const COLORS = { a1: '#b38b12', a2: '#4f86f0', a3: '#109c6a', gold: '#d9b54a', green: '#2fbf7f', grid: 'rgba(148,170,205,.12)', ink2: '#a9b6ca', muted: '#7486a1', ref: '#e5586b' };
const ALG_COLOR = { 1: COLORS.a1, 2: COLORS.a2, 3: COLORS.a3 };

const MENU = [
  { grp: 'General' },
  { id: 'inicio', ico: '◈', t: 'Inicio / Panel principal' },
  { id: 'loterias', ico: '▣', t: 'Loterías' },
  { id: 'historico', ico: '☰', t: 'Histórico de resultados' },
  { id: 'importar', ico: '⇪', t: 'Importar y analizar' },
  { grp: 'Análisis' },
  { id: 'estadisticas', ico: '▤', t: 'Estadísticas' },
  { id: 'cifras', ico: '◫', t: 'Análisis de cifras' },
  { grp: 'Pronósticos' },
  { id: 'generar', ico: '✦', t: 'Generar pronósticos' },
  { id: 'alg1', ico: '①', t: 'Algoritmo 1' },
  { id: 'alg2', ico: '②', t: 'Algoritmo 2' },
  { id: 'alg3', ico: '③', t: 'Algoritmo 3' },
  { grp: 'Rendimiento' },
  { id: 'aciertos', ico: '✔', t: 'Control de aciertos' },
  { id: 'comparador', ico: '⇆', t: 'Comparador de algoritmos' },
  { id: 'informes', ico: '▦', t: 'Informes' },
  { grp: 'Datos' },
  { id: 'excel', ico: '⊞', t: 'Excel' },
  { id: 'config', ico: '⚙', t: 'Configuración' },
  { id: 'ayuda', ico: '?', t: 'Ayuda' },
];

const UI = {
  current: 'inicio',
  charts: [],
  views: {},
  ctxLoteria: null,   // null = todas

  init() {
    const menu = document.getElementById('menu');
    let n = 0;
    menu.innerHTML = MENU.map(m => m.grp ? `<div class="grp">${m.grp}</div>` :
      `<button data-view="${m.id}"><span class="ico">${m.ico}</span><span>${m.t}</span><span class="num">${String(++n).padStart(2, '0')}</span></button>`).join('');
    menu.addEventListener('click', e => { const b = e.target.closest('button[data-view]'); if (b) UI.go(b.dataset.view); });
    document.getElementById('btnMenu').onclick = () => UI.drawer(true);
    document.getElementById('scrim').onclick = () => UI.drawer(false);
    const ctx = document.getElementById('ctxLoteria');
    ctx.onchange = () => { UI.ctxLoteria = ctx.value === '' ? null : +ctx.value; try { localStorage.setItem('p3:ctx', ctx.value); } catch { } UI.render(); };
    try { const v = localStorage.getItem('p3:ctx'); if (v) UI.ctxLoteria = +v; } catch { }
    window.addEventListener('hashchange', () => { const v = location.hash.slice(1); if (v && v !== UI.current && UI.views[v]) UI.go(v, false); });
    Store.onChange(() => UI.refreshCtx());
    UI.refreshCtx();
    UI.footer();
    const start = location.hash.slice(1);
    UI.go(UI.views[start] ? start : 'inicio', false);
  },
  footer() {
    document.getElementById('sidebarFoot').innerHTML = `Versión ${APP_VERSION} · ${APP_BUILD}<br>Almacenamiento: ${DB.mode === 'idb' ? 'IndexedDB' : 'localStorage'}`;
  },
  drawer(open) {
    document.getElementById('sidebar').classList.toggle('open', open);
    document.getElementById('scrim').hidden = !open;
  },
  refreshCtx() {
    const ctx = document.getElementById('ctxLoteria');
    if (UI.ctxLoteria !== null && !Store.loteria(UI.ctxLoteria)) UI.ctxLoteria = null;
    ctx.innerHTML = `<option value="">— Todas las loterías —</option>` + Store.loterias.map(l => `<option value="${l.id}">${U.esc(l.nombre)}</option>`).join('');
    ctx.value = UI.ctxLoteria === null ? '' : String(UI.ctxLoteria);
  },
  go(view, push = true) {
    UI.current = view;
    if (push && location.hash.slice(1) !== view) history.replaceState(null, '', '#' + view);
    document.querySelectorAll('#menu button').forEach(b => b.classList.toggle('active', b.dataset.view === view));
    const m = MENU.find(x => x.id === view);
    document.getElementById('viewTitle').textContent = m ? m.t : '';
    document.title = (m ? m.t + ' · ' : '') + 'PERLA 3 CIFRAS PRO';
    UI.drawer(false);
    UI.render();
    window.scrollTo(0, 0);
  },
  render() {
    UI.charts.forEach(c => { try { c.destroy(); } catch { } }); UI.charts = [];
    const el = document.getElementById('view');
    el.style.animation = 'none'; void el.offsetWidth; el.style.animation = '';
    try { UI.views[UI.current](el); }
    catch (err) { console.error(err); el.innerHTML = `<div class="card"><h2>Error</h2><p class="bad">${U.esc(err.message)}</p><p class="muted">Sus datos no se han perdido. Intente recargar la página.</p></div>`; }
  },

  /* ---------- Helpers de formularios ---------- */
  loteriaOptions(sel, { todas = true, labelTodas = '— Todas —' } = {}) {
    return (todas ? `<option value="">${labelTodas}</option>` : '') + Store.loterias.map(l => `<option value="${l.id}" ${sel === l.id ? 'selected' : ''}>${U.esc(l.nombre)}</option>`).join('');
  },
  val(id) { const e = document.getElementById(id); return e ? e.value : ''; },
  lotVal(id) { const v = UI.val(id); return v === '' ? null : +v; },
  $(sel, root = document) { return root.querySelector(sel); },
  $$(sel, root = document) { return [...root.querySelectorAll(sel)]; },
  num3(n) { return `<span class="n3">${U.esc(n)}</span>`; },
  digits(n) { return `<span class="dg">${n[0]}</span> <span class="dg">${n[1]}</span> <span class="dg">${n[2]}</span>`; },
  algBadge(a) { return `<span class="badge a${a}">A${a}</span>`; },
  empty(msg, action = '') { return `<div class="note">${msg} ${action}</div>`; },
  needData(min = 1, loteriaId = UI.ctxLoteria) {
    const n = Store.resultadosDe(loteriaId).length;
    if (n >= min) return '';
    return `<div class="note warn">No hay suficientes resultados registrados${loteriaId ? ' para esta lotería' : ''} (${n}). Registre resultados en <a href="#historico">Histórico</a>, importe un archivo en <a href="#excel">Excel</a> o cargue los <a href="#config">datos de ejemplo</a>.</div>`;
  },

  /* ---------- Avisos y modales ---------- */
  toast(msg, type = 'ok', ms = 3800) {
    const t = document.createElement('div'); t.className = 'toast ' + (type === 'ok' ? '' : type); t.textContent = msg;
    document.getElementById('toasts').appendChild(t);
    setTimeout(() => t.remove(), ms);
  },
  modal({ title, body, buttons = [], wide = false, onOpen }) {
    return new Promise(resolve => {
      const root = document.getElementById('modalRoot');
      const bg = document.createElement('div'); bg.className = 'modal-bg';
      bg.innerHTML = `<div class="modal ${wide ? 'wide' : ''}" role="dialog" aria-modal="true" aria-label="${U.esc(title)}"><header>${U.esc(title)}</header><div class="body">${body}</div><footer></footer></div>`;
      const foot = bg.querySelector('footer');
      const close = (v) => { bg.remove(); document.removeEventListener('keydown', esc); resolve(v); };
      const esc = (e) => { if (e.key === 'Escape') close(null); };
      buttons.forEach(b => {
        const btn = document.createElement('button'); btn.className = 'btn ' + (b.cls || ''); btn.textContent = b.t;
        btn.onclick = async () => {
          if (b.action) { try { const r = await b.action(bg); if (r === false) return; close(r === undefined ? b.v : r); } catch (err) { UI.toast(err.message, 'err'); } }
          else close(b.v);
        };
        foot.appendChild(btn);
      });
      bg.addEventListener('mousedown', e => { if (e.target === bg) close(null); });
      document.addEventListener('keydown', esc);
      root.appendChild(bg);
      if (onOpen) onOpen(bg);
      const f = bg.querySelector('input,select,textarea,button'); if (f) f.focus();
    });
  },
  confirm(msg, { title = 'Confirmar', ok = 'Aceptar', danger = false } = {}) {
    return UI.modal({ title, body: `<p>${msg}</p>`, buttons: [{ t: 'Cancelar', v: false, cls: 'ghost' }, { t: ok, v: true, cls: danger ? 'danger' : 'gold' }] }).then(v => v === true);
  },

  /* ---------- Gráficos (Chart.js) ---------- */
  chart(canvasId, config) {
    const el = document.getElementById(canvasId);
    if (!el) return null;
    if (typeof Chart === 'undefined') { el.parentElement.innerHTML = '<p class="muted small">Gráfico no disponible (librería Chart.js no cargada). Los datos se muestran en las tablas.</p>'; return null; }
    Chart.defaults.color = COLORS.ink2;
    Chart.defaults.font.family = '"Segoe UI",Roboto,Arial,sans-serif';
    Chart.defaults.borderColor = COLORS.grid;
    const base = {
      responsive: true, maintainAspectRatio: false, animation: { duration: 350 },
      interaction: { mode: 'index', intersect: false },
      plugins: { legend: { labels: { boxWidth: 12, boxHeight: 12, usePointStyle: true } }, tooltip: { backgroundColor: '#0c1626', borderColor: '#2f4363', borderWidth: 1, titleColor: '#e6ecf5', bodyColor: '#e6ecf5', padding: 10 } },
      scales: config.type === 'doughnut' ? undefined : { x: { grid: { display: false } }, y: { beginAtZero: true, grid: { color: COLORS.grid } } },
    };
    config.options = UI.merge(base, config.options || {});
    if (config.type === 'bar') (config.data.datasets || []).forEach(d => { d.borderRadius ??= 4; d.borderSkipped ??= 'start'; d.maxBarThickness ??= 34; });
    if (config.type === 'line') (config.data.datasets || []).forEach(d => { d.borderWidth ??= 2; d.pointRadius ??= 0; d.pointHoverRadius ??= 5; d.tension ??= 0.25; });
    const c = new Chart(el, config); UI.charts.push(c); return c;
  },
  merge(a, b) {
    const out = Array.isArray(a) ? [...a] : { ...a };
    for (const k in b) out[k] = (b[k] && typeof b[k] === 'object' && !Array.isArray(b[k]) && a && typeof a[k] === 'object') ? UI.merge(a[k], b[k]) : b[k];
    return out;
  },
  /** Línea de referencia horizontal (valor teórico) como dataset de línea. */
  refLine(label, value, n) { return { type: 'line', label, data: new Array(n).fill(value), borderColor: COLORS.ref, borderDash: [5, 4], borderWidth: 1.5, pointRadius: 0, fill: false, order: 0 }; },

  /* ---------- Aciertos por sorteo (para el histórico) ---------- */
  drawHits(r, idx = Hits.indexByDraw()) {
    const out = { txt: {}, top: {}, cls: {}, D: [], C: [], has: false };
    for (const a of [1, 2, 3]) {
      const p = idx.get(`${r.loteriaId}|${r.fecha}|${a}`);
      if (!p) { out.txt[a] = ''; out.top[a] = ''; out.cls[a] = ''; continue; }
      out.has = true;
      const ev = Hits.evaluate(p);
      out.top[a] = p.candidatos[0]?.n || '';
      if (ev.estado !== 'evaluado') { out.txt[a] = '—'; out.cls[a] = 'p'; continue; }
      if (ev.directo) { out.txt[a] = 'D#' + ev.rank; out.cls[a] = 'd'; out.D.push('A' + a); }
      else if (ev.combinado) { out.txt[a] = 'C#' + ev.rankC; out.cls[a] = 'c'; out.C.push('A' + a); }
      else { out.txt[a] = ev.mejorPos + '/3'; out.cls[a] = 'p'; }
      if (ev.directo && ev.combinado) out.C.push('A' + a);
    }
    return out;
  },

  /** Selector de periodo reutilizable. */
  periodFields(prefix, { desde = '', hasta = '' } = {}) {
    return `<label class="field">Desde<input type="date" id="${prefix}Desde" value="${desde}"></label>
            <label class="field">Hasta<input type="date" id="${prefix}Hasta" value="${hasta}"></label>`;
  },
  table(head, rows, { cls = '', id = '' } = {}) {
    return `<div class="tbl-wrap ${cls}" ${id ? `id="${id}"` : ''}><table><thead><tr>${head.map(h => typeof h === 'string' ? `<th>${h}</th>` : `<th class="${h.c || ''}">${h.t}</th>`).join('')}</tr></thead><tbody>${rows.join('') || `<tr><td colspan="${head.length}" class="muted">Sin datos.</td></tr>`}</tbody></table></div>`;
  },
};
