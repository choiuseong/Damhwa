담화 DEMO + 4차 통합본 (수정판)

변경사항
- ZIP 루트 이름 DamhwaMerged (영문 전용)로 고정: PGlite 데이터 파일 탐색 시 Windows의 % 인코딩 경로 문제 방지.
- DB/BACKEND/FRONTEND 시작 배치 및 사전 검사 추가.
- demo 원본의 realtime.config.ts, realtime.routes.ts, 알림/음성 파일은 유지.
- 4차 채팅 서비스, HTTP 라우트, WebSocket, Prisma 마이그레이션, UI 파일 통합.

설치
1. ZIP을 C:\ 에 압축 해제해 C:\DamhwaMerged\backend\package.json 인지 확인하세요.
   이전 C:\Damhwa 경로와 혼동하지 마세요.
2. CHECK_WINDOWS.cmd 실행해 FILE CHECK PASS 확인.
3. START_DB.cmd 실행 후 종료하지 마세요. (최초 npm ci 필요. pglite.data 존재 확인)
4. START_BACKEND.cmd 실행 후 종료하지 마세요. http://localhost:3000/health -> {"status":"ok"}
5. CMD에서 ipconfig로 실제 IPv4 확인. frontend/.env에 EXPO_PUBLIC_API_URL=http://PC_IPV4:3000 설정.
6. START_FRONTEND.cmd 실행; 웹은 터미널에서 w. 휴대폰은 같은 Wi-Fi 연결.

중요 사항
- 4차와 demo의 기능 보존/라우팅을 정적 점검한 소스 통합본이며 기기 간 실시간 테스트와 전체 빌드는 통과 검증된 상태가 아닙니다.
- 원본 DB를 덮어쓰지 마세요. 기존 앱 데이터는 백업 후 사용하세요.
- Expo Go는 react-native-webrtc 등 네이티브 모듈을 지원하지 않아 앱이 튕길 수 있습니다.
- OPENAI_API_KEY는 backend/.env에만 적으세요.
- npm ci가 실패하면 로그를 확인하세요. 손상된 node_modules를 복사해서 실행하지 마세요.
