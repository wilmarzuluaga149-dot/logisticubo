# -*- coding: utf-8 -*-
"""Verificación estática del VBA contra el libro: nombres, hojas, tablas y columnas."""
import re, sys
from openpyxl import load_workbook

def verificar(bas, xlsx):
    s = open(bas, encoding="utf-8").read()
    wb = load_workbook(xlsx)
    names = set(wb.defined_names.keys())
    tablas = {t.displayName: [c.name for c in t.tableColumns] for ws in wb.worksheets for t in ws.tables.values()}
    errores = []
    for n in sorted(set(re.findall(r'\b[RV]\("(\w+)"\)', s)) - names):
        errores.append(f"Nombre definido inexistente: {n}")
    for t in sorted(set(re.findall(r'T\("(\w+)"\)', s)) - set(tablas)):
        errores.append(f"Tabla inexistente: {t}")
    hp = re.search(r'HOJAS_PROTEGIDAS As String = "([^"]+)"', s).group(1).split(",")
    for h in set(re.findall(r'(?:Hoja|IrA|ExportarHojaPDF|Boton)\s*\(?"(\w+)"', s)) | set(hp):
        if h not in wb.sheetnames:
            errores.append(f"Hoja inexistente: {h}")
    for proc in re.split(r"\n(?=(?:Public |Private )?(?:Sub|Function) )", s):
        asign = [(m.start(), m.group(1), m.group(2)) for m in re.finditer(r'Set (\w+) = T\("(\w+)"\)', proc)]
        def tabla_de(var, pos):
            cand = [t for (p, v, t) in asign if v == var and p < pos]
            return cand[-1] if cand else None
        for m in re.finditer(r'(?:GetC|PutC|FilaDe)\(?\s*(T\("(\w+)"\)|\w+), (?:[^,"]+, )?"([^"]+)"', proc):
            t = m.group(2) or tabla_de(m.group(1), m.start())
            if t and m.group(3) not in tablas[t]:
                errores.append(f"Columna inexistente: {t}[{m.group(3)}]")
    for t, cols in [("tVentas", ["Factura", "Estado", "Observaciones"]), ("tCompras", ["Compra", "Estado recepción", "Observaciones"]),
                    ("tPagos", ["Recibo", "Estado", "Observaciones", "Documento"]), ("tGastos", ["Gasto", "Estado", "Descripción"]),
                    ("tMovCaja", ["Movimiento", "Estado", "Detalle"])]:
        errores += [f"Anular: falta {t}[{c}]" for c in cols if c not in tablas[t]]
    bloque = re.search(r'reglas = Array\((.+?)\)\n', s, re.S).group(1).replace("_\n", "")
    for regla in re.findall(r'"(t\w+):([^"]+)"', bloque):
        errores += [f"Regla de validación: falta {regla[0]}[{c}]" for c in regla[1].split(",") if c not in tablas[regla[0]]]
    return errores

if __name__ == "__main__":
    e = verificar(sys.argv[1], sys.argv[2])
    print("\n".join(e) if e else "Verificación VBA ↔ libro: sin diferencias (nombres, hojas, tablas y columnas).")
