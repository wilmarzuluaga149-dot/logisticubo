# -*- coding: utf-8 -*-
"""Hojas de cálculo (protegidas): INVENTARIO, ROTACION, REPOSICION, KARDEX, CARTERA, CAJA, EQUILIBRIO."""
from np_lib import *
from openpyxl.utils import get_column_letter
from openpyxl.formatting.rule import CellIsRule, FormulaRule

NP = 300        # filas de productos pre-calculadas (ampliable con la macro AmpliarFilasCalculo)
R0 = 7          # primera fila de datos en hojas calculadas
RN = R0 + NP - 1


def _hdr(ws, fila, headers, widths=None, color=GRIS3):
    for j, h in enumerate(headers):
        c = ws.cell(fila, 1 + j, h)
        c.font = F(9, True, BLANCO)
        c.fill = fill(color)
        c.alignment = Alignment(horizontal="center", vertical="center", wrap_text=True)
        c.border = BORDE
    ws.row_dimensions[fila].height = 36
    if widths:
        anchos(ws, widths)


def _fila(ws, r, formulas, fmts):
    for j, f in enumerate(formulas):
        c = ws.cell(r, 1 + j, f)
        c.font = F(9)
        c.border = BORDE
        if fmts[j]:
            c.number_format = fmts[j]


def _total(ws, cell, formula, fmt=COP, label=None):
    c = ws[cell]
    c.value = formula
    c.font = F(10, True, AZUL)
    c.fill = fill(CELESTE)
    c.number_format = fmt
    c.border = BORDE


def _sem(ws, rng, texto, color_txt, color_fondo, tipo="equal"):
    ws.conditional_formatting.add(rng, CellIsRule(operator="equal", formula=[f'"{texto}"'],
                                                  font=Font(color=color_txt, bold=True), fill=fill(color_fondo)))


