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

## 백엔드와 맞춰야 할 부분 — `src/api/index.ts`
프론트에서 **가정한** 계약입니다. 실제 명세와 다르면 이 파일만 고치면 됩니다.

| 용도 | 요청 | 응답 |
|---|---|---|
| Realtime 임시 키 | `POST /realtime/session` | `{ clientSecret }` (서버가 OpenAI `POST /v1/realtime/client_secrets` 호출) |
| 대화 종료·일정 추출 | `POST /conversations/end` `{ transcript }` | `{ summary, pending: ScheduleItem[] }` |
| 일정 확정 / 삭제 | `POST /schedules/confirm`, `DELETE /schedules/:id` | 204 |
| 채팅방 | `GET /rooms?lat&lng&radiusKm=2`, `POST /rooms` | `ChatRoom[]` / `ChatRoom` |
| 채팅 메시지 | `GET /rooms/:id/messages?after=`, `POST /rooms/:id/messages` | `ChatMessage[]` / `ChatMessage` |
| 신고·차단 | `POST /rooms/:id/report`, `/block` | 204 |
| 푸시 토큰 | `POST /devices` `{ expoPushToken }` | 204 |

## 음성 대화 구조 — `src/voice`
- `openaiRealtimeClient.ts`: 백엔드에서 임시 키 → `RTCPeerConnection` + 마이크 트랙 + `oai-events` 데이터 채널 → `POST https://api.openai.com/v1/realtime/calls`(SDP) → 이벤트로 상태·자막 갱신. 연결되면 AI가 먼저 안부를 묻습니다.
- `mockRealtimeClient.ts`: 서버 없이 UI 확인용.
- `useVoiceSession.ts`: 화면이 쓰는 훅(상태, 자막, 전사 기록).
- 시스템 프롬프트·목소리·전사 설정은 임시 키를 발급하는 **백엔드에서 지정**하는 것을 전제로 했습니다.

## 아직 안 된 것 / 확인 필요
- 실기기에서 마이크·WebRTC 연결 테스트 (이 코드는 타입체크와 iOS 번들 빌드까지만 확인했고 기기에서는 실행해보지 못했습니다).
- 이웃과의 음성 통화(WebRTC 시그널링)는 UI 자리만 있고 미구현. 채팅은 REST 3초 폴링입니다.
- 마스코트는 뷰로 그린 임시 캐릭터입니다(`components/DamaMascot.tsx`) — 원본 이미지로 교체하세요.
- 앱 아이콘/스플래시는 Expo 기본 이미지입니다.
