// [변경] 서버 채팅 연결, ⋮ 메뉴(꾸미기·예약·나가기), 메시지 길게 누르기(삭제·신고·차단), 스티커·사진 말풍선, 테마, 이모티콘, 사진 보내기
// [변경] 3차: 공지·오늘의 이야깃거리 카드, 공감 버튼, 배경 사진, 방장 메뉴
// [변경] 4차: 자주 쓰는 말 버튼, 모임 참석(갈게요/못 가요), 내 일정에 넣기, 사기 의심 경고, 출석 도장 카드, 사진 크게 보기, 말로 입력(마이크), 방 이름 바꾸기 메뉴
import { useEffect, useRef, useState } from 'react';
import { FlatList, Image, ImageBackground, KeyboardAvoidingView, Modal, Platform, Pressable, ScrollView, TextInput, View } from 'react-native';
import { Stack, router, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import * as Speech from 'expo-speech';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as api from '../../api';
import { NEIGHBOR_RADIUS_KM } from '../../api/config';
import { showDialog } from '../../lib/dialog';
import { chatTheme, type ChatTheme } from '../../lib/chatThemes';
import { AppText } from '../../components/AppText';
import { EmojiPanel } from '../../components/EmojiPanel';
import { CalendarSheet, NoticeSheet, RenameSheet, RoomThemeSheet, ScheduleSheet } from '../../components/RoomSheets';
import { looksRisky } from '../../lib/safety';
import { canListen, startListening } from '../../lib/speechInput';
import { useNeighborhood } from '../../hooks/useNeighborhood';
import { useRoomChat } from '../../hooks/useRoomChat';
import { useAppStore } from '../../store/useAppStore';
import { theme } from '../../theme';
import type { ChatMessage, ChatRoomInfo } from '../../types';

/** 사진 최대 크기 (서버와 같음) */
const MAX_IMAGE_BYTES = 5 * 1024 * 1024;

/** 메시지 미리보기 글 (안내창 제목 아래) */
function previewText(m: ChatMessage) {
  if (m.deleted) return '삭제된 메시지';
  if (m.kind === 'image') return '사진';
  if (m.kind === 'sticker') return `스티커 ${m.text}`;
  return `"${m.text.length > 60 ? `${m.text.slice(0, 60)}…` : m.text}"`;
}

/** 한 번 눌러 바로 보내는 자주 쓰는 말 */
const QUICK_REPLIES = ['네, 좋아요 👍', '고마워요 🙏', '저도 갈게요 🙋', '다음에 봬요 👋', '건강하세요 💐', '맞아요 😊'];

/** PPT '안양 소통방' 화면 */
export default function RoomScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const insets = useSafeAreaInsets();
  const room = useAppStore((s) => s.rooms.find((r) => r.id === id));
  const themeKey = useAppStore((s) => s.roomThemes[id]);
  const setRoomTheme = useAppStore((s) => s.setRoomTheme);
  const background = useAppStore((s) => s.roomBackgrounds[id] ?? null);
  const setRoomBackground = useAppStore((s) => s.setRoomBackground);
  const look = chatTheme(themeKey);
  const { granted, request } = useNeighborhood();

  const [readAloud, setReadAloud] = useState(false);
  const readAloudRef = useRef(false);
  useEffect(() => { readAloudRef.current = readAloud; }, [readAloud]);

  const chat = useRoomChat(id, (m) => {
    if (!readAloudRef.current) return;
    Speech.speak(m.kind === 'image' ? `${m.sender}님이 사진을 보냈어요` : m.kind === 'sticker' ? `${m.sender}님의 스티커` : m.text, { language: 'ko-KR' });
  });
  const { messages } = chat;

  const [input, setInput] = useState('');
  const [showEmoji, setShowEmoji] = useState(false);
  const [showTheme, setShowTheme] = useState(false);
  const [showSchedule, setShowSchedule] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [showNotice, setShowNotice] = useState(false);
  const [bgBusy, setBgBusy] = useState(false);
  const [showRename, setShowRename] = useState(false);
  /** 내 일정에 넣을 글 (null = 닫힘) */
  const [calendarText, setCalendarText] = useState<string | null>(null);
  /** 크게 보는 사진 주소 (null = 닫힘) */
  const [viewer, setViewer] = useState<string | null>(null);
  /** 말로 입력하는 중이면 멈추는 함수 */
  const [listening, setListening] = useState<(() => void) | null>(null);
  const [checkingIn, setCheckingIn] = useState(false);
  const listRef = useRef<FlatList<ChatMessage>>(null);
  const inputRef = useRef<TextInput>(null);

  const submit = async () => {
    const t = input.trim();
    if (!t) return;
    setInput('');
    setShowEmoji(false); // 보내고 나면 이모티콘 창은 닫음
    if (!(await chat.send(t))) {
      // 실패하면 쓴 글을 되돌려 놓고 알려줌
      setInput((cur) => cur || t);
      showDialog('보내지 못했어요', '인터넷 연결을 확인하고 다시 보내 주세요. 너무 빨리 여러 번 보내면 잠시 기다려야 해요.');
    }
  };

  const sendQuick = async (text: string) => {
    if (!(await chat.send(text))) showDialog('보내지 못했어요', '인터넷 연결을 확인하고 다시 보내 주세요.');
  };

  // 마이크: 말하면 입력창에 글자로 (보내기 전에 확인할 수 있게 바로 보내지는 않음)
  const toggleListen = () => {
    if (listening) { listening(); return; }
    if (!canListen()) {
      showDialog('말로 입력하기', Platform.OS === 'web'
        ? '이 브라우저는 말로 입력하기를 지원하지 않아요. 크롬이나 엣지에서 열어 주세요.'
        : '키보드에 있는 🎤 마이크 버튼을 누르고 말씀하시면 글자로 바뀌어요.');
      return;
    }
    setShowEmoji(false);
    const stop = startListening(
      (text) => setInput(text),
      (error) => {
        setListening(null);
        if (error === 'not-allowed' || error === 'service-not-allowed') showDialog('마이크를 쓸 수 없어요', '브라우저 주소창 옆 자물쇠를 눌러 마이크를 허용해 주세요.');
        else if (error && error !== 'no-speech' && error !== 'aborted') showDialog('잘 듣지 못했어요', '조용한 곳에서 다시 말씀해 주세요.');
      },
    );
    if (stop) setListening(() => stop);
  };
  useEffect(() => () => { listening?.(); }, [listening]);

  const doCheckIn = async () => {
    if (checkingIn) return;
    setCheckingIn(true);
    try {
      chat.updateInfo({ ...(chat.info ?? { ownerName: null, isOwner: false, notice: null, topic: '' }), ...(await api.checkIn(id)) });
    } catch {
      showDialog('인사하지 못했어요', '인터넷 연결을 확인하고 다시 눌러 주세요.');
    } finally {
      setCheckingIn(false);
    }
  };

  const answerRsvp = async (answer: 'yes' | 'no') => {
    const next = chat.info?.rsvpMine === answer ? null : answer; // 같은 것을 다시 누르면 취소
    try {
      chat.updateInfo(await api.setRsvp(id, next));
    } catch (e) {
      showDialog('답하지 못했어요', api.serverMessage(e) ?? '인터넷 연결을 확인하고 다시 눌러 주세요.');
    }
  };

  const sendSticker = async (emoji: string) => {
    setShowEmoji(false);
    if (!(await chat.sendSticker(emoji))) showDialog('보내지 못했어요', '인터넷 연결을 확인하고 다시 보내 주세요.');
  };

  const pickPhoto = async () => {
    if (uploading) return;
    const res = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], quality: 0.6 });
    if (res.canceled || !res.assets?.[0]) return;
    const asset = res.assets[0];
    if (asset.fileSize && asset.fileSize > MAX_IMAGE_BYTES) {
      showDialog('사진이 너무 커요', '5MB 보다 작은 사진을 골라 주세요.');
      return;
    }
    setUploading(true);
    const r = await chat.sendImage(asset.uri, asset.mimeType ?? undefined);
    setUploading(false);
    if (!r.ok) showDialog('사진을 보내지 못했어요', r.message ?? '인터넷 연결을 확인하고 다시 보내 주세요.');
  };

  // 채팅방 꾸미기: 내 사진을 배경으로 (서버에 올려 두고 주소만 내 기기에 저장 → 나에게만 보임)
  const pickBackground = async () => {
    if (bgBusy) return;
    const res = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], quality: 0.6 });
    if (res.canceled || !res.assets?.[0]) return;
    const asset = res.assets[0];
    if (asset.fileSize && asset.fileSize > MAX_IMAGE_BYTES) {
      showDialog('사진이 너무 커요', '5MB 보다 작은 사진을 골라 주세요.');
      return;
    }
    setBgBusy(true);
    try {
      setRoomBackground(id, await api.uploadBackground(id, asset.uri, asset.mimeType ?? undefined));
    } catch (e) {
      showDialog('배경을 바꾸지 못했어요', api.serverMessage(e) ?? '인터넷 연결을 확인하고 다시 시도해 주세요.');
    } finally {
      setBgBusy(false);
    }
  };

  // 오늘의 이야깃거리를 입력창에 넣어 줌 (그대로 보내거나 고쳐서 보내기)
  const useTopic = (topic: string) => {
    setInput(topic);
    setShowEmoji(false);
    inputRef.current?.focus();
  };

  const like = async (msg: ChatMessage) => {
    if (!(await chat.toggleLike(msg))) showDialog('공감하지 못했어요', '인터넷 연결을 확인하고 다시 눌러 주세요.');
  };

  const toggleReadAloud = () => {
    if (readAloud) Speech.stop();
    setReadAloud((v) => !v);
  };

  // 오른쪽 위 ⋮ : 채팅방 메뉴
  const openMenu = () => {
    if (chat.status !== 'ready') {
      showDialog('아직 채팅방에 들어가지 못했어요', chat.statusMessage || '잠시만 기다려 주세요.');
      return;
    }
    const ownerItems = chat.info?.isOwner
      ? [
          { text: '방 이름 바꾸기 (방장)', onPress: () => setShowRename(true) },
          { text: '방 공지 쓰기 (방장)', onPress: () => setShowNotice(true) },
        ]
      : [];
    showDialog(roomTitle, chat.info?.isOwner ? '내가 이 방의 방장이에요.' : undefined, [
      ...ownerItems,
      { text: '채팅방 꾸미기', onPress: () => setShowTheme(true) },
      { text: '예약 메시지', onPress: () => setShowSchedule(true) },
      { text: '신고·차단 방법', onPress: () => showDialog('이웃 신고·차단', '불편한 메시지를 길게 누르면 신고하거나 그 이웃을 차단할 수 있어요.') },
      { text: '채팅방 나가기', style: 'destructive', onPress: askLeave },
      { text: '취소', style: 'cancel' },
    ]);
  };

  const askLeave = () => {
    const ownerNote = chat.info?.isOwner ? '\n방장은 먼저 들어온 이웃에게 넘어가요.' : '';
    const roomNote = !id.startsWith('room-') // 이웃이 만든 방 (기본 공용 방 id 는 room-…)
      ? '\n내 채팅방 목록에서도 사라지고, 마지막 사람이 나가면 방이 닫혀요.'
      : '\n다시 들어오면 나간 뒤의 대화부터 보여요.';
    showDialog('채팅방에서 나갈까요?', `내가 쓴 글은 방에 남고, 예약한 메시지는 취소돼요.${roomNote}${ownerNote}`, [
      { text: '취소', style: 'cancel' },
      {
        text: '나가기',
        style: 'destructive',
        onPress: async () => {
          try {
            await api.leaveRoom(id);
          } catch {
            showDialog('나가지 못했어요', '인터넷 연결을 확인하고 다시 시도해 주세요.');
            return;
          }
          if (router.canGoBack()) router.back();
          else router.replace('/(tabs)/community');
        },
      },
    ]);
  };

  // 메시지 길게 누르기 → 내 메시지: 삭제 / 이웃 메시지: 신고·차단·나에게만 삭제
  const openMessageMenu = (msg: ChatMessage) => {
    if (msg.kind === 'system') return;
    const hideForMe = { text: '나에게만 삭제', onPress: () => { void deleteFor(msg, 'me'); } };
    if (msg.deleted) {
      showDialog('삭제된 메시지', undefined, [hideForMe, { text: '취소', style: 'cancel' }]);
      return;
    }
    const toCalendar = msg.kind === 'text' || msg.kind === undefined
      ? [{ text: '내 일정에 넣기', onPress: () => setCalendarText(msg.text) }]
      : [];
    if (msg.isMine) {
      showDialog('내 메시지', previewText(msg), [
        ...toCalendar,
        { text: '모두에게 삭제', style: 'destructive', onPress: () => askDeleteAll(msg) },
        hideForMe,
        { text: '취소', style: 'cancel' },
      ]);
      return;
    }
    showDialog(`${msg.sender}의 메시지`, previewText(msg), [
      ...toCalendar,
      { text: '신고하기', onPress: () => askReportReason(msg) },
      { text: '차단하기', style: 'destructive', onPress: () => askBlock(msg) },
      hideForMe,
      { text: '취소', style: 'cancel' },
    ]);
  };

  const askDeleteAll = (msg: ChatMessage) => {
    showDialog('모두에게서 삭제할까요?', '이웃들 화면에서도 "삭제된 메시지예요"로 바뀌어요.', [
      { text: '취소', style: 'cancel' },
      { text: '삭제', style: 'destructive', onPress: () => { void deleteFor(msg, 'all'); } },
    ]);
  };

  const deleteFor = async (msg: ChatMessage, scope: 'all' | 'me') => {
    if (!(await chat.deleteMessage(msg.id, scope))) showDialog('삭제하지 못했어요', '인터넷 연결을 확인하고 다시 시도해 주세요.');
  };

  const askReportReason = (msg: ChatMessage) => {
    showDialog('신고 이유를 골라 주세요', undefined, [
      ...api.REPORT_REASONS.map((r) => ({ text: r.label, onPress: () => { void doReport(msg, r.key); } })),
      { text: '취소', style: 'cancel' as const },
    ]);
  };

  const doReport = async (msg: ChatMessage, reason: api.ReportReason) => {
    try {
      const res = await api.reportMessage(id, msg.id, reason);
      if (res.hidden) chat.remove(msg.id);
      showDialog(
        res.alreadyReported ? '이미 신고한 메시지예요' : '신고가 접수되었어요',
        res.hidden ? '여러 이웃이 신고해서 이 메시지를 가렸어요.' : '운영팀이 확인할게요. 여러 이웃이 신고하면 자동으로 가려져요.',
      );
    } catch {
      showDialog('신고하지 못했어요', '인터넷 연결을 확인하고 다시 시도해 주세요.');
    }
  };

  const askBlock = (msg: ChatMessage) => {
    showDialog('이 이웃을 차단할까요?', '차단하면 이 이웃의 메시지가 모든 채팅방에서 보이지 않아요.', [
      { text: '취소', style: 'cancel' },
      {
        text: '차단하기',
        style: 'destructive',
        onPress: async () => {
          try {
            await api.blockSender(id, msg.id);
          } catch {
            showDialog('차단하지 못했어요', '인터넷 연결을 확인하고 다시 시도해 주세요.');
            return;
          }
          chat.hideSender(msg.sender);
          showDialog('차단했어요', '이 이웃의 메시지가 더 이상 보이지 않아요.');
        },
      },
    ]);
  };

  const roomTitle = chat.info?.title || room?.title || '채팅방';
  const memberLabel = chat.memberCount === null ? '' : chat.maxMembers ? ` · ${chat.memberCount}/${chat.maxMembers}명` : ` · ${chat.memberCount}명`;
  const canChat = chat.status === 'ready';

  return (
    <KeyboardAvoidingView style={{ flex: 1, backgroundColor: look.background }} behavior={Platform.OS === 'ios' ? 'padding' : undefined} keyboardVerticalOffset={Platform.OS === 'ios' ? 90 : 0}>
      <Stack.Screen
        options={{
          title: `${roomTitle}${memberLabel}`,
          headerRight: () => (
            <Pressable accessibilityRole="button" accessibilityLabel="채팅방 메뉴" hitSlop={10} onPress={openMenu}>
              <Ionicons name="ellipsis-vertical" size={22} color={theme.brand} />
            </Pressable>
          ),
        }}
      />

      <ImageBackground
        source={background ? { uri: api.imageUrl(background) } : undefined}
        style={{ flex: 1 }}
        resizeMode="cover"
        accessibilityIgnoresInvertColors
      >
      {/* 배경 사진이 있으면 글이 잘 보이도록 테마 색을 반투명하게 덮음 */}
      <View style={{ flex: 1, backgroundColor: background ? `${look.background}B8` : 'transparent' }}>
      {!canChat ? (
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', gap: 14, padding: 24 }}>
          <Ionicons name={chat.status === 'full' ? 'people' : chat.status === 'error' ? 'cloud-offline-outline' : 'chatbubbles-outline'} size={56} color="#C9C9CE" />
          <AppText variant="headline" center>
            {chat.status === 'joining' ? '채팅방에 들어가는 중이에요…' : chat.statusMessage}
          </AppText>
          {chat.status !== 'joining' ? (
            <View style={{ flexDirection: 'row', gap: 10 }}>
              <Pressable accessibilityRole="button" onPress={() => router.back()} style={{ paddingHorizontal: 18, paddingVertical: 12, borderRadius: 14, backgroundColor: theme.gray }}>
                <AppText bold>돌아가기</AppText>
              </Pressable>
              <Pressable accessibilityRole="button" onPress={chat.retryJoin} style={{ paddingHorizontal: 18, paddingVertical: 12, borderRadius: 14, backgroundColor: theme.brand }}>
                <AppText bold color="#fff">다시 시도</AppText>
              </Pressable>
            </View>
          ) : null}
        </View>
      ) : (
        <FlatList
          ref={listRef}
          data={messages}
          keyExtractor={(m) => m.id}
          contentContainerStyle={{ padding: 16, gap: 12, flexGrow: 1 }}
          // 새 메시지가 오면 맨 아래로. 그림이 늦게 그려져도 끝까지 내려가도록 그린 다음에 한 번 더
          onContentSizeChange={() => {
            listRef.current?.scrollToEnd({ animated: true });
            setTimeout(() => listRef.current?.scrollToEnd({ animated: false }), 350);
          }}
          ListHeaderComponent={
            <View style={{ alignItems: 'center', marginBottom: 8 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 14, paddingVertical: 7, borderRadius: 999, backgroundColor: `${theme.peach}CC` }}>
                <Ionicons name="location" size={14} color={theme.brand} />
                <AppText variant="footnote" color={theme.brand} bold onPress={granted ? undefined : request}>
                  {granted ? `반경 ${NEIGHBOR_RADIUS_KM}km 이내 이웃 소통 중` : `위치를 허용하면 반경 ${NEIGHBOR_RADIUS_KM}km 이웃과 연결돼요`}
                </AppText>
              </View>
              {chat.info ? (
                <RoomInfoCards
                  info={chat.info}
                  onTopic={useTopic}
                  onEditNotice={() => setShowNotice(true)}
                  onRsvp={answerRsvp}
                  onNoticeToCalendar={() => setCalendarText(chat.info?.notice ?? '')}
                  onCheckIn={doCheckIn}
                  checkingIn={checkingIn}
                />
              ) : null}
            </View>
          }
          ListEmptyComponent={
            <View style={{ alignItems: 'center', gap: 12, paddingTop: 80 }}>
              <Ionicons name="chatbubble-ellipses-outline" size={64} color="#C9C9CE" />
              <AppText variant="footnote" color={look.subText} center>
                {'우리 동네 대화방에 오신 것을 환영합니다.\n아래 창에 첫 인사를 남겨보세요!'}
              </AppText>
            </View>
          }
          renderItem={({ item }) => (
            <Pressable
              onPress={item.kind === 'image' && !item.deleted ? () => setViewer(api.imageUrl(item.text)) : undefined}
              onLongPress={() => openMessageMenu(item)}
              delayLongPress={400}
              disabled={item.kind === 'system'}
              accessibilityHint={item.kind === 'system' ? undefined : item.isMine ? '길게 누르면 삭제할 수 있어요' : '길게 누르면 신고·차단하거나 나에게서 지울 수 있어요'}
            >
              <Bubble msg={item} look={look} onLike={like} />
            </Pressable>
          )}
        />
      )}
      </View>
      </ImageBackground>

      {canChat && !input && !showEmoji && !listening ? (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
          style={{ flexGrow: 0, backgroundColor: '#fff', borderTopWidth: 1, borderTopColor: theme.line }}
          contentContainerStyle={{ gap: 8, paddingHorizontal: 14, paddingVertical: 10 }}
        >
          {QUICK_REPLIES.map((q) => (
            <Pressable
              key={q}
              accessibilityRole="button"
              accessibilityLabel={`${q} 바로 보내기`}
              onPress={() => { void sendQuick(q); }}
              style={({ pressed }) => ({ paddingHorizontal: 16, paddingVertical: 10, borderRadius: 999, backgroundColor: pressed ? theme.peach : theme.surface, borderWidth: 1, borderColor: theme.line })}
            >
              <AppText variant="callout" bold color={theme.brandDark}>{q}</AppText>
            </Pressable>
          ))}
        </ScrollView>
      ) : null}

      {listening ? (
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, paddingVertical: 10, backgroundColor: '#FDE3E1' }}>
          <Ionicons name="mic" size={18} color={theme.listening} />
          <AppText variant="callout" bold color={theme.listening}>듣고 있어요… 말씀하신 뒤 빨간 버튼을 누르세요</AppText>
        </View>
      ) : null}

      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 14, paddingTop: 10, paddingBottom: showEmoji ? 10 : insets.bottom + 10, borderTopWidth: 1, borderTopColor: theme.line, backgroundColor: '#fff', opacity: canChat ? 1 : 0.5 }} pointerEvents={canChat ? 'auto' : 'none'}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="메시지 소리로 듣기"
          accessibilityState={{ selected: readAloud }}
          onPress={toggleReadAloud}
          style={{ width: 42, height: 42, borderRadius: 21, backgroundColor: theme.gray, alignItems: 'center', justifyContent: 'center' }}
        >
          <Ionicons name={readAloud ? 'volume-high' : 'volume-mute'} size={20} color={readAloud ? theme.brand : theme.subInk} />
        </Pressable>

        <View style={{ flex: 1, minWidth: 0, flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: theme.gray, borderRadius: 999, paddingHorizontal: 14 }}>
          <TextInput
            ref={inputRef}
            value={input}
            onChangeText={setInput}
            onFocus={() => setShowEmoji(false)}
            placeholder={listening ? '말씀하세요…' : '메시지를 입력하세요'}
            placeholderTextColor="#9A9AA0"
            onSubmitEditing={submit}
            returnKeyType="send"
            style={{ flex: 1, minWidth: 0, width: '100%', paddingVertical: 11, fontSize: 16 }}
          />
          <Pressable accessibilityRole="button" accessibilityLabel={uploading ? '사진 보내는 중' : '사진 보내기'} hitSlop={8} onPress={pickPhoto} disabled={uploading}>
            <Ionicons name={uploading ? 'hourglass-outline' : 'image-outline'} size={22} color={theme.subInk} />
          </Pressable>
          <Pressable accessibilityRole="button" accessibilityLabel="이모티콘" accessibilityState={{ expanded: showEmoji }} hitSlop={8} onPress={() => setShowEmoji((v) => !v)}>
            <Ionicons name={showEmoji ? 'happy' : 'happy-outline'} size={22} color={showEmoji ? theme.brand : theme.subInk} />
          </Pressable>
        </View>

        <Pressable
          accessibilityRole="button"
          accessibilityLabel={listening ? '그만 듣기' : input.trim() ? '보내기' : '말로 입력하기'}
          onPress={() => {
            if (listening) { listening(); return; }
            if (input.trim()) void submit();
            else toggleListen();
          }}
          style={{ width: 46, height: 46, borderRadius: 23, backgroundColor: listening ? theme.listening : theme.brand, alignItems: 'center', justifyContent: 'center' }}
        >
          <Ionicons name={listening ? 'stop' : input.trim() ? 'arrow-up' : 'mic'} size={22} color="#fff" />
        </Pressable>
      </View>

      {showEmoji && canChat ? (
        <View style={{ paddingBottom: insets.bottom, backgroundColor: '#fff' }}>
          <EmojiPanel onEmoji={(e) => setInput((v) => `${v}${e}`)} onSticker={sendSticker} />
        </View>
      ) : null}

      <RoomThemeSheet
        visible={showTheme}
        onClose={() => setShowTheme(false)}
        value={look.key}
        onChange={(k) => setRoomTheme(id, k)}
        background={background}
        onPickBackground={pickBackground}
        onClearBackground={() => setRoomBackground(id, null)}
        busy={bgBusy}
      />
      <RenameSheet visible={showRename} onClose={() => setShowRename(false)} roomId={id} current={roomTitle} onSaved={(i) => chat.updateInfo({ ...(chat.info ?? i), ...i })} />
      <CalendarSheet visible={calendarText !== null} onClose={() => setCalendarText(null)} sourceText={calendarText ?? ''} />
      <PhotoViewer uri={viewer} onClose={() => setViewer(null)} />
      <NoticeSheet visible={showNotice} onClose={() => setShowNotice(false)} roomId={id} current={chat.info?.notice ?? null} onSaved={chat.updateInfo} />
      <ScheduleSheet visible={showSchedule} onClose={() => setShowSchedule(false)} roomId={id} initialText={input} onScheduled={() => setInput('')} />
    </KeyboardAvoidingView>
  );
}