# =====================================================================  INVENTARIO
def hoja_inventario(wb, ws):
    H = ["#", "Código", "Nombre", "Categoría", "Unidad", "Ubicación", "Estado producto",
         "Ajustes netos (incl. inicial)", "Entradas compras recibidas", "Devoluciones netas", "Salidas por ventas",
         "STOCK ACTUAL", "Stock mínimo", "Stock máximo", "En tránsito (compras pendientes)", "Disponible proyectado",
         "Costo unitario real", "Valor inventario (costo)", "Precio venta", "Valor a precio de venta", "Estado stock",
         "Próximo vencimiento de lote", "Unid. vendidas mes", "Ventas mes (sin IVA)", "Utilidad bruta mes",
         "Utilidad bruta acumulada", "Demanda diaria (período)", "Necesita reponer", "N.º reposición", "Clave top",
         "Último costo de compra", "Variación vs costo registrado", "Proveedor", "Tiempo entrega días", "Unid por caja"]
    W = [5, 9, 26, 14, 8, 8, 9, 10, 10, 10, 10, 10, 8, 8, 10, 10, 11, 13, 11, 13, 11, 11, 9, 12, 12, 13, 9, 9, 8, 8, 11, 10, 8, 8, 7]
    encabezado_hoja(ws, "📊 INVENTARIO — EXISTENCIAS CALCULADAS POR MOVIMIENTOS",
                    "Stock = Ajustes (incl. inventario inicial) + Compras RECIBIDAS + Devoluciones − Ventas ACTIVAS.  Nada se escribe a mano en esta hoja.",
                    len(H))
    enlace(ws, "D3", "➜ Kardex", "KARDEX")
    enlace(ws, "F3", "➜ Reposición", "REPOSICION")
    _hdr(ws, 6, H, W)
    for k in range(1, NP + 1):
        r = R0 + k - 1
        g = lambda f: f'=IF($B{r}="","",{f})'
        PI = f"$A{r}"
        venc_c = f'_xlfn.MINIFS(tComprasDet[Fecha vencimiento],tComprasDet[Producto],$B{r},tComprasDet[Estado recepción],"Recibida",tComprasDet[Fecha vencimiento],">="&cfg_FechaCorte)'
        venc_a = f'_xlfn.MINIFS(tAjustes[Fecha vencimiento],tAjustes[Producto],$B{r},tAjustes[Signo],">0",tAjustes[Fecha vencimiento],">="&cfg_FechaCorte)'
        mes = f'tVentasDet[Producto],$B{r},tVentasDet[Fecha],">="&cfg_MesIni,tVentasDet[Fecha],"<"&cfg_MesFin'
        f = [
            k,
            f'=IFERROR(INDEX(tProductos[Código],{PI})&"","")',
            g(f"INDEX(tProductos[Nombre],{PI})"),
            g(f'INDEX(tProductos[Categoría],{PI})&""'),
            g(f'INDEX(tProductos[Unidad],{PI})&""'),
            g(f'INDEX(tProductos[Ubicación],{PI})&""'),
            g(f'INDEX(tProductos[Estado],{PI})&""'),
            g(f'SUMIFS(tAjustes[Cantidad neta],tAjustes[Producto],$B{r},tAjustes[Grupo],"Ajuste")'),
            g(f"SUMIFS(tComprasDet[Cantidad recibida],tComprasDet[Producto],$B{r})"),
            g(f'SUMIFS(tAjustes[Cantidad neta],tAjustes[Producto],$B{r},tAjustes[Grupo],"Devolución")'),
            g(f"SUMIFS(tVentasDet[Cantidad efectiva],tVentasDet[Producto],$B{r})"),
            g(f"H{r}+I{r}+J{r}-K{r}"),
            g(f"INDEX(tProductos[Stock mínimo],{PI})"),
            g(f"INDEX(tProductos[Stock máximo],{PI})"),
            g(f"SUMIFS(tComprasDet[Cantidad en tránsito],tComprasDet[Producto],$B{r})"),
            g(f"L{r}+O{r}"),
            g(f"INDEX(tProductos[Costo unitario real],{PI})"),
            g(f"ROUND(MAX(L{r},0)*Q{r},0)"),
            g(f"INDEX(tProductos[Precio venta],{PI})"),
            g(f"ROUND(MAX(L{r},0)*S{r},0)"),
            g(f'IF(G{r}="Inactivo","INACTIVO",IF(L{r}<0,"NEGATIVO",IF(L{r}=0,"AGOTADO",IF(L{r}<=M{r},"BAJO",IF(AND(N{r}>0,L{r}>N{r}),"SOBRESTOCK","NORMAL")))))'),
            g(f'IF(AND({venc_c}=0,{venc_a}=0),"",IF({venc_c}=0,{venc_a},IF({venc_a}=0,{venc_c},MIN({venc_c},{venc_a}))))'),
            g(f"SUMIFS(tVentasDet[Cantidad efectiva],{mes})"),
            g(f"SUMIFS(tVentasDet[Base efectiva],{mes})"),
            g(f"SUMIFS(tVentasDet[Utilidad bruta],{mes})"),
            g(f"SUMIFS(tVentasDet[Utilidad bruta],tVentasDet[Producto],$B{r})"),
            g(f'SUMIFS(tVentasDet[Cantidad efectiva],tVentasDet[Producto],$B{r},tVentasDet[Fecha],">="&cfg_PerIni,tVentasDet[Fecha],"<="&cfg_FechaCorte)/cfg_DiasRotacion'),
            f'=AND($B{r}<>"",$G{r}="Activo",$P{r}<=$M{r})',
            f'=IF(AB{r},COUNTIF($AB${R0}:AB{r},TRUE),"")',
            f'=IF(OR($B{r}="",N(W{r})<=0),"",IF(OR(dash_Cat="(Todas)",$D{r}=dash_Cat),W{r}+$A{r}/100000,""))',
            g(f'IFERROR(LOOKUP(2,1/((tComprasDet[Producto]=$B{r})*(tComprasDet[Estado recepción]="Recibida")),tComprasDet[Costo aplicado]),"")'),
            f'=IF(OR($B{r}="",AE{r}=""),"",IFERROR(AE{r}/INDEX(tProductos[Costo compra],{PI})-1,""))',
            g(f'INDEX(tProductos[Proveedor principal],{PI})&""'),
            g(f"N(INDEX(tProductos[Tiempo entrega días],{PI}))"),
            g(f"MAX(1,N(INDEX(tProductos[Unid por caja],{PI})))"),
        ]
        fm = [None, None, None, None, None, None, None, NUM2, NUM2, NUM2, NUM2, NUM2, NUM, NUM, NUM2, NUM2, COP, COP, COP, COP,
              None, FECHA, NUM2, COP, COP, COP, NUM2, None, None, None, COP, PCT, None, NUM, NUM]
        _fila(ws, r, f, fm)
        ws.cell(r, 12).font = F(9, True, AZUL)
    # totales
    etiqueta(ws, "C4", "TOTALES:", True, 10, AZUL)
    _total(ws, "L4", f"=SUM(L{R0}:L{RN})", NUM)
    _total(ws, "R4", f"=SUM(R{R0}:R{RN})")
    _total(ws, "T4", f"=SUM(T{R0}:T{RN})")
    _total(ws, "X4", f"=SUM(X{R0}:X{RN})")
    _total(ws, "Z4", f"=SUM(Z{R0}:Z{RN})")
    ws["U4"] = f'=COUNTIF(U{R0}:U{RN},"AGOTADO")&" agotados · "&COUNTIF(U{R0}:U{RN},"BAJO")&" bajos"'
    ws["U4"].font = F(9, True, ROJO)
    ws["H4"] = f'="Productos: "&COUNTIF(B{R0}:B{RN},"?*")'
    ws["H4"].font = F(9, True, AZUL)
    ws["AB4"] = "Columnas auxiliares →"
    ws["AB4"].font = F(8, False, GRIS3, True)
    for nm, L in [("inv_Cod", "B"), ("inv_Nombre", "C"), ("inv_Cat", "D"), ("inv_Estado0", "G"), ("inv_Stock", "L"),
                  ("inv_Min", "M"), ("inv_Max", "N"), ("inv_Transito", "O"), ("inv_Costo", "Q"), ("inv_Valor", "R"),
                  ("inv_ValorVenta", "T"), ("inv_Estado", "U"), ("inv_Vence", "V"), ("inv_UnidMes", "W"),
                  ("inv_VentasMes", "X"), ("inv_UtilMes", "Y"), ("inv_UtilAcum", "Z"), ("inv_Dem", "AA"),
                  ("inv_NRepo", "AC"), ("inv_Top", "AD"), ("inv_UltCosto", "AE"), ("inv_VarCosto", "AF"),
                  ("inv_Prov", "AG"), ("inv_TE", "AH"), ("inv_UPC", "AI")]:
        nombre(wb, nm, f"'{ws.title}'!${L}${R0}:${L}${RN}")
    nombre(wb, "inv_ValorTotal", abs_ref(ws, "R4"))
    rng = f"U{R0}:U{RN}"
    _sem(ws, rng, "AGOTADO", ROJO, ROJO2)
    _sem(ws, rng, "NEGATIVO", BLANCO, ROJO)
    _sem(ws, rng, "BAJO", AMBAR, AMBAR2)
    _sem(ws, rng, "NORMAL", VERDE, VERDE2)
    _sem(ws, rng, "SOBRESTOCK", AZUL3, CELESTE)
    ws.conditional_formatting.add(f"V{R0}:V{RN}", FormulaRule(
        formula=[f'AND(V{R0}<>"",V{R0}-cfg_FechaCorte<=cfg_DiasAlertaVence)'], font=Font(color=ROJO, bold=True), fill=fill(ROJO2)))
    ws.freeze_panes = "D7"
    ws.auto_filter.ref = f"A6:AI{RN}"
    for L in ["AB", "AC", "AD"]:
        ws.column_dimensions[L].hidden = True


