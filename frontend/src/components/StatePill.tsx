import { View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { AppText } from './AppText';

export function StatePill({ text, color }: { text: string; color: string }) {
  return (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
        paddingHorizontal: 14,
        paddingVertical: 6,
        borderRadius: 999,
        backgroundColor: `${color}1F`,
      }}
    >
      <Ionicons name="sparkles" size={12} color={color} />
      <AppText variant="subhead" color={color} bold>
        {text}
      </AppText>
    </View>
  );
}
