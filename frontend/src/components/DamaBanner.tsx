import { View } from 'react-native';
import { theme } from '../theme';
import { AppText } from './AppText';
import { FloatingDama } from './FloatingDama';
import { FadeInUp, PopIn } from './Motion';
import { SpeechBubble } from './SpeechBubble';

/** 목록 화면 맨 위의 다마 요약 배너 */
export function DamaBanner({ title, message }: { title: string; message: string }) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, padding: 18, borderRadius: 24, backgroundColor: theme.peach, overflow: 'hidden' }}>
      <View style={{ position: 'absolute', width: 160, height: 160, borderRadius: 80, backgroundColor: 'rgba(255,255,255,0.45)', right: -40, top: -50 }} />
      <View style={{ flex: 1, gap: 4 }}>
        <AppText variant="title2">{title}</AppText>
        <AppText variant="subhead" color={theme.brandDark}>
          {message}
        </AppText>
      </View>
      <FloatingDama size={64} />
    </View>
  );
}

/** 비어 있을 때 다마가 말풍선으로 안내 */
export function DamaEmptyState({ title, message }: { title: string; message: string }) {
  return (
    <View style={{ alignItems: 'center', gap: 16, paddingTop: 48, paddingBottom: 12 }}>
      <PopIn delay={250}>
        <SpeechBubble tail="bottom">
          <AppText variant="headline" center>
            {title}
          </AppText>
        </SpeechBubble>
      </PopIn>
      <FadeInUp>
        <FloatingDama size={120} />
      </FadeInUp>
      <FadeInUp delay={400}>
        <AppText color={theme.subInk} center>
          {message}
        </AppText>
      </FadeInUp>
    </View>
  );
}