# =====================================================================  ROTACION
def hoja_rotacion(wb, ws):
    H = ["#", "Código", "Nombre", "Categoría", "Unidades vendidas período", "Ventas período (sin IVA)", "Costo de ventas período",
         "Utilidad bruta período", "Margen bruto", "Stock actual", "Valor inventario", "Rotación en el período (veces)",
         "Días de inventario", "Última venta", "Días sin vender", "Clasificación rotación", "Participación en ventas",
         "% acumulado", "Clase ABC", "Capital inmovilizado", "Recomendación"]
    W = [5, 9, 26, 14, 11, 14, 14, 13, 9, 10, 13, 11, 10, 11, 9, 14, 10, 10, 7, 13, 44]
    encabezado_hoja(ws, "🔄 ROTACIÓN DE INVENTARIO Y CLASIFICACIÓN ABC",
                    "Período = últimos N días hasta la fecha de análisis (N en CONFIG). ABC por participación acumulada en ventas.", len(H))
    _hdr(ws, 6, H, W)
    S = f"$F${R0}:$F${RN}"
    for k in range(1, NP + 1):
        r = R0 + k - 1
        g = lambda f: f'=IF($B{r}="","",{f})'
        per = f'tVentasDet[Producto],$B{r},tVentasDet[Fecha],">="&cfg_PerIni,tVentasDet[Fecha],"<="&cfg_FechaCorte'
        ult = f'_xlfn.MAXIFS(tVentasDet[Fecha],tVentasDet[Producto],$B{r},tVentasDet[Cantidad efectiva],">0")'
        f = [
            k, f"=INVENTARIO!B{r}", f"=INVENTARIO!C{r}", f"=INVENTARIO!D{r}",
            g(f"SUMIFS(tVentasDet[Cantidad efectiva],{per})"),
            g(f"SUMIFS(tVentasDet[Base efectiva],{per})"),
            g(f"SUMIFS(tVentasDet[Costo total],{per})"),
            g(f"F{r}-G{r}"),
            g(f"IFERROR(H{r}/F{r},0)"),
            g(f"INVENTARIO!L{r}"),
            g(f"INVENTARIO!R{r}"),
            g(f"IFERROR(G{r}/K{r},0)"),
            g(f'IF(E{r}>0,ROUND(MAX(J{r},0)/(E{r}/cfg_DiasRotacion),0),"")'),
            g(f'IF({ult}=0,"",{ult})'),
            g(f'IF(N{r}="","",cfg_FechaCorte-N{r})'),
            g(f'IF(E{r}<=0,"SIN MOVIMIENTO",IF(M{r}<=cfg_RotAlta,"ALTA",IF(M{r}<=cfg_RotMedia,"MEDIA","BAJA")))'),
            g(f"IFERROR(F{r}/SUM({S}),0)"),
            g(f'IFERROR((SUMIF({S},">"&F{r})+F{r})/SUM({S}),0)'),
            g(f'IF(F{r}<=0,"C",IF(IFERROR(SUMIF({S},">"&F{r})/SUM({S}),1)<cfg_ABC_A,"A",IF(IFERROR(SUMIF({S},">"&F{r})/SUM({S}),1)<cfg_ABC_B,"B","C")))'),
            g(f'IF(OR(P{r}="SIN MOVIMIENTO",P{r}="BAJA"),K{r},0)'),
            g(f'IF(P{r}="SIN MOVIMIENTO",IF(J{r}>0,"Liquidar o promocionar: capital detenido sin ventas","Evaluar si se descontinúa"),'
              f'IF(P{r}="BAJA","Reducir compras y crear promoción",IF(P{r}="ALTA",IF(S{r}="A","Prioridad máxima: no permitir agotados",'
              f'"Reponer con frecuencia"),"Reposición normal")))'),
        ]
        fm = [None, None, None, None, NUM2, COP, COP, COP, PCT, NUM2, COP, NUM2, NUM, FECHA, NUM, None, PCT, PCT, None, COP, None]
        _fila(ws, r, f, fm)
    etiqueta(ws, "C4", "TOTALES:", True, 10, AZUL)
    for L in "FGHK":
        _total(ws, f"{L}4", f"=SUM({L}{R0}:{L}{RN})")
    _total(ws, "T4", f"=SUM(T{R0}:T{RN})")
    ws["P4"] = (f'="Alta "&COUNTIF(P{R0}:P{RN},"ALTA")&" · Media "&COUNTIF(P{R0}:P{RN},"MEDIA")&" · Baja "&COUNTIF(P{R0}:P{RN},"BAJA")'
                f'&" · Sin mov. "&COUNTIF(P{R0}:P{RN},"SIN MOVIMIENTO")')
    ws["S4"] = f'="A:"&COUNTIF(S{R0}:S{RN},"A")&" B:"&COUNTIF(S{R0}:S{RN},"B")&" C:"&COUNTIF(S{R0}:S{RN},"C")'
    for c in ("P4", "S4"):
        ws[c].font = F(9, True, AZUL)
    for nm, L in [("rot_Cod", "B"), ("rot_Nombre", "C"), ("rot_Unid", "E"), ("rot_Ventas", "F"), ("rot_Util", "H"),
                  ("rot_Margen", "I"), ("rot_Dias", "M"), ("rot_Clase", "P"), ("rot_ABC", "S"), ("rot_Capital", "T")]:
        nombre(wb, nm, f"'{ws.title}'!${L}${R0}:${L}${RN}")
    rng = f"P{R0}:P{RN}"
    _sem(ws, rng, "ALTA", VERDE, VERDE2)
    _sem(ws, rng, "MEDIA", AZUL3, CELESTE)
    _sem(ws, rng, "BAJA", AMBAR, AMBAR2)
    _sem(ws, rng, "SIN MOVIMIENTO", ROJO, ROJO2)
    _sem(ws, f"S{R0}:S{RN}", "A", VERDE, VERDE2)
    ws.freeze_panes = "D7"
    ws.auto_filter.ref = f"A6:U{RN}"


