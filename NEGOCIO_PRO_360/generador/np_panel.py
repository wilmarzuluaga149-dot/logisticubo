# -*- coding: utf-8 -*-
"""INICIO, DASHBOARD, INFORMES, ANALISIS, LOGISTICA, VALIDACION."""
from np_lib import *
from np_calc import _hdr, _total, _sem
from openpyxl.utils import get_column_letter
from openpyxl.chart import BarChart, LineChart, PieChart, DoughnutChart, Reference
from openpyxl.chart.label import DataLabelList
from openpyxl.formatting.rule import FormulaRule, CellIsRule

VERSION = "1.0.0"


def _kpi(ws, col, fila, titulo, formula, fmt, sub, color=AZUL2):
    from openpyxl.utils import column_index_from_string as ci
    c0 = ci(col)
    c3 = get_column_letter(c0 + 3)
    for r in range(fila, fila + 4):
        for c in range(c0, c0 + 4):
            ws.cell(r, c).fill = fill(color if r == fila else BLANCO)
            ws.cell(r, c).border = Border(left=Side("thin", GRIS2) if c == c0 else None,
                                          right=Side("thin", GRIS2) if c == c0 + 3 else None,
                                          top=Side("thin", GRIS2) if r == fila else None,
                                          bottom=Side("medium", color) if r == fila + 3 else None)
    ws.merge_cells(f"{col}{fila}:{c3}{fila}")
    ws[f"{col}{fila}"] = titulo
    ws[f"{col}{fila}"].font = F(9, True, BLANCO)
    ws[f"{col}{fila}"].alignment = Alignment(horizontal="center", vertical="center")
    ws.merge_cells(f"{col}{fila + 1}:{c3}{fila + 2}")
    v = ws[f"{col}{fila + 1}"]
    v.value = formula
    v.number_format = fmt
    v.font = F(18, True, color)
    v.alignment = Alignment(horizontal="center", vertical="center")
    ws.merge_cells(f"{col}{fila + 3}:{c3}{fila + 3}")
    s = ws[f"{col}{fila + 3}"]
    s.value = sub
    s.font = F(8, False, GRIS3)
    s.alignment = Alignment(horizontal="center", vertical="center")


