import { Alert, Platform } from 'react-native';

/**
 * 앱 안내창. React Native 의 Alert.alert 와 같은 모양으로 부르지만,
 * - 웹(브라우저)에서는 Alert.alert 가 아무것도 띄우지 않는 문제를 해결하고
 * - 웹에서는 어르신이 보기 쉽게 큰 글씨·큰 버튼으로 보여줍니다. (화면은 components/DialogHost.tsx)
 * - 휴대폰(iOS/Android)에서는 기존처럼 시스템 Alert 를 씁니다.
 *   (iOS 는 음성대화 화면처럼 다른 Modal 이 떠 있으면 앱 Modal 이 안 뜨고 이후 안내창이 모두 막히는 문제가 있어서)
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

/** Alert.alert(title, message, buttons) 대신 사용 */
export function showDialog(title: string, message?: string, buttons?: DialogButton[]): void {
  if (Platform.OS !== 'web') {
    Alert.alert(title, message, buttons);
    return;
  }
  queue.push({ id: ++seq, title, message, buttons: buttons?.length ? buttons : [{ text: '확인' }] });
  if (queue.length === 1) listener?.(queue[0]);
}

/** 버튼을 누르거나 창을 닫을 때 호출 (DialogHost 전용). 연타로 다음 창까지 닫히지 않도록 id 확인 */
export function closeDialog(id: number, button?: DialogButton): void {
  if (queue[0]?.id !== id) return;
  queue = queue.slice(1);
  listener?.(queue[0] ?? null);
  button?.onPress?.();
}