# =====================================================================  REPOSICION
def hoja_reposicion(wb, ws):
    H = ["#", "Código", "Producto", "Stock actual", "En tránsito", "Stock mínimo", "Stock máximo", "Demanda diaria",
         "Tiempo entrega días", "Unid por caja", "CANTIDAD SUGERIDA", "Proveedor recomendado", "Nombre proveedor",
         "Costo unitario compra", "Valor estimado", "URGENCIA", "Días de cobertura actual", "idx"]
    W = [5, 9, 26, 10, 10, 9, 9, 9, 9, 8, 12, 11, 26, 12, 14, 11, 11, 5]
    encabezado_hoja(ws, "📋 PEDIDOS Y REPOSICIÓN",
                    "Lista automática de productos cuyo stock + tránsito ≤ stock mínimo. Cantidad sugerida = mayor entre (máx − disponible) y demanda×(entrega+cobertura), redondeada a cajas.",
                    len(H))
    _hdr(ws, 6, H, W)
    for k in range(1, 101):
        r = R0 + k - 1
        g = lambda f: f'=IF($R{r}="","",{f})'
        f = [k, g(f"INDEX(inv_Cod,$R{r})"), g(f"INDEX(inv_Nombre,$R{r})"), g(f"INDEX(inv_Stock,$R{r})"),
             g(f"INDEX(inv_Transito,$R{r})"), g(f"INDEX(inv_Min,$R{r})"), g(f"INDEX(inv_Max,$R{r})"),
             g(f"INDEX(inv_Dem,$R{r})"), g(f"INDEX(inv_TE,$R{r})"), g(f"INDEX(inv_UPC,$R{r})"),
             g(f"CEILING(MAX(G{r}-(D{r}+E{r}),H{r}*(I{r}+cfg_DiasCobertura)-(D{r}+E{r}),1),MAX(1,J{r}))"),
             g(f"INDEX(inv_Prov,$R{r})"),
             g(f'IFERROR(INDEX(tProveedores[Razón social],MATCH(L{r},tProveedores[Código],0)),"Sin proveedor asignado")'),
             g(f"IFERROR(INDEX(tProductos[Costo compra],MATCH(B{r},tProductos[Código],0)),0)"),
             g(f"K{r}*N{r}"),
             g(f'IF(D{r}<=0,"CRÍTICA",IF(AND(H{r}>0,D{r}/H{r}<=I{r}),"ALTA","MEDIA"))'),
             g(f'IF(H{r}>0,ROUND(D{r}/H{r},1),"Sin demanda")'),
             f'=IFERROR(MATCH(A{r},inv_NRepo,0),"")']
        fm = [None, None, None, NUM2, NUM2, NUM, NUM, NUM2, NUM, NUM, NUM, None, None, COP, COP, None, NUM2, None]
        _fila(ws, r, f, fm)
        ws.cell(r, 11).font = F(9, True, VERDE)
    etiqueta(ws, "C4", "Productos a reponer / valor estimado:", True, 10, AZUL)
    _total(ws, "D4", f'=COUNTIF(B{R0}:B106,"?*")', NUM)
    _total(ws, "O4", f"=SUM(O{R0}:O106)")
    nombre(wb, "repo_N", abs_ref(ws, "D4"))
    nombre(wb, "repo_Valor", abs_ref(ws, "O4"))
    rng = f"P{R0}:P106"
    _sem(ws, rng, "CRÍTICA", BLANCO, ROJO)
    _sem(ws, rng, "ALTA", ROJO, ROJO2)
    _sem(ws, rng, "MEDIA", AMBAR, AMBAR2)
    ws.column_dimensions["R"].hidden = True
    ws.freeze_panes = "D7"
    ws["H3"] = "Botón GENERAR ÓRDENES DE COMPRA (macro): crea una compra 'Pendiente' por proveedor con estas cantidades."
    ws["H3"].font = F(8, False, GRIS3, True)


# =====================================================================  KARDEX
def hoja_kardex(wb, ws):
    encabezado_hoja(ws, "📒 KARDEX POR PRODUCTO", "Seleccione un producto. El resumen es automático; el detalle cronológico lo genera el botón GENERAR KARDEX.", 11)
    anchos(ws, [3, 22, 16, 16, 26, 12, 11, 11, 11, 12, 14])
    etiqueta(ws, "B5", "Producto (código):")
    entrada(ws, "C5", "P001")
    lista_dv(ws, "C5", "=lstProductos")
    nombre(wb, "kx_Producto", abs_ref(ws, "C5"))
    calc(ws, "D5", '=IFERROR(INDEX(tProductos[Nombre],MATCH(kx_Producto,tProductos[Código],0)),"Código no existe")', bold=True)
    ws.merge_cells("D5:F5")
    P = "tAjustes[Producto],kx_Producto"
    items = [
        ("Inventario inicial", f'SUMIFS(tAjustes[Cantidad neta],{P},tAjustes[Tipo],"Inventario inicial")'),
        ("Entradas por compras recibidas", "SUMIFS(tComprasDet[Cantidad recibida],tComprasDet[Producto],kx_Producto)"),
        ("Devoluciones netas", f'SUMIFS(tAjustes[Cantidad neta],{P},tAjustes[Grupo],"Devolución")'),
        ("Otros ajustes netos (pérdidas, sobrantes)", f'SUMIFS(tAjustes[Cantidad neta],{P},tAjustes[Grupo],"Ajuste")-SUMIFS(tAjustes[Cantidad neta],{P},tAjustes[Tipo],"Inventario inicial")'),
        ("Salidas por ventas", "-SUMIFS(tVentasDet[Cantidad efectiva],tVentasDet[Producto],kx_Producto)"),
        ("SALDO (stock actual)", "SUM(C7:C11)"),
        ("Costo unitario real", "IFERROR(INDEX(tProductos[Costo unitario real],MATCH(kx_Producto,tProductos[Código],0)),0)"),
        ("Valor del saldo", "ROUND(MAX(C12,0)*C13,0)"),
    ]
    for i, (lab, f) in enumerate(items):
        r = 7 + i
        etiqueta(ws, f"B{r}", lab, i == 5)
        calc(ws, f"C{r}", "=" + f, COP if i >= 6 else NUM2, bold=(i == 5))
    calc(ws, "E12", '=IF(C12=IFERROR(INDEX(inv_Stock,MATCH(kx_Producto,inv_Cod,0)),"x"),"✔ Coincide con INVENTARIO","✖ Revisar: no coincide con INVENTARIO")', fondo=None, bold=True, color=VERDE)
    seccion(ws, "B16", "DETALLE CRONOLÓGICO (generado por macro)", 10)
    H = ["Fecha", "Tipo de movimiento", "Documento", "Tercero / motivo", "Lote", "Entrada", "Salida", "Saldo", "Costo unitario", "Valor saldo"]
    for j, h in enumerate(H):
        c = ws.cell(17, 2 + j, h)
        c.font = F(9, True, BLANCO)
        c.fill = fill(GRIS3)
        c.alignment = Alignment(horizontal="center")
    nombre(wb, "kx_Detalle", abs_ref(ws, "B18"))
    ws["B18"] = "Presione GENERAR KARDEX para ver el detalle de movimientos."
    ws["B18"].font = F(9, False, GRIS3, True)


