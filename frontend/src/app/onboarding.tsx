import { View } from 'react-native';
import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { AppText } from '../components/AppText';
import { FloatingDama } from '../components/FloatingDama';
import { FadeInUp, PopIn } from '../components/Motion';
import { PrimaryButton } from '../components/PrimaryButton';
import { SpeechBubble } from '../components/SpeechBubble';
import { useAppStore } from '../store/useAppStore';
import { theme } from '../theme';

/** PPT '담화 첫 화면' 오른쪽 폰: 안녕하세요 + 대화 시작하기 */
export default function OnboardingScreen() {
  const insets = useSafeAreaInsets();
  const completeOnboarding = useAppStore((s) => s.completeOnboarding);

  return (
    <View style={{ flex: 1, backgroundColor: '#fff', paddingHorizontal: 24, paddingTop: insets.top + 24, paddingBottom: insets.bottom + 24 }}>
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', gap: 18 }}>
        <PopIn delay={500}>
          <SpeechBubble tail="bottom" color={theme.peach}>
            <AppText variant="headline" color={theme.brandDark}>
              반가워요! 저는 다마예요
            </AppText>
          </SpeechBubble>
        </PopIn>
        <PopIn style={{ width: 220, height: 220, alignItems: 'center', justifyContent: 'center', marginBottom: 8 }}>
          <View style={{ position: 'absolute', width: 220, height: 220, borderRadius: 110, backgroundColor: `${theme.peach}99` }} />
          <FloatingDama size={140} mode="happy" />
        </PopIn>
        <FadeInUp delay={250} style={{ alignItems: 'center', gap: 18 }}>
          <AppText variant="largeTitle">안녕하세요.</AppText>
          <AppText variant="title3" color={theme.subInk} center style={{ fontWeight: '400' }}>
            {'당신의 하루를\n다마와 함께 나누어보세요.'}
          </AppText>
        </FadeInUp>
      </View>
      <FadeInUp delay={450}>
        <PrimaryButton
          title="대화 시작하기"
          icon="arrow-forward"
          onPress={() => {
            completeOnboarding();
            router.replace('/(tabs)');
          }}
        />
      </FadeInUp>
    </View>
  );
}
