# -*- coding: utf-8 -*-
"""Formularios en hoja (F_VENTA, F_COMPRA, F_MOVIMIENTOS, F_CONSULTA).

Las celdas de captura tienen nombres definidos (fv_*, fc_*, fg_*, ...) que usan las macros.
Los botones de acción los crea la macro CrearBotones al abrir el archivo .xlsm.
"""
from np_lib import *
from openpyxl.formatting.rule import FormulaRule

NL = 15  # líneas por formulario


def _campos(wb, ws, col_lab, col_in, fila0, campos):
    for i, c in enumerate(campos):
        nm, lab, val, fm, dv, com = (list(c) + [None] * 6)[:6]
        r = fila0 + i
        etiqueta(ws, f"{col_lab}{r}", lab, False, 9)
        entrada(ws, f"{col_in}{r}", val, fm, com)
        nombre(wb, nm, abs_ref(ws, f"{col_in}{r}"))
        if dv == "date":
            dv_fecha(ws, f"{col_in}{r}")
        elif dv == "num":
            dv_numero(ws, f"{col_in}{r}")
        elif dv:
            lista_dv(ws, f"{col_in}{r}", dv)


def _info(ws, cell, f, fmt=None, rng=None):
    calc(ws, cell, f, fmt, size=9, color=AZUL3, fondo=None)
    if rng:
        ws.merge_cells(rng)


def _lineas_hdr(ws, fila, headers, entrada_n):
    for j, h in enumerate(headers):
        c = ws.cell(fila, 2 + j, h)
        c.font = F(9, True, BLANCO)
        c.fill = fill(AZUL2 if j < entrada_n else GRIS3)
        c.alignment = Alignment(horizontal="center", vertical="center", wrap_text=True)
    ws.row_dimensions[fila].height = 30


def _proteger(ws):
    ws.protection.sheet = True
    ws.protection.password = CLAVE
    ws.protection.formatColumns = False
    ws.protection.formatRows = False


