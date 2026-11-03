
import WebSocket from "ws";

const A = "device-aaaaaaaaaaaaaaaa";
const B = "device-bbbbbbbbbbbbbbbb";
const ROOM = "room-news";

const url = (device) =>
  `ws://localhost:3000/ws?deviceId=${device}`;

const wsA = new WebSocket(url(A));
const wsB = new WebSocket(url(B));

let joinedA = false;
let joinedB = false;
let sent = false;

function handleMessage(name, ws, raw) {
  const event = JSON.parse(raw.toString());

  console.log(`[${name}]`, event);

  if (event.type === "joined") {
    if (name === "A") joinedA = true;
    if (name === "B") joinedB = true;

    if (joinedA && joinedB && !sent) {
      sent = true;
      sendHttpMessage();
    }
  }

  if (
    name === "B" &&
    event.type === "message" &&
    event.message?.text === "WebSocket 실시간 테스트"
  ) {
    console.log("성공: B에게 실시간 메시지가 전달됐습니다.");
    wsA.close();
    wsB.close();
  }
}

async function sendHttpMessage() {
  const response = await fetch(
    `http://localhost:3000/rooms/${ROOM}/messages`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Device-Id": A,
      },
      body: JSON.stringify({
        text: "WebSocket 실시간 테스트",
        clientId: `ws-test-${Date.now()}`,
      }),
    }
  );

  console.log("HTTP 전송 결과:", response.status);
}

wsA.on("message", (raw) => handleMessage("A", wsA, raw));
wsB.on("message", (raw) => handleMessage("B", wsB, raw));

wsA.on("open", () => {
  console.log("A WebSocket 연결 성공");
  wsA.send(JSON.stringify({ type: "join", roomId: ROOM }));
});

wsB.on("open", () => {
  console.log("B WebSocket 연결 성공");
  wsB.send(JSON.stringify({ type: "join", roomId: ROOM }));
});

for (const [name, ws] of [["A", wsA], ["B", wsB]]) {
  ws.on("error", (err) => console.error(`${name} 오류:`, err.message));
}

setTimeout(() => {
  if (!sent) console.error("실패: 두 사용자의 방 입장이 완료되지 않았습니다.");
  else console.error("시간 초과: B의 실시간 메시지 수신을 확인하지 못했습니다.");

  wsA.close();
  wsB.close();
  process.exit(1);
}, 10000).unref();
