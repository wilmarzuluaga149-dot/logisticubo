/* =====================================================================
   PEGAR RESULTADOS COPIADOS DE LA PÁGINA
   Entiende el texto tal como se copia de las páginas de resultados
   (ganarchance.com, La Perla, astroluna, periódicos):
       Culona
       6752
       Paisita día
       3711La 5ta: 6
       Boyaca
       1552
       312            ← serie (se ignora)
       Astro sol
       8953
       Sagitario      ← signo (se ignora)
   · Línea con letras = nombre de la lotería; la siguiente línea que empieza
     con números = el resultado (se toman las 3 últimas cifras).
   · «La 5ta», serie y signo se ignoran.
   · Si el texto trae «Resultados de hoy domingo 8 de noviembre de 2026»
     o «Resultados de ayer sábado 7 de noviembre de 2026», se usa esa fecha;
     si no, la fecha elegida (hoy por defecto).
   ===================================================================== */
const Pagina = {
  MESES: { enero: 1, febrero: 2, marzo: 3, abril: 4, mayo: 5, junio: 6, julio: 7, agosto: 8, septiembre: 9, setiembre: 9, octubre: 10, noviembre: 11, diciembre: 12 },
  SIGNOS: ['aries', 'tauro', 'geminis', 'cancer', 'leo', 'virgo', 'libra', 'escorpion', 'escorpio', 'sagitario', 'capricornio', 'acuario', 'piscis'],
  /** Nombres como aparecen en las páginas → nombre usado en la aplicación. */
  ALIAS: {
    'culona': 'Culona Día', 'culona dia': 'Culona Día', 'la culona dia': 'Culona Día', 'la culona': 'Culona Día', 'culona noche': 'Culona Noche',
    'dorado manana': 'Dorado Mañana', 'dorado tarde': 'Dorado Tarde', 'dorado noche': 'Dorado Noche',
    'astro sol': 'Astro Sol', 'super astro sol': 'Astro Sol', 'astro luna': 'Astro Luna', 'super astro luna': 'Astro Luna',
    'pijao de oro': 'Pijao de Oro', 'pijao oro': 'Pijao de Oro', 'pijao noche': 'Pijao Noche',
    'paisita dia': 'Paisita Día', 'paisita 1': 'Paisita Día', 'paisita noche': 'Paisita Noche', 'paisita 2': 'Paisita Noche',
    'paisita 3': 'Paisita Tres', 'paisita tres': 'Paisita Tres', 'paisa lotto': 'Paisita Tres', 'paisita 3 sabado': 'Paisita Tres',
    'chontico dia': 'Chontico Día', 'chontico noche': 'Chontico Noche',
    'cafeterito tarde': 'Cafeterito Tarde', 'cafeterito noche': 'Cafeterito Noche',
    'sinuano dia': 'Sinuano Día', 'sinuano': 'Sinuano Día', 'sinuano noche': 'Sinuano Noche',
    'cash three dia': 'Cash Three Día', 'cash three noche': 'Cash Three Noche', 'play four dia': 'Play Four Día', 'play four noche': 'Play Four Noche',
    'saman dia': 'Samán Día', 'saman': 'Samán Día', 'saman de la suerte': 'Samán Día',
    'caribena dia': 'Caribeña Día', 'caribena noche': 'Caribeña Noche',
    'motilon tarde': 'Motilón Tarde', 'motilon dia': 'Motilón Tarde', 'motilon noche': 'Motilón Noche',
    'fantastica dia': 'Fantástica Día', 'fantastica noche': 'Fantástica Noche',
    'antioquenita dia': 'Antioqueñita Día', 'antioquenita tarde': 'Antioqueñita Tarde',
    'evening': 'Evening', 'win four': 'Win Four', 'cuyabrito': 'Cuyabrito', 'supermillonaria': 'SuperMillonaria',
    'medellin': 'Lotería de Medellín', 'santander': 'Lotería de Santander', 'risaralda': 'Lotería de Risaralda', 'boyaca': 'Lotería de Boyacá',
    'cauca': 'Lotería del Cauca', 'cundinamarca': 'Lotería de Cundinamarca', 'tolima': 'Lotería del Tolima', 'cruz roja': 'Lotería de la Cruz Roja',
    'cruzroja': 'Lotería de la Cruz Roja', 'huila': 'Lotería del Huila', 'valle': 'Lotería del Valle', 'meta': 'Lotería del Meta',
    'manizales': 'Lotería de Manizales', 'bogota': 'Lotería de Bogotá', 'quindio': 'Lotería del Quindío',
  },
  /** Nombre copiado → nombre de la lotería en la aplicación. */
  nombre(txt) {
    let k = U.normText(txt).replace(/[.:]+$/, '').replace(/\s+/g, ' ').trim();
    k = k.replace(/^resultados? (de |del )?/, '').replace(/^loteria (de la |del |de )?/, '');
    if (this.ALIAS[k]) return this.ALIAS[k];
    const existe = Store.loterias.find(l => U.normText(l.nombre) === k || U.normText(l.nombre).replace(/^loteria (de la |del |de )/, '') === k);
    if (existe) return existe.nombre;
    return String(txt).trim().replace(/[.:]+$/, '').split(/\s+/).map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
  },
  fechaDeEncabezado(linea) {
    const m = U.normText(linea).match(/resultados?(?: de)?(?: (?:hoy|ayer))?\s+\w+\s+(\d{1,2}) de (\w+) de (\d{4})/);
    if (!m || !this.MESES[m[2]]) return null;
    return U.isoFromParts(+m[3], this.MESES[m[2]], +m[1]);
  },
  /** Devuelve { registros: [{fecha, loteria, numero, completo}], ignorados: [...] } */
  parsear(txt, fechaDef = U.todayISO()) {
    const lineas = String(txt).split(/\r?\n/).map(l => l.trim()).filter(Boolean);
    const out = [], ignorados = []; let fecha = fechaDef, nombre = null, yaNumero = false;
    for (const l of lineas) {
      const f = this.fechaDeEncabezado(l);
      if (f) { fecha = f; nombre = null; continue; }
      const m = l.match(/^(\d{3,4})(?!\d)(.*)$/);
      if (m) {
        if (nombre && !yaNumero) { out.push({ fecha, loteria: this.nombre(nombre), numero: m[1].slice(-3).padStart(3, '0'), completo: m[1], original: nombre }); yaNumero = true; }
        continue; // serie u otras cifras después del número: se ignoran
      }
      if (/^la\s*5ta/i.test(l) || /^serie/i.test(l) || /^\d{1,2}$/.test(l)) continue;
      const k = U.normText(l);
      if (this.SIGNOS.includes(k)) continue;
      if (/[a-záéíóúñ]/i.test(l) && l.length <= 40 && !/[.!?:]$/.test(l)) {
        if (nombre && !yaNumero) ignorados.push(nombre);
        nombre = l; yaNumero = false;
      } else { if (nombre && !yaNumero) ignorados.push(nombre); nombre = null; }
    }
    // un mismo juego y fecha repetido en el texto: se deja el primero
    const vistos = new Set();
    const registros = out.filter(r => { const key = U.normText(r.loteria) + '|' + r.fecha; if (vistos.has(key)) return false; vistos.add(key); return true; });
    return { registros, ignorados };
  },
  /** Ingresa los resultados pegados: guarda, recalcula y muestra el análisis. */
  async ingresar(txt, fechaDef) {
    const r = this.parsear(txt, fechaDef);
    if (!r.registros.length) { UI.toast('No encontré resultados en el texto. Copie el nombre de la lotería y su número, por ejemplo: «Culona» y debajo «6752».', 'err', 8000); return null; }
    IA.tab = 'pegar'; IA.result = null; IA.pegado = txt;
    if (UI.current !== 'importar') UI.go('importar');
    UI.toast(`Ingresando ${r.registros.length} resultado${r.registros.length > 1 ? 's' : ''} copiados de la página…`, 'ok', 4000);
    await iaEjecutar(r.registros.map(x => ({ fecha: x.fecha, loteria: x.loteria, numero: x.numero })), { guardar: true, modoDup: 'reemplazar' });
    return r;
  },
  /** Recuadro para pegar (se usa en Inicio y en Importar y analizar). */
  html(id = 'pg') {
    return `<div class="card no-print pegar-pagina"><h2>📋 Pegar resultados de la página</h2>
      <div class="sub">Copie los resultados de la página (por ejemplo ganarchance.com) <b>tal como aparecen</b> y péguelos aquí: nombre de la lotería y su número. «La 5ta», la serie y el signo se ignoran solos.</div>
      <textarea id="${id}Txt" placeholder="Culona&#10;6752&#10;Paisita día&#10;3711La 5ta: 6&#10;Chontico día&#10;9037La 5ta: 2"></textarea>
      <div class="toolbar" style="margin-top:8px">
        <label class="field">Fecha (si el texto no la trae)<input type="date" id="${id}Fecha" value="${U.todayISO()}" max="${U.addDays(U.todayISO(), 1)}"></label>
        <button class="btn gold big" id="${id}Go">INGRESAR RESULTADOS</button>
        <button class="btn ghost" data-go="importar">Más opciones (archivo, lista, un resultado)</button>
        <span class="small muted" id="${id}Info"></span>
      </div></div>`;
  },
  bind(id = 'pg') {
    const ta = document.getElementById(id + 'Txt'); if (!ta) return;
    ta.closest('.card').querySelectorAll('[data-go]').forEach(b => b.onclick = () => { IA.tab = 'archivo'; UI.go(b.dataset.go); });
    const info = () => {
      const r = this.parsear(ta.value, UI.val(id + 'Fecha') || U.todayISO());
      document.getElementById(id + 'Info').innerHTML = r.registros.length
        ? `Se reconocen <b>${r.registros.length}</b>: ${r.registros.slice(0, 6).map(x => `${U.esc(x.loteria)} <b class="n3" style="font-size:12px">${x.numero}</b>`).join(' · ')}${r.registros.length > 6 ? ' …' : ''}${r.ignorados.length ? ` <span class="warn">(sin número: ${r.ignorados.slice(0, 3).map(U.esc).join(', ')})</span>` : ''}`
        : (ta.value.trim() ? '<span class="warn">Todavía no reconozco resultados.</span>' : '');
    };
    ta.oninput = U.debounce(info, 200);
    document.getElementById(id + 'Fecha').onchange = info;
    document.getElementById(id + 'Go').onclick = async () => {
      if (!ta.value.trim()) { UI.toast('Pegue primero los resultados copiados de la página.', 'warn'); return; }
      const f = UI.val(id + 'Fecha');
      if (!U.isISO(f)) { UI.toast('Fecha inválida.', 'err'); return; }
      await this.ingresar(ta.value, f);
    };
    info();
  },
};
