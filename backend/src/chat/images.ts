// [변경] 새 파일: 사진 저장·확인(진짜 사진만, 5MB)
import { randomUUID } from "node:crypto";
import { mkdirSync } from "node:fs";
import { unlink, writeFile } from "node:fs/promises";
import path from "node:path";

/** 사진 저장 폴더 (기본: backend/uploads, CHAT_UPLOAD_DIR 로 바꿀 수 있음) */
export function uploadDir(): string {
  const dir = process.env.CHAT_UPLOAD_DIR || path.join(__dirname, "../../uploads");
  mkdirSync(dir, { recursive: true });
  return dir;
}

/** 사진 최대 크기 (5MB) */
export const MAX_IMAGE_BYTES = 5 * 1024 * 1024;

/** 파일 앞부분(매직 넘버)으로 진짜 사진인지 확인. 확장자나 Content-Type 은 믿지 않음 */
export function detectImage(buf: Buffer): "jpg" | "png" | "webp" | "gif" | null {
  if (buf.length < 12) return null;
  if (buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) return "jpg";
  if (buf.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) return "png";
  if (buf.subarray(0, 4).toString("ascii") === "RIFF" && buf.subarray(8, 12).toString("ascii") === "WEBP") return "webp";
  if (buf.subarray(0, 6).toString("ascii") === "GIF87a" || buf.subarray(0, 6).toString("ascii") === "GIF89a") return "gif";
  return null;
}

/** 무작위 이름으로 저장하고 앱이 쓸 주소(/uploads/파일명)를 돌려줌 */
export async function saveImage(buf: Buffer, ext: string): Promise<string> {
  const name = `${randomUUID()}.${ext}`;
  await writeFile(path.join(uploadDir(), name), buf);
  return `/uploads/${name}`;
}

/** 모두에게 삭제한 사진 파일 지우기 */
export async function removeImage(urlPath: string): Promise<void> {
  const name = path.basename(urlPath);
  if (!/^[0-9a-f-]{36}\.(jpg|png|webp|gif)$/.test(name)) return;
  await unlink(path.join(uploadDir(), name)).catch(() => {});
}
