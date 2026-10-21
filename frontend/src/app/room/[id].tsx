import { useRef, useState } from 'react';
import { FlatList, KeyboardAvoidingView, Platform, Pressable, TextInput, View } from 'react-native';
import { Stack, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import * as Speech from 'expo-speech';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as api from '../../api';
import { NEIGHBOR_RADIUS_KM, USE_MOCK } from '../../api/config';
import { AppText } from '../../components/AppText';
import { useNeighborhood } from '../../hooks/useNeighborhood';
import { useRoomChat } from '../../hooks/useRoomChat';
import { useAppStore } from '../../store/useAppStore';
import { theme } from '../../theme';
import { showDialog } from '../../lib/dialog';
import type { ChatMessage } from '../../types';

/** PPT '안양 소통방' 화면 */
export default function RoomScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const insets = useSafeAreaInsets();
  const room = useAppStore((s) => s.rooms.find((r) => r.id === id));
  const { granted, request } = useNeighborhood();

  const [readAloud, setReadAloud] = useState(false);


  const { messages, send, error, sending, refresh, hideSender } = useRoomChat(id, (m) => {
    if (readAloud) Speech.speak(m.text, { language: 'ko-KR' });
  });

  const [input, setInput] = useState('');
  const listRef = useRef<FlatList<ChatMessage>>(null);

  const submit = async () => {
    const t = input.trim();
    if (!t || sending) return;
    if (await send(t)) setInput((current) => current.trim() === t ? '' : current);
  };

  const toggleReadAloud = () => {
    if (readAloud) Speech.stop();
    setReadAloud((v) => !v);
  };

  const openMenu = (message?: ChatMessage) => {
    if (!message || message.isMine) { showDialog('이웃 신고·차단', '상대방의 메시지를 길게 눌러 신고하거나 차단할 수 있어요.'); return; }
    const act = async (kind: 'report' | 'block') => {
      try {
        await api.reportOrBlock(id, kind, message.id);
        if (kind === 'block') { if (USE_MOCK) hideSender(message.sender); else await refresh(true); }
        showDialog(kind === 'block' ? '차단했어요' : '신고가 저장되었어요', kind === 'block' ? '차단한 이웃의 메시지를 숨겼어요.' : '신고 내용이 서버에 저장되었어요.');
      } catch (e) {
        showDialog('처리 실패', e instanceof Error && USE_MOCK ? e.message : '연결을 확인하고 다시 시도해주세요.');
      }
    };
    showDialog('이웃 신고·차단', message.text, [
      { text: '신고하기', onPress: () => { void act('report'); } },
      { text: '차단하기', style: 'destructive', onPress: () => { void act('block'); } },
      { text: '취소', style: 'cancel' },
    ]);
  };

  return (
    <KeyboardAvoidingView style={{ flex: 1, backgroundColor: '#fff' }} behavior={Platform.OS === 'ios' ? 'padding' : undefined} keyboardVerticalOffset={Platform.OS === 'ios' ? 90 : 0}>
      <Stack.Screen
        options={{
          title: room?.title ?? '채팅방',
          headerRight: () => (
            <Pressable accessibilityRole="button" accessibilityLabel="더보기" hitSlop={10} onPress={() => openMenu()}>
              <Ionicons name="ellipsis-vertical" size={22} color={theme.brand} />
            </Pressable>
          ),
        }}
      />

      <View style={{ position: 'absolute', top: 8, right: 12, zIndex: 1, flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 10, paddingVertical: 5, borderRadius: 999, backgroundColor: theme.gray }}>
        <Ionicons name="people" size={13} color={theme.subInk} />
        <AppText variant="caption" color={theme.subInk} bold>
          {USE_MOCK ? "데모 채팅" : "이웃 채팅"}
        </AppText>
      </View>

      <FlatList
        ref={listRef}
        data={messages}
        keyExtractor={(m) => m.id}
        contentContainerStyle={{ padding: 16, gap: 12, flexGrow: 1 }}
        onContentSizeChange={() => listRef.current?.scrollToEnd({ animated: true })}
        ListHeaderComponent={
          <View style={{ alignItems: 'center', marginBottom: 8 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 14, paddingVertical: 7, borderRadius: 999, backgroundColor: `${theme.peach}CC` }}>
              <Ionicons name="location" size={14} color={theme.brand} />
              <AppText variant="footnote" color={theme.brand} bold onPress={granted ? undefined : () => request(true)}>
                {granted ? `반경 ${NEIGHBOR_RADIUS_KM}km 이내 이웃 소통 중` : `위치를 허용하면 반경 ${NEIGHBOR_RADIUS_KM}km 이웃과 연결돼요`}
              </AppText>
            </View>
          </View>
        }
        ListEmptyComponent={
          <View style={{ alignItems: 'center', gap: 12, paddingTop: 80 }}>
            <Ionicons name="chatbubble-ellipses-outline" size={64} color="#C9C9CE" />
            <AppText variant="footnote" color={theme.subInk} center>
              {'우리 동네 대화방에 오신 것을 환영합니다.\n아래 창에 첫 인사를 남겨보세요!'}
            </AppText>
          </View>
        }
        renderItem={({ item }) => <Pressable onLongPress={() => openMenu(item)}><Bubble msg={item} /></Pressable>}
      />

      {error ? <AppText color={theme.listening} style={{ paddingHorizontal: 16 }}>{error}</AppText> : null}
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 14, paddingTop: 10, paddingBottom: insets.bottom + 10, borderTopWidth: 1, borderTopColor: theme.line, backgroundColor: '#fff' }}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="메시지 소리로 듣기"
          accessibilityState={{ selected: readAloud }}
          onPress={toggleReadAloud}
          style={{ width: 42, height: 42, borderRadius: 21, backgroundColor: theme.gray, alignItems: 'center', justifyContent: 'center' }}
        >
          <Ionicons name={readAloud ? 'volume-high' : 'volume-mute'} size={20} color={readAloud ? theme.brand : theme.subInk} />
        </Pressable>

        <View style={{ flex: 1, flexDirection: 'row', alignItems: 'center', backgroundColor: theme.gray, borderRadius: 999, paddingHorizontal: 14 }}>
          <TextInput
            editable={!sending}
            value={input}
            onChangeText={setInput}
            placeholder="메시지를 입력하세요"
            placeholderTextColor="#9A9AA0"
            onSubmitEditing={submit}
            returnKeyType="send"
            style={{ flex: 1, paddingVertical: 11, fontSize: 16 }}
          />
          <Pressable accessibilityRole="button" accessibilityLabel="이모티콘" hitSlop={8} onPress={() => setInput((v) => `${v}😊`)}>
            <Ionicons name="happy-outline" size={22} color={theme.subInk} />
          </Pressable>
        </View>

        <Pressable
          accessibilityRole="button"
          disabled={sending}
          accessibilityLabel={input.trim() ? '보내기' : '음성으로 이야기'}
          onPress={() => (input.trim() ? submit() : showDialog('준비 중이에요', '이웃과 음성으로 이야기하는 기능(WebRTC 통화)은 곧 만나요.'))}
          style={{ width: 46, height: 46, borderRadius: 23, backgroundColor: theme.brand, alignItems: 'center', justifyContent: 'center' }}
        >
          <Ionicons name={input.trim() ? 'arrow-up' : 'mic'} size={22} color="#fff" />
        </Pressable>
      </View>
    </KeyboardAvoidingView>
  );
}

function Bubble({ msg }: { msg: ChatMessage }) {
  return (
    <View style={{ alignItems: msg.isMine ? 'flex-end' : 'flex-start' }}>
      {!msg.isMine && (
        <AppText variant="caption" color={theme.subInk} style={{ marginBottom: 3 }}>
          {msg.sender}
        </AppText>
      )}
      <View
        style={{
          maxWidth: '78%',
          paddingHorizontal: 14,
          paddingVertical: 10,
          borderRadius: 18,
          backgroundColor: msg.isMine ? theme.peach : '#F2F2F4',
        }}
      >
        <AppText>{msg.text}</AppText>
      </View>
    </View>
  );
}
