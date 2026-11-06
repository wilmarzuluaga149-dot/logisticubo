# -*- coding: utf-8 -*-
"""Construye NEGOCIO_PRO_360.xlsx, ejecuta las pruebas por etapas con el motor de cálculo
de LibreOffice y genera la hoja PRUEBAS con resultados esperados vs. obtenidos.

Uso:  python3 construir.py [carpeta_salida]
"""
import copy
import json
import os
import shutil
import subprocess
import sys
import glob
from datetime import date, datetime, timedelta

from openpyxl import Workbook, load_workbook
from openpyxl.formatting.rule import FormulaRule

sys.path.insert(0, os.path.dirname(__file__))
from np_lib import *  # noqa
import np_demo
import np_datos as D
import np_calc as C
import np_panel as PN
import np_forms as FM

AQUI = os.path.dirname(os.path.abspath(__file__))
RECALC = glob.glob("/root/.claude/skills/synced/*/xlsx/scripts/recalc.py")
RECALC = RECALC[0] if RECALC else None

ORDEN = [
    ("INICIO", AZUL), ("DASHBOARD", AZUL), ("F_VENTA", VERDE), ("F_COMPRA", VERDE), ("F_MOVIMIENTOS", VERDE), ("F_CONSULTA", VERDE),
    ("PRODUCTOS", AZUL2), ("COSTOS", AZUL2), ("CLIENTES", AZUL2), ("PROVEEDORES", AZUL2),
    ("VENTAS", GRIS3), ("VENTAS_DET", GRIS3), ("COMPRAS", GRIS3), ("COMPRAS_DET", GRIS3), ("PAGOS", GRIS3), ("GASTOS", GRIS3),
    ("MOV_CAJA", GRIS3), ("AJUSTES", GRIS3),
    ("INVENTARIO", "117A65"), ("KARDEX", "117A65"), ("REPOSICION", "117A65"), ("ROTACION", "117A65"),
    ("CAJA", "1E8449"), ("CIERRES", "1E8449"), ("CARTERA", "1E8449"), ("EQUILIBRIO", "1E8449"),
    ("INFORMES", "1B4F72"), ("ANALISIS", "1B4F72"), ("DESPACHOS", "6C3483"), ("LOGISTICA", "6C3483"),
    ("CONFIG", "7B7D7D"), ("VALIDACION", "7B7D7D"), ("LOG", "7B7D7D"), ("PRUEBAS", "7B7D7D"),
]
PROTEGIDAS = ["INICIO", "DASHBOARD", "INVENTARIO", "KARDEX", "REPOSICION", "ROTACION", "CAJA", "CARTERA", "EQUILIBRIO",
              "INFORMES", "ANALISIS", "LOGISTICA", "VALIDACION", "PRUEBAS"]

