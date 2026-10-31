/** 지금 열려 있는 음성 대화. 일정 알림이 울리면 다마가 대화 중에 직접 말해 주도록 연결한다 */
type Announcer = (title: string, message: string) => void;

let current: Announcer | null = null;

export function setActiveAnnouncer(announcer: Announcer | null) {
  current = announcer;
}

/** 대화 중이면 다마에게 넘기고 true, 아니면 false */
export function announceToActiveSession(title: string, message: string): boolean {
  if (!current) return false;
  current(title, message);
  return true;
}
