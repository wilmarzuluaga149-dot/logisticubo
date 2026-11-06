# -*- coding: utf-8 -*-
"""Genera y verifica todos los entregables de NEGOCIO PRO 360 ENTERPRISE.

  python3 entregar.py            -> construcción completa con pruebas por etapas
  python3 entregar.py --rapido   -> reutiliza la evidencia de etapas previa

Salida en ../entregables/
"""
import datetime as dt
import json
import os
import shutil
import subprocess
import sys
import time

AQUI = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, AQUI)
import construir as K
import crear_xlsm as X
import verificar_vba as VV
from openpyxl import load_workbook

SAL = os.path.abspath(os.path.join(AQUI, "..", "entregables"))
TMP = os.path.join(AQUI, "_tmp")
BAS = os.path.join(AQUI, "vba", "Modulo_VBA.bas")


def uno_exportar_pdf(xlsx_recalculado, trabajos):
    """Exporta hojas a PDF con LibreOffice. trabajos: lista de (hoja, pdf).
    Para cada una: fija valores de la hoja, oculta las demás y exporta. Termina el proceso al final."""
    import signal
    import uno
    from com.sun.star.beans import PropertyValue
    port = 2096
    prof = os.path.join(TMP, "perfil_lo")
    p = subprocess.Popen(["soffice", "--headless", "--invisible", "--norestore", f"-env:UserInstallation=file://{prof}",
                          f"--accept=socket,host=localhost,port={port};urp;"], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL,
                         start_new_session=True)
    resultados = {}
    try:
        local = uno.getComponentContext()
        res = local.ServiceManager.createInstanceWithContext("com.sun.star.bridge.UnoUrlResolver", local)
        ctx = None
        for _ in range(80):
            try:
                ctx = res.resolve(f"uno:socket,host=localhost,port={port};urp;StarOffice.ComponentContext")
                break
            except Exception:
                time.sleep(0.5)
        desk = ctx.ServiceManager.createInstanceWithContext("com.sun.star.frame.Desktop", ctx)

        def pv(n, v):
            x = PropertyValue()
            x.Name, x.Value = n, v
            return x
        for hoja, pdf in trabajos:
            try:
                doc = desk.loadComponentFromURL(uno.systemPathToFileUrl(xlsx_recalculado), "_blank", 0, (pv("Hidden", True),))
                doc.calculateAll()
                for n in doc.Sheets.getElementNames():
                    try:
                        doc.Sheets.getByName(n).unprotect(K.CLAVE)
                    except Exception:
                        pass
                sh = doc.Sheets.getByName(hoja)
                cur = sh.createCursor()
                cur.gotoEndOfUsedArea(False)
                rng = sh.getCellRangeByPosition(0, 0, cur.RangeAddress.EndColumn, cur.RangeAddress.EndRow)
                rng.setDataArray(rng.getDataArray())  # fórmulas -> valores
                if hoja == "DASHBOARD":  # incluir los gráficos (área de impresión A1:R86)
                    rng = sh.getCellRangeByPosition(0, 0, 17, 85)
                doc.getCurrentController().setActiveSheet(sh)
                fd = uno.Any("[]com.sun.star.beans.PropertyValue", (pv("Selection", rng),))
                doc.storeToURL(uno.systemPathToFileUrl(pdf), (pv("FilterName", "calc_pdf_Export"), pv("FilterData", fd)))
                doc.close(True)
                resultados[pdf] = "ok"
            except Exception as e:
                resultados[pdf] = f"ERROR {e}"
        try:
            desk.terminate()
        except Exception:
            pass
    finally:
        try:
            os.killpg(p.pid, signal.SIGKILL)
        except Exception:
            pass
    return resultados


def resumen_libro(ruta, keep_vba=False):
    wb = load_workbook(ruta, keep_vba=keep_vba)
    n_f = sum(1 for ws in wb.worksheets for row in ws.iter_rows() for c in row if isinstance(c.value, str) and c.value.startswith("="))
    n_t = sum(len(ws.tables) for ws in wb.worksheets)
    n_dv = sum(len(ws.data_validations.dataValidation) for ws in wb.worksheets)
    return {"hojas": len(wb.sheetnames), "tablas": n_t, "nombres": len(wb.defined_names), "formulas": n_f, "validaciones": n_dv,
            "graficos": sum(len(ws._charts) for ws in wb.worksheets)}