# =====================================================================  CARTERA
def hoja_cartera(wb, ws):
    encabezado_hoja(ws, "💼 CARTERA (CUENTAS POR COBRAR) Y CUENTAS POR PAGAR",
                    "Edades de saldos según la fecha de análisis. El detalle por cliente está en CLIENTES y por proveedor en PROVEEDORES.", 12)
    anchos(ws, [3, 24, 15, 11, 3, 4, 12, 11, 26, 14, 9, 12])
    for base, t, r0, tit in [("CxC", "tVentas", 5, "CUENTAS POR COBRAR (clientes)"), ("CxP", "tCompras", 15, "CUENTAS POR PAGAR (proveedores)")]:
        seccion(ws, f"B{r0}", tit, 3)
        rangos = [("Al día (no vencido)", f'SUMIFS({t}[Saldo],{t}[Saldo],">1",{t}[Días vencido],0)'),
                  ("Vencido 1 a 30 días", f'SUMIFS({t}[Saldo],{t}[Días vencido],">=1",{t}[Días vencido],"<=30")'),
                  ("Vencido 31 a 60 días", f'SUMIFS({t}[Saldo],{t}[Días vencido],">=31",{t}[Días vencido],"<=60")'),
                  ("Vencido 61 a 90 días", f'SUMIFS({t}[Saldo],{t}[Días vencido],">=61",{t}[Días vencido],"<=90")'),
                  ("Vencido más de 90 días", f'SUMIFS({t}[Saldo],{t}[Días vencido],">90")')]
        etiqueta(ws, f"C{r0 + 1}", "Saldo", True, 9)
        etiqueta(ws, f"D{r0 + 1}", "Docs.", True, 9)
        conds = ['">1",' + f'{t}[Días vencido],0', None, None, None, None]
        for i, (lab, f) in enumerate(rangos):
            r = r0 + 2 + i
            etiqueta(ws, f"B{r}", lab, False)
            calc(ws, f"C{r}", "=" + f, COP)
            cnt = f.replace("SUMIFS(" + t + "[Saldo],", "COUNTIFS(")
            if i == 0:
                cnt = f'COUNTIFS({t}[Saldo],">1",{t}[Días vencido],0)'
            calc(ws, f"D{r}", "=" + cnt, NUM)
        etiqueta(ws, f"B{r0 + 7}", "TOTAL", True)
        _total(ws, f"C{r0 + 7}", f"=SUM(C{r0 + 2}:C{r0 + 6})")
        _total(ws, f"D{r0 + 7}", f"=SUM(D{r0 + 2}:D{r0 + 6})", NUM)
        nombre(wb, f"car_{base}Total", abs_ref(ws, f"C{r0 + 7}"))
        nombre(wb, f"car_{base}Vencido", f"'{ws.title}'!$C${r0 + 3}:$C${r0 + 6}")
        nombre(wb, f"car_{base}Edades", f"'{ws.title}'!$C${r0 + 2}:$C${r0 + 6}")
        nombre(wb, f"car_{base}Etiq", f"'{ws.title}'!$B${r0 + 2}:$B${r0 + 6}")
    _top(ws, 5, "FACTURAS DE VENTA VENCIDAS (mayor mora primero)", "tVentas", "Factura", "Nombre cliente")
    _top(ws, 27, "COMPRAS POR PAGAR VENCIDAS", "tCompras", "Compra", "Nombre proveedor")
    ws["B25"] = "Nota: CxP solo incluye compras RECIBIDAS. Las órdenes pendientes con pagos se muestran como anticipos en COMPRAS."
    ws["B25"].font = F(8, False, GRIS3, True)