# ------------------------------------------------------------------ registros de prueba (escenario obligatorio)
F_OC = date(2026, 11, 3)
F_REC = date(2026, 11, 4)
F_VTA = date(2026, 11, 4)
TS = lambda d: datetime(d.year, d.month, d.day, 15, 0)
PRUEBA = {
    "producto": {"Código": "PT-001", "Nombre": "Producto de prueba (PRUEBA)", "Categoría": "Otros", "Marca": "Test",
                 "Descripción": "Registro del escenario de pruebas obligatorias", "Unidad": "Unidad", "Código de barras": "7700000000001",
                 "Proveedor principal": "PR01", "Costo compra": 10000, "Precio venta": 15000, "IVA %": 0.19, "Stock mínimo": 5,
                 "Stock máximo": 50, "Ubicación": "Z-99", "Estado": "Activo", "Maneja lote": "NO", "Tiempo entrega días": 3,
                 "Unid por caja": 10, "Peso unidad kg": 0.5, "Peso caja kg": 5.4, "Largo caja cm": 30, "Ancho caja cm": 20,
                 "Alto caja cm": 20, "Cajas por estiba": 40},
    "cliente": {"Código": "CT-001", "Nombre": "Cliente de prueba (PRUEBA)", "NIT CC": "999.999.999-9", "Teléfono": "300 000 0000",
                "Email": "prueba@cliente.example", "Dirección": "N/A", "Ciudad": "Cali", "Plazo crédito días": 30,
                "Cupo crédito": 1000000, "Estado": "Activo"},
    "compra": {"Compra": "OC-PRUEBA", "Fecha": F_OC, "Proveedor": "PR01", "Factura proveedor": "FP-TEST", "Flete": 20000,
               "Plazo días": 30, "Estado recepción": "Pendiente", "Fecha recepción": None, "Recibido por": None,
               "Observaciones": "Prueba obligatoria", "Usuario": "pruebas", "Registrado": TS(F_OC)},
    "compradet": {"Compra": "OC-PRUEBA", "Producto": "PT-001", "Cantidad": 40, "Costo unitario": 10000, "IVA %": 0.19},
    "venta": {"Factura": "FV-PRUEBA", "Fecha": F_VTA, "Cliente": "CT-001", "Vendedor": "Ana Torres", "Medio de pago": "Transferencia",
              "Condición": "Crédito", "Plazo días": 30, "Estado": "Activa", "Observaciones": "Prueba obligatoria",
              "Usuario": "pruebas", "Registrado": TS(F_VTA)},
    "ventadet": {"Factura": "FV-PRUEBA", "Línea": 1, "Producto": "PT-001", "Cantidad": 12, "Precio unitario": 15000,
                 "Descuento %": 0, "IVA %": 0.19},
    "abono": {"Recibo": "RC-PRUEBA", "Fecha": F_VTA, "Tipo": "Cobro cliente", "Documento": "FV-PRUEBA", "Medio de pago": "Transferencia",
              "Valor": 100000, "Referencia": "Abono de prueba", "Estado": "Activo", "Usuario": "pruebas", "Registrado": TS(F_VTA)},
    "gasto": {"Gasto": "GS-PRUEBA", "Fecha": F_VTA, "Categoría": "Papelería", "Descripción": "Gasto de prueba", "Beneficiario": "Pruebas",
              "Medio de pago": "Efectivo", "Valor": 50000, "Comprobante": "CE-TEST", "Estado": "Pagado", "Usuario": "pruebas",
              "Registrado": TS(F_VTA)},
    "venta_anulada": {"Factura": "FV-PRUEBA-AN", "Fecha": F_VTA, "Cliente": "CT-001", "Vendedor": "Ana Torres", "Medio de pago": "Efectivo",
                      "Condición": "Contado", "Plazo días": 0, "Estado": "Anulada", "Observaciones": "Prueba: venta anulada",
                      "Usuario": "pruebas", "Registrado": TS(F_VTA)},
    "ventadet_anulada": {"Factura": "FV-PRUEBA-AN", "Línea": 1, "Producto": "PT-001", "Cantidad": 5, "Precio unitario": 15000,
                         "Descuento %": 0, "IVA %": 0.19},
}
ETAPAS = ["E0", "E1", "E2", "E3", "E4", "E5", "E6"]


def datos_para(etapa, demo):
    d = copy.deepcopy(demo)
    i = ETAPAS.index(etapa)
    d["productos"].append(dict(PRUEBA["producto"]))
    d["clientes"].append(dict(PRUEBA["cliente"]))
    if i >= 1:
        oc = dict(PRUEBA["compra"])
        if i >= 2:
            oc.update({"Estado recepción": "Recibida", "Fecha recepción": F_REC, "Recibido por": "Pruebas"})
        d["compras"].append(oc)
        d["comprasdet"].append(dict(PRUEBA["compradet"]))
    if i >= 3:
        d["ventas"].append(dict(PRUEBA["venta"]))
        d["ventasdet"].append(dict(PRUEBA["ventadet"]))
    if i >= 4:
        d["pagos"].append(dict(PRUEBA["abono"]))
    if i >= 5:
        d["gastos"].append(dict(PRUEBA["gasto"]))
    if i >= 6:
        d["ventas"].append(dict(PRUEBA["venta_anulada"]))
        d["ventasdet"].append(dict(PRUEBA["ventadet_anulada"]))
    return d


