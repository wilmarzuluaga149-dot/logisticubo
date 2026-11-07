/* =====================================================================
   TEMAS DE COLOR
   Cada tema se define con 5 colores base (fondo, paneles, texto, acento y
   secundario); el resto de la paleta se deriva automáticamente para que
   textos, bordes, tablas y gráficos mantengan un buen contraste.
   Incluye Blanco, Negro y Blanco y negro (alto contraste).
   ===================================================================== */
const Tema = {
  PRESETS: {
    industrial: { nombre: 'Azul industrial', fondo: '#0b1424', panel: '#131f33', texto: '#e6ecf5', acento: '#d9b54a', secundario: '#2fbf7f' },
    negro: { nombre: 'Negro', fondo: '#000000', panel: '#111111', texto: '#f5f5f5', acento: '#e0b84a', secundario: '#34c785' },
    blanco: { nombre: 'Blanco', fondo: '#f2f4f8', panel: '#ffffff', texto: '#18202c', acento: '#9a7408', secundario: '#0f8a5a' },
    bn: { nombre: 'Blanco y negro (alto contraste)', fondo: '#ffffff', panel: '#ffffff', texto: '#000000', acento: '#000000', secundario: '#333333' },
    grafito: { nombre: 'Grafito', fondo: '#141619', panel: '#1f2226', texto: '#e8eaed', acento: '#c9a227', secundario: '#4ade80' },
    esmeralda: { nombre: 'Esmeralda', fondo: '#05140e', panel: '#0c2219', texto: '#e3f3ea', acento: '#e0b84a', secundario: '#34d399' },
    oceano: { nombre: 'Océano', fondo: '#04141c', panel: '#0a2330', texto: '#e2f1f8', acento: '#4fd1c5', secundario: '#f6ad55' },
    vino: { nombre: 'Vino', fondo: '#14070b', panel: '#241018', texto: '#f5e6ea', acento: '#e2b65a', secundario: '#2fbf9f' },
    arena: { nombre: 'Arena (claro)', fondo: '#f5efe3', panel: '#fffaf0', texto: '#2a2118', acento: '#8a5a00', secundario: '#2f7d4f' },
  },
  actual: null,
  rgb(h) { h = h.replace('#', ''); if (h.length === 3) h = h.split('').map(c => c + c).join(''); return [0, 2, 4].map(i => parseInt(h.slice(i, i + 2), 16)); },
  hex(c) { return '#' + c.map(x => Math.max(0, Math.min(255, Math.round(x))).toString(16).padStart(2, '0')).join(''); },
  mix(a, b, t) { const A = this.rgb(a), B = this.rgb(b); return this.hex(A.map((x, i) => x + (B[i] - x) * t)); },
  rgba(h, a) { return `rgba(${this.rgb(h).join(',')},${a})`; },
  lum(h) { const [r, g, b] = this.rgb(h).map(v => { v /= 255; return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; }); return 0.2126 * r + 0.7152 * g + 0.0722 * b; },
  /** Deriva todas las variables de color a partir de los 5 colores base. */
  derivar({ fondo, panel, texto, acento, secundario }) {
    const oscuro = this.lum(fondo) < 0.35, m = (a, b, t) => this.mix(a, b, t);
    const negro = '#000000', blanco = '#ffffff';
    return {
      oscuro,
      vars: {
        '--bg': fondo, '--bg2': m(fondo, panel, 0.4), '--panel': panel, '--panel2': oscuro ? m(panel, texto, 0.035) : m(panel, fondo, 0.35),
        '--line': m(panel, texto, oscuro ? 0.14 : 0.16), '--line2': m(panel, texto, oscuro ? 0.22 : 0.26), '--rowline': m(panel, texto, oscuro ? 0.08 : 0.09),
        '--graphite': m(fondo, panel, 0.8), '--ink': texto, '--ink2': m(texto, panel, 0.3), '--muted': m(texto, panel, 0.48),
        '--gold': acento, '--gold-d': oscuro ? m(acento, negro, 0.2) : acento, '--green': secundario, '--green-d': m(secundario, negro, 0.22),
        '--input': oscuro ? m(fondo, panel, 0.3) : m(panel, blanco, 0.6), '--btn': m(panel, texto, oscuro ? 0.06 : 0.05), '--btn-h': m(panel, texto, oscuro ? 0.12 : 0.1),
        '--th': m(panel, texto, oscuro ? 0.045 : 0.06), '--hover': this.rgba(texto, oscuro ? 0.06 : 0.05), '--zebra': this.rgba(texto, oscuro ? 0.015 : 0.025),
        '--side1': m(fondo, panel, 0.3), '--side2': m(fondo, panel, 0.6), '--topbar': this.rgba(fondo, 0.9),
        '--bodyglow': m(fondo, panel, 0.8), '--bodyend': m(fondo, negro, oscuro ? 0.15 : 0.03), '--scrim': this.rgba(negro, oscuro ? 0.7 : 0.45),
        '--on-gold': this.lum(acento) > 0.4 ? '#1d1600' : blanco,
        '--a1t': oscuro ? m('#e9c869', acento, 0.3) : m('#8a6400', acento, 0.3), '--a2t': oscuro ? '#9dbcff' : '#1f4fb8', '--a3t': oscuro ? m(secundario, blanco, 0.35) : m(secundario, negro, 0.3),
        '--badge-d': oscuro ? m(secundario, blanco, 0.45) : m(secundario, negro, 0.35), '--badge-c': oscuro ? m(acento, blanco, 0.4) : m(acento, negro, 0.25),
        '--grid': this.rgba(texto, oscuro ? 0.1 : 0.12), '--heat0': oscuro ? m(fondo, panel, 0.55) : m(panel, texto, 0.04),
        '--heatlo': this.rgb(m(panel, texto, oscuro ? 0.08 : 0.06)).join(','), '--heathi': this.rgb(acento).join(','),
        '--warn-ink': oscuro ? '#f0cf9a' : '#7a4a00', '--danger-bg': oscuro ? '#3a1820' : '#fde8eb', '--danger-ink': oscuro ? '#ffb3bf' : '#9b1c2e',
      },
    };
  },
  base() {
    const t = Store.config.tema || { id: 'industrial' };
    if (t.id === 'personalizado' && t.colores) return { ...t.colores };
    return { ...(this.PRESETS[t.id] || this.PRESETS.industrial) };
  },
  aplicar(colores = this.base()) {
    const d = this.derivar(colores), st = document.documentElement.style;
    for (const [k, v] of Object.entries(d.vars)) st.setProperty(k, v);
    st.setProperty('color-scheme', d.oscuro ? 'dark' : 'light');
    document.documentElement.dataset.tema = d.oscuro ? 'oscuro' : 'claro';
    const meta = document.querySelector('meta[name=theme-color]'); if (meta) meta.content = colores.fondo;
    this.actual = { ...colores, oscuro: d.oscuro };
    try { localStorage.setItem('p3:tema', JSON.stringify(colores)); } catch { }
  },
  /** Aplica el último tema guardado antes de cargar la base (evita parpadeo). */
  precargar() { try { const c = JSON.parse(localStorage.getItem('p3:tema') || 'null'); if (c && c.fondo) this.aplicar(c); } catch { } },
  css(nombre) { return getComputedStyle(document.documentElement).getPropertyValue(nombre).trim(); },
  async elegir(id) {
    await Store.setConfig('tema', { id, colores: Store.config.tema?.colores || null });
    this.aplicar(); UI.render();
  },
  async personalizar(colores) {
    await Store.setConfig('tema', { id: 'personalizado', colores });
    this.aplicar(colores); UI.render();
  },
  /** Bloque HTML con los temas y los selectores de color (se usa en Configuración y en la ventana rápida). */
  html() {
    const t = Store.config.tema || { id: 'industrial' }, c = this.base();
    const op = (id, p) => `<button class="tema-op ${t.id === id ? 'active' : ''}" data-tema="${id}" title="${U.esc(p.nombre)}"><span class="tema-sw"><i style="background:${p.fondo}"></i><i style="background:${p.panel}"></i><i style="background:${p.texto}"></i><i style="background:${p.acento}"></i><i style="background:${p.secundario}"></i></span>${U.esc(p.nombre)}</button>`;
    return `<div class="tema-grid">${Object.entries(this.PRESETS).map(([id, p]) => op(id, p)).join('')}</div>
      <h3>Colores personalizados ${t.id === 'personalizado' ? '<span class="badge c">EN USO</span>' : ''}</h3>
      <div class="small muted">Elija cualquier color: se aplica al instante y queda guardado. Parte del tema actual.</div>
      <div class="tema-picks">${[['fondo', 'Fondo'], ['panel', 'Paneles'], ['texto', 'Texto'], ['acento', 'Acento (botones, títulos)'], ['secundario', 'Secundario (aciertos)']].map(([k, l]) => `<label class="field">${l}<input type="color" data-color="${k}" value="${c[k]}"></label>`).join('')}</div>
      <div class="toolbar" style="margin-top:10px"><button class="btn ghost" data-tema-reset>Volver al tema original</button></div>`;
  },
  bind(root) {
    UI.$$('[data-tema]', root).forEach(b => b.onclick = () => this.elegir(b.dataset.tema));
    const leer = () => { const c = {}; UI.$$('[data-color]', root).forEach(i => c[i.dataset.color] = i.value); return c; };
    UI.$$('[data-color]', root).forEach(i => {
      i.oninput = () => this.aplicar(leer());                  // vista previa inmediata
      i.onchange = () => this.personalizar(leer());            // se guarda al soltar
    });
    const r = root.querySelector('[data-tema-reset]'); if (r) r.onclick = () => this.elegir('industrial');
  },
  abrirRapido() {
    UI.modal({ title: '🎨 Colores de la aplicación', wide: true, body: this.html(), buttons: [{ t: 'Cerrar', cls: 'gold' }],
      onOpen: (bg) => {
        this.bind(bg);
        // tras elegir un tema se vuelve a dibujar el contenido de la ventana para marcar el activo
        bg.addEventListener('click', (e) => { if (e.target.closest('[data-tema],[data-tema-reset]')) setTimeout(() => { const body = bg.querySelector('.body'); body.innerHTML = this.html(); this.bind(bg); }, 50); });
      } });
  },
};
Tema.precargar();
