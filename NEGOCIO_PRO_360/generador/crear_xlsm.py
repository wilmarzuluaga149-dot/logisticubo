# -*- coding: utf-8 -*-
"""Crea NEGOCIO_PRO_360.xlsm incrustando el proyecto VBA en el .xlsx.

Implementa, según las especificaciones públicas de Microsoft:
  * [MS-CFB]  Compound File Binary (contenedor vbaProject.bin)
  * [MS-OVBA] compresión VBA, flujo 'dir', PROJECT, PROJECTwm y _VBA_PROJECT
El proyecto se escribe SOLO con código fuente (sin p-code: _VBA_PROJECT versión
0xFFFF), de modo que Excel compila los módulos al abrir el libro.
"""
import os
import random
import re
import struct
import sys
import uuid
import zipfile

ENDOFCHAIN = 0xFFFFFFFE
FREESECT = 0xFFFFFFFF
FATSECT = 0xFFFFFFFD
NOSTREAM = 0xFFFFFFFF
CP = "cp1252"


# ============================================================ compresión MS-OVBA 2.4.1
def _bitcount(diff):
    return max((diff - 1).bit_length(), 4)


def _compress_chunk(chunk):
    out = bytearray()
    pos = 0
    n = len(chunk)
    index = {}
    while pos < n:
        flag_pos = len(out)
        out.append(0)
        flags = 0
        for bit in range(8):
            if pos >= n:
                break
            best_len, best_off = 0, 0
            if pos >= 1 and pos + 3 <= n:
                bc = _bitcount(pos)
                max_len = (0xFFFF >> bc) + 3
                key = chunk[pos:pos + 3]
                for cand in reversed(index.get(key, [])[-64:]):
                    off = pos - cand
                    if off > pos:
                        continue
                    L = 0
                    lim = min(max_len, n - pos)
                    while L < lim and chunk[cand + L] == chunk[pos + L]:
                        L += 1
                    if L > best_len:
                        best_len, best_off = L, off
                        if L == lim:
                            break
            if best_len >= 3:
                bc = _bitcount(pos)
                token = ((best_off - 1) << (16 - bc)) | (best_len - 3)
                out += struct.pack("<H", token)
                flags |= 1 << bit
                for k in range(best_len):
                    if pos + k + 3 <= n:
                        index.setdefault(chunk[pos + k:pos + k + 3], []).append(pos + k)
                pos += best_len
            else:
                out.append(chunk[pos])
                if pos + 3 <= n:
                    index.setdefault(chunk[pos:pos + 3], []).append(pos)
                pos += 1
        out[flag_pos] = flags
    return bytes(out)


def comprimir(data):
    out = bytearray([0x01])
    for i in range(0, len(data), 4096):
        chunk = data[i:i + 4096]
        comp = _compress_chunk(chunk)
        if len(comp) > 4096 - 2 and len(chunk) == 4096:
            out += struct.pack("<H", 0x3FFF & 0x0FFF | (0b011 << 12))  # sin comprimir (flag 0)
            out += chunk
        else:
            size = len(comp) + 2 - 3
            out += struct.pack("<H", (size & 0x0FFF) | (0b011 << 12) | (1 << 15))
            out += comp
    return bytes(out)


# ============================================================ cifrado de datos MS-OVBA 2.4.3 (CMG/DPB/GC)
def cifrar(data, project_id):
    seed = random.randint(0, 255)
    version = 2
    proj_key = sum(project_id.encode(CP)) & 0xFF
    out = bytearray([seed, seed ^ version, seed ^ proj_key])
    unenc1, enc1, enc2 = proj_key, seed ^ proj_key, seed ^ version
    ignored = (seed & 6) // 2
    for _ in range(ignored):
        temp = random.randint(0, 255)
        b = ((enc2 + unenc1) & 0xFF) ^ temp
        out.append(b)
        enc2, enc1, unenc1 = enc1, b, temp
    for byte in struct.pack("<I", len(data)) + data:
        b = ((enc2 + unenc1) & 0xFF) ^ byte
        out.append(b)
        enc2, enc1, unenc1 = enc1, b, byte
    return out.hex().upper()


def descifrar(hexstr):
    d = bytes.fromhex(hexstr)
    seed, venc, pkenc = d[0], d[1], d[2]
    version, proj_key = seed ^ venc, seed ^ pkenc
    unenc1, enc1, enc2 = proj_key, pkenc, venc
    ignored = (seed & 6) // 2
    i = 3
    out = bytearray()
    for _ in range(ignored):
        b = d[i]; i += 1
        byte = ((enc2 + unenc1) & 0xFF) ^ b
        enc2, enc1, unenc1 = enc1, b, byte
    while i < len(d):
        b = d[i]; i += 1
        byte = ((enc2 + unenc1) & 0xFF) ^ b
        out.append(byte)
        enc2, enc1, unenc1 = enc1, b, byte
    n = struct.unpack("<I", out[:4])[0]
    return version, bytes(out[4:4 + n])


