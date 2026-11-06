# -*- coding: utf-8 -*-
"""Datos ficticios de demostración para NEGOCIO PRO 360 ENTERPRISE.

Simula una distribuidora de junio a noviembre de 2026 manteniendo coherencia:
el stock nunca queda negativo, las ventas de contado tienen su cobro, las de
crédito tienen abonos parciales/totales o quedan vencidas, etc.
Todos los nombres, NIT y cifras son ficticios.
"""
import random
import math
from datetime import date, timedelta, datetime

random.seed(360)
HOY = date(2026, 11, 5)
INICIO = date(2026, 6, 1)
USUARIO = "demo"

PROVEEDORES = [
    dict(Código="PR01", **{"Razón social": "Alimentos del Valle S.A.S.", "NIT": "900.111.222-3", "Contacto": "Marta Gil",
         "Teléfono": "602 555 0101", "Email": "ventas@alimvalle.example", "Dirección": "Cra 5 # 10-20",
         "Ciudad": "Cali", "Plazo pago días": 30, "Tiempo entrega días": 3, "Calidad 1-5": 5,
         "Cumplimiento 1-5": 4, "Estado": "Activo"}),
    dict(Código="PR02", **{"Razón social": "Químicos Limpios Ltda.", "NIT": "900.333.444-5", "Contacto": "Jorge Ruiz",
         "Teléfono": "604 555 0202", "Email": "pedidos@qlimpios.example", "Dirección": "Cl 30 # 45-12",
         "Ciudad": "Medellín", "Plazo pago días": 45, "Tiempo entrega días": 5, "Calidad 1-5": 4,
         "Cumplimiento 1-5": 3, "Estado": "Activo"}),
    dict(Código="PR03", **{"Razón social": "Bebidas Andinas S.A.", "NIT": "860.555.666-7", "Contacto": "Lina Pardo",
         "Teléfono": "601 555 0303", "Email": "comercial@bandinas.example", "Dirección": "Av 68 # 20-50",
         "Ciudad": "Bogotá", "Plazo pago días": 30, "Tiempo entrega días": 2, "Calidad 1-5": 5,
         "Cumplimiento 1-5": 5, "Estado": "Activo"}),
    dict(Código="PR04", **{"Razón social": "Cuidado Total S.A.S.", "NIT": "901.777.888-9", "Contacto": "Andrés Mora",
         "Teléfono": "607 555 0404", "Email": "andres@ctotal.example", "Dirección": "Cl 9 # 3-15",
         "Ciudad": "Bucaramanga", "Plazo pago días": 30, "Tiempo entrega días": 4, "Calidad 1-5": 3,
         "Cumplimiento 1-5": 4, "Estado": "Activo"}),
    dict(Código="PR05", **{"Razón social": "Empaques y Cartones del Norte", "NIT": "901.999.000-1", "Contacto": "Paula Ríos",
         "Teléfono": "605 555 0505", "Email": "paula@ecnorte.example", "Dirección": "Zona Franca Bod 7",
         "Ciudad": "Barranquilla", "Plazo pago días": 15, "Tiempo entrega días": 7, "Calidad 1-5": 4,
         "Cumplimiento 1-5": 2, "Estado": "Activo"}),
]

