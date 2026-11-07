/* =====================================================================
   ACTUALIZACIÓN AUTOMÁTICA
   · Auto: cada vez que entran resultados nuevos (por cualquier vía) se
     recalcula todo en segundo plano: prueba histórica cronológica de los
     sorteos recientes de esa lotería + pronóstico de los 3 algoritmos
     para el próximo sorteo. Al terminar se refrescan las pantallas.
   · EnLinea: al abrir la aplicación descarga los resultados nuevos de
     fuentes oficiales con acceso libre (datos.gov.co).
   · DatosIncluidos: si el archivo HTML trae un histórico incorporado,
     se carga solo la primera vez.
   · Importación rápida: botón «Importar archivo» siempre visible y
     posibilidad de soltar un archivo sobre cualquier pantalla.
   ===================================================================== */
const Auto = {
  cola: new Map(),      // loteriaId -> Set(fechas)
  timer: null, running: false, estado: '',
  encolar(items) {
    if (!Store.config.autoActualizar) return;
    for (const { loteriaId, fecha } of items) {
      if (!this.cola.has(loteriaId)) this.cola.set(loteriaId, new Set());
      this.cola.get(loteriaId).add(fecha);
    }
    clearTimeout(this.timer);
    this.timer = setTimeout(() => this.run(), 400);
  },
  pintar(txt) {
    this.estado = txt;
    const el = document.getElementById('autoState');
    if (el) { el.textContent = txt; el.hidden = !txt; }
  },
  async run() {
    if (this.running) return;
    this.running = true;
    let total = 0;
    try {
      while (this.cola.size) {
        const lotes = [...this.cola.entries()]; this.cola.clear();
        let i = 0;
        for (const [loteriaId, fechas] of lotes) {
          i++;
          if (!Store.loteria(loteriaId)) continue;
          const nombre = Store.loteriaNombre(loteriaId);
          const todos = Store.resultadosDe(loteriaId);
          const N = Math.max(10, +Store.config.autoSorteos || 100);
          const nuevas = [...fechas].sort();
          // Se evalúan los sorteos nuevos, como máximo los N más recientes de la lotería
          const desdeN = todos.length > N ? todos[todos.length - N].fecha : (todos[0]?.fecha || '');
          const desde = nuevas[0] > desdeN ? nuevas[0] : desdeN;
          const hasta = nuevas[nuevas.length - 1];
          this.pintar(`⟳ Actualizando ${nombre} (${i}/${lotes.length})…`);
          if (todos.length > (+Store.config.btMinHist || 30)) {
            const r = await Algo.backtest({
              loteriaId, desde, hasta, k: +Store.config.btCantidad || 10, minHist: +Store.config.btMinHist || 30,
              onProgress: (x) => this.pintar(`⟳ Actualizando ${nombre} (${i}/${lotes.length}) ${Math.round(x * 100)}%`),
            });
            total += r.generados;
          }
          if (Store.loteria(loteriaId) && todos.length >= Algo.MIN_HIST) await this.pronosticoProximo(loteriaId);
        }
      }
      Store.setMeta('ultimaActualizacionAuto', new Date().toISOString());
    } catch (err) { console.error(err); UI.toast('La actualización automática falló: ' + err.message, 'err'); }
    this.running = false;
    this.pintar('');
    Cache.clear();
    // Refresca la pantalla actual si muestra datos (no interrumpe formularios ni importaciones en curso)
    const refrescar = ['inicio', 'historico', 'estadisticas', 'cifras', 'comparador'].includes(UI.current) || (UI.current === 'aciertos' && !AcV.running);
    const escribiendo = document.activeElement && ['INPUT', 'TEXTAREA', 'SELECT'].includes(document.activeElement.tagName);
    if (refrescar && !escribiendo && !document.querySelector('.modal-bg')) UI.render();
    if (total) UI.toast(`Análisis actualizado: ${total} pronósticos de prueba histórica y pronósticos del próximo sorteo listos.`);
  },
  /** Al abrir: prepara el pronóstico del próximo sorteo de cada lotería si todavía no existe. */
  alAbrir() {
    if (!Store.config.autoActualizar) return;
    const items = [];
    for (const l of Store.loterias) {
      const rs = Store.resultadosDe(l.id);
      if (rs.length < Algo.MIN_HIST) continue;
      const prox = nextDrawDate(l.id);
      if (!Store.pronosticos.some(p => p.origen === 'auto' && p.loteriaId === l.id && p.fechaObjetivo === prox)) items.push({ loteriaId: l.id, fecha: rs[rs.length - 1].fecha });
    }
    if (items.length) this.encolar(items);
  },
  /** Pronóstico de los 3 algoritmos para el próximo sorteo (reemplaza el automático pendiente de esa fecha). */
  async pronosticoProximo(loteriaId) {
    const fecha = nextDrawDate(loteriaId), k = +Store.config.cantidadDefecto || 10;
    const lista = [1, 2, 3].map(alg => {
      const p = Algo.generar({ alg, loteriaId, fechaObjetivo: fecha, k, origen: 'auto' });
      const prev = Store.pronosticos.find(x => x.origen === 'auto' && x.loteriaId === loteriaId && x.algoritmo === alg && x.fechaObjetivo === fecha);
      if (prev) p.id = prev.id;
      return p;
    });
    await Store.savePronosticos(lista);
  },
};

