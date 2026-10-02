import { Text, type TextProps } from 'react-native';
import { theme } from '../theme';
import { useAppStore } from '../store/useAppStore';

const SIZES = {
  largeTitle: 34,
  title: 28,
  title2: 22,
  title3: 20,
  headline: 17,
  body: 17,
  callout: 16,
  subhead: 15,
  footnote: 13,
  caption: 12,
} as const;

export type Variant = keyof typeof SIZES;

interface Props extends TextProps {
  variant?: Variant;
  color?: string;
  bold?: boolean;
  center?: boolean;
}

/** 앱 전체 텍스트. 설정의 '큰 글씨' 를 켜면 모든 글자가 커집니다. */
export function AppText({ variant = 'body', color = theme.ink, bold, center, style, ...rest }: Props) {
  const scale = useAppStore((s) => (s.largeText ? 1.25 : 1));
  const size = SIZES[variant] * scale;
  const isBold = bold ?? (variant === 'headline' || variant === 'title' || variant === 'largeTitle' || variant === 'title2' || variant === 'title3');
  return (
    <Text
      {...rest}
      style={[
        {
          fontSize: size,
          lineHeight: size * 1.35,
          color,
          fontWeight: isBold ? '700' : '400',
          textAlign: center ? 'center' : undefined,
        },
        style,
      ]}
    />
  );
}