# código, nombre, categoría, marca, unidad, costo, precio, iva, min, max, prov, ubic, lote, upc, peso_u, LxAxH, cajas/estiba, demanda_mes
PRODUCTOS = [
    ("P001", "Arroz blanco 1 kg", "Abarrotes", "Del Campo", "Unidad", 3200, 4300, 0.00, 150, 600, "PR01", "A-01", "NO", 25, 1.0, (50, 35, 20), 40, 380),
    ("P002", "Aceite de girasol 1 L", "Abarrotes", "Girasol Oro", "Unidad", 7800, 10200, 0.05, 80, 300, "PR01", "A-02", "NO", 12, 0.95, (32, 24, 28), 50, 160),
    ("P003", "Azúcar 1 kg", "Abarrotes", "Dulce Valle", "Unidad", 3500, 4600, 0.05, 120, 500, "PR01", "A-03", "NO", 25, 1.0, (50, 35, 18), 40, 300),
    ("P004", "Café molido 500 g", "Abarrotes", "Montaña", "Unidad", 12500, 17900, 0.05, 40, 160, "PR01", "A-04", "NO", 24, 0.5, (40, 30, 20), 60, 70),
    ("P005", "Detergente en polvo 1 kg", "Aseo hogar", "Brillo", "Unidad", 8200, 11900, 0.19, 60, 250, "PR02", "B-01", "NO", 18, 1.0, (45, 30, 30), 40, 120),
    ("P006", "Jabón lavaloza 500 g", "Aseo hogar", "Brillo", "Unidad", 3900, 5900, 0.19, 60, 240, "PR02", "B-02", "NO", 24, 0.5, (36, 26, 18), 60, 110),
    ("P007", "Limpiador multiusos 1 L", "Aseo hogar", "Fresh", "Unidad", 5200, 7900, 0.19, 40, 180, "PR02", "B-03", "NO", 12, 1.05, (30, 22, 28), 50, 60),
    ("P008", "Agua 600 ml paca x24", "Bebidas", "Andina", "Paca", 14000, 19900, 0.19, 30, 120, "PR03", "C-01", "SI", 1, 14.8, (40, 27, 22), 36, 45),
    ("P009", "Gaseosa 1,5 L", "Bebidas", "Andina", "Unidad", 3600, 5200, 0.19, 120, 480, "PR03", "C-02", "SI", 12, 1.6, (34, 26, 32), 40, 260),
    ("P010", "Jugo en caja 1 L", "Bebidas", "Frutal", "Unidad", 3100, 4700, 0.19, 60, 260, "PR03", "C-03", "SI", 12, 1.05, (30, 20, 25), 60, 90),
    ("P011", "Champú 400 ml", "Cuidado personal", "Sedal", "Unidad", 9800, 14900, 0.19, 30, 140, "PR04", "D-01", "NO", 24, 0.45, (36, 24, 22), 60, 40),
    ("P012", "Crema dental 100 ml", "Cuidado personal", "Sonrisa", "Unidad", 3700, 5600, 0.19, 60, 260, "PR04", "D-02", "NO", 48, 0.15, (30, 20, 18), 80, 95),
    ("P013", "Papel higiénico x12", "Aseo hogar", "Suave", "Paca", 15800, 21900, 0.19, 30, 120, "PR02", "B-04", "NO", 4, 1.4, (50, 40, 45), 20, 35),
    ("P014", "Caja de cartón 40x30x30", "Empaques", "ECN", "Unidad", 1900, 3200, 0.19, 100, 400, "PR05", "E-01", "NO", 25, 0.35, (60, 40, 15), 30, 0),
    ("P015", "Cinta de embalaje 48 mm", "Empaques", "ECN", "Rollo", 2900, 4500, 0.19, 40, 150, "PR05", "E-02", "NO", 36, 0.2, (30, 30, 20), 60, 0),
    ("P016", "Galletas surtidas 300 g", "Abarrotes", "Crocante", "Unidad", 4200, 6400, 0.19, 50, 220, "PR01", "A-05", "SI", 20, 0.32, (40, 30, 22), 50, 70),
]

CLIENTES = [
    ("C001", "Supermercado La Economía", "900.200.300-1", "Cali", 30, 15000000),
    ("C002", "Tienda Don Pepe", "16.789.123", "Cali", 0, 0),
    ("C003", "Minimercado El Ahorro", "901.300.400-2", "Palmira", 30, 8000000),
    ("C004", "Restaurante Sabor Casero", "901.400.500-3", "Cali", 15, 4000000),
    ("C005", "Hotel Plaza Real", "800.500.600-4", "Jamundí", 30, 10000000),
    ("C006", "Cafetería Universitaria", "901.600.700-5", "Cali", 15, 3000000),
    ("C007", "Droguería Salud Total", "900.700.800-6", "Yumbo", 30, 5000000),
    ("C008", "Cliente mostrador", "222222222222", "Cali", 0, 0),
]
ESC_STOCK = 3      # escala de stock mínimo/máximo
ESC_DEMANDA = 4    # escala de demanda mensual
VENDEDORES = ["Ana Torres", "Luis Gómez", "Carla Díaz"]
MEDIOS = ["Efectivo", "Transferencia", "Tarjeta débito", "Tarjeta crédito", "Nequi / Daviplata", "Otro"]


