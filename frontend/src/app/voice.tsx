import { useEffect, useRef, useState } from 'react';
import { Animated, Easing, KeyboardAvoidingView, Platform, Pressable, ScrollView, TextInput, View } from 'react-native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useKeepAwake } from 'expo-keep-awake';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as api from '../api';
import { AppText } from '../components/AppText';
import { DamaMascot } from '../components/DamaMascot';
import { FloatingDama, type DamaMode } from '../components/FloatingDama';
import { Breathe, FadeInUp, Particles, PopIn, Ripples, SoundBars, ThinkingDots } from '../components/Motion';
import { PrimaryButton } from '../components/PrimaryButton';
import { ScheduleIcon } from '../components/ScheduleIcon';
import { formatAmPm, formatDay, relativeDayLabel } from '../lib/format';
import { scheduleReminder } from '../lib/notifications';
import { parseSchedules } from '../lib/scheduleParser';
import { useAppStore } from '../store/useAppStore';
import { theme, shadow } from '../theme';
import type { IconName, TranscriptTurn } from '../types';
import { useVoiceSession } from '../voice/useVoiceSession';
import type { VoiceState } from '../voice/types';

const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

/** 누르기만 하면 말한 것처럼 보내지는 빠른 답변 */
const QUICK_REPLIES = ['오늘 산책했어요', '내일 병원 가요', '기분이 좋아요', '조금 피곤해요', '손주가 놀러 왔어요', '밥 잘 먹었어요'];

const STATUS: Record<VoiceState | 'wrapping', { text: string; color: string }> = {
  idle: { text: '대기 중', color: theme.subInk },
  connecting: { text: '다마를 부르는 중', color: theme.brandDark },
  listening: { text: '듣고 있어요', color: theme.listening },
  thinking: { text: '생각하는 중', color: theme.brandDark },
  speaking: { text: '말하는 중', color: theme.brand },
  error: { text: '연결이 끊겼어요', color: theme.listening },
  wrapping: { text: '대화 정리 중', color: theme.brand },
};

