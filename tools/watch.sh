#!/usr/bin/env bash
# inbox 감시 루프: 글(.md/.txt) 들어오면 자동으로 카드 JSON 생성
ROOT="d:/coding/cardnews"
echo "================================================"
echo " 📥 카드뉴스 자동 변환 감시 시작"
echo " 글(.md/.txt)을 여기에 넣으세요: $ROOT/inbox"
echo " 결과 JSON: $ROOT/editor/decks/  (에디터에서 📂 불러오기)"
echo " 중지: 이 창에서 Ctrl + C"
echo "================================================"
shopt -s nullglob
while true; do
  for f in "$ROOT/inbox"/*.md "$ROOT/inbox"/*.txt; do
    [ -e "$f" ] || continue
    bash "$ROOT/tools/convert.sh" "$f"
  done
  sleep 5
done
