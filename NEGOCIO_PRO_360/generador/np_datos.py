# -*- coding: utf-8 -*-
"""Hojas de datos (tablas estructuradas) y CONFIGURACIÓN."""
from np_lib import *
from openpyxl.utils import get_column_letter

FILA_T = 6  # fila de encabezado de las tablas de datos

MATCHP = "MATCH([@Producto],tProductos[Código],0)"


def _medios():
    return '"Efectivo,Transferencia,Tarjeta débito,Tarjeta crédito,Nequi / Daviplata,Otro"'


# =====================================================================  CONFIG
def hoja_config(wb, ws):
    encabezado_hoja(ws, "⚙ CONFIGURACIÓN DEL SISTEMA",
                    "Datos del negocio, parámetros de cálculo y listas desplegables. Celdas amarillas = editables.", 40)
    leyenda(ws, "C3")
    anchos(ws, [3, 34, 30, 4, 3])
    seccion(ws, "B5", "DATOS DEL NEGOCIO", 2)
    datos = [
        ("cfg_Negocio", "Nombre del negocio", "Distribuidora Logisticubo S.A.S. (DEMO)", None),
        ("cfg_NIT", "NIT", "901.234.567-8", TXT),
        ("cfg_Direccion", "Dirección", "Calle 15 # 32-40, Zona Industrial", None),
        ("cfg_Ciudad", "Ciudad", "Cali, Valle del Cauca", None),
        ("cfg_Telefono", "Teléfono", "602 555 0000", TXT),
        ("cfg_Email", "Correo electrónico", "admin@logisticubo.example", None),
        ("cfg_Moneda", "Moneda", "COP - Peso colombiano", None),
        ("cfg_Resolucion", "Resolución de facturación", "Resolución DIAN N.º 18760000000 (ejemplo)", None),
        ("cfg_Regimen", "Responsabilidad tributaria", "Responsable de IVA (verificar con su contador)", None),
    ]
    r = 6
    for nm, lab, val, fmt in datos:
        etiqueta(ws, f"B{r}", lab, False)
        entrada(ws, f"C{r}", val, fmt)
        nombre(wb, nm, abs_ref(ws, f"C{r}"))
        r += 1
    seccion(ws, "B16", "PARÁMETROS DE CÁLCULO", 2)
    params = [
        ("cfg_IVA", "IVA general (por defecto)", 0.19, PCT, "Tarifa usada cuando un producto no tiene IVA definido."),
        ("cfg_PrefFactura", "Prefijo de facturas de venta", "FV-", None, None),
        ("cfg_PrefCompra", "Prefijo de órdenes de compra", "OC-", None, None),
        ("cfg_MargenObjetivo", "Margen objetivo sobre venta", 0.30, PCT, "Se usa para el precio sugerido: Costo / (1 - margen)."),
        ("cfg_MargenMinimo", "Margen mínimo sobre venta", 0.10, PCT, "Precio mínimo = Costo / (1 - margen mínimo)."),
        ("cfg_DiasRotacion", "Días del período de análisis (rotación)", 90, NUM, "Ventana para demanda, rotación y punto de equilibrio."),
        ("cfg_DiasCobertura", "Días de cobertura deseados (reposición)", 30, NUM, None),
        ("cfg_DiasAlertaVence", "Alertar lotes que vencen en (días)", 30, NUM, None),
        ("cfg_PermitirSinStock", "Permitir vender sin existencias", "NO", None, "SI/NO. Si es NO, solo se vende sin stock con clave de autorización."),
        ("cfg_ClaveAutoriza", "Clave de autorización (ventas sin stock)", "1234", TXT, "Cámbiela. Se solicita en el formulario de venta."),
        ("cfg_Clave", "Clave de protección de hojas", CLAVE, TXT, "Si la cambia, ejecute el botón PROTEGER HOJAS."),
        ("cfg_RotAlta", "Rotación ALTA si días de inventario ≤", 30, NUM, None),
        ("cfg_RotMedia", "Rotación MEDIA si días de inventario ≤", 90, NUM, None),
        ("cfg_ABC_A", "Clase A hasta % acumulado de ventas", 0.80, PCT, None),
        ("cfg_ABC_B", "Clase B hasta % acumulado de ventas", 0.95, PCT, None),
        ("cfg_CarpetaRespaldo", "Carpeta de copias de seguridad", "", None, "Vacío = subcarpeta 'Respaldos' junto al archivo."),
        ("cfg_CarpetaInformes", "Carpeta de informes PDF/Excel", "", None, "Vacío = subcarpeta 'Informes' junto al archivo."),
    ]
    r = 17
    for nm, lab, val, fmt, com in params:
        etiqueta(ws, f"B{r}", lab, False)
        entrada(ws, f"C{r}", val, fmt, com)
        nombre(wb, nm, abs_ref(ws, f"C{r}"))
        r += 1
    lista_dv(ws, "C25", '"SI,NO"')
    # parámetros calculados (derivados de la fecha de análisis del DASHBOARD)
    seccion(ws, "B35", "PARÁMETROS CALCULADOS (no editar)", 2, GRIS3)
    der = [
        ("cfg_MesIni", "Inicio del mes de análisis", "=DATE(YEAR(cfg_FechaCorte),MONTH(cfg_FechaCorte),1)", FECHA),
        ("cfg_MesFin", "Inicio del mes siguiente", "=EDATE(cfg_MesIni,1)", FECHA),
        ("cfg_AnioIni", "Inicio del año de análisis", "=DATE(YEAR(cfg_FechaCorte),1,1)", FECHA),
        ("cfg_PerIni", "Inicio del período de rotación", "=cfg_FechaCorte-cfg_DiasRotacion+1", FECHA),
        ("cfg_MesAntIni", "Inicio del mes anterior", "=EDATE(cfg_MesIni,-1)", FECHA),
        (None, "Fecha de análisis (se cambia en DASHBOARD)", "=cfg_FechaCorte", FECHA),
    ]
    r = 36
    for nm, lab, f, fmt in der:
        etiqueta(ws, f"B{r}", lab, False)
        calc(ws, f"C{r}", f, fmt)
        if nm:
            nombre(wb, nm, abs_ref(ws, f"C{r}"))
        r += 1

    # ---------------- listas (tablas)
    col = 6
    listas = [
        ("tCategorias", [Col("Categoría", width=20)],
         [{"Categoría": c} for c in ["Abarrotes", "Aseo hogar", "Bebidas", "Cuidado personal", "Empaques", "Otros"]]),
        ("tUnidades", [Col("Unidad", width=12)],
         [{"Unidad": u} for u in ["Unidad", "Paca", "Caja", "Kilogramo", "Litro", "Metro", "Rollo", "Docena"]]),
        ("tMedios", [Col("Medio", width=18), Col("Saldo inicial", fmt=COP, width=15, dv="num")],
         [{"Medio": "Efectivo", "Saldo inicial": 2000000}, {"Medio": "Transferencia", "Saldo inicial": 15000000},
          {"Medio": "Tarjeta débito", "Saldo inicial": 0}, {"Medio": "Tarjeta crédito", "Saldo inicial": 0},
          {"Medio": "Nequi / Daviplata", "Saldo inicial": 0}, {"Medio": "Otro", "Saldo inicial": 0}]),
        ("tIVA", [Col("Tarifa", fmt=PCT, width=9)], [{"Tarifa": t} for t in [0, 0.05, 0.19]]),
        ("tTiposAjuste", [Col("Tipo", width=22), Col("Signo", width=7), Col("Grupo", width=11), Col("Es pérdida", width=9)],
         [dict(Tipo=a, Signo=b, Grupo=c, **{"Es pérdida": d}) for a, b, c, d in [
             ("Inventario inicial", 1, "Ajuste", "NO"), ("Sobrante", 1, "Ajuste", "NO"),
             ("Error de inventario (+)", 1, "Ajuste", "NO"), ("Devolución de cliente", 1, "Devolución", "NO"),
             ("Dañado", -1, "Ajuste", "SI"), ("Vencido", -1, "Ajuste", "SI"), ("Faltante", -1, "Ajuste", "SI"),
             ("Error de inventario (-)", -1, "Ajuste", "SI"), ("Consumo interno", -1, "Ajuste", "SI"),
             ("Devolución a proveedor", -1, "Devolución", "NO")]]),
        ("tCatGasto", [Col("Categoría", width=18), Col("Tipo", width=9)],
         [{"Categoría": a, "Tipo": b} for a, b in [
             ("Arriendo", "Fijo"), ("Servicios públicos", "Fijo"), ("Nómina", "Fijo"), ("Transporte", "Variable"),
             ("Mantenimiento", "Variable"), ("Publicidad", "Variable"), ("Papelería", "Variable"),
             ("Impuestos", "Fijo"), ("Otros gastos", "Variable")]]),
        ("tVendedores", [Col("Vendedor", width=16)], [{"Vendedor": v} for v in ["Ana Torres", "Luis Gómez", "Carla Díaz"]]),
        ("tVehiculos", [Col("Vehículo", width=18), Col("Placa", width=9), Col("Capacidad kg", fmt=NUM, width=11),
                        Col("Capacidad m3", fmt=NUM2, width=11), Col("Costo viaje", fmt=COP, width=13)],
         [{"Vehículo": "Camioneta 1 t", "Placa": "ABC123", "Capacidad kg": 1000, "Capacidad m3": 4.5, "Costo viaje": 180000},
          {"Vehículo": "Furgón NHR 2,5 t", "Placa": "DEF456", "Capacidad kg": 2500, "Capacidad m3": 14, "Costo viaje": 320000},
          {"Vehículo": "Camión 5 t", "Placa": "GHI789", "Capacidad kg": 5000, "Capacidad m3": 28, "Costo viaje": 520000}]),
    ]
    for tname, cols, rows in listas:
        crear_tabla(ws, tname, 6, col, cols, rows, estilo="TableStyleLight9")
        col += len(cols) + 1
    ws.freeze_panes = None
    ws["F4"] = "LISTAS DESPLEGABLES — agregue filas al final de cada tabla y quedarán disponibles automáticamente"
    ws["F4"].font = F(9, True, AZUL3)
    # lista de categorías con "(Todas)" para filtros
    c = col + 1
    L = get_column_letter(c)
    ws.cell(5, c, "Filtro categorías").font = F(9, True, GRIS3)
    ws.cell(6, c, "(Todas)")
    for k in range(1, 31):
        ws.cell(6 + k, c, f'=IFERROR(INDEX(tCategorias[Categoría],{k})&"","")')
    nombre(wb, "lstCatFiltro", f"'{ws.title}'!${L}$6:${L}$36")
    ws.column_dimensions[L].width = 18
    # nombres de listas
    for nm, ref in [("lstCategorias", "tCategorias[Categoría]"), ("lstUnidades", "tUnidades[Unidad]"),
                    ("lstMedios", "tMedios[Medio]"), ("lstIVA", "tIVA[Tarifa]"), ("lstTiposAjuste", "tTiposAjuste[Tipo]"),
                    ("lstCatGasto", "tCatGasto[Categoría]"), ("lstVendedores", "tVendedores[Vendedor]"),
                    ("lstVehiculos", "tVehiculos[Vehículo]"), ("lstProductos", "tProductos[Código]"),
                    ("lstClientes", "tClientes[Código]"), ("lstProveedores", "tProveedores[Código]"),
                    ("lstFacturas", "tVentas[Factura]"), ("lstCompras", "tCompras[Compra]")]:
        nombre(wb, nm, ref)


