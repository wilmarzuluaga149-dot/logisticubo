/* =====================================================================
   Base de datos local (IndexedDB) + estado en memoria
   Estrategia: todos los registros se cargan en memoria al iniciar y cada
   cambio se escribe inmediatamente en IndexedDB (guardado automático).
   Si IndexedDB no está disponible se usa localStorage como respaldo.
   ===================================================================== */
const STORES = ['loterias', 'resultados', 'pronosticos', 'config', 'meta'];

const DEFAULT_CONFIG = {
  // Reglas de aciertos
  combinadoIncluyeDirecto: false,   // si true, un acierto directo también cuenta como combinado
  combinadoConRepetidas: true,      // si false, números con cifras repetidas (ej. 337) no participan en combinado
  // Fuente de datos para los algoritmos
  fuenteDatos: 'loteria',           // 'loteria' = solo la misma lotería | 'todas' = todas las loterías
  cantidadDefecto: 10,
  // Algoritmo 1
  a1Ventana: 30,                    // sorteos recientes
  // Algoritmo 2
  a2Ventana: 120,                   // sorteos usados para ciclos/intervalos
  // Algoritmo 3 (pesos editables)
  a3Pesos: { frecuencia: 20, tendencia: 20, posiciones: 20, parejas: 15, ternas: 10, ausencias: 15 },
  a3VidaMedia: 25,                  // sorteos (ponderación exponencial)
  a3Ventana: 40,
  // Importación
  formatoFecha: 'dmy',
  ultimas3: false,
  // Prueba histórica
  btCantidad: 10,
  btMinHist: 30,
  // Actualización automática
  autoActualizar: true,             // tras cada dato nuevo: prueba histórica + pronóstico del próximo sorteo
  autoSorteos: 100,                 // sorteos recientes por lotería que se evalúan automáticamente
  importarDirecto: true,            // al elegir/arrastrar un archivo se importa sin pasar por la revisión
  actualizarEnLinea: true,          // al abrir, descarga resultados nuevos de fuentes oficiales (datos.gov.co)
};

const DB = {
  idb: null,
  mode: 'idb',          // 'idb' | 'local' | 'memory'
  async open() {
    if (!('indexedDB' in window)) { this.mode = 'local'; return; }
    try {
      this.idb = await new Promise((res, rej) => {
        const rq = indexedDB.open(DB_NAME, DB_VERSION);
        rq.onupgradeneeded = (e) => {
          // Migraciones no destructivas: solo se crean almacenes que falten.
          const db = rq.result;
          if (!db.objectStoreNames.contains('loterias')) db.createObjectStore('loterias', { keyPath: 'id' });
          if (!db.objectStoreNames.contains('resultados')) {
            const s = db.createObjectStore('resultados', { keyPath: 'id' });
            s.createIndex('lot_fecha', ['loteriaId', 'fecha'], { unique: true });
          }
          if (!db.objectStoreNames.contains('pronosticos')) {
            const s = db.createObjectStore('pronosticos', { keyPath: 'id' });
            s.createIndex('loteria', 'loteriaId');
          }
          if (!db.objectStoreNames.contains('config')) db.createObjectStore('config', { keyPath: 'clave' });
          if (!db.objectStoreNames.contains('meta')) db.createObjectStore('meta', { keyPath: 'clave' });
        };
        rq.onsuccess = () => res(rq.result);
        rq.onerror = () => rej(rq.error);
        rq.onblocked = () => rej(new Error('La base de datos está bloqueada por otra pestaña.'));
      });
      this.idb.onversionchange = () => { this.idb.close(); UI.toast('La aplicación se actualizó en otra pestaña. Recargue la página.', 'warn'); };
    } catch (err) {
      console.warn('IndexedDB no disponible, usando localStorage', err);
      this.mode = 'local';
    }
  },
  async getAll(store) {
    if (this.mode === 'idb') {
      return new Promise((res, rej) => {
        const rq = this.idb.transaction(store, 'readonly').objectStore(store).getAll();
        rq.onsuccess = () => res(rq.result || []); rq.onerror = () => rej(rq.error);
      });
    }
    try { return JSON.parse(localStorage.getItem(DB_NAME + ':' + store) || '[]'); } catch { return []; }
  },
  /** Escribe/borra en lote dentro de una transacción. ops: [{store, put?:obj, del?:key, clear?:true}] */
  async write(ops) {
    if (!ops.length) return;
    Store.setSaving('busy');
    try {
      if (this.mode === 'idb') {
        const names = [...new Set(ops.map(o => o.store))];
        await new Promise((res, rej) => {
          const tx = this.idb.transaction(names, 'readwrite');
          for (const o of ops) {
            const s = tx.objectStore(o.store);
            if (o.clear) s.clear(); else if (o.del !== undefined) s.delete(o.del); else s.put(o.put);
          }
          tx.oncomplete = res; tx.onerror = () => rej(tx.error); tx.onabort = () => rej(tx.error || new Error('Transacción abortada'));
        });
      } else if (this.mode === 'local') {
        const names = [...new Set(ops.map(o => o.store))];
        for (const n of names) localStorage.setItem(DB_NAME + ':' + n, JSON.stringify(Store.rawStore(n)));
      }
      Store.setSaving('ok');
    } catch (err) {
      console.error(err);
      Store.setSaving('err');
      UI.toast('Error al guardar: ' + (err && err.message || err) + '. Descargue una copia de seguridad.', 'err');
      throw err;
    }
  },
};