/** 방 위쪽: 공지와 참석 체크 · 출석 도장 · 오늘의 이야깃거리 */
function RoomInfoCards({ info, onTopic, onEditNotice, onRsvp, onNoticeToCalendar, onCheckIn, checkingIn }: {
  info: ChatRoomInfo;
  onTopic: (t: string) => void;
  onEditNotice: () => void;
  onRsvp: (a: 'yes' | 'no') => void;
  onNoticeToCalendar: () => void;
  onCheckIn: () => void;
  checkingIn: boolean;
}) {
  const yes = info.rsvpYes ?? 0;
  const no = info.rsvpNo ?? 0;
  const names = info.rsvpYesNames ?? [];
  const rsvpButton = (answer: 'yes' | 'no', label: string, count: number, icon: 'hand-right' | 'close-circle') => {
    const on = info.rsvpMine === answer;
    return (
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`${label} ${count}명`}
        accessibilityState={{ selected: on }}
        onPress={() => onRsvp(answer)}
        style={({ pressed }) => ({
          flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: 12, borderRadius: 14,
          backgroundColor: on ? (answer === 'yes' ? theme.brand : theme.brandDark) : '#fff',
          borderWidth: 1.5, borderColor: on ? 'transparent' : theme.line, opacity: pressed ? 0.85 : 1,
        })}
      >
        <Ionicons name={icon} size={20} color={on ? '#fff' : answer === 'yes' ? theme.brand : theme.subInk} />
        <AppText variant="headline" color={on ? '#fff' : theme.ink}>{`${label} ${count}`}</AppText>
      </Pressable>
    );
  };

  return (
    <View style={{ alignSelf: 'stretch', gap: 10, marginTop: 10 }}>
      {info.notice ? (
        <View style={{ gap: 10, padding: 14, borderRadius: 18, backgroundColor: '#FFFFFFF2', borderWidth: 1, borderColor: theme.line, borderLeftWidth: 5, borderLeftColor: theme.brand }}>
          <Pressable
            disabled={!info.isOwner}
            onPress={onEditNotice}
            accessibilityLabel={`공지: ${info.notice}`}
            accessibilityHint={info.isOwner ? '누르면 공지를 고칠 수 있어요' : undefined}
            style={{ flexDirection: 'row', gap: 10 }}
          >
            <Ionicons name="megaphone" size={22} color={theme.brand} />
            <View style={{ flex: 1, gap: 2 }}>
              <AppText variant="caption" bold color={theme.brand}>{info.isOwner ? '공지 (누르면 고치기)' : '공지'}</AppText>
              <AppText variant="callout">{info.notice}</AppText>
            </View>
          </Pressable>
          <View style={{ flexDirection: 'row', gap: 8 }}>
            {rsvpButton('yes', '갈게요', yes, 'hand-right')}
            {rsvpButton('no', '못 가요', no, 'close-circle')}
          </View>
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
            <AppText variant="caption" color={theme.subInk} style={{ flex: 1 }} numberOfLines={2}>
              {names.length ? `오는 이웃: ${names.join(', ')}${yes > names.length ? ` 외 ${yes - names.length}명` : ''}` : '아직 답한 이웃이 없어요'}
            </AppText>
            <Pressable accessibilityRole="button" accessibilityLabel="공지를 내 일정에 넣기" onPress={onNoticeToCalendar} hitSlop={6}
              style={{ flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 12, paddingVertical: 8, borderRadius: 999, backgroundColor: theme.peach }}>
              <Ionicons name="calendar" size={16} color={theme.brand} />
              <AppText variant="subhead" bold color={theme.brand}>내 일정에 넣기</AppText>
            </Pressable>
          </View>
        </View>
      ) : null}

      {/* 출석 도장: 하루 한 번 인사 */}
      {info.checkedInToday ? (
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, padding: 12, borderRadius: 18, backgroundColor: '#EEF7ECF2' }}>
          <View style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: '#fff', alignItems: 'center', justifyContent: 'center' }}>
            <Ionicons name="checkmark-circle" size={26} color="#3E8E41" />
          </View>
          <View style={{ flex: 1 }}>
            <AppText variant="headline" color="#2E6B30">{`오늘 인사했어요 · 연속 ${info.streak ?? 1}일`}</AppText>
            <AppText variant="caption" color="#4E6B48">{`오늘 ${info.checkinCount ?? 1}명의 이웃이 인사했어요`}</AppText>
          </View>
        </View>
      ) : (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="오늘 인사하기 (출석 도장)"
          onPress={onCheckIn}
          disabled={checkingIn}
          style={({ pressed }) => ({ flexDirection: 'row', alignItems: 'center', gap: 12, padding: 14, borderRadius: 18, backgroundColor: theme.brand, opacity: pressed || checkingIn ? 0.85 : 1 })}
        >
          <View style={{ width: 44, height: 44, borderRadius: 22, backgroundColor: '#FFFFFF33', alignItems: 'center', justifyContent: 'center' }}>
            <Ionicons name="sunny" size={26} color="#fff" />
          </View>
          <View style={{ flex: 1 }}>
            <AppText variant="headline" color="#fff">{checkingIn ? '인사하는 중…' : '오늘 인사하기'}</AppText>
            <AppText variant="caption" color="#FFF4EA">
              {(info.checkinCount ?? 0) > 0 ? `오늘 ${info.checkinCount}명이 인사했어요 · 출석 도장 받기` : '한 번 누르면 이웃에게 인사가 가요 · 출석 도장'}
            </AppText>
          </View>
          <Ionicons name="chevron-forward" size={22} color="#fff" />
        </Pressable>
      )}

      <View style={{ padding: 14, borderRadius: 18, backgroundColor: '#FFF4EAF2', gap: 8 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
          <Ionicons name="bulb-outline" size={18} color={theme.brand} />
          <AppText variant="caption" bold color={theme.brand}>오늘의 이야깃거리</AppText>
        </View>
        <AppText variant="headline">{info.topic}</AppText>
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8, flexWrap: 'wrap' }}>
          <AppText variant="caption" color={theme.subInk}>
            {info.ownerName ? `방장 ${info.isOwner ? '나' : info.ownerName}` : '담화 운영팀이 함께해요'}
          </AppText>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="이 이야기 꺼내기"
            onPress={() => onTopic(info.topic)}
            style={{ paddingHorizontal: 14, paddingVertical: 8, borderRadius: 999, backgroundColor: theme.brand }}
          >
            <AppText variant="subhead" bold color="#fff">이 이야기 꺼내기</AppText>
          </Pressable>
        </View>
      </View>
    </View>
  );
}