# =====================================================================  MAESTROS
def hoja_productos(wb, ws, rows):
    cols = [
        Col("Código", width=10), Col("Nombre", width=28), Col("Categoría", width=15, dv="=lstCategorias"),
        Col("Marca", width=12), Col("Descripción", width=26), Col("Unidad", width=9, dv="=lstUnidades"),
        Col("Código de barras", width=15, fmt=TXT), Col("Proveedor principal", width=11, dv="=lstProveedores"),
        Col("Costo compra", fmt=COP, width=12, dv="num"),
        Col("Costo adicional", "calc", "IFERROR(INDEX(tCostos[Costos adicionales],MATCH([@Código],tCostos[Código],0)),0)", 11, COP),
        Col("Costo unitario real", "calc", "[@Costo compra]+[@Costo adicional]", 12, COP),
        Col("Precio venta", fmt=COP, width=12, dv="num"), Col("IVA %", fmt=PCT, width=7, dv="=lstIVA"),
        Col("Precio con IVA", "calc", "ROUND([@Precio venta]*(1+[@IVA %]),0)", 12, COP),
        Col("Margen %", "calc", "IFERROR(([@Precio venta]-[@Costo unitario real])/[@Precio venta],0)", 8, PCT),
        Col("Stock mínimo", fmt=NUM, width=9, dv="num"), Col("Stock máximo", fmt=NUM, width=9, dv="num"),
        Col("Ubicación", width=9), Col("Estado", width=9, dv='"Activo,Inactivo"'),
        Col("Maneja lote", width=8, dv='"SI,NO"'), Col("Tiempo entrega días", fmt=NUM, width=9, dv="int"),
        Col("Unid por caja", fmt=NUM, width=8, dv="num"), Col("Peso unidad kg", fmt=NUM3, width=9, dv="num"),
        Col("Peso caja kg", fmt=NUM2, width=9, dv="num"), Col("Largo caja cm", fmt=NUM, width=8, dv="num"),
        Col("Ancho caja cm", fmt=NUM, width=8, dv="num"), Col("Alto caja cm", fmt=NUM, width=8, dv="num"),
        Col("Cajas por estiba", fmt=NUM, width=8, dv="num"),
        Col("Código duplicado", "calc", 'IF(COUNTIF(tProductos[Código],[@Código])>1,"DUPLICADO","")', 10),
    ]
    encabezado_hoja(ws, "📦 PRODUCTOS", "Maestro de productos. El stock NO se escribe aquí: se calcula en INVENTARIO a partir de movimientos.", len(cols))
    leyenda(ws, "C3")
    crear_tabla(ws, "tProductos", FILA_T, 1, cols, rows)