/* --------------------- Estado en memoria --------------------- */
const Store = {
  loterias: [], resultados: [], pronosticos: [], config: { ...DEFAULT_CONFIG }, meta: {},
  _byKey: new Map(),     // `${loteriaId}|${fecha}` -> resultado
  _listeners: [],
  rawStore(n) {
    if (n === 'config') return Object.entries(this.config).map(([clave, valor]) => ({ clave, valor }));
    if (n === 'meta') return Object.entries(this.meta).map(([clave, valor]) => ({ clave, valor }));
    return this[n];
  },
  async load() {
    await DB.open();
    const [l, r, p, c, m] = await Promise.all(STORES.map(s => DB.getAll(s)));
    this.loterias = l; this.resultados = r; this.pronosticos = p;
    this.config = { ...DEFAULT_CONFIG };
    for (const { clave, valor } of c) this.config[clave] = valor;
    this.config.a3Pesos = { ...DEFAULT_CONFIG.a3Pesos, ...(this.config.a3Pesos || {}) };
    this.meta = {}; for (const { clave, valor } of m) this.meta[clave] = valor;
    this.reindex();
    if (!this.meta.creado) await this.setMeta('creado', new Date().toISOString());
    await this.setMeta('ultimaVersion', APP_VERSION);
    if (navigator.storage && navigator.storage.persist) { try { await navigator.storage.persist(); } catch { } }
  },
  reindex() {
    this.resultados.sort((a, b) => (a.fecha < b.fecha ? -1 : a.fecha > b.fecha ? 1 : a.loteriaId - b.loteriaId));
    this._byKey = new Map(this.resultados.map(r => [r.loteriaId + '|' + r.fecha, r]));
    this.loterias.sort((a, b) => a.nombre.localeCompare(b.nombre, 'es'));
    Cache.clear();
  },
  onChange(fn) { this._listeners.push(fn); },
  changed() { this.reindex(); this._listeners.forEach(f => { try { f(); } catch (e) { console.error(e); } }); },
  setSaving(s) {
    const el = document.getElementById('saveState'); if (!el) return;
    el.className = 'save-state ' + (s === 'busy' ? 'busy' : s === 'err' ? 'err' : '');
    el.textContent = s === 'busy' ? '● Guardando…' : s === 'err' ? '● Error al guardar' : (DB.mode === 'idb' ? '● Guardado' : '● Guardado (modo local)');
  },
  nextId(arr) { let m = 0; for (const x of arr) if (x.id > m) m = x.id; return m + 1; },

  /* ---------- Loterías ---------- */
  loteria(id) { return this.loterias.find(l => l.id === id); },
  loteriaNombre(id) { const l = this.loteria(id); return l ? l.nombre : '¿?'; },
  findLoteriaByName(nombre) { const k = U.normText(nombre); return this.loterias.find(l => U.normText(l.nombre) === k); },
  async saveLoteria(data) {
    const nombre = String(data.nombre || '').trim();
    if (!nombre) throw new Error('El nombre de la lotería es obligatorio.');
    if (nombre.length > 60) throw new Error('El nombre es demasiado largo (máx. 60).');
    const dup = this.findLoteriaByName(nombre);
    if (dup && dup.id !== data.id) throw new Error('Ya existe una lotería con ese nombre.');
    let rec;
    if (data.id) { rec = this.loteria(data.id); Object.assign(rec, { nombre, descripcion: data.descripcion || '', sorteo: data.sorteo || '', ejemplo: !!data.ejemplo }); }
    else { rec = { id: this.nextId(this.loterias), nombre, descripcion: data.descripcion || '', sorteo: data.sorteo || '', ejemplo: !!data.ejemplo, creada: new Date().toISOString() }; this.loterias.push(rec); }
    await DB.write([{ store: 'loterias', put: rec }]);
    this.changed();
    return rec;
  },
  async deleteLoteria(id) {
    const ops = [{ store: 'loterias', del: id }];
    for (const r of this.resultados) if (r.loteriaId === id) ops.push({ store: 'resultados', del: r.id });
    for (const p of this.pronosticos) if (p.loteriaId === id) ops.push({ store: 'pronosticos', del: p.id });
    this.loterias = this.loterias.filter(l => l.id !== id);
    this.resultados = this.resultados.filter(r => r.loteriaId !== id);
    this.pronosticos = this.pronosticos.filter(p => p.loteriaId !== id);
    await DB.write(ops);
    this.changed();
  },

  /* ---------- Resultados ---------- */
  resultadoDe(loteriaId, fecha) { return this._byKey.get(loteriaId + '|' + fecha); },
  validarResultado({ fecha, loteriaId, numero }) {
    const f = U.parseDate(fecha);
    if (!f) throw new Error('Fecha inválida.');
    if (f > U.addDays(U.todayISO(), 1)) throw new Error('La fecha no puede estar en el futuro.');
    if (!this.loteria(loteriaId)) throw new Error('Seleccione una lotería válida.');
    const n = U.normNum(numero);
    if (!n) throw new Error('El número debe tener entre 1 y 3 cifras (000–999).');
    return { fecha: f, loteriaId, numero: n };
  },
  async saveResultado(data) {
    const v = this.validarResultado(data);
    const dup = this.resultadoDe(v.loteriaId, v.fecha);
    if (dup && dup.id !== data.id) throw new Error(`Ya existe un resultado de ${this.loteriaNombre(v.loteriaId)} el ${U.fmtDate(v.fecha)} (${dup.numero}).`);
    let rec;
    if (data.id) { rec = this.resultados.find(r => r.id === data.id); Object.assign(rec, v, { editado: new Date().toISOString() }); }
    else { rec = { id: this.nextId(this.resultados), ...v, creado: new Date().toISOString() }; this.resultados.push(rec); }
    await DB.write([{ store: 'resultados', put: rec }]);
    this.changed();
    this.avisarNuevos([rec]);
    return rec;
  },
  async deleteResultado(id) {
    this.resultados = this.resultados.filter(r => r.id !== id);
    await DB.write([{ store: 'resultados', del: id }]);
    this.changed();
  },
  /** Inserción masiva. rows: [{fecha, loteriaId, numero}] ya validados. modo: 'omitir' | 'reemplazar' */
  async bulkResultados(rows, modo = 'omitir') {
    let nuevos = 0, reemplazados = 0, omitidos = 0; const ops = [];
    let next = this.nextId(this.resultados);
    for (const r of rows) {
      const dup = this.resultadoDe(r.loteriaId, r.fecha);
      if (dup) {
        if (modo === 'reemplazar' && dup.numero !== r.numero) { dup.numero = r.numero; dup.editado = new Date().toISOString(); ops.push({ store: 'resultados', put: dup }); reemplazados++; }
        else omitidos++;
        continue;
      }
      const rec = { id: next++, fecha: r.fecha, loteriaId: r.loteriaId, numero: r.numero, creado: new Date().toISOString() };
      this.resultados.push(rec); this._byKey.set(rec.loteriaId + '|' + rec.fecha, rec);
      ops.push({ store: 'resultados', put: rec }); nuevos++;
    }
    await DB.write(ops);
    this.changed();
    this.avisarNuevos(ops.map(o => o.put));
    return { nuevos, reemplazados, omitidos };
  },
  /** Avisa al motor automático de los resultados nuevos o cambiados. */
  avisarNuevos(recs) {
    if (typeof Auto !== 'undefined' && recs.length) Auto.encolar(recs.map(r => ({ loteriaId: r.loteriaId, fecha: r.fecha })));
  },
  resultadosDe(loteriaId, { desde, hasta } = {}) {
    return this.resultados.filter(r => (loteriaId == null || r.loteriaId === loteriaId) && (!desde || r.fecha >= desde) && (!hasta || r.fecha <= hasta));
  },

  /* ---------- Pronósticos ---------- */
  async savePronosticos(list) {
    const ops = []; let next = this.nextId(this.pronosticos);
    for (const p of list) {
      if (!p.id) p.id = next++;
      const i = this.pronosticos.findIndex(x => x.id === p.id);
      if (i >= 0) this.pronosticos[i] = p; else this.pronosticos.push(p);
      ops.push({ store: 'pronosticos', put: p });
    }
    await DB.write(ops);
    Cache.clear();
    this._listeners.forEach(f => { try { f(); } catch (e) { console.error(e); } });
  },
  async deletePronosticos(ids) {
    const set = new Set(ids);
    this.pronosticos = this.pronosticos.filter(p => !set.has(p.id));
    await DB.write(ids.map(id => ({ store: 'pronosticos', del: id })));
    this.changed();
  },

  /* ---------- Configuración / meta ---------- */
  async setConfig(clave, valor) { this.config[clave] = valor; await DB.write([{ store: 'config', put: { clave, valor } }]); Cache.clear(); },
  async setMeta(clave, valor) { this.meta[clave] = valor; await DB.write([{ store: 'meta', put: { clave, valor } }]); },

  /* ---------- Copias de seguridad ---------- */
  exportJSON() {
    return {
      app: 'PERLA 3 CIFRAS PRO', formato: 'perla3-backup', version: APP_VERSION, fecha: new Date().toISOString(),
      loterias: this.loterias, resultados: this.resultados, pronosticos: this.pronosticos,
      config: this.config, meta: this.meta,
    };
  },
  validarBackup(obj) {
    if (!obj || obj.formato !== 'perla3-backup') throw new Error('El archivo no es una copia de seguridad de PERLA 3 CIFRAS PRO.');
    for (const k of ['loterias', 'resultados', 'pronosticos']) if (!Array.isArray(obj[k])) throw new Error('Copia incompleta: falta "' + k + '".');
    const lotIds = new Set(obj.loterias.map(l => l.id));
    const errores = [];
    obj.resultados.forEach((r, i) => {
      if (!lotIds.has(r.loteriaId) || !U.isISO(r.fecha) || !/^\d{3}$/.test(r.numero)) errores.push(i);
    });
    if (errores.length) throw new Error(`La copia contiene ${errores.length} resultados inválidos (ej. fila ${errores[0] + 1}).`);
    return true;
  },
  async restoreJSON(obj) {
    this.validarBackup(obj);
    const ops = STORES.map(s => ({ store: s, clear: true }));
    this.loterias = obj.loterias; this.resultados = obj.resultados; this.pronosticos = obj.pronosticos;
    this.config = { ...DEFAULT_CONFIG, ...(obj.config || {}) };
    this.config.a3Pesos = { ...DEFAULT_CONFIG.a3Pesos, ...(this.config.a3Pesos || {}) };
    this.meta = { ...(obj.meta || {}), restaurado: new Date().toISOString() };
    for (const s of ['loterias', 'resultados', 'pronosticos']) for (const x of this[s]) ops.push({ store: s, put: x });
    for (const x of this.rawStore('config')) ops.push({ store: 'config', put: x });
    for (const x of this.rawStore('meta')) ops.push({ store: 'meta', put: x });
    await DB.write(ops);
    this.changed();
  },
  async borrarTodo() {
    this.loterias = []; this.resultados = []; this.pronosticos = [];
    this.config = { ...DEFAULT_CONFIG, a3Pesos: { ...DEFAULT_CONFIG.a3Pesos } };
    await DB.write(STORES.filter(s => s !== 'meta').map(s => ({ store: s, clear: true })));
    this.changed();
  },
};

/* Caché de cálculos costosos (se invalida con cada cambio de datos). */
const Cache = {
  m: new Map(),
  get(key, fn) { if (!this.m.has(key)) this.m.set(key, fn()); return this.m.get(key); },
  clear() { this.m.clear(); },
};
