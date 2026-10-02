import { useEffect, useState } from 'react';
import { Animated, Easing, Image, View } from 'react-native';

/**
 * 마스코트 '다마'.
 * assets/dama.png(원본)을 잘라 만든 조각들을 겹쳐 그려서 눈·입·하트 안테나를 따로 움직입니다.
 *   assets/dama/base.png  — 눈·입·안테나를 지운 몸통
 *   assets/dama/eyeL|eyeR|mouth|antenna.png — 각 부위
 * 조각 좌표는 모두 원본 크기(484x720) 기준입니다.
 */
const IMG = { w: 484, h: 720 };
const PARTS = {
  eyeL: { x: 134, y: 245, w: 61, h: 76, src: require('../../assets/dama/eyeL.png') },
  eyeR: { x: 255, y: 226, w: 66, h: 82, src: require('../../assets/dama/eyeR.png') },
  mouth: { x: 195, y: 291, w: 75, h: 61, src: require('../../assets/dama/mouth.png') },
  antenna: { x: 146, y: 8, w: 117, h: 110, src: require('../../assets/dama/antenna.png') },
} as const;
const BASE = require('../../assets/dama/base.png');
/** 안테나 줄기가 머리에 붙은 지점 (회전 중심) */
const ANTENNA_PIVOT = `${(((208 - PARTS.antenna.x) / PARTS.antenna.w) * 100).toFixed(1)}% 100%`;

/**
 * idle: 기본(깜빡임, 하트 살랑) · listen: 입 오므리고 하트 쫑긋 · talk: 입 뻐끔뻐끔
 * think: 눈동자 위로 굴리기 · happy: 웃는 눈(^^) · still: 가만히
 */
export type DamaMood = 'idle' | 'listen' | 'talk' | 'think' | 'happy' | 'still';

const ANTENNA_SWING: Record<DamaMood, { deg: number; ms: number }> = {
  idle: { deg: 5, ms: 1400 },
  listen: { deg: 9, ms: 650 },
  talk: { deg: 7, ms: 260 },
  think: { deg: 12, ms: 1800 },
  happy: { deg: 14, ms: 300 },
  still: { deg: 0, ms: 0 },
};

const MOUTH_OPEN: Record<DamaMood, number> = { idle: 1, listen: 0.5, talk: 1, think: 0.45, happy: 1, still: 1 };

