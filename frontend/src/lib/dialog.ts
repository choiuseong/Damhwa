// [변경] 새 파일: 안내창 (웹·휴대폰 공통)
import { Alert, Platform } from 'react-native';

/**
 * 안내창. Alert.alert 와 같은 모양으로 부릅니다.
 * - 휴대폰: 시스템 Alert 그대로 (디자인 변경 없음)
 *   · Android 시스템 창은 버튼이 3개까지만 보여서, 버튼이 많으면 "다른 항목 보기"로 나눠 보여줍니다.
 *     (첫 창은 뒤로가기나 창 바깥을 누르면 닫힘)
 * - 웹(PC 브라우저 시연): Alert.alert 가 아무것도 띄우지 않아서, 앱 안의 창(components/DialogHost.tsx)으로 보여줍니다.
 */
export interface DialogButton {
  text: string;
  style?: 'default' | 'cancel' | 'destructive';
  onPress?: () => void;
}

export interface DialogRequest {
  id: number;
  title: string;
  message?: string;
  buttons: DialogButton[];
}

type Listener = (req: DialogRequest | null) => void;
let listener: Listener | null = null;
let queue: DialogRequest[] = [];
let seq = 0;

export function subscribeDialog(fn: Listener): () => void {
  listener = fn;
  fn(queue[0] ?? null);
  return () => {
    if (listener === fn) listener = null;
  };
}

export function showDialog(title: string, message?: string, buttons?: DialogButton[]): void {
  const list = buttons?.length ? buttons : [{ text: '확인' }];
  if (Platform.OS === 'web') {
    queue.push({ id: ++seq, title, message, buttons: list });
    if (queue.length === 1) listener?.(queue[0]);
    return;
  }
  if (Platform.OS === 'android' && list.length > 3) {
    // [선택1, 선택2, 더보기] → 나머지 + 취소
    const cancel = list.find((b) => b.style === 'cancel');
    const actions = list.filter((b) => b.style !== 'cancel');
    const rest = actions.slice(2);
    Alert.alert(title, message, [
      ...actions.slice(0, 2),
      { text: '다른 항목 보기', onPress: () => showDialog(title, message, [...rest, ...(cancel ? [cancel] : [])]) },
    ], { cancelable: true });
    return;
  }
  Alert.alert(title, message, list, { cancelable: true });
}

/** 웹 안내창 버튼을 눌렀을 때 (DialogHost 전용). 연타로 다음 창까지 닫히지 않게 id 확인 */
export function closeDialog(id: number, button?: DialogButton): void {
  if (queue[0]?.id !== id) return;
  queue = queue.slice(1);
  listener?.(queue[0] ?? null);
  button?.onPress?.();
}
