# Manual de uso – PERLA 3 CIFRAS PRO

## Conceptos básicos

* **Número ganador:** siempre de tres cifras, de `000` a `999`. Si escribe `7`, se guarda `007`.
* **Cifras A, B y C:** A = primera cifra (centenas), B = segunda (decenas), C = tercera (unidades). En `407`: A=4, B=0, C=7.
* **Lotería activa** (barra superior): define qué lotería analizan Inicio, Estadísticas, Análisis de cifras, Algoritmos y
  Control de aciertos. «Todas las loterías» combina todos los datos.
* **Frecuencia histórica / ausencia / probabilidad teórica:** la aplicación las muestra siempre por separado. Que un número
  lleve mucho tiempo sin salir **no** aumenta su probabilidad: en cada sorteo justo sigue siendo 1/1000.

## Módulos

> Las secciones conservan la numeración original; *Importar y analizar* aparece en el menú justo después de *Histórico*.

### 1. Inicio / Panel principal
Indicadores: sorteos registrados, loterías, último resultado y su fecha, pronósticos, aciertos directos y combinados,
rendimiento de los tres algoritmos (con el número de aciertos esperado por azar). Gráficos: frecuencia por posición en los
últimos 100 sorteos y sorteos por mes. Tabla de los últimos 12 resultados.

### 2. Loterías
Crear, editar, activar y eliminar loterías. Si una lotería juega varias veces al día (día/noche), cree una lotería para cada
horario: se admite **un resultado por lotería y fecha**. Eliminar una lotería pide confirmación y avisa cuántos resultados y
pronósticos se borrarán.

### 3. Histórico de resultados
* **Registrar:** fecha, lotería y número → *Agregar*. Tras guardar, la fecha avanza un día para registrar seguidos.
* **Pegar varios…:** pegue líneas `fecha;lotería;número` (o copie columnas directamente desde Excel).
* **Filtros:** lotería, rango de fechas, número (exacto con 3 cifras o parcial, p. ej. `25` encuentra 125, 250, 025…).
  Clic en el encabezado *Fecha* invierte el orden. Paginación de 25 a 250 filas.
* **Editar ✎ / Eliminar ✕:** con confirmación. Se rechazan duplicados, fechas inválidas o futuras y números no válidos.
* **Columnas de aciertos:**
  * *Aciertos A1, A2, A3:* `D#n` = acierto directo con el candidato número n; `C#n` = acierto combinado; `x/3` = la mejor
    coincidencia de cifras en su posición entre los candidatos; `—` = pronóstico sin resultado evaluable.
  * *Algoritmo 1, 2, 3:* primer candidato (mayor puntuación) del algoritmo para ese sorteo.
  * *D-Ganador / C-Ganador:* algoritmos que acertaron.
  Se llenan cuando hay un pronóstico guardado o de prueba histórica para ese sorteo (si hay ambos, prevalece el manual).

### Todo se actualiza solo (versión 1.2)
No hace falta ir a ningún módulo para actualizar:
* **Botón «⇪ Importar archivo»** (barra superior, en todas las pantallas) o **soltar el archivo** sobre cualquier pantalla:
  si el archivo trae FECHA, LOTERÍA y NÚMERO se guarda y se analiza al instante, sin revisión ni botones. Si falta algo
  (por ejemplo la lotería), se muestra la revisión para completarlo. Los números de 4 cifras se convierten solos a sus 3 últimas.
* **Recálculo automático:** cada vez que entra un resultado (archivo, lista pegada, un resultado, descarga en línea) se
  ejecuta sola la prueba histórica de los sorteos recientes de esa lotería y se genera el **pronóstico de los 3 algoritmos
  para el próximo sorteo** (origen «automático»). Cuando llega el resultado de ese sorteo, el pronóstico queda evaluado y se
  genera el siguiente. Se actualizan Inicio, Histórico, Estadísticas, Algoritmos, Control de aciertos, Comparador e Informes.
  El aviso «⟳ Actualizando…» en la barra superior indica que está trabajando.
* **Actualización en línea al abrir:** con internet, descarga sola los resultados nuevos de la **Lotería de Medellín** y la
  **Lotería de Santander** desde datos.gov.co (fuente oficial). Los chances no tienen fuente oficial abierta: se actualizan
  con un archivo.
* **Histórico incluido:** una copia personal de la aplicación puede traer el histórico dentro del archivo; se carga sola la
  primera vez que se abre y nunca se duplica.
* Todo esto se puede activar o desactivar en **Configuración → Actualización automática**.

### Pegar resultados de la página (versión 1.8)
En el **Inicio** hay una casilla fija: **📋 Pegar resultados de la página**. Copie los resultados de la página (por
ejemplo ganarchance.com) **tal como aparecen** y péguelos:

    Culona
    6752
    Paisita día
    3711La 5ta: 6

