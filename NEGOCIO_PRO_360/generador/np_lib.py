# -*- coding: utf-8 -*-
"""Utilidades de construcción para NEGOCIO PRO 360 ENTERPRISE (openpyxl).

Convenciones:
  * Encabezado azul oscuro  = columna de ENTRADA (el usuario escribe).
  * Encabezado gris/verde   = columna CALCULADA (fórmula, no escribir).
  * En fórmulas de tabla se usa el atajo [@Columna] que se expande a
    Tabla[[#This Row],[Columna]] (formato de archivo de Excel).
"""
import re
from openpyxl.styles import Font, PatternFill, Alignment, Border, Side, Protection
from openpyxl.worksheet.table import Table, TableStyleInfo, TableFormula
from openpyxl.worksheet.datavalidation import DataValidation
from openpyxl.workbook.defined_name import DefinedName
from openpyxl.worksheet.hyperlink import Hyperlink
from openpyxl.utils import get_column_letter

# ---------------------------------------------------------------- paleta
AZUL = "0B2545"      # azul oscuro principal
AZUL2 = "13315C"     # azul encabezados
AZUL3 = "1F4E79"
CELESTE = "DCE6F2"
GRIS = "F2F4F7"
GRIS2 = "D0D5DD"
GRIS3 = "5B6B7F"
VERDE = "1E8449"
VERDE2 = "D5F5E3"
ROJO = "C0392B"
ROJO2 = "FADBD8"
AMBAR = "B9770E"
AMBAR2 = "FCF3CF"
BLANCO = "FFFFFF"
FUENTE = "Arial"

COP = '"$" #,##0;[Red]-"$" #,##0;"-"'
COP2 = '"$" #,##0.00;[Red]-"$" #,##0.00;"-"'
NUM = '#,##0;[Red]-#,##0;"-"'
NUM2 = '#,##0.00;[Red]-#,##0.00;"-"'
NUM3 = '#,##0.000;[Red]-#,##0.000;"-"'
PCT = '0.0%;[Red]-0.0%;"-"'
FECHA = 'dd/mm/yyyy'
FECHAHORA = 'dd/mm/yyyy hh:mm'
MES = 'mmm-yy'
TXT = '@'

thin = Side(style="thin", color=GRIS2)
BORDE = Border(left=thin, right=thin, top=thin, bottom=thin)
SIN_BLOQUEO = Protection(locked=False)

CLAVE = "NP360"  # clave de protección por defecto (configurable en CONFIG)


def F(size=10, bold=False, color="1A1A1A", italic=False, underline=None):
    return Font(name=FUENTE, size=size, bold=bold, color=color, italic=italic, underline=underline)


def fill(c):
    return PatternFill("solid", start_color=c, end_color=c)


# ---------------------------------------------------------------- nombres
def nombre(wb, name, ref):
    """Crea un nombre definido a nivel libro."""
    dn = DefinedName(name, attr_text=ref)
    wb.defined_names[name] = dn


def abs_ref(ws, cell):
    col = re.match(r"([A-Z]+)(\d+)", cell)
    return f"'{ws.title}'!${col.group(1)}${col.group(2)}"


def abs_rng(ws, rng):
    a, b = rng.split(":")
    ca = re.match(r"([A-Z]+)(\d+)", a)
    cb = re.match(r"([A-Z]+)(\d+)", b)
    return f"'{ws.title}'!${ca.group(1)}${ca.group(2)}:${cb.group(1)}${cb.group(2)}"


# ---------------------------------------------------------------- hojas
def encabezado_hoja(ws, titulo, subtitulo, ancho_cols=14, nav=True):
    """Banda de título corporativa en filas 1-3."""
    ws.sheet_view.showGridLines = False
    ws.sheet_view.zoomScale = 90
    ultima = get_column_letter(ancho_cols)
    for r in (1, 2):
        for c in range(1, ancho_cols + 1):
            ws.cell(r, c).fill = fill(AZUL)
    ws["A1"] = titulo
    ws["A1"].font = F(16, True, BLANCO)
    ws["A1"].alignment = Alignment(vertical="center", indent=1)
    ws["A2"] = subtitulo
    ws["A2"].font = F(9, False, "BFD7EA", italic=True)
    ws["A2"].alignment = Alignment(vertical="top", indent=1)
    ws.row_dimensions[1].height = 30
    ws.row_dimensions[2].height = 18
    if nav:
        enlace(ws, "A3", "⌂ INICIO", "INICIO")
        enlace(ws, "B3", "▣ DASHBOARD", "DASHBOARD")
        ws.row_dimensions[3].height = 18


