# -*- coding: utf-8 -*-
"""Genera Manual_de_Usuario.pdf (reportlab) con capturas del libro recalculado."""
import os
import subprocess
import sys
from reportlab.lib import colors
from reportlab.lib.enums import TA_CENTER
from reportlab.lib.pagesizes import letter
from reportlab.lib.styles import ParagraphStyle, getSampleStyleSheet
from reportlab.lib.units import cm
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.platypus import (Image, KeepTogether, PageBreak, Paragraph, SimpleDocTemplate, Spacer, Table, TableStyle)

AQUI = os.path.dirname(os.path.abspath(__file__))
SAL = os.path.abspath(os.path.join(AQUI, "..", "entregables"))
TMP = os.path.join(AQUI, "_tmp")

pdfmetrics.registerFont(TTFont("DV", "/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf"))
pdfmetrics.registerFont(TTFont("DVB", "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf"))
_obl = "/usr/share/fonts/truetype/dejavu/DejaVuSans-Oblique.ttf"
pdfmetrics.registerFont(TTFont("DVI", _obl if os.path.exists(_obl) else "/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf"))
from reportlab.pdfbase.pdfmetrics import registerFontFamily
registerFontFamily("DV", normal="DV", bold="DVB", italic="DVI", boldItalic="DVB")

AZUL = colors.HexColor("#0B2545")
AZUL2 = colors.HexColor("#13315C")
VERDE = colors.HexColor("#1E8449")
GRIS = colors.HexColor("#F2F4F7")
GRIS3 = colors.HexColor("#5B6B7F")

ss = getSampleStyleSheet()
H1 = ParagraphStyle("H1", parent=ss["Heading1"], fontName="DVB", fontSize=17, textColor=AZUL, spaceBefore=6, spaceAfter=8, keepWithNext=1)
H2 = ParagraphStyle("H2", parent=ss["Heading2"], fontName="DVB", fontSize=12.5, textColor=AZUL2, spaceBefore=10, spaceAfter=5, keepWithNext=1)
P = ParagraphStyle("P", parent=ss["BodyText"], fontName="DV", fontSize=9.6, leading=13.4, spaceAfter=5)
PB = ParagraphStyle("PB", parent=P, fontName="DVB")
NOTA = ParagraphStyle("NOTA", parent=P, fontName="DVI", fontSize=8.6, textColor=GRIS3)
CEL = ParagraphStyle("CEL", parent=P, fontSize=8.3, leading=10.6, spaceAfter=0)
CELB = ParagraphStyle("CELB", parent=CEL, fontName="DVB", textColor=colors.white)
LI = ParagraphStyle("LI", parent=P, leftIndent=14, bulletIndent=4)


def p(t, st=P):
    return Paragraph(t, st)


def lista(items, numerada=False):
    out = []
    for i, t in enumerate(items, start=1):
        out.append(Paragraph(t, LI, bulletText=(f"{i}." if numerada else "•")))
    return out


def tabla(filas, anchos, cab=True):
    data = [[Paragraph(str(c), CELB if (cab and i == 0) else CEL) for c in f] for i, f in enumerate(filas)]
    t = Table(data, colWidths=anchos, repeatRows=1 if cab else 0)
    est = [("GRID", (0, 0), (-1, -1), 0.4, colors.HexColor("#D0D5DD")), ("VALIGN", (0, 0), (-1, -1), "TOP"),
           ("ROWBACKGROUNDS", (0, 1), (-1, -1), [colors.white, GRIS]), ("LEFTPADDING", (0, 0), (-1, -1), 4),
           ("RIGHTPADDING", (0, 0), (-1, -1), 4)]
    if cab:
        est.append(("BACKGROUND", (0, 0), (-1, 0), AZUL2))
    t.setStyle(TableStyle(est))
    return t


def caja(texto, color=VERDE):
    t = Table([[Paragraph(texto, P)]], colWidths=[17 * cm])
    t.setStyle(TableStyle([("BOX", (0, 0), (-1, -1), 1, color), ("BACKGROUND", (0, 0), (-1, -1), colors.HexColor("#F4FBF6")),
                           ("LEFTPADDING", (0, 0), (-1, -1), 8), ("TOPPADDING", (0, 0), (-1, -1), 6), ("BOTTOMPADDING", (0, 0), (-1, -1), 6)]))
    return t