def hoja_costos(wb, ws, rows):
    P = "MATCH([@Código],tProductos[Código],0)"
    cols = [
        Col("Código", width=10, dv="=lstProductos"),
        Col("Producto", "calc", f'IFERROR(INDEX(tProductos[Nombre],{P}),"¿Código no existe?")', 26),
        Col("Costo compra", "calc", f"IFERROR(INDEX(tProductos[Costo compra],{P}),0)", 12, COP),
        Col("Transporte", fmt=COP, width=11, dv="num"), Col("Empaque", fmt=COP, width=10, dv="num"),
        Col("Mano de obra", fmt=COP, width=10, dv="num"), Col("Otros costos", fmt=COP, width=10, dv="num"),
        Col("Costos adicionales", "calc", "[@Transporte]+[@Empaque]+[@Mano de obra]+[@Otros costos]", 11, COP),
        Col("Costo unitario real", "calc", "[@Costo compra]+[@Costos adicionales]", 12, COP),
        Col("Precio venta actual", "calc", f"IFERROR(INDEX(tProductos[Precio venta],{P}),0)", 12, COP),
        Col("Margen objetivo", fmt=PCT, width=9, dv="num"),
        Col("Precio sugerido", "calc", "IFERROR(ROUND([@Costo unitario real]/(1-IF([@Margen objetivo]=\"\",cfg_MargenObjetivo,[@Margen objetivo])),0),0)", 12, COP),
        Col("Precio mínimo", "calc", "IFERROR(ROUND([@Costo unitario real]/(1-cfg_MargenMinimo),0),0)", 12, COP),
        Col("Utilidad por unidad", "calc", "[@Precio venta actual]-[@Costo unitario real]", 11, COP),
        Col("Margen sobre venta", "calc", "IFERROR([@Utilidad por unidad]/[@Precio venta actual],0)", 9, PCT),
        Col("Recargo sobre costo", "calc", "IFERROR([@Utilidad por unidad]/[@Costo unitario real],0)", 9, PCT),
        Col("Recargo equivalente al objetivo", "calc", "IFERROR(IF([@Margen objetivo]=\"\",cfg_MargenObjetivo,[@Margen objetivo])/(1-IF([@Margen objetivo]=\"\",cfg_MargenObjetivo,[@Margen objetivo])),0)", 11, PCT),
        Col("Precio con IVA", "calc", f"IFERROR(ROUND([@Precio venta actual]*(1+INDEX(tProductos[IVA %],{P})),0),0)", 12, COP),
        Col("Evaluación", "calc", 'IF([@Precio venta actual]=0,"SIN PRECIO",IF([@Precio venta actual]<[@Costo unitario real],"PÉRDIDA",IF([@Precio venta actual]<[@Precio mínimo],"BAJO MÍNIMO",IF([@Precio venta actual]<[@Precio sugerido],"BAJO OBJETIVO","OK"))))', 13),
    ]
    encabezado_hoja(ws, "💲 COSTOS Y PRECIOS",
                    "Margen sobre venta = Utilidad / Precio.  Recargo sobre costo = Utilidad / Costo.  Precio sugerido = Costo real / (1 − margen objetivo).",
                    len(cols))
    leyenda(ws, "C3")
    ws["C4"] = ("Ejemplo: costo $7.000 y precio $10.000 → margen sobre venta 30% pero recargo sobre costo 42,9%. "
                "Para ganar 30% sobre la venta NO basta con sumar 30% al costo.")
    ws["C4"].font = F(9, True, VERDE)
    crear_tabla(ws, "tCostos", FILA_T, 1, cols, rows)


def hoja_clientes(wb, ws, rows):
    cols = [
        Col("Código", width=9), Col("Nombre", width=28), Col("NIT CC", width=14, fmt=TXT), Col("Teléfono", width=13, fmt=TXT),
        Col("Email", width=24), Col("Dirección", width=22), Col("Ciudad", width=11),
        Col("Plazo crédito días", fmt=NUM, width=9, dv="int"), Col("Cupo crédito", fmt=COP, width=13, dv="num"),
        Col("Estado", width=9, dv='"Activo,Inactivo"'),
        Col("Total vendido", "calc", "SUMIFS(tVentas[Total factura],tVentas[Cliente],[@Código])", 14, COP),
        Col("Total abonado", "calc", "SUMIFS(tVentas[Pagado],tVentas[Cliente],[@Código])", 14, COP),
        Col("Saldo pendiente", "calc", "SUMIFS(tVentas[Saldo],tVentas[Cliente],[@Código])", 14, COP),
        Col("Saldo vencido", "calc", 'SUMIFS(tVentas[Saldo],tVentas[Cliente],[@Código],tVentas[Días vencido],">0")', 13, COP),
        Col("Días máx vencido", "calc", "_xlfn.MAXIFS(tVentas[Días vencido],tVentas[Cliente],[@Código])", 9, NUM),
        Col("Última compra", "calc", 'IF(_xlfn.MAXIFS(tVentas[Fecha],tVentas[Cliente],[@Código],tVentas[Estado],"Activa")=0,"",_xlfn.MAXIFS(tVentas[Fecha],tVentas[Cliente],[@Código],tVentas[Estado],"Activa"))', 11, FECHA),
        Col("Facturas", "calc", 'COUNTIFS(tVentas[Cliente],[@Código],tVentas[Estado],"Activa")', 8, NUM),
        Col("Cupo disponible", "calc", "IF([@Cupo crédito]=0,0,[@Cupo crédito]-[@Saldo pendiente])", 13, COP),
        Col("Alerta", "calc", 'IF([@Días máx vencido]>60,"MORA CRÍTICA",IF([@Días máx vencido]>0,"CARTERA VENCIDA",IF(AND([@Cupo crédito]>0,[@Saldo pendiente]>[@Cupo crédito]),"CUPO EXCEDIDO",IF(COUNTIF(tClientes[Código],[@Código])>1,"CÓDIGO DUPLICADO","Al día"))))', 15),
    ]
    encabezado_hoja(ws, "👥 CLIENTES Y CARTERA", "Información del cliente, historial, abonos, saldos y alertas de cartera vencida.", len(cols))
    leyenda(ws, "C3")
    crear_tabla(ws, "tClientes", FILA_T, 1, cols, rows)