/* ------------------- Actualización en línea (fuentes oficiales) ------------------- */
const EnLinea = {
  // Santander: el conjunto oficial no trae fecha; el sorteo 5095 fue el viernes 06/11/2026 y se juega cada viernes.
  SANT_ANCLA: { sorteo: 5095, fecha: '2026-11-06' },
  fuentes: [
    {
      nombre: 'Lotería de Medellín', id: '4w3i-wxax',
      url: (desde) => `https://www.datos.gov.co/resource/4w3i-wxax.json?$where=${encodeURIComponent(`fecha > '${desde}T00:00:00'`)}&$order=fecha&$limit=1000`,
      map: (x) => ({ fecha: String(x.fecha).slice(0, 10), numero: x.n_mero }),
    },
    {
      nombre: 'Lotería de Santander', id: '4zwu-ra3f',
      url: () => `https://www.datos.gov.co/resource/4zwu-ra3f.json?$where=${encodeURIComponent(`premio like 'PREMIO MAYOR%' AND sorteo::number >= ${EnLinea.SANT_ANCLA.sorteo}`)}&$order=${encodeURIComponent('sorteo::number DESC')}&$limit=200`,
      map: (x) => {
        const s = +x.sorteo, a = EnLinea.SANT_ANCLA;
        if (!(s >= a.sorteo)) return null;
        return { fecha: U.addDays(a.fecha, 7 * (s - a.sorteo)), numero: x.numero };
      },
    },
  ],
  ultimo: null,
  async actualizar({ silencioso = true, crear = false } = {}) {
    if (!navigator.onLine) { if (!silencioso) UI.toast('Sin conexión a internet.', 'warn'); return null; }
    const res = []; let nuevos = 0;
    for (const f of this.fuentes) {
      let lot = Store.findLoteriaByName(f.nombre);
      if (!lot && !crear) continue;
      try {
        const ctrl = new AbortController(); const to = setTimeout(() => ctrl.abort(), 15000);
        const ult = lot ? Store.resultadosDe(lot.id).slice(-1)[0]?.fecha : null;
        const r = await fetch(f.url(ult || '2000-01-01'), { signal: ctrl.signal, headers: { Accept: 'application/json' } });
        clearTimeout(to);
        if (!r.ok) throw new Error('HTTP ' + r.status);
        const datos = await r.json();
        const max = U.addDays(U.todayISO(), 1);
        const filas = datos.map(f.map).filter(Boolean)
          .map(x => ({ fecha: x.fecha, numero: U.normNum(x.numero, { ultimas3: true }) }))
          .filter(x => x.numero && U.isISO(x.fecha) && x.fecha <= max && (!ult || x.fecha > ult));
        if (filas.length) {
          if (!lot) lot = await Store.saveLoteria({ nombre: f.nombre, descripcion: 'Actualizada desde datos.gov.co (' + f.id + ')' });
          const b = await Store.bulkResultados(filas.map(x => ({ ...x, loteriaId: lot.id })), 'omitir');
          nuevos += b.nuevos; res.push(`${f.nombre}: ${b.nuevos}`);
        }
      } catch (err) { console.warn('Actualización en línea', f.nombre, err); if (!silencioso) UI.toast(`No se pudo actualizar ${f.nombre}: ${err.message}`, 'warn'); }
    }
    this.ultimo = { fecha: new Date().toISOString(), nuevos, detalle: res };
    await Store.setMeta('ultimaActualizacionEnLinea', this.ultimo);
    if (nuevos) UI.toast(`Resultados nuevos descargados de datos.gov.co: ${res.join(' · ')}.`, 'ok', 7000);
    else if (!silencioso) UI.toast('Todo al día: no hay resultados nuevos en las fuentes oficiales.');
    return this.ultimo;
  },
};