def _top(ws, r0, tit, t, doc, nomcol, n=15):
    seccion(ws, f"G{r0}", tit, 6)
    H = ["Documento", "Fecha", "Tercero", "Saldo", "Días vencido", "Vence"]
    for j, h in enumerate(H):
        c = ws.cell(r0 + 1, 7 + j, h)
        c.font = F(9, True, BLANCO)
        c.fill = fill(GRIS3)
    for k in range(1, n + 1):
        r = r0 + 1 + k
        m = f"MATCH(LARGE({t}[Clave mora],{k}),{t}[Clave mora],0)"
        vals = [f"=IFERROR(INDEX({t}[{doc}],{m}),\"\")", f"=IFERROR(INDEX({t}[Fecha],{m}),\"\")",
                f"=IFERROR(INDEX({t}[{nomcol}],{m}),\"\")", f"=IFERROR(INDEX({t}[Saldo],{m}),\"\")",
                f"=IFERROR(INDEX({t}[Días vencido],{m}),\"\")", f"=IFERROR(INDEX({t}[Vence],{m}),\"\")"]
        for j, (v, fm) in enumerate(zip(vals, [None, FECHA, None, COP, NUM, FECHA])):
            c = ws.cell(r, 7 + j, v)
            c.font = F(9)
            c.border = BORDE
            if fm:
                c.number_format = fm
    ws.conditional_formatting.add(f"K{r0 + 2}:K{r0 + 1 + n}", CellIsRule(operator="greaterThan", formula=["60"], font=Font(color=ROJO, bold=True)))


# =====================================================================  CAJA
def hoja_caja(wb, ws):
    encabezado_hoja(ws, "💰 CAJA Y FINANZAS — SALDOS Y FLUJO DE CAJA",
                    "Ingresos = cobros (PAGOS) + otros ingresos. Egresos = pagos a proveedores + gastos + otros egresos. Las ventas y compras NO entran directo a caja: evita doble conteo.",
                    11)
    anchos(ws, [3, 20, 14, 14, 14, 14, 14, 14, 15, 3, 3])
    seccion(ws, "B5", "SALDOS POR MEDIO DE PAGO (acumulado de todos los movimientos registrados)", 8)
    H = ["Medio", "Saldo inicial", "Cobros a clientes", "Otros ingresos", "Pagos a proveedores", "Gastos", "Otros egresos", "SALDO ACTUAL"]
    for j, h in enumerate(H):
        c = ws.cell(6, 2 + j, h)
        c.font = F(9, True, BLANCO)
        c.fill = fill(GRIS3)
        c.alignment = Alignment(horizontal="center", wrap_text=True)
    ws.row_dimensions[6].height = 30
    for k in range(1, 9):
        r = 6 + k
        m = f"$B{r}"
        g = lambda f: f'=IF({m}="","",{f})'
        vals = [f'=IFERROR(INDEX(tMedios[Medio],{k})&"","")', g(f"N(INDEX(tMedios[Saldo inicial],{k}))"),
                g(f'SUMIFS(tPagos[Valor],tPagos[Tipo],"Cobro cliente",tPagos[Estado],"Activo",tPagos[Medio de pago],{m})'),
                g(f'SUMIFS(tMovCaja[Valor],tMovCaja[Tipo],"Ingreso",tMovCaja[Estado],"Activo",tMovCaja[Medio de pago],{m})'),
                g(f'SUMIFS(tPagos[Valor],tPagos[Tipo],"Pago proveedor",tPagos[Estado],"Activo",tPagos[Medio de pago],{m})'),
                g(f"SUMIFS(tGastos[Valor efectivo],tGastos[Medio de pago],{m})"),
                g(f'SUMIFS(tMovCaja[Valor],tMovCaja[Tipo],"Egreso",tMovCaja[Estado],"Activo",tMovCaja[Medio de pago],{m})'),
                g(f"C{r}+D{r}+E{r}-F{r}-G{r}-H{r}")]
        for j, v in enumerate(vals):
            c = ws.cell(r, 2 + j, v)
            c.font = F(9, j == 7)
            c.border = BORDE
            if j:
                c.number_format = COP
    etiqueta(ws, "B15", "TOTAL", True)
    for L in "CDEFGHI":
        _total(ws, f"{L}15", f"=SUM({L}7:{L}14)")
    nombre(wb, "caja_SaldoTotal", abs_ref(ws, "I15"))
    nombre(wb, "caja_SaldoIni", abs_ref(ws, "C15"))
    nombre(wb, "caja_Medios", abs_rng(ws, "B7:B14"))
    nombre(wb, "caja_Saldos", abs_rng(ws, "I7:I14"))
    ws["B16"] = "Control: Saldo total = Saldo inicial + Σ flujo de PAGOS + Σ flujo de OTROS MOVIMIENTOS − Σ gastos pagados →"
    ws["B16"].font = F(8, False, GRIS3, True)
    calc(ws, "I16", '=IF(ABS(I15-(C15+SUM(tPagos[Flujo])+SUM(tMovCaja[Flujo])-SUM(tGastos[Valor efectivo])))<1,"✔ Cuadra","✖ Revisar")', bold=True, color=VERDE, fondo=None)
    nombre(wb, "caja_Control", abs_ref(ws, "I16"))

    # ---- movimiento del día
    seccion(ws, "B18", "MOVIMIENTO DEL DÍA", 8)
    etiqueta(ws, "B19", "Fecha a consultar:")
    entrada(ws, "C19", "=cfg_FechaCorte", FECHA, "Por defecto, la fecha de análisis del DASHBOARD. Puede escribir otra fecha.")
    nombre(wb, "caja_Fecha", abs_ref(ws, "C19"))
    H2 = ["Medio", "Saldo al iniciar el día", "Ingresos del día", "Egresos del día", "Saldo al cierre del día"]
    for j, h in enumerate(H2):
        c = ws.cell(20, 2 + j, h)
        c.font = F(9, True, BLANCO)
        c.fill = fill(GRIS3)
        c.alignment = Alignment(horizontal="center", wrap_text=True)
    for k in range(1, 9):
        r = 20 + k
        m = f"$B{r}"
        def fl(cond):
            return (f'SUMIFS(tPagos[Flujo],tPagos[Medio de pago],{m},tPagos[Fecha],{cond})'
                    f'+SUMIFS(tMovCaja[Flujo],tMovCaja[Medio de pago],{m},tMovCaja[Fecha],{cond})'
                    f'-SUMIFS(tGastos[Valor efectivo],tGastos[Medio de pago],{m},tGastos[Fecha],{cond})')
        ing = (f'SUMIFS(tPagos[Valor],tPagos[Tipo],"Cobro cliente",tPagos[Estado],"Activo",tPagos[Medio de pago],{m},tPagos[Fecha],caja_Fecha)'
               f'+SUMIFS(tMovCaja[Valor],tMovCaja[Tipo],"Ingreso",tMovCaja[Estado],"Activo",tMovCaja[Medio de pago],{m},tMovCaja[Fecha],caja_Fecha)')
        vals = [f"=B{6 + k}", f'=IF({m}="","",C{6 + k}+{fl(chr(34) + "<" + chr(34) + "&caja_Fecha")})',
                f'=IF({m}="","",{ing})', f'=IF({m}="","",D{r}-({fl("caja_Fecha")}))', f'=IF({m}="","",C{r}+D{r}-E{r})']
        for j, v in enumerate(vals):
            c = ws.cell(r, 2 + j, v)
            c.font = F(9)
            c.border = BORDE
            if j:
                c.number_format = COP
    etiqueta(ws, "B29", "TOTAL DEL DÍA", True)
    for L in "CDEF":
        _total(ws, f"{L}29", f"=SUM({L}21:{L}28)")

    # ---- flujo mensual
    seccion(ws, "B31", "FLUJO DE CAJA MENSUAL (12 meses hasta el mes de análisis)", 8)
    H3 = ["Mes", "Cobros a clientes", "Otros ingresos (sin traslados)", "Pagos a proveedores", "Gastos", "Otros egresos (sin traslados)", "Flujo neto", "Saldo final del mes"]
    for j, h in enumerate(H3):
        c = ws.cell(32, 2 + j, h)
        c.font = F(9, True, BLANCO)
        c.fill = fill(GRIS3)
        c.alignment = Alignment(horizontal="center", wrap_text=True)
    for i in range(12):
        r = 33 + i
        d = f"$B{r}"
        rg = lambda t, col: f'{t}[{col}],">="&{d},{t}[{col}],"<"&EDATE({d},1)'
        vals = [f"=EDATE(cfg_MesIni,{i - 11})",
                f'=SUMIFS(tPagos[Valor],tPagos[Tipo],"Cobro cliente",tPagos[Estado],"Activo",{rg("tPagos", "Fecha")})',
                f'=SUMIFS(tMovCaja[Valor],tMovCaja[Tipo],"Ingreso",tMovCaja[Estado],"Activo",tMovCaja[Concepto],"<>Traslado entre medios",{rg("tMovCaja", "Fecha")})',
                f'=SUMIFS(tPagos[Valor],tPagos[Tipo],"Pago proveedor",tPagos[Estado],"Activo",{rg("tPagos", "Fecha")})',
                f'=SUMIFS(tGastos[Valor efectivo],{rg("tGastos", "Fecha")})',
                f'=SUMIFS(tMovCaja[Valor],tMovCaja[Tipo],"Egreso",tMovCaja[Estado],"Activo",tMovCaja[Concepto],"<>Traslado entre medios",{rg("tMovCaja", "Fecha")})',
                f"=C{r}+D{r}-E{r}-F{r}-G{r}",
                f'=caja_SaldoIni+SUMIFS(tPagos[Flujo],tPagos[Fecha],"<"&EDATE({d},1))+SUMIFS(tMovCaja[Flujo],tMovCaja[Fecha],"<"&EDATE({d},1))-SUMIFS(tGastos[Valor efectivo],tGastos[Fecha],"<"&EDATE({d},1))']
        for j, v in enumerate(vals):
            c = ws.cell(r, 2 + j, v)
            c.font = F(9, j == 6)
            c.border = BORDE
            c.number_format = MES if j == 0 else COP
    nombre(wb, "caja_FlujoMes", abs_rng(ws, "B33:I44"))
    ws.conditional_formatting.add("H33:H44", CellIsRule(operator="lessThan", formula=["0"], font=Font(color=ROJO, bold=True)))


