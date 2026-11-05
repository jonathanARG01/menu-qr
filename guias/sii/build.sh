#!/usr/bin/env bash
# Genera guias/sii/index.html a partir de la guía publicada en Claude (fragmento sin <html>/<head>).
set -euo pipefail
SRC="${1:-/mnt/project-files/menu-qr/venta/guia-inicio-actividades-sii.html}"
OUT="$(dirname "$0")/index.html"
{
  echo '<!doctype html>'
  echo '<html lang="es-CL">'
  echo '<head>'
  echo '<meta charset="utf-8">'
  echo '<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">'
  echo '<meta name="robots" content="noindex">'
  echo '<style>:root{padding-top:env(safe-area-inset-top,0px);padding-bottom:env(safe-area-inset-bottom,0px)}body{margin:0}img{max-width:100%}[hidden]{display:none!important}</style>'
  echo '</head>'
  echo '<body>'
  cat "$SRC"
  echo '</body>'
  echo '</html>'
} > "$OUT"
echo "OK: $OUT"