# =====================================================================  F_VENTA
def hoja_f_venta(wb, ws):
    encabezado_hoja(ws, "🧾 FORMULARIO DE VENTA", "1) Complete el encabezado  2) Escriba las líneas  3) Presione REGISTRAR VENTA. Las celdas grises se calculan solas.", 14)
    anchos(ws, [2, 38, 22, 14, 10, 12, 28, 11, 12, 8, 13, 12, 13, 26])
    _campos(wb, ws, "B", "C", 5, [
        ("fv_Factura", "N.º de factura (vacío = automático)", None, None, None, "Déjelo vacío para usar el consecutivo sugerido."),
        ("fv_Fecha", "Fecha (vacío = hoy)", None, FECHA, "date"),
        ("fv_Cliente", "Cliente (código) *", "C008", None, "=lstClientes"),
        ("fv_Vendedor", "Vendedor *", "Ana Torres", None, "=lstVendedores"),
        ("fv_Medio", "Medio de pago *", "Efectivo", None, "=lstMedios"),
        ("fv_Condicion", "Condición *", "Contado", None, '"Contado,Crédito"'),
        ("fv_Plazo", "Plazo crédito días (vacío = del cliente)", None, NUM, "num"),
        ("fv_PagoHoy", "Valor pagado hoy (vacío = total si es contado)", None, COP, "num"),
        ("fv_Autoriza", "Autorizar venta sin stock", "NO", None, '"NO,SI"'),
        ("fv_Clave", "Clave de autorización", None, None, None),
        ("fv_Obs", "Observaciones", None, None, None),
    ])
    _info(ws, "D5", '="Sugerido: "&cfg_PrefFactura&TEXT(COUNTA(tVentas[Factura])+1,"00000")', rng="D5:G5")
    _info(ws, "D7", '=IFERROR(INDEX(tClientes[Nombre],MATCH(fv_Cliente,tClientes[Código],0)),"Seleccione un cliente")', rng="D7:G7")
    _info(ws, "D8", '=IFERROR("Saldo: $ "&FIXED(INDEX(tClientes[Saldo pendiente],MATCH(fv_Cliente,tClientes[Código],0)),0)&" · Vencido: $ "&FIXED(INDEX(tClientes[Saldo vencido],MATCH(fv_Cliente,tClientes[Código],0)),0)&" · "&INDEX(tClientes[Alerta],MATCH(fv_Cliente,tClientes[Código],0)),"")', rng="D8:G8")
    _info(ws, "D11", '=IFERROR("Plazo del cliente: "&INDEX(tClientes[Plazo crédito días],MATCH(fv_Cliente,tClientes[Código],0))&" días · cupo disponible $ "&FIXED(INDEX(tClientes[Cupo disponible],MATCH(fv_Cliente,tClientes[Código],0)),0),"")', rng="D11:G11")
    _info(ws, "D13", '="Política: vender sin stock = "&cfg_PermitirSinStock&" (si NO, se exige clave de autorización)"', rng="D13:G13")
    H = ["Producto *", "Cantidad *", "Precio unitario (vacío = lista)", "Descuento %", "Lote", "Nombre", "Stock disponible",
         "Precio lista", "IVA %", "Base sin IVA", "IVA", "Total línea", "Validación"]
    _lineas_hdr(ws, 18, H, 5)
    r1, r2 = 19, 19 + NL - 1
    for r in range(r1, r2 + 1):
        for L, fm in zip("BCDEF", [None, NUM2, COP, PCT, None]):
            entrada(ws, f"{L}{r}", None, fm)
        P = f"MATCH($B{r},tProductos[Código],0)"
        g = lambda f: f'=IF($B{r}="","",{f})'
        vals = {"G": g(f'IFERROR(INDEX(tProductos[Nombre],{P}),"¿?")'),
                "H": g(f"IFERROR(INDEX(inv_Stock,MATCH($B{r},inv_Cod,0)),0)"),
                "I": g(f"IFERROR(INDEX(tProductos[Precio venta],{P}),0)"),
                "J": g(f"IFERROR(INDEX(tProductos[IVA %],{P}),cfg_IVA)"),
                "K": g(f"ROUND(N(C{r})*IF(D{r}=\"\",I{r},D{r}),0)-ROUND(ROUND(N(C{r})*IF(D{r}=\"\",I{r},D{r}),0)*N(E{r}),0)"),
                "L": g(f"ROUND(K{r}*J{r},0)"), "M": g(f"K{r}+L{r}"),
                "N": g(f'IF(ISNA({P}),"✖ Producto no existe",IF(INDEX(tProductos[Estado],{P})="Inactivo","✖ Producto inactivo",IF(N(C{r})<=0,"✖ Falta cantidad",IF(C{r}>H{r},"⚠ Stock insuficiente","✔ OK"))))')}
        for L, f in vals.items():
            calc(ws, f"{L}{r}", f, {"H": NUM2, "I": COP, "J": PCT, "K": COP, "L": COP, "M": COP}.get(L), size=9)
        lista_dv(ws, f"B{r}", "=lstProductos")
    dv_numero(ws, f"C{r1}:E{r2}")
    nombre(wb, "fv_Lineas", abs_rng(ws, f"B{r1}:F{r2}"))
    etiqueta(ws, f"J{r2 + 2}", "TOTALES", True)
    for L, nm in [("K", "fv_Base"), ("L", "fv_IVA"), ("M", "fv_Total")]:
        c = ws[f"{L}{r2 + 2}"]
        c.value = f"=SUM({L}{r1}:{L}{r2})"
        c.number_format = COP
        c.font = F(11, True, AZUL)
        c.fill = fill(CELESTE)
        nombre(wb, nm, abs_ref(ws, f"{L}{r2 + 2}"))
    calc(ws, f"N{r2 + 2}", f'=IF(COUNTIF(N{r1}:N{r2},"✖*")>0,"✖ Corrija las líneas marcadas",IF(COUNTIF(N{r1}:N{r2},"⚠*")>0,"⚠ Hay líneas sin stock suficiente","✔ Lista para registrar"))', bold=True, fondo=None)
    nombre(wb, "fv_Estado", abs_ref(ws, f"N{r2 + 2}"))
    ws.conditional_formatting.add(f"N{r1}:N{r2 + 2}", FormulaRule(formula=[f'LEFT(N{r1},1)="✖"'], font=Font(color=ROJO, bold=True)))
    ws.conditional_formatting.add(f"N{r1}:N{r2 + 2}", FormulaRule(formula=[f'LEFT(N{r1},1)="⚠"'], font=Font(color=AMBAR, bold=True)))
    ws.row_dimensions[16].height = 30
    ws["B17"] = "(*) obligatorio.  Los botones REGISTRAR VENTA / LIMPIAR aparecen en la fila 16 cuando las macros están habilitadas."
    ws["B17"].font = F(8, False, GRIS3, True)
    _proteger(ws)


