import { useEffect, useMemo, useState } from 'react';
import { KeyboardAvoidingView, Modal, Platform, Pressable, ScrollView, TextInput, View } from 'react-native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as api from '../../api';
import { AppText } from '../../components/AppText';
import { Card } from '../../components/Card';
import { PrimaryButton } from '../../components/PrimaryButton';
import { useNeighborhood } from '../../hooks/useNeighborhood';
import { useAppStore } from '../../store/useAppStore';
import { theme } from '../../theme';
import type { ChatRoom } from '../../types';

/** PPT '함께하는 사이버 경로당' 왼쪽 폰: 오픈 채팅방 목록 */
export default function CommunityScreen() {
  const insets = useSafeAreaInsets();
  const rooms = useAppStore((s) => s.rooms);
  const setRooms = useAppStore((s) => s.setRooms);
  const addRoom = useAppStore((s) => s.addRoom);
  const { coords, request } = useNeighborhood();

  const [query, setQuery] = useState('');
  const [showSearch, setShowSearch] = useState(false);
  const [showCreate, setShowCreate] = useState(false);

  useEffect(() => {
    request();
  }, [request]);

  // 서버 모드: 내 위치 반경 2km 안의 방을 불러온다
  useEffect(() => {
    api
      .listRooms(coords ?? undefined)
      .then((remote) => remote && setRooms(remote))
      .catch(() => {});
  }, [coords, setRooms]);

  const filtered = useMemo(() => (query ? rooms.filter((r) => r.title.includes(query)) : rooms), [rooms, query]);

  const join = (room: ChatRoom) => router.push({ pathname: '/room/[id]', params: { id: room.id } });

  return (
    <View style={{ flex: 1, backgroundColor: '#fff' }}>
      <ScrollView contentContainerStyle={{ paddingTop: insets.top + 12, paddingHorizontal: 20, paddingBottom: 110, gap: 16 }}>
        <View style={{ gap: 8 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
            <AppText variant="title" color={theme.brand}>
              오픈 채팅방
            </AppText>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="검색"
              hitSlop={10}
              onPress={() => {
                setShowSearch((v) => !v);
                setQuery('');
              }}
            >
              <Ionicons name="search" size={24} color={theme.brand} />
            </Pressable>
          </View>
          {showSearch && (
            <TextInput
              value={query}
              onChangeText={setQuery}
              placeholder="채팅방 이름 검색"
              placeholderTextColor="#9A9AA0"
              style={{ backgroundColor: theme.gray, borderRadius: 12, paddingHorizontal: 14, paddingVertical: 10, fontSize: 16 }}
            />
          )}
        </View>

        {filtered.map((room) => (room.featured ? <FeaturedCard key={room.id} room={room} onJoin={join} /> : <CompactCard key={room.id} room={room} onJoin={join} />))}
      </ScrollView>

      <View style={{ position: 'absolute', bottom: 16, left: 0, right: 0, alignItems: 'center' }}>
        <Pressable
          accessibilityRole="button"
          onPress={() => setShowCreate(true)}
          style={({ pressed }) => ({
            flexDirection: 'row',
            alignItems: 'center',
            gap: 6,
            paddingHorizontal: 26,
            paddingVertical: 14,
            borderRadius: 999,
            backgroundColor: theme.brand,
            opacity: pressed ? 0.9 : 1,
            shadowColor: theme.brand,
            shadowOpacity: 0.35,
            shadowRadius: 8,
            shadowOffset: { width: 0, height: 4 },
            elevation: 5,
          })}
        >
          <Ionicons name="add" size={22} color="#fff" />
          <AppText variant="headline" color="#fff">
            채팅방 만들기
          </AppText>
        </Pressable>
      </View>

      <CreateRoomModal
        visible={showCreate}
        onClose={() => setShowCreate(false)}
        onCreate={async (title, meets) => {
          try {
            const remote = await api.createRoom(title, meets);
            if (remote) setRooms([...useAppStore.getState().rooms, remote]);
            else addRoom(title, meets);
          } catch {
            addRoom(title, meets);
          }
        }}
      />
    </View>
  );
}

function JoinButton({ room, onJoin }: { room: ChatRoom; onJoin: (r: ChatRoom) => void }) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${room.title} 참여하기`}
      onPress={() => onJoin(room)}
      style={({ pressed }) => ({
        alignSelf: 'flex-start',
        paddingHorizontal: 16,
        paddingVertical: 8,
        borderRadius: 10,
        backgroundColor: theme.brand,
        opacity: pressed ? 0.85 : 1,
      })}
    >
      <AppText variant="subhead" color="#fff" bold>
        참여하기
      </AppText>
    </Pressable>
  );
}

function FeaturedCard({ room, onJoin }: { room: ChatRoom; onJoin: (r: ChatRoom) => void }) {
  return (
    <Card style={{ overflow: 'hidden' }}>
      <View style={{ height: 130, backgroundColor: theme.peach, alignItems: 'center', justifyContent: 'center' }}>
        <Ionicons name={room.icon} size={56} color={`${theme.brand}B3`} />
      </View>
      <View style={{ padding: 16, gap: 6 }}>
        <AppText variant="caption" color={theme.brand} bold>
          소통 공간
        </AppText>
        <AppText variant="title3">{room.title}</AppText>
        <AppText variant="callout" color={theme.subInk}>
          {room.meets}
        </AppText>
        <View style={{ marginTop: 4 }}>
          <JoinButton room={room} onJoin={onJoin} />
        </View>
      </View>
    </Card>
  );
}

function CompactCard({ room, onJoin }: { room: ChatRoom; onJoin: (r: ChatRoom) => void }) {
  return (
    <Card style={{ flexDirection: 'row', alignItems: 'center', gap: 14, padding: 14 }}>
      <View style={{ width: 64, height: 64, borderRadius: 14, backgroundColor: theme.peach, alignItems: 'center', justifyContent: 'center' }}>
        <Ionicons name={room.icon} size={28} color={theme.brand} />
      </View>
      <View style={{ flex: 1, gap: 4 }}>
        <AppText variant="headline">{room.title}</AppText>
        <AppText variant="subhead" color={theme.subInk}>
          {room.meets}
        </AppText>
        <JoinButton room={room} onJoin={onJoin} />
      </View>
    </Card>
  );
}

function CreateRoomModal({
  visible,
  onClose,
  onCreate,
}: {
  visible: boolean;
  onClose: () => void;
  onCreate: (title: string, meets: string) => Promise<void>;
}) {
  const [title, setTitle] = useState('');
  const [meets, setMeets] = useState('');
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    const t = title.trim();
    if (!t || busy) return;
    setBusy(true);
    await onCreate(t, meets.trim());
    setBusy(false);
    setTitle('');
    setMeets('');
    onClose();
  };

  const inputStyle = { backgroundColor: theme.gray, borderRadius: 12, paddingHorizontal: 14, paddingVertical: 12, fontSize: 16 } as const;

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.4)' }}>
        <Pressable style={{ flex: 1 }} onPress={onClose} accessibilityLabel="닫기" />
        <View style={{ backgroundColor: '#fff', borderTopLeftRadius: 26, borderTopRightRadius: 26, padding: 22, gap: 12 }}>
          <AppText variant="title3">채팅방 만들기</AppText>
          <AppText variant="subhead" color={theme.subInk}>
            채팅방 이름
          </AppText>
          <TextInput value={title} onChangeText={setTitle} placeholder="예: 우리 동네 산책 모임" placeholderTextColor="#9A9AA0" style={inputStyle} />
          <AppText variant="subhead" color={theme.subInk}>
            모이는 시간 (선택)
          </AppText>
          <TextInput value={meets} onChangeText={setMeets} placeholder="예: 매주 금요일 오전 9:00" placeholderTextColor="#9A9AA0" style={inputStyle} />
          <View style={{ flexDirection: 'row', gap: 10, marginTop: 6 }}>
            <PrimaryButton title="취소" color={theme.brandDark} onPress={onClose} style={{ flex: 1 }} />
            <PrimaryButton title="만들기" onPress={submit} disabled={!title.trim() || busy} style={{ flex: 1 }} />
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}