Pulse **INGRESAR RESULTADOS**: se guardan y se actualiza todo el análisis. La aplicación reconoce el nombre de cada
lotería, toma las 3 últimas cifras (6752 → 752) e ignora «La 5ta», la serie y el signo. Si el texto copiado trae
«Resultados de hoy domingo 8 de noviembre» o «Resultados de ayer…», usa esa fecha; si no, la fecha de la casilla (hoy).
Pegar dos veces no duplica; si un número cambió, se corrige. También funciona en *Importar y analizar → Pegar números*.

### Secuencias (versión 1.7)
Opción **Secuencias** del menú. Escriba uno o varios números de tres cifras (el número base).
1. **Secuencia (columna):** las tres cifras bajan de una en una a la vez, 10 filas (después del 0 sigue el 9).
   Base 613: 613, 502, 491, 380, 279, 168, 057, 946, 835, 724. Base 168: 168, 057, 946, 835, 724, 613, 502, 491, 380, 279.
2. **Por cifra −6 +1 +3** (patrón editable): a la primera cifra se le resta 6, a la segunda se le suma 1 y a la tercera
   se le suma 3, sin llevar. Base 755: 7−6=1 · 5+1=6 · 5+3=8 → **168**; la columna completa da 168, 057, 946, 835, 724,
   613, 502, 491, 380, 279. También se muestra cada número **restando 613** (sin pedir prestado) y, al final, todas las
   combinaciones sin repetir.
3. **Suma fila por fila:** a la fila 1 se le suma 1 en cada cifra, a la fila 2 se le suma 2… y a la fila 10 se le suma 0.
   Con la columna que baja, todas las filas dan el mismo número: base + 111 (base 168 → 279).
4. **Combinado total:** todas las combinaciones de los resultados (279 → 279, 297, 729, 792, 927, 972).
También se puede elegir la columna que **sube**, o la secuencia **por cifra** (desde la cifra inicial, arriba hasta el 0 y
abajo hasta el 1: 613 → 713, 813, 913, 013 · 513, 413, 313, 213, 113). Muestra cuántas veces salió cada número y se exporta a Excel.

### Restar un código y combinaciones (versión 1.7)
En **Código 555** elija **Operación: Restar** y escriba el código (por ejemplo **613**): 142 − 613 = **539**
(cifra por cifra, sin pedir prestado; o resta normal tomando las 3 últimas cifras). Cada resultado muestra sus
**combinaciones** (las mismas cifras en otro orden): 539 → 593, 359, 395, 953, 935.

### Código 555 (versión 1.6)
Opción **Código 555** del menú. Suma un código a los números de una lotería (por defecto la **Lotería de Medellín**).
El código es opcional: **555**, **5** (se suma a cada cifra, igual que 555) o cualquier otro de 1 a 6 cifras.
* **Cifra por cifra, sin llevar** (por defecto): 142 + 555 = 697 · 678 + 555 = 123 · 007 + 555 = 552.
* **Suma normal**: 678 + 555 = 1233 → se toman las 3 últimas cifras: 233.
Muestra el último resultado con el código (número para el próximo sorteo), los números de consenso con el código, la
tabla de resultados con su número + código y si ese número salió en los sorteos siguientes (directo o combinado),
comparado con lo esperado por azar. También permite aplicar el código a cualquier número de 2, 3 o 4 cifras.
Exportable a Excel. Los resultados guardados no se modifican.

### Número de consenso (versión 1.5)
En **Generar pronósticos**, al pulsar GENERAR aparece arriba el **número de consenso**: el que los tres algoritmos
juntos ponen más alto entre los 1000 posibles (promedio de sus puestos), con otros 4 de respaldo, sus puestos en A1, A2
y A3, su reemplazo y cuántas veces ha salido. El botón *¿Cuánto ha acertado el consenso?* lo mide en los últimos 100
sorteos (cada uno solo con datos anteriores) y lo compara con el azar. Es la selección más fuerte del análisis, pero no
aumenta la probabilidad real de ningún número (1 entre 1000).
La fecha del próximo sorteo ahora sigue el ritmo de cada lotería: diaria (día siguiente) o semanal (mismo día de la semana).