# ============================================================ flujo dir MS-OVBA 2.3.4.2
def _rec(rid, payload):
    return struct.pack("<HI", rid, len(payload)) + payload


def flujo_dir(modulos):
    """modulos: lista de (nombre, es_documento)."""
    b = bytearray()
    b += _rec(0x0001, struct.pack("<I", 1))                 # SYSKIND win32
    b += _rec(0x0002, struct.pack("<I", 0x0409))            # LCID
    b += _rec(0x0014, struct.pack("<I", 0x0409))            # LCIDINVOKE
    b += _rec(0x0003, struct.pack("<H", 1252))              # CODEPAGE
    b += _rec(0x0004, b"VBAProject")                        # NAME
    b += _rec(0x0005, b"") + _rec(0x0040, b"")              # DOCSTRING
    b += _rec(0x0006, b"") + _rec(0x003D, b"")              # HELPFILEPATH
    b += _rec(0x0007, struct.pack("<I", 0))                 # HELPCONTEXT
    b += _rec(0x0008, struct.pack("<I", 0))                 # LIBFLAGS
    b += struct.pack("<HIIH", 0x0009, 4, 1, 0)              # VERSION (Reserved=4, Major, Minor)
    b += _rec(0x000C, b"") + _rec(0x003C, b"")              # CONSTANTS
    # referencia a stdole (OLE Automation)
    nombre = b"stdole"
    b += _rec(0x0016, nombre) + _rec(0x003E, nombre.decode().encode("utf-16-le"))
    libid = b"*\\G{00020430-0000-0000-C000-000000000046}#2.0#0#C:\\Windows\\System32\\stdole2.tlb#OLE Automation"
    reg = struct.pack("<I", len(libid)) + libid + struct.pack("<IH", 0, 0)
    b += _rec(0x000D, reg)
    # módulos
    b += _rec(0x000F, struct.pack("<H", len(modulos)))
    b += _rec(0x0013, struct.pack("<H", 0xFFFF))
    for nom, es_doc in modulos:
        nb = nom.encode(CP)
        nu = nom.encode("utf-16-le")
        b += _rec(0x0019, nb)
        b += _rec(0x0047, nu)
        b += _rec(0x001A, nb) + _rec(0x0032, nu)
        b += _rec(0x001C, b"") + _rec(0x0048, b"")
        b += _rec(0x0031, struct.pack("<I", 0))             # MODULEOFFSET: el código empieza en 0
        b += _rec(0x001E, struct.pack("<I", 0))
        b += _rec(0x002C, struct.pack("<H", 0xFFFF))
        b += struct.pack("<HI", 0x0022 if es_doc else 0x0021, 0)
        b += struct.pack("<HI", 0x002B, 0)                  # terminador de módulo
    b += struct.pack("<HI", 0x0010, 0)                      # terminador
    return bytes(b)


# ============================================================ contenedor MS-CFB v3
class Entrada:
    def __init__(self, nombre, tipo, data=b"", hijos=None):
        self.nombre, self.tipo, self.data, self.hijos = nombre, tipo, data, hijos or []
        self.id = None
        self.izq = self.der = self.hijo = NOSTREAM
        self.inicio, self.tam = 0, 0


def _clave(e):
    return (len(e.nombre), e.nombre.upper())


def _arbol(entradas):
    """Árbol binario de búsqueda balanceado con los hermanos; devuelve el id de la raíz."""
    if not entradas:
        return NOSTREAM
    entradas = sorted(entradas, key=_clave)
    m = len(entradas) // 2
    r = entradas[m]
    r.izq = _arbol(entradas[:m])
    r.der = _arbol(entradas[m + 1:])
    return r.id