# =====================================================================  F_COMPRA
def hoja_f_compra(wb, ws):
    encabezado_hoja(ws, "🛒 FORMULARIO DE COMPRA Y RECEPCIÓN", "Registrar la orden NO aumenta el inventario. El stock sube al CONFIRMAR RECEPCIÓN (o si marca 'Recibir de inmediato').", 14)
    anchos(ws, [2, 38, 22, 14, 10, 12, 12, 30, 12, 13, 12, 13, 24, 3])
    _campos(wb, ws, "B", "C", 5, [
        ("fc_Compra", "N.º de compra (vacío = automático)", None, None, None),
        ("fc_Fecha", "Fecha (vacío = hoy)", None, FECHA, "date"),
        ("fc_Proveedor", "Proveedor (código) *", "PR01", None, "=lstProveedores"),
        ("fc_FacturaProv", "Factura del proveedor", None, None, None),
        ("fc_Flete", "Flete / transporte", None, COP, "num"),
        ("fc_Plazo", "Plazo de pago días (vacío = del proveedor)", None, NUM, "num"),
        ("fc_RecibirYa", "Recibir de inmediato", "NO", None, '"NO,SI"'),
        ("fc_Obs", "Observaciones", None, None, None),
    ])
    _info(ws, "D5", '="Sugerido: "&cfg_PrefCompra&TEXT(COUNTA(tCompras[Compra])+1,"00000")', rng="D5:F5")
    _info(ws, "D7", '=IFERROR(INDEX(tProveedores[Razón social],MATCH(fc_Proveedor,tProveedores[Código],0))&" · entrega "&INDEX(tProveedores[Tiempo entrega días],MATCH(fc_Proveedor,tProveedores[Código],0))&" días · plazo "&INDEX(tProveedores[Plazo pago días],MATCH(fc_Proveedor,tProveedores[Código],0))&" días","Seleccione un proveedor")', rng="D7:F7")
    # recepción
    seccion(ws, "H5", "CONFIRMAR RECEPCIÓN DE MERCANCÍA", 5, VERDE)
    _campos(wb, ws, "H", "I", 6, [("fr_Compra", "N.º de compra *", None, None, "=lstCompras"),
                                  ("fr_RecibidoPor", "Recibido por *", None, None, None),
                                  ("fr_Fecha", "Fecha de recepción (vacío = hoy)", None, FECHA, "date")])
    M = "MATCH(fr_Compra,tCompras[Compra],0)"
    _info(ws, "J6", f'=IFERROR(INDEX(tCompras[Nombre proveedor],{M}),"")', rng="J6:L6")
    _info(ws, "J7", f'=IFERROR("Estado actual: "&INDEX(tCompras[Estado recepción],{M}),"")', rng="J7:L7")
    _info(ws, "J8", f'=IFERROR("Total: $ "&FIXED(INDEX(tCompras[Total compra],{M}),0)&" · "&COUNTIF(tComprasDet[Compra],fr_Compra)&" línea(s)","")', rng="J8:L8")
    ws["H10"] = "Recibir = cambia el estado a 'Recibida' y el inventario aumenta. No se puede recibir dos veces."
    ws["H10"].font = F(8, False, GRIS3, True)
    H = ["Producto *", "Cantidad *", "Costo unitario (vacío = actual)", "IVA % (vacío = del producto)", "Lote", "Vencimiento",
         "Nombre", "Costo actual", "Subtotal", "IVA", "Total línea", "Validación"]
    _lineas_hdr(ws, 18, H, 6)
    r1, r2 = 19, 19 + NL - 1
    for r in range(r1, r2 + 1):
        for L, fm in zip("BCDEFG", [None, NUM2, COP, PCT, None, FECHA]):
            entrada(ws, f"{L}{r}", None, fm)
        P = f"MATCH($B{r},tProductos[Código],0)"
        g = lambda f: f'=IF($B{r}="","",{f})'
        vals = {"H": g(f'IFERROR(INDEX(tProductos[Nombre],{P}),"¿?")'),
                "I": g(f"IFERROR(INDEX(tProductos[Costo compra],{P}),0)"),
                "J": g(f'ROUND(N(C{r})*IF(D{r}="",I{r},D{r}),0)'),
                "K": g(f'ROUND(J{r}*IF(E{r}="",IFERROR(INDEX(tProductos[IVA %],{P}),cfg_IVA),E{r}),0)'),
                "L": g(f"J{r}+K{r}"),
                "M": g(f'IF(ISNA({P}),"✖ Producto no existe",IF(N(C{r})<=0,"✖ Falta cantidad",IF(AND(IFERROR(INDEX(tProductos[Maneja lote],{P}),"NO")="SI",F{r}=""),"⚠ Producto con lote: indique lote","✔ OK")))')}
        for L, f in vals.items():
            calc(ws, f"{L}{r}", f, {"I": COP, "J": COP, "K": COP, "L": COP}.get(L), size=9)
        lista_dv(ws, f"B{r}", "=lstProductos")
    dv_numero(ws, f"C{r1}:E{r2}")
    dv_fecha(ws, f"G{r1}:G{r2}")
    nombre(wb, "fc_Lineas", abs_rng(ws, f"B{r1}:G{r2}"))
    etiqueta(ws, f"I{r2 + 2}", "TOTALES (+ flete)", True)
    for L, nm, f in [("J", "fc_Sub", f"=SUM(J{r1}:J{r2})"), ("K", "fc_IVA", f"=SUM(K{r1}:K{r2})"), ("L", "fc_Total", f"=SUM(L{r1}:L{r2})+N(fc_Flete)")]:
        c = ws[f"{L}{r2 + 2}"]
        c.value = f
        c.number_format = COP
        c.font = F(11, True, AZUL)
        c.fill = fill(CELESTE)
        nombre(wb, nm, abs_ref(ws, f"{L}{r2 + 2}"))
    calc(ws, f"M{r2 + 2}", f'=IF(COUNTIF(M{r1}:M{r2},"✖*")>0,"✖ Corrija las líneas marcadas","✔ Lista para registrar")', bold=True, fondo=None)
    nombre(wb, "fc_Estado", abs_ref(ws, f"M{r2 + 2}"))
    ws.conditional_formatting.add(f"M{r1}:M{r2 + 2}", FormulaRule(formula=[f'LEFT(M{r1},1)="✖"'], font=Font(color=ROJO, bold=True)))
    ws.row_dimensions[16].height = 30
    _proteger(ws)


