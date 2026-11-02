// [변경] 새 파일: 이모티콘·스티커 목록
/**
 * 이모티콘·스티커 목록
 * - 이모티콘: 글 입력칸에 넣어 함께 보냄
 * - 스티커: 누르면 바로 크게 보냄 (백엔드 src/chat/shapes.ts 의 STICKERS 와 같아야 함)
 */
export const EMOJI_GROUPS: { label: string; items: string[] }[] = [
  { label: '표정', items: ['😊', '😄', '😂', '🥰', '😍', '😉', '🙂', '😌', '🤗', '🥲', '😢', '😭', '😮', '😴', '🤔', '😅'] },
  { label: '인사·마음', items: ['👋', '🙏', '👍', '👏', '🙌', '💪', '🤝', '❤️', '💕', '💐', '🌹', '🎉', '🎂', '🙆', '🙅', '✌️'] },
  { label: '음식', items: ['🍚', '🍜', '🍲', '🥟', '🍙', '🍎', '🍊', '🍉', '🍓', '🍞', '☕', '🍵', '🥛', '🍶', '🍺', '🥗'] },
  { label: '날씨·자연', items: ['🌞', '⛅', '🌧️', '❄️', '🌈', '🌸', '🌻', '🍁', '🌳', '🌙', '⭐', '🔥', '💧', '🐶', '🐱', '🐦'] },
  { label: '생활', items: ['🏥', '💊', '🚶', '🚌', '🏠', '📞', '📺', '📰', '🛒', '💰', '⛪', '🎵', '📷', '⏰', '📅', '✅'] },
];

export const STICKERS: { emoji: string; label: string }[] = [
  { emoji: '👍', label: '좋아요' },
  { emoji: '👏', label: '박수' },
  { emoji: '🙏', label: '고마워요' },
  { emoji: '😊', label: '반가워요' },
  { emoji: '😂', label: '하하' },
  { emoji: '🥰', label: '사랑해요' },
  { emoji: '😢', label: '슬퍼요' },
  { emoji: '😮', label: '깜짝' },
  { emoji: '🎉', label: '축하해요' },
  { emoji: '💐', label: '꽃 선물' },
  { emoji: '☕', label: '차 한잔' },
  { emoji: '🍚', label: '식사하셨어요' },
  { emoji: '🌞', label: '좋은 아침' },
  { emoji: '🌧️', label: '비 와요' },
  { emoji: '❤️', label: '하트' },
  { emoji: '🙆', label: '좋아요(동그라미)' },
  { emoji: '🙅', label: '안 돼요' },
  { emoji: '💪', label: '힘내요' },
  { emoji: '👋', label: '안녕' },
  { emoji: '🌸', label: '꽃' },
];
