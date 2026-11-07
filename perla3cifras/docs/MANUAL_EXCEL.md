# Manual de importación y exportación Excel – PERLA 3 CIFRAS PRO

## Importar resultados

Módulo **Excel → Importar resultados**. Formatos: `.xlsx`, `.xls`, `.csv`, `.txt`.

### Formato recomendado (descargue la *plantilla* desde la aplicación)

| FECHA | LOTERIA | NUMERO |
|---|---|---|
| 2026-01-05 | Mi Lotería | 007 |
| 06/01/2026 | Mi Lotería | 025 |

* **FECHA:** `AAAA-MM-DD`, `DD/MM/AAAA` (también `-` o `.`), `DD/MM/AA`, `AAAAMMDD`, o celda de fecha nativa de Excel.
  Si sus fechas vienen en formato estadounidense, elija `MM/DD/AAAA` en el selector *Formato fecha*.
* **LOTERIA:** nombre de la lotería (no distingue mayúsculas ni tildes). Si el archivo no tiene esta columna, elija
  *(no hay columna)* y seleccione la lotería en *Lotería si no hay columna*. Las loterías inexistentes se crean
  automáticamente (opción desactivable).
* **NUMERO:** de 1 a 3 cifras. Si Excel lo guardó como número (`7`), se completa a `007`. Con la opción
  *Números de 4+ cifras: usar las 3 últimas*, `4507` se importa como `507`.
* Encabezados: se reconocen automáticamente (*Fecha, Lotería, Número, Resultado, Ganador, Sorteo…*) y puede reasignar
  cada columna manualmente. En archivos con varias hojas se usa `RESULTADOS` si existe, o puede elegir la hoja.
* CSV: se detecta el separador (`;` `,` tabulación `|`) y la codificación (UTF-8 o ANSI/Windows-1252 de Excel). El CSV se
  lee como texto: los ceros iniciales nunca se pierden.

### Validación previa
Antes de importar se muestran: filas válidas, filas con error (con el motivo: fecha inválida o futura, número inválido,
sin lotería, duplicado dentro del archivo), registros que ya existen y loterías nuevas.

### Duplicados
Un resultado se identifica por **lotería + fecha**. *Omitir existentes* (por defecto) conserva lo que ya tiene;
*Reemplazar existentes* actualiza el número si cambió. Reimportar un archivo ya importado no crea duplicados.

### Importación rápida
En *Histórico → Pegar varios…* puede pegar celdas copiadas desde Excel (fecha, lotería, número).

## Exportar

Módulo **Excel → Exportar a Excel 365**, con filtros de lotería y fechas.

**Libro completo (8 hojas + INFO):**

| Hoja | Contenido |
|---|---|
| `RESULTADOS` | FECHA, LOTERIA, NUMERO, A, B, C, ACIERTOS_A1..A3, ALGORITMO_1..3 (primer candidato), D_GANADOR, C_GANADOR |
| `ESTADISTICAS` | Frecuencia y ausencia de 000–999, frecuencias por posición, parejas AB/BC/AC, ternas, repeticiones, paridad y suma de cifras, con valores teóricos |
| `ALGORITMO_1` / `_2` / `_3` | Un renglón por pronóstico: fecha objetivo, lotería, origen, top 1, lista completa, resultado, D, C, mejor coincidencia posicional |
| `PRONOSTICOS` | Un renglón por candidato: puntuación, estado (D-GANADOR / C-GANADOR / SIN ACIERTO / PENDIENTE) y explicación. Incluye todos los manuales y los últimos 300 de prueba histórica |
| `ACIERTOS` | Historial de aciertos con tipo, candidato y su posición en la lista |
| `COMPARATIVO` | Resumen por algoritmo: pronósticos, evaluados, candidatos, aciertos D y C, %, esperado por azar, índice vs azar, último acierto, racha máxima sin acierto |
| `INFO` | Versión, fecha de exportación y filtros aplicados |

También hay exportaciones individuales (Históricos, Estadísticas, Pronósticos, Aciertos, Comparativo), la exportación desde
*Generar pronósticos* y el *Informe Excel* por lotería en **Informes**.

**Los números de tres cifras se escriben como texto** (formato `@`): `007` se ve y se conserva como `007` en Excel 365.
Todas las hojas tienen autofiltro y anchos de columna ajustados.

## Copias de seguridad

* *Descargar copia de seguridad* → `PERLA3_COPIA_SEGURIDAD_AAAAMMDD_HHMM.json` con loterías, resultados, pronósticos y configuración.
* *Restaurar copia…* valida el archivo antes de reemplazar los datos (un archivo dañado o ajeno se rechaza sin tocar nada).
* El libro Excel completo también sirve como respaldo de los resultados: su hoja `RESULTADOS` se puede volver a importar.

## Archivos de ejemplo

`datos_ejemplo/EJEMPLO_resultados_ficticios.xlsx` y `.csv` contienen 730 sorteos **ficticios** (2 loterías «EJEMPLO
Archivo…», año 2025) generados al azar, para practicar la importación.
