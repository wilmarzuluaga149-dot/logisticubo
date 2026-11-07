#!/usr/bin/env node
/* Construye PERLA3CIFRAS_PRO.html: un único archivo autocontenido (funciona sin conexión).
   Uso: node build.js
        node build.js --datos historico.json --salida MI_PERLA3.html
   Con --datos se incorpora un histórico (JSON {id, descripcion, registros:[[fecha, loteria, numero], ...]})
   que la aplicación carga sola la primera vez que se abre. */
const fs = require('fs'), path = require('path');
const R = (...p) => fs.readFileSync(path.join(__dirname, ...p), 'utf8');
const safe = s => s.replace(/<\/script/gi, '<\\/script').replace(/<!--/g, '<\\!--');
const libs = ['chart.umd.min.js', 'xlsx.core.min.js', 'jspdf.umd.min.js', 'jspdf.plugin.autotable.min.js'];
const libTags = libs.map(f => `<script>/* ${f} */\n${safe(R('lib', f))}\n</script>`).join('\n');
const jsFiles = fs.readdirSync(path.join(__dirname, 'src/js')).filter(f => f.endsWith('.js')).sort();
const app = jsFiles.map(f => `/* ---- ${f} ---- */\n` + R('src/js', f)).join('\n');
const arg = (k) => { const i = process.argv.indexOf(k); return i > 0 ? process.argv[i + 1] : null; };
const datos = arg('--datos'), salida = arg('--salida') || 'PERLA3CIFRAS_PRO.html';
let html = R('src/index.html');
html = html.replace('/*@@CSS@@*/', () => R('src/styles.css'))
           .replace('<!--@@LIBS@@-->', () => libTags)
           .replace('/*@@APP@@*/', () => safe(app));
if (datos) {
  const d = JSON.parse(fs.readFileSync(datos, 'utf8'));
  if (!d.id || !Array.isArray(d.registros)) throw new Error('El archivo de datos debe tener {id, registros}');
  html = html.replace('<!--@@LIBS@@-->', '').replace('<script>\n/* ---- 01', () => `<script>window.P3_DATOS_INCLUIDOS = ${safe(JSON.stringify(d))};</script>\n<script>\n/* ---- 01`);
  console.log('Histórico incluido:', d.registros.length, 'registros');
}
fs.writeFileSync(path.isAbsolute(salida) ? salida : path.join(__dirname, salida), html);
console.log('OK', salida, (html.length / 1024).toFixed(0), 'KB;', jsFiles.length, 'módulos');