# =====================================================================  F_MOVIMIENTOS
def hoja_f_movimientos(wb, ws):
    encabezado_hoja(ws, "🧮 GASTOS · PAGOS Y ABONOS · AJUSTES · CAJA · ANULACIONES",
                    "Cada sección tiene su botón REGISTRAR. Limpiar el formulario nunca borra registros históricos.", 9)
    anchos(ws, [2, 32, 22, 34, 3, 32, 22, 34, 2])
    seccion(ws, "B5", "1. REGISTRAR GASTO", 3, AZUL2)
    _campos(wb, ws, "B", "C", 6, [("fg_Fecha", "Fecha (vacío = hoy)", None, FECHA, "date"),
                                  ("fg_Categoria", "Categoría *", None, None, "=lstCatGasto"),
                                  ("fg_Descripcion", "Descripción *", None), ("fg_Beneficiario", "Beneficiario"),
                                  ("fg_Medio", "Medio de pago *", "Efectivo", None, "=lstMedios"),
                                  ("fg_Valor", "Valor *", None, COP, "num"), ("fg_Comprobante", "N.º comprobante")])
    _info(ws, "D7", '=IFERROR("Tipo: "&INDEX(tCatGasto[Tipo],MATCH(fg_Categoria,tCatGasto[Categoría],0)),"")')

    seccion(ws, "F5", "2. REGISTRAR PAGO / ABONO", 3, AZUL2)
    _campos(wb, ws, "F", "G", 6, [("fp_Tipo", "Tipo *", "Cobro cliente", None, '"Cobro cliente,Pago proveedor"'),
                                  ("fp_Documento", "Documento (factura o compra) *", None, None,
                                   None, "Factura de venta (FV-...) para cobros; número de compra (OC-...) para pagos."),
                                  ("fp_Fecha", "Fecha (vacío = hoy)", None, FECHA, "date"),
                                  ("fp_Medio", "Medio de pago *", "Transferencia", None, "=lstMedios"),
                                  ("fp_Valor", "Valor *", None, COP, "num"), ("fp_Referencia", "Referencia / comprobante"),
                                  ("fp_Obs", "Observaciones")])
    T = 'IF(fp_Tipo="Cobro cliente",'
    mv = "MATCH(fp_Documento,tVentas[Factura],0)"
    mc = "MATCH(fp_Documento,tCompras[Compra],0)"
    _info(ws, "H7", f'=IF(fp_Documento="","",IFERROR({T}INDEX(tVentas[Nombre cliente],{mv}),INDEX(tCompras[Nombre proveedor],{mc})),"✖ Documento no encontrado"))')
    _info(ws, "H8", f'=IF(fp_Documento="","",IFERROR("Total: $ "&FIXED({T}INDEX(tVentas[Total factura],{mv}),INDEX(tCompras[Total compra],{mc})),0),""))')
    _info(ws, "H9", f'=IF(fp_Documento="","",IFERROR("Pagado: $ "&FIXED({T}INDEX(tVentas[Pagado],{mv}),INDEX(tCompras[Pagado],{mc})),0),""))')
    calc(ws, "H10", f'=IF(fp_Documento="","",IFERROR({T}INDEX(tVentas[Saldo],{mv}),INDEX(tCompras[Saldo],{mc})),""))', COP, bold=True, color=ROJO, fondo=None)
    nombre(wb, "fp_Saldo", abs_ref(ws, "H10"))
    ws["H11"] = "↑ Saldo pendiente del documento"
    ws["H11"].font = F(8, False, GRIS3, True)

    seccion(ws, "B16", "3. AJUSTE / PÉRDIDA / DEVOLUCIÓN DE INVENTARIO", 3, AZUL2)
    _campos(wb, ws, "B", "C", 17, [("fa_Fecha", "Fecha (vacío = hoy)", None, FECHA, "date"),
                                   ("fa_Producto", "Producto *", None, None, "=lstProductos"),
                                   ("fa_Tipo", "Tipo de ajuste *", None, None, "=lstTiposAjuste"),
                                   ("fa_Cantidad", "Cantidad (siempre positiva) *", None, NUM2, "num"),
                                   ("fa_Lote", "Lote"), ("fa_Vence", "Fecha de vencimiento", None, FECHA, "date"),
                                   ("fa_Motivo", "Motivo *"), ("fa_Responsable", "Responsable *")])
    _info(ws, "D18", '=IFERROR(INDEX(tProductos[Nombre],MATCH(fa_Producto,tProductos[Código],0))&" · stock actual: "&FIXED(INDEX(inv_Stock,MATCH(fa_Producto,inv_Cod,0)),0),"")')
    _info(ws, "D19", '=IFERROR(IF(INDEX(tTiposAjuste[Signo],MATCH(fa_Tipo,tTiposAjuste[Tipo],0))>0,"➕ Aumenta el inventario","➖ Disminuye el inventario")&IF(INDEX(tTiposAjuste[Es pérdida],MATCH(fa_Tipo,tTiposAjuste[Tipo],0))="SI"," · se registra como PÉRDIDA",""),"")')

    seccion(ws, "F16", "4. OTRO MOVIMIENTO DE CAJA", 3, AZUL2)
    _campos(wb, ws, "F", "G", 17, [("fm_Fecha", "Fecha (vacío = hoy)", None, FECHA, "date"),
                                   ("fm_Tipo", "Tipo *", "Ingreso", None, '"Ingreso,Egreso"'),
                                   ("fm_Concepto", "Concepto *", None, None, '"Aporte de socios,Préstamo recibido,Pago de préstamo,Retiro de socios,Traslado entre medios,Otros ingresos,Otros egresos"'),
                                   ("fm_Medio", "Medio de pago *", "Efectivo", None, "=lstMedios"),
                                   ("fm_Valor", "Valor *", None, COP, "num"), ("fm_Detalle", "Detalle")])
    ws["H19"] = "Para un traslado (p. ej. consignar efectivo) registre un Egreso en el medio origen y un Ingreso en el destino."
    ws["H19"].font = F(8, False, GRIS3, True)
    ws["H19"].alignment = Alignment(wrap_text=True)

    seccion(ws, "B28", "5. CIERRE DIARIO DE CAJA (EFECTIVO)", 3, VERDE)
    _campos(wb, ws, "B", "C", 29, [("fk_Fecha", "Fecha del cierre (vacío = hoy)", None, FECHA, "date"),
                                   ("fk_Contado", "Efectivo contado físicamente *", None, COP, "num"),
                                   ("fk_Responsable", "Responsable *"), ("fk_Obs", "Observaciones")])
    EF = '"Efectivo"'
    fe = 'IF(fk_Fecha="",TODAY(),fk_Fecha)'
    _info(ws, "D29", f'="Saldo esperado en efectivo: $ "&FIXED(IFERROR(INDEX(tMedios[Saldo inicial],MATCH({EF},tMedios[Medio],0)),0)+SUMIFS(tPagos[Flujo],tPagos[Medio de pago],{EF},tPagos[Fecha],"<="&{fe})+SUMIFS(tMovCaja[Flujo],tMovCaja[Medio de pago],{EF},tMovCaja[Fecha],"<="&{fe})-SUMIFS(tGastos[Valor efectivo],tGastos[Medio de pago],{EF},tGastos[Fecha],"<="&{fe}),0)')

    seccion(ws, "F28", "6. ANULAR DOCUMENTO (no se borra: queda trazabilidad)", 3, ROJO)
    _campos(wb, ws, "F", "G", 29, [("fx_Tipo", "Tipo de documento *", "Venta", None, '"Venta,Compra,Pago,Gasto,Otro movimiento"'),
                                   ("fx_Documento", "Número del documento *"), ("fx_Motivo", "Motivo de la anulación *")])
    ws["H29"] = "Venta anulada: el stock vuelve automáticamente. Si tenía cobros, anúlelos también (tipo Pago)."
    ws["H29"].font = F(8, False, GRIS3, True)
    ws["H29"].alignment = Alignment(wrap_text=True)
    ws.row_dimensions[29].height = 30
    for r in (14, 26, 34):
        ws.row_dimensions[r].height = 28
    _proteger(ws)