def imagen_de_pdf(pdf, png_base, ancho_cm=17, pagina=1, recorte=None):
    if not os.path.exists(pdf):
        return None
    subprocess.run(["pdftoppm", "-png", "-r", "110", "-f", str(pagina), "-l", str(pagina), pdf, png_base], check=True)
    cand = [f for f in os.listdir(os.path.dirname(png_base)) if f.startswith(os.path.basename(png_base)) and f.endswith(".png")]
    if not cand:
        return None
    ruta = os.path.join(os.path.dirname(png_base), sorted(cand)[0])
    # recorta el margen blanco y el pie de página de la exportación
    subprocess.run(["convert", ruta, "-gravity", "South", "-chop", "0x60", "-trim", "+repage", "-bordercolor", "white",
                    "-border", "6", ruta], check=True)
    if recorte:
        subprocess.run(["convert", ruta, "-crop", recorte, "+repage", ruta], check=True)
    from PIL import Image as PI
    w, h = PI.open(ruta).size
    img = Image(ruta, width=ancho_cm * cm, height=ancho_cm * cm * h / w)
    img.hAlign = "CENTER"
    return img


def pie(c, d):
    c.saveState()
    c.setFont("DV", 7.5)
    c.setFillColor(GRIS3)
    c.drawString(2 * cm, 1.2 * cm, "NEGOCIO PRO 360 ENTERPRISE · Manual de usuario")
    c.drawRightString(19.6 * cm, 1.2 * cm, f"Página {d.page}")
    c.setStrokeColor(AZUL)
    c.setLineWidth(2)
    c.line(2 * cm, 27 * cm, 19.6 * cm, 27 * cm)
    c.restoreState()


def portada(c, d):
    c.saveState()
    c.setFillColor(AZUL)
    c.rect(0, 15 * cm, 21.6 * cm, 12.94 * cm, fill=1, stroke=0)
    c.setFillColor(colors.white)
    c.setFont("DVB", 30)
    c.drawString(2 * cm, 22.5 * cm, "NEGOCIO PRO 360")
    c.drawString(2 * cm, 21.1 * cm, "ENTERPRISE")
    c.setFont("DV", 13)
    c.drawString(2 * cm, 19.4 * cm, "Sistema integral de administración, control financiero,")
    c.drawString(2 * cm, 18.7 * cm, "inventarios y gestión empresarial en Microsoft Excel 365")
    c.setFillColor(colors.HexColor("#1E8449"))
    c.rect(2 * cm, 17.4 * cm, 4 * cm, 0.18 * cm, fill=1, stroke=0)
    c.setFillColor(colors.HexColor("#BFD7EA"))
    c.setFont("DV", 11)
    c.drawString(2 * cm, 16.4 * cm, "MANUAL DE USUARIO · Versión 1.0.0")
    c.restoreState()


