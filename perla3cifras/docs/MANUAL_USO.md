# Manual de uso – PERLA 3 CIFRAS PRO

## Conceptos básicos

* **Número ganador:** siempre de tres cifras, de `000` a `999`. Si escribe `7`, se guarda `007`.
* **Cifras A, B y C:** A = primera cifra (centenas), B = segunda (decenas), C = tercera (unidades). En `407`: A=4, B=0, C=7.
* **Lotería activa** (barra superior): define qué lotería analizan Inicio, Estadísticas, Análisis de cifras, Algoritmos y
  Control de aciertos. «Todas las loterías» combina todos los datos.
* **Frecuencia histórica / ausencia / probabilidad teórica:** la aplicación las muestra siempre por separado. Que un número
  lleve mucho tiempo sin salir **no** aumenta su probabilidad: en cada sorteo justo sigue siendo 1/1000.

## Módulos

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
