# -*- coding: utf-8 -*-
"""Crea NEGOCIO_PRO_360_Instalador.zip: al extraerlo y ejecutar INSTALAR.bat en Windows se crea
la carpeta 'NEGOCIO PRO 360' en el Escritorio con todo el sistema, desbloqueado y listo para usar."""
import os
import zipfile

AQUI = os.path.dirname(os.path.abspath(__file__))
ENT = os.path.abspath(os.path.join(AQUI, "..", "entregables"))
ZIP = os.path.abspath(os.path.join(AQUI, "..", "NEGOCIO_PRO_360_Instalador.zip"))
RAIZ = "NEGOCIO PRO 360 - Instalador"

SISTEMA = ["NEGOCIO_PRO_360.xlsm", "NEGOCIO_PRO_360.xlsx"]
DOCS = ["Manual_de_Usuario.pdf", "Modulo_VBA.bas", "Informe_de_pruebas.txt", "Informe_ejemplo.pdf", "Dashboard_ejemplo.pdf"]

BAT = r"""@echo off
title Instalador NEGOCIO PRO 360 ENTERPRISE
cd /d "%~dp0"
powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%~dp0instalar.ps1"
echo.
pause
"""

PS1 = r"""# ============================================================================
#  Instalador de NEGOCIO PRO 360 ENTERPRISE
#  Crea la carpeta "NEGOCIO PRO 360" en el Escritorio con todo el sistema.
#  - No sobrescribe un sistema que ya tenga datos: deja la versión nueva aparte.
#  - Quita el bloqueo de Windows a los archivos descargados (para que las macros funcionen).
# ============================================================================
$ErrorActionPreference = 'Stop'
Write-Host ''
Write-Host '  NEGOCIO PRO 360 ENTERPRISE - Instalación' -ForegroundColor Cyan
Write-Host '  ----------------------------------------' -ForegroundColor Cyan
try {
    $origen = Join-Path $PSScriptRoot 'Archivos'
    if (-not (Test-Path -LiteralPath (Join-Path $origen 'NEGOCIO_PRO_360.xlsm'))) {
        throw 'No se encontró la carpeta Archivos. Primero extraiga TODO el ZIP (clic derecho > Extraer todo) y luego ejecute INSTALAR.bat desde la carpeta extraída.'
    }
    $escritorio = [Environment]::GetFolderPath('Desktop')
    $destino = Join-Path $escritorio 'NEGOCIO PRO 360'
    $carpetas = @($destino, (Join-Path $destino 'Informes'), (Join-Path $destino 'Respaldos'), (Join-Path $destino 'Documentacion'))
    foreach ($d in $carpetas) {
        if (-not (Test-Path -LiteralPath $d)) { New-Item -ItemType Directory -Path $d | Out-Null }
    }

    foreach ($f in @(__SISTEMA__)) {
        $src = Join-Path $origen $f
        $dst = Join-Path $destino $f
        if (Test-Path -LiteralPath $dst) {
            $nuevo = Join-Path $destino ($f -replace '\.(xls[xm])$', '_NUEVA_VERSION.$1')
            Copy-Item -LiteralPath $src -Destination $nuevo -Force
            Write-Host ('  Ya existía {0}: se conservó con sus datos. La versión nueva quedó como {1}' -f $f, (Split-Path $nuevo -Leaf)) -ForegroundColor Yellow
        } else {
            Copy-Item -LiteralPath $src -Destination $dst
            Write-Host ('  Copiado: {0}' -f $f)
        }
    }
    foreach ($f in @(__DOCS__)) {
        $src = Join-Path $origen $f
        if (Test-Path -LiteralPath $src) {
            Copy-Item -LiteralPath $src -Destination (Join-Path (Join-Path $destino 'Documentacion') $f) -Force
            Write-Host ('  Copiado: Documentacion\{0}' -f $f)
        }
    }

    # Quitar la marca "descargado de internet" para que Excel no bloquee las macros
    Get-ChildItem -LiteralPath $destino -Recurse -File | ForEach-Object { Unblock-File -LiteralPath $_.FullName }

    Write-Host ''
    Write-Host ('  LISTO. Carpeta creada en: {0}' -f $destino) -ForegroundColor Green
    Write-Host '  Se abrirá la carpeta y el sistema. En Excel pulse "Habilitar contenido" si lo pide.'
    Start-Process -FilePath 'explorer.exe' -ArgumentList ('"{0}"' -f $destino)
    try {
        Start-Process -FilePath (Join-Path $destino 'NEGOCIO_PRO_360.xlsm')
    } catch {
        Write-Host '  No se pudo abrir Excel automáticamente. Abra NEGOCIO_PRO_360.xlsm desde la carpeta.' -ForegroundColor Yellow
    }
} catch {
    Write-Host ''
    Write-Host ('  ERROR: {0}' -f $_.Exception.Message) -ForegroundColor Red
    exit 1
}
"""

LEAME = """NEGOCIO PRO 360 ENTERPRISE - INSTALACIÓN
========================================

1. Clic derecho sobre el archivo ZIP > "Extraer todo..." > Extraer.
   (No ejecute el instalador desde dentro del ZIP sin extraerlo.)

2. Abra la carpeta extraída y haga doble clic en INSTALAR.bat

   Si Windows muestra "Windows protegió su PC": pulse "Más información" > "Ejecutar de todas formas".

3. El instalador crea en su ESCRITORIO la carpeta "NEGOCIO PRO 360" con:

     NEGOCIO_PRO_360.xlsm   <- el sistema con macros (ábralo este)
     NEGOCIO_PRO_360.xlsx   <- versión sin macros
     Informes\\              <- aquí se guardan los PDF y Excel que exporte
     Respaldos\\             <- aquí se guardan las copias de seguridad
     Documentacion\\         <- manual, código VBA, informe de pruebas y ejemplos

   Además quita el bloqueo de Windows a los archivos y abre el sistema.

4. En Excel pulse "Habilitar contenido". La primera vez se crean los botones: guarde (Ctrl+G).

Si vuelve a ejecutar el instalador, NO se borran sus datos: si el sistema ya existe en el
Escritorio, se conserva y la versión nueva se guarda como NEGOCIO_PRO_360_NUEVA_VERSION.xlsm.

Instalación manual (si el instalador no funciona en su equipo): cree una carpeta en el
Escritorio, copie dentro el contenido de la carpeta "Archivos", clic derecho sobre
NEGOCIO_PRO_360.xlsm > Propiedades > marque "Desbloquear" > Aceptar, y ábralo.
"""


def crlf(t):
    return t.replace("\r\n", "\n").replace("\n", "\r\n")


def main():
    ps1 = PS1.replace("__SISTEMA__", ", ".join(f"'{f}'" for f in SISTEMA)).replace("__DOCS__", ", ".join(f"'{f}'" for f in DOCS))
    with zipfile.ZipFile(ZIP, "w", zipfile.ZIP_DEFLATED) as z:
        z.writestr(f"{RAIZ}/INSTALAR.bat", crlf(BAT).encode("ascii"))
        z.writestr(f"{RAIZ}/instalar.ps1", b"\xef\xbb\xbf" + crlf(ps1).encode("utf-8"))   # UTF-8 con BOM (PowerShell 5.1)
        z.writestr(f"{RAIZ}/LEAME.txt", b"\xef\xbb\xbf" + crlf(LEAME).encode("utf-8"))
        for f in SISTEMA + DOCS:
            z.write(os.path.join(ENT, f), f"{RAIZ}/Archivos/{f}")
    print("Instalador:", ZIP, os.path.getsize(ZIP), "bytes")


if __name__ == "__main__":
    main()