def hoja_proveedores(wb, ws, rows):
    cols = [
        Col("Código", width=9), Col("Razón social", width=28), Col("NIT", width=14, fmt=TXT), Col("Contacto", width=14),
        Col("Teléfono", width=13, fmt=TXT), Col("Email", width=24), Col("Dirección", width=18), Col("Ciudad", width=11),
        Col("Plazo pago días", fmt=NUM, width=8, dv="int"), Col("Tiempo entrega días", fmt=NUM, width=8, dv="int"),
        Col("Calidad 1-5", fmt=NUM, width=8, dv="int"), Col("Cumplimiento 1-5", fmt=NUM, width=10, dv="int"),
        Col("Estado", width=9, dv='"Activo,Inactivo"'),
        Col("Productos suministrados", "calc", "COUNTIFS(tProductos[Proveedor principal],[@Código])", 11, NUM),
        Col("Total comprado", "calc", 'SUMIFS(tCompras[Total compra],tCompras[Proveedor],[@Código],tCompras[Estado recepción],"Recibida")', 14, COP),
        Col("Pagado", "calc", "SUMIFS(tCompras[Pagado],tCompras[Proveedor],[@Código])", 14, COP),
        Col("Saldo pendiente", "calc", "SUMIFS(tCompras[Saldo],tCompras[Proveedor],[@Código])", 14, COP),
        Col("Próximo vencimiento", "calc", 'IF(_xlfn.MINIFS(tCompras[Vence],tCompras[Proveedor],[@Código],tCompras[Saldo],">1")=0,"",_xlfn.MINIFS(tCompras[Vence],tCompras[Proveedor],[@Código],tCompras[Saldo],">1"))', 11, FECHA),
        Col("Órdenes pendientes", "calc", 'COUNTIFS(tCompras[Proveedor],[@Código],tCompras[Estado recepción],"Pendiente")', 10, NUM),
        Col("Puntaje", "calc", "IFERROR(AVERAGE([@Calidad 1-5],[@Cumplimiento 1-5]),0)", 8, NUM2),
        Col("Evaluación", "calc", 'IF([@Puntaje]>=4.5,"Excelente",IF([@Puntaje]>=3.5,"Bueno",IF([@Puntaje]>=2.5,"Regular","Deficiente")))', 11),
    ]
    encabezado_hoja(ws, "🏭 PROVEEDORES", "Datos, productos suministrados, compras, saldos, vencimientos y evaluación.", len(cols))
    leyenda(ws, "C3")
    crear_tabla(ws, "tProveedores", FILA_T, 1, cols, rows)


# =====================================================================  TRANSACCIONES
def hoja_ventas(wb, ws, rows):
    cols = [
        Col("Factura", width=11), Col("Fecha", fmt=FECHA, width=11, dv="date"), Col("Cliente", width=9, dv="=lstClientes"),
        Col("Nombre cliente", "calc", 'IFERROR(INDEX(tClientes[Nombre],MATCH([@Cliente],tClientes[Código],0)),"¿Cliente no existe?")', 24),
        Col("Vendedor", width=12, dv="=lstVendedores"), Col("Medio de pago", width=13, dv="=lstMedios"),
        Col("Condición", width=9, dv='"Contado,Crédito"'), Col("Plazo días", fmt=NUM, width=7, dv="int"),
        Col("Estado", width=8, dv='"Activa,Anulada"'), Col("Observaciones", width=18), Col("Usuario", width=9),
        Col("Registrado", fmt=FECHAHORA, width=14),
        Col("Valor bruto", "calc", 'IF([@Estado]="Anulada",0,SUMIFS(tVentasDet[Valor bruto],tVentasDet[Factura],[@Factura]))', 13, COP),
        Col("Descuento", "calc", 'IF([@Estado]="Anulada",0,SUMIFS(tVentasDet[Descuento valor],tVentasDet[Factura],[@Factura]))', 11, COP),
        Col("Base sin IVA", "calc", "[@Valor bruto]-[@Descuento]", 13, COP),
        Col("IVA", "calc", 'IF([@Estado]="Anulada",0,SUMIFS(tVentasDet[IVA valor],tVentasDet[Factura],[@Factura]))', 11, COP),
        Col("Total factura", "calc", "[@Base sin IVA]+[@IVA]", 13, COP),
        Col("Pagado", "calc", 'SUMIFS(tPagos[Valor],tPagos[Tipo],"Cobro cliente",tPagos[Documento],[@Factura],tPagos[Estado],"Activo")', 13, COP),
        Col("Saldo", "calc", "[@Total factura]-[@Pagado]", 12, COP),
        Col("Vence", "calc", "[@Fecha]+[@Plazo días]", 11, FECHA),
        Col("Días vencido", "calc", "IF([@Saldo]>1,MAX(0,cfg_FechaCorte-[@Vence]),0)", 8, NUM),
        Col("Estado pago", "calc", 'IF([@Estado]="Anulada","Anulada",IF([@Saldo]<-1,"Saldo a favor",IF([@Saldo]<=1,"Pagada",IF([@Días vencido]>0,"Vencida",IF([@Pagado]>0,"Abonada","Pendiente")))))', 10),
        Col("Clave mora", "calc", 'IF([@Días vencido]>0,[@Días vencido]+ROW()/100000,"")', 8, NUM2),
        Col("Mes", "calc", "YEAR([@Fecha])*100+MONTH([@Fecha])", 8),
        Col("Control", "calc", 'IF(COUNTIF(tVentas[Factura],[@Factura])>1,"FACTURA DUPLICADA",IF(COUNTIF(tVentasDet[Factura],[@Factura])=0,"SIN DETALLE",""))', 12),
    ]
    encabezado_hoja(ws, "🧾 VENTAS — ENCABEZADO DE FACTURAS",
                    "Una fila por factura. Los productos van en VENTAS_DET. Use el formulario F_VENTA para registrar. El estado de pago se calcula con los cobros de PAGOS.",
                    len(cols))
    leyenda(ws, "C3")
    enlace(ws, "D3", "➜ Formulario de venta", "F_VENTA")
    crear_tabla(ws, "tVentas", FILA_T, 1, cols, rows)