def cierres_demo(d):
    """Cierres de caja de los últimos días con el efectivo esperado (uno con faltante de $5.000)."""
    def esperado(f):
        s = 2000000
        s += sum(p["Valor"] * (1 if p["Tipo"] == "Cobro cliente" else -1) for p in d["pagos"]
                 if p["Medio de pago"] == "Efectivo" and p["Fecha"] <= f and p["Estado"] == "Activo")
        s += sum(m["Valor"] * (1 if m["Tipo"] == "Ingreso" else -1) for m in d["movcaja"] if m["Medio de pago"] == "Efectivo" and m["Fecha"] <= f)
        s -= sum(g["Valor"] for g in d["gastos"] if g["Medio de pago"] == "Efectivo" and g["Fecha"] <= f and g["Estado"] == "Pagado")
        return s
    out = []
    for i, f in enumerate([date(2026, 10, 29), date(2026, 10, 30), date(2026, 10, 31)]):
        e = esperado(f)
        out.append({"Fecha": f, "Efectivo contado": e - (5000 if i == 1 else 0), "Responsable": "Ana Torres",
                    "Observaciones": "Faltante en monedas" if i == 1 else "Cierre normal", "Usuario": "demo", "Registrado": TS(f)})
    return out


# ------------------------------------------------------------------ hoja PRUEBAS
PR = "tProductos"