### Reemplazos (versión 1.4)
En **Reemplazos** (menú, debajo de *Importar y analizar*) escriba uno o varios números de 2, 3 o 4 cifras (también 1, 5
o 6) y pulse **REEMPLAZAR**. Cada cifra se convierte con la **tabla de cifras**, que viene cargada con
**0=5, 1=6, 2=7, 3=8, 4=9** y al revés **5=0, 6=1, 7=2, 8=3, 9=4**. Ejemplos: 25 → 70, 142 → 697, 1234 → 6789,
56789 → 01234. Se muestra cuántas veces ha salido cada número en la lotería activa (los de 4 cifras, por sus 3 últimas).
* La tabla se puede cambiar (una cifra puede tener varias opciones: 1 → 6,8 genera todas las combinaciones) y hay
  plantillas: Espejo (+5), Complemento a 9, Siguiente (+1) y Anterior (−1).
* **Tabla de números:** reemplazos de números completos, una línea por número: `142 = 381, 517`.
* Opcional: mostrar el número reemplazado junto a cada candidato de los pronósticos y en *Evaluar un número*.
* Los resultados guardados nunca se modifican. Exportable a Excel.

### Colores y temas (versión 1.3)
Pulse el botón **🎨** de la barra superior (o vaya a *Configuración → Apariencia*) y elija un tema: **Azul industrial**,
**Negro**, **Blanco**, **Blanco y negro (alto contraste)**, Grafito, Esmeralda, Océano, Vino o Arena. También puede elegir
sus propios colores (fondo, paneles, texto, acento y secundario): el cambio se ve al instante y queda guardado. El botón
*Volver al tema original* restablece los colores de fábrica. Los colores de los tres algoritmos en los gráficos no cambian,
para que siempre se reconozca cuál es cuál.

### 3b. Importar y analizar (el camino más rápido)
Un solo lugar para meter números **cada vez que lo necesite** y obtener el resultado al instante. Cuatro formas:
* **Archivo Excel / CSV:** arrastre el archivo o haga clic para buscarlo. Sirve con 10, 1000, 5000 o más filas, **con o sin fechas**:
  * Con columnas FECHA · LOTERÍA · NÚMERO (en cualquier orden): se detectan solas y puede corregirlas.
  * Solo una columna de números (o una cuadrícula, marcando *Leer todas las celdas*): indique la lotería, si el primero es
    el más antiguo o el más reciente, y la fecha del número más reciente; se asigna un sorteo diario a cada número.
* **Pegar números:** pegue una lista como `123 456 007 089` o filas copiadas de Excel.
* **Un resultado:** fecha, lotería y número → *Registrar y analizar*.
* **Evaluar un número:** escriba un número (sin registrarlo) y vea su historia y el puesto (1 a 1000) que le da cada algoritmo para el próximo sorteo.

Antes de procesar se muestra la **revisión**: números válidos, cuántos son nuevos, cuántos ya estaban, fechas que ya tienen
otro número (conservar o reemplazar) y errores. Luego:
* **IMPORTAR Y ANALIZAR:** guarda lo nuevo (sin duplicar lo que ya tenía) y analiza todo junto.
* **Solo analizar (sin guardar):** hace el mismo análisis sin tocar la base, para probar un archivo.

El **resultado** muestra, por lotería: sorteos antes → ahora, números nuevos, último resultado; el **pronóstico de los 3
algoritmos para el próximo sorteo** con todo el histórico (y los números que coinciden en 2 o 3 algoritmos); **cómo les fue a
los algoritmos con los números nuevos** (para cada número se calcula el pronóstico solo con los sorteos anteriores: aciertos
directos y combinados, esperado por azar y puesto medio del número real, que por azar ronda 500); los pronósticos que usted
había guardado y ya tienen resultado; y la comparación de los números nuevos con el histórico. Se puede exportar a Excel o
PDF y guardar los pronósticos para que se evalúen solos cuando registre el resultado.

### 4. Estadísticas
Filtro por rango de fechas y exportación a Excel. Pestañas:
* **Frecuencia 000–999:** mapa de calor de los 1000 números, más frecuentes, menos frecuentes, más tiempo sin aparecer y
  distribución de frecuencias frente a lo esperado por azar (Poisson).
* **Cifras A · B · C:** frecuencia de cada cifra en cada posición contra el 10% teórico, desviación y prueba χ².
* **Parejas:** matrices 10×10 de AB, BC y AC, con las 15 parejas más frecuentes.
* **Ternas:** combinaciones de tres cifras sin importar el orden y qué órdenes salieron.
* **Repeticiones y cambios:** números con cifras repetidas, repeticiones entre sorteos seguidos, cifras compartidas con el
  sorteo anterior, cambios por posición y números que se repitieron en el periodo.
* **Pares/impares y rangos:** patrones P/I, cantidad de cifras pares, rangos 000–099…900–999 y suma de cifras.
* **Periodos y comparación:** sorteos por mes, por día de la semana y comparación entre la primera y la segunda mitad del histórico.

La **prueba χ²** indica si las diferencias observadas pueden explicarse por azar (p ≥ 0,05) o no.

