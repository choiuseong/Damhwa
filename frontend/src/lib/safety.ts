// [변경] 새 파일: 사기 의심 글 알아보기 (전화번호·주소·계좌·돈 이야기)
/**
 * 사기 의심 글 알아보기 (이웃의 글 아래에 '조심하세요' 표시)
 * 전화번호·인터넷 주소·계좌번호, 또는 돈·개인정보를 요구하는 말이 있으면 true
 */
const PHONE = /(01[016789]|0\d{1,2})[-.\s]?\d{3,4}[-.\s]?\d{4}/;
const URL = /(https?:\/\/|www\.)\S+|\b[a-z0-9-]+\.(com|net|kr|co|io|me|ly|site|xyz|shop|link)\b/i;
const ACCOUNT = /\d{2,6}-\d{2,6}-\d{2,8}/;
const MONEY_WORDS = [
  '송금', '입금', '이체', '계좌', '대출', '환급', '지원금', '투자', '수익', '고수익', '원금', '코인',
  '당첨', '상품권', '인증번호', '비밀번호', '주민번호', '주민등록번호', '카드번호', '보증금', '수수료', '급전',
];

export function looksRisky(text: string): boolean {
  if (!text) return false;
  const t = text.replace(/\s+/g, ' ');
  if (PHONE.test(t) || URL.test(t) || ACCOUNT.test(t)) return true;
  return MONEY_WORDS.some((w) => t.includes(w));
}
