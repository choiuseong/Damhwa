// [변경] 새 파일: 웹에서도 보이는 안내창
import { useEffect, useState } from 'react';
import { Modal, Pressable, View } from 'react-native';
import { closeDialog, subscribeDialog, type DialogRequest } from '../lib/dialog';
import { theme } from '../theme';
import { AppText } from './AppText';

/** showDialog() 로 띄우는 큰 글씨 안내창. 루트 레이아웃에 한 번만 둡니다. */
export function DialogHost() {
  const [req, setReq] = useState<DialogRequest | null>(null);
  useEffect(() => subscribeDialog(setReq), []);
  if (!req) return null;

  const cancel = req.buttons.find((b) => b.style === 'cancel');
  // 버튼이 3개 이상이면 세로로, 2개 이하면 가로로 놓습니다. 취소는 항상 맨 아래/왼쪽.
  const actions = req.buttons.filter((b) => b.style !== 'cancel');
  const vertical = req.buttons.length > 2;
  const ordered = vertical ? [...actions, ...(cancel ? [cancel] : [])] : [...(cancel ? [cancel] : []), ...actions];

  return (
    <Modal visible transparent animationType="fade" onRequestClose={() => closeDialog(req.id, cancel)}>
      <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', padding: 24 }}>
        <View accessibilityViewIsModal style={{ backgroundColor: '#fff', borderRadius: 24, padding: 24, gap: 14, maxWidth: 480, width: '100%', alignSelf: 'center' }}>
          <AppText variant="title3" accessibilityRole="header">
            {req.title}
          </AppText>
          {req.message ? (
            <AppText variant="body" color={theme.ink}>
              {req.message}
            </AppText>
          ) : null}
          <View style={{ flexDirection: vertical ? 'column' : 'row', gap: 10, marginTop: 6 }}>
            {ordered.map((b) => {
              const danger = b.style === 'destructive';
              const isCancel = b.style === 'cancel';
              return (
                <Pressable
                  key={b.text}
                  accessibilityRole="button"
                  accessibilityLabel={b.text}
                  onPress={() => closeDialog(req.id, b)}
                  style={({ pressed }) => ({
                    flex: vertical ? undefined : 1,
                    minHeight: 56,
                    borderRadius: 16,
                    alignItems: 'center',
                    justifyContent: 'center',
                    paddingHorizontal: 12,
                    backgroundColor: isCancel ? theme.gray : danger ? theme.listening : theme.brand,
                    opacity: pressed ? 0.85 : 1,
                  })}
                >
                  <AppText variant="headline" color={isCancel ? theme.ink : '#fff'}>
                    {b.text}
                  </AppText>
                </Pressable>
              );
            })}
          </View>
        </View>
      </View>
    </Modal>
  );
}
