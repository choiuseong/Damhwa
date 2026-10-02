import { useEffect, useState, type ReactNode } from 'react';
import { Animated, Easing, View, type StyleProp, type ViewStyle } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { theme } from '../theme';

/** 아래에서 살짝 떠오르며 나타나기. delay 로 차례차례 등장시킬 수 있어요. */
export function FadeInUp({ delay = 0, distance = 18, style, children }: { delay?: number; distance?: number; style?: StyleProp<ViewStyle>; children: ReactNode }) {
  const [v] = useState(() => new Animated.Value(0));
  useEffect(() => {
    const anim = Animated.timing(v, { toValue: 1, duration: 480, delay, easing: Easing.out(Easing.cubic), useNativeDriver: true });
    anim.start();
    return () => anim.stop();
  }, [v, delay]);
  return (
    <Animated.View style={[style, { opacity: v, transform: [{ translateY: v.interpolate({ inputRange: [0, 1], outputRange: [distance, 0] }) }] }]}>
      {children}
    </Animated.View>
  );
}

/** 톡 튀어나오기 (팝업·말풍선) */
export function PopIn({ delay = 0, style, children }: { delay?: number; style?: StyleProp<ViewStyle>; children: ReactNode }) {
  const [v] = useState(() => new Animated.Value(0));
  useEffect(() => {
    const anim = Animated.spring(v, { toValue: 1, delay, friction: 6, tension: 90, useNativeDriver: true });
    anim.start();
    return () => anim.stop();
  }, [v, delay]);
  return (
    <Animated.View style={[style, { opacity: v.interpolate({ inputRange: [0, 0.4, 1], outputRange: [0, 1, 1] }), transform: [{ scale: v.interpolate({ inputRange: [0, 1], outputRange: [0.85, 1] }) }] }]}>
      {children}
    </Animated.View>
  );
}

/** 무한 반복 0→1 값 */
const EASE_OUT = Easing.out(Easing.quad);

function useLoop(duration: number, delay = 0, easing: (x: number) => number = EASE_OUT) {
  const [v] = useState(() => new Animated.Value(0));
  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([Animated.delay(delay), Animated.timing(v, { toValue: 1, duration, easing, useNativeDriver: true }), Animated.timing(v, { toValue: 0, duration: 0, useNativeDriver: true })]),
    );
    loop.start();
    return () => loop.stop();
  }, [v, duration, delay, easing]);
  return v;
}

/** 퍼져 나가는 동그라미 물결 (듣는 중 표시) */
export function Ripples({ size, color = theme.listening, count = 3, active = true }: { size: number; color?: string; count?: number; active?: boolean }) {
  return (
    <View pointerEvents="none" style={{ position: 'absolute', width: size, height: size, alignItems: 'center', justifyContent: 'center', opacity: active ? 1 : 0 }}>
      {Array.from({ length: count }, (_, i) => (
        <Ring key={i} size={size} color={color} delay={(i * 1800) / count} />
      ))}
    </View>
  );
}

function Ring({ size, color, delay }: { size: number; color: string; delay: number }) {
  const v = useLoop(1800, delay);
  return (
    <Animated.View
      style={{
        position: 'absolute',
        width: size,
        height: size,
        borderRadius: size / 2,
        borderWidth: 2,
        borderColor: color,
        opacity: v.interpolate({ inputRange: [0, 0.2, 1], outputRange: [0, 0.55, 0] }),
        transform: [{ scale: v.interpolate({ inputRange: [0, 1], outputRange: [0.72, 1.12] }) }],
      }}
    />
  );
}

/** 숨 쉬듯 커졌다 작아지는 배경 (말하는 중) */
export function Breathe({ children, active = true, amount = 0.05, style }: { children?: ReactNode; active?: boolean; amount?: number; style?: StyleProp<ViewStyle> }) {
  const [v] = useState(() => new Animated.Value(0));
  useEffect(() => {
    if (!active) {
      Animated.timing(v, { toValue: 0, duration: 300, useNativeDriver: true }).start();
      return;
    }
    const to = (x: number) => Animated.timing(v, { toValue: x, duration: 700, easing: Easing.inOut(Easing.sin), useNativeDriver: true });
    const loop = Animated.loop(Animated.sequence([to(1), to(0)]));
    loop.start();
    return () => loop.stop();
  }, [v, active]);
  return <Animated.View style={[style, { transform: [{ scale: v.interpolate({ inputRange: [0, 1], outputRange: [1, 1 + amount] }) }] }]}>{children}</Animated.View>;
}

/** 버튼 뒤에서 은은하게 퍼지는 빛 */
export function GlowPulse({ color = 'rgba(255,255,255,0.7)', radius = 999 }: { color?: string; radius?: number }) {
  const v = useLoop(1700, 400);
  return (
    <Animated.View
      pointerEvents="none"
      style={{
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        borderRadius: radius,
        backgroundColor: color,
        opacity: v.interpolate({ inputRange: [0, 1], outputRange: [0.7, 0] }),
        transform: [{ scaleX: v.interpolate({ inputRange: [0, 1], outputRange: [1, 1.18] }) }, { scaleY: v.interpolate({ inputRange: [0, 1], outputRange: [1, 1.5] }) }],
      }}
    />
  );
}