def enlace(ws, cell, texto, hoja, destino="A1", estilo="nav"):
    ws[cell] = texto
    ws[cell].hyperlink = Hyperlink(ref=cell, location=f"'{hoja}'!{destino}", display=texto)
    if estilo == "nav":
        ws[cell].font = F(9, True, AZUL3, underline="single")
    ws[cell].alignment = Alignment(horizontal="left", vertical="center")


def boton_menu(ws, rng, texto, hoja, color=AZUL2, sub=""):
    """Botón de navegación hecho con celdas combinadas + hipervínculo (funciona sin macros)."""
    ws.merge_cells(rng)
    first = rng.split(":")[0]
    c = ws[first]
    c.value = texto if not sub else f"{texto}\n{sub}"
    c.hyperlink = Hyperlink(ref=first, location=f"'{hoja}'!A1", display=texto)
    c.font = F(11, True, BLANCO)
    c.alignment = Alignment(horizontal="center", vertical="center", wrap_text=True)
    a, b = rng.split(":")
    from openpyxl.utils.cell import range_boundaries
    c1, r1, c2, r2 = range_boundaries(rng)
    for r in range(r1, r2 + 1):
        for cc in range(c1, c2 + 1):
            ws.cell(r, cc).fill = fill(color)
            ws.cell(r, cc).border = Border(left=Side("thin", BLANCO), right=Side("thin", BLANCO),
                                           top=Side("thin", BLANCO), bottom=Side("thin", BLANCO))


def anchos(ws, widths):
    for i, w in enumerate(widths, start=1):
        ws.column_dimensions[get_column_letter(i)].width = w


def leyenda(ws, cell):
    ws[cell] = ("Leyenda:  encabezado AZUL = dato de entrada  ·  encabezado GRIS ƒ = columna calculada "
                "(no escribir)  ·  celdas amarillas = parámetros editables")
    ws[cell].font = F(8, False, GRIS3, italic=True)


def etiqueta(ws, cell, texto, bold=True, size=10, color="1A1A1A"):
    ws[cell] = texto
    ws[cell].font = F(size, bold, color)
    ws[cell].alignment = Alignment(vertical="center")


def entrada(ws, cell, valor=None, fmt=None, comentario=None):
    """Celda de entrada editable (amarilla, desbloqueada)."""
    c = ws[cell]
    if valor is not None:
        c.value = valor
    c.fill = fill("FFF8D6")
    c.border = BORDE
    c.protection = SIN_BLOQUEO
    c.font = F(10, False, "0000CC")
    if fmt:
        c.number_format = fmt
    if comentario:
        from openpyxl.comments import Comment
        c.comment = Comment(comentario, "NP360")
    return c


def calc(ws, cell, formula, fmt=None, bold=False, size=10, color="1A1A1A", fondo=GRIS, align=None):
    c = ws[cell]
    c.value = formula
    c.font = F(size, bold, color)
    if fondo:
        c.fill = fill(fondo)
    c.border = BORDE
    if fmt:
        c.number_format = fmt
    if align:
        c.alignment = Alignment(horizontal=align, vertical="center")
    return c


def seccion(ws, cell, texto, ancho=6, color=AZUL2):
    r = int(re.match(r"[A-Z]+(\d+)", cell).group(1))
    col0 = ws[cell].column
    for c in range(col0, col0 + ancho):
        ws.cell(r, c).fill = fill(color)
    ws[cell] = texto
    ws[cell].font = F(11, True, BLANCO)
    ws[cell].alignment = Alignment(vertical="center", indent=1)
    ws.row_dimensions[r].height = 20


def lista_dv(ws, rng, formula, mensaje=None, permitir_vacio=True, estricto=True):
    dv = DataValidation(type="list", formula1=formula, allow_blank=permitir_vacio)
    dv.error = "Seleccione un valor de la lista."
    dv.errorTitle = "Valor no válido"
    dv.showErrorMessage = estricto
    dv.errorStyle = "stop" if estricto else "warning"
    if mensaje:
        dv.prompt = mensaje
        dv.showInputMessage = True
    ws.add_data_validation(dv)
    dv.add(rng)
    return dv


