/**
 * 오류 로그에 대화 내용·위치·토큰 같은 개인정보가 섞이지 않도록
 * 오류 이름과 코드, 짧은 메시지만 남깁니다. (Prisma 검증 오류는 입력값 전체를 메시지에 담기 때문)
 */
export function logError(label: string, error: unknown): void {
  const e = error as { name?: string; code?: string; status?: number; message?: string } | undefined;
  const bodyParseError = e?.name === 'SyntaxError' || (e as { type?: string } | undefined)?.type === 'entity.parse.failed';
  // JSON 파싱 오류 메시지에는 요청 본문(대화 내용) 일부가 들어가므로 버림
  const message = !bodyParseError && typeof e?.message === 'string' ? e.message.split('\n')[0].slice(0, 120) : '';
  console.error(`[${label}]`, e?.name ?? 'Error', e?.code ?? e?.status ?? '', message);
  if (process.env.NODE_ENV === 'development' && error instanceof Error) console.error(error.stack?.split('\n').slice(1, 4).join('\n'));
}