def xr(x):
    """Redondeo como ROUND() de Excel (mitad hacia arriba)."""
    return int(math.floor(x + 0.5))


def _ts(d):
    return datetime(d.year, d.month, d.day, 10, 0)


def generar():
    prov_by = {p["Código"]: p for p in PROVEEDORES}
    productos = []
    costos = []
    stock = {}
    for (cod, nom, cat, marca, und, costo, precio, iva, smin, smax, prov, ubic, lote, upc, peso, dims, cpe, dem) in PRODUCTOS:
        L, A, H = dims
        smin, smax = smin * ESC_STOCK, smax * ESC_STOCK
        productos.append({
            "Código": cod, "Nombre": nom, "Categoría": cat, "Marca": marca,
            "Descripción": f"{nom} marca {marca}", "Unidad": und,
            "Código de barras": f"7701234{int(cod[1:]):05d}", "Proveedor principal": prov,
            "Costo compra": costo, "Precio venta": precio, "IVA %": iva,
            "Stock mínimo": smin, "Stock máximo": smax, "Ubicación": ubic, "Estado": "Activo",
            "Maneja lote": lote, "Tiempo entrega días": prov_by[prov]["Tiempo entrega días"],
            "Unid por caja": upc, "Peso unidad kg": peso, "Peso caja kg": round(peso * upc + 0.4, 2),
            "Largo caja cm": L, "Ancho caja cm": A, "Alto caja cm": H, "Cajas por estiba": cpe,
        })
        costos.append({"Código": cod, "Transporte": round(costo * 0.03), "Empaque": 0 if cat != "Abarrotes" else 50,
                       "Mano de obra": 40, "Otros costos": 0, "Margen objetivo": 0.30})
        stock[cod] = 0

    clientes = []
    for i, (cod, nom, nit, ciudad, plazo, cupo) in enumerate(CLIENTES):
        clientes.append({"Código": cod, "Nombre": nom, "NIT CC": nit, "Teléfono": f"315 555 {1000 + i:04d}",
                         "Email": f"contacto{i + 1}@cliente.example", "Dirección": f"Calle {10 + i} # {i + 2}-{20 + i}",
                         "Ciudad": ciudad, "Plazo crédito días": plazo, "Cupo crédito": cupo, "Estado": "Activo"})

    ajustes, compras, comprasdet, ventas, ventasdet, pagos, gastos, movcaja, despachos, cierres = ([] for _ in range(10))
    prod = {p["Código"]: p for p in productos}
    n_aj = n_oc = n_fv = n_rc = n_gs = n_mc = 0

    def aj(fecha, cod, tipo, qty, motivo, resp="Bodega", lote=None, venc=None):
        nonlocal n_aj
        n_aj += 1
        ajustes.append({"Ajuste": f"AJ-{n_aj:05d}", "Fecha": fecha, "Producto": cod, "Tipo": tipo, "Cantidad": qty,
                        "Lote": lote, "Fecha vencimiento": venc, "Motivo": motivo, "Responsable": resp,
                        "Documento": None, "Usuario": USUARIO, "Registrado": _ts(fecha)})

    # inventario inicial
    for (cod, *_rest) in PRODUCTOS:
        p = prod[cod]
        q = int(p["Stock máximo"] * 0.7)
        lote = f"L{cod[1:]}-0526" if p["Maneja lote"] == "SI" else None
        venc = date(2027, 3, 31) if lote else None
        aj(INICIO, cod, "Inventario inicial", q, "Conteo físico de apertura", "Administrador", lote, venc)
        stock[cod] += q

    def compra(fecha, provc, lineas, recibir_dias=3, estado="Recibida", obs=None):
        nonlocal n_oc
        n_oc += 1
        num = f"OC-{n_oc:05d}"
        flete = 60000 + 10000 * len(lineas)
        frec = fecha + timedelta(days=recibir_dias) if estado == "Recibida" else None
        compras.append({"Compra": num, "Fecha": fecha, "Proveedor": provc, "Factura proveedor": f"FP-{random.randint(1000, 9999)}",
                        "Flete": flete, "Plazo días": prov_by[provc]["Plazo pago días"], "Estado recepción": estado,
                        "Fecha recepción": frec, "Recibido por": "Bodega" if frec else None, "Observaciones": obs,
                        "Usuario": USUARIO, "Registrado": _ts(fecha)})
        total = flete
        for cod, q in lineas:
            p = prod[cod]
            cu = p["Costo compra"]
            lote = f"L{cod[1:]}-{fecha.month:02d}26" if p["Maneja lote"] == "SI" else None
            venc = fecha + timedelta(days=150) if lote else None
            comprasdet.append({"Compra": num, "Producto": cod, "Cantidad": q, "Costo unitario": cu, "IVA %": p["IVA %"],
                               "Lote": lote, "Fecha vencimiento": venc})
            base = q * cu
            total += base + xr(base * p["IVA %"])
            if estado == "Recibida":
                stock[cod] += q
        return num, total, frec

    def pago(fecha, tipo, doc, medio, valor, ref=None):
        nonlocal n_rc
        n_rc += 1
        pagos.append({"Recibo": f"RC-{n_rc:05d}", "Fecha": fecha, "Tipo": tipo, "Documento": doc, "Medio de pago": medio,
                      "Valor": valor, "Referencia": ref, "Estado": "Activo", "Observaciones": None,
                      "Usuario": USUARIO, "Registrado": _ts(fecha)})

    pend_pagos_prov = []  # (fecha_pago, doc, valor)
    pend_cobros = []

    # gastos fijos y variables por mes
    def gasto(fecha, cat, desc, benef, medio, valor):
        nonlocal n_gs
        n_gs += 1
        gastos.append({"Gasto": f"GS-{n_gs:05d}", "Fecha": fecha, "Categoría": cat, "Descripción": desc,
                       "Beneficiario": benef, "Medio de pago": medio, "Valor": valor,
                       "Comprobante": f"CE-{n_gs:04d}", "Estado": "Pagado", "Usuario": USUARIO, "Registrado": _ts(fecha)})

    def movc(fecha, tipo, concepto, medio, valor, detalle):
        nonlocal n_mc
        n_mc += 1
        movcaja.append({"Movimiento": f"MC-{n_mc:05d}", "Fecha": fecha, "Tipo": tipo, "Concepto": concepto,
                        "Medio de pago": medio, "Valor": valor, "Detalle": detalle, "Estado": "Activo",
                        "Usuario": USUARIO, "Registrado": _ts(fecha)})

    SALDO_INI = {"Efectivo": 2000000, "Transferencia": 15000000}

    def saldo_medio(medio, hasta):
        b = SALDO_INI.get(medio, 0)
        b += sum(p["Valor"] * (1 if p["Tipo"] == "Cobro cliente" else -1) for p in pagos if p["Medio de pago"] == medio and p["Fecha"] <= hasta)
        b += sum(m["Valor"] * (1 if m["Tipo"] == "Ingreso" else -1) for m in movcaja if m["Medio de pago"] == medio and m["Fecha"] <= hasta)
        b -= sum(g["Valor"] for g in gastos if g["Medio de pago"] == medio and g["Fecha"] <= hasta)
        return b

    movc(INICIO, "Ingreso", "Aporte de socios", "Transferencia", 5000000, "Capital de trabajo adicional")

    d = INICIO
    while d <= HOY:
        # --- inicio de mes: gastos fijos
        if d.day == 1:
            gasto(d, "Arriendo", "Arriendo bodega", "Inmobiliaria Centro", "Transferencia", 2500000)
        if d.day == 5:
            gasto(d, "Servicios públicos", "Energía, agua e internet", "Empresas públicas", "Transferencia",
                  random.randint(380, 520) * 1000)
            gasto(d, "Impuestos", "Industria y comercio (anticipo)", "Municipio", "Transferencia", 180000)
        if d.day == 15 or (d.day == 30) or (d.month == 2 and d.day == 28):
            gasto(d, "Nómina", "Nómina quincenal", "Empleados", "Transferencia", 1600000)
        if d.weekday() == 4:
            gasto(d, "Transporte", "Combustible y peajes", "Estación de servicio", "Efectivo",
                  random.randint(120, 260) * 1000)
        if d.day == 20:
            gasto(d, "Publicidad", "Pauta redes sociales", "Agencia digital", "Tarjeta crédito", 250000)
            gasto(d, "Papelería", "Papelería y facturación", "Papelería Central", "Efectivo", random.randint(40, 90) * 1000)
        if d.day == 25 and d.month in (7, 9):
            gasto(d, "Mantenimiento", "Mantenimiento montacargas", "Taller Industrial", "Transferencia", 420000)

        # --- reposición los lunes
        if d.weekday() == 0 and d > INICIO and d < HOY - timedelta(days=3):
            por_prov = {}
            for cod, p in prod.items():
                if stock[cod] <= p["Stock mínimo"] * 1.6 and cod not in ("P014", "P015"):
                    q = p["Stock máximo"] - stock[cod]
                    q = max(p["Unid por caja"], (q // p["Unid por caja"]) * p["Unid por caja"])
                    por_prov.setdefault(p["Proveedor principal"], []).append((cod, q))
            for pv, lineas in por_prov.items():
                num, total, frec = compra(d, pv, lineas, recibir_dias=prov_by[pv]["Tiempo entrega días"])
                pend_pagos_prov.append((frec + timedelta(days=prov_by[pv]["Plazo pago días"]), num, total))

        # --- ventas (días hábiles)
        if d.weekday() < 6 and d > INICIO:
            for _ in range(random.choice([1, 2, 2, 3])):
                cli = random.choice(CLIENTES)
                cod_cli, plazo = cli[0], cli[4]
                credito = plazo > 0 and random.random() < 0.45
                lineas = []
                for cod in random.sample([c for c in prod if c not in ("P014", "P015")], random.randint(1, 3)):
                    p = prod[cod]
                    dem = [x for x in PRODUCTOS if x[0] == cod][0][-1] * ESC_DEMANDA
                    q = max(1, int(random.gauss(dem / 9, dem / 30)))
                    q = min(q, stock[cod])
                    if q <= 0:
                        continue
                    lineas.append((cod, q))
                if not lineas:
                    continue
                n_fv += 1
                num = f"FV-{n_fv:05d}"
                medio = "Transferencia" if credito else random.choice(MEDIOS[:5])
                ventas.append({"Factura": num, "Fecha": d, "Cliente": cod_cli, "Vendedor": random.choice(VENDEDORES),
                               "Medio de pago": medio, "Condición": "Crédito" if credito else "Contado",
                               "Plazo días": plazo if credito else 0, "Estado": "Activa", "Observaciones": None,
                               "Usuario": USUARIO, "Registrado": _ts(d)})
                total = 0
                for i, (cod, q) in enumerate(lineas, start=1):
                    p = prod[cod]
                    desc = 0.05 if q >= 50 else 0
                    ventasdet.append({"Factura": num, "Línea": i, "Producto": cod, "Cantidad": q,
                                      "Precio unitario": p["Precio venta"], "Descuento %": desc, "IVA %": p["IVA %"],
                                      "Lote": None})
                    bruto = q * p["Precio venta"]
                    base = bruto - xr(bruto * desc)
                    total += base + xr(base * p["IVA %"])
                    stock[cod] -= q
                if credito:
                    r = random.random()
                    if r < 0.55:
                        pend_cobros.append((d + timedelta(days=plazo + random.randint(-10, 8)), num, total))
                    elif r < 0.85:
                        pend_cobros.append((d + timedelta(days=random.randint(8, 20)), num, xr(total * 0.5 / 1000) * 1000))
                    # resto: sin pagar (genera cartera / vencida)
                else:
                    pago(d, "Cobro cliente", num, medio, total, "Pago de contado")

        # --- pagos y cobros programados
        for (fp, doc, val) in [x for x in pend_pagos_prov if x[0] == d]:
            pago(d, "Pago proveedor", doc, "Transferencia", val, "Pago factura proveedor")
        for (fc, doc, val) in [x for x in pend_cobros if x[0] == d]:
            pago(d, "Cobro cliente", doc, "Transferencia", val, "Abono cartera")

        # --- traslados semanales al banco (sábados): tarjetas y billeteras + excedente de efectivo
        if d.weekday() == 5:
            for medio in ["Tarjeta débito", "Tarjeta crédito", "Nequi / Daviplata", "Efectivo"]:
                b = saldo_medio(medio, d)
                monto = b if medio != "Efectivo" else (b - 2000000 if b > 3000000 else 0)
                if monto > 0:
                    movc(d, "Egreso", "Traslado entre medios", medio, monto, f"Traslado de {medio} a cuenta bancaria")
                    movc(d, "Ingreso", "Traslado entre medios", "Transferencia", monto, f"Traslado recibido desde {medio}")

        # --- pérdidas ocasionales
        if d.day == 18 and d.month in (7, 9):
            aj(d, "P009", "Dañado", 6, "Botellas rotas en descargue", "Bodega")
            stock["P009"] -= 6
        if d.day == 28 and d.month == 8:
            aj(d, "P016", "Vencido", 12, "Lote vencido retirado", "Bodega", "L016-0526", date(2026, 8, 25))
            stock["P016"] -= 12
        if d.day == 10 and d.month == 10:
            aj(d, "P006", "Faltante", 4, "Diferencia en conteo cíclico", "Auditoría")
            stock["P006"] -= 4
            aj(d, "P002", "Devolución de cliente", 3, "Cliente devolvió producto en buen estado", "Ventas")
            stock["P002"] += 3
        d += timedelta(days=1)

    # compra pendiente por recibir (mercancía en tránsito) y una anulada
    num, total, _ = compra(HOY - timedelta(days=2), "PR04", [("P011", 72), ("P012", 96)], estado="Pendiente",
                           obs="Pendiente de llegada")
    compra(date(2026, 9, 2), "PR05", [("P014", 100)], estado="Anulada", obs="Proveedor sin existencias")

    # despachos (logística) de las últimas facturas
    vehs = ["Furgón NHR 2,5 t", "Camión 5 t", "Camioneta 1 t"]
    ult = [v for v in ventas if v["Fecha"] >= HOY - timedelta(days=12)][:5]
    for i, v in enumerate(ult, start=1):
        for ln in [x for x in ventasdet if x["Factura"] == v["Factura"]]:
            despachos.append({"Despacho": f"DS-{i:04d}", "Fecha": v["Fecha"], "Factura": v["Factura"],
                              "Destino": [c[1] for c in CLIENTES if c[0] == v["Cliente"]][0],
                              "Vehículo": vehs[i % 3], "Conductor": "Pedro Ramírez",
                              "Producto": ln["Producto"], "Cantidad": ln["Cantidad"],
                              "Estado": "Entregado" if v["Fecha"] < HOY - timedelta(days=1) else "Programado"})

    # cierres de caja de los últimos días (efectivo contado)
    return dict(productos=productos, costos=costos, clientes=clientes, proveedores=PROVEEDORES, ajustes=ajustes,
                compras=compras, comprasdet=comprasdet, ventas=ventas, ventasdet=ventasdet, pagos=pagos,
                gastos=gastos, movcaja=movcaja, despachos=despachos, cierres=cierres, stock=stock)


if __name__ == "__main__":
    g = generar()
    for k, v in g.items():
        print(k, len(v))
    print(g["stock"])