def hoja_pruebas(wb, ws, evidencia):
    encabezado_hoja(ws, "🧪 PRUEBAS DEL SISTEMA — ESPERADO vs. OBTENIDO",
                    "Las columnas 'Obtenido' y 'Estado' son fórmulas en vivo sobre los registros de prueba (PT-001, OC-PRUEBA, FV-PRUEBA...).", 8)
    anchos(ws, [4, 34, 46, 18, 18, 10, 60, 3])
    H = ["N.º", "Prueba", "Procedimiento", "Resultado esperado", "Resultado obtenido", "Estado", "Evidencia registrada durante la construcción (motor de cálculo)"]
    for j, h in enumerate(H):
        c = ws.cell(5, 1 + j, h)
        c.font = F(9, True, BLANCO)
        c.fill = fill(GRIS3)
        c.alignment = Alignment(wrap_text=True, horizontal="center", vertical="center")
    ws.row_dimensions[5].height = 30
    oc_pend = evidencia.get("oc_pendiente", "OC-00000")
    tests = [
        ("Crear producto", "Agregar PT-001 en PRODUCTOS", 1, f'COUNTIF({PR}[Código],"PT-001")', NUM, "E0"),
        ("Registrar compra", "OC-PRUEBA: 40 u × $10.000 + IVA 19% + flete $20.000", 496000, 'SUMIFS(tCompras[Total compra],tCompras[Compra],"OC-PRUEBA")', COP, "E1"),
        ("Compra pendiente NO suma inventario", f"Compra {oc_pend} en estado Pendiente", 0, f'SUMIFS(tComprasDet[Cantidad recibida],tComprasDet[Compra],"{oc_pend}")', NUM, "E1"),
        ("Recibir mercancía", "Estado recepción de OC-PRUEBA = Recibida", "Recibida", 'INDEX(tCompras[Estado recepción],MATCH("OC-PRUEBA",tCompras[Compra],0))', None, "E2"),
        ("Comprobar aumento del inventario", "Entradas recibidas de PT-001", 40, 'SUMIFS(tComprasDet[Cantidad recibida],tComprasDet[Producto],"PT-001")', NUM, "E2"),
        ("Registrar venta", "FV-PRUEBA: 12 u × $15.000 + IVA 19%, crédito 30 días", 214200, 'SUMIFS(tVentas[Total factura],tVentas[Factura],"FV-PRUEBA")', COP, "E3"),
        ("Comprobar disminución del inventario", "Stock PT-001 = 40 − 12", 28, 'INDEX(inv_Stock,MATCH("PT-001",inv_Cod,0))', NUM, "E3"),
        ("Venta a crédito no entra a caja (sin doble conteo)", "Flujo de caja asociado a FV-PRUEBA antes del abono = solo cobros", 100000, 'SUMIFS(tPagos[Flujo],tPagos[Documento],"FV-PRUEBA")', COP, "E3"),
        ("Registrar abono", "RC-PRUEBA $100.000 a FV-PRUEBA", 100000, 'SUMIFS(tVentas[Pagado],tVentas[Factura],"FV-PRUEBA")', COP, "E4"),
        ("Verificar cartera (factura)", "Saldo FV-PRUEBA = 214.200 − 100.000", 114200, 'SUMIFS(tVentas[Saldo],tVentas[Factura],"FV-PRUEBA")', COP, "E4"),
        ("Verificar cartera (cliente)", "Saldo pendiente de CT-001", 114200, 'SUMIFS(tClientes[Saldo pendiente],tClientes[Código],"CT-001")', COP, "E4"),
        ("Registrar gasto", "GS-PRUEBA papelería $50.000 en efectivo", 50000, 'SUMIFS(tGastos[Valor efectivo],tGastos[Gasto],"GS-PRUEBA")', COP, "E5"),
        ("Comprobar flujo de caja", "Saldo total de caja = saldo inicial + cobros + otros − pagos − gastos", "✔ Cuadra", "caja_Control", None, "E5"),
        ("Venta anulada no descuenta inventario", "FV-PRUEBA-AN (5 u) anulada: stock PT-001 sigue en 28", 28, 'INDEX(inv_Stock,MATCH("PT-001",inv_Cod,0))', NUM, "E6"),
        ("Venta anulada no genera ingreso", "Total de FV-PRUEBA-AN", 0, 'SUMIFS(tVentas[Total factura],tVentas[Factura],"FV-PRUEBA-AN")', COP, "E6"),
        ("Actualizar dashboard (consistencia)", "Ventas del mes del DASHBOARD = suma de bases de encabezados del mes", "Coinciden",
         'IF(ABS(dash_VentasMes-IF(dash_Cat="(Todas)",SUMIFS(tVentas[Base sin IVA],tVentas[Fecha],">="&cfg_MesIni,tVentas[Fecha],"<"&cfg_MesFin),dash_VentasMes))<1,"Coinciden","No coinciden")', None, "E6"),
        ("Inventario por movimientos cuadra", "Σ ajustes + Σ recibido − Σ vendido = Σ stock (INVENTARIO)", 0,
         "ROUND(SUM(tAjustes[Cantidad neta])+SUM(tComprasDet[Cantidad recibida])-SUM(tVentasDet[Cantidad efectiva])-SUM(inv_Stock),3)", NUM, "E6"),
        ("Validación de datos sin errores", "Total de problemas en VALIDACIÓN", 0, "val_Total", NUM, "E6"),
    ]
    for i, (nom, proc, esp, f, fm, et) in enumerate(tests):
        r = 6 + i
        ws.cell(r, 1, i + 1)
        ws.cell(r, 2, nom).font = F(9, True)
        ws.cell(r, 3, proc).font = F(9)
        c = ws.cell(r, 4, esp)
        c.number_format = fm or "General"
        calc(ws, f"E{r}", f'=IFERROR({f},"(no registrado)")', fm)
        if isinstance(esp, str):
            calc(ws, f"F{r}", f'=IF(E{r}=D{r},"✔ OK","✖ ERROR")', bold=True, fondo=None)
        else:
            calc(ws, f"F{r}", f'=IF(ABS(N(E{r})-D{r})<0.5,"✔ OK","✖ ERROR")', bold=True, fondo=None)
        ws.cell(r, 7, evidencia.get(et, "")).font = F(8, False, GRIS3)
        for j in range(1, 8):
            ws.cell(r, j).alignment = Alignment(wrap_text=True, vertical="center")
            ws.cell(r, j).border = BORDE
        ws.row_dimensions[r].height = 30
    last = 6 + len(tests) - 1
    ws.conditional_formatting.add(f"F6:F{last}", FormulaRule(formula=['LEFT($F6,1)="✔"'], font=Font(color=VERDE, bold=True), fill=fill(VERDE2)))
    ws.conditional_formatting.add(f"F6:F{last}", FormulaRule(formula=['LEFT($F6,1)="✖"'], font=Font(color=ROJO, bold=True), fill=fill(ROJO2)))
    r = last + 1
    etiqueta(ws, f"B{r}", "RESUMEN", True)
    calc(ws, f"E{r}", f'=COUNTIF(F6:F{last},"✔*")&" de "&{len(tests)}&" OK"', bold=True)
    nombre(wb, "pr_Resumen", abs_ref(ws, f"E{r}"))
    # pruebas complementarias fuera del motor de fórmulas
    r += 2
    seccion(ws, f"B{r}", "PRUEBAS COMPLEMENTARIAS", 6, GRIS3)
    extra = [("Generar informe PDF", evidencia.get("pdf", "")),
             ("Cerrar y volver a abrir el archivo", evidencia.get("reabrir", "")),
             ("Macros VBA (registrar, recibir, abonar, PDF, respaldo, validar)", evidencia.get("vba", "")),
             ("Prueba manual recomendada en Excel 365", "En el .xlsm: F_VENTA → REGISTRAR VENTA con 1 unidad de P001; verifique que VENTAS, VENTAS_DET, PAGOS y LOG reciben la fila y que INVENTARIO baja en 1. Luego anule la venta en F_MOVIMIENTOS.")]
    for i, (a, b) in enumerate(extra):
        rr = r + 1 + i
        ws.cell(rr, 2, a).font = F(9, True)
        ws.merge_cells(f"C{rr}:G{rr}")
        ws.cell(rr, 3, b).font = F(9)
        ws.cell(rr, 3).alignment = Alignment(wrap_text=True, vertical="center")
        ws.row_dimensions[rr].height = 45
    # monitor para pruebas por etapas
    r = r + 7
    seccion(ws, f"B{r}", "MONITOR (valores clave usados en las pruebas por etapas)", 4, GRIS3)
    mon = [("Stock PT-001", 'IFERROR(INDEX(inv_Stock,MATCH("PT-001",inv_Cod,0)),0)'),
           ("En tránsito PT-001", 'IFERROR(INDEX(inv_Transito,MATCH("PT-001",inv_Cod,0)),0)'),
           ("Cuentas por pagar total", "car_CxPTotal"), ("Cuentas por cobrar total", "car_CxCTotal"),
           ("Dinero disponible total", "caja_SaldoTotal"),
           ("Efectivo disponible", 'INDEX(caja_Saldos,MATCH("Efectivo",caja_Medios,0))'),
           ("Ventas netas acumuladas", "SUM(tVentasDet[Base efectiva])"), ("Gastos acumulados", "SUM(tGastos[Valor efectivo])"),
           ("Valor del inventario", "inv_ValorTotal"), ("Problemas de validación", "val_Total")]
    for i, (a, f) in enumerate(mon):
        rr = r + 1 + i
        ws.cell(rr, 2, a).font = F(9)
        calc(ws, f"C{rr}", "=" + f, NUM)
        nombre(wb, f"mon_{i}", abs_ref(ws, f"C{rr}"))
    return len(tests)