def hoja_ventas_det(wb, ws, rows):
    H = "MATCH([@Factura],tVentas[Factura],0)"
    cols = [
        Col("Factura", width=11, dv="=lstFacturas"), Col("Línea", fmt=NUM, width=6), Col("Producto", width=9, dv="=lstProductos"),
        Col("Cantidad", fmt=NUM2, width=9, dv="num"), Col("Precio unitario", fmt=COP, width=12, dv="num"),
        Col("Descuento %", fmt=PCT, width=8, dv="num"), Col("IVA %", fmt=PCT, width=7, dv="=lstIVA"), Col("Lote", width=10),
        Col("Precio aplicado", "calc", f'IF([@Precio unitario]="",IFERROR(INDEX(tProductos[Precio venta],{MATCHP}),0),[@Precio unitario])', 12, COP),
        Col("IVA aplicado", "calc", f'IF([@IVA %]="",IFERROR(INDEX(tProductos[IVA %],{MATCHP}),cfg_IVA),[@IVA %])', 8, PCT),
        Col("Valor bruto", "calc", "ROUND([@Cantidad]*[@Precio aplicado],0)", 12, COP),
        Col("Descuento valor", "calc", "ROUND([@Valor bruto]*[@Descuento %],0)", 11, COP),
        Col("Base sin IVA", "calc", "[@Valor bruto]-[@Descuento valor]", 12, COP),
        Col("IVA valor", "calc", "ROUND([@Base sin IVA]*[@IVA aplicado],0)", 11, COP),
        Col("Total línea", "calc", "[@Base sin IVA]+[@IVA valor]", 12, COP),
        Col("Fecha", "calc", f'IFERROR(INDEX(tVentas[Fecha],{H}),"")', 11, FECHA),
        Col("Cliente", "calc", f'IFERROR(INDEX(tVentas[Cliente],{H}),"")', 8),
        Col("Vendedor", "calc", f'IFERROR(INDEX(tVentas[Vendedor],{H})&"","")', 11),
        Col("Estado factura", "calc", f'IFERROR(INDEX(tVentas[Estado],{H}),"NO EXISTE")', 9),
        Col("Nombre producto", "calc", f'IFERROR(INDEX(tProductos[Nombre],{MATCHP}),"¿No existe?")', 24),
        Col("Categoría", "calc", f'IFERROR(INDEX(tProductos[Categoría],{MATCHP}),"")', 13),
        Col("Cantidad efectiva", "calc", 'IF([@Estado factura]="Activa",[@Cantidad],0)', 9, NUM2),
        Col("Base efectiva", "calc", 'IF([@Estado factura]="Activa",[@Base sin IVA],0)', 12, COP),
        Col("IVA efectivo", "calc", 'IF([@Estado factura]="Activa",[@IVA valor],0)', 11, COP),
        Col("Costo unitario", "calc", f"IFERROR(INDEX(tProductos[Costo unitario real],{MATCHP}),0)", 11, COP),
        Col("Costo total", "calc", "ROUND([@Cantidad efectiva]*[@Costo unitario],0)", 12, COP),
        Col("Utilidad bruta", "calc", "[@Base efectiva]-[@Costo total]", 12, COP),
        Col("Mes", "calc", 'IF([@Fecha]="","",YEAR([@Fecha])*100+MONTH([@Fecha]))', 8),
    ]
    encabezado_hoja(ws, "🧾 VENTAS — DETALLE POR PRODUCTO",
                    "Cada línea descuenta inventario automáticamente (si la factura está Activa). Anular la factura devuelve el stock sin borrar historial.",
                    len(cols))
    leyenda(ws, "C3")
    crear_tabla(ws, "tVentasDet", FILA_T, 1, cols, rows)


def hoja_compras(wb, ws, rows):
    cols = [
        Col("Compra", width=11), Col("Fecha", fmt=FECHA, width=11, dv="date"), Col("Proveedor", width=9, dv="=lstProveedores"),
        Col("Nombre proveedor", "calc", 'IFERROR(INDEX(tProveedores[Razón social],MATCH([@Proveedor],tProveedores[Código],0)),"¿Proveedor no existe?")', 24),
        Col("Factura proveedor", width=11), Col("Flete", fmt=COP, width=11, dv="num"), Col("Plazo días", fmt=NUM, width=7, dv="int"),
        Col("Estado recepción", width=10, dv='"Pendiente,Recibida,Anulada"'), Col("Fecha recepción", fmt=FECHA, width=11, dv="date"),
        Col("Recibido por", width=11), Col("Observaciones", width=18), Col("Usuario", width=9), Col("Registrado", fmt=FECHAHORA, width=14),
        Col("Subtotal", "calc", 'IF([@Estado recepción]="Anulada",0,SUMIFS(tComprasDet[Subtotal],tComprasDet[Compra],[@Compra]))', 13, COP),
        Col("IVA", "calc", 'IF([@Estado recepción]="Anulada",0,SUMIFS(tComprasDet[IVA valor],tComprasDet[Compra],[@Compra]))', 11, COP),
        Col("Total compra", "calc", 'IF([@Estado recepción]="Anulada",0,[@Subtotal]+[@IVA]+[@Flete])', 13, COP),
        Col("Pagado", "calc", 'SUMIFS(tPagos[Valor],tPagos[Tipo],"Pago proveedor",tPagos[Documento],[@Compra],tPagos[Estado],"Activo")', 13, COP),
        Col("Saldo", "calc", 'IF([@Estado recepción]="Recibida",[@Total compra]-[@Pagado],0)', 12, COP),
        Col("Anticipo", "calc", 'IF([@Estado recepción]="Recibida",0,[@Pagado])', 11, COP),
        Col("Vence", "calc", 'IF(OR([@Estado recepción]<>"Recibida",[@Fecha recepción]=""),"",[@Fecha recepción]+[@Plazo días])', 11, FECHA),
        Col("Días vencido", "calc", 'IF(AND([@Saldo]>1,[@Vence]<>""),MAX(0,cfg_FechaCorte-[@Vence]),0)', 8, NUM),
        Col("Estado pago", "calc", 'IF([@Estado recepción]="Anulada","Anulada",IF([@Estado recepción]="Pendiente",IF([@Pagado]>0,"Anticipo","Por recibir"),IF([@Saldo]<=1,"Pagada",IF([@Días vencido]>0,"Vencida",IF([@Pagado]>0,"Abonada","Pendiente")))))', 10),
        Col("Clave mora", "calc", 'IF([@Días vencido]>0,[@Días vencido]+ROW()/100000,"")', 8, NUM2),
        Col("Control", "calc", 'IF(COUNTIF(tCompras[Compra],[@Compra])>1,"COMPRA DUPLICADA",IF(COUNTIF(tComprasDet[Compra],[@Compra])=0,"SIN DETALLE",IF(AND([@Estado recepción]="Recibida",[@Fecha recepción]=""),"FALTA FECHA RECEPCIÓN","")))', 14),
    ]
    encabezado_hoja(ws, "🛒 COMPRAS — ENCABEZADO",
                    "El inventario SOLO aumenta cuando 'Estado recepción' = Recibida. Use F_COMPRA para registrar y confirmar la recepción.",
                    len(cols))
    leyenda(ws, "C3")
    enlace(ws, "D3", "➜ Formulario de compra", "F_COMPRA")
    crear_tabla(ws, "tCompras", FILA_T, 1, cols, rows)


