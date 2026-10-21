/**
 * 화면 미리보기 모드(EXPO_PUBLIC_PREVIEW_MODE=true) 전용 가짜 데이터.
 * 실제 기능에 연결할 때는 이 파일을 쓰는 곳(PREVIEW_MODE 분기)만 지나가지 않게 되므로
 * 이 파일 자체는 지워도 되고 남겨 두어도 됩니다.
 * 날짜는 '오늘' 기준 상대값으로 만들어서 언제 실행해도 미래 일정으로 보입니다.
 */
import type { ChatMessage, ConversationRecord, ScheduleItem, TranscriptTurn } from '../types';

function at(dayOffset: number, hour: number, minute = 0): string {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth(), now.getDate() + dayOffset, hour, minute).toISOString();
}

/** 대화에서 '추출된' 일정 3개 */
export function previewSchedules(): ScheduleItem[] {
  return [
    { id: 'preview-s1', title: '치과 예약', place: '치과', category: '병원', date: at(1, 15, 0) },
    { id: 'preview-s2', title: '경로당 방문', place: '경로당', category: '경로당 방문', date: at(2, 10, 30) },
    { id: 'preview-s3', title: '딸과 쇼핑', place: '백화점', category: '외출/쇼핑', date: at(4, 14, 0) },
  ];
}

export const PREVIEW_TRANSCRIPT: TranscriptTurn[] = [
  { role: 'assistant', text: '안녕하세요! 오늘 하루는 어떠셨어요?' },
  { role: 'user', text: '아침에 공원에서 산책했어요. 날이 좋더라고요.' },
  { role: 'assistant', text: '좋으셨겠어요. 요즘 다른 계획도 있으세요?' },
  { role: 'user', text: '내일 오후 3시에 치과 예약이 있어요.' },
  { role: 'assistant', text: '내일 오후 3시 치과요. 잊지 않게 알려드릴게요.' },
  { role: 'user', text: '모레 오전 10시 반에는 경로당에 가고, 금요일엔 딸이랑 백화점 가요.' },
  { role: 'assistant', text: '바쁘시네요! 일정 모두 정리해 둘게요.' },
];

/** AI 대화 요약 예시 (실제로는 서버/AI 가 만들어야 하는 부분) */
export const PREVIEW_SUMMARY =
  '아침 공원 산책으로 기분 좋은 하루를 보내셨어요. 내일 치과 예약, 모레 경로당 방문, 딸과의 쇼핑 약속이 있어요.';

export function previewRecords(): ConversationRecord[] {
  const s = previewSchedules();
  return [
    { id: 'preview-r1', date: at(0, 9, 20), summary: PREVIEW_SUMMARY, items: s, transcript: PREVIEW_TRANSCRIPT },
    {
      id: 'preview-r2',
      date: at(-1, 19, 5),
      summary: '손주가 놀러 와서 함께 저녁을 드셨대요. 조금 피곤하지만 즐거운 하루였어요.',
      items: [],
      transcript: [
        { role: 'assistant', text: '편안한 저녁이에요. 오늘은 어떤 일이 있었어요?' },
        { role: 'user', text: '손주가 놀러 와서 같이 저녁 먹었어요.' },
        { role: 'assistant', text: '정말 좋으셨겠어요! 무엇을 드셨어요?' },
        { role: 'user', text: '된장찌개요. 조금 피곤하네요.' },
      ],
    },
  ];
}

/** 동네 채팅(사이버 경로당) 미리보기 메시지. 방 id 별로 다르게 보여줍니다. */
export function previewMessages(roomId: string): ChatMessage[] {
  const t = (minAgo: number) => new Date(Date.now() - minAgo * 60_000).toISOString();
  const base: ChatMessage[] = [
    { id: `${roomId}-p1`, text: '안녕하세요! 오늘 날씨가 참 좋네요.', sender: '김순자 님', isMine: false, createdAt: t(42) },
    { id: `${roomId}-p2`, text: '오후에 공원 한 바퀴 같이 걸으실 분 계세요?', sender: '박영철 님', isMine: false, createdAt: t(30) },
    { id: `${roomId}-p3`, text: '저요! 3시에 정자 앞에서 만나요.', sender: '나', isMine: true, createdAt: t(25) },
    { id: `${roomId}-p4`, text: '경로당에서 내일 윷놀이 한대요. 많이들 오세요~', sender: '이말순 님', isMine: false, createdAt: t(12) },
    { id: `${roomId}-p5`, text: '좋은 정보 고마워요. 꼭 갈게요.', sender: '박영철 님', isMine: false, createdAt: t(5) },
  ];
  if (roomId === 'room-news') {
    base.unshift({ id: `${roomId}-p0`, text: '오늘 신문에 기초연금 안내가 나왔어요.', sender: '최상호 님', isMine: false, createdAt: t(60) });
  }
  return base;
}

/** 매일 안부 알림 예시 (실제로는 기기 로컬 알림으로 뜸) */
export const PREVIEW_CHECKIN = {
  title: '다마가 안부를 여쭤요',
  body: '오늘 하루는 어떠세요? 이야기 들려주세요.',
};

/** 위치 미리보기: 안양시청 부근 (실제 GPS 를 쓰지 않음) */
export const PREVIEW_COORDS = { lat: 37.394, lng: 126.957 };
export const PREVIEW_PLACE = '안양시 동안구';