/** 사진 크게 보기 (화면 가득, 큰 닫기 버튼) */
function PhotoViewer({ uri, onClose }: { uri: string | null; onClose: () => void }) {
  const insets = useSafeAreaInsets();
  return (
    <Modal visible={!!uri} animationType="fade" transparent onRequestClose={onClose}>
      <View style={{ flex: 1, backgroundColor: '#000000F0' }}>
        <Pressable style={{ flex: 1, padding: 12, paddingTop: insets.top + 12 }} onPress={onClose} accessibilityLabel="사진 닫기">
          {uri ? <Image source={{ uri }} style={{ flex: 1 }} resizeMode="contain" accessibilityLabel="크게 본 사진" /> : null}
        </Pressable>
        <View style={{ alignItems: 'center', paddingBottom: insets.bottom + 20, paddingTop: 8 }}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="닫기"
            onPress={onClose}
            style={{ flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 40, paddingVertical: 16, borderRadius: 999, backgroundColor: '#fff' }}
          >
            <Ionicons name="close" size={24} color={theme.ink} />
            <AppText variant="title3">닫기</AppText>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}

/** 공감(하트): 이웃 글은 눌러서 공감, 내 글은 받은 공감 수만 */
function LikeChip({ msg, look, onLike }: { msg: ChatMessage; look: ChatTheme; onLike: (m: ChatMessage) => void }) {
  const count = msg.likeCount ?? 0;
  if (msg.isMine) {
    if (!count) return null;
    return (
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 3, marginTop: 4 }} accessibilityLabel={`공감 ${count}개`}>
        <Ionicons name="heart" size={14} color={theme.listening} />
        <AppText variant="caption" color={look.subText}>{String(count)}</AppText>
      </View>
    );
  }
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={msg.likedByMe ? `공감 취소 (공감 ${count}개)` : `공감하기 (공감 ${count}개)`}
      accessibilityState={{ selected: !!msg.likedByMe }}
      onPress={() => onLike(msg)}
      hitSlop={8}
      style={{ flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 4, paddingHorizontal: 10, paddingVertical: 4, borderRadius: 999, backgroundColor: msg.likedByMe ? '#FDE3E1' : '#FFFFFFCC', borderWidth: 1, borderColor: msg.likedByMe ? '#F6B5B0' : theme.line }}
    >
      <Ionicons name={msg.likedByMe ? 'heart' : 'heart-outline'} size={16} color={theme.listening} />
      <AppText variant="caption" bold color={msg.likedByMe ? theme.listening : '#61616B'}>{count ? `공감 ${count}` : '공감'}</AppText>
    </Pressable>
  );
}