def hoja_compras_det(wb, ws, rows):
    H = "MATCH([@Compra],tCompras[Compra],0)"
    cols = [
        Col("Compra", width=11, dv="=lstCompras"), Col("Producto", width=9, dv="=lstProductos"),
        Col("Cantidad", fmt=NUM2, width=9, dv="num"), Col("Costo unitario", fmt=COP, width=12, dv="num"),
        Col("IVA %", fmt=PCT, width=7, dv="=lstIVA"), Col("Lote", width=11), Col("Fecha vencimiento", fmt=FECHA, width=11, dv="date"),
        Col("Nombre producto", "calc", f'IFERROR(INDEX(tProductos[Nombre],{MATCHP}),"¿No existe?")', 24),
        Col("Categoría", "calc", f'IFERROR(INDEX(tProductos[Categoría],{MATCHP}),"")', 13),
        Col("Proveedor", "calc", f'IFERROR(INDEX(tCompras[Proveedor],{H})&"","")', 9),
        Col("Estado recepción", "calc", f'IFERROR(INDEX(tCompras[Estado recepción],{H}),"NO EXISTE")', 10),
        Col("Fecha recepción", "calc", f'IFERROR(IF(INDEX(tCompras[Fecha recepción],{H})="","",INDEX(tCompras[Fecha recepción],{H})),"")', 11, FECHA),
        Col("Costo aplicado", "calc", f'IF([@Costo unitario]="",IFERROR(INDEX(tProductos[Costo compra],{MATCHP}),0),[@Costo unitario])', 12, COP),
        Col("IVA aplicado", "calc", f'IF([@IVA %]="",IFERROR(INDEX(tProductos[IVA %],{MATCHP}),cfg_IVA),[@IVA %])', 8, PCT),
        Col("Subtotal", "calc", "ROUND([@Cantidad]*[@Costo aplicado],0)", 12, COP),
        Col("IVA valor", "calc", "ROUND([@Subtotal]*[@IVA aplicado],0)", 11, COP),
        Col("Flete prorrateado", "calc", f"IFERROR(ROUND(INDEX(tCompras[Flete],{H})*[@Subtotal]/SUMIFS(tComprasDet[Subtotal],tComprasDet[Compra],[@Compra]),0),0)", 11, COP),
        Col("Costo total línea", "calc", "[@Subtotal]+[@Flete prorrateado]", 12, COP),
        Col("Costo unitario con flete", "calc", "IFERROR([@Costo total línea]/[@Cantidad],0)", 11, COP),
        Col("Cantidad recibida", "calc", 'IF([@Estado recepción]="Recibida",[@Cantidad],0)', 9, NUM2),
        Col("Cantidad en tránsito", "calc", 'IF([@Estado recepción]="Pendiente",[@Cantidad],0)', 9, NUM2),
        Col("Mes", "calc", 'IF([@Fecha recepción]="","",YEAR([@Fecha recepción])*100+MONTH([@Fecha recepción]))', 8),
    ]
    encabezado_hoja(ws, "🛒 COMPRAS — DETALLE POR PRODUCTO",
                    "Lote y vencimiento por línea. El flete se prorratea por valor. El IVA de compras se registra aparte (descontable) y no forma parte del costo.",
                    len(cols))
    leyenda(ws, "C3")
    crear_tabla(ws, "tComprasDet", FILA_T, 1, cols, rows)


def hoja_pagos(wb, ws, rows):
    cols = [
        Col("Recibo", width=10), Col("Fecha", fmt=FECHA, width=11, dv="date"),
        Col("Tipo", width=13, dv='"Cobro cliente,Pago proveedor"'), Col("Documento", width=11),
        Col("Medio de pago", width=14, dv="=lstMedios"), Col("Valor", fmt=COP, width=13, dv="num"), Col("Referencia", width=16),
        Col("Estado", width=8, dv='"Activo,Anulado"'), Col("Observaciones", width=18), Col("Usuario", width=9),
        Col("Registrado", fmt=FECHAHORA, width=14),
        Col("Tercero", "calc", 'IF([@Tipo]="Cobro cliente",IFERROR(INDEX(tVentas[Nombre cliente],MATCH([@Documento],tVentas[Factura],0)),"¿Factura no existe?"),IFERROR(INDEX(tCompras[Nombre proveedor],MATCH([@Documento],tCompras[Compra],0)),"¿Compra no existe?"))', 24),
        Col("Flujo", "calc", 'IF([@Estado]<>"Activo",0,IF([@Tipo]="Cobro cliente",[@Valor],-[@Valor]))', 13, COP),
        Col("Mes", "calc", "YEAR([@Fecha])*100+MONTH([@Fecha])", 8),
    ]
    encabezado_hoja(ws, "💳 COBROS A CLIENTES Y PAGOS A PROVEEDORES",
                    "Única fuente del dinero recibido/pagado por ventas y compras: así una venta nunca se cuenta dos veces en caja.",
                    len(cols))
    leyenda(ws, "C3")
    enlace(ws, "D3", "➜ Registrar pago/abono", "F_MOVIMIENTOS")
    crear_tabla(ws, "tPagos", FILA_T, 1, cols, rows)


def hoja_gastos(wb, ws, rows):
    cols = [
        Col("Gasto", width=10), Col("Fecha", fmt=FECHA, width=11, dv="date"), Col("Categoría", width=16, dv="=lstCatGasto"),
        Col("Descripción", width=26), Col("Beneficiario", width=18), Col("Medio de pago", width=14, dv="=lstMedios"),
        Col("Valor", fmt=COP, width=13, dv="num"), Col("Comprobante", width=10), Col("Estado", width=8, dv='"Pagado,Anulado"'),
        Col("Usuario", width=9), Col("Registrado", fmt=FECHAHORA, width=14),
        Col("Tipo gasto", "calc", 'IFERROR(INDEX(tCatGasto[Tipo],MATCH([@Categoría],tCatGasto[Categoría],0)),"Variable")', 9),
        Col("Valor efectivo", "calc", 'IF([@Estado]="Pagado",[@Valor],0)', 13, COP),
        Col("Mes", "calc", "YEAR([@Fecha])*100+MONTH([@Fecha])", 8),
        Col("Año", "calc", "YEAR([@Fecha])", 7),
    ]
    encabezado_hoja(ws, "📉 GASTOS OPERACIONALES",
                    "Registre el gasto cuando se paga. Se descuenta de caja según el medio de pago y del estado de resultados.", len(cols))
    leyenda(ws, "C3")
    enlace(ws, "D3", "➜ Registrar gasto", "F_MOVIMIENTOS")
    # resumen superior (día / mes / año por categoría)
    seccion(ws, "A5", "RESUMEN DE GASTOS (según fecha de análisis del DASHBOARD)", 8)
    hdr = ["Categoría", "Tipo", "Del día", "Del mes", "Del año", "Promedio mensual año", "% del año"]
    for j, h in enumerate(hdr):
        c = ws.cell(6, 1 + j, h)
        c.font = F(9, True, BLANCO)
        c.fill = fill(GRIS3)
        c.alignment = Alignment(horizontal="center", wrap_text=True)
    for k in range(1, 13):
        r = 6 + k
        ws.cell(r, 1, f'=IFERROR(INDEX(tCatGasto[Categoría],{k})&"","")')
        ws.cell(r, 2, f'=IF(A{r}="","",IFERROR(INDEX(tCatGasto[Tipo],{k})&"",""))')
        ws.cell(r, 3, f'=IF(A{r}="","",SUMIFS(tGastos[Valor efectivo],tGastos[Categoría],A{r},tGastos[Fecha],cfg_FechaCorte))')
        ws.cell(r, 4, f'=IF(A{r}="","",SUMIFS(tGastos[Valor efectivo],tGastos[Categoría],A{r},tGastos[Fecha],">="&cfg_MesIni,tGastos[Fecha],"<"&cfg_MesFin))')
        ws.cell(r, 5, f'=IF(A{r}="","",SUMIFS(tGastos[Valor efectivo],tGastos[Categoría],A{r},tGastos[Fecha],">="&cfg_AnioIni,tGastos[Fecha],"<="&cfg_FechaCorte))')
        ws.cell(r, 6, f'=IF(A{r}="","",E{r}/MONTH(cfg_FechaCorte))')
        ws.cell(r, 7, f'=IF(A{r}="","",IFERROR(E{r}/$E$19,0))')
        for j, fm in enumerate([None, None, COP, COP, COP, COP, PCT]):
            c = ws.cell(r, 1 + j)
            c.font = F(9)
            c.fill = fill(GRIS)
            c.border = BORDE
            if fm:
                c.number_format = fm
    r = 19
    ws.cell(r, 1, "TOTAL").font = F(9, True)
    for j, L in enumerate("CDEF"):
        c = ws[f"{L}{r}"]
        c.value = f"=SUM({L}7:{L}18)"
        c.number_format = COP
        c.font = F(9, True)
        c.fill = fill(CELESTE)
    nombre(wb, "gas_Cat", abs_rng(ws, "A7:A18"))
    nombre(wb, "gas_Mes", abs_rng(ws, "D7:D18"))
    nombre(wb, "gas_Anio", abs_rng(ws, "E7:E18"))
    nombre(wb, "gas_TotDia", abs_ref(ws, "C19"))
    nombre(wb, "gas_TotMes", abs_ref(ws, "D19"))
    nombre(wb, "gas_TotAnio", abs_ref(ws, "E19"))
    crear_tabla(ws, "tGastos", 22, 1, cols, rows)
    for j, c in enumerate(cols):
        ws.column_dimensions[get_column_letter(1 + j)].width = max(c.width, 12)