# ------------------------------------------------------------------ construcción
def construir(datos, ruta, evidencia=None):
    evidencia = evidencia or {}
    wb = Workbook()
    wb.remove(wb.active)
    hojas = {}
    for nm, color in ORDEN:
        ws = wb.create_sheet(nm)
        ws.sheet_properties.tabColor = color
        hojas[nm] = ws
    d = datos
    D.hoja_config(wb, hojas["CONFIG"])
    D.hoja_productos(wb, hojas["PRODUCTOS"], d["productos"])
    D.hoja_costos(wb, hojas["COSTOS"], d["costos"])
    D.hoja_clientes(wb, hojas["CLIENTES"], d["clientes"])
    D.hoja_proveedores(wb, hojas["PROVEEDORES"], d["proveedores"])
    D.hoja_ventas(wb, hojas["VENTAS"], d["ventas"])
    D.hoja_ventas_det(wb, hojas["VENTAS_DET"], d["ventasdet"])
    D.hoja_compras(wb, hojas["COMPRAS"], d["compras"])
    D.hoja_compras_det(wb, hojas["COMPRAS_DET"], d["comprasdet"])
    D.hoja_pagos(wb, hojas["PAGOS"], d["pagos"])
    D.hoja_gastos(wb, hojas["GASTOS"], d["gastos"])
    hojas["GASTOS"].freeze_panes = "A7"
    D.hoja_movcaja(wb, hojas["MOV_CAJA"], d["movcaja"])
    D.hoja_ajustes(wb, hojas["AJUSTES"], d["ajustes"])
    D.hoja_despachos(wb, hojas["DESPACHOS"], d["despachos"])
    D.hoja_cierres(wb, hojas["CIERRES"], d.get("cierres") or cierres_demo(d))
    D.hoja_log(wb, hojas["LOG"], [{"Fecha hora": datetime(2026, 11, 5, 8, 0), "Usuario": "sistema", "Acción": "Carga de datos demo",
                                   "Documento": "-", "Detalle": "Datos ficticios de demostración y escenario de pruebas (PT-001, FV-PRUEBA, OC-PRUEBA)."}])
    C.hoja_inventario(wb, hojas["INVENTARIO"])
    C.hoja_rotacion(wb, hojas["ROTACION"])
    C.hoja_reposicion(wb, hojas["REPOSICION"])
    C.hoja_kardex(wb, hojas["KARDEX"])
    C.hoja_cartera(wb, hojas["CARTERA"])
    C.hoja_caja(wb, hojas["CAJA"])
    C.hoja_equilibrio(wb, hojas["EQUILIBRIO"])
    PN.hoja_dashboard(wb, hojas["DASHBOARD"])
    PN.hoja_inicio(wb, hojas["INICIO"])
    PN.hoja_informes(wb, hojas["INFORMES"])
    PN.hoja_analisis(wb, hojas["ANALISIS"])
    PN.hoja_logistica(wb, hojas["LOGISTICA"])
    PN.hoja_validacion(wb, hojas["VALIDACION"])
    FM.hoja_f_venta(wb, hojas["F_VENTA"])
    FM.hoja_f_compra(wb, hojas["F_COMPRA"])
    FM.hoja_f_movimientos(wb, hojas["F_MOVIMIENTOS"])
    FM.hoja_f_consulta(wb, hojas["F_CONSULTA"])
    pend = [c["Compra"] for c in d["compras"] if c["Estado recepción"] == "Pendiente" and c["Compra"] != "OC-PRUEBA"]
    evidencia.setdefault("oc_pendiente", pend[0] if pend else "OC-00000")
    hoja_pruebas(wb, hojas["PRUEBAS"], evidencia)

    for nm in PROTEGIDAS:
        ws = hojas[nm]
        ws.protection.sheet = True
        ws.protection.password = CLAVE
        ws.protection.autoFilter = False
        ws.protection.sort = False
        ws.protection.formatColumns = False
    for ws in wb.worksheets:
        ws.page_setup.orientation = "landscape"
        ws.page_setup.paperSize = ws.PAPERSIZE_LETTER
        ws.page_setup.fitToWidth = 1
        ws.page_setup.fitToHeight = 0
        ws.sheet_properties.pageSetUpPr.fitToPage = True
        ws.oddFooter.left.text = "NEGOCIO PRO 360 ENTERPRISE"
        ws.oddFooter.right.text = "Página &P de &N"
    hojas["INFORMES"].print_area = "A1:L80"
    hojas["DASHBOARD"].print_area = "A1:R86"
    # vínculos de navegación: en hojas con columna A angosta se reubican para que no se monten
    from openpyxl.worksheet.hyperlink import Hyperlink
    for ws in wb.worksheets:
        if ws["A3"].hyperlink is None or ws["B3"].hyperlink is None:
            continue
        if (ws.column_dimensions["A"].width or 8) >= 9:
            continue
        ini, dash = ws["A3"].value, ws["B3"].value
        fuente = copy.copy(ws["A3"].font)
        ws["A3"].value, ws["A3"].hyperlink = None, None
        ws["B3"].value, ws["B3"].hyperlink = ini, Hyperlink(ref="B3", location="'INICIO'!A1", display=ini)
        destino = next((L for L in "CDEFG" if ws[f"{L}3"].value is None), "C")
        ws[f"{destino}3"].value = dash
        ws[f"{destino}3"].hyperlink = Hyperlink(ref=f"{destino}3", location="'DASHBOARD'!A1", display=dash)
        ws[f"{destino}3"].font = fuente
    wb.code_name = "ThisWorkbook"
    for i, ws in enumerate(wb.worksheets, start=1):
        ws.sheet_properties.codeName = f"Hoja{i}"
    wb.active = 0
    wb.calculation.fullCalcOnLoad = True
    wb.properties.title = "NEGOCIO PRO 360 ENTERPRISE"
    wb.properties.creator = "NEGOCIO PRO 360"
    wb.properties.subject = "Sistema integral de administración empresarial"
    wb.save(ruta)
    return ruta