function Bubble({ msg, look, onLike }: { msg: ChatMessage; look: ChatTheme; onLike: (m: ChatMessage) => void }) {
  const textSize = look.bigText ? { fontSize: 21, lineHeight: 29 } : undefined;

  // "이웃 3님이 들어왔어요" 같은 안내
  if (msg.kind === 'system') {
    return (
      <View style={{ alignItems: 'center' }}>
        <View style={{ paddingHorizontal: 12, paddingVertical: 5, borderRadius: 999, backgroundColor: look.key === 'night' ? '#3A3330' : '#00000010' }}>
          <AppText variant="caption" color={look.subText}>{msg.text}</AppText>
        </View>
      </View>
    );
  }

  let body: React.ReactNode;
  if (msg.deleted) {
    body = (
      <View style={{ paddingHorizontal: 14, paddingVertical: 10, borderRadius: 18, borderWidth: 1, borderStyle: 'dashed', borderColor: look.subText }}>
        <AppText color={look.subText} style={{ fontStyle: 'italic' }}>삭제된 메시지예요</AppText>
      </View>
    );
  } else if (msg.kind === 'sticker') {
    body = <AppText style={{ fontSize: 64, lineHeight: 76 }} accessibilityLabel="스티커">{msg.text}</AppText>;
  } else if (msg.kind === 'image') {
    body = (
      <Image
        source={{ uri: api.imageUrl(msg.text) }}
        accessibilityLabel={`${msg.isMine ? '내가' : msg.sender} 보낸 사진 (누르면 크게 보기)`}
        style={{ width: 220, height: 220, borderRadius: 16, backgroundColor: '#E9E4DF' }}
        resizeMode="cover"
      />
    );
  } else {
    body = (
      <View
        style={{
          maxWidth: '78%',
          paddingHorizontal: 14,
          paddingVertical: 10,
          borderRadius: 18,
          backgroundColor: msg.isMine ? look.mine : look.other,
          borderWidth: !msg.isMine && look.otherBorder ? 1.5 : 0,
          borderColor: look.otherBorder,
        }}
      >
        <AppText color={look.text} style={textSize}>{msg.text}</AppText>
      </View>
    );
  }

  return (
    <View style={{ alignItems: msg.isMine ? 'flex-end' : 'flex-start' }}>
      {!msg.isMine && (
        <AppText variant="caption" color={look.subText} style={{ marginBottom: 3 }}>
          {msg.sender}
        </AppText>
      )}
      {body}
      {!msg.isMine && !msg.deleted && (msg.kind ?? 'text') === 'text' && looksRisky(msg.text) ? (
        <View
          accessibilityRole="alert"
          style={{ maxWidth: '82%', flexDirection: 'row', alignItems: 'flex-start', gap: 6, marginTop: 6, padding: 10, borderRadius: 12, backgroundColor: '#FFF3CD', borderWidth: 1, borderColor: '#F0C36D' }}
        >
          <Ionicons name="warning" size={18} color="#B26A00" />
          <AppText variant="footnote" color="#7A4A00" style={{ flex: 1 }}>
            전화번호·인터넷 주소·돈 이야기가 있어요. 모르는 분이면 연락하거나 돈을 보내지 마세요.
          </AppText>
        </View>
      ) : null}
      {msg.deleted ? null : <LikeChip msg={msg} look={look} onLike={onLike} />}
    </View>
  );
}