def crear_cfb(raiz):
    todas = []

    def recorrer(e):
        e.id = len(todas)
        todas.append(e)
        for h in e.hijos:
            recorrer(h)
    recorrer(raiz)
    for e in todas:
        if e.hijos:
            e.hijo = _arbol(e.hijos)
    flujos = [e for e in todas if e.tipo == 2]
    pequenos = [e for e in flujos if len(e.data) < 4096]
    grandes = [e for e in flujos if len(e.data) >= 4096]
    # mini stream
    mini = bytearray()
    minifat = []
    for e in pequenos:
        e.tam = len(e.data)
        n = (len(e.data) + 63) // 64
        if n == 0:
            e.inicio = ENDOFCHAIN
            continue
        e.inicio = len(mini) // 64
        mini += e.data + b"\0" * (n * 64 - len(e.data))
        for k in range(n):
            minifat.append(e.inicio + k + 1 if k < n - 1 else ENDOFCHAIN)
    n_dir = (len(todas) * 128 + 511) // 512
    n_minifat = (len(minifat) * 4 + 511) // 512
    n_mini = (len(mini) + 511) // 512
    n_big = sum((len(e.data) + 511) // 512 for e in grandes)
    resto = n_dir + n_minifat + n_mini + n_big
    n_fat = 1
    while n_fat * 128 < resto + n_fat:
        n_fat += 1
    assert n_fat <= 109
    fat = [FATSECT] * n_fat
    def cadena(n):
        ini = len(fat)
        for k in range(n):
            fat.append(ini + k + 1 if k < n - 1 else ENDOFCHAIN)
        return ini
    dir_ini = cadena(n_dir)
    minifat_ini = cadena(n_minifat) if n_minifat else ENDOFCHAIN
    mini_ini = cadena(n_mini) if n_mini else ENDOFCHAIN
    for e in grandes:
        e.tam = len(e.data)
        e.inicio = cadena((len(e.data) + 511) // 512)
    fat += [FREESECT] * (n_fat * 128 - len(fat))
    raiz.inicio = mini_ini
    raiz.tam = len(mini)
    # encabezado
    h = bytearray(512)
    h[0:8] = bytes.fromhex("D0CF11E0A1B11AE1")
    struct.pack_into("<HHHHH", h, 24, 0x003E, 0x0003, 0xFFFE, 9, 6)
    struct.pack_into("<I", h, 40, 0)               # n.º sectores de directorio (v3 = 0)
    struct.pack_into("<I", h, 44, n_fat)
    struct.pack_into("<I", h, 48, dir_ini)
    struct.pack_into("<I", h, 52, 0)
    struct.pack_into("<I", h, 56, 4096)
    struct.pack_into("<I", h, 60, minifat_ini)
    struct.pack_into("<I", h, 64, n_minifat)
    struct.pack_into("<I", h, 68, ENDOFCHAIN)
    struct.pack_into("<I", h, 72, 0)
    for i in range(109):
        struct.pack_into("<I", h, 76 + 4 * i, i if i < n_fat else FREESECT)
    # directorio
    d = bytearray()
    for e in todas:
        reg = bytearray(128)
        nu = e.nombre.encode("utf-16-le")
        assert len(nu) <= 62
        reg[0:len(nu)] = nu
        struct.pack_into("<H", reg, 64, len(nu) + 2)
        reg[66] = e.tipo
        reg[67] = 1  # negro
        struct.pack_into("<III", reg, 68, e.izq, e.der, e.hijo)
        struct.pack_into("<I", reg, 116, e.inicio if e.tipo in (2, 5) else 0)
        struct.pack_into("<I", reg, 120, e.tam if e.tipo in (2, 5) else 0)
        d += reg
    d += b"\0" * (n_dir * 512 - len(d))
    # entradas vacías del directorio deben tener ids NOSTREAM
    for k in range(len(todas), n_dir * 4):
        struct.pack_into("<III", d, k * 128 + 68, NOSTREAM, NOSTREAM, NOSTREAM)
    out = bytearray(h)
    out += b"".join(struct.pack("<I", x) for x in fat)
    out += d
    mf = b"".join(struct.pack("<I", x) for x in minifat)
    out += mf + b"\xff" * (n_minifat * 512 - len(mf))
    out += bytes(mini) + b"\0" * (n_mini * 512 - len(mini))
    for e in grandes:
        out += e.data + b"\0" * (((len(e.data) + 511) // 512) * 512 - len(e.data))
    return bytes(out)


# ============================================================ proyecto VBA
DOC_LIBRO = ('Attribute VB_Name = "{n}"\r\nAttribute VB_Base = "0{{00020819-0000-0000-C000-000000000046}}"\r\n'
             'Attribute VB_GlobalNameSpace = False\r\nAttribute VB_Creatable = False\r\nAttribute VB_PredeclaredId = True\r\n'
             'Attribute VB_Exposed = True\r\nAttribute VB_TemplateDerived = False\r\nAttribute VB_Customizable = True\r\n')
DOC_HOJA = DOC_LIBRO.replace("00020819", "00020820")


def proyecto_vba(codigo_modulo, nombres_hoja):
    """codigo_modulo: texto del .bas (con Attribute VB_Name). nombres_hoja: codeNames de las hojas."""
    pid = "{" + str(uuid.uuid4()).upper() + "}"
    modulos = [("ThisWorkbook", True)] + [(n, True) for n in nombres_hoja] + [("NP360", False)]
    fuentes = {"ThisWorkbook": DOC_LIBRO.format(n="ThisWorkbook")}
    for n in nombres_hoja:
        fuentes[n] = DOC_HOJA.format(n=n)
    codigo = codigo_modulo.replace("\r\n", "\n").replace("\n", "\r\n")
    fuentes["NP360"] = codigo
    lineas = [f'ID="{pid}"', "Document=ThisWorkbook/&H00000000"]
    lineas += [f"Document={n}/&H00000000" for n in nombres_hoja]
    lineas += ["Module=NP360", 'Name="VBAProject"', 'HelpContextID="0"', 'VersionCompatible32="393222000"',
               f'CMG="{cifrar(struct.pack("<I", 0), pid)}"', f'DPB="{cifrar(bytes([0]), pid)}"', f'GC="{cifrar(bytes([0xFF]), pid)}"',
               "", "[Host Extender Info]", "&H00000001={3832D640-CF90-11CF-8E43-00A0C911005A};VBE;&H00000000", "",
               "[Workspace]"] + [f"{m}=0, 0, 0, 0, C" for m, _ in modulos]
    project = ("\r\n".join(lineas) + "\r\n").encode(CP)
    wm = b"".join(m.encode(CP) + b"\0" + m.encode("utf-16-le") + b"\0\0" for m, _ in modulos) + b"\0\0"
    vba_hijos = [Entrada("_VBA_PROJECT", 2, bytes([0xCC, 0x61, 0xFF, 0xFF, 0x00, 0x00, 0x00])),
                 Entrada("dir", 2, comprimir(flujo_dir(modulos)))]
    for m, _ in modulos:
        vba_hijos.append(Entrada(m, 2, comprimir(fuentes[m].encode(CP))))
    raiz = Entrada("Root Entry", 5, hijos=[Entrada("PROJECT", 2, project), Entrada("PROJECTwm", 2, wm),
                                           Entrada("VBA", 1, hijos=vba_hijos)])
    return crear_cfb(raiz), pid


def xlsx_a_xlsm(xlsx, xlsm, bas):
    codigo = open(bas, encoding="utf-8").read()
    zin = zipfile.ZipFile(xlsx)
    wbxml = zin.read("xl/workbook.xml").decode("utf-8")
    # codeNames de las hojas en el orden de workbook.xml
    rels = zin.read("xl/_rels/workbook.xml.rels").decode("utf-8")
    rid2target = dict(re.findall(r'Id="(rId\d+)"[^>]*Target="([^"]+)"', rels)) or {}
    if not rid2target:
        rid2target = {a: b for b, a in re.findall(r'Target="([^"]+)"[^>]*Id="(rId\d+)"', rels)}
    hojas = re.findall(r'<sheet [^>]*name="([^"]+)"[^>]*r:id="(rId\d+)"', wbxml)
    codenames = []
    for nombre, rid in hojas:
        destino = rid2target[rid].lstrip("/")
        destino = destino if destino.startswith("xl/") else "xl/" + destino
        sx = zin.read(destino).decode("utf-8")
        m = re.search(r'<sheetPr[^>]*codeName="([^"]+)"', sx)
        if not m:
            raise SystemExit(f"La hoja {nombre} no tiene codeName")
        codenames.append(m.group(1))
    if 'codeName="ThisWorkbook"' not in wbxml:
        raise SystemExit("workbook.xml sin codeName=ThisWorkbook")
    binario, pid = proyecto_vba(codigo, codenames)
    zout = zipfile.ZipFile(xlsm, "w", zipfile.ZIP_DEFLATED)
    for item in zin.infolist():
        data = zin.read(item.filename)
        if item.filename == "[Content_Types].xml":
            s = data.decode("utf-8")
            s = s.replace("application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml",
                          "application/vnd.ms-excel.sheet.macroEnabled.main+xml")
            if 'Extension="bin"' not in s:
                s = s.replace("<Default ", '<Default Extension="bin" ContentType="application/vnd.ms-office.vbaProject"/><Default ', 1)
            data = s.encode("utf-8")
        elif item.filename == "xl/_rels/workbook.xml.rels":
            s = data.decode("utf-8")
            s = s.replace("</Relationships>", '<Relationship Id="rIdVBA1" Type="http://schemas.microsoft.com/office/2006/relationships/vbaProject" Target="vbaProject.bin"/></Relationships>')
            data = s.encode("utf-8")
        zout.writestr(item, data)
    zout.writestr("xl/vbaProject.bin", binario)
    zout.close()
    return codenames, pid, len(binario)


if __name__ == "__main__":
    cn, pid, n = xlsx_a_xlsm(sys.argv[1], sys.argv[2], sys.argv[3])
    print(f"xlsm creado: {sys.argv[2]} · vbaProject.bin {n} bytes · {len(cn) + 2} módulos · {pid}")
