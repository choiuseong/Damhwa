// [변경] 새 파일: 예약 메시지를 10초마다 확인해 보냄
import type { Pool } from "pg";
import type { ChatService } from "./service";

/**
 * 예약 전송 처리기: 10초마다 보낼 시간이 된 예약을 찾아 실제 메시지로 보냄.
 * - 보내기 직전에 'sending' 으로 바꿔 두 번 보내지 않게 하고,
 *   메시지 clientId 를 "sch-<예약id>" 로 써서 서버가 중간에 꺼졌다 켜져도 한 번만 저장됨
 * - 그 사이 방을 나갔으면 보내지 않고 취소
 */
export function createScheduler(pool: Pool, service: ChatService) {
  let timer: ReturnType<typeof setInterval> | null = null;
  let running = false;

  async function runDue(): Promise<number> {
    if (running) return 0;
    running = true;
    let sent = 0;
    try {
      // 서버가 보내는 도중 꺼져서 'sending' 으로 남은 예약은 다시 시도
      // 시간 비교는 DB 시계가 아니라 서버(Node) 시각으로: 예약 저장도 같은 방식이라 DB 시간대가 달라도 어긋나지 않음
      const now = new Date();
      await pool.query(
        `UPDATE "chat_scheduled" SET "status" = 'pending'
          WHERE "status" = 'sending' AND "sendAt" < $1`, [new Date(now.getTime() - 60_000)]);
      const { rows } = await pool.query(
        `UPDATE "chat_scheduled" SET "status" = 'sending'
          WHERE "id" IN (SELECT "id" FROM "chat_scheduled"
                          WHERE "status" = 'pending' AND "sendAt" <= $1
                          ORDER BY "sendAt" LIMIT 50)
        RETURNING "id", "roomId", "userId", "text"`, [now]);
      for (const s of rows) {
        try {
          // 참여 확인과 저장을 한 번에 (그 사이에 방을 나가면 보내지 않음)
          const sent1 = await service.insertMessage(s.roomId, String(s.userId), s.text, "text", `sch-${s.id}`, { onlyIfMember: true });
          if (!sent1) {
            await pool.query(`UPDATE "chat_scheduled" SET "status" = 'canceled' WHERE "id" = $1`, [s.id]);
            continue;
          }
          const { row } = sent1;
          await pool.query(`UPDATE "chat_scheduled" SET "status" = 'sent', "messageId" = $2 WHERE "id" = $1`, [s.id, row.id]);
          sent++;
        } catch (e) {
          console.error("[chat-scheduler] 예약 전송 실패, 다음에 다시 시도", (e as { code?: string })?.code ?? "");
          await pool.query(`UPDATE "chat_scheduled" SET "status" = 'pending' WHERE "id" = $1`, [s.id]).catch(() => {});
        }
      }
    } catch (e) {
      console.error("[chat-scheduler]", (e as { code?: string })?.code ?? "");
    } finally {
      running = false;
    }
    return sent;
  }

  return {
    runDue,
    start(intervalMs = 10_000) {
      if (timer) return;
      timer = setInterval(() => { void runDue(); }, intervalMs);
      timer.unref();
    },
    stop() {
      if (timer) clearInterval(timer);
      timer = null;
    },
  };
}