/** 딸랑딸랑 흔들기 (알림 종) — 몇 초마다 한 번 */
export function Shake({ active = true, children }: { active?: boolean; children: ReactNode }) {
  const [v] = useState(() => new Animated.Value(0));
  useEffect(() => {
    if (!active) return;
    const to = (x: number) => Animated.timing(v, { toValue: x, duration: 70, useNativeDriver: true });
    const loop = Animated.loop(Animated.sequence([Animated.delay(900), to(1), to(-1), to(0.7), to(-0.7), to(0.3), to(0), Animated.delay(2600)]));
    loop.start();
    return () => loop.stop();
  }, [v, active]);
  return (
    <Animated.View style={{ transformOrigin: '50% 10%', transform: [{ rotate: v.interpolate({ inputRange: [-1, 1], outputRange: ['-18deg', '18deg'] }) }] }}>{children}</Animated.View>
  );
}

/** 생각 중 말풍선 (점 세 개가 통통) */
export function ThinkingDots({ color = theme.brand }: { color?: string }) {
  return (
    <View style={{ flexDirection: 'row', gap: 6, paddingHorizontal: 16, paddingVertical: 12, borderRadius: 20, backgroundColor: theme.white, borderWidth: 1, borderColor: theme.line }}>
      {[0, 1, 2].map((i) => (
        <Dot key={i} color={color} delay={i * 150} />
      ))}
    </View>
  );
}

function Dot({ color, delay }: { color: string; delay: number }) {
  const [v] = useState(() => new Animated.Value(0));
  useEffect(() => {
    const to = (x: number, d: number) => Animated.timing(v, { toValue: x, duration: d, easing: Easing.inOut(Easing.quad), useNativeDriver: true });
    const loop = Animated.loop(Animated.sequence([Animated.delay(delay), to(1, 260), to(0, 260), Animated.delay(450 - delay)]));
    loop.start();
    return () => loop.stop();
  }, [v, delay]);
  return (
    <Animated.View
      style={{
        width: 9,
        height: 9,
        borderRadius: 5,
        backgroundColor: color,
        opacity: v.interpolate({ inputRange: [0, 1], outputRange: [0.4, 1] }),
        transform: [{ translateY: v.interpolate({ inputRange: [0, 1], outputRange: [0, -6] }) }],
      }}
    />
  );
}

/** 음성 파형 막대 — 듣거나 말할 때 출렁출렁 */
export function SoundBars({ active, color = theme.brand, count = 9, height = 34 }: { active: boolean; color?: string; count?: number; height?: number }) {
  return (
    <View style={{ height, flexDirection: 'row', alignItems: 'center', gap: 5 }}>
      {Array.from({ length: count }, (_, i) => (
        <Bar key={i} index={i} count={count} active={active} color={color} height={height} />
      ))}
    </View>
  );
}

function Bar({ index, count, active, color, height }: { index: number; count: number; active: boolean; color: string; height: number }) {
  const [v] = useState(() => new Animated.Value(0.2));
  useEffect(() => {
    if (!active) {
      Animated.timing(v, { toValue: 0.2, duration: 250, useNativeDriver: true }).start();
      return;
    }
    // 가운데 막대가 더 크게 출렁이도록
    const center = 1 - Math.abs(index - (count - 1) / 2) / count;
    let alive = true;
    const step = () => {
      if (!alive) return;
      Animated.timing(v, { toValue: 0.25 + Math.random() * 0.75 * center, duration: 160 + Math.random() * 220, easing: Easing.inOut(Easing.quad), useNativeDriver: true }).start(step);
    };
    step();
    return () => {
      alive = false;
      v.stopAnimation();
    };
  }, [active, v, index, count]);
  return <Animated.View style={{ width: 5, height, borderRadius: 3, backgroundColor: color, transform: [{ scaleY: v }] }} />;
}

const PARTICLES = [
  { x: -95, icon: 'heart', size: 16, delay: 0 },
  { x: 85, icon: 'sparkles', size: 14, delay: 500 },
  { x: -60, icon: 'sparkles', size: 12, delay: 1100 },
  { x: 105, icon: 'heart', size: 13, delay: 1500 },
  { x: -110, icon: 'sparkles', size: 11, delay: 2000 },
  { x: 60, icon: 'heart', size: 15, delay: 2500 },
] as const;

const RISE = Easing.out(Easing.sin);

/** 다마 주변으로 떠오르는 하트·반짝이 */
export function Particles({ active, color = theme.brand }: { active: boolean; color?: string }) {
  const [fade] = useState(() => new Animated.Value(0));
  useEffect(() => {
    Animated.timing(fade, { toValue: active ? 1 : 0, duration: 500, useNativeDriver: true }).start();
  }, [active, fade]);
  return (
    <Animated.View pointerEvents="none" style={{ position: 'absolute', left: 0, right: 0, top: 0, bottom: 0, alignItems: 'center', justifyContent: 'center', opacity: fade }}>
      {PARTICLES.map((p, i) => (
        <Particle key={i} {...p} color={i % 2 ? theme.pink : color} />
      ))}
    </Animated.View>
  );
}

function Particle({ x, icon, size, delay, color }: { x: number; icon: 'heart' | 'sparkles'; size: number; delay: number; color: string }) {
  const v = useLoop(3000, delay, RISE);
  return (
    <Animated.View
      style={{
        position: 'absolute',
        opacity: v.interpolate({ inputRange: [0, 0.15, 0.7, 1], outputRange: [0, 0.9, 0.6, 0] }),
        transform: [
          { translateX: v.interpolate({ inputRange: [0, 0.5, 1], outputRange: [x, x + (x > 0 ? 8 : -8), x] }) },
          { translateY: v.interpolate({ inputRange: [0, 1], outputRange: [40, -110] }) },
          { scale: v.interpolate({ inputRange: [0, 0.2, 1], outputRange: [0.4, 1, 0.8] }) },
        ],
      }}
    >
      <Ionicons name={icon} size={size} color={color} />
    </Animated.View>
  );
}
