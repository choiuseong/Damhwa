# 담화 (Damhwa) — Expo 앱 (프론트엔드)

"AI 기반 어르신 대화 케어 서비스" 발표자료의 UI를 옮긴 Expo(React Native, TypeScript) 앱입니다.
Expo SDK 57 · Expo Router · zustand. 리팩토링 자료의 **Realtime API(WebRTC) + REST** 구조에 맞춰 프론트 쪽 연결부를 만들어 두었습니다.

## 실행
```bash
npm install
npx expo start          # 터미널에서 s 키로 Expo Go ↔ 개발 빌드 전환
```
- **데모 모드(기본)**: `.env` 가 비어 있으면 서버 없이 동작합니다. Expo Go 에서 화면 흐름을 그대로 확인할 수 있어요.
  음성대화 화면 아래 입력창(글로 말하기)으로 대화를 흉내 냅니다.
- **실서버 모드**: `.env.example` 을 `.env` 로 복사하고 `EXPO_PUBLIC_API_URL=https://백엔드주소` 를 넣으면
  실제 음성대화(Realtime API)와 REST API 를 사용합니다. 이때는 네이티브 모듈(`react-native-webrtc`)이 필요해서 **개발 빌드**가 필요합니다.
  ```bash
  npx expo run:ios            # 로컬(Mac + Xcode)
  # 또는
  npx eas-cli@latest build --profile development --platform ios
  ```
  (`app.json` 의 `extra.eas.projectId` 는 `eas init` 후 채워집니다. 푸시 토큰 등록에 사용.)

## PPT → 화면 (src/app)
| PPT | 파일 |
|---|---|
| 담화 첫 화면(오른쪽 폰) | `onboarding.tsx` |
| 담화 첫 화면(왼쪽 폰, 피드) | `(tabs)/index.tsx` |
| 먼저 다가오는 AI · 대화 중 자동 일정 정리 | `voice.tsx` (듣는중/말하는중 + 정리 완료 팝업) |
| 일정 관리 | `schedule.tsx` |
| 함께하는 사이버 경로당 | `(tabs)/community.tsx`, `room/[id].tsx` |
| (추가) 기록, 설정 | `records.tsx`, `(tabs)/settings.tsx` |

## 수정본의 서버 연결

전체 적용 및 변경 목록은 루트 `README_FIXES.md`를 참고하세요.

| 용도 | 요청 |
|---|---|
| 익명 사용자 등록 | `POST /users` → `{ id, sessionToken }` |
| 음성 SDP 연결 | `POST /realtime/session` → SDP text |
| 대화 생성 | `POST /conversations` |
| 대화 메시지 저장·조회 | `POST/GET /conversations/:id/messages` |
| 일정 조회 | `GET /users/:userId/schedules` |
| 일정 일괄 저장 | `POST /users/:userId/schedules/confirm` → 서버 ID를 포함한 일정 배열 |
| 일정 삭제 | `DELETE /users/:userId/schedules/:scheduleId` |
| 방 목록·생성 | `GET/POST /rooms` |
| 메시지 목록·전송 | `GET/POST /rooms/:id/messages` |
| 신고·차단 | `POST /rooms/:id/report`, `/block` (messageId 필수) |
| 푸시 토큰 저장 | `POST /devices` |

사용자 등록 외 요청에는 앱이 자동으로 `Authorization: Bearer <sessionToken>`을 추가합니다.
대화 결과는 사용자 발언 일부와 로컬 규칙 기반 일정 후보이며 `/conversations/end`는 호출하지 않습니다.
서버의 Realtime 라우트는 SDP를 OpenAI에 전달하고, 반환된 SDP를 앱 WebRTC 연결에 적용합니다.

## 실기기 확인 필요

마이크·스피커·실제 음성 연결과 알림은 개발 빌드에서 확인하세요. 이웃 간 음성통화는 기존의 준비 중 안내를 유지합니다. EAS projectId와 푸시 토큰 등록은 프로젝트 설정이 필요하며 서버 푸시 발송기는 포함하지 않았습니다.

## 화면 미리보기 모드 (2026-10 추가)

서버·마이크·위치·알림·API 키 없이 웹 브라우저로 화면만 확인하는 모드입니다.

1. `frontend/.env`에 `EXPO_PUBLIC_PREVIEW_MODE=true` (끄려면 `false`)
2. `npm run preview` (= `expo start --web --clear`) → 브라우저에서 `http://localhost:8081`

`.env`를 바꾼 뒤에는 반드시 `--clear`로 다시 시작하세요. 캐시 때문에 이전 값이 남을 수 있습니다.
가짜 데이터는 `src/preview/mockData.ts`에 있고, `PREVIEW_MODE` 분기에서만 사용합니다.
