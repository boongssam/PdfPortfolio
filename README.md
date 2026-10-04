# 활동지 AI 평가

학생 활동지 PDF를 업로드하면 Google Gemini가 텍스트로 변환(OCR)하고, 미리 입력한 평가 기준에 따라 수행평가 결과를 만들어 Firestore에 저장하는 웹앱입니다.

- **프레임워크**: Next.js 16 (App Router) + React 19 + TypeScript + Tailwind CSS
- **AI**: Gemini API (`@google/genai`), PDF를 그대로 보내서 OCR한 뒤, 평가는 JSON 스키마로 받음
- **로그인**: Firebase Authentication (Google 로그인)
- **DB**: Cloud Firestore (`users/{uid}/rubrics`, `users/{uid}/submissions`)
- **호스팅**: Firebase App Hosting (서버 API가 있는 Next.js 앱을 그대로 배포)

## 동작 흐름

```
[브라우저] PDF 업로드 ──▶ /api/ocr   ──▶ Gemini: PDF → 텍스트 (+이름/학번 추출)
          텍스트+기준 ──▶ /api/grade ──▶ Gemini: 항목별 점수·근거·피드백 (JSON)
          결과 저장   ──▶ Firestore users/{uid}/submissions
```

Gemini API 키는 서버(Route Handler)에서만 씁니다. API는 Firebase 로그인 토큰을 확인한 뒤에만 Gemini를 호출합니다.

## 폴더 구조

```
src/
  app/
    api/ocr/route.ts      PDF → 텍스트 (Gemini)
    api/grade/route.ts    텍스트 + 평가 기준 → 평가 결과 (Gemini)
    rubrics/              평가 기준 만들기/수정
    evaluate/             PDF 업로드 및 일괄 평가
    results/              결과 목록, CSV 내려받기
    results/[id]/         결과 상세: 점수·피드백 수정, OCR 텍스트 수정 후 재평가
  components/             로그인(AuthProvider), 헤더
  lib/
    gemini.ts             Gemini 프롬프트·스키마 (서버 전용)
    firebaseAdmin.ts      로그인 토큰 검증 (서버 전용)
    firebase.ts, db.ts    Firestore 읽기/쓰기 (브라우저)
    api.ts                브라우저 → API 호출
firestore.rules           교사별 데이터 접근 규칙
apphosting.yaml           App Hosting 환경변수·시크릿
```

## 1. Firebase 프로젝트 준비 (최초 1회)

1. [Firebase 콘솔](https://console.firebase.google.com)에서 프로젝트를 만듭니다.
2. **요금제를 Blaze(종량제)로 업그레이드**합니다. App Hosting을 쓰려면 필요합니다. 소규모 사용은 대부분 무료 한도 안에서 처리됩니다.
3. **Authentication → 로그인 방법 → Google**을 사용 설정합니다.
4. **Firestore Database**를 만듭니다. 위치는 `asia-northeast3`(서울)을 권장합니다.
5. **프로젝트 설정 → 내 앱 → 웹 앱 추가**를 누르고 표시되는 설정값(apiKey, authDomain, projectId, appId)을 복사합니다.
6. [Google AI Studio](https://aistudio.google.com/apikey)에서 Gemini API 키를 발급합니다.

## 2. 로컬에서 실행

```bash
npm install
cp .env.example .env.local   # 값 채우기
npm run dev                  # http://localhost:3000
```

## 3. Firebase에 배포

```bash
firebase login
firebase use --add                       # 위에서 만든 프로젝트 선택
firebase deploy --only firestore         # 보안 규칙 배포

# App Hosting 백엔드 생성 (최초 1회, 리전은 asia-east1 등 선택)
firebase apphosting:backends:create --backend pdf-eval

# Gemini API 키를 Secret Manager에 저장 (최초 1회)
firebase apphosting:secrets:set gemini-api-key
```

`apphosting.yaml`의 `YOUR_...` 값을 웹 앱 설정값으로 바꾼 뒤 배포합니다.

```bash
firebase deploy --only apphosting
```

배포가 끝나면 **Authentication → 설정 → 승인된 도메인**에 App Hosting 주소(`*.hosted.app`)가 있는지 확인하고, 없으면 추가합니다.

> GitHub 저장소를 App Hosting 백엔드에 연결하면 push할 때마다 자동으로 배포할 수도 있습니다.

## 선택 설정

| 환경변수 | 설명 |
| --- | --- |
| `GEMINI_MODEL` | 사용할 모델 (기본 `gemini-flash-latest`). 더 정밀한 채점이 필요하면 pro 모델로 바꿉니다. |
| `ALLOWED_EMAILS` | 쉼표로 구분한 이메일 목록. 설정하면 이 계정들만 Gemini API를 쓸 수 있어서 다른 사람이 API 비용을 쓰지 못하게 막습니다. |

## 참고

- PDF는 파일당 15MB까지 올릴 수 있습니다. Gemini 인라인 전송 한도 때문입니다. 원본 PDF는 저장하지 않고 변환된 텍스트와 평가 결과만 저장합니다.
- OCR 결과에서 `▶`로 시작하는 줄은 학생이 작성한 답변입니다. 채점은 이 줄들을 근거로 합니다.
- AI 채점은 초안입니다. 결과 상세 화면에서 점수와 피드백을 고치면 "교사 수정" 표시가 붙습니다.
- 학생 개인정보(이름·답안)가 Gemini API로 전송됩니다. 유료 등급 API 키를 쓰면 입력 데이터가 모델 학습에 사용되지 않습니다. 학교·교육청 개인정보 지침을 확인해 주세요.