export function DamaMascot({ size = 120, mood = 'idle' }: { size?: number; mood?: DamaMood }) {
  const [blink] = useState(() => new Animated.Value(1));
  const [mouth] = useState(() => new Animated.Value(1));
  const [swing] = useState(() => new Animated.Value(0));
  const [look] = useState(() => new Animated.Value(0));

  // 눈 깜빡임: 여러 다마가 동시에 깜빡이지 않도록 시작 시점을 흩뜨림
  useEffect(() => {
    if (mood === 'still' || mood === 'happy') {
      blink.setValue(1);
      return;
    }
    let alive = true;
    let timer: ReturnType<typeof setTimeout>;
    const once = () => {
      const twice = Math.random() < 0.25;
      const close = Animated.timing(blink, { toValue: 0.08, duration: 70, useNativeDriver: true });
      const open = Animated.timing(blink, { toValue: 1, duration: 110, useNativeDriver: true });
      Animated.sequence(twice ? [close, open, Animated.delay(90), close, open] : [close, open]).start(() => {
        if (alive) timer = setTimeout(once, 2200 + Math.random() * 2600);
      });
    };
    timer = setTimeout(once, 600 + Math.random() * 2400);
    return () => {
      alive = false;
      clearTimeout(timer);
      blink.stopAnimation();
    };
  }, [mood, blink]);

  // 입: 말할 때 뻐끔뻐끔, 그 밖엔 상태별 크기
  useEffect(() => {
    if (mood !== 'talk') {
      Animated.timing(mouth, { toValue: MOUTH_OPEN[mood], duration: 180, useNativeDriver: true }).start();
      return;
    }
    const steps = [0.35, 1, 0.55, 0.95, 0.3, 0.85, 0.5, 1];
    const loop = Animated.loop(
      Animated.sequence(steps.map((v, i) => Animated.timing(mouth, { toValue: v, duration: 90 + (i % 3) * 30, useNativeDriver: true }))),
    );
    loop.start();
    return () => loop.stop();
  }, [mood, mouth]);

  // 하트 안테나 살랑살랑
  useEffect(() => {
    swing.setValue(0);
    const { ms } = ANTENNA_SWING[mood];
    if (!ms) return;
    const to = (v: number) => Animated.timing(swing, { toValue: v, duration: ms, easing: Easing.inOut(Easing.sin), useNativeDriver: true });
    const loop = Animated.loop(Animated.sequence([to(1), to(-1)]));
    loop.start();
    return () => loop.stop();
  }, [mood, swing]);

  // 생각할 때 눈동자를 위로, 좌우로 굴리기
  useEffect(() => {
    if (mood !== 'think') {
      Animated.timing(look, { toValue: 0, duration: 200, useNativeDriver: true }).start();
      return;
    }
    const to = (v: number) => Animated.timing(look, { toValue: v, duration: 900, easing: Easing.inOut(Easing.quad), useNativeDriver: true });
    const loop = Animated.loop(Animated.sequence([to(1), Animated.delay(500), to(-1), Animated.delay(500)]));
    loop.start();
    return () => loop.stop();
  }, [mood, look]);

  const H = size * 1.2;
  const k = H / IMG.h;
  const W = IMG.w * k;
  const box = (p: { x: number; y: number; w: number; h: number }) =>
    ({ position: 'absolute', left: p.x * k, top: p.y * k, width: p.w * k, height: p.h * k }) as const;

  const deg = ANTENNA_SWING[mood].deg;
  const antennaRotate = swing.interpolate({ inputRange: [-1, 1], outputRange: [`-${deg}deg`, `${deg}deg`] });
  const eyeTransform = [
    { translateX: look.interpolate({ inputRange: [-1, 0, 1], outputRange: [-4 * k, 0, 4 * k] }) },
    { translateY: look.interpolate({ inputRange: [-1, 0, 1], outputRange: [-6 * k, 0, -6 * k] }) },
    { scaleY: blink },
  ];

  return (
    <View
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      style={{ width: size, height: H, alignItems: 'center' }}
    >
      <View style={{ width: W, height: H }}>
        <Animated.Image source={PARTS.antenna.src} style={[box(PARTS.antenna), { transformOrigin: ANTENNA_PIVOT, transform: [{ rotate: antennaRotate }] }]} />
        <Image source={BASE} style={{ width: W, height: H }} />
        {mood === 'happy' ? (
          <>
            <HappyEye part={PARTS.eyeL} k={k} />
            <HappyEye part={PARTS.eyeR} k={k} />
          </>
        ) : (
          <>
            <Animated.Image source={PARTS.eyeL.src} style={[box(PARTS.eyeL), { transform: eyeTransform }]} />
            <Animated.Image source={PARTS.eyeR.src} style={[box(PARTS.eyeR), { transform: eyeTransform }]} />
          </>
        )}
        <Animated.Image source={PARTS.mouth.src} style={[box(PARTS.mouth), { transformOrigin: '50% 30%', transform: [{ scaleY: mouth }] }]} />
      </View>
    </View>
  );
}

/** 웃는 눈 ^ */
function HappyEye({ part, k }: { part: { x: number; y: number; w: number; h: number }; k: number }) {
  const w = part.w * 0.62 * k;
  const stroke = Math.max(1.5, 7 * k);
  return (
    <View
      style={{
        position: 'absolute',
        left: (part.x + part.w / 2) * k - w / 2,
        top: (part.y + part.h * 0.42) * k - w * 0.2,
        width: w,
        height: w * 0.5,
        overflow: 'hidden',
      }}
    >
      <View style={{ width: w, height: w, borderRadius: w / 2, borderWidth: stroke, borderColor: '#2C1C14' }} />
    </View>
  );
}
