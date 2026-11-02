// [변경] 새 파일: 이모티콘·스티커 고르기
import { useState } from 'react';
import { Pressable, ScrollView, View } from 'react-native';
import { EMOJI_GROUPS, STICKERS } from '../lib/emoji';
import { theme } from '../theme';
import { AppText } from './AppText';

/**
 * 이모티콘·스티커 고르기 (입력칸 아래에 펼쳐짐)
 * - 이모티콘 탭: 누르면 입력칸에 들어감 (글과 함께 보내기)
 * - 스티커 탭: 누르면 바로 크게 보냄
 * 어르신이 누르기 쉽게 칸을 크게(52pt) 만들었습니다.
 */
export function EmojiPanel({ onEmoji, onSticker }: { onEmoji: (e: string) => void; onSticker: (e: string) => void }) {
  const tabs = [...EMOJI_GROUPS.map((g) => g.label), '스티커'];
  const [tab, setTab] = useState(0);
  const isSticker = tab === tabs.length - 1;

  return (
    <View style={{ backgroundColor: '#fff', borderTopWidth: 1, borderTopColor: theme.line, height: 260 }}>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ flexGrow: 0 }} contentContainerStyle={{ gap: 8, paddingHorizontal: 12, paddingVertical: 8 }}>
        {tabs.map((label, i) => (
          <Pressable
            key={label}
            accessibilityRole="tab"
            accessibilityState={{ selected: tab === i }}
            onPress={() => setTab(i)}
            style={{ paddingHorizontal: 14, paddingVertical: 8, borderRadius: 999, backgroundColor: tab === i ? theme.brand : theme.gray }}
          >
            <AppText variant="subhead" bold color={tab === i ? '#fff' : theme.ink}>
              {label}
            </AppText>
          </Pressable>
        ))}
      </ScrollView>
      <ScrollView contentContainerStyle={{ flexDirection: 'row', flexWrap: 'wrap', paddingHorizontal: 8, paddingBottom: 12 }}>
        {isSticker
          ? STICKERS.map((s) => (
            <Pressable
              key={s.emoji}
              accessibilityRole="button"
              accessibilityLabel={`${s.label} 스티커 보내기`}
              onPress={() => onSticker(s.emoji)}
              style={({ pressed }) => ({ width: '25%', alignItems: 'center', paddingVertical: 6, borderRadius: 14, backgroundColor: pressed ? theme.peach : 'transparent' })}
            >
              <AppText style={{ fontSize: 40, lineHeight: 50 }}>{s.emoji}</AppText>
              <AppText variant="caption" color={theme.subInk}>{s.label}</AppText>
            </Pressable>
          ))
          : EMOJI_GROUPS[tab].items.map((e) => (
            <Pressable
              key={e}
              accessibilityRole="button"
              accessibilityLabel={`${e} 넣기`}
              onPress={() => onEmoji(e)}
              style={({ pressed }) => ({ width: '12.5%', minWidth: 44, height: 52, alignItems: 'center', justifyContent: 'center', borderRadius: 12, backgroundColor: pressed ? theme.peach : 'transparent' })}
            >
              <AppText style={{ fontSize: 30, lineHeight: 38 }}>{e}</AppText>
            </Pressable>
          ))}
      </ScrollView>
    </View>
  );
}
