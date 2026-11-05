# NEGOCIO PRO 360 ENTERPRISE

Sistema integral de administración, control financiero, inventarios y gestión empresarial en **Microsoft Excel 365**.

## Entregables (`entregables/`)

| Archivo | Descripción |
|---|---|
| `NEGOCIO_PRO_360.xlsm` | Sistema completo con macros VBA incrustadas (archivo recomendado). |
| `NEGOCIO_PRO_360.xlsx` | Versión base sin macros: todas las fórmulas, tablas, dashboard e informes funcionan. |
| `Modulo_VBA.bas` | Código fuente de las macros (Windows-1252, listo para *Archivo → Importar* en el editor VBA). |
| `Manual_de_Usuario.pdf` | Manual en español: instalación, operación, análisis, reglas financieras, macros y solución de problemas. |
| `Informe_de_pruebas.txt` | Resultados de las pruebas ejecutadas durante la construcción. |
| `Informe_ejemplo.pdf`, `Dashboard_ejemplo.pdf` | Ejemplos de exportación a PDF con los datos de demostración. |

## Instalación rápida

1. Copie `NEGOCIO_PRO_360.xlsm` a una carpeta local. Clic derecho → **Propiedades** → **Desbloquear** (si vino de internet o del correo).
2. Ábralo y pulse **Habilitar contenido**. La macro `Auto_Open` crea los botones; guarde el archivo.
3. Si los botones no aparecen: **Alt+F8 → CrearBotones**.

**Alternativa (.xlsx + .bas):** abra el `.xlsx` → *Guardar como* `.xlsm` → **Alt+F11** → *Archivo → Importar archivo* → `Modulo_VBA.bas` → *Depuración → Compilar* → **Alt+F8 → CrearBotones** → guardar.

## Arquitectura

```
MAESTROS                TRANSACCIONES                 CÁLCULO (protegido)       ANÁLISIS
PRODUCTOS  COSTOS  ──►  VENTAS + VENTAS_DET      ──►  INVENTARIO  KARDEX   ──►  DASHBOARD
CLIENTES               COMPRAS + COMPRAS_DET          CAJA  CARTERA             INFORMES (PDF / Excel)
PROVEEDORES            PAGOS  GASTOS  MOV_CAJA        ROTACION  REPOSICION      ANALISIS (BI)
CONFIG (listas)        AJUSTES  DESPACHOS  CIERRES    EQUILIBRIO  LOGISTICA     VALIDACION  PRUEBAS
        ▲                        ▲
        └──── Formularios F_VENTA · F_COMPRA · F_MOVIMIENTOS · F_CONSULTA (macros validan y agregan filas)
```

Principios de diseño:

* **Datos separados de cálculos.** Las 23 tablas estructuradas reciben datos; las hojas calculadas están protegidas.
* **Stock por movimientos, nunca a mano.** `Stock = ajustes (incl. inventario inicial) + compras RECIBIDAS + devoluciones − ventas ACTIVAS`.
* **Sin doble conteo.** Las ventas y compras no tocan la caja: solo los cobros y pagos de `PAGOS` mueven dinero. Una venta de contado crea un único cobro.
* **Anular, no borrar.** Ventas, compras, pagos, gastos y movimientos se anulan con motivo; inventario y saldos se recalculan solos.
* **Trazabilidad.** Cada macro registra usuario, fecha y acción en `LOG`; si una macro falla a mitad del registro, deshace las filas agregadas.
* **IVA por producto** (0 %, 5 %, 19 % o cualquier tarifa agregada en CONFIG) guardado en cada línea.
* **Margen sobre venta y recargo sobre costo** calculados por separado en `COSTOS`.

### Hojas (34)

`INICIO`, `DASHBOARD`, `F_VENTA`, `F_COMPRA`, `F_MOVIMIENTOS`, `F_CONSULTA`, `PRODUCTOS`, `COSTOS`, `CLIENTES`, `PROVEEDORES`,
`VENTAS`, `VENTAS_DET`, `COMPRAS`, `COMPRAS_DET`, `PAGOS`, `GASTOS`, `MOV_CAJA`, `AJUSTES`, `INVENTARIO`, `KARDEX`, `REPOSICION`,
`ROTACION`, `CAJA`, `CIERRES`, `CARTERA`, `EQUILIBRIO`, `INFORMES`, `ANALISIS`, `DESPACHOS`, `LOGISTICA`, `CONFIG`, `VALIDACION`,
`LOG`, `PRUEBAS`.

### Macros (módulo `NP360`)

Registrar venta, compra, recepción, gasto, pago/abono, ajuste, otro movimiento de caja y cierre diario; anular documentos;
consultar productos y buscar clientes; kardex; generar órdenes de compra desde reposición; actualizar dashboard; generar informes;
exportar a PDF y a Excel; limpiar formularios; copia de seguridad; validar datos; detectar errores; proteger/desproteger;
navegación; crear botones; ampliar filas de cálculo; borrar datos demo; **autoprueba de macros**.

## Verificación realizada

* 38.135 fórmulas recalculadas con LibreOffice en el `.xlsx` y en el `.xlsm`: **0 errores**.
* Escenario obligatorio por etapas (crear producto → compra → recepción → venta → abono → gasto → venta anulada) con el libro recalculado
  en cada etapa; hoja `PRUEBAS`: **18 de 18 OK** (fórmulas en vivo, esperado vs. obtenido).
* Cerrar y reabrir: estructura idéntica (34 hojas, 23 tablas, 259 nombres, 170 validaciones, 4 gráficos).
* VBA: compila en el analizador VBA de LibreOffice; verificación de variables declaradas, procedimientos llamados y de que los
  86 nombres, tablas y columnas usados existen en el libro. El `vbaProject.bin` lo leen correctamente `olevba` y LibreOffice (36 módulos).
* **Pendiente:** ejecutar las macros en Microsoft Excel para Windows (no disponible en el entorno de construcción). Use el botón
  **EJECUTAR AUTOPRUEBA DE MACROS** de la hoja `PRUEBAS`.

## Regenerar los archivos

```bash
cd NEGOCIO_PRO_360/generador
python3 entregar.py      # construye, prueba por etapas, crea .xlsm/.bas, PDF de ejemplo e informe de pruebas
python3 manual.py        # manual de usuario en PDF
```

Requisitos: Python 3 con `openpyxl`, `reportlab`, `oletools` (verificación) y LibreOffice (recálculo y PDF).

> Aviso: las cifras son estimaciones administrativas basadas en los datos registrados; no constituyen estados financieros
> certificados ni asesoría tributaria. Los datos incluidos son ficticios.