/** PPT '먼저 다가오는 AI'(듣는중/말하는중) + '대화 중 자동 일정 정리'(정리 완료 팝업) */
export default function VoiceScreen() {
  useKeepAwake();
  const insets = useSafeAreaInsets();
  const session = useVoiceSession();
  const confirmConversation = useAppStore((s) => s.confirmConversation);
  const notificationsEnabled = useAppStore((s) => s.notificationsEnabled);

  const [wrapping, setWrapping] = useState(false);
  const [summary, setSummary] = useState<api.ConversationSummary | null>(null);
  const [typed, setTyped] = useState('');
  const [keyboard, setKeyboard] = useState(false);
  const [elapsed, setElapsed] = useState(0);

  const { state, start } = session;

  const conversationIdRef = useRef<string | null>(null);

  // 화면이 열리면 AI가 먼저 안부를 묻는다
  useEffect(() => {
  const initializeConversation = async () => {
    try {
      const conversation = await api.createConversation('1');

      conversationIdRef.current = conversation.id;

      console.log('대화 생성 완료:', conversation.id);

      start();
    } catch (error) {
      console.error('대화 생성 실패:', error);
    }
  };

  initializeConversation();
}, [start]);

  // 통화 시간
  const live = !wrapping && state !== 'idle' && state !== 'error';
  useEffect(() => {
    if (!live) return;
    const t = setInterval(() => setElapsed((e) => e + 1), 1000);
    return () => clearInterval(t);
  }, [live]);

  // 말하기 버튼 맥박
  const [pulse] = useState(() => new Animated.Value(0));
  useEffect(() => {
    if (state !== 'listening') {
      pulse.setValue(0);
      return;
    }
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, { toValue: 1, duration: 900, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
        Animated.timing(pulse, { toValue: 0, duration: 900, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [state, pulse]);

  const close = () => {
    session.stop();
    router.back();
  };

  const finish = async () => {
    if (wrapping) return;
    setWrapping(true);
    setKeyboard(false);
    session.stop();
    const transcript = session.getTranscript();
    
    const conversationId = conversationIdRef.current;

    if (conversationId) {
      for (const turn of transcript) {
        const role = turn.role === 'user' ? 'elder' : 'ai';

        await api.createConversationMessage(
          conversationId,
          role,
          turn.text,
        );
      }
    }
    const fallback = (): api.ConversationSummary => {
      const users = transcript.filter((t) => t.role === 'user').map((t) => t.text);
      return { summary: users.join(' · ').slice(0, 80) || '오늘 나눈 이야기', pending: parseSchedules(users.join('. ')) };
    };
    const [result] = await Promise.all([api.endConversation(transcript).catch(fallback), sleep(1500)]);
    setSummary(result);
  };

  const confirm = () => {
    if (!summary) return;
    confirmConversation(summary.pending, summary.summary, [...session.getTranscript()]);
    api.confirmSchedules(summary.pending).catch(() => {});
    if (notificationsEnabled) summary.pending.forEach((it) => scheduleReminder(it).catch(() => {}));
    router.back();
  };

  const retry = () => {
    setSummary(null);
    setWrapping(false);
    session.start();
  };

  const sendText = (text: string) => {
    const t = text.trim();
    if (!t) return;
    setTyped('');
    session.sendText(t);
  };

  const onMainButton = () => {
    if (state === 'listening') {
      // 데모: 입력창에 쓴 말이 있으면 그 말을 보내고, 없으면 다 말한 것으로 넘긴다
      if (typed.trim()) sendText(typed);
      else session.commitTurn();
    } else if (state === 'speaking') session.interrupt();
    else if (state === 'idle' || state === 'error') session.start();
  };

  const status = STATUS[wrapping ? 'wrapping' : state];
  const talking = wrapping || state === 'speaking';
  const listening = state === 'listening' && !wrapping;
  const damaMode: DamaMode = talking
    ? 'talk'
    : listening
      ? 'listen'
      : state === 'thinking' || state === 'connecting'
        ? 'think'
        : state === 'error'
          ? 'still'
          : 'idle';

  const mainColor = listening ? theme.listening : state === 'speaking' ? theme.ink : theme.brand;
  const mainLabel = wrapping ? '정리 중' : listening ? '다 말했어요' : state === 'speaking' ? '그만 말하기' : state === 'idle' || state === 'error' ? '대화 시작' : '잠시만요';
  const mainIcon: IconName = state === 'idle' || state === 'error' ? 'mic' : listening ? 'checkmark' : state === 'speaking' ? 'hand-left' : 'ellipsis-horizontal';
  const mainDisabled = wrapping || state === 'connecting' || state === 'thinking';

  const mm = String(Math.floor(elapsed / 60)).padStart(2, '0');
  const ss = String(elapsed % 60).padStart(2, '0');

  return (
    <KeyboardAvoidingView style={{ flex: 1, backgroundColor: '#FFF4EA' }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      {/* 배경 빛 */}
      <View pointerEvents="none" style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, overflow: 'hidden' }}>
        <View style={{ position: 'absolute', width: 420, height: 420, borderRadius: 210, backgroundColor: '#FFE2C8', top: -160, alignSelf: 'center', opacity: 0.8 }} />
        <View style={{ position: 'absolute', width: 260, height: 260, borderRadius: 130, backgroundColor: '#FFE0E6', top: 180, left: -150, opacity: 0.6 }} />
        <View style={{ position: 'absolute', width: 220, height: 220, borderRadius: 110, backgroundColor: '#FFF0D6', top: 120, right: -120, opacity: 0.8 }} />
      </View>

      {/* 상단 바 */}
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 18, paddingTop: insets.top + 10, paddingBottom: 6 }}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="닫기"
          hitSlop={8}
          onPress={close}
          style={({ pressed }) => ({ width: 44, height: 44, borderRadius: 22, backgroundColor: pressed ? theme.peach : 'rgba(255,255,255,0.9)', alignItems: 'center', justifyContent: 'center', ...shadow })}
        >
          <Ionicons name="chevron-down" size={24} color={theme.ink} />
        </Pressable>
        <View style={{ flex: 1, alignItems: 'center' }}>
          <AppText variant="headline">다마</AppText>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
            <BlinkDot color={status.color} active={live} />
            <AppText variant="caption" color={status.color} bold>
              {status.text}
            </AppText>
          </View>
        </View>
        <View style={{ minWidth: 44, height: 32, paddingHorizontal: 10, borderRadius: 16, backgroundColor: 'rgba(255,255,255,0.9)', flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 5 }}>
          <Ionicons name="time-outline" size={13} color={theme.brandDark} />
          <AppText variant="caption" color={theme.brandDark} bold style={{ fontVariant: ['tabular-nums'] }}>
            {`${mm}:${ss}`}
          </AppText>
        </View>
      </View>

      {/* 무대: 다마 */}
      <View style={{ alignItems: 'center', paddingTop: 4 }}>
        <View style={{ width: 230, height: 214, alignItems: 'center', justifyContent: 'center' }}>
          <Breathe active={talking} amount={0.06} style={{ position: 'absolute', width: 210, height: 210, borderRadius: 105, backgroundColor: 'rgba(255,255,255,0.55)' }} />
          <Ripples size={210} active={listening} />
          <Breathe active={talking} amount={0.04} style={{ position: 'absolute', width: 160, height: 160, borderRadius: 80, backgroundColor: theme.peach }} />
          <Particles active={talking || listening} color={listening ? theme.listening : theme.brand} />
          <FloatingDama size={124} mode={damaMode} />
        </View>
        <SoundBars active={talking || listening} color={listening ? theme.listening : theme.brand} height={28} />
      </View>

      {/* 실시간 자막 */}
      <View style={{ flex: 1, marginHorizontal: 16, marginTop: 12, marginBottom: 10, borderRadius: 26, backgroundColor: 'rgba(255,255,255,0.88)', ...shadow }}>
        <Captions turns={session.turns} liveAssistant={session.assistantText} state={state} wrapping={wrapping} />
      </View>

      {/* 빠른 답변 */}
      {listening && (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} keyboardShouldPersistTaps="handled" style={{ flexGrow: 0 }} contentContainerStyle={{ gap: 8, paddingHorizontal: 16, paddingBottom: 10 }}>
          {QUICK_REPLIES.map((q) => (
            <Pressable
              key={q}
              accessibilityRole="button"
              onPress={() => sendText(q)}
              style={({ pressed }) => ({ paddingHorizontal: 16, paddingVertical: 10, borderRadius: 999, backgroundColor: pressed ? theme.peach : '#fff', borderWidth: 1, borderColor: '#F1DCCB' })}
            >
              <AppText variant="subhead" color={theme.brandDark} bold>
                {q}
              </AppText>
            </Pressable>
          ))}
        </ScrollView>
      )}

      {/* 조작판 */}
      <View style={{ backgroundColor: '#fff', borderTopLeftRadius: 30, borderTopRightRadius: 30, paddingTop: 14, paddingBottom: insets.bottom + 16, gap: 12, ...shadow, shadowOffset: { width: 0, height: -4 } }}>
        {keyboard && !wrapping && (
          <FadeInUp distance={8} style={{ flexDirection: 'row', gap: 8, paddingHorizontal: 18, alignItems: 'center' }}>
            <TextInput
              value={typed}
              onChangeText={setTyped}
              autoFocus
              placeholder="다마에게 글로 말하기"
              placeholderTextColor="#A89C92"
              onSubmitEditing={() => sendText(typed)}
              returnKeyType="send"
              style={{ flex: 1, backgroundColor: theme.background, borderRadius: 18, paddingHorizontal: 16, paddingVertical: 12, fontSize: 16, color: theme.ink }}
            />
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="보내기"
              onPress={() => sendText(typed)}
              style={{ width: 46, height: 46, borderRadius: 23, backgroundColor: typed.trim() ? theme.brand : theme.gray, alignItems: 'center', justifyContent: 'center' }}
            >
              <Ionicons name="arrow-up" size={22} color={typed.trim() ? '#fff' : '#A0A0A8'} />
            </Pressable>
          </FadeInUp>
        )}

        <View style={{ flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-evenly' }}>
          <DockButton icon={keyboard ? 'mic-outline' : 'chatbox-ellipses-outline'} label={keyboard ? '말로 하기' : '글로 쓰기'} onPress={() => setKeyboard((k) => !k)} disabled={wrapping} />

          <View style={{ alignItems: 'center', gap: 8 }}>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={mainLabel}
              disabled={mainDisabled}
              onPress={onMainButton}
              style={({ pressed }) => ({ width: 96, height: 96, alignItems: 'center', justifyContent: 'center', transform: [{ scale: pressed ? 0.94 : 1 }] })}
            >
              <Animated.View
                style={{
                  position: 'absolute',
                  width: 96,
                  height: 96,
                  borderRadius: 48,
                  backgroundColor: `${theme.listening}33`,
                  opacity: listening ? 1 : 0,
                  transform: [{ scale: pulse.interpolate({ inputRange: [0, 1], outputRange: [0.9, 1.18] }) }],
                }}
              />
              <View style={{ width: 80, height: 80, borderRadius: 40, backgroundColor: mainColor, alignItems: 'center', justifyContent: 'center', opacity: mainDisabled ? 0.45 : 1, borderWidth: 4, borderColor: 'rgba(255,255,255,0.35)' }}>
                <Ionicons name={mainIcon} size={34} color="#fff" />
              </View>
            </Pressable>
            <AppText variant="subhead" color={listening ? theme.listening : theme.ink} bold>
              {mainLabel}
            </AppText>
          </View>

          <DockButton icon="call" label="대화 끝내기" onPress={finish} disabled={wrapping} danger />
        </View>
      </View>

      {summary && <SummaryOverlay summary={summary} onConfirm={confirm} onRetry={retry} />}
    </KeyboardAvoidingView>
  );
}

/** 깜빡이는 상태 점 (녹화 중 표시처럼) */
function BlinkDot({ color, active }: { color: string; active: boolean }) {
  const [v] = useState(() => new Animated.Value(1));
  useEffect(() => {
    if (!active) {
      v.setValue(1);
      return;
    }
    const to = (x: number) => Animated.timing(v, { toValue: x, duration: 700, useNativeDriver: true });
    const loop = Animated.loop(Animated.sequence([to(0.25), to(1)]));
    loop.start();
    return () => loop.stop();
  }, [active, v]);
  return <Animated.View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: color, opacity: v }} />;
}

