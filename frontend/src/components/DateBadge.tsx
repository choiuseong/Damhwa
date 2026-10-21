import { View } from 'react-native';
import { theme } from '../theme';
import { AppText } from './AppText';

/** 달력 한 장 모양의 날짜 배지 ("6월" / "1") */
export function DateBadge({ iso, color = theme.brand }: { iso: string; color?: string }) {
  const d = new Date(iso);
  return (
    <View style={{ minWidth: 56, paddingVertical: 7, paddingHorizontal: 6, borderRadius: 16, backgroundColor: color, alignItems: 'center' }}>
      <AppText variant="caption" color="rgba(255,255,255,0.85)" bold>
        {`${d.getMonth() + 1}월`}
      </AppText>
      <AppText variant="title3" color="#fff" style={{ marginTop: -2 }}>
        {String(d.getDate())}
      </AppText>
    </View>
  );
}
