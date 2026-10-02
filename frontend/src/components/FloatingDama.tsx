import { useEffect, useState } from 'react';
import { Animated, Easing, View } from 'react-native';
import { DamaMascot, type DamaMood } from './DamaMascot';

/** idle: 둥실둥실 · listen: 고개를 갸웃갸웃 · talk: 통통 튀기 · think: 천천히 흔들 · happy: 깡충 점프 · still: 가만히 */
export type DamaMode = DamaMood;

const DURATION: Record<DamaMode, number> = { idle: 1500, listen: 1100, talk: 240, think: 2000, happy: 0, still: 0 };

/** 살아 움직이는 다마 (발밑 그림자 포함) */
export function FloatingDama({ size = 120, mode = 'idle' }: { size?: number; mode?: DamaMode }) {
  const [t] = useState(() => new Animated.Value(0));
  const [squash] = useState(() => new Animated.Value(0));

  useEffect(() => {
    t.setValue(0);
    squash.setValue(0);
    if (mode === 'still') return;
    let loop: Animated.CompositeAnimation;
    if (mode === 'happy') {
      // 쪼그렸다가 → 깡충 → 착지하며 찌그러졌다 복원
      const drive = (v: Animated.Value, toValue: number, duration: number, easing: (x: number) => number) =>
        Animated.timing(v, { toValue, duration, easing, useNativeDriver: true });
      loop = Animated.loop(
        Animated.sequence([
          drive(squash, 1, 120, Easing.out(Easing.quad)),
          Animated.parallel([drive(squash, 0, 120, Easing.linear), drive(t, 1, 280, Easing.out(Easing.quad))]),
          drive(t, 0, 260, Easing.in(Easing.quad)),
          drive(squash, 0.8, 90, Easing.out(Easing.quad)),
          drive(squash, 0, 220, Easing.out(Easing.back(3))),
          Animated.delay(700),
        ]),
      );
    } else {
      const timing = (toValue: number) =>
        Animated.timing(t, { toValue, duration: DURATION[mode], easing: Easing.inOut(Easing.sin), useNativeDriver: true });
      loop = Animated.loop(Animated.sequence([timing(1), timing(0)]));
    }
    loop.start();
    return () => loop.stop();
  }, [mode, t, squash]);

  const lift = { idle: 0.06, listen: 0.02, talk: 0.05, think: 0.03, happy: 0.16, still: 0 }[mode] * size;
  const translateY = t.interpolate({ inputRange: [0, 1], outputRange: [0, -lift] });
  const tilt = mode === 'listen' ? 4 : mode === 'think' ? 3 : 0;
  const rotate = t.interpolate({ inputRange: [0, 1], outputRange: [`-${tilt}deg`, `${tilt}deg`] });
  const scaleX = squash.interpolate({ inputRange: [0, 1], outputRange: [1, 1.07] });
  const scaleY = squash.interpolate({ inputRange: [0, 1], outputRange: [1, 0.9] });
  const shadowScale = t.interpolate({ inputRange: [0, 1], outputRange: [1, mode === 'happy' ? 0.6 : 0.82] });

  return (
    <View style={{ alignItems: 'center' }}>
      <Animated.View style={{ transformOrigin: '50% 100%', transform: [{ translateY }, { rotate }, { scaleX }, { scaleY }] }}>
        <DamaMascot size={size} mood={mode} />
      </Animated.View>
      <Animated.View
        style={{
          width: size * 0.55,
          height: size * 0.07,
          marginTop: size * 0.02,
          borderRadius: size,
          backgroundColor: 'rgba(44,28,20,0.10)',
          transform: [{ scaleX: shadowScale }],
        }}
      />
    </View>
  );
}
