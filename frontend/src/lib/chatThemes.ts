// [변경] 새 파일: 채팅방 테마 6가지
/**
 * 채팅방 꾸미기 (나에게만 적용, 방마다 따로 저장)
 * 'basic' 은 원래 화면과 똑같은 색입니다.
 */
export type ChatThemeKey = 'basic' | 'apricot' | 'green' | 'sky' | 'night' | 'contrast';

export interface ChatTheme {
  key: ChatThemeKey;
  label: string;
  /** 채팅 배경 */
  background: string;
  /** 내 말풍선 / 이웃 말풍선 */
  mine: string;
  other: string;
  /** 말풍선 글자색, 이름·시간 같은 보조 글자색 */
  text: string;
  subText: string;
  /** 이웃 말풍선 테두리 (고대비용) */
  otherBorder?: string;
  /** 말풍선 글자를 더 크게 */
  bigText?: boolean;
}

export const CHAT_THEMES: ChatTheme[] = [
  { key: 'basic', label: '기본', background: '#FFFFFF', mine: '#FCEBD9', other: '#F2F2F4', text: '#2C1C14', subText: '#61616B' },
  { key: 'apricot', label: '살구', background: '#FFF4EA', mine: '#FAD3AE', other: '#FFFFFF', text: '#2C1C14', subText: '#7A5A45' },
  { key: 'green', label: '연두', background: '#EEF7EC', mine: '#CDEBC7', other: '#FFFFFF', text: '#1F2E1C', subText: '#4E6B48' },
  { key: 'sky', label: '하늘', background: '#EAF3FB', mine: '#CFE3F7', other: '#FFFFFF', text: '#1B2A3A', subText: '#4A6278' },
  { key: 'night', label: '밤', background: '#1F1B18', mine: '#8A5A3A', other: '#3A3330', text: '#F5EDE6', subText: '#C9B9AC' },
  { key: 'contrast', label: '크게·선명하게', background: '#FFFFFF', mine: '#FFE08A', other: '#FFFFFF', text: '#000000', subText: '#000000', otherBorder: '#000000', bigText: true },
];

export function chatTheme(key: ChatThemeKey | undefined): ChatTheme {
  return CHAT_THEMES.find((t) => t.key === key) ?? CHAT_THEMES[0];
}
