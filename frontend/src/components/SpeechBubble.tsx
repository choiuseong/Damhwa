import { View, type StyleProp, type ViewProps, type ViewStyle } from 'react-native';
import { theme } from '../theme';

interface Props extends ViewProps {
  /** 꼬리 방향 (말하는 다마가 있는 쪽) */
  tail?: 'top' | 'bottom';
  color?: string;
  style?: StyleProp<ViewStyle>;
}

/** 다마의 말풍선 */
export function SpeechBubble({ tail = 'bottom', color = theme.white, style, children, ...rest }: Props) {
  return (
    <View {...rest} style={[{ backgroundColor: color, borderRadius: 22, paddingHorizontal: 20, paddingVertical: 14 }, style]}>
      <View
        style={{
          position: 'absolute',
          alignSelf: 'center',
          ...(tail === 'top' ? { top: -7 } : { bottom: -7 }),
          width: 16,
          height: 16,
          borderRadius: 3,
          backgroundColor: color,
          transform: [{ rotate: '45deg' }],
        }}
      />
      {children}
    </View>
  );
}
