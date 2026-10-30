// [변경] 새 파일: 설치 없이 쓰는 내장 DB(PGlite), 마이그레이션 자동 적용, 시연용 사용자 1번
/**
 * 설치 없이 쓰는 내장 DB (PGlite: PostgreSQL 을 그대로 담은 가벼운 DB)
 *
 *   npm run db:local
 *
 * - backend/.localdb 폴더에 데이터를 저장합니다. (껐다 켜도 남아 있음, 지우면 초기화)
 * - 처음 켤 때 prisma/migrations 의 SQL 을 순서대로 적용합니다.
 * - 이 창은 켜 둔 채로, 다른 명령 프롬프트에서 npm run dev 로 서버를 실행하세요.
 * - backend/.env 의 DATABASE_URL=postgresql://postgres:postgres@127.0.0.1:5432/postgres
 */
import { readdirSync, readFileSync, existsSync } from "node:fs";
import path from "node:path";
import { PGlite } from "@electric-sql/pglite";
import { PGLiteSocketServer } from "@electric-sql/pglite-socket";

const ROOT = path.join(__dirname, "..");
const DATA_DIR = path.join(ROOT, ".localdb");
const MIGRATIONS = path.join(ROOT, "prisma", "migrations");
const PORT = Number(process.env.LOCAL_DB_PORT) || 5432;

async function main() {
  const db = await PGlite.create(DATA_DIR);

  await db.exec(`CREATE TABLE IF NOT EXISTS "_damhwa_local_migrations" (
    "name" TEXT PRIMARY KEY, "appliedAt" TIMESTAMP NOT NULL DEFAULT now())`);
  const done = new Set(
    (await db.query<{ name: string }>(`SELECT "name" FROM "_damhwa_local_migrations"`)).rows.map((r) => r.name),
  );
  const dirs = readdirSync(MIGRATIONS, { withFileTypes: true })
    .filter((d) => d.isDirectory() && existsSync(path.join(MIGRATIONS, d.name, "migration.sql")))
    .map((d) => d.name)
    .sort();
  for (const name of dirs) {
    if (done.has(name)) continue;
    await db.transaction(async (tx) => {
      await tx.exec(readFileSync(path.join(MIGRATIONS, name, "migration.sql"), "utf8"));
      await tx.query(`INSERT INTO "_damhwa_local_migrations" ("name") VALUES ($1)`, [name]);
    });
    console.log(`  적용: ${name}`);
  }

  // 앱의 다른 화면(음성대화·일정·기록)은 아직 userId '1' 로 고정돼 있어서, 시연용 1번 사용자를 만들어 둠
  await db.exec(`INSERT INTO "users" ("id", "name", "updatedAt") VALUES (1, '시연 어르신', now()) ON CONFLICT ("id") DO NOTHING;
    SELECT setval(pg_get_serial_sequence('"users"', 'id'), GREATEST((SELECT MAX("id") FROM "users"), 1));`);

  const server = new PGLiteSocketServer({ db, port: PORT, host: "127.0.0.1", maxConnections: 30 });
  await server.start();
  console.log("");
  console.log(`내장 DB 실행 중 (127.0.0.1:${PORT}). 이 창은 닫지 마세요. 끄려면 Ctrl + C`);
  console.log(`backend/.env → DATABASE_URL=postgresql://postgres:postgres@127.0.0.1:${PORT}/postgres`);

  let stopping = false;
  const stop = async () => {
    if (stopping) return;
    stopping = true;
    console.log("내장 DB 를 끄는 중…");
    try { await server.stop(); } catch { /* ignore */ }
    await new Promise((r) => setTimeout(r, 300)); // 남은 연결 정리 대기
    try { await db.close(); } catch { /* ignore */ }
    process.exit(0);
  };
  process.on("SIGINT", stop);
  process.on("SIGTERM", stop);
}

main().catch((e: { code?: string; message?: string }) => {
  if (e?.code === "EADDRINUSE") {
    console.error(`${PORT}번 포트를 이미 쓰고 있어요. Docker PostgreSQL 이 켜져 있으면 끄거나, LOCAL_DB_PORT 로 다른 포트를 쓰세요.`);
  } else {
    console.error("내장 DB 를 시작하지 못했어요:", e?.message ?? e);
  }
  process.exit(1);
});
