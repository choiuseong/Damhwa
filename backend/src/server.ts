// [변경] http 서버 + WebSocket(/ws) 연결, 채팅 테이블 확인, 예약 전송 시작, 0.0.0.0 으로 열기
import { createServer } from "node:http";
import app, { chat } from "./app";

const PORT = Number(process.env.PORT) || 3000;
const server = createServer(app);

// 사이버 경로당 실시간 연결 (ws://<PC주소>:3000/ws)
chat.attach(server);

chat
  .ensureSchema()
  .then(() => {
    // 예약 메시지 전송 시작 (10초마다 확인)
    chat.startScheduler();
    // 0.0.0.0: 같은 와이파이의 휴대폰에서도 접속할 수 있게
    server.listen(PORT, "0.0.0.0", () => {
      console.log(`Damhwa backend running on port ${PORT}`);
      console.log(`사이버 경로당 WebSocket: ws://localhost:${PORT}/ws`);
    });
  })
  .catch((error: { code?: string; message?: string }) => {
    console.error("DB 에 연결하지 못했어요. DB 가 켜져 있는지, backend/.env 의 DATABASE_URL 을 확인해 주세요.");
    console.error(error?.code ?? "", error?.message ?? "");
    process.exit(1);
  });