def dv_numero(ws, rng, minimo=0, tipo="decimal", mensaje="Ingrese un número mayor o igual a 0"):
    dv = DataValidation(type=tipo, operator="greaterThanOrEqual", formula1=str(minimo), allow_blank=True)
    dv.error = mensaje
    dv.errorTitle = "Dato no válido"
    dv.showErrorMessage = True
    ws.add_data_validation(dv)
    dv.add(rng)
    return dv


def dv_fecha(ws, rng):
    dv = DataValidation(type="date", operator="between", formula1="36526", formula2="73051", allow_blank=True)
    dv.error = "Ingrese una fecha válida en formato DD/MM/AAAA"
    dv.errorTitle = "Fecha no válida"
    dv.showErrorMessage = True
    ws.add_data_validation(dv)
    dv.add(rng)
    return dv


# ---------------------------------------------------------------- tablas
class Col:
    """Definición de columna de tabla.
    kind: 'in' (entrada) | 'calc' (fórmula de columna)."""

    def __init__(self, header, kind="in", formula=None, width=12, fmt=None, dv=None, key=None):
        self.header = header
        self.kind = kind
        self.formula = formula
        self.width = width
        self.fmt = fmt
        self.dv = dv          # fórmula de lista o tupla ('num'|'date')
        self.key = key or header


def expandir(formula, tname):
    return re.sub(r"\[@([^\]]+)\]", lambda m: f"{tname}[[#This Row],[{m.group(1)}]]", formula)


def crear_tabla(ws, tname, fila, col_ini, cols, filas_datos, estilo="TableStyleMedium2", min_filas=1):
    """Crea una tabla estructurada.
    filas_datos: lista de dict {header: valor} con valores de columnas de entrada."""
    n = max(len(filas_datos), min_filas)
    for j, c in enumerate(cols):
        cc = col_ini + j
        h = ws.cell(fila, cc, c.header)
        h.font = F(9, True, BLANCO)
        h.alignment = Alignment(horizontal="center", vertical="center", wrap_text=True)
        h.fill = fill(AZUL2 if c.kind == "in" else GRIS3)
        if c.kind == "calc":
            h.value = c.header  # el nombre debe ser exacto (sin símbolos añadidos)
        ws.column_dimensions[get_column_letter(cc)].width = c.width
    ws.row_dimensions[fila].height = 32
    for i in range(n):
        datos = filas_datos[i] if i < len(filas_datos) else {}
        r = fila + 1 + i
        for j, c in enumerate(cols):
            cell = ws.cell(r, col_ini + j)
            if c.kind == "calc":
                cell.value = "=" + expandir(c.formula, tname)
                cell.fill = fill(GRIS)
                cell.font = F(9, False, "333333")
            else:
                v = datos.get(c.key, datos.get(c.header))
                cell.value = v
                cell.font = F(9, False, "000000")
            if c.fmt:
                cell.number_format = c.fmt
    ref = f"{get_column_letter(col_ini)}{fila}:{get_column_letter(col_ini + len(cols) - 1)}{fila + n}"
    t = Table(displayName=tname, ref=ref)
    t.tableStyleInfo = TableStyleInfo(name=estilo, showRowStripes=True, showColumnStripes=False)
    t._initialise_columns()
    for j, c in enumerate(cols):
        t.tableColumns[j].name = c.header
        if c.kind == "calc":
            t.tableColumns[j].calculatedColumnFormula = TableFormula(attr_text=expandir(c.formula, tname))
    ws.add_table(t)
    # validaciones de datos sobre la columna (hasta 2000 filas para permitir crecimiento)
    for j, c in enumerate(cols):
        if not c.dv:
            continue
        L = get_column_letter(col_ini + j)
        rng = f"{L}{fila + 1}:{L}{fila + 2000}"
        if c.dv == "num":
            dv_numero(ws, rng)
        elif c.dv == "int":
            dv_numero(ws, rng, 0, "whole", "Ingrese un número entero mayor o igual a 0")
        elif c.dv == "date":
            dv_fecha(ws, rng)
        else:
            lista_dv(ws, rng, c.dv)
    ws.freeze_panes = ws.cell(fila + 1, col_ini)
    return t, fila + n
