# Manual de instalación – PERLA 3 CIFRAS PRO

La aplicación es **un único archivo**: `PERLA3CIFRAS_PRO.html` (unos 1,2 MB). No requiere servidor, ni instalación, ni
conexión a Internet: todas las librerías están incluidas dentro del archivo.

## Aplicaciones instalables (versión 1.3)

### Android – archivo APK
1. Copie `PERLA3CIFRAS_PRO_1.8.0.apk` al teléfono (cable USB, Drive, WhatsApp o correo).
2. Ábralo desde *Archivos* o *Descargas*. Android pedirá permitir **«Instalar apps desconocidas»** para esa aplicación
   (Archivos, Chrome o WhatsApp): actívelo una sola vez y vuelva atrás.
3. Pulse **Instalar**. Si aparece *Play Protect*, elija **Instalar de todas formas** (la app no está en Google Play).
4. Abra **PERLA 3 CIFRAS PRO** desde el menú de aplicaciones.
* Requiere Android 7.0 o superior. Los datos se guardan dentro de la app; los archivos exportados (Excel, PDF, copias de
  seguridad) quedan en **Descargas/PERLA3**. «⇪ Importar archivo» abre el selector de archivos del teléfono.
* **Actualizar:** instale el APK nuevo encima del anterior (sin desinstalar): los datos se conservan. Esto solo funciona
  si el APK nuevo está firmado con la **misma clave**; guarde el archivo de clave que recibió con la entrega.

### Windows – instalador
1. Ejecute `PERLA3CIFRAS_PRO_1.8.0_instalador.exe`.
2. Si Windows SmartScreen muestra *«Windows protegió su PC»*, pulse **Más información → Ejecutar de todas formas**
   (el instalador no tiene firma digital comercial).
3. Elija la carpeta (por defecto, la de su usuario; no requiere administrador) y termine. Se crean accesos directos en el
   escritorio y en el menú Inicio.
* Los datos se guardan en `%APPDATA%\PERLA 3 CIFRAS PRO`; los archivos exportados, en **Descargas\PERLA3**.
* **Actualizar:** ejecute el instalador nuevo; los datos se conservan. **Desinstalar:** Configuración de Windows →
  Aplicaciones → PERLA 3 CIFRAS PRO (los datos no se borran).
* **Versión portátil:** `PERLA3CIFRAS_PRO_1.8.0_portable.exe` funciona sin instalar (por ejemplo desde una memoria USB).
* Teclas: **F11** pantalla completa, **F5** recargar, **Ctrl+P** imprimir.

## Navegadores recomendados

Google Chrome, Microsoft Edge o Brave (versiones de 2022 en adelante). Firefox también funciona.
**No use el modo incógnito / privado**: en ese modo el navegador borra los datos al cerrarse.

## Windows (computador)

1. Copie `PERLA3CIFRAS_PRO.html` en una carpeta fija, por ejemplo `Documentos\PERLA3`.
2. Haga doble clic sobre el archivo. Si se abre con otro programa: clic derecho → *Abrir con* → *Google Chrome* o *Microsoft Edge*.
3. (Opcional) Cree un acceso directo en el escritorio: clic derecho → *Enviar a* → *Escritorio*.
4. (Opcional, Chrome/Edge) Menú ⋮ → *Guardar y compartir* / *Aplicaciones* → *Instalar como aplicación*… para abrirla en su propia ventana.

**Importante:** los datos quedan guardados en el navegador asociados a la ubicación del archivo. Ábralo siempre desde la
misma carpeta y con el mismo navegador.

## Android (celular o tableta)

**Opción A – archivo local.** Copie el archivo al teléfono (cable, Drive o WhatsApp). Ábralo desde *Archivos* eligiendo
**Chrome**. Algunos administradores de archivos abren el HTML en un visor que no guarda datos; si al recargar se pierden
los datos, use la opción B.

**Opción B – publicación gratuita (recomendada para celular).** Publique la carpeta `perla3cifras/` en un hosting estático
gratuito, por ejemplo GitHub Pages:
1. En GitHub, en el repositorio: *Settings → Pages → Deploy from a branch*, rama `main`, carpeta raíz.
2. Abra `https://<usuario>.github.io/<repositorio>/perla3cifras/` en Chrome del celular.
3. Menú ⋮ → **Agregar a la pantalla principal / Instalar aplicación**. Gracias a `sw.js` funciona después sin conexión.
Los datos siguen guardándose **solo en el celular** (no se envían a ningún servidor).

## Datos, copias de seguridad y actualizaciones

* Guardado automático: cada cambio se escribe al instante en la base local del navegador (IndexedDB). El indicador
  «● Guardado» de la barra superior lo confirma.
* La aplicación solicita al navegador *almacenamiento persistente* para que no borre los datos por falta de espacio
  (estado visible en *Configuración → Información del sistema*).
* **Copias de seguridad:** *Excel* o *Configuración* → *Descargar copia de seguridad* genera un archivo `.json` con toda
  la base. Guárdelo fuera del navegador. *Restaurar copia…* lo recupera (en otro equipo, navegador o tras un borrado).
* **Actualizar la aplicación:** reemplace el archivo `PERLA3CIFRAS_PRO.html` por la versión nueva **en la misma carpeta**
  y con el mismo nombre. Las versiones nuevas solo agregan estructuras a la base de datos, nunca borran los históricos.
  Por precaución, descargue una copia de seguridad antes de actualizar.
* Pasar los datos a otro equipo: descargue la copia en el equipo A y restáurela en el equipo B.

## Solución de problemas

| Problema | Solución |
|---|---|
| Aviso «almacenamiento de respaldo (limitado)» | El navegador bloquea IndexedDB (modo privado o política). Use Chrome/Edge normal. |
| Los datos no aparecen | Verifique que abrió el archivo desde la misma ubicación y navegador. Restaure la última copia. |
| «La base de datos está bloqueada por otra pestaña» | Cierre las otras pestañas de la aplicación y recargue. |
| Gráficos o Excel no disponibles | Use el archivo `PERLA3CIFRAS_PRO.html` completo (no `src/index.html`, que es la plantilla de desarrollo). |