# =====================================================================  EQUILIBRIO
def hoja_equilibrio(wb, ws):
    encabezado_hoja(ws, "⚖ PUNTO DE EQUILIBRIO Y ESCENARIOS",
                    "Basado en los datos del período de análisis. Puede reemplazar los valores calculados escribiendo en las celdas amarillas.", 10)
    anchos(ws, [3, 44, 17, 17, 17, 17, 17, 3, 14, 14])
    seccion(ws, "B5", "1. COSTOS FIJOS Y VARIABLES (mensualizados)", 3)
    meses = "(cfg_DiasRotacion/30)"
    per = 'tGastos[Fecha],">="&cfg_PerIni,tGastos[Fecha],"<="&cfg_FechaCorte'
    perv = 'tVentasDet[Fecha],">="&cfg_PerIni,tVentasDet[Fecha],"<="&cfg_FechaCorte'
    filas = [
        ("Costos fijos mensuales (gastos tipo Fijo del período)", f'=SUMIFS(tGastos[Valor efectivo],tGastos[Tipo gasto],"Fijo",{per})/{meses}', COP, "eq_CFcalc"),
        ("Costos fijos — valor manual (opcional)", None, COP, "eq_CFmanual"),
        ("COSTOS FIJOS UTILIZADOS", '=IF(C7="",C6,C7)', COP, "eq_CF"),
        ("Ventas mensuales promedio (sin IVA)", f"=SUMIFS(tVentasDet[Base efectiva],{perv})/{meses}", COP, "eq_Ventas"),
        ("Costo de ventas mensual promedio", f"=SUMIFS(tVentasDet[Costo total],{perv})/{meses}", COP, "eq_CV1"),
        ("Gastos variables mensuales promedio", f'=SUMIFS(tGastos[Valor efectivo],tGastos[Tipo gasto],"Variable",{per})/{meses}', COP, "eq_CV2"),
        ("Pérdidas de inventario mensuales promedio", f'=SUMIFS(tAjustes[Valor pérdida],tAjustes[Fecha],">="&cfg_PerIni,tAjustes[Fecha],"<="&cfg_FechaCorte)/{meses}', COP, "eq_CV3"),
        ("COSTOS VARIABLES TOTALES", "=C10+C11+C12", COP, "eq_CV"),
        ("Margen de contribución calculado (%)", "=IFERROR(1-C13/C9,0)", PCT, "eq_MCcalc"),
        ("Margen de contribución — valor manual (opcional)", None, PCT, "eq_MCmanual"),
        ("MARGEN DE CONTRIBUCIÓN UTILIZADO", '=IF(C15="",C14,C15)', PCT, "eq_MC"),
        ("Unidades vendidas por mes (promedio)", f"=SUMIFS(tVentasDet[Cantidad efectiva],{perv})/{meses}", NUM, "eq_Unid"),
        ("Precio promedio por unidad", "=IFERROR(C9/C17,0)", COP, "eq_PrecioU"),
        ("Margen de contribución por unidad", "=C18*C16", COP, "eq_MCU"),
    ]
    for i, (lab, f, fm, nm) in enumerate(filas):
        r = 6 + i
        etiqueta(ws, f"B{r}", lab, lab.isupper() or "UTILIZADO" in lab)
        if f is None:
            entrada(ws, f"C{r}", None, fm, "Déjelo vacío para usar el valor calculado.")
        else:
            calc(ws, f"C{r}", f, fm, bold="UTILIZADO" in lab or lab.isupper())
        nombre(wb, nm, abs_ref(ws, f"C{r}"))
    seccion(ws, "B21", "2. RESULTADOS", 3)
    res = [
        ("VENTAS MÍNIMAS MENSUALES PARA NO PERDER (punto de equilibrio $)", "=IFERROR(eq_CF/eq_MC,0)", COP, "eq_PE"),
        ("Unidades necesarias por mes para cubrir costos", "=IFERROR(ROUNDUP(eq_CF/eq_MCU,0),0)", NUM, "eq_PEU"),
        ("Ventas diarias necesarias (30 días)", "=eq_PE/30", COP, None),
        ("Utilidad mensual esperada con ventas actuales", "=eq_Ventas*eq_MC-eq_CF", COP, "eq_Util"),
        ("Margen de seguridad (cuánto pueden caer las ventas)", "=IFERROR((eq_Ventas-eq_PE)/eq_Ventas,0)", PCT, "eq_MS"),
        ("Diagnóstico", '=IF(eq_Ventas=0,"Sin ventas en el período",IF(eq_Ventas>=eq_PE,"✔ Las ventas actuales superan el punto de equilibrio","✖ Las ventas actuales NO cubren los costos fijos"))', None, "eq_Diag"),
    ]
    for i, (lab, f, fm, nm) in enumerate(res):
        r = 22 + i
        etiqueta(ws, f"B{r}", lab, i in (0, 5))
        calc(ws, f"C{r}", f, fm, bold=True, color=AZUL if i < 5 else VERDE, fondo=CELESTE if i < 5 else None)
        if nm:
            nombre(wb, nm, abs_ref(ws, f"C{r}"))
    seccion(ws, "B29", "3. ESCENARIOS (mensuales)", 6)
    H = ["Concepto", "Pesimista", "Normal", "Optimista"]
    for j, h in enumerate(H):
        c = ws.cell(30, 2 + j, h)
        c.font = F(9, True, BLANCO)
        c.fill = fill(GRIS3)
        c.alignment = Alignment(horizontal="center")
    supuestos = [("Variación de ventas", [-0.2, 0, 0.2]), ("Variación de costos variables (% sobre ventas)", [0.05, 0, -0.03]),
                 ("Variación de costos fijos", [0.05, 0, 0])]
    for i, (lab, vals) in enumerate(supuestos):
        r = 31 + i
        etiqueta(ws, f"B{r}", lab, False)
        for j, v in enumerate(vals):
            entrada(ws, f"{'CDE'[j]}{r}", v, PCT)
    calcs = [("Ventas proyectadas", "=eq_Ventas*(1+{c}31)"), ("Costos variables", "=eq_Ventas*(1+{c}31)*(1-eq_MC)*(1+{c}32)"),
             ("Margen de contribución", "={c}34-{c}35"), ("Costos fijos", "=eq_CF*(1+{c}33)"),
             ("UTILIDAD ESPERADA", "={c}36-{c}37"), ("Punto de equilibrio $", "=IFERROR({c}37/({c}36/{c}34),0)")]
    for i, (lab, f) in enumerate(calcs):
        r = 34 + i
        etiqueta(ws, f"B{r}", lab, lab.isupper())
        for c in "CDE":
            calc(ws, f"{c}{r}", f.format(c=c), COP, bold=lab.isupper())
    ws.conditional_formatting.add("C38:E38", CellIsRule(operator="lessThan", formula=["0"], font=Font(color=ROJO, bold=True)))
    # tabla para gráfico de equilibrio
    seccion(ws, "I5", "Gráfico de equilibrio", 2)
    for j, h in enumerate(["Ventas", "Ingresos", "Costos totales"]):
        c = ws.cell(6, 9 + j, h)
        c.font = F(9, True, BLANCO)
        c.fill = fill(GRIS3)
    ws.column_dimensions["K"].width = 14
    for i in range(11):
        r = 7 + i
        ws.cell(r, 9, f"=ROUND(eq_PE*2*{i}/10,0)").number_format = COP
        ws.cell(r, 10, f"=I{r}").number_format = COP
        ws.cell(r, 11, f"=eq_CF+I{r}*(1-eq_MC)").number_format = COP
        for cc in (9, 10, 11):
            ws.cell(r, cc).font = F(8)
    ws["B41"] = ("Advertencia: cálculo administrativo estimado con los datos registrados. No constituye estado financiero "
                 "certificado ni asesoría tributaria.")
    ws["B41"].font = F(8, False, GRIS3, True)