def main():
    os.makedirs(SAL, exist_ok=True)
    os.makedirs(TMP, exist_ok=True)
    informe = [f"INFORME DE PRUEBAS — NEGOCIO PRO 360 ENTERPRISE", f"Generado: {dt.datetime.now():%d/%m/%Y %H:%M}", ""]
    # 1) construcción (incluye pruebas por etapas E0..E6)
    sys.argv = [sys.argv[0], SAL] + [a for a in sys.argv[1:] if a.startswith("--")]
    K.main()
    xlsx = os.path.join(SAL, "NEGOCIO_PRO_360.xlsx")
    evid = json.load(open(os.path.join(TMP, "evidencia.json")))
    informe += ["1. PRUEBAS POR ETAPAS (motor de cálculo LibreOffice, libro completo recalculado en cada etapa)"]
    desc = {"E0": "Crear producto PT-001 y cliente CT-001", "E1": "Registrar compra OC-PRUEBA (pendiente)",
            "E2": "Recibir mercancía (estado Recibida)", "E3": "Registrar venta FV-PRUEBA a crédito",
            "E4": "Registrar abono RC-PRUEBA", "E5": "Registrar gasto GS-PRUEBA en efectivo", "E6": "Registrar y anular FV-PRUEBA-AN"}
    for k, v in evid.items():
        if k in desc:
            informe.append(f"   {k} {desc[k]}:\n      {v}")
    # 2) xlsm + bas
    xlsm = os.path.join(SAL, "NEGOCIO_PRO_360.xlsm")
    cn, pid, nbin = X.xlsx_a_xlsm(xlsx, xlsm, BAS)
    codigo = open(BAS, encoding="utf-8").read().replace("\r\n", "\n").replace("\n", "\r\n")
    with open(os.path.join(SAL, "Modulo_VBA.bas"), "wb") as fh:
        fh.write(codigo.encode("cp1252"))
    informe += ["", f"2. ARCHIVO CON MACROS: vbaProject.bin de {nbin} bytes, {len(cn) + 2} módulos (ThisWorkbook, {len(cn)} hojas, NP360)."]
    # 3) recálculo de verificación sobre copias
    informe += ["", "3. RECÁLCULO COMPLETO DE LOS ENTREGABLES (copias)"]
    for nombre in ("NEGOCIO_PRO_360.xlsx", "NEGOCIO_PRO_360.xlsm"):
        cp = os.path.join(TMP, "verif_" + nombre)
        shutil.copy(os.path.join(SAL, nombre), cp)
        r = K.recalc(cp)
        informe.append(f"   {nombre}: estado={r.get('status')} fórmulas={r.get('total_formulas')} errores={r.get('total_errors')}")
        if nombre.endswith(".xlsx"):
            recalc_xlsx = cp
    wbv = load_workbook(recalc_xlsx, data_only=True)
    pr = wbv["PRUEBAS"]
    informe += ["", "4. HOJA PRUEBAS (esperado vs. obtenido, tras recalcular)"]
    n_ok = 0
    for r in range(6, 40):
        if pr.cell(r, 1).value is None:
            break
        est = pr.cell(r, 6).value
        n_ok += 1 if str(est).startswith("✔") else 0
        informe.append(f"   {pr.cell(r, 1).value:>2}. {pr.cell(r, 2).value}: esperado={pr.cell(r, 4).value} obtenido={pr.cell(r, 5).value} → {est}")
    total_pr = r - 6
    informe.append(f"   RESULTADO: {n_ok} de {total_pr} OK")
    # 4) cerrar y reabrir
    a = resumen_libro(xlsx)
    b = resumen_libro(xlsm, keep_vba=True)
    informe += ["", "5. CERRAR Y VOLVER A ABRIR", f"   .xlsx reabierto: {a}", f"   .xlsm reabierto: {b}",
                f"   Estructura idéntica entre .xlsx y .xlsm: {a == b}"]
    # 5) VBA
    errores_vba = VV.verificar(BAS, xlsx)
    informe += ["", "6. VBA (verificación estática; la EJECUCIÓN requiere Excel para Windows)",
                f"   Nombres/tablas/columnas usados por las macros que no existen en el libro: {len(errores_vba)}"]
    informe += [f"      {e}" for e in errores_vba]
    # 6) PDF de ejemplo y capturas para el manual
    trabajos = [("INFORMES", os.path.join(SAL, "Informe_ejemplo.pdf")), ("DASHBOARD", os.path.join(SAL, "Dashboard_ejemplo.pdf")),
                ("INICIO", os.path.join(TMP, "cap_INICIO.pdf")), ("F_VENTA", os.path.join(TMP, "cap_F_VENTA.pdf"))]
    res = uno_exportar_pdf(recalc_xlsx, trabajos)
    for _, pdf in trabajos[:2]:
        estado = res.get(pdf, "sin resultado")
        informe.append(f"   PDF de ejemplo {os.path.basename(pdf)}: " + (f"{os.path.getsize(pdf):,} bytes" if estado == "ok" else estado))
    informe.insert(len(informe) - 2, "")
    informe.insert(len(informe) - 2, "7. EXPORTACIÓN PDF")
    open(os.path.join(SAL, "Informe_de_pruebas.txt"), "w", encoding="utf-8").write("\n".join(informe) + "\n")
    print("\n".join(informe))


if __name__ == "__main__":
    main()
