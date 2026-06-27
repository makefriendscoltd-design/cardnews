#!/usr/bin/env bash
# 카드뉴스 HTML -> 1080x1350 PNG 렌더링
# 사용법: bash render.sh                      (templates/ 전부)
#        bash render.sh series/pod-claude    (해당 폴더 전부 -> output/pod-claude/)
#        bash render.sh templates/cover.html (단일 파일)
set -e
CHROME="/c/Program Files/Google/Chrome/Application/chrome.exe"
ROOT="d:/coding/cardnews"
SRC="${1:-templates}"
shopt -s nullglob

if [ -d "$ROOT/$SRC" ]; then
  files=("$ROOT/$SRC"/*.html)
  OUT="$ROOT/output/$(basename "$SRC")"
elif [ -f "$ROOT/$SRC" ]; then
  files=("$ROOT/$SRC")
  OUT="$ROOT/output"
else
  echo "not found: $ROOT/$SRC"; exit 1
fi
mkdir -p "$OUT"

for f in "${files[@]}"; do
  name=$(basename "$f" .html)
  echo "rendering: $name"
  "$CHROME" --headless=new --disable-gpu --hide-scrollbars \
    --force-device-scale-factor=1 --window-size=1080,1350 \
    --default-background-color=00000000 --virtual-time-budget=4000 \
    --screenshot="$OUT/$name.png" "file:///$f" >/dev/null 2>&1
done
echo "done -> $OUT"