### 5. Análisis de cifras
Para cada posición: total, %, apariciones en la ventana reciente (configurable), sorteos sin salir, intervalo medio y
máximo. Tabla de evolución de las cifras sorteo a sorteo. **Consultar número:** apariciones directas y combinadas, última
aparición, intervalo medio, patrón, paridad y suma.

### 6. Generar pronósticos
Elija lotería, **fecha del sorteo a analizar**, cantidad (5, 10, 20, 50 o 100) y algoritmo (uno o los tres) → **GENERAR
PRONÓSTICOS**. Solo se usan resultados **anteriores** a esa fecha. Cada candidato muestra posición, número de tres cifras,
puntuación (0–100) y explicación. Botones: *Guardar pronóstico* (queda con fecha y hora), *Exportar a Excel*, *Exportar a PDF*.
Si el sorteo ya tiene resultado, los aciertos se marcan de inmediato.

### 7–9. Algoritmo 1, 2 y 3
Descripción del método, parámetros editables, indicadores de rendimiento, pronóstico rápido para el próximo sorteo de la
lotería activa y lista de pronósticos guardados (ver detalle o eliminar).
* **A1 – Frecuencia y tendencia:** ventana reciente (sorteos).
* **A2 – Ciclos y ausencias:** ventana de ciclos (sorteos).
* **A3 – Modelo combinado:** pesos de frecuencia, tendencia, posiciones, parejas, ternas y ausencias; ventana reciente y
  vida media de la tendencia.
Los tres son independientes entre sí, deterministas (mismos datos → mismos candidatos) y nunca usan información futura.

### 10. Control de aciertos
* **Reglas vigentes** de D-Ganador y C-Ganador (configurables).
* **Prueba histórica cronológica:** elija lotería, periodo, candidatos por sorteo, mínimo de sorteos previos y algoritmos.
  Para cada sorteo del periodo se genera un pronóstico con los datos anteriores y se compara con el resultado real. Se
  puede cancelar. Al repetirla se actualizan los pronósticos de prueba; *Borrar pruebas* no toca los manuales.
* Totales, aciertos por algoritmo con rachas (máxima sin acierto, actual sin acierto, máxima con acierto), resultados por
  lotería, aciertos por mes e historial de aciertos. Filtros por fecha y origen (manual / prueba histórica).

### 11. Comparador de algoritmos
Tabla con pronósticos evaluados, candidatos generados, aciertos directos y combinados, % de aciertos, aciertos esperados
por azar, **rendimiento vs azar** (1,00× = igual que el azar), probabilidad de lograr ese resultado por azar y último
acierto. Gráficos de aciertos, coincidencia posicional y rendimiento acumulado frente al azar. Filtros por lotería, fechas y origen.

### 12. Informes
Informe por lotería y periodo: resumen, frecuencias por posición, números más frecuentes, rendimiento de algoritmos.
Descarga en **PDF**, en **Excel (8 hojas)** o impresión directa.

### 13. Excel
Importación XLSX/CSV, exportaciones y copias de seguridad. Ver `MANUAL_EXCEL.md`.

### 14. Configuración
* Reglas de aciertos: si un directo cuenta además como combinado; si se admite combinado con cifras repetidas.
* Fuente del histórico para los algoritmos: solo la lotería seleccionada o todas.
* Cantidad de candidatos por defecto.
* Copias de seguridad y restauración; cargar o eliminar **datos de ejemplo ficticios**.
* Información del sistema (versión, almacenamiento, espacio usado) y borrado total (requiere escribir BORRAR).

### 15. Ayuda
Resumen de este manual dentro de la aplicación.

## Reglas de aciertos (por defecto)

| Caso | Pronóstico | Resultado | Cuenta como |
|---|---|---|---|
| Mismas cifras y mismo orden | 123 | 123 | **D-Ganador** |
| Mismas cifras, otro orden | 231 | 123 | **C-Ganador** |
| Con cifras repetidas | 373 | 337 | C-Ganador (desactivable) |
| Dos cifras coinciden | 124 | 123 | Sin acierto (2/3 en posición) |
| Sorteo sin resultado | — | — | Pendiente (no cuenta) |

Por defecto, un D-Ganador no se suma además como C-Ganador. Puede cambiarlo en Configuración para que coincida con las
reglas de su lotería o del programa que usa como referencia.

## Datos de ejemplo

*Configuración → Cargar datos de ejemplo* crea «EJEMPLO Ficticia Día» y «EJEMPLO Ficticia Noche» con 420 sorteos cada una,
**generados al azar**. Llevan la etiqueta EJEMPLO y se eliminan con un botón. Los archivos de `datos_ejemplo/` también son
ficticios y sirven para practicar la importación.