# =====================================================================  DASHBOARD
def hoja_dashboard(wb, ws):
    encabezado_hoja(ws, "▣ DASHBOARD EJECUTIVO", "Indicadores del negocio calculados automáticamente desde los registros. Valores de ventas sin IVA.", 17)
    anchos(ws, [2] + [10.5] * 16 + [2])
    etiqueta(ws, "B5", "Fecha de análisis:", True, 9)
    entrada(ws, "D5", "=TODAY()", FECHA, "Por defecto HOY. Escriba otra fecha (DD/MM/AAAA) para analizar otro día/mes. Para volver a hoy escriba =HOY()")
    ws.merge_cells("D5:E5")
    nombre(wb, "cfg_FechaCorte", abs_ref(ws, "D5"))
    etiqueta(ws, "G5", "Categoría:", True, 9)
    entrada(ws, "H5", "(Todas)")
    ws.merge_cells("H5:I5")
    lista_dv(ws, "H5", "=lstCatFiltro")
    nombre(wb, "dash_Cat", abs_ref(ws, "H5"))
    etiqueta(ws, "K5", "Actualizado:", True, 9)
    calc(ws, "L5", None, FECHAHORA, fondo=None, size=9, color=GRIS3)
    ws.merge_cells("L5:N5")
    nombre(wb, "dash_Actualizado", abs_ref(ws, "L5"))
    enlace(ws, "P5", "➜ Informes", "INFORMES")
    ws["R5"] = '=IF(dash_Cat="(Todas)","*",dash_Cat)'
    nombre(wb, "dash_Crit", abs_ref(ws, "R5"))
    ws.column_dimensions["R"].hidden = True

    mes = 'tVentasDet[Fecha],">="&cfg_MesIni,tVentasDet[Fecha],"<"&cfg_MesFin'
    mesA = 'tVentasDet[Fecha],">="&cfg_MesAntIni,tVentasDet[Fecha],"<"&cfg_MesIni'
    cat = "tVentasDet[Categoría],dash_Crit"
    vm = f"SUMIFS(tVentasDet[Base efectiva],{mes},{cat})"
    vma = f"SUMIFS(tVentasDet[Base efectiva],{mesA},{cat})"
    ubm = f"SUMIFS(tVentasDet[Utilidad bruta],{mes},{cat})"
    perd = 'SUMIFS(tAjustes[Valor pérdida],tAjustes[Fecha],">="&cfg_MesIni,tAjustes[Fecha],"<"&cfg_MesFin)'
    kpis = [
        ("VENTAS DEL DÍA", f"=SUMIFS(tVentasDet[Base efectiva],tVentasDet[Fecha],cfg_FechaCorte,{cat})", COP,
         f'="Con IVA: $ "&FIXED(SUMIFS(tVentasDet[Base efectiva],tVentasDet[Fecha],cfg_FechaCorte,{cat})+SUMIFS(tVentasDet[IVA efectivo],tVentasDet[Fecha],cfg_FechaCorte,{cat}),0)', AZUL2),
        ("VENTAS DEL MES", f"={vm}", COP, f'="Mes anterior: $ "&FIXED({vma},0)&IF({vma}>0,"  ("&FIXED(({vm}/{vma}-1)*100,1)&"%)","")', AZUL2),
        ("COMPRAS DEL MES (recibidas)", '=SUMIFS(tComprasDet[Costo total línea],tComprasDet[Estado recepción],"Recibida",tComprasDet[Fecha recepción],">="&cfg_MesIni,tComprasDet[Fecha recepción],"<"&cfg_MesFin,tComprasDet[Categoría],dash_Crit)', COP,
         '="Órdenes por recibir: "&COUNTIF(tCompras[Estado recepción],"Pendiente")', AZUL2),
        ("GASTOS DEL MES", "=gas_TotMes", COP, '="Acumulado del año: $ "&FIXED(gas_TotAnio,0)', AZUL2),
        ("UTILIDAD BRUTA DEL MES", f"={ubm}", COP, f'="Margen bruto: "&FIXED(IFERROR({ubm}/{vm},0)*100,1)&"%"', VERDE),
        ("UTILIDAD NETA ESTIMADA (mes)", f'=SUMIFS(tVentasDet[Utilidad bruta],{mes})-gas_TotMes-{perd}', COP,
         f'="Pérdidas de inventario: $ "&FIXED({perd},0)&" · total negocio"', VERDE),
        ("DINERO DISPONIBLE", "=caja_SaldoTotal", COP,
         '="Efectivo: $ "&FIXED(IFERROR(INDEX(caja_Saldos,MATCH("Efectivo",caja_Medios,0)),0),0)', VERDE),
        ("VALOR DEL INVENTARIO", "=inv_ValorTotal", COP, '="A precio de venta: $ "&FIXED(SUM(inv_ValorVenta),0)', VERDE),
        ("PRODUCTOS CON BAJO STOCK", '=COUNTIF(inv_Estado,"BAJO")+COUNTIF(inv_Estado,"AGOTADO")+COUNTIF(inv_Estado,"NEGATIVO")', NUM,
         '="Agotados: "&COUNTIF(inv_Estado,"AGOTADO")&" · a reponer: "&repo_N', AMBAR),
        ("CUENTAS POR COBRAR", "=car_CxCTotal", COP, '="Clientes con saldo: "&COUNTIF(tClientes[Saldo pendiente],">1")', AMBAR),
        ("CUENTAS POR PAGAR", "=car_CxPTotal", COP, '="Vencido: $ "&FIXED(SUM(car_CxPVencido),0)', AMBAR),
        ("CARTERA VENCIDA", "=SUM(car_CxCVencido)", COP, '="Facturas vencidas: "&COUNTIFS(tVentas[Días vencido],">0")', ROJO),
    ]
    cols = ["B", "F", "J", "N"]
    for i, (t, f, fm, s, color) in enumerate(kpis):
        _kpi(ws, cols[i % 4], 7 + (i // 4) * 5, t, f, fm, s, color)
    nombre(wb, "dash_VentasMes", abs_ref(ws, "F8"))
    nombre(wb, "dash_UtilNeta", abs_ref(ws, "F13"))

    # ---- alertas
    seccion(ws, "B23", "⚠ ALERTAS IMPORTANTES", 8, ROJO)
    alertas = [
        '=IF(COUNTIF(inv_Estado,"AGOTADO")+COUNTIF(inv_Estado,"NEGATIVO")>0,"⚠ "&(COUNTIF(inv_Estado,"AGOTADO")+COUNTIF(inv_Estado,"NEGATIVO"))&" producto(s) agotado(s) o con stock negativo","✔ No hay productos agotados")',
        '=IF(COUNTIF(inv_Estado,"BAJO")>0,"⚠ "&COUNTIF(inv_Estado,"BAJO")&" producto(s) por debajo del stock mínimo (ver REPOSICIÓN)","✔ Todos los productos sobre el mínimo")',
        '=IF(SUM(car_CxCVencido)>0,"⚠ Cartera vencida: $ "&FIXED(SUM(car_CxCVencido),0)&" en "&COUNTIFS(tVentas[Días vencido],">0")&" factura(s)","✔ Sin cartera vencida")',
        '=IF(SUM(car_CxPVencido)>0,"⚠ Cuentas por pagar vencidas: $ "&FIXED(SUM(car_CxPVencido),0),"✔ Sin pagos a proveedores vencidos")',
        '=IF(COUNTIFS(inv_Vence,">="&cfg_FechaCorte,inv_Vence,"<="&cfg_FechaCorte+cfg_DiasAlertaVence)>0,"⚠ "&COUNTIFS(inv_Vence,">="&cfg_FechaCorte,inv_Vence,"<="&cfg_FechaCorte+cfg_DiasAlertaVence)&" producto(s) con lotes que vencen en "&cfg_DiasAlertaVence&" días","✔ Sin lotes próximos a vencer")',
        '=IF(COUNTIF(tCostos[Evaluación],"PÉRDIDA")+COUNTIF(tCostos[Evaluación],"BAJO MÍNIMO")>0,"⚠ "&(COUNTIF(tCostos[Evaluación],"PÉRDIDA")+COUNTIF(tCostos[Evaluación],"BAJO MÍNIMO"))&" producto(s) con precio por debajo del mínimo","✔ Precios por encima del mínimo")',
        '=IF(COUNTIF(tCierres[Estado],"Faltante")+COUNTIF(tCierres[Estado],"Sobrante")>0,"⚠ "&(COUNTIF(tCierres[Estado],"Faltante")+COUNTIF(tCierres[Estado],"Sobrante"))&" cierre(s) de caja con diferencia","✔ Cierres de caja cuadrados")',
        '=IF(dash_UtilNeta<0,"⚠ La utilidad neta estimada del mes es negativa","✔ Utilidad neta del mes positiva")',
        '=IF(val_Total>0,"⚠ "&val_Total&" posible(s) error(es) de datos — revise VALIDACIÓN","✔ Sin errores de datos detectados")',
    ]
    for i, f in enumerate(alertas):
        r = 24 + i
        ws.merge_cells(f"B{r}:I{r}")
        ws[f"B{r}"] = f
        ws[f"B{r}"].font = F(9, True, VERDE)
        ws[f"B{r}"].alignment = Alignment(vertical="center", indent=1)
    ws.conditional_formatting.add("B24:I32", FormulaRule(formula=['LEFT($B24,1)="⚠"'], font=Font(color=ROJO, bold=True), fill=fill(ROJO2)))

    # ---- top 5
    seccion(ws, "K23", "🏆 PRODUCTOS MÁS VENDIDOS DEL MES (unidades)", 7, VERDE)
    for j, h in enumerate(["#", "Código", "Producto", "", "", "Unidades", "Ventas $"]):
        c = ws.cell(24, 11 + j, h)
        c.font = F(9, True, BLANCO)
        c.fill = fill(GRIS3)
    ws.merge_cells("M24:O24")
    for k in range(1, 6):
        r = 24 + k
        m = f"MATCH(LARGE(inv_Top,{k}),inv_Top,0)"
        ws.cell(r, 11, k)
        ws.cell(r, 12, f'=IFERROR(INDEX(inv_Cod,{m}),"")')
        ws.cell(r, 13, f'=IFERROR(INDEX(inv_Nombre,{m}),"")')
        ws.merge_cells(f"M{r}:O{r}")
        ws.cell(r, 16, f'=IFERROR(INDEX(inv_UnidMes,{m}),0)').number_format = NUM
        ws.cell(r, 17, f'=IFERROR(INDEX(inv_VentasMes,{m}),0)').number_format = COP
        for c in range(11, 18):
            ws.cell(r, c).font = F(9)
            ws.cell(r, c).border = BORDE

    # ---- evolución mensual
    seccion(ws, "B35", "📈 EVOLUCIÓN MENSUAL (12 meses)", 8)
    H = ["Mes", "Ventas netas", "Costo de ventas", "Utilidad bruta", "Gastos", "Pérdidas inv.", "Utilidad neta", "Compras recibidas"]
    for j, h in enumerate(H):
        c = ws.cell(36, 2 + j, h)
        c.font = F(9, True, BLANCO)
        c.fill = fill(GRIS3)
        c.alignment = Alignment(horizontal="center", wrap_text=True)
    ws.row_dimensions[36].height = 28
    for i in range(12):
        r = 37 + i
        d = f"$B{r}"
        rv = f'tVentasDet[Fecha],">="&{d},tVentasDet[Fecha],"<"&EDATE({d},1),tVentasDet[Categoría],dash_Crit'
        vals = [f"=EDATE(cfg_MesIni,{i - 11})", f"=SUMIFS(tVentasDet[Base efectiva],{rv})", f"=SUMIFS(tVentasDet[Costo total],{rv})",
                f"=C{r}-D{r}", f'=SUMIFS(tGastos[Valor efectivo],tGastos[Fecha],">="&{d},tGastos[Fecha],"<"&EDATE({d},1))',
                f'=SUMIFS(tAjustes[Valor pérdida],tAjustes[Fecha],">="&{d},tAjustes[Fecha],"<"&EDATE({d},1))',
                f"=E{r}-F{r}-G{r}",
                f'=SUMIFS(tComprasDet[Costo total línea],tComprasDet[Estado recepción],"Recibida",tComprasDet[Fecha recepción],">="&{d},tComprasDet[Fecha recepción],"<"&EDATE({d},1))']
        for j, v in enumerate(vals):
            c = ws.cell(r, 2 + j, v)
            c.font = F(9)
            c.border = BORDE
            c.number_format = MES if j == 0 else COP
    ws.conditional_formatting.add("H37:H48", CellIsRule(operator="lessThan", formula=["0"], font=Font(color=ROJO, bold=True)))
    # ---- gastos por categoría
    seccion(ws, "K35", "Gastos del mes por categoría", 3, GRIS3)
    for k in range(1, 13):
        r = 36 + k
        ws.cell(r, 11, f'=IFERROR(INDEX(gas_Cat,{k})&"","")').font = F(9)
        c = ws.cell(r, 13, f"=N(INDEX(gas_Mes,{k}))")
        c.number_format = COP
        c.font = F(9)
        ws.merge_cells(f"K{r}:L{r}")

    # ---- gráficos
    ch = BarChart()
    ch.type = "col"
    ch.title = "Ventas, gastos y utilidad neta por mes"
    ch.y_axis.title = "COP"
    ch.y_axis.numFmt = '#,##0'
    data = Reference(ws, min_col=3, max_col=3, min_row=36, max_row=48)
    ch.add_data(data, titles_from_data=True)
    ch.add_data(Reference(ws, min_col=6, max_col=6, min_row=36, max_row=48), titles_from_data=True)
    cats = Reference(ws, min_col=2, min_row=37, max_row=48)
    ch.set_categories(cats)
    ln = LineChart()
    ln.add_data(Reference(ws, min_col=8, max_col=8, min_row=36, max_row=48), titles_from_data=True)
    ln.set_categories(cats)
    ch += ln
    ch.height, ch.width = 8.5, 17
    ch.legend.position = "b"
    ws.add_chart(ch, "B51")

    b2 = BarChart()
    b2.type = "bar"
    b2.title = "Top 5 productos del mes (unidades)"
    b2.add_data(Reference(ws, min_col=16, min_row=24, max_row=29), titles_from_data=True)
    b2.set_categories(Reference(ws, min_col=13, min_row=25, max_row=29))
    b2.legend = None
    b2.height, b2.width = 8.5, 15
    ws.add_chart(b2, "K51")

    p = DoughnutChart()
    p.title = "Gastos del mes por categoría"
    p.add_data(Reference(ws, min_col=13, min_row=37, max_row=48))
    p.set_categories(Reference(ws, min_col=11, min_row=37, max_row=48))
    p.height, p.width = 8.5, 17
    ws.add_chart(p, "B69")

    car = wb["CARTERA"]
    b3 = BarChart()
    b3.type = "col"
    b3.title = "Cartera por edades (CxC)"
    b3.add_data(Reference(car, min_col=3, min_row=7, max_row=11))
    b3.set_categories(Reference(car, min_col=2, min_row=7, max_row=11))
    b3.legend = None
    b3.height, b3.width = 8.5, 15
    ws.add_chart(b3, "K69")
    ws.freeze_panes = "A6"


# =====================================================================  INICIO
def hoja_inicio(wb, ws):
    ws.sheet_view.showGridLines = False
    anchos(ws, [2] + [12] * 14 + [2])
    for r in range(1, 6):
        for c in range(1, 17):
            ws.cell(r, c).fill = fill(AZUL)
    ws["B2"] = "NEGOCIO PRO 360 ENTERPRISE"
    ws["B2"].font = F(24, True, BLANCO)
    ws["B3"] = "Sistema integral de administración, control financiero, inventarios y gestión empresarial"
    ws["B3"].font = F(11, False, "BFD7EA")
    ws["B4"] = f'="Versión {VERSION}  ·  "&cfg_Negocio&"  ·  NIT "&cfg_NIT'
    ws["B4"].font = F(9, False, "BFD7EA", True)
    ws.row_dimensions[2].height = 36
    # info del negocio
    seccion(ws, "B7", "INFORMACIÓN DEL NEGOCIO", 6, AZUL2)
    info = [("Negocio", "=cfg_Negocio"), ("NIT", "=cfg_NIT"), ("Dirección", '=cfg_Direccion&" · "&cfg_Ciudad'),
            ("Contacto", '=cfg_Telefono&" · "&cfg_Email'), ("Fecha", "=cfg_FechaCorte")]
    for i, (a, b) in enumerate(info):
        r = 8 + i
        etiqueta(ws, f"B{r}", a, True, 9, GRIS3)
        ws.merge_cells(f"C{r}:G{r}")
        ws[f"C{r}"] = b
        ws[f"C{r}"].font = F(10)
        if "Fecha" in a:
            ws[f"C{r}"].number_format = FECHA
            ws[f"C{r}"].alignment = Alignment(horizontal="left")
    seccion(ws, "I7", "ESTADO DEL SISTEMA", 7, AZUL2)
    est = [("Ventas del mes", "=dash_VentasMes", COP), ("Dinero disponible", "=caja_SaldoTotal", COP),
           ("Valor inventario", "=inv_ValorTotal", COP), ("Errores de datos", "=val_Total", NUM),
           ("Productos a reponer", "=repo_N", NUM)]
    for i, (a, b, fm) in enumerate(est):
        r = 8 + i
        etiqueta(ws, f"I{r}", a, True, 9, GRIS3)
        ws.merge_cells(f"L{r}:N{r}")
        ws[f"L{r}"] = b
        ws[f"L{r}"].number_format = fm
        ws[f"L{r}"].font = F(10, True, AZUL)
    # menú
    seccion(ws, "B14", "MENÚ PRINCIPAL — haga clic en un módulo", 14, VERDE)
    grupos = [
        ("OPERACIÓN DIARIA", AZUL2, [("REGISTRAR VENTA", "F_VENTA"), ("REGISTRAR COMPRA", "F_COMPRA"),
                                     ("GASTOS · PAGOS · AJUSTES", "F_MOVIMIENTOS"), ("CONSULTAR PRODUCTO / CLIENTE", "F_CONSULTA")]),
        ("ANÁLISIS", "1B4F72", [("DASHBOARD EJECUTIVO", "DASHBOARD"), ("INFORMES", "INFORMES"),
                                ("INTELIGENCIA DE NEGOCIOS", "ANALISIS"), ("PUNTO DE EQUILIBRIO", "EQUILIBRIO")]),
        ("INVENTARIO", "117A65", [("INVENTARIO", "INVENTARIO"), ("KARDEX", "KARDEX"), ("REPOSICIÓN / PEDIDOS", "REPOSICION"),
                                  ("ROTACIÓN Y ABC", "ROTACION")]),
        ("FINANZAS", "1E8449", [("CAJA Y FLUJO", "CAJA"), ("CARTERA CxC / CxP", "CARTERA"), ("CIERRES DE CAJA", "CIERRES"),
                                ("GASTOS", "GASTOS")]),
        ("MAESTROS", "5B6B7F", [("PRODUCTOS", "PRODUCTOS"), ("COSTOS Y PRECIOS", "COSTOS"), ("CLIENTES", "CLIENTES"),
                                ("PROVEEDORES", "PROVEEDORES")]),
        ("REGISTROS", "34495E", [("VENTAS", "VENTAS"), ("COMPRAS", "COMPRAS"), ("COBROS Y PAGOS", "PAGOS"),
                                 ("PÉRDIDAS Y AJUSTES", "AJUSTES")]),
        ("LOGÍSTICA", "6C3483", [("CUBICAJE", "LOGISTICA"), ("DESPACHOS", "DESPACHOS"), ("OTROS MOV. CAJA", "MOV_CAJA"),
                                 ("DETALLE VENTAS", "VENTAS_DET")]),
        ("SISTEMA", "7B7D7D", [("CONFIGURACIÓN", "CONFIG"), ("VALIDACIÓN DE DATOS", "VALIDACION"), ("HISTORIAL (LOG)", "LOG"),
                               ("PRUEBAS DEL SISTEMA", "PRUEBAS")]),
    ]
    # 2 columnas de grupos, cada grupo: título + 4 botones (2x2)
    for gi, (tit, color, botones) in enumerate(grupos):
        colbase = 2 if gi % 2 == 0 else 9
        fila = 16 + (gi // 2) * 8
        L0 = get_column_letter(colbase)
        ws[f"{L0}{fila}"] = tit
        ws[f"{L0}{fila}"].font = F(10, True, color)
        for bi, (txt, hoja) in enumerate(botones):
            c = colbase + (bi % 2) * 3
            r = fila + 1 + (bi // 2) * 3
            rng = f"{get_column_letter(c)}{r}:{get_column_letter(c + 2)}{r + 1}"
            boton_menu(ws, rng, txt, hoja, color)
    # instrucciones
    r = 49
    seccion(ws, f"B{r}", "INSTRUCCIONES RÁPIDAS", 14, AZUL2)
    pasos = [
        "1. Configure su negocio en CONFIGURACIÓN (nombre, NIT, IVA, saldos iniciales de caja por medio de pago, listas).",
        "2. Cree productos en PRODUCTOS y sus costos adicionales en COSTOS. Cargue el inventario inicial en AJUSTES (Tipo: Inventario inicial).",
        "3. Registre compras con F_COMPRA. El stock aumenta SOLO al confirmar la recepción (Estado recepción = Recibida).",
        "4. Registre ventas con F_VENTA. El stock baja automáticamente; el pago de contado se registra solo como cobro en PAGOS.",
        "5. Abonos de clientes y pagos a proveedores: F_MOVIMIENTOS → Pago / abono. La cartera y la caja se actualizan solas.",
        "6. Gastos, ajustes de inventario, otros movimientos de caja y cierre diario: F_MOVIMIENTOS.",
        "7. Revise DASHBOARD, INFORMES y ANÁLISIS. Use VALIDACIÓN periódicamente y haga COPIA DE SEGURIDAD (botones con macros).",
        "Sin macros (.xlsx): todo el cálculo funciona escribiendo directamente en las tablas. Con macros (.xlsm): formularios, botones, PDF y respaldos.",
    ]
    for i, t in enumerate(pasos):
        ws.merge_cells(f"B{r + 1 + i}:O{r + 1 + i}")
        ws[f"B{r + 1 + i}"] = t
        ws[f"B{r + 1 + i}"].font = F(9, i == 7, "333333" if i < 7 else VERDE)
    ws[f"B{r + 10}"] = ("Aviso: las cifras son estimaciones administrativas basadas en los datos registrados; no constituyen estados "
                        "financieros certificados ni asesoría tributaria. Verifique tarifas de IVA y obligaciones con su contador.")
    ws[f"B{r + 10}"].font = F(8, False, GRIS3, True)
    ws.merge_cells(f"B{r + 10}:O{r + 10}")
    ws.row_dimensions[47].height = 28
    ws["B48"] = "Fila superior: botones COPIA DE SEGURIDAD · VALIDAR · DETECTAR ERRORES · PROTEGER (aparecen al abrir el .xlsm con macros habilitadas)."
    ws["B48"].font = F(8, False, GRIS3, True)


# =====================================================================  INFORMES
def hoja_informes(wb, ws):
    encabezado_hoja(ws, "📑 INFORMES", "Elija período y filtros (vacío = todos). Resumen automático; el detalle lo genera el botón GENERAR INFORME y se exporta a PDF o Excel.", 12)
    anchos(ws, [3, 46, 18, 4, 22, 16, 16, 16, 16, 16, 16, 16])
    seccion(ws, "B5", "FILTROS", 3)
    filtros = [("inf_Periodo", "Período", "Este mes", '"Hoy,Esta semana,Este mes,Mes anterior,Este año,Personalizado"', None),
               ("inf_Desde", "Desde (solo Personalizado)", None, "date", FECHA),
               ("inf_Hasta", "Hasta (solo Personalizado)", None, "date", FECHA),
               ("inf_Producto", "Producto (código)", None, "=lstProductos", None),
               ("inf_Categoria", "Categoría de producto", None, "=lstCategorias", None),
               ("inf_Cliente", "Cliente (código)", None, "=lstClientes", None),
               ("inf_Proveedor", "Proveedor (código)", None, "=lstProveedores", None),
               ("inf_Vendedor", "Vendedor", None, "=lstVendedores", None),
               ("inf_CatGasto", "Categoría de gasto", None, "=lstCatGasto", None),
               ("inf_Tipo", "Tipo de informe detallado", "Ventas", '"Ventas,Compras,Gastos,Inventario,Cartera,Rentabilidad por producto,Cobros y pagos,Pérdidas"', None)]
    for i, (nm, lab, val, dv, fm) in enumerate(filtros):
        r = 6 + i
        etiqueta(ws, f"B{r}", lab, False)
        entrada(ws, f"C{r}", val, fm)
        nombre(wb, nm, abs_ref(ws, f"C{r}"))
        if dv == "date":
            dv_fecha(ws, f"C{r}")
        else:
            lista_dv(ws, f"C{r}", dv)
    seccion(ws, "E5", "PERÍODO EFECTIVO", 3, GRIS3)
    p = "inf_Periodo"
    etiqueta(ws, "E6", "Desde:", False)
    calc(ws, "F6", f'=IF({p}="Hoy",cfg_FechaCorte,IF({p}="Esta semana",cfg_FechaCorte-WEEKDAY(cfg_FechaCorte,2)+1,IF({p}="Este mes",cfg_MesIni,IF({p}="Mes anterior",cfg_MesAntIni,IF({p}="Este año",cfg_AnioIni,IF(inf_Desde="",DATE(2000,1,1),inf_Desde))))))', FECHA, bold=True)
    etiqueta(ws, "E7", "Hasta:", False)
    calc(ws, "F7", f'=IF({p}="Mes anterior",cfg_MesIni-1,IF({p}="Personalizado",IF(inf_Hasta="",cfg_FechaCorte,inf_Hasta),cfg_FechaCorte))', FECHA, bold=True)
    nombre(wb, "inf_D1", abs_ref(ws, "F6"))
    nombre(wb, "inf_D2", abs_ref(ws, "F7"))
    crit = [("ic_P", "inf_Producto"), ("ic_C", "inf_Categoria"), ("ic_Cl", "inf_Cliente"), ("ic_Pr", "inf_Proveedor"),
            ("ic_V", "inf_Vendedor"), ("ic_G", "inf_CatGasto")]
    for i, (nm, src) in enumerate(crit):
        c = f"G{9 + i}"
        ws[c] = f'=IF({src}="","*",{src}&"")'
        ws[c].font = F(8, False, BLANCO)
        nombre(wb, nm, abs_ref(ws, c))
    calc(ws, "E16", '="Informe: "&inf_Periodo&" del "&TEXT(inf_D1,"dd/mm/yyyy")&" al "&TEXT(inf_D2,"dd/mm/yyyy")', bold=True, fondo=None, color=AZUL)
    ws["E16"].value = '="Período: del "&DAY(inf_D1)&"/"&MONTH(inf_D1)&"/"&YEAR(inf_D1)&" al "&DAY(inf_D2)&"/"&MONTH(inf_D2)&"/"&YEAR(inf_D2)'

    V = ('tVentasDet[Fecha],">="&inf_D1,tVentasDet[Fecha],"<="&inf_D2,tVentasDet[Producto],ic_P,tVentasDet[Categoría],ic_C,'
         'tVentasDet[Cliente],ic_Cl,tVentasDet[Vendedor],ic_V')
    C = ('tComprasDet[Estado recepción],"Recibida",tComprasDet[Fecha recepción],">="&inf_D1,tComprasDet[Fecha recepción],"<="&inf_D2,'
         'tComprasDet[Producto],ic_P,tComprasDet[Categoría],ic_C,tComprasDet[Proveedor],ic_Pr')
    G = 'tGastos[Fecha],">="&inf_D1,tGastos[Fecha],"<="&inf_D2,tGastos[Categoría],ic_G'
    A = 'tAjustes[Fecha],">="&inf_D1,tAjustes[Fecha],"<="&inf_D2,tAjustes[Producto],ic_P'
    Pg = 'tPagos[Fecha],">="&inf_D1,tPagos[Fecha],"<="&inf_D2,tPagos[Estado],"Activo"'
    bloques = [
        ("VENTAS", [("Unidades vendidas", f"SUMIFS(tVentasDet[Cantidad efectiva],{V})", NUM2),
                    ("Ventas netas (sin IVA)", f"SUMIFS(tVentasDet[Base efectiva],{V})", COP),
                    ("IVA generado", f"SUMIFS(tVentasDet[IVA efectivo],{V})", COP),
                    ("Total facturado (con IVA)", "C20+C21", COP),
                    ("Costo de ventas", f"SUMIFS(tVentasDet[Costo total],{V})", COP),
                    ("Utilidad bruta", "C20-C23", COP),
                    ("Margen bruto", "IFERROR(C24/C20,0)", PCT)]),
        ("COMPRAS E INVENTARIO", [("Compras recibidas (costo + flete)", f"SUMIFS(tComprasDet[Costo total línea],{C})", COP),
                                  ("Unidades recibidas", f"SUMIFS(tComprasDet[Cantidad recibida],{C})", NUM2),
                                  ("IVA descontable de compras", f"SUMIFS(tComprasDet[IVA valor],{C})", COP),
                                  ("Valor actual del inventario (filtro producto/categoría)", "SUMIFS(inv_Valor,inv_Cod,ic_P,inv_Cat,ic_C)", COP),
                                  ("Pérdidas de inventario", f"SUMIFS(tAjustes[Valor pérdida],{A})", COP)]),
        ("GASTOS, CAJA Y RENTABILIDAD", [("Gastos operacionales", f"SUMIFS(tGastos[Valor efectivo],{G})", COP),
                                         ("Cobros recibidos de clientes", f'SUMIFS(tPagos[Valor],tPagos[Tipo],"Cobro cliente",{Pg})', COP),
                                         ("Pagos a proveedores", f'SUMIFS(tPagos[Valor],tPagos[Tipo],"Pago proveedor",{Pg})', COP),
                                         ("UTILIDAD OPERATIVA ESTIMADA (bruta − gastos − pérdidas)", "C24-C33-C31", COP),
                                         ("Margen operativo", "IFERROR(C36/C20,0)", PCT)]),
    ]
    r = 18
    for tit, filas in bloques:
        seccion(ws, f"B{r}", tit, 2)
        r += 1
        for lab, f, fm in filas:
            r += 0
            etiqueta(ws, f"B{r + 0}", lab, lab.isupper())
            calc(ws, f"C{r}", "=" + f, fm, bold=lab.isupper())
            r += 1
        r += 0
    # r terminó en 38. Ajuste de referencias anterior asumido: ventas C19..C25 ... se verifican abajo
    # tablas por categoría y por vendedor
    seccion(ws, "E18", "VENTAS POR CATEGORÍA (período y filtros)", 6)
    for j, h in enumerate(["Categoría", "Unidades", "Ventas netas", "Costo", "Utilidad", "Margen"]):
        c = ws.cell(19, 5 + j, h)
        c.font = F(9, True, BLANCO)
        c.fill = fill(GRIS3)
    Vc = V.replace("tVentasDet[Categoría],ic_C", "tVentasDet[Categoría],$E{r}")
    for k in range(1, 11):
        rr = 19 + k
        vc = Vc.replace("{r}", str(rr))
        vals = [f'=IFERROR(INDEX(tCategorias[Categoría],{k})&"","")', f'=IF($E{rr}="","",SUMIFS(tVentasDet[Cantidad efectiva],{vc}))',
                f'=IF($E{rr}="","",SUMIFS(tVentasDet[Base efectiva],{vc}))', f'=IF($E{rr}="","",SUMIFS(tVentasDet[Costo total],{vc}))',
                f'=IF($E{rr}="","",G{rr}-H{rr})', f'=IF($E{rr}="","",IFERROR(I{rr}/G{rr},0))']
        for j, (v, fm) in enumerate(zip(vals, [None, NUM2, COP, COP, COP, PCT])):
            c = ws.cell(rr, 5 + j, v)
            c.font = F(9)
            c.border = BORDE
            if fm:
                c.number_format = fm
    seccion(ws, "E31", "VENTAS POR VENDEDOR", 6)
    for j, h in enumerate(["Vendedor", "Unidades", "Ventas netas", "Costo", "Utilidad", "Margen"]):
        c = ws.cell(32, 5 + j, h)
        c.font = F(9, True, BLANCO)
        c.fill = fill(GRIS3)
    Vv = V.replace("tVentasDet[Vendedor],ic_V", "tVentasDet[Vendedor],$E{r}")
    for k in range(1, 7):
        rr = 32 + k
        vc = Vv.replace("{r}", str(rr))
        vals = [f'=IFERROR(INDEX(tVendedores[Vendedor],{k})&"","")', f'=IF($E{rr}="","",SUMIFS(tVentasDet[Cantidad efectiva],{vc}))',
                f'=IF($E{rr}="","",SUMIFS(tVentasDet[Base efectiva],{vc}))', f'=IF($E{rr}="","",SUMIFS(tVentasDet[Costo total],{vc}))',
                f'=IF($E{rr}="","",G{rr}-H{rr})', f'=IF($E{rr}="","",IFERROR(I{rr}/G{rr},0))']
        for j, (v, fm) in enumerate(zip(vals, [None, NUM2, COP, COP, COP, PCT])):
            c = ws.cell(rr, 5 + j, v)
            c.font = F(9)
            c.border = BORDE
            if fm:
                c.number_format = fm
    seccion(ws, "B42", "DETALLE DEL INFORME (botón GENERAR INFORME — tipo según filtro)", 11)
    ws["B43"] = "Presione GENERAR INFORME. Luego EXPORTAR PDF o EXPORTAR EXCEL."
    ws["B43"].font = F(9, False, GRIS3, True)
    nombre(wb, "inf_Detalle", abs_ref(ws, "B44"))
    nombre(wb, "inf_Area", "'INFORMES'!$A$1:$L$43")
    ws.print_title_rows = "1:2"


# =====================================================================  ANALISIS
def hoja_analisis(wb, ws):
    encabezado_hoja(ws, "🧠 INTELIGENCIA DE NEGOCIOS", "Respuestas y recomendaciones calculadas exclusivamente con los datos registrados.", 8)
    anchos(ws, [3, 44, 30, 18, 60, 3, 3, 3])
    seccion(ws, "B5", "PREGUNTAS CLAVE DEL NEGOCIO", 4)
    for j, h in enumerate(["Pregunta", "Respuesta", "Valor", "Recomendación"]):
        c = ws.cell(6, 2 + j, h)
        c.font = F(9, True, BLANCO)
        c.fill = fill(GRIS3)
    top = lambda k: f"INDEX(inv_Nombre,MATCH(LARGE(inv_UtilAcum,{k}),inv_UtilAcum,0))"
    minu = '_xlfn.MINIFS(rot_Unid,rot_Unid,">0")'
    q = [
        ("¿Qué productos dejan más utilidad? (acumulado)",
         f'=IFERROR("1) "&{top(1)}&"  2) "&{top(2)}&"  3) "&{top(3)},"Sin ventas")', "=IFERROR(LARGE(inv_UtilAcum,1),0)", COP,
         f'=IFERROR("Asegure disponibilidad de "&{top(1)}&": es su mayor fuente de utilidad. Evite agotarlo.","Registre ventas para obtener el análisis.")'),
        ("¿Qué productos se están vendiendo menos? (período)",
         f'=IFERROR(INDEX(rot_Nombre,MATCH({minu},rot_Unid,0))&" · y "&COUNTIF(rot_Clase,"SIN MOVIMIENTO")&" sin ventas","Sin datos")',
         f"=IFERROR({minu},0)", NUM2,
         '=IF(COUNTIF(rot_Clase,"SIN MOVIMIENTO")>0,"Hay "&COUNTIF(rot_Clase,"SIN MOVIMIENTO")&" producto(s) sin ventas en "&cfg_DiasRotacion&" días: promoción, combos o descontinuar (ver ROTACIÓN).","Todos los productos registran ventas.")'),
        ("¿Cuánto dinero tengo invertido en inventario?", '="Valor a costo del inventario actual"', "=inv_ValorTotal", COP,
         '="Equivale al "&FIXED(IFERROR(inv_ValorTotal/(inv_ValorTotal+caja_SaldoTotal+car_CxCTotal),0)*100,1)&"% de sus activos corrientes estimados."'),
        ("¿Cuánto debo comprar?", '=repo_N&" producto(s) requieren reposición"', "=repo_Valor", COP,
         '=IF(repo_N>0,"Genere las órdenes desde REPOSICIÓN (botón GENERAR ÓRDENES). Priorice urgencia CRÍTICA y ALTA.","No hay compras urgentes según los mínimos definidos.")'),
        ("¿Cuáles son mis gastos más altos? (año)", '=IFERROR(INDEX(gas_Cat,MATCH(MAX(gas_Anio),gas_Anio,0)),"Sin gastos")', "=MAX(gas_Anio)", COP,
         '=IFERROR("Representa el "&FIXED(MAX(gas_Anio)/gas_TotAnio*100,1)&"% de los gastos del año. Revise si es negociable o reducible.","")'),
        ("¿Cuánto debo vender para no perder dinero? (mensual)", "=eq_Diag", "=eq_PE", COP,
         '="Necesita vender al menos $ "&FIXED(eq_PE,0)&" al mes (≈ $ "&FIXED(eq_PE/30,0)&" diarios). Ventas actuales: $ "&FIXED(eq_Ventas,0)&"."'),
        ("¿Qué clientes tienen cartera vencida?",
         '=IF(COUNTIF(tClientes[Saldo vencido],">1")=0,"Ninguno",COUNTIF(tClientes[Saldo vencido],">1")&" cliente(s). Mayor: "&INDEX(tClientes[Nombre],MATCH(MAX(tClientes[Saldo vencido]),tClientes[Saldo vencido],0)))',
         "=SUM(tClientes[Saldo vencido])", COP,
         '=IF(SUM(tClientes[Saldo vencido])>0,"Gestione cobro y suspenda crédito a clientes con MORA CRÍTICA (>60 días). Ver CARTERA.","Cartera sana.")'),
        ("¿Qué productos están ocupando capital sin rotar?",
         '=IF(SUM(rot_Capital)=0,"Ninguno",INDEX(rot_Nombre,MATCH(MAX(rot_Capital),rot_Capital,0))&" es el de mayor capital detenido")',
         "=SUM(rot_Capital)", COP,
         '=IF(SUM(rot_Capital)>0,"Libere ese capital con promociones o liquidación y no vuelva a comprar hasta que rote.","Sin capital inmovilizado relevante.")'),
        ("¿Mis precios cubren los costos?",
         '=COUNTIF(tCostos[Evaluación],"OK")&" OK · "&COUNTIF(tCostos[Evaluación],"BAJO OBJETIVO")&" bajo objetivo · "&(COUNTIF(tCostos[Evaluación],"BAJO MÍNIMO")+COUNTIF(tCostos[Evaluación],"PÉRDIDA"))&" críticos"',
         '=COUNTIF(tCostos[Evaluación],"BAJO MÍNIMO")+COUNTIF(tCostos[Evaluación],"PÉRDIDA")', NUM,
         '=IF(F15>0,"Revise precios en COSTOS: hay productos por debajo del precio mínimo.","Precios por encima del mínimo. Compare con el precio sugerido para mejorar margen.")'),
        ("¿Ha subido el costo de compra de algún producto?",
         '=COUNTIF(inv_VarCosto,">0.02")&" producto(s) con último costo de compra >2% sobre el costo registrado"',
         '=COUNTIF(inv_VarCosto,">0.02")', NUM,
         '=IF(D16>0,"Actualice el Costo compra en PRODUCTOS y revise el precio de venta de esos productos.","Costos estables.")'),
    ]
    for i, (preg, resp, val, fm, rec) in enumerate(q):
        r = 7 + i
        ws[f"B{r}"] = preg
        ws[f"B{r}"].font = F(9, True, AZUL)
        calc(ws, f"C{r}", resp)
        calc(ws, f"D{r}", val, fm, bold=True)
        calc(ws, f"E{r}", rec, color=VERDE)
        for L in "BCE":
            ws[f"{L}{r}"].alignment = Alignment(wrap_text=True, vertical="center")
        ws.row_dimensions[r].height = 38
    # ajustar referencias usadas en recomendaciones 9 y 10
    ws["E15"] = ws["E15"].value.replace("F15", "D15")
    # estado de resultados
    seccion(ws, "B19", "ESTADO DE RESULTADOS SIMPLIFICADO (estimado)", 3)
    for j, h in enumerate(["Concepto", "Mes de análisis", "Año a la fecha"]):
        c = ws.cell(20, 2 + j, h)
        c.font = F(9, True, BLANCO)
        c.fill = fill(GRIS3)
    rm = 'tVentasDet[Fecha],">="&cfg_MesIni,tVentasDet[Fecha],"<"&cfg_MesFin'
    ra = 'tVentasDet[Fecha],">="&cfg_AnioIni,tVentasDet[Fecha],"<="&cfg_FechaCorte'
    am = 'tAjustes[Fecha],">="&cfg_MesIni,tAjustes[Fecha],"<"&cfg_MesFin'
    aa = 'tAjustes[Fecha],">="&cfg_AnioIni,tAjustes[Fecha],"<="&cfg_FechaCorte'
    er = [("Ingresos: ventas netas (sin IVA)", f"SUMIFS(tVentasDet[Base efectiva],{rm})", f"SUMIFS(tVentasDet[Base efectiva],{ra})"),
          ("(−) Costo de ventas", f"SUMIFS(tVentasDet[Costo total],{rm})", f"SUMIFS(tVentasDet[Costo total],{ra})"),
          ("► UTILIDAD BRUTA", "C21-C22", "D21-D22"),
          ("(−) Gastos operacionales", "gas_TotMes", "gas_TotAnio"),
          ("(−) Pérdidas de inventario", f"SUMIFS(tAjustes[Valor pérdida],{am})", f"SUMIFS(tAjustes[Valor pérdida],{aa})"),
          ("► UTILIDAD OPERATIVA ESTIMADA", "C23-C24-C25", "D23-D24-D25"),
          ("Margen operativo", "IFERROR(C26/C21,0)", "IFERROR(D26/D21,0)")]
    for i, (lab, a, b) in enumerate(er):
        r = 21 + i
        etiqueta(ws, f"B{r}", lab, lab.startswith("►"))
        fm = PCT if i == 6 else COP
        calc(ws, f"C{r}", "=" + a, fm, bold=lab.startswith("►"))
        calc(ws, f"D{r}", "=" + b, fm, bold=lab.startswith("►"))
    seccion(ws, "B30", "SITUACIÓN FINANCIERA ESTIMADA (a la fecha)", 3)
    sf = [("ACTIVO: Caja y bancos (dinero disponible)", "caja_SaldoTotal"), ("ACTIVO: Cuentas por cobrar", "car_CxCTotal"),
          ("ACTIVO: Inventario (a costo)", "inv_ValorTotal"), ("ACTIVO: Anticipos a proveedores", "SUM(tCompras[Anticipo])"),
          ("► TOTAL ACTIVOS ESTIMADOS", "SUM(C31:C34)"),
          ("PASIVO: Cuentas por pagar a proveedores", "car_CxPTotal"),
          ("PASIVO: IVA neto acumulado (generado − descontable)", 'MAX(0,SUM(tVentasDet[IVA efectivo])-SUMIFS(tComprasDet[IVA valor],tComprasDet[Estado recepción],"Recibida"))'),
          ("► TOTAL PASIVOS ESTIMADOS", "C36+C37"),
          ("► PATRIMONIO ESTIMADO (activos − pasivos)", "C35-C38")]
    for i, (lab, f) in enumerate(sf):
        r = 31 + i
        etiqueta(ws, f"B{r}", lab, lab.startswith("►"))
        calc(ws, f"C{r}", "=" + f, COP, bold=lab.startswith("►"))
    ws["D37"] = "No descuenta declaraciones de IVA ya pagadas (si las registra como gasto 'Impuestos')."
    ws["D37"].font = F(8, False, GRIS3, True)
    seccion(ws, "B41", "CONCEPTOS (para interpretar correctamente)", 4, GRIS3)
    conceptos = ["INGRESO: valor de las ventas sin IVA. El IVA cobrado NO es ingreso: es un pasivo con la DIAN.",
                 "COSTO: lo que costó la mercancía vendida (costo de ventas). Comprar mercancía NO es gasto: aumenta el inventario (activo).",
                 "GASTO: erogaciones para operar (arriendo, nómina, servicios...). Disminuyen la utilidad.",
                 "ACTIVO: lo que tiene (caja, cartera, inventario). PASIVO: lo que debe (proveedores, impuestos).",
                 "UTILIDAD: ingresos − costos − gastos. FLUJO DE CAJA: dinero que realmente entra y sale (cobros y pagos).",
                 "Una venta a crédito genera ingreso y utilidad, pero NO dinero hasta que se cobra. Por eso utilidad ≠ caja.",
                 "Aviso: información administrativa estimada. No es un estado financiero certificado ni asesoría tributaria."]
    for i, t in enumerate(conceptos):
        ws.merge_cells(f"B{42 + i}:E{42 + i}")
        ws[f"B{42 + i}"] = t
        ws[f"B{42 + i}"].font = F(9, i == 6, "333333")


# =====================================================================  LOGISTICA
def hoja_logistica(wb, ws):
    encabezado_hoja(ws, "📐 LOGÍSTICA Y CUBICAJE", "Calculadora de carga por producto y resumen de despachos. Celdas amarillas = datos; vacías toman el valor del producto.", 13)
    anchos(ws, [3, 34, 16, 4, 30, 16, 3, 11, 11, 14, 11, 11, 11])
    seccion(ws, "B5", "CALCULADORA DE CUBICAJE", 2)
    P = "MATCH(lg_Producto,tProductos[Código],0)"
    ins = [("lg_Producto", "Producto (opcional)", "P008", None, "=lstProductos"), ("lg_Cantidad", "Cantidad de unidades a despachar", 240, NUM, None),
           ("lg_Largo", "Largo de la caja cm (vacío = del producto)", None, NUM, None), ("lg_Ancho", "Ancho de la caja cm", None, NUM, None),
           ("lg_Alto", "Alto de la caja cm", None, NUM, None), ("lg_PesoCaja", "Peso bruto por caja kg", None, NUM2, None),
           ("lg_PesoU", "Peso neto por unidad kg", None, NUM3, None), ("lg_UPC", "Unidades por caja", None, NUM, None),
           ("lg_CPE", "Cajas por estiba", None, NUM, None), ("lg_Vehiculo", "Vehículo", "Camioneta 1 t", None, "=lstVehiculos"),
           ("lg_CostoViaje", "Costo del viaje (vacío = tarifa del vehículo)", None, COP, None)]
    for i, (nm, lab, val, fm, dv) in enumerate(ins):
        r = 6 + i
        etiqueta(ws, f"B{r}", lab, False)
        entrada(ws, f"C{r}", val, fm)
        nombre(wb, nm, abs_ref(ws, f"C{r}"))
        if dv:
            lista_dv(ws, f"C{r}", dv)
    efect = lambda nm, col: f'IF({nm}<>"",{nm},IFERROR(INDEX(tProductos[{col}],{P}),0))'
    V = "MATCH(lg_Vehiculo,tVehiculos[Vehículo],0)"
    seccion(ws, "E5", "RESULTADOS", 2, VERDE)
    res = [("Largo × ancho × alto efectivos (cm)", f'={efect("lg_Largo", "Largo caja cm")}&" × "&{efect("lg_Ancho", "Ancho caja cm")}&" × "&{efect("lg_Alto", "Alto caja cm")}', None, None),
           ("Volumen por caja m³", f'=ROUND({efect("lg_Largo", "Largo caja cm")}*{efect("lg_Ancho", "Ancho caja cm")}*{efect("lg_Alto", "Alto caja cm")}/1000000,4)', '0.0000', "lg_rVolCaja"),
           ("Unidades por caja", f'=MAX(1,{efect("lg_UPC", "Unid por caja")})', NUM, "lg_rUPC"),
           ("Cantidad de cajas", "=ROUNDUP(lg_Cantidad/lg_rUPC,0)", NUM, "lg_rCajas"),
           ("Volumen total m³", "=ROUND(lg_rCajas*lg_rVolCaja,3)", NUM3, "lg_rVol"),
           ("Peso neto total kg", f'=ROUND(lg_Cantidad*{efect("lg_PesoU", "Peso unidad kg")},2)', NUM2, None),
           ("Peso bruto total kg", f'=ROUND(lg_rCajas*{efect("lg_PesoCaja", "Peso caja kg")},2)', NUM2, "lg_rPeso"),
           ("Estibas necesarias", f'=IFERROR(ROUNDUP(lg_rCajas/{efect("lg_CPE", "Cajas por estiba")},0),0)', NUM, None),
           ("Capacidad del vehículo kg / m³", f'=IFERROR(INDEX(tVehiculos[Capacidad kg],{V}),0)&" kg / "&IFERROR(INDEX(tVehiculos[Capacidad m3],{V}),0)&" m³"', None, None),
           ("Ocupación por peso", f"=IFERROR(lg_rPeso/INDEX(tVehiculos[Capacidad kg],{V}),0)", PCT, "lg_rOcP"),
           ("Ocupación por volumen", f"=IFERROR(lg_rVol/INDEX(tVehiculos[Capacidad m3],{V}),0)", PCT, "lg_rOcV"),
           ("Capacidad disponible m³ (un viaje)", f"=IFERROR(MAX(0,INDEX(tVehiculos[Capacidad m3],{V})-lg_rVol),0)", NUM3, None),
           ("Cajas máximas por viaje", f'=IFERROR(MIN(INT(INDEX(tVehiculos[Capacidad m3],{V})/lg_rVolCaja),INT(INDEX(tVehiculos[Capacidad kg],{V})/{efect("lg_PesoCaja", "Peso caja kg")})),0)', NUM, "lg_rMax"),
           ("Viajes necesarios", "=IFERROR(ROUNDUP(lg_rCajas/lg_rMax,0),0)", NUM, "lg_rViajes"),
           ("Costo total del transporte", f'=lg_rViajes*IF(lg_CostoViaje<>"",lg_CostoViaje,IFERROR(INDEX(tVehiculos[Costo viaje],{V}),0))', COP, "lg_rCosto"),
           ("COSTO LOGÍSTICO POR UNIDAD", "=IFERROR(lg_rCosto/lg_Cantidad,0)", COP2, None),
           ("Diagnóstico", '=IF(lg_rViajes>1,"⚠ No cabe en un viaje: requiere "&lg_rViajes&" viajes",IF(MAX(lg_rOcP,lg_rOcV)>0.9,"Carga casi completa ("&FIXED(MAX(lg_rOcP,lg_rOcV)*100,0)&"%)","✔ Cabe con capacidad disponible"))', None, None)]
    for i, (lab, f, fm, nm) in enumerate(res):
        r = 6 + i
        etiqueta(ws, f"E{r}", lab, lab.isupper() or lab == "Diagnóstico")
        calc(ws, f"F{r}", f, fm, bold=lab.isupper())
        if nm:
            nombre(wb, nm, abs_ref(ws, f"F{r}"))
    ws.merge_cells("F22:M22")
    seccion(ws, "B25", "RESUMEN DE DESPACHOS (desde la hoja DESPACHOS)", 12)
    H = ["Despacho", "Fecha", "Vehículo", "Destino", "Peso kg", "Volumen m³", "Ocup. peso", "Ocup. volumen", "Costo viaje", "Estado", "Alerta"]
    cols = ["B", "C", "E", "F", "H", "I", "J", "K", "L", "M", "N"]
    srcs = ["Despacho", "Fecha", "Vehículo", "Destino", "Peso despacho kg", "Volumen despacho m3", "Ocupación peso", "Ocupación volumen",
            "Costo viaje", "Estado", "Alerta"]
    fms = [None, FECHA, None, None, NUM2, NUM3, PCT, PCT, COP, None, None]
    ws.column_dimensions["N"].width = 12
    for j, h in enumerate(H):
        c = ws[f"{cols[j]}26"]
        c.value = h
        c.font = F(9, True, BLANCO)
        c.fill = fill(GRIS3)
    for k in range(1, 21):
        r = 26 + k
        m = f"MATCH({k},tDespachos[N resumen],0)"
        for j, s in enumerate(srcs):
            c = ws[f"{cols[j]}{r}"]
            c.value = f'=IFERROR(INDEX(tDespachos[{s}],{m}),"")'
            c.font = F(9)
            c.border = BORDE
            if fms[j]:
                c.number_format = fms[j]
    _sem(ws, "N27:N46", "SOBRECARGA", BLANCO, ROJO)


# =====================================================================  VALIDACION
def hoja_validacion(wb, ws):
    encabezado_hoja(ws, "🛡 VALIDACIÓN Y DETECCIÓN DE ERRORES", "Controles automáticos de integridad. El botón VALIDAR DATOS (macro) genera además un listado detallado fila por fila.", 6)
    anchos(ws, [3, 62, 12, 16, 50, 3])
    H = ["Control", "Casos", "Estado", "Dónde corregir"]
    for j, h in enumerate(H):
        c = ws.cell(5, 2 + j, h)
        c.font = F(9, True, BLANCO)
        c.fill = fill(GRIS3)
    chk = [
        ("Códigos de producto duplicados", 'COUNTIF(tProductos[Código duplicado],"DUPLICADO")', "PRODUCTOS"),
        ("Códigos de cliente duplicados", 'COUNTIF(tClientes[Alerta],"CÓDIGO DUPLICADO")', "CLIENTES"),
        ("Códigos de proveedor duplicados", "SUMPRODUCT((COUNTIF(tProveedores[Código],tProveedores[Código])>1)*1)", "PROVEEDORES"),
        ("Facturas de venta duplicadas", 'COUNTIF(tVentas[Control],"FACTURA DUPLICADA")', "VENTAS"),
        ("Facturas sin líneas de detalle", 'COUNTIF(tVentas[Control],"SIN DETALLE")', "VENTAS / VENTAS_DET"),
        ("Ventas con cliente inexistente", 'COUNTIF(tVentas[Nombre cliente],"¿Cliente no existe?")', "VENTAS"),
        ("Líneas de venta con producto inexistente", 'COUNTIF(tVentasDet[Nombre producto],"¿No existe?")', "VENTAS_DET"),
        ("Líneas de venta con factura inexistente", 'COUNTIF(tVentasDet[Estado factura],"NO EXISTE")', "VENTAS_DET"),
        ("Compras duplicadas o sin detalle o sin fecha de recepción", 'COUNTIF(tCompras[Control],"?*")', "COMPRAS"),
        ("Líneas de compra con producto o compra inexistente", 'COUNTIF(tComprasDet[Nombre producto],"¿No existe?")+COUNTIF(tComprasDet[Estado recepción],"NO EXISTE")', "COMPRAS_DET"),
        ("Pagos/cobros con documento inexistente", 'COUNTIF(tPagos[Tercero],"¿*")', "PAGOS"),
        ("Facturas cobradas de más (saldo a favor del cliente)", 'COUNTIF(tVentas[Estado pago],"Saldo a favor")', "PAGOS"),
        ("Compras pagadas de más", 'COUNTIF(tCompras[Saldo],"<-1")', "PAGOS"),
        ("Productos con stock NEGATIVO", 'COUNTIF(inv_Estado,"NEGATIVO")', "AJUSTES / VENTAS"),
        ("Ajustes con tipo no válido", "COUNTIF(tAjustes[Signo],0)", "AJUSTES"),
        ("Ajustes o despachos con producto inexistente", 'COUNTIF(tAjustes[Nombre producto],"¿No existe?")', "AJUSTES"),
        ("Movimientos de productos que no están en el maestro (stock no cuadra)",
         'IF(ABS(SUM(tAjustes[Cantidad neta])+SUM(tComprasDet[Cantidad recibida])-SUM(tVentasDet[Cantidad efectiva])-SUM(inv_Stock))>0.001,1,0)', "VENTAS_DET / COMPRAS_DET / AJUSTES"),
        ("Productos con precio de venta menor al costo", 'COUNTIF(tCostos[Evaluación],"PÉRDIDA")', "COSTOS / PRODUCTOS"),
        ("Productos sin registro en COSTOS (informativo, no suma)", 'SUMPRODUCT((COUNTIF(tCostos[Código],tProductos[Código])=0)*1)', "COSTOS"),
        ("Caja: saldo total no cuadra con los movimientos", 'IF(caja_Control="✔ Cuadra",0,1)', "CAJA"),
        ("Celdas con error de fórmula en tablas principales",
         "SUMPRODUCT(--ISERROR(tVentas[Total factura]))+SUMPRODUCT(--ISERROR(tVentasDet[Total línea]))+SUMPRODUCT(--ISERROR(tCompras[Total compra]))+SUMPRODUCT(--ISERROR(tComprasDet[Costo total línea]))+SUMPRODUCT(--ISERROR(inv_Stock))", "Revisar columnas calculadas (no sobrescribir fórmulas)"),
        ("Más productos que filas de cálculo en INVENTARIO (ampliar)", "IF(COUNTA(tProductos[Código])>ROWS(inv_Cod),1,0)", "Ejecutar macro AmpliarFilasCalculo"),
    ]
    for i, (lab, f, donde) in enumerate(chk):
        r = 6 + i
        ws[f"B{r}"] = lab
        ws[f"B{r}"].font = F(9)
        calc(ws, f"C{r}", "=" + f, NUM, bold=True)
        info = "informativo" in lab
        calc(ws, f"D{r}", f'=IF(C{r}=0,"✔ OK","{"ℹ Revisar" if info else "✖ ERROR"}")', bold=True, fondo=None)
        ws[f"E{r}"] = donde
        ws[f"E{r}"].font = F(9, False, GRIS3)
    last = 6 + len(chk) - 1
    etiqueta(ws, f"B{last + 1}", "TOTAL DE PROBLEMAS DETECTADOS", True)
    # el control informativo (productos sin costo) no suma
    info_r = 6 + [i for i, c in enumerate(chk) if "informativo" in c[0]][0]
    _total(ws, f"C{last + 1}", f"=SUM(C6:C{last})-C{info_r}", NUM)
    nombre(wb, "val_Total", abs_ref(ws, f"C{last + 1}"))
    ws.conditional_formatting.add(f"D6:D{last}", FormulaRule(formula=['LEFT($D6,1)="✖"'], font=Font(color=ROJO, bold=True), fill=fill(ROJO2)))
    ws.conditional_formatting.add(f"D6:D{last}", FormulaRule(formula=['LEFT($D6,1)="✔"'], font=Font(color=VERDE, bold=True)))
    seccion(ws, f"B{last + 4}", "DETALLE DE LA ÚLTIMA VALIDACIÓN (macro VALIDAR DATOS)", 4)
    for j, h in enumerate(["Hoja / tabla", "Fila", "Campo", "Problema"]):
        c = ws.cell(last + 5, 2 + j, h)
        c.font = F(9, True, BLANCO)
        c.fill = fill(GRIS3)
    nombre(wb, "val_Detalle", abs_ref(ws, f"B{last + 6}"))