/* ------------------- Histórico incorporado en el archivo HTML ------------------- */
const DatosIncluidos = {
  async cargar() {
    const D = window.P3_DATOS_INCLUIDOS;
    if (!D || !Array.isArray(D.registros) || Store.meta.datosIncluidos === D.id) return null;
    UI.toast(`Cargando el histórico incluido (${U.fmt(D.registros.length)} resultados)…`, 'ok', 5000);
    const nombres = new Map();
    for (const [, nombre] of D.registros) if (!nombres.has(U.normText(nombre))) nombres.set(U.normText(nombre), nombre);
    for (const nombre of nombres.values()) if (!Store.findLoteriaByName(nombre)) await Store.saveLoteria({ nombre, descripcion: 'Histórico incluido: ' + (D.descripcion || D.id) });
    const filas = [];
    for (const [fecha, nombre, numero] of D.registros) {
      const n = U.normNum(numero), l = Store.findLoteriaByName(nombre);
      if (n && l && U.isISO(fecha)) filas.push({ fecha, loteriaId: l.id, numero: n });
    }
    const r = await Store.bulkResultados(filas, 'omitir');
    await Store.setMeta('datosIncluidos', D.id);
    UI.toast(`Histórico incluido cargado: ${r.nuevos} resultados nuevos (${r.omitidos} ya estaban). El análisis se actualiza solo.`, 'ok', 8000);
    UI.render();
    return r;
  },
};

/* ------------------- Importación rápida desde cualquier pantalla ------------------- */
const ImportRapido = {
  init() {
    const top = document.querySelector('.topbar-right');
    const st = document.createElement('span'); st.id = 'autoState'; st.className = 'save-state busy'; st.hidden = true;
    const btn = document.createElement('button'); btn.className = 'btn gold sm'; btn.id = 'btnImportar'; btn.textContent = '⇪ Importar archivo';
    btn.title = 'Elija un archivo Excel o CSV: se guarda y se analiza automáticamente';
    const inp = document.createElement('input'); inp.type = 'file'; inp.accept = '.xlsx,.xls,.csv,.txt'; inp.hidden = true; inp.id = 'globalFile';
    const bt = document.createElement('button'); bt.className = 'btn sm'; bt.id = 'btnTema'; bt.textContent = '🎨'; bt.title = 'Cambiar colores (temas, blanco, negro o personalizados)';
    bt.onclick = () => Tema.abrirRapido();
    top.prepend(inp); top.prepend(st); top.prepend(bt); top.prepend(btn);
    btn.onclick = () => inp.click();
    inp.onchange = (e) => { const f = e.target.files[0]; e.target.value = ''; if (f) this.archivo(f); };
    // Soltar un archivo en cualquier parte de la aplicación
    let veil = null;
    const show = (on) => {
      if (on && !veil) { veil = document.createElement('div'); veil.className = 'drop-veil'; veil.innerHTML = '<div>⇪<br>Suelte el archivo para importarlo y analizarlo</div>'; document.body.appendChild(veil); }
      if (!on && veil) { veil.remove(); veil = null; }
    };
    window.addEventListener('dragover', (e) => { if ([...(e.dataTransfer?.types || [])].includes('Files')) { e.preventDefault(); show(true); } });
    window.addEventListener('dragleave', (e) => { if (!e.relatedTarget || e.relatedTarget === document.documentElement) show(false); });
    window.addEventListener('drop', (e) => {
      if (!e.dataTransfer?.files?.length) return;
      e.preventDefault(); show(false);
      if (e.target.closest && e.target.closest('#iaDrop')) return; // la zona propia del módulo ya lo procesa
      this.archivo(e.dataTransfer.files[0]);
    });
  },
  archivo(file) {
    IA.tab = 'archivo'; IA.result = null;
    if (UI.current !== 'importar') UI.go('importar');
    iaLeerArchivo(file);
  },
};
