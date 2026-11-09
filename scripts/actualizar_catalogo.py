#!/usr/bin/env python3
"""Descarga el catálogo de referencia (código de barras, nombre, presentación y precio)
de los productos de tienda de barrio publicados en exito.com y lo guarda en
catalogo-referencia.json, que la app usa al escanear un código.

Uso:  python3 scripts/actualizar_catalogo.py
Hace peticiones lentas (1 por segundo) a la API pública que usa la propia página.
"""
import json, re, sys, time, urllib.request, urllib.parse
from datetime import datetime, timezone

BASE = 'https://www.exito.com/api/catalog_system/pub'
SALIDA = 'catalogo-referencia.json'
PAUSA = 1.0
PAGINA = 50
# El programa se identifica con su propio nombre (no se hace pasar por un navegador).
AGENTE = 'MiTiendaDeBarrio-catalogo/1.0 (+https://github.com/wilmarzuluaga149-dot/logisticubo)'

# Subcategorías de exito.com  ->  categoría de la app
QUIERO = {
    'Mercado': {
        'Despensa': 'abarrotes', 'Pasabocas y snacks': 'abarrotes', 'Dulces y chocolatería': 'abarrotes',
        'Panadería y repostería': 'abarrotes', 'Alimentación para bebés': 'abarrotes', 'Mascotas': 'abarrotes',
        'Congelados': 'abarrotes', 'Charcutería y delicatessen': 'lacteos',
        'Lácteos, huevos y refrigerados': 'lacteos',
        'Frutas y verduras': 'frescos', 'Pollo, carne y pescado': 'frescos',
        'Aseo del hogar': 'aseo', 'Bebidas': 'bebidas',
    },
    'Cuidado personal': {
        'Cuidado capilar': 'aseo', 'Cuidado corporal': 'aseo', 'Cuidado oral': 'aseo', 'Higiene íntima': 'aseo',
        'Higiene para bebés y niños': 'aseo', 'Pañitos y pañuelos': 'aseo',
    },
    'Vinos y licores': '*bebidas',
}

def get(url):
    req = urllib.request.Request(url, headers={'Accept': 'application/json', 'User-Agent': AGENTE})
    for intento in range(3):
        try:
            with urllib.request.urlopen(req, timeout=40) as r:
                return json.load(r), r.headers.get('resources', '')
        except Exception as e:
            print('  reintento', intento + 1, e, file=sys.stderr)
            time.sleep(3 * (intento + 1))
    return [], ''

def ean_valido(c):
    if not re.fullmatch(r'\d{8}|\d{12,14}', c or ''):
        return False
    d = [int(x) for x in c]
    s = sum(v * (3 if i % 2 else 1) for i, v in enumerate(reversed(d[:-1])))
    return (10 - s % 10) % 10 == d[-1]

def limpiar(nombre):
    m = re.search(r'\(([^()]*)\)\s*$', nombre)
    unidad = ''
    if m:
        unidad = re.sub(r'\s+', ' ', m.group(1)).strip()
        unidad = re.sub(r'(\d+)\s*gr\b', r'\1 g', unidad)
        nombre = nombre[:m.start()].strip()
    return re.sub(r'\s+', ' ', nombre), unidad

def destinos(arbol):
    for top in arbol:
        regla = QUIERO.get(top['name'])
        if not regla:
            continue
        if isinstance(regla, str):
            yield f"/{top['id']}/", regla.lstrip('*'), top['name']
            continue
        for sub in top.get('children', []):
            if sub['name'] in regla:
                yield f"/{top['id']}/{sub['id']}/", regla[sub['name']], sub['name']

def main():
    arbol, _ = get(f'{BASE}/category/tree/2')
    productos = {}
    for ruta, cat, nombre in destinos(arbol):
        desde, total = 0, None
        while desde < 2500 and (total is None or desde < total):
            q = urllib.parse.urlencode({'fq': f'C:{ruta}', '_from': desde, '_to': desde + PAGINA - 1})
            lote, rango = get(f'{BASE}/products/search?{q}')
            if total is None:
                total = int(rango.split('/')[-1]) if '/' in rango else 0
                print(f'{nombre}: {total} productos', file=sys.stderr)
            if not lote:
                break
            for p in lote:
                for it in p.get('items', [])[:1]:
                    oferta = (it.get('sellers') or [{}])[0].get('commertialOffer', {})
                    precio = round(oferta.get('Price') or 0)
                    if not precio or not oferta.get('IsAvailable', True):
                        continue
                    codigo = (it.get('ean') or '').strip()
                    if not ean_valido(codigo):
                        codigo = ''
                    n, u = limpiar(p.get('productName', ''))
                    clave = codigo or ('id' + str(p.get('productId')))
                    productos[clave] = {
                        'c': codigo, 'n': n, 'b': p.get('brand', ''), 'u': u, 'p': precio,
                        'l': round(oferta.get('ListPrice') or precio), 'k': cat, 's': nombre,
                    }
            desde += PAGINA
            time.sleep(PAUSA)
    items = sorted(productos.values(), key=lambda x: (x['k'], x['n']))
    salida = {
        'fuente': 'exito.com (tienda en línea)',
        'actualizado': datetime.now(timezone.utc).strftime('%Y-%m-%d'),
        'nota': 'Precios de supermercado como referencia. Cada tienda define su propio precio.',
        'items': items,
    }
    with open(SALIDA, 'w', encoding='utf-8') as f:
        json.dump(salida, f, ensure_ascii=False, separators=(',', ':'))
    con = sum(1 for x in items if x['c'])
    print(f'Listo: {len(items)} productos ({con} con código de barras) -> {SALIDA}', file=sys.stderr)

if __name__ == '__main__':
    main()
