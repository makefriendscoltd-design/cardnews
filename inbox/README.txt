📥 카드뉴스 자동 변환 inbox

여기에 글(.md 또는 .txt)을 넣으면, AI(Claude Code, 내 구독 사용)가
자동으로 카드뉴스 덱(JSON)으로 요약·정돈해 줍니다. API 키·추가비용 0.

[사용법]
1. cardnews 폴더의  watch-start.bat  을 더블클릭 → 감시 창이 켜짐 (켜둔 채로)
2. 이 inbox 폴더에 글 파일(.md/.txt)을 넣는다
3. 약 10~30초 뒤  editor/decks/<파일이름>.json  이 생성됨
4. 에디터(editor/index.html)를 열고 상단 "📂 불러오기"로 그 JSON 선택
5. 스타일·포인트 색상 고르고 → "전체 ZIP 내보내기"로 PNG 받기

[참고]
- 변환된 원본 글은 inbox/done/ 으로 자동 이동합니다.
- 변환 실패 시 editor/decks/<이름>.raw.txt 에 응답 원문이 남습니다.
- 감시 중지: 감시 창에서 Ctrl + C
- 한 번만 변환하고 싶으면:  bash tools/convert.sh "inbox/글.md"