function DockButton({ icon, label, onPress, disabled, danger }: { icon: IconName; label: string; onPress: () => void; disabled?: boolean; danger?: boolean }) {
  return (
    <View style={{ alignItems: 'center', gap: 8, width: 84, paddingTop: 16 }}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={label}
        disabled={disabled}
        onPress={onPress}
        style={({ pressed }) => ({
          width: 60,
          height: 60,
          borderRadius: 30,
          backgroundColor: danger ? (pressed ? '#C9362D' : theme.listening) : pressed ? theme.peach : theme.background,
          alignItems: 'center',
          justifyContent: 'center',
          opacity: disabled ? 0.4 : 1,
          transform: [{ scale: pressed ? 0.94 : 1 }],
        })}
      >
        <Ionicons name={icon} size={26} color={danger ? '#fff' : theme.brandDark} style={danger ? { transform: [{ rotate: '135deg' }] } : undefined} />
      </Pressable>
      <AppText variant="caption" color={danger ? theme.listening : theme.subInk} bold center>
        {label}
      </AppText>
    </View>
  );
}

/** 대화가 채팅처럼 쌓이는 실시간 자막 */
function Captions({ turns, liveAssistant, state, wrapping }: { turns: TranscriptTurn[]; liveAssistant: string; state: VoiceState; wrapping: boolean }) {
  const ref = useRef<ScrollView>(null);
  const empty = turns.length === 0 && !liveAssistant;
  return (
    <ScrollView
      ref={ref}
      onContentSizeChange={() => ref.current?.scrollToEnd({ animated: true })}
      contentContainerStyle={{ padding: 14, gap: 10, flexGrow: 1, justifyContent: empty ? 'center' : 'flex-end' }}
    >
      {empty ? (
        <View style={{ alignItems: 'center', gap: 8 }}>
          <Ionicons name="chatbubbles-outline" size={26} color="#D9C3B0" />
          <AppText variant="callout" color={theme.subInk} center>
            {state === 'connecting' ? '다마가 먼저 인사할 거예요' : '나눈 이야기가 여기에 글로 보여요'}
          </AppText>
        </View>
      ) : (
        turns.map((t, i) => <CaptionBubble key={i} turn={t} latest={i === turns.length - 1 && !liveAssistant} />)
      )}
      {liveAssistant ? <CaptionBubble turn={{ role: 'assistant', text: liveAssistant }} latest /> : null}
      {(state === 'thinking' || wrapping) && (
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
          <MiniAvatar />
          <ThinkingDots />
        </View>
      )}
    </ScrollView>
  );
}