def hoja_movcaja(wb, ws, rows):
    cols = [
        Col("Movimiento", width=10), Col("Fecha", fmt=FECHA, width=11, dv="date"), Col("Tipo", width=9, dv='"Ingreso,Egreso"'),
        Col("Concepto", width=22, dv='"Aporte de socios,Préstamo recibido,Pago de préstamo,Retiro de socios,Traslado entre medios,Otros ingresos,Otros egresos"'),
        Col("Medio de pago", width=14, dv="=lstMedios"), Col("Valor", fmt=COP, width=13, dv="num"), Col("Detalle", width=26),
        Col("Estado", width=8, dv='"Activo,Anulado"'), Col("Usuario", width=9), Col("Registrado", fmt=FECHAHORA, width=14),
        Col("Flujo", "calc", 'IF([@Estado]<>"Activo",0,IF([@Tipo]="Ingreso",[@Valor],-[@Valor]))', 13, COP),
        Col("Mes", "calc", "YEAR([@Fecha])*100+MONTH([@Fecha])", 8),
    ]
    encabezado_hoja(ws, "🏦 OTROS MOVIMIENTOS DE CAJA",
                    "Aportes, préstamos, retiros y traslados entre medios. NO registre aquí ventas, compras ni gastos (tienen su propio registro).",
                    len(cols))
    leyenda(ws, "C3")
    crear_tabla(ws, "tMovCaja", FILA_T, 1, cols, rows)


def hoja_ajustes(wb, ws, rows):
    cols = [
        Col("Ajuste", width=10), Col("Fecha", fmt=FECHA, width=11, dv="date"), Col("Producto", width=9, dv="=lstProductos"),
        Col("Tipo", width=20, dv="=lstTiposAjuste"), Col("Cantidad", fmt=NUM2, width=9, dv="num"), Col("Lote", width=11),
        Col("Fecha vencimiento", fmt=FECHA, width=11, dv="date"), Col("Motivo", width=26), Col("Responsable", width=12),
        Col("Documento", width=10), Col("Usuario", width=9), Col("Registrado", fmt=FECHAHORA, width=14),
        Col("Nombre producto", "calc", f'IFERROR(INDEX(tProductos[Nombre],{MATCHP}),"¿No existe?")', 24),
        Col("Signo", "calc", "IFERROR(INDEX(tTiposAjuste[Signo],MATCH([@Tipo],tTiposAjuste[Tipo],0)),0)", 6),
        Col("Grupo", "calc", 'IFERROR(INDEX(tTiposAjuste[Grupo],MATCH([@Tipo],tTiposAjuste[Tipo],0)),"")', 10),
        Col("Cantidad neta", "calc", "[@Cantidad]*[@Signo]", 9, NUM2),
        Col("Costo unitario", "calc", f"IFERROR(INDEX(tProductos[Costo unitario real],{MATCHP}),0)", 11, COP),
        Col("Valor movimiento", "calc", "ROUND([@Cantidad neta]*[@Costo unitario],0)", 12, COP),
        Col("Es pérdida", "calc", 'IFERROR(INDEX(tTiposAjuste[Es pérdida],MATCH([@Tipo],tTiposAjuste[Tipo],0)),"NO")', 8),
        Col("Valor pérdida", "calc", 'IF([@Es pérdida]="SI",ROUND([@Cantidad]*[@Costo unitario],0),0)', 12, COP),
        Col("Mes", "calc", "YEAR([@Fecha])*100+MONTH([@Fecha])", 8),
    ]
    encabezado_hoja(ws, "⚠ PÉRDIDAS, AJUSTES Y DEVOLUCIONES DE INVENTARIO",
                    "Inventario inicial, dañados, vencidos, faltantes, devoluciones y errores. Cantidad siempre positiva: el signo lo define el Tipo.",
                    len(cols))
    leyenda(ws, "C3")
    enlace(ws, "D3", "➜ Registrar ajuste", "F_MOVIMIENTOS")
    crear_tabla(ws, "tAjustes", FILA_T, 1, cols, rows)