# =====================================================================  F_CONSULTA
def hoja_f_consulta(wb, ws):
    encabezado_hoja(ws, "🔎 CONSULTAR PRODUCTOS Y BUSCAR CLIENTES",
                    "Escriba código, código de barras o parte del nombre. El primer resultado aparece al instante; el botón BUSCAR lista todas las coincidencias.", 9)
    anchos(ws, [2, 26, 30, 14, 3, 26, 30, 14, 2])
    seccion(ws, "B5", "CONSULTA DE PRODUCTO", 3)
    etiqueta(ws, "B6", "Buscar (código, barras o nombre):", True, 9)
    entrada(ws, "C6", "Arroz")
    nombre(wb, "fq_Texto", abs_ref(ws, "C6"))
    calc(ws, "D6", '=IF(fq_Texto="","",IFERROR(MATCH(fq_Texto&"",tProductos[Código],0),IFERROR(MATCH(fq_Texto&"",tProductos[Código de barras],0),IFERROR(MATCH("*"&fq_Texto&"*",tProductos[Nombre],0),"No encontrado"))))', size=8, fondo=None, color=GRIS3)
    nombre(wb, "fq_Idx", abs_ref(ws, "D6"))
    campos = [("Código", "tProductos[Código]", None), ("Nombre", "tProductos[Nombre]", None), ("Categoría", "tProductos[Categoría]", None),
              ("Marca", "tProductos[Marca]", None), ("Ubicación", "tProductos[Ubicación]", None), ("Precio de venta", "tProductos[Precio venta]", COP),
              ("Precio con IVA", "tProductos[Precio con IVA]", COP), ("IVA", "tProductos[IVA %]", PCT), ("Costo unitario real", "tProductos[Costo unitario real]", COP),
              ("Margen", "tProductos[Margen %]", PCT), ("STOCK ACTUAL", "inv_Stock", NUM2), ("Estado de stock", "inv_Estado", None),
              ("En tránsito", "inv_Transito", NUM2), ("Próximo vencimiento", "inv_Vence", FECHA), ("Proveedor", "tProductos[Proveedor principal]", None),
              ("Estado del producto", "tProductos[Estado]", None)]
    for i, (lab, rng, fm) in enumerate(campos):
        r = 8 + i
        etiqueta(ws, f"B{r}", lab, lab.isupper(), 9)
        calc(ws, f"C{r}", f'=IF(ISNUMBER(fq_Idx),INDEX({rng},fq_Idx),"")', fm, bold=lab.isupper())
    seccion(ws, "F5", "BÚSQUEDA DE CLIENTE", 3)
    etiqueta(ws, "F6", "Buscar (código, NIT o nombre):", True, 9)
    entrada(ws, "G6", "Plaza")
    nombre(wb, "fqc_Texto", abs_ref(ws, "G6"))
    calc(ws, "H6", '=IF(fqc_Texto="","",IFERROR(MATCH(fqc_Texto&"",tClientes[Código],0),IFERROR(MATCH(fqc_Texto&"",tClientes[NIT CC],0),IFERROR(MATCH("*"&fqc_Texto&"*",tClientes[Nombre],0),"No encontrado"))))', size=8, fondo=None, color=GRIS3)
    nombre(wb, "fqc_Idx", abs_ref(ws, "H6"))
    campos = [("Código", "Código", None), ("Nombre", "Nombre", None), ("NIT / CC", "NIT CC", None), ("Teléfono", "Teléfono", None),
              ("Ciudad", "Ciudad", None), ("Plazo de crédito (días)", "Plazo crédito días", NUM), ("Cupo de crédito", "Cupo crédito", COP),
              ("Total vendido", "Total vendido", COP), ("Total abonado", "Total abonado", COP), ("SALDO PENDIENTE", "Saldo pendiente", COP),
              ("Saldo vencido", "Saldo vencido", COP), ("Días máx. vencido", "Días máx vencido", NUM), ("Última compra", "Última compra", FECHA),
              ("Facturas", "Facturas", NUM), ("Alerta", "Alerta", None)]
    for i, (lab, col, fm) in enumerate(campos):
        r = 8 + i
        etiqueta(ws, f"F{r}", lab, lab.isupper(), 9)
        calc(ws, f"G{r}", f'=IF(ISNUMBER(fqc_Idx),INDEX(tClientes[{col}],fqc_Idx),"")', fm, bold=lab.isupper())
    seccion(ws, "B26", "TODAS LAS COINCIDENCIAS (botón BUSCAR PRODUCTO / BUSCAR CLIENTE)", 7, GRIS3)
    nombre(wb, "fq_Lista", abs_ref(ws, "B27"))
    nombre(wb, "fqc_Lista", abs_ref(ws, "F27"))
    _proteger(ws)