function MiniAvatar() {
  return (
    <View style={{ width: 34, height: 34, borderRadius: 17, backgroundColor: theme.peach, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' }}>
      <DamaMascot size={26} mood="still" />
    </View>
  );
}

function CaptionBubble({ turn, latest }: { turn: TranscriptTurn; latest: boolean }) {
  const mine = turn.role === 'user';
  return (
    <PopIn style={{ flexDirection: 'row', justifyContent: mine ? 'flex-end' : 'flex-start', alignItems: 'flex-end', gap: 8 }}>
      {!mine && <MiniAvatar />}
      <View
        style={{
          maxWidth: '80%',
          paddingHorizontal: 14,
          paddingVertical: 10,
          borderRadius: 20,
          borderBottomLeftRadius: mine ? 20 : 6,
          borderBottomRightRadius: mine ? 6 : 20,
          backgroundColor: mine ? theme.brand : theme.peach,
          opacity: latest ? 1 : 0.8,
        }}
      >
        <AppText variant={latest && !mine ? 'title3' : 'callout'} color={mine ? '#fff' : theme.ink} style={{ fontWeight: latest && !mine ? '600' : '400' }}>
          {turn.text}
        </AppText>
      </View>
    </PopIn>
  );
}

function SummaryOverlay({
  summary,
  onConfirm,
  onRetry,
}: {
  summary: api.ConversationSummary;
  onConfirm: () => void;
  onRetry: () => void;
}) {
  const items = summary.pending;
  return (
    <FadeInUp
      distance={0}
      style={{
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: 'rgba(0,0,0,0.55)',
        justifyContent: 'center',
        paddingHorizontal: 22,
      }}
    >
      <PopIn delay={120} style={{ maxHeight: '82%' }}>
        <View style={{ alignItems: 'center', marginBottom: -30, zIndex: 1 }}>
          <FloatingDama size={70} mode="happy" />
        </View>
        <View style={{ flexShrink: 1, backgroundColor: '#fff', borderRadius: 26, padding: 20, paddingTop: 36, gap: 12 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
            <Ionicons name="checkmark-circle" size={30} color={theme.success} />
            <AppText variant="title3">대화 정리 완료</AppText>
          </View>
          <AppText variant="subhead" color={theme.subInk}>
            {'오늘 이야기한 내용을\n요약했어요!'}
          </AppText>

          <ScrollView contentContainerStyle={{ gap: 10 }}>
            {items.length === 0 ? (
              <AppText variant="callout" color={theme.subInk} style={{ paddingVertical: 12 }}>
                이야기 속에서 일정을 찾지 못했어요.
              </AppText>
            ) : (
              items.map((item, i) => {
                return (
                  <FadeInUp
                    key={item.id}
                    delay={320 + i * 90}
                    style={{ flexDirection: 'row', alignItems: 'center', gap: 12, padding: 12, borderRadius: 16, backgroundColor: theme.surface }}
                  >
                    <ScheduleIcon item={item} size={44} />
                    <View style={{ flex: 1 }}>
                      <AppText variant="caption" color={theme.brand} bold>
                        {`${relativeDayLabel(item.date) ?? formatDay(item.date)} ${formatAmPm(item.date)}`}
                      </AppText>
                      <AppText variant="headline">{item.title}</AppText>
                      {item.place ? (
                        <AppText variant="caption" color={theme.subInk}>
                          {`• ${item.place}`}
                        </AppText>
                      ) : null}
                    </View>
                  </FadeInUp>
                );
              })
            )}
          </ScrollView>

          <PrimaryButton title="확인" onPress={onConfirm} />
        </View>
      </PopIn>
      <Pressable accessibilityRole="button" onPress={onRetry} style={{ alignItems: 'center', padding: 8, marginTop: 14 }}>
        <AppText variant="subhead" color="rgba(255,255,255,0.9)">
          대화 다시말해요
        </AppText>
      </Pressable>
    </FadeInUp>
  );
}
