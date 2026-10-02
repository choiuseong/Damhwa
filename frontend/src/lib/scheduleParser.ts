import type { ScheduleCategory, ScheduleItem } from '../types';
import { makeId } from './format';

/**
 * 대화 텍스트에서 시간·할 일을 뽑는 간단한 규칙 기반 파서 (서버가 없을 때의 데모/오프라인용).
 * 서버가 있으면 서버의 자연어 일정 처리 결과(pending_schedules)를 그대로 사용합니다.
 */

interface Rule {
  keywords: string[];
  label: string;
  category: ScheduleCategory;
}

const RULES: Rule[] = [
  { keywords: ['치과'], label: '치과', category: '병원' },
  { keywords: ['병원', '진료', '검진', '약국', '한의원'], label: '병원 방문', category: '병원' },
  { keywords: ['쇼핑', '백화점', '마트', '시장'], label: '쇼핑', category: '외출/쇼핑' },
  { keywords: ['경로당'], label: '경로당 방문', category: '경로당 방문' },
  { keywords: ['산책', '운동', '등산'], label: '산책', category: '외출/쇼핑' },
  { keywords: ['미용실'], label: '미용실', category: '외출/쇼핑' },
  { keywords: ['은행'], label: '은행', category: '외출/쇼핑' },
  { keywords: ['생일'], label: '생일', category: '일정' },
  { keywords: ['점심', '식사', '외식'], label: '식사 약속', category: '일정' },
];

const PLACE_WORDS = ['백화점', '마트', '시장', '치과', '병원', '약국', '한의원', '경로당', '미용실', '은행'];
const WEEKDAYS = ['일', '월', '화', '수', '목', '금', '토'];
const COMPANIONS: [string, string][] = [
  ['딸', '딸과 '],
  ['아들', '아들과 '],
  ['친구', '친구와 '],
  ['손주', '손주와 '],
  ['손자', '손주와 '],
  ['손녀', '손주와 '],
];

/** "오후 3시 30분", "10시", "아침 9시 반" */
export function extractTime(s: string): { h: number; m: number } | null {
  const match = /(오전|오후|아침|저녁|낮)?\s*(\d{1,2})\s*시\s*(?:(반)|(\d{1,2})\s*분)?/.exec(s);
  if (!match) return null;
  let hour = parseInt(match[2], 10);
  if (Number.isNaN(hour) || hour > 24) return null;
  const meridiem = match[1];
  let minute = 0;
  if (match[3] === '반') minute = 30;
  else if (match[4]) minute = parseInt(match[4], 10);

  if (meridiem === '오후' || meridiem === '저녁') {
    if (hour < 12) hour += 12;
  } else if (meridiem === '낮') {
    if (hour <= 5) hour += 12;
  } else if (!meridiem && hour >= 1 && hour <= 6) {
    hour += 12; // 오전/오후 언급이 없으면 1~6시는 오후로 간주
  }
  return { h: hour % 24, m: minute };
}

/** "10월 3일", "10/3", "3일", "다음주 금요일", "내일" → 그 날짜(자정). 없으면 null */
export function extractDay(s: string, now: Date = new Date()): Date | null {
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const withYear = (m: number, d: number) => {
    const date = new Date(today.getFullYear(), m - 1, d);
    if (date < today) date.setFullYear(date.getFullYear() + 1); // 지난 날짜면 내년
    return date;
  };
  const md = /(\d{1,2})\s*월\s*(\d{1,2})\s*일/.exec(s) ?? /(?:^|\s)(\d{1,2})\/(\d{1,2})(?!\d)/.exec(s);
  if (md) {
    const m = parseInt(md[1], 10);
    const d = parseInt(md[2], 10);
    if (m >= 1 && m <= 12 && d >= 1 && d <= 31) return withYear(m, d);
  }
  const dOnly = /(\d{1,2})\s*일(?!\s*(?:동안|간))/.exec(s);
  if (dOnly) {
    const d = parseInt(dOnly[1], 10);
    if (d >= 1 && d <= 31) {
      const date = new Date(today.getFullYear(), today.getMonth(), d);
      if (date < today) date.setMonth(date.getMonth() + 1);
      return date;
    }
  }
  const wd = /(다음\s*주|이번\s*주)?\s*([일월화수목금토])요일/.exec(s);
  if (wd) {
    // 한 주는 월요일부터: '이번 주/다음 주 ○요일'은 그 주의 요일, 그냥 '○요일'은 오늘 이후 가장 가까운 날
    const mondayIdx = (d: number) => (d + 6) % 7;
    const target = WEEKDAYS.indexOf(wd[2]);
    const date = new Date(today);
    if (wd[1]) {
      const weekShift = wd[1].startsWith('다음') ? 7 : 0;
      date.setDate(today.getDate() - mondayIdx(today.getDay()) + weekShift + mondayIdx(target));
    } else {
      date.setDate(today.getDate() + ((target - today.getDay() + 7) % 7));
    }
    return date;
  }
  const offset = s.includes('모레') ? 2 : s.includes('내일') ? 1 : s.includes('오늘') ? 0 : null;
  if (offset === null) return null;
  const date = new Date(today);
  date.setDate(today.getDate() + offset);
  return date;
}

export function parseSchedules(text: string, now: Date = new Date()): ScheduleItem[] {
  const clauses = text.replace(/그리고/g, '.').split(/[.,!?\n]/);
  const items: ScheduleItem[] = [];
  let lastTime: { h: number; m: number } | null = null;
  let lastDay = new Date(now.getFullYear(), now.getMonth(), now.getDate());

  for (const raw of clauses) {
    const c = raw.trim();
    if (!c) continue;

    const t = extractTime(c);
    if (t) lastTime = t;
    const day = extractDay(c, now);
    if (day) lastDay = day;

    const matched = new Set<ScheduleCategory>();
    for (const rule of RULES) {
      if (!rule.keywords.some((k) => c.includes(k))) continue;
      if (matched.has(rule.category)) continue; // '치과 병원' 을 두 번 잡지 않도록
      matched.add(rule.category);
      const time = lastTime ?? (c.includes('점심') ? { h: 12, m: 0 } : c.includes('저녁') ? { h: 18, m: 0 } : { h: 10, m: 0 });
      const date = new Date(lastDay);
      date.setHours(time.h, time.m, 0, 0);

      const prefix = COMPANIONS.find(([k]) => c.includes(k))?.[1] ?? '';
      const title = prefix + rule.label + (c.includes('예약') && !rule.label.includes('약속') ? ' 예약' : '');
      const place = PLACE_WORDS.find((p) => c.includes(p));
      const iso = date.toISOString();

      if (!items.some((i) => i.title === title && i.date === iso)) {
        items.push({ id: makeId(), title, place, category: rule.category, date: iso });
      }
    }
  }
  return items.sort((a, b) => a.date.localeCompare(b.date));
}
