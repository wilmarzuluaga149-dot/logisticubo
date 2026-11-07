# PERLA 3 CIFRAS PRO – Edición Profesional

Aplicación web para el **análisis estadístico de resultados de loterías de tres cifras**: registro histórico,
estadísticas de 000 a 999 y de las cifras A, B y C, tres algoritmos de pronóstico independientes, control de aciertos
directos (D-Ganador) y combinados (C-Ganador), comparador de algoritmos con prueba histórica cronológica,
integración con Excel 365, informes PDF y copias de seguridad.

> **Aviso.** Los pronósticos son resultados de modelos estadísticos sobre datos históricos. En un sorteo justo cada
> número tiene siempre una probabilidad de 1 entre 1000. La aplicación **no garantiza premios** y muestra siempre cuántos
> aciertos se esperarían por puro azar para que el rendimiento se pueda juzgar con honestidad.

## Entrega

| Archivo | Contenido |
|---|---|
| `android/` | App Android (APK): proyecto nativo mínimo con WebView y script `build_apk.sh` (sin Gradle). |
| `escritorio/` | App de Windows (Electron): `npm install && npm run dist` genera el instalador y la versión portátil. |
| `PERLA3CIFRAS_PRO.html` | **La aplicación completa en un solo archivo** (incluye Chart.js, SheetJS y jsPDF). Funciona sin conexión y sin instalar nada. |
| `docs/MANUAL_PERLA3CIFRAS_PRO.pdf` | Los tres manuales en un solo PDF (versión 1.3.0). |
| `docs/MANUAL_USO.md` | Instrucciones de uso de los 16 módulos. |
| `docs/MANUAL_INSTALACION.md` | Instalación en Windows, Android, publicación gratuita y actualización sin perder datos. |
| `docs/MANUAL_EXCEL.md` | Importación y exportación con Excel 365 y CSV; estructura de las 8 hojas. |
| `datos_ejemplo/` | `EJEMPLO_resultados_ficticios.xlsx` y `.csv`: **datos ficticios** para probar la importación. |
| `src/` | Código fuente (HTML, CSS y módulos JavaScript). |
| `lib/` | Librerías libres usadas: Chart.js 4.4.4 (MIT), SheetJS CE 0.18.5 (Apache 2.0), jsPDF 2.5.2 y jsPDF-AutoTable 3.8.4 (MIT). |
| `build.js` | Genera `PERLA3CIFRAS_PRO.html` a partir de `src/` y `lib/` (`node build.js`). |
| `tests/` | Pruebas automáticas (115 comprobaciones de control de calidad). |
| `index.html`, `manifest.webmanifest`, `sw.js`, `icon.svg` | Permiten publicarla en un servidor (p. ej. GitHub Pages) e instalarla como app en el celular con uso sin conexión. |

## Inicio rápido

1. Descargue `PERLA3CIFRAS_PRO.html` y ábralo con Google Chrome o Microsoft Edge (doble clic).
2. Vaya a **Loterías** y cree su lotería, o a **Configuración → Cargar datos de ejemplo** para practicar.
3. Pulse **⇪ Importar archivo** (o suelte el archivo en cualquier pantalla): se guarda, se analiza y se actualizan solos todos los módulos. También puede usar **Importar y analizar**: arrastre un archivo (con o sin fechas, de cualquier tamaño), pegue una lista o ingrese un solo resultado, y obtenga al instante el análisis y el pronóstico de los 3 algoritmos con todo lo que ya tenía más lo nuevo.
4. Use **Generar pronósticos**, ejecute la **prueba histórica** en **Control de aciertos** y compare en el **Comparador**.

## Para desarrolladores

```bash
node build.js                    # reconstruye PERLA3CIFRAS_PRO.html
node build.js --datos historico.json --salida MI_PERLA3.html   # copia personal con histórico incluido
cd tests && npm install && npm test   # pruebas (Playwright + Chromium)
```

Arquitectura: los módulos de `src/js/` se concatenan en orden (`01-util` → `11-views-misc`).
`02-db.js` guarda todo en IndexedDB (respaldo en localStorage), `03-stats.js` calcula las estadísticas, `04-algorithms.js`
contiene los tres algoritmos y la prueba histórica, `05-hits.js` las reglas de aciertos y `06-excel-pdf.js` la integración
con Excel y PDF. El resto son las vistas de la interfaz.

Proyecto de desarrollo independiente: reproduce funcionalidades habituales de los programas de análisis de loterías de
tres cifras sin usar código, recursos ni mecanismos de activación de ningún programa comercial.
