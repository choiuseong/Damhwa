import { Pressable, View, type StyleProp, type ViewStyle } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { theme } from '../theme';
import type { IconName } from '../types';
import { AppText } from './AppText';

interface Props {
  title: string;
  onPress: () => void;
  icon?: IconName;
  color?: string;
  disabled?: boolean;
  style?: StyleProp<ViewStyle>;
}

export function PrimaryButton({ title, onPress, icon, color = theme.brand, disabled, style }: Props) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={title}
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [
        {
          minHeight: 58,
          borderRadius: 18,
          backgroundColor: color,
          alignItems: 'center',
          justifyContent: 'center',
          opacity: disabled ? 0.5 : pressed ? 0.88 : 1,
          transform: [{ scale: pressed ? 0.98 : 1 }],
        },
        style,
      ]}
    >
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
        <AppText variant="title3" color="#fff">
          {title}
        </AppText>
        {icon ? <Ionicons name={icon} size={20} color="#fff" /> : null}
      </View>
    </Pressable>
  );
}
