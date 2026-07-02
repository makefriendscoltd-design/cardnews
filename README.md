# 카드뉴스 에디터

인스타그램용 **카드뉴스(1080×1350) 생성기**. 글을 붙여넣으면 AI가 요약·정돈해서 카드로 만들고, 스타일·배경을 고른 뒤 PNG로 내보냅니다. 전부 브라우저 안에서.

## 실행
1. **`start.bat` 더블클릭** → AI 서버가 켜지고 브라우저가 `http://127.0.0.1:8787/` 로 자동으로 열립니다.
2. 창은 켜둔 채로 사용하세요. (중지: 서버 창에서 Ctrl+C)

> ⚠️ `index.html`을 직접 열지 마세요(`file://`). 그러면 PNG 내보내기가 막힙니다. 반드시 `start.bat`(http)로 여세요.

## 사용 흐름
1. **✨ 글로 카드 만들기** → 글 붙여넣기 → **✨ AI로 변환** (요약·줄바꿈·강조 자동)
2. 상단 **스타일** 드롭다운으로 6종 전환 (시네마틱/매거진/만화/픽셀/도들/화이트블루)
3. **🎲 배경 바꾸기**(AI 생성 풀) / **🔍 무료 이미지 검색**(Pexels) / 직접 업로드
4. **포인트 색상** 팔레트로 강조색 변경
5. **전체 ZIP 내보내기** → 1080×1350 PNG

## 필요 조건
- **Node.js** (서버 구동)
- **Claude Code** (AI 변환에 사용 — 호스트 PC의 구독으로 동작, API 키 불필요)
- **Chrome** 또는 최신 브라우저

## 사무실 공유
호스트 한 명만 `start.bat` 실행 → 팀원은 브라우저에서 **`http://<호스트IP>:8787/`** 열면 끝. (폴더 복사·설치 불필요, 서버 주소 자동 인식)

## 배경 이미지 3가지 방법
1. **🎨 AI 배경 생성** — 글 주제에 맞는 배경을 즉석 생성. **✨ AI로 변환** 직후엔 표지·인용·마무리 배경을 자동으로 생성해줍니다. 우선순위:
   - **ChatGPT 구독 (추천, API 키 불필요)**: 호스트 PC에서 `npm i -g @openai/codex` → `codex login` (ChatGPT 계정 로그인). 서버가 자동 감지해서 **gpt-image-2**로 생성 — 구독 사용량에 포함, 별도 과금 없음.
   - **Gemini API 키**: [aistudio.google.com/apikey](https://aistudio.google.com/apikey) 무료 키 → `tools/gemini-key.txt`. 기본 모델 **나노바나나 2**(`gemini-3.1-flash-image-preview`), 계정에서 안 되면 `gemini-2.5-flash-image`(무료 티어)로 자동 폴백.
   - **OpenAI API 키**: `tools/openai-key.txt` (기본 `gpt-image-2`, API 과금)
   - 키 파일 2번째 줄에 모델명을 쓰면 교체 가능. 키 저장 후 서버 재시작 불필요. (Gemini 구독(Google AI Pro)은 아직 OAuth로 외부 이미지 생성을 지원하지 않아 API 키만 가능)
2. **🔍 무료 이미지 검색** — 키 없이도 동작(Openverse). `tools/pexels-key.txt`에 [Pexels API 키](https://www.pexels.com/api/)(무료)를 넣으면 Pexels로 업그레이드.
3. **직접 업로드 / 🎲 기본 풀 셔플**

## 구조
- `editor/` — 에디터(단일 HTML) + `assets/`(배경 이미지 풀) + `decks/`(샘플 덱 JSON)
- `tools/server.js` — 로컬 AI 브리지 + 정적 서빙 + Pexels 프록시
- `tools/deck-prompt.md` — AI 변환 지시문
- `templates/`, `series/` — 디자인 시스템 템플릿 / 사전 제작 덱
- `render.sh` — 헤드리스 Chrome 일괄 PNG 렌더(보조)