def construir():
    doc = SimpleDocTemplate(os.path.join(SAL, "Manual_de_Usuario.pdf"), pagesize=letter, leftMargin=2 * cm, rightMargin=2 * cm,
                            topMargin=2.2 * cm, bottomMargin=2 * cm, title="NEGOCIO PRO 360 ENTERPRISE - Manual de usuario",
                            author="NEGOCIO PRO 360")
    s = []
    s += [Spacer(1, 13.5 * cm)]
    s += [p("<b>Contenido de la entrega</b>", H2)]
    s += [tabla([["Archivo", "Para qué sirve"],
                 ["NEGOCIO_PRO_360.xlsm", "Sistema completo con macros: formularios con botones, PDF, respaldos, kardex, pedidos, validación. <b>Archivo recomendado.</b>"],
                 ["NEGOCIO_PRO_360.xlsx", "Versión base sin macros. Todas las fórmulas, tablas, dashboard e informes funcionan escribiendo directamente en las tablas."],
                 ["Modulo_VBA.bas", "Código fuente de las macros (para revisarlo o importarlo en la versión .xlsx)."],
                 ["Manual_de_Usuario.pdf", "Este documento."],
                 ["Informe_de_pruebas.txt", "Resultados de las pruebas realizadas durante la construcción."],
                 ["Informe_ejemplo.pdf · Dashboard_ejemplo.pdf", "Ejemplos de informes exportados a PDF con los datos de demostración."]],
                [5.2 * cm, 11.8 * cm])]
    s += [PageBreak()]

    # 1 ---------------------------------------------------------------
    s += [p("1. Instalación", H1)]
    s += [p("<b>Requisitos:</b> Microsoft Excel 365 (o Excel 2019/2021) para Windows. El archivo .xlsx también abre en Excel para Mac y en Excel web, "
            "pero las macros solo funcionan en Excel de escritorio para Windows (algunas también en Mac).")]
    s += [p("1.1 Abrir el archivo con macros (.xlsm) — recomendado", H2)]
    s += lista(["Copie <b>NEGOCIO_PRO_360.xlsm</b> en una carpeta de su equipo (por ejemplo <i>Documentos\\NegocioPro360</i>). "
                "Las subcarpetas <i>Informes</i> y <i>Respaldos</i> se crean solas junto al archivo.",
                "Si lo descargó de internet o lo recibió por correo, Windows lo marca como bloqueado: clic derecho sobre el archivo → "
                "<b>Propiedades</b> → marque <b>Desbloquear</b> → Aceptar. Sin este paso Excel muestra “Microsoft ha bloqueado la ejecución de macros”.",
                "Abra el archivo y pulse <b>Habilitar contenido</b> en la barra amarilla.",
                "En la primera apertura Excel compila las macros y la macro <i>Auto_Open</i> crea los botones de acción en los formularios. "
                "Guarde el archivo (Ctrl+G) para conservarlos.",
                "Opcional: agregue la carpeta como <b>ubicación de confianza</b> (Archivo → Opciones → Centro de confianza → Configuración → "
                "Ubicaciones de confianza) para no tener que habilitar macros cada vez."], True)
    s += [caja("<b>Si los botones no aparecen:</b> pulse Alt+F8, elija <b>CrearBotones</b> y pulse Ejecutar. "
               "Los menús de navegación de INICIO son hipervínculos y funcionan incluso sin macros.")]
    s += [p("1.2 Alternativa: integrar el módulo .bas en la versión .xlsx", H2)]
    s += [p("Use este método si su organización bloquea archivos .xlsm recibidos, o si prefiere revisar el código antes de usarlo:")]
    s += lista(["Abra <b>NEGOCIO_PRO_360.xlsx</b> y elija Archivo → Guardar como → tipo <b>Libro de Excel habilitado para macros (*.xlsm)</b>.",
                "Pulse <b>Alt+F11</b> para abrir el editor de Visual Basic.",
                "Menú <b>Archivo → Importar archivo…</b> y seleccione <b>Modulo_VBA.bas</b>. Aparecerá el módulo <i>NP360</i>.",
                "Menú <b>Depuración → Compilar VBAProject</b> (debe terminar sin mensajes). Cierre el editor.",
                "Pulse Alt+F8, ejecute <b>CrearBotones</b> y luego <b>ProtegerHojas</b>. Guarde. Desde ahora, al abrir el libro se ejecuta <i>Auto_Open</i>."], True)
    s += [p("1.3 Configuración regional", H2)]
    s += [p("El sistema usa formato de moneda COP (<b>$ 1.234.567</b>) y fechas <b>DD/MM/AAAA</b>. Los separadores de miles y decimales los toma "
            "Excel de la configuración regional de Windows (Español - Colombia recomendado). Las fórmulas están escritas para funcionar en "
            "cualquier idioma de Excel: Excel las traduce automáticamente (SUMIFS se muestra como SUMAR.SI.CONJUNTO, etc.).")]

    # 2 ---------------------------------------------------------------
    s += [PageBreak(), p("2. Arquitectura del sistema", H1)]
    s += [p("El sistema separa <b>datos</b> (tablas que usted llena) de <b>cálculos</b> (hojas protegidas con fórmulas). "
            "Nada se escribe dos veces: el inventario, la cartera, la caja y los indicadores se calculan a partir de los registros.")]
    flujo = Table([[Paragraph("<b>MAESTROS</b><br/>PRODUCTOS · COSTOS<br/>CLIENTES · PROVEEDORES<br/>CONFIG (listas, IVA, parámetros)", CEL),
                    Paragraph("→", PB),
                    Paragraph("<b>TRANSACCIONES</b><br/>VENTAS + VENTAS_DET<br/>COMPRAS + COMPRAS_DET<br/>PAGOS · GASTOS · MOV_CAJA<br/>AJUSTES · DESPACHOS · CIERRES", CEL),
                    Paragraph("→", PB),
                    Paragraph("<b>CÁLCULO</b><br/>INVENTARIO · KARDEX<br/>CAJA · CARTERA<br/>ROTACIÓN · REPOSICIÓN<br/>EQUILIBRIO", CEL),
                    Paragraph("→", PB),
                    Paragraph("<b>ANÁLISIS</b><br/>DASHBOARD<br/>INFORMES (PDF/Excel)<br/>ANÁLISIS (BI)<br/>VALIDACIÓN · PRUEBAS", CEL)]],
                  colWidths=[3.8 * cm, 0.6 * cm, 4.1 * cm, 0.6 * cm, 3.6 * cm, 0.6 * cm, 3.7 * cm])
    flujo.setStyle(TableStyle([("BOX", (0, 0), (0, 0), 1, AZUL2), ("BOX", (2, 0), (2, 0), 1, AZUL2), ("BOX", (4, 0), (4, 0), 1, VERDE),
                               ("BOX", (6, 0), (6, 0), 1, VERDE), ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
                               ("BACKGROUND", (0, 0), (0, 0), GRIS), ("BACKGROUND", (2, 0), (2, 0), GRIS)]))
    s += [flujo, Spacer(1, 8)]
    s += [p("Los formularios (F_VENTA, F_COMPRA, F_MOVIMIENTOS, F_CONSULTA) son la forma cómoda de escribir en las tablas: las macros validan "
            "los datos y agregan las filas. Sin macros, puede escribir directamente en las tablas: las columnas con encabezado <b>gris</b> se "
            "calculan solas al agregar una fila.")]
    s += [p("2.1 Hojas del libro", H2)]
    s += [tabla([["Módulo", "Hojas", "Contenido"],
                 ["A. Inicio", "INICIO", "Menú principal con botones de navegación, datos del negocio, estado del sistema e instrucciones."],
                 ["B. Dashboard", "DASHBOARD", "12 indicadores, alertas, top 5 de productos, evolución de 12 meses y 4 gráficos. Filtros: fecha de análisis y categoría."],
                 ["C. Productos", "PRODUCTOS", "Código, nombre, categoría, marca, descripción, unidad, código de barras, costos, precio, IVA, mínimos/máximos, ubicación, estado, lote, medidas logísticas."],
                 ["D. Costos y precios", "COSTOS", "Transporte, empaque, mano de obra, otros; costo real, precio sugerido y mínimo, utilidad, margen sobre venta vs. recargo sobre costo."],
                 ["E. Ventas", "VENTAS, VENTAS_DET, F_VENTA", "Factura (encabezado) y líneas por producto. Estado de pago calculado desde PAGOS."],
                 ["F. Compras", "COMPRAS, COMPRAS_DET, F_COMPRA", "Orden de compra, recepción, flete prorrateado, lote y vencimiento."],
                 ["G. Inventarios", "INVENTARIO, KARDEX, AJUSTES", "Stock por movimientos, valor, estado, tránsito, vencimientos; kardex cronológico."],
                 ["H. Caja y finanzas", "CAJA, CIERRES, MOV_CAJA, PAGOS", "Saldos por medio de pago, movimiento diario, flujo mensual, cierre y conciliación."],
                 ["I. Gastos", "GASTOS", "Gastos por categoría (fijo/variable), resumen del día, mes y año."],
                 ["J. Clientes y cartera", "CLIENTES, CARTERA", "Total vendido, abonos, saldo, vencido, días de mora, alertas; edades de cartera."],
                 ["K. Proveedores", "PROVEEDORES", "Datos, productos suministrados, compras, saldos, vencimientos, evaluación."],
                 ["L. Pedidos", "REPOSICION", "Productos por reponer, cantidad sugerida, proveedor, urgencia; genera órdenes."],
                 ["M. Rotación", "ROTACION", "Alta/media/baja/sin movimiento, días de inventario, clase ABC, capital inmovilizado."],
                 ["N. Pérdidas", "AJUSTES", "Dañados, vencidos, faltantes, devoluciones, errores; motivo, responsable, valor."],
                 ["O. Punto de equilibrio", "EQUILIBRIO", "Costos fijos/variables, margen de contribución, ventas y unidades mínimas, escenarios."],
                 ["P. Informes", "INFORMES", "Por día, semana, mes, año, producto, categoría, cliente, proveedor, vendedor; exporta a PDF y Excel."],
                 ["Q. Logística", "LOGISTICA, DESPACHOS", "Cubicaje, peso, volumen, cajas, estibas, ocupación del vehículo, costo logístico por unidad."],
                 ["R. Configuración", "CONFIG", "Negocio, NIT, IVA, prefijos, parámetros, listas desplegables, carpetas de respaldo e informes."],
                 ["Inteligencia de negocios", "ANALISIS", "Responde las preguntas clave, estado de resultados y situación financiera estimados."],
                 ["Control", "VALIDACION, LOG, PRUEBAS", "Controles de integridad, historial de operaciones y pruebas esperado vs. obtenido."]],
                [3.3 * cm, 4.2 * cm, 9.5 * cm])]

    # 3 ---------------------------------------------------------------
    s += [PageBreak(), p("3. Primeros pasos", H1)]
    s += [p("El archivo trae <b>datos ficticios de demostración</b> (una distribuidora, junio a noviembre de 2026) para que vea el sistema funcionando. "
            "Cuando quiera empezar con sus datos reales:")]
    s += lista(["Haga una copia de seguridad (botón COPIA DE SEGURIDAD en INICIO).",
                "Ejecute la macro <b>BorrarDatosDemo</b> (Alt+F8). Pide confirmación escribiendo BORRAR, crea un respaldo y deja todas las tablas "
                "vacías conservando fórmulas, configuración y listas. <i>Sin macros:</i> borre las filas de las tablas dejando al menos una fila (vacíe "
                "solo las columnas azules).",
                "En <b>CONFIG</b> escriba nombre, NIT, dirección, IVA general, prefijos de documentos, la clave de autorización y los <b>saldos iniciales</b> "
                "de cada medio de pago (tabla tMedios). Revise las listas: categorías, unidades, vendedores, vehículos, tipos de gasto.",
                "Registre sus <b>proveedores</b>, <b>clientes</b> y <b>productos</b> (código único, costo de compra, precio de venta, IVA del producto, "
                "stock mínimo y máximo). En <b>COSTOS</b> agregue los costos adicionales por unidad de cada producto.",
                "Cargue las existencias actuales en <b>AJUSTES</b> con el tipo <b>Inventario inicial</b> (o con F_MOVIMIENTOS → Ajuste).",
                "Revise <b>VALIDACION</b>: el total de problemas debe ser 0."], True)
    s += [caja("<b>Regla de oro:</b> nunca escriba el stock a mano. Si el conteo físico no coincide, registre un ajuste (Sobrante, Faltante, "
               "Error de inventario +/−) con su motivo y responsable. Así queda trazabilidad y el kardex cuadra.")]
    img = imagen_de_pdf(os.path.join(TMP, "cap_INICIO.pdf"), os.path.join(TMP, "img_inicio"), 14)
    if img:
        s += [Spacer(1, 6), KeepTogether([p("Pantalla INICIO (menú principal):", PB), img])]

    # 4 ---------------------------------------------------------------
    s += [PageBreak(), p("4. Operación diaria", H1)]
    s += [p("4.1 Registrar una venta (F_VENTA)", H2)]
    s += lista(["Elija cliente, vendedor, medio de pago y condición (Contado o Crédito). El número de factura y la fecha son automáticos si los deja vacíos.",
                "Escriba las líneas: código del producto y cantidad. El precio y el IVA se toman del producto (puede escribir otro precio o un descuento %).",
                "La columna <b>Validación</b> muestra ✔ OK, ⚠ Stock insuficiente o ✖ errores. El pie indica si el formulario está listo.",
                "Pulse <b>REGISTRAR VENTA</b>. La macro valida todo, escribe el encabezado en VENTAS y las líneas en VENTAS_DET; si es de contado "
                "(o si indica un valor pagado hoy) crea el cobro en PAGOS. El inventario baja y la cartera se actualiza automáticamente.",
                "El formulario se limpia solo. Limpiar nunca borra registros históricos."], True)
    s += [p("<b>Ventas sin existencias:</b> se bloquean, salvo que en CONFIG se permita vender sin stock, o que se marque “Autorizar venta sin stock = SI” "
            "con la clave de autorización (la observación de la factura lo registra).")]
    img = imagen_de_pdf(os.path.join(TMP, "cap_F_VENTA.pdf"), os.path.join(TMP, "img_fventa"), 16.5)
    if img:
        s += [KeepTogether([p("Formulario F_VENTA:", PB), img])]
    s += [p("4.2 Compras y recepción de mercancía (F_COMPRA)", H2)]
    s += lista(["Registre la orden: proveedor, flete, líneas con cantidad, costo (vacío = costo actual), IVA, lote y vencimiento.",
                "La compra queda <b>Pendiente</b>: aparece como “en tránsito” y <b>no</b> aumenta el inventario.",
                "Cuando llegue la mercancía, escriba el número en <b>CONFIRMAR RECEPCIÓN</b> y pulse el botón. Solo entonces sube el stock y nace la "
                "cuenta por pagar. Una compra recibida no puede recibirse otra vez.",
                "Si la mercancía llega con la factura, marque “Recibir de inmediato = SI”."], True)
    s += [p("4.3 Pagos, abonos, gastos, ajustes y caja (F_MOVIMIENTOS)", H2)]
    s += [tabla([["Sección", "Uso", "Efecto automático"],
                 ["1. Gasto", "Arriendo, servicios, nómina, transporte, publicidad, etc. Regístrelo cuando lo pague.", "Baja la caja del medio elegido y la utilidad."],
                 ["2. Pago / abono", "Cobro de una factura (FV-…) o pago de una compra (OC-…). No permite pagar más que el saldo.", "Actualiza cartera/CxP y caja."],
                 ["3. Ajuste", "Inventario inicial, dañado, vencido, faltante, sobrante, devoluciones, errores. Cantidad siempre positiva.", "Cambia el stock; si es pérdida, se valora y va a resultados."],
                 ["4. Otro movimiento", "Aportes, préstamos, retiros, traslados entre medios (p. ej. consignar efectivo).", "Solo caja."],
                 ["5. Cierre de caja", "Escriba el efectivo contado al final del día.", "CIERRES calcula el esperado y la diferencia."],
                 ["6. Anular", "Venta, compra, pago, gasto o movimiento. Pide motivo. No borra.", "Venta anulada devuelve el stock; ofrece anular sus cobros."]],
                [3 * cm, 8 * cm, 6 * cm])]
    s += [caja("<b>¿Por qué no se cuenta dos veces el dinero?</b> Una venta registra el <i>ingreso</i> (utilidad) pero el dinero solo entra a caja cuando "
               "existe un cobro en PAGOS. Una venta de contado crea un único cobro; una venta a crédito no crea ninguno hasta que el cliente abone. "
               "Lo mismo ocurre con las compras y los pagos a proveedores.")]

    # 5 ---------------------------------------------------------------
    s += [PageBreak(), p("5. Análisis e informes", H1)]
    s += [p("5.1 Dashboard ejecutivo", H2)]
    s += [p("Cambie la <b>Fecha de análisis</b> (por defecto, hoy) para ver cualquier día o mes, y la <b>Categoría</b> para filtrar ventas, utilidad bruta "
            "y top de productos. El botón ACTUALIZAR recalcula todo y anota la hora; EXPORTAR PDF guarda el tablero en la carpeta Informes.")]
    img = imagen_de_pdf(os.path.join(SAL, "Dashboard_ejemplo.pdf"), os.path.join(TMP, "img_dash"), 16)
    if img:
        s += [KeepTogether([p("Dashboard con los datos de demostración:", PB), img])]
    img2 = imagen_de_pdf(os.path.join(SAL, "Dashboard_ejemplo.pdf"), os.path.join(TMP, "img_dash2"), 16, pagina=2)
    if img2:
        s += [KeepTogether([p("Gráficos del dashboard:", PB), img2])]
    s += [p("5.2 Informes", H2)]
    s += lista(["Elija el período: Hoy, Esta semana, Este mes, Mes anterior, Este año o Personalizado (con Desde/Hasta).",
                "Filtre opcionalmente por producto, categoría, cliente, proveedor, vendedor o categoría de gasto (vacío = todos).",
                "El resumen (ventas, IVA, costo, utilidad, compras, gastos, pérdidas, cobros, pagos, utilidad operativa) y las tablas por categoría "
                "y vendedor se calculan al instante.",
                "Elija el <b>Tipo de informe detallado</b> (Ventas, Compras, Gastos, Inventario, Cartera, Rentabilidad por producto, Cobros y pagos, "
                "Pérdidas) y pulse <b>GENERAR INFORME</b>. Luego <b>EXPORTAR PDF</b> o <b>EXPORTAR EXCEL</b>."], True)
    s += [p("5.3 Inteligencia de negocios (ANALISIS)", H2)]
    s += [p("Responde con los datos registrados: qué productos dejan más utilidad, cuáles se venden menos, cuánto hay invertido en inventario, "
            "cuánto comprar, cuáles son los gastos más altos, cuánto vender para no perder, qué clientes están en mora, qué productos ocupan capital "
            "sin rotar, si los precios cubren costos y si subió el costo de compra. Incluye un estado de resultados y una situación financiera estimados.")]
    s += [p("5.4 Rotación, ABC, reposición y punto de equilibrio", H2)]
    s += [p("<b>ROTACION</b> clasifica cada producto según los días de inventario (parámetros en CONFIG) y la clase ABC por participación acumulada "
            "en ventas. <b>REPOSICION</b> lista los productos cuyo stock + tránsito está en o por debajo del mínimo y sugiere la cantidad "
            "(máx − disponible o demanda × (entrega + cobertura), redondeada a cajas). El botón GENERAR ÓRDENES crea una compra pendiente por "
            "proveedor. <b>EQUILIBRIO</b> calcula las ventas y unidades mínimas mensuales y tres escenarios editables.")]
    s += [p("5.5 Logística y cubicaje", H2)]
    s += [p("En LOGISTICA elija un producto (o escriba medidas), la cantidad y el vehículo: obtiene cajas, volumen m³, peso bruto/neto, estibas, "
            "ocupación por peso y volumen, viajes necesarios y costo logístico por unidad. En DESPACHOS registre cada despacho por producto; el "
            "resumen detecta sobrecarga del vehículo.")]

    # 6 ---------------------------------------------------------------
    s += [PageBreak(), p("6. Reglas financieras y tributarias", H1)]
    s += [tabla([["Concepto", "Cómo lo trata el sistema"],
                 ["Margen sobre venta", "(Precio − Costo) / Precio. Precio sugerido = Costo / (1 − margen objetivo)."],
                 ["Recargo sobre costo", "(Precio − Costo) / Costo. Un 30% de margen equivale a 42,9% de recargo. COSTOS muestra ambos."],
                 ["IVA", "Configurable por producto (0%, 5%, 19% o la tarifa que agregue a la lista). Se guarda en cada línea de venta y compra. "
                  "El IVA cobrado no es ingreso; el IVA de compras no es costo (se presenta como descontable)."],
                 ["Ingreso", "Ventas netas sin IVA de facturas activas."],
                 ["Costo", "Costo de ventas = unidades vendidas × costo unitario real (costo de compra + costos adicionales de COSTOS)."],
                 ["Gasto", "Gastos operacionales pagados + pérdidas de inventario valoradas."],
                 ["Activo / Pasivo", "Activo: caja, cartera, inventario, anticipos. Pasivo: cuentas por pagar e IVA neto estimado."],
                 ["Utilidad vs. flujo de caja", "La utilidad se reconoce al vender; la caja cambia al cobrar o pagar. Por eso pueden diferir."],
                 ["Valoración de inventario", "Costo unitario real registrado (costo estándar). INVENTARIO muestra el último costo de compra y alerta si "
                  "difiere en más de 2% para que lo actualice."]],
                [4 * cm, 13 * cm])]
    s += [Spacer(1, 6), caja("<b>Aviso:</b> las cifras son estimaciones administrativas basadas en los datos registrados. No constituyen estados "
                             "financieros certificados ni asesoría tributaria. Verifique tarifas de IVA, retenciones y obligaciones con su contador.", GRIS3)]

    # 7 ---------------------------------------------------------------
    s += [p("7. Seguridad, respaldo y control de calidad", H1)]
    s += lista(["<b>Protección:</b> las hojas de cálculo y los formularios están protegidos (clave por defecto <b>NP360</b>, cámbiela en CONFIG y pulse "
                "PROTEGER HOJAS). Las hojas de datos quedan editables para poder agregar filas a las tablas.",
                "<b>Campos obligatorios y listas:</b> validaciones de datos en tablas y formularios; las macros vuelven a validar antes de escribir.",
                "<b>Duplicados:</b> códigos de producto/cliente/proveedor y números de factura/compra duplicados se detectan (columna Control y VALIDACION) "
                "y las macros no los permiten.",
                "<b>Transacciones:</b> si una macro falla a mitad del registro, elimina las filas que alcanzó a escribir: los históricos no se dañan.",
                "<b>Historial:</b> cada macro escribe en LOG la fecha, hora, usuario, acción y documento; cada registro guarda usuario y fecha de registro.",
                "<b>Copias de seguridad:</b> botón COPIA DE SEGURIDAD (carpeta Respaldos, con fecha y hora en el nombre).",
                "<b>Validación:</b> VALIDACION muestra 22 controles automáticos; VALIDAR DATOS revisa campo por campo y detecta fórmulas sobrescritas; "
                "DETECTAR ERRORES busca #¡REF!, #¡VALOR!, #N/D en todo el libro."])

    # 8 ---------------------------------------------------------------
    s += [PageBreak(), p("8. Macros disponibles", H1)]
    macros = [["Macro", "Dónde", "Qué hace"],
              ["RegistrarVenta / LimpiarVenta", "F_VENTA", "Valida y registra factura, líneas y cobro inicial; limpia el formulario."],
              ["RegistrarCompra / LimpiarCompra", "F_COMPRA", "Registra la orden (pendiente o recibida)."],
              ["RecibirCompra", "F_COMPRA", "Confirma la recepción; impide recibir dos veces."],
              ["RegistrarGasto, RegistrarPago, RegistrarAjuste, RegistrarMovCaja, RegistrarCierre, AnularDocumento", "F_MOVIMIENTOS", "Registros de cada sección con validación."],
              ["ConsultarProducto / BuscarCliente", "F_CONSULTA", "Lista todas las coincidencias por código, barras/NIT o nombre."],
              ["GenerarKardex", "KARDEX", "Movimientos cronológicos con saldo; comprueba que cuadre con INVENTARIO."],
              ["GenerarPedidos", "REPOSICION", "Crea una orden de compra pendiente por proveedor."],
              ["ActualizarDashboard / ExportarDashboardPDF", "DASHBOARD", "Recalcula todo y anota la hora / exporta a PDF."],
              ["GenerarInforme / ExportarInformePDF / ExportarInformeExcel", "INFORMES", "Detalle según tipo y filtros; exportación."],
              ["CopiaSeguridad", "INICIO", "Copia con fecha y hora en la carpeta Respaldos."],
              ["ValidarDatos / DetectarErrores", "INICIO, VALIDACION", "Control de calidad de los datos y de las fórmulas."],
              ["ProtegerHojas / DesprotegerHojas", "INICIO", "Protección con la clave de CONFIG."],
              ["IrInicio, IrDashboard, IrVentas… / IrA", "Botones", "Navegación entre módulos."],
              ["CrearBotones", "Alt+F8", "Crea o recrea los botones de acción."],
              ["AmpliarFilasCalculo", "Alt+F8", "Amplía INVENTARIO y ROTACIÓN cuando hay más de 300 productos."],
              ["BorrarDatosDemo", "Alt+F8", "Deja el sistema vacío (con respaldo previo)."],
              ["AutoPruebaMacros", "PRUEBAS", "Ejecuta venta, anulación, compra, recepción, doble recepción y anulación con las macros reales y anota el resultado."],
              ["Auto_Open", "Automática", "Al abrir: protege hojas, crea botones si faltan y va a INICIO."]]
    s += [tabla(macros, [6.2 * cm, 3.3 * cm, 7.5 * cm])]

    # 9 ---------------------------------------------------------------
    s += [p("9. Pruebas realizadas", H1)]
    s += [p("Durante la construcción se ejecutó el escenario obligatorio con datos ficticios en un motor de cálculo (LibreOffice) recalculando el libro "
            "completo después de cada paso. La hoja <b>PRUEBAS</b> conserva las 18 pruebas con fórmulas en vivo (esperado vs. obtenido) y el "
            "detalle está en <i>Informe_de_pruebas.txt</i>.")]
    s += [tabla([["Paso", "Resultado obtenido"],
                 ["Crear producto PT-001", "Existe 1 vez; stock 0."],
                 ["Registrar compra OC-PRUEBA (pendiente)", "Tránsito 0 → 40; stock sigue en 0."],
                 ["Recibir mercancía", "Stock 0 → 40; cuentas por pagar +$ 496.000."],
                 ["Registrar venta FV-PRUEBA (crédito)", "Stock 40 → 28; cartera +$ 214.200; caja sin cambio."],
                 ["Registrar abono $ 100.000", "Cartera −$ 100.000; caja +$ 100.000; saldo factura $ 114.200."],
                 ["Registrar gasto $ 50.000 en efectivo", "Caja y efectivo −$ 50.000; gastos +$ 50.000."],
                 ["Venta anulada", "Stock y caja sin cambios; total de la factura 0."],
                 ["Dashboard, validación, inventario por movimientos", "Consistentes; 0 errores de datos; 0 errores de fórmula en 38.135 fórmulas."],
                 ["Exportar PDF · cerrar y reabrir", "PDF de ejemplo generados; estructura idéntica tras reabrir (.xlsx y .xlsm)."]],
                [6.5 * cm, 10.5 * cm])]
    s += [Spacer(1, 6), caja("<b>Pendiente de verificar por usted en Excel:</b> en el entorno de construcción no hay Microsoft Excel, por lo que las macros "
                             "se verificaron de forma estática (compilación sintáctica, nombres, tablas y columnas) pero <b>no se ejecutaron</b>. Al abrir "
                             "el .xlsm, vaya a PRUEBAS y pulse <b>EJECUTAR AUTOPRUEBA DE MACROS</b>: registra y anula documentos de prueba con las macros "
                             "reales y anota el resultado. Si algo falla, el mensaje indica el paso.", colors.HexColor("#B9770E"))]

    # 10 ---------------------------------------------------------------
    s += [PageBreak(), p("10. Solución de problemas", H1)]
    s += [tabla([["Situación", "Solución"],
                 ["“Microsoft ha bloqueado la ejecución de macros”", "Propiedades del archivo → Desbloquear (ver 1.1), o use una ubicación de confianza."],
                 ["No aparecen los botones", "Alt+F8 → CrearBotones. Verifique que las macros estén habilitadas."],
                 ["Excel dice que encontró contenido que no pudo leer al abrir el .xlsm", "Use el método 1.2: abra el .xlsx, guárdelo como .xlsm e importe Modulo_VBA.bas."],
                 ["Aparece #¿NOMBRE? en algunas celdas", "Está usando Excel 2016 o anterior (sin MAXIFS/MINIFS). Use Excel 365/2019/2021."],
                 ["Más de 300 productos", "VALIDACION lo avisa. Ejecute AmpliarFilasCalculo (Alt+F8)."],
                 ["Una columna gris dejó de calcular", "Se sobrescribió la fórmula: copie la celda de la fila de arriba. VALIDAR DATOS indica dónde."],
                 ["No puedo escribir en una hoja", "Es una hoja calculada protegida. Escriba en las tablas de datos o en los formularios. Para modificar el diseño use DESPROTEGER."],
                 ["Olvidé la clave de protección", "Está en CONFIG (Clave de protección de hojas)."],
                 ["Quiero otro IVA, categoría, medio de pago o vehículo", "Agréguelo al final de la tabla correspondiente en CONFIG: queda disponible en las listas."],
                 ["El dashboard no muestra hoy", "La fecha de análisis tiene un valor fijo. Escriba =HOY() en la celda (DASHBOARD!D5)."]],
                [6 * cm, 11 * cm])]
    s += [p("11. Ampliar el sistema", H1)]
    s += [p("Todas las tablas son tablas estructuradas de Excel: agregue filas al final y las fórmulas, validaciones y formatos se extienden solos. "
            "Las listas desplegables leen las tablas de CONFIG y de los maestros. Para nuevos indicadores use referencias estructuradas "
            "(p. ej. =SUMAR.SI.CONJUNTO(tVentasDet[Base efectiva];tVentasDet[Categoría];\"Bebidas\")). El código fuente de las macros está documentado "
            "en español y el generador del libro (carpeta <i>generador</i> del repositorio) permite reconstruirlo.")]
    doc.build(s, onFirstPage=portada, onLaterPages=pie)


if __name__ == "__main__":
    construir()
    print("Manual generado")
