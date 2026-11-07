#!/bin/bash
# Compila PERLA 3 CIFRAS PRO para Android sin Gradle, solo con las herramientas del SDK.
# Uso: ./build_apk.sh <carpeta_sdk> <archivo_html> <salida.apk> <keystore.jks> <clave>
#   <carpeta_sdk> contiene build-tools (android-14/) y platforms (android-34-ext12/) descomprimidos.
#   Variable opcional R8_JAR: ruta a r8.jar (maven: com.android.tools:r8 8.9 o superior).
set -euo pipefail
SDK=$1; HTML=$2; OUT=$3; KS=$4; PASS=$5
BT=$(ls -d "$SDK"/android-1*/ | head -1); PLAT=$(ls "$SDK"/android-34*/android.jar | head -1)
D=$(cd "$(dirname "$0")" && pwd); B="$D/build"
rm -rf -- "$B" && mkdir -p "$B/assets/www" "$B/classes" "$B/dex"
"$BT/aapt2" compile --dir "$D/res" -o "$B/res.zip"
cp "$HTML" "$B/assets/www/PERLA3CIFRAS_PRO.html"
cp "$D/../icon.svg" "$B/assets/www/icon.svg"
"$BT/aapt2" link -o "$B/base.apk" -I "$PLAT" --manifest "$D/AndroidManifest.xml" -A "$B/assets" "$B/res.zip" --auto-add-overlay
javac --release 11 -cp "$PLAT" -Xlint:-options -nowarn -d "$B/classes" $(find "$D/src" -name '*.java')
# D8: el de build-tools 34 falla con clases de Java 21; si existe R8_JAR (r8 >= 8.5) se usa ese.
if [ -n "${R8_JAR:-}" ]; then D8=(java -cp "$R8_JAR" com.android.tools.r8.D8); else D8=("$BT/d8"); fi
"${D8[@]}" --release --lib "$PLAT" --min-api 24 --output "$B/dex" $(find "$B/classes" -name '*.class')
(cd "$B/dex" && zip -q -j "$B/base.apk" classes.dex)
"$BT/zipalign" -f -p 4 "$B/base.apk" "$B/aligned.apk"
"$BT/apksigner" sign --ks "$KS" --ks-pass "pass:$PASS" --key-pass "pass:$PASS" --out "$OUT" "$B/aligned.apk"
"$BT/apksigner" verify --print-certs "$OUT" | head -3
echo "APK listo: $OUT ($(du -h "$OUT" | cut -f1))"
