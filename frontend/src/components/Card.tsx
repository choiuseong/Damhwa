import { View, type StyleProp, type ViewProps, type ViewStyle } from 'react-native';
import { shadow, theme } from '../theme';

export function Card({ style, radius = 22, ...rest }: ViewProps & { radius?: number; style?: StyleProp<ViewStyle> }) {
  return <View {...rest} style={[{ backgroundColor: theme.white, borderRadius: radius, ...shadow }, style]} />;
}
