#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/.."
: "${PELADO_BUILD_TOOLS:?Set PELADO_BUILD_TOOLS to the SDK build-tools directory}"
: "${PELADO_ANDROID_JAR:?Set PELADO_ANDROID_JAR to platform android.jar}"
out="$PWD/android/build"
mkdir -p "$out/classes" "$out/dex" "$out/assets"
for file in index.html style.css variables.css core.js app.js display.js variables.js remote-config.js excel.js excel-insights.js logo.svg xlsx.full.min.js jspdf.umd.min.js jspdf.plugin.autotable.min.js LICENSE-AutoTable.txt LICENSE-SheetJS.txt LICENSE-jsPDF.txt; do
  source_path="$file"
  if [[ ! -f "$source_path" ]]; then
    for folder in js css vendor assets; do
      if [[ -f "$folder/$file" ]]; then source_path="$folder/$file"; break; fi
    done
  fi
  cp "$source_path" "$out/assets/$file"
done
python3 - "$out/assets/index.html" <<'PYHTML'
import sys
from pathlib import Path
p=Path(sys.argv[1]); s=p.read_text()
for prefix in ['js/','css/','vendor/','assets/']:
    s=s.replace('src="'+prefix,'src="').replace('href="'+prefix,'href="')
p.write_text(s)
PYHTML
"$PELADO_BUILD_TOOLS/aapt2" compile --dir android/res -o "$out/resources.zip"
"$PELADO_BUILD_TOOLS/aapt2" link -o "$out/resources.apk" --manifest android/AndroidManifest.xml -I "$PELADO_ANDROID_JAR" -A "$out/assets" "$out/resources.zip"
if command -v javac >/dev/null 2>&1; then
  javac -encoding UTF-8 -source 8 -target 8 -bootclasspath "$PELADO_ANDROID_JAR:$PELADO_BUILD_TOOLS/core-lambda-stubs.jar" -d "$out/classes" android/src/com/billy/pelado/MainActivity.java
else
  : "${PELADO_ECJ_JAR:?Install JDK javac or set PELADO_ECJ_JAR to Eclipse ECJ 3.38.0}"
  java -jar "$PELADO_ECJ_JAR" -encoding UTF-8 -source 8 -target 8 -bootclasspath "$PELADO_ANDROID_JAR:$PELADO_BUILD_TOOLS/core-lambda-stubs.jar" -d "$out/classes" android/src/com/billy/pelado/MainActivity.java
fi
(cd "$out/classes" && zip -qr "$out/classes.jar" .)
"$PELADO_BUILD_TOOLS/d8" --lib "$PELADO_ANDROID_JAR" --min-api 23 --output "$out/dex" "$out/classes.jar"
cp "$out/resources.apk" "$out/unaligned.apk"
(cd "$out/dex" && zip -q "$out/unaligned.apk" classes.dex)
"$PELADO_BUILD_TOOLS/zipalign" -f -p 4 "$out/unaligned.apk" "$out/Pelado-unsigned.apk"
printf 'APK ready for private signing: %s\n' "$out/Pelado-unsigned.apk"
