#!/usr/bin/env bash
# 글 1개 -> 카드 덱 JSON. 사용: bash convert.sh <글파일>
set -uo pipefail
ROOT="d:/coding/cardnews"
f="${1:?usage: convert.sh <article-file>}"
[ -f "$f" ] || { echo "[convert] 파일 없음: $f"; exit 1; }
base="$(basename "$f")"; name="${base%.*}"
mkdir -p "$ROOT/editor/decks" "$ROOT/inbox/done"

echo "[convert] '$name' 변환 중 (claude -p)…"
prompt="$(cat "$ROOT/tools/deck-prompt.md")"
article="$(cat "$f")"

raw="$(claude -p "$prompt

==== 변환할 글 ====
$article" --output-format text 2>/dev/null)"

if printf '%s' "$raw" | node "$ROOT/tools/extract-json.js" > "$ROOT/editor/decks/$name.json" 2>/tmp/cn_err; then
  echo "[ok] -> editor/decks/$name.json"
  mv -f "$f" "$ROOT/inbox/done/" 2>/dev/null || true
else
  echo "[fail] JSON 추출 실패: $(cat /tmp/cn_err) — 원본 유지, 응답은 .raw.txt 로 저장"
  printf '%s' "$raw" > "$ROOT/editor/decks/$name.raw.txt"
  exit 1
fi