def hoja_despachos(wb, ws, rows):
    P = MATCHP
    V = "MATCH([@Vehículo],tVehiculos[Vehículo],0)"
    cols = [
        Col("Despacho", width=10), Col("Fecha", fmt=FECHA, width=11, dv="date"), Col("Factura", width=10),
        Col("Destino", width=22), Col("Vehículo", width=16, dv="=lstVehiculos"), Col("Conductor", width=13),
        Col("Producto", width=9, dv="=lstProductos"), Col("Cantidad", fmt=NUM, width=9, dv="num"),
        Col("Estado", width=10, dv='"Programado,En ruta,Entregado,Cancelado"'),
        Col("Unid por caja", "calc", f"MAX(1,IFERROR(INDEX(tProductos[Unid por caja],{P}),1))", 8, NUM),
        Col("Cajas", "calc", "ROUNDUP([@Cantidad]/[@Unid por caja],0)", 7, NUM),
        Col("Peso neto kg", "calc", f"ROUND([@Cantidad]*IFERROR(INDEX(tProductos[Peso unidad kg],{P}),0),2)", 9, NUM2),
        Col("Peso bruto kg", "calc", f"ROUND([@Cajas]*IFERROR(INDEX(tProductos[Peso caja kg],{P}),0),2)", 9, NUM2),
        Col("Volumen m3", "calc", f"ROUND([@Cajas]*IFERROR(INDEX(tProductos[Largo caja cm],{P})*INDEX(tProductos[Ancho caja cm],{P})*INDEX(tProductos[Alto caja cm],{P}),0)/1000000,3)", 9, NUM3),
        Col("Estibas", "calc", f"IFERROR(ROUNDUP([@Cajas]/INDEX(tProductos[Cajas por estiba],{P}),0),0)", 7, NUM),
        Col("Peso despacho kg", "calc", "SUMIFS(tDespachos[Peso bruto kg],tDespachos[Despacho],[@Despacho])", 10, NUM2),
        Col("Volumen despacho m3", "calc", "SUMIFS(tDespachos[Volumen m3],tDespachos[Despacho],[@Despacho])", 10, NUM3),
        Col("Capacidad kg", "calc", f"IFERROR(INDEX(tVehiculos[Capacidad kg],{V}),0)", 9, NUM),
        Col("Capacidad m3", "calc", f"IFERROR(INDEX(tVehiculos[Capacidad m3],{V}),0)", 9, NUM2),
        Col("Ocupación peso", "calc", "IFERROR([@Peso despacho kg]/[@Capacidad kg],0)", 9, PCT),
        Col("Ocupación volumen", "calc", "IFERROR([@Volumen despacho m3]/[@Capacidad m3],0)", 9, PCT),
        Col("Costo viaje", "calc", f"IFERROR(INDEX(tVehiculos[Costo viaje],{V}),0)", 11, COP),
        Col("Costo asignado", "calc", "IFERROR(ROUND([@Costo viaje]*[@Volumen m3]/[@Volumen despacho m3],0),0)", 11, COP),
        Col("Costo logístico por unidad", "calc", "IFERROR([@Costo asignado]/[@Cantidad],0)", 10, COP),
        Col("Capacidad disponible m3", "calc", "[@Capacidad m3]-[@Volumen despacho m3]", 10, NUM3),
        Col("Alerta", "calc", 'IF(OR([@Ocupación peso]>1,[@Ocupación volumen]>1),"SOBRECARGA",IF(MAX([@Ocupación peso],[@Ocupación volumen])>0.9,"Casi lleno","OK"))', 10),
        Col("Primera", "calc", "IF(MATCH([@Despacho],tDespachos[Despacho],0)=ROW()-ROW(tDespachos[#Headers]),1,0)", 7),
        Col("N resumen", "calc", 'IF([@Primera]=1,SUM(INDEX(tDespachos[Primera],1):[@Primera]),"")', 7),
    ]
    encabezado_hoja(ws, "🚚 CONTROL DE DESPACHOS",
                    "Una fila por producto despachado. Peso, volumen, estibas, ocupación del vehículo y costo logístico por unidad se calculan solos.",
                    len(cols))
    leyenda(ws, "C3")
    enlace(ws, "D3", "➜ Calculadora de cubicaje", "LOGISTICA")
    crear_tabla(ws, "tDespachos", FILA_T, 1, cols, rows)


def hoja_cierres(wb, ws, rows):
    EF = '"Efectivo"'
    def flujo_ef(cond):
        return (f'SUMIFS(tPagos[Flujo],tPagos[Medio de pago],{EF},tPagos[Fecha],{cond})'
                f'+SUMIFS(tMovCaja[Flujo],tMovCaja[Medio de pago],{EF},tMovCaja[Fecha],{cond})'
                f'-SUMIFS(tGastos[Valor efectivo],tGastos[Medio de pago],{EF},tGastos[Fecha],{cond})')
    cols = [
        Col("Fecha", fmt=FECHA, width=11, dv="date"), Col("Efectivo contado", fmt=COP, width=14, dv="num"),
        Col("Responsable", width=13), Col("Observaciones", width=24), Col("Usuario", width=9), Col("Registrado", fmt=FECHAHORA, width=14),
        Col("Saldo inicial efectivo", "calc", f'IFERROR(INDEX(tMedios[Saldo inicial],MATCH({EF},tMedios[Medio],0)),0)+' + flujo_ef('"<"&[@Fecha]'), 14, COP),
        Col("Ingresos efectivo", "calc", f'SUMIFS(tPagos[Valor],tPagos[Tipo],"Cobro cliente",tPagos[Estado],"Activo",tPagos[Medio de pago],{EF},tPagos[Fecha],[@Fecha])+SUMIFS(tMovCaja[Valor],tMovCaja[Tipo],"Ingreso",tMovCaja[Estado],"Activo",tMovCaja[Medio de pago],{EF},tMovCaja[Fecha],[@Fecha])', 13, COP),
        Col("Egresos efectivo", "calc", f'SUMIFS(tPagos[Valor],tPagos[Tipo],"Pago proveedor",tPagos[Estado],"Activo",tPagos[Medio de pago],{EF},tPagos[Fecha],[@Fecha])+SUMIFS(tMovCaja[Valor],tMovCaja[Tipo],"Egreso",tMovCaja[Estado],"Activo",tMovCaja[Medio de pago],{EF},tMovCaja[Fecha],[@Fecha])+SUMIFS(tGastos[Valor efectivo],tGastos[Medio de pago],{EF},tGastos[Fecha],[@Fecha])', 13, COP),
        Col("Saldo esperado", "calc", "[@Saldo inicial efectivo]+[@Ingresos efectivo]-[@Egresos efectivo]", 14, COP),
        Col("Diferencia", "calc", 'IF([@Efectivo contado]="",0,[@Efectivo contado]-[@Saldo esperado])', 12, COP),
        Col("Ingresos otros medios", "calc", f'SUMIFS(tPagos[Valor],tPagos[Tipo],"Cobro cliente",tPagos[Estado],"Activo",tPagos[Fecha],[@Fecha])-SUMIFS(tPagos[Valor],tPagos[Tipo],"Cobro cliente",tPagos[Estado],"Activo",tPagos[Fecha],[@Fecha],tPagos[Medio de pago],{EF})', 14, COP),
        Col("Estado", "calc", 'IF([@Efectivo contado]="","Sin conteo",IF(ABS([@Diferencia])<1,"Cuadrado",IF([@Diferencia]>0,"Sobrante","Faltante")))', 10),
    ]
    encabezado_hoja(ws, "🔒 CIERRES DIARIOS DE CAJA (CONCILIACIÓN)",
                    "Compare el efectivo contado físicamente con el saldo esperado según los movimientos registrados.", len(cols))
    leyenda(ws, "C3")
    enlace(ws, "D3", "➜ Hacer cierre", "F_MOVIMIENTOS", "B28")
    crear_tabla(ws, "tCierres", FILA_T, 1, cols, rows)


def hoja_log(wb, ws, rows):
    cols = [Col("Fecha hora", fmt=FECHAHORA, width=17), Col("Usuario", width=14), Col("Acción", width=22),
            Col("Documento", width=14), Col("Detalle", width=70)]
    encabezado_hoja(ws, "📜 HISTORIAL DE OPERACIONES (LOG)",
                    "Cada macro registra aquí fecha, usuario, acción y documento. No borre filas: es la trazabilidad del sistema.", len(cols))
    crear_tabla(ws, "tLog", FILA_T, 1, cols, rows, estilo="TableStyleLight1")