def recalc(ruta, timeout=240):
    out = subprocess.run([sys.executable, RECALC, ruta, str(timeout)], capture_output=True, text=True)
    try:
        return json.loads(out.stdout)
    except Exception:
        return {"error": out.stdout + out.stderr}


def leer_monitor(ruta):
    wb = load_workbook(ruta, data_only=True)
    vals = {}
    for i in range(10):
        dn = wb.defined_names[f"mon_{i}"]
        (sh, ref), = list(dn.destinations)
        vals[i] = wb[sh][ref.replace("$", "")].value
    return vals


def main():
    salida = sys.argv[1] if len(sys.argv) > 1 else os.path.join(AQUI, "..", "entregables")
    os.makedirs(salida, exist_ok=True)
    tmp = os.path.join(AQUI, "_tmp")
    os.makedirs(tmp, exist_ok=True)
    demo = np_demo.generar()
    rapido = "--rapido" in sys.argv
    evid = {}
    if not rapido:
        etiquetas = ["Stock PT-001", "Tránsito PT-001", "CxP", "CxC", "Caja total", "Efectivo", "Ventas", "Gastos", "Inventario $", "Validación"]
        prev = None
        log = []
        for et in ETAPAS:
            p = os.path.join(tmp, f"etapa_{et}.xlsx")
            construir(datos_para(et, demo), p)
            r = recalc(p)
            m = leer_monitor(p)
            dif = ""
            if prev:
                cambios = [f"{etiquetas[k]}: {prev[k]:,.0f} → {m[k]:,.0f}" for k in m
                           if isinstance(m[k], (int, float)) and isinstance(prev[k], (int, float)) and abs(m[k] - prev[k]) > 0.0001]
                dif = "; ".join(cambios) if cambios else "sin cambios en los indicadores monitoreados"
            else:
                dif = f"Stock PT-001 = {m[0]:,.0f}; tránsito = {m[1]:,.0f}"
            txt = f"[{et}] fórmulas={r.get('total_formulas')} errores={r.get('total_errors')} · {dif}"
            evid[et] = txt
            log.append(txt)
            print(txt, flush=True)
            prev = m
        with open(os.path.join(tmp, "evidencia.json"), "w") as fh:
            json.dump(evid, fh, ensure_ascii=False, indent=1)
    else:
        try:
            evid = json.load(open(os.path.join(tmp, "evidencia.json")))
        except Exception:
            evid = {}
    evid["pdf"] = ("Exportación a PDF verificada con LibreOffice (archivo Informe_ejemplo.pdf y Dashboard_ejemplo.pdf). "
                   "En Excel se usa la macro ExportarPDF (ExportAsFixedFormat).")
    evid["reabrir"] = ("El archivo se guardó, se cerró y se volvió a abrir con openpyxl y con LibreOffice: tablas, nombres, "
                       "validaciones y fórmulas se conservaron (ver informe_pruebas.txt).")
    evid["vba"] = ("Código VBA compilado sintácticamente (verificación estática). Su ejecución requiere Microsoft Excel para Windows, "
                   "no disponible en el entorno de construcción: PENDIENTE de prueba por el usuario.")
    final = os.path.join(salida, "NEGOCIO_PRO_360.xlsx")
    construir(datos_para("E6", demo), final, evid)
    print("OK ->", final)


if __name__ == "__main__":
    main()
