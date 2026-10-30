// [변경] 새 파일: 채팅방 꾸미기, 예약 메시지 창
// [변경] 3차: 내 사진 배경, 예약 시간 직접 조절(날짜·오전/오후·시·분), 방 공지 쓰기 창
// [변경] 4차: 시간 고르기(TimePicker) 공용으로 분리, 방 이름 바꾸기 창, 내 일정에 넣기 창
import { useEffect, useState } from 'react';
import { Image, KeyboardAvoidingView, Modal, Platform, Pressable, ScrollView, TextInput, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as api from '../api';
import { CHAT_THEMES, type ChatThemeKey } from '../lib/chatThemes';
import { showDialog } from '../lib/dialog';
import { formatAmPm, formatDay, makeId, relativeDayLabel } from '../lib/format';
import { scheduleReminder } from '../lib/notifications';
import { extractDay, extractTime } from '../lib/scheduleParser';
import { USE_MOCK } from '../api/config';
import { useAppStore } from '../store/useAppStore';
import { theme } from '../theme';
import type { ChatRoomInfo } from '../types';
import { AppText } from './AppText';
import { PrimaryButton } from './PrimaryButton';

/** 아래에서 올라오는 창 (채팅방 만들기 창과 같은 모양) */
function Sheet({ visible, onClose, title, children }: { visible: boolean; onClose: () => void; title: string; children: React.ReactNode }) {
  const insets = useSafeAreaInsets();
  return (
    <Modal visible={visible} animationType="fade" transparent onRequestClose={onClose}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.4)' }}>
        <Pressable style={{ flex: 1 }} onPress={onClose} accessibilityLabel="닫기" />
        <View style={{ backgroundColor: '#fff', borderTopLeftRadius: 26, borderTopRightRadius: 26, padding: 22, paddingBottom: insets.bottom + 22, gap: 12, maxHeight: '85%' }}>
          <AppText variant="title3">{title}</AppText>
          {children}
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

// ───────── 채팅방 꾸미기 ─────────

export function RoomThemeSheet({ visible, onClose, value, onChange, background, onPickBackground, onClearBackground, busy }: {
  visible: boolean; onClose: () => void; value: ChatThemeKey; onChange: (k: ChatThemeKey) => void;
  /** 지금 배경 사진 주소 (없으면 null) */
  background: string | null;
  onPickBackground: () => void;
  onClearBackground: () => void;
  /** 사진을 올리는 중 */
  busy: boolean;
}) {
  return (
    <Sheet visible={visible} onClose={onClose} title="채팅방 꾸미기">
      <AppText variant="subhead" color={theme.subInk}>
        배경과 말풍선 색을 골라 보세요. 나에게만 적용돼요.
      </AppText>
      <ScrollView contentContainerStyle={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10 }}>
        {/* 내 사진으로 배경 꾸미기 (손주 사진, 꽃 사진 등) */}
        <View style={{ width: '100%', flexDirection: 'row', alignItems: 'center', gap: 12, padding: 12, borderRadius: 16, backgroundColor: theme.surface }}>
          {background ? (
            <Image source={{ uri: api.imageUrl(background) }} style={{ width: 64, height: 64, borderRadius: 12 }} accessibilityLabel="지금 배경 사진" />
          ) : (
            <View style={{ width: 64, height: 64, borderRadius: 12, backgroundColor: theme.peach, alignItems: 'center', justifyContent: 'center' }}>
              <Ionicons name="image-outline" size={28} color={theme.brand} />
            </View>
          )}
          <View style={{ flex: 1, gap: 8 }}>
            <AppText variant="headline">내 사진으로 꾸미기</AppText>
            <View style={{ flexDirection: 'row', gap: 8, flexWrap: 'wrap' }}>
              <Pressable accessibilityRole="button" accessibilityLabel="배경 사진 고르기" disabled={busy} onPress={onPickBackground}
                style={{ paddingHorizontal: 14, paddingVertical: 9, borderRadius: 999, backgroundColor: theme.brand, opacity: busy ? 0.5 : 1 }}>
                <AppText variant="subhead" bold color="#fff">{busy ? '올리는 중…' : background ? '사진 바꾸기' : '사진 고르기'}</AppText>
              </Pressable>
              {background ? (
                <Pressable accessibilityRole="button" accessibilityLabel="배경 사진 지우기" disabled={busy} onPress={onClearBackground}
                  style={{ paddingHorizontal: 14, paddingVertical: 9, borderRadius: 999, backgroundColor: '#fff' }}>
                  <AppText variant="subhead" bold color={theme.listening}>사진 지우기</AppText>
                </Pressable>
              ) : null}
            </View>
          </View>
        </View>
        {CHAT_THEMES.map((t) => {
          const selected = t.key === value;
          return (
            <Pressable
              key={t.key}
              accessibilityRole="radio"
              accessibilityState={{ checked: selected }}
              accessibilityLabel={`${t.label} 테마`}
              onPress={() => onChange(t.key)}
              style={{ width: '48%', borderRadius: 16, borderWidth: selected ? 3 : 1, borderColor: selected ? theme.brand : theme.line, overflow: 'hidden' }}
            >
              <View style={{ backgroundColor: t.background, padding: 10, gap: 6 }}>
                <View style={{ alignSelf: 'flex-start', backgroundColor: t.other, borderRadius: 12, paddingHorizontal: 10, paddingVertical: 6, borderWidth: t.otherBorder ? 1.5 : 0, borderColor: t.otherBorder }}>
                  <AppText variant="caption" color={t.text}>안녕하세요</AppText>
                </View>
                <View style={{ alignSelf: 'flex-end', backgroundColor: t.mine, borderRadius: 12, paddingHorizontal: 10, paddingVertical: 6 }}>
                  <AppText variant="caption" color={t.text}>반가워요</AppText>
                </View>
              </View>
              <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 4, paddingVertical: 8, backgroundColor: '#fff' }}>
                {selected ? <Ionicons name="checkmark-circle" size={18} color={theme.brand} /> : null}
                <AppText variant="subhead" bold color={selected ? theme.brand : theme.ink}>{t.label}</AppText>
              </View>
            </Pressable>
          );
        })}
      </ScrollView>
      <PrimaryButton title="다 됐어요" onPress={onClose} />
    </Sheet>
  );
}

// ───────── 예약 메시지 ─────────

/** 예약 시간을 '며칠 뒤 · 오전/오후 · 시 · 분' 으로 나눠서 어르신이 숫자를 직접 조절 */
interface TimeParts {
  /** 0 = 오늘, 1 = 내일 … 6 */
  day: number;
  pm: boolean;
  /** 1 ~ 12 */
  hour: number;
  /** 0 ~ 59 */
  minute: number;
}

const MAX_DAYS = 6;

function partsToDate(p: TimeParts, now = new Date()): Date {
  return new Date(now.getFullYear(), now.getMonth(), now.getDate() + p.day, (p.hour % 12) + (p.pm ? 12 : 0), p.minute);
}

function dateToParts(d: Date, now = new Date(), maxDays = MAX_DAYS): TimeParts {
  const startOf = (x: Date) => new Date(x.getFullYear(), x.getMonth(), x.getDate()).getTime();
  const day = Math.round((startOf(d) - startOf(now)) / 86_400_000);
  const h = d.getHours();
  return { day: Math.min(maxDays, Math.max(0, day)), pm: h >= 12, hour: h % 12 === 0 ? 12 : h % 12, minute: d.getMinutes() };
}

/** 처음 열었을 때: 1시간 뒤, 5분 단위로 */
function defaultParts(now = new Date()): TimeParts {
  const d = new Date(now.getTime() + 60 * 60_000);
  d.setMinutes(Math.ceil(d.getMinutes() / 5) * 5, 0, 0);
  return dateToParts(d, now);
}

/** 빠른 선택 (누르면 아래 숫자가 그 시간으로 바뀌고, 거기서 다시 조절 가능) */
function quickTimes(now = new Date()): { label: string; at: Date }[] {
  const at = (h: number, m: number, addDays = 0) => new Date(now.getFullYear(), now.getMonth(), now.getDate() + addDays, h, m);
  const list = [
    { label: '10분 뒤', at: new Date(now.getTime() + 10 * 60_000) },
    { label: '1시간 뒤', at: new Date(now.getTime() + 60 * 60_000) },
    { label: '오늘 저녁 6시', at: at(18, 0) },
    { label: '내일 아침 9시', at: at(9, 0, 1) },
  ];
  return list.filter((x) => x.at.getTime() > now.getTime() + 60_000);
}

function dayLabel(day: number, now = new Date()): string {
  if (day === 0) return '오늘';
  if (day === 1) return '내일';
  if (day === 2) return '모레';
  const d = new Date(now.getFullYear(), now.getMonth(), now.getDate() + day);
  return formatDay(d.toISOString());
}

/** − [숫자] + : 큰 버튼으로 하나씩, 가운데 숫자를 눌러 직접 입력도 가능 */
function NumberStepper({ label, value, min, max, step = 1, pad = false, onChange }: {
  label: string; value: number; min: number; max: number; step?: number; pad?: boolean; onChange: (v: number) => void;
}) {
  const show = (v: number) => (pad ? String(v).padStart(2, '0') : String(v));
  // 직접 입력하는 동안만 쓰는 글자 (입력 중이 아니면 value 를 그대로 보여 줌)
  const [draft, setDraft] = useState<string | null>(null);
  const text = draft ?? show(value);
  // 끝에서 한 번 더 누르면 처음으로 (예: 55분 → 0분, 12시 → 1시)
  const move = (dir: 1 | -1) => {
    let v = value + dir * step;
    if (v > max) v = min;
    if (v < min) v = Math.floor(max / step) * step;
    onChange(v);
  };
  return (
    <View style={{ flex: 1, alignItems: 'center', gap: 6 }}>
      <AppText variant="subhead" color={theme.subInk}>{label}</AppText>
      <Pressable accessibilityRole="button" accessibilityLabel={`${label} 올리기`} onPress={() => move(1)} style={bigStep}>
        <Ionicons name="chevron-up" size={26} color={theme.brand} />
      </Pressable>
      <TextInput
        value={text}
        onFocus={() => setDraft(show(value))}
        onBlur={() => setDraft(null)}
        onChangeText={(t) => {
          const digits = t.replace(/[^0-9]/g, '').slice(0, 2);
          setDraft(digits);
          const n = Number(digits);
          if (digits && n >= min && n <= max) onChange(n);
        }}
        keyboardType="number-pad"
        selectTextOnFocus
        maxLength={2}
        accessibilityLabel={`${label} 직접 입력`}
        style={{ width: 72, textAlign: 'center', fontSize: 30, fontWeight: '700', color: theme.ink, paddingVertical: 6, borderRadius: 12, backgroundColor: '#fff' }}
      />
      <Pressable accessibilityRole="button" accessibilityLabel={`${label} 내리기`} onPress={() => move(-1)} style={bigStep}>
        <Ionicons name="chevron-down" size={26} color={theme.brand} />
      </Pressable>
    </View>
  );
}

/** 날짜 ‹ › · 오전/오후 · 시 · 분 (큰 버튼으로 숫자 직접 조절) */
function TimePicker({ parts, onChange, now, maxDays, hint, hintError }: {
  parts: TimeParts; onChange: (p: TimeParts) => void; now: Date; maxDays: number; hint: string; hintError?: boolean;
}) {
  const set = (p: Partial<TimeParts>) => onChange({ ...parts, ...p });
  const chip = (on: boolean) => ({ paddingHorizontal: 14, paddingVertical: 12, borderRadius: 999, backgroundColor: on ? theme.brand : '#fff' });
  return (
    <View style={{ gap: 10, padding: 14, borderRadius: 18, backgroundColor: theme.surface }}>
      <AppText variant="subhead" color={theme.subInk}>직접 정하기</AppText>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
        <Pressable accessibilityRole="button" accessibilityLabel="하루 앞으로" disabled={parts.day === 0} onPress={() => set({ day: parts.day - 1 })} style={[bigStep, { opacity: parts.day === 0 ? 0.35 : 1 }]}>
          <Ionicons name="chevron-back" size={26} color={theme.brand} />
        </Pressable>
        <AppText variant="title3" center style={{ flex: 1 }}>{dayLabel(parts.day, now)}</AppText>
        <Pressable accessibilityRole="button" accessibilityLabel="하루 뒤로" disabled={parts.day === maxDays} onPress={() => set({ day: parts.day + 1 })} style={[bigStep, { opacity: parts.day === maxDays ? 0.35 : 1 }]}>
          <Ionicons name="chevron-forward" size={26} color={theme.brand} />
        </Pressable>
      </View>
      <View style={{ flexDirection: 'row', gap: 8 }}>
        {[false, true].map((pm) => (
          <Pressable key={String(pm)} accessibilityRole="radio" accessibilityState={{ checked: parts.pm === pm }} onPress={() => set({ pm })}
            style={[chip(parts.pm === pm), { flex: 1, alignItems: 'center' }]}>
            <AppText variant="headline" color={parts.pm === pm ? '#fff' : theme.ink}>{pm ? '오후' : '오전'}</AppText>
          </Pressable>
        ))}
      </View>
      <View style={{ flexDirection: 'row', alignItems: 'center' }}>
        <NumberStepper label="시" value={parts.hour} min={1} max={12} onChange={(hour) => set({ hour })} />
        <AppText style={{ fontSize: 30, fontWeight: '700', marginTop: 22 }}>:</AppText>
        <NumberStepper label="분" value={parts.minute} min={0} max={59} step={5} pad onChange={(minute) => set({ minute })} />
      </View>
      <AppText variant="headline" center color={hintError ? theme.listening : theme.brand}>{hint}</AppText>
    </View>
  );
}

export function ScheduleSheet({ visible, onClose, roomId, initialText, onScheduled }: {
  visible: boolean; onClose: () => void; roomId: string; initialText: string; onScheduled: () => void;
}) {
  const [text, setText] = useState('');
  const [parts, setParts] = useState<TimeParts>(() => defaultParts());
  const [list, setList] = useState<api.ScheduledMessage[]>([]);
  const [busy, setBusy] = useState(false);
  const [times, setTimes] = useState(() => quickTimes());
  /** 지금 시각 (30초마다 갱신: '지금보다 뒤인지' 확인용) */
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    if (!visible) return;
    const t = setInterval(() => setNow(new Date()), 30_000);
    return () => clearInterval(t);
  }, [visible]);

  const reload = () => { api.listScheduled(roomId).then(setList).catch(() => {}); };

  useEffect(() => {
    if (!visible) return;
    // 창을 열 때마다 처음 상태로 (렌더가 끝난 뒤에)
    queueMicrotask(() => {
      const n = new Date();
      setNow(n);
      setText(initialText);
      setParts(defaultParts(n));
      setTimes(quickTimes(n));
    });
    api.listScheduled(roomId).then(setList).catch(() => {});
  }, [visible, roomId, initialText]);

  const when = partsToDate(parts, now);
  const whenLabel = `${dayLabel(parts.day, now)} ${formatAmPm(when.toISOString())}`;
  const tooSoon = when.getTime() < now.getTime() + 60_000;

  const submit = async () => {
    if (!text.trim() || busy) return;
    if (tooSoon) {
      showDialog('시간을 다시 정해 주세요', '지금보다 1분 이상 뒤로 정해 주세요.');
      return;
    }
    setBusy(true);
    try {
      await api.scheduleMessage(roomId, text.trim(), when);
      showDialog('예약했어요', `${whenLabel}에 보내 드릴게요.`);
      setText('');
      setParts(defaultParts(new Date()));
      reload();
      onScheduled();
    } catch (e) {
      showDialog('예약하지 못했어요', api.serverMessage(e) ?? '인터넷 연결을 확인하고 다시 시도해 주세요.');
    } finally {
      setBusy(false);
    }
  };

  const cancel = (s: api.ScheduledMessage) => {
    showDialog('예약을 취소할까요?', `"${s.text}"`, [
      { text: '그대로 두기', style: 'cancel' },
      {
        text: '예약 취소',
        style: 'destructive',
        onPress: async () => {
          try { await api.cancelScheduled(roomId, s.id); } catch { showDialog('취소하지 못했어요', '이미 보냈거나 연결이 불안정해요.'); }
          reload();
        },
      },
    ]);
  };

  const inputStyle = { backgroundColor: theme.gray, borderRadius: 12, paddingHorizontal: 14, paddingVertical: 12, fontSize: 16 } as const;
  const chip = (on: boolean) => ({ paddingHorizontal: 14, paddingVertical: 10, borderRadius: 999, backgroundColor: on ? theme.brand : theme.gray });

  return (
    <Sheet visible={visible} onClose={onClose} title="예약 메시지">
      <ScrollView contentContainerStyle={{ gap: 12 }} keyboardShouldPersistTaps="handled">
        <AppText variant="subhead" color={theme.subInk}>보낼 말</AppText>
        <TextInput value={text} onChangeText={setText} placeholder="예: 내일 경로당에서 만나요" placeholderTextColor="#9A9AA0" style={inputStyle} multiline maxLength={1000} accessibilityLabel="예약할 메시지" />

        <AppText variant="subhead" color={theme.subInk}>언제 보낼까요? (빠른 선택)</AppText>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
          {times.map((t) => {
            const on = partsToDate(dateToParts(t.at, now), now).getTime() === when.getTime();
            return (
              <Pressable key={t.label} accessibilityRole="button" onPress={() => setParts(dateToParts(t.at, now))} style={chip(on)}>
                <AppText variant="subhead" bold color={on ? '#fff' : theme.ink}>{t.label}</AppText>
              </Pressable>
            );
          })}
        </View>

        <TimePicker parts={parts} onChange={setParts} now={now} maxDays={MAX_DAYS}
          hint={tooSoon ? '지금보다 뒤의 시간으로 정해 주세요' : `${whenLabel}에 보내요`} hintError={tooSoon} />

        <PrimaryButton title={busy ? '예약하는 중…' : '예약하기'} onPress={submit} disabled={!text.trim() || busy || tooSoon} />

        {list.length > 0 ? (
          <View style={{ gap: 8, marginTop: 6 }}>
            <AppText variant="subhead" color={theme.subInk}>{`보낼 예정 (${list.length}개)`}</AppText>
            {list.map((s) => (
              <View key={s.id} style={{ flexDirection: 'row', alignItems: 'center', gap: 10, padding: 12, borderRadius: 14, backgroundColor: theme.surface }}>
                <Ionicons name="time-outline" size={20} color={theme.brand} />
                <View style={{ flex: 1 }}>
                  <AppText variant="caption" color={theme.brand} bold>
                    {`${relativeDayLabel(s.sendAt) ?? formatDay(s.sendAt)} ${formatAmPm(s.sendAt)}`}
                  </AppText>
                  <AppText numberOfLines={2}>{s.text}</AppText>
                </View>
                <Pressable accessibilityRole="button" accessibilityLabel="예약 취소" onPress={() => cancel(s)} hitSlop={8} style={{ paddingHorizontal: 10, paddingVertical: 8, borderRadius: 10, backgroundColor: '#fff' }}>
                  <AppText variant="subhead" color={theme.listening} bold>취소</AppText>
                </Pressable>
              </View>
            ))}
          </View>
        ) : null}
      </ScrollView>
      <PrimaryButton title="닫기" color={theme.brandDark} onPress={onClose} />
    </Sheet>
  );
}

const bigStep = { width: 52, height: 52, borderRadius: 26, backgroundColor: theme.peach, alignItems: 'center', justifyContent: 'center' } as const;

// ───────── 방 공지 (방장만) ─────────

export function NoticeSheet({ visible, onClose, roomId, current, onSaved }: {
  visible: boolean; onClose: () => void; roomId: string; current: string | null; onSaved: (info: ChatRoomInfo) => void;
}) {
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    if (visible) queueMicrotask(() => setText(current ?? ''));
  }, [visible, current]);

  const save = async (value: string) => {
    if (busy) return;
    setBusy(true);
    try {
      onSaved(await api.setNotice(roomId, value));
      onClose();
    } catch (e) {
      showDialog('공지를 올리지 못했어요', api.serverMessage(e) ?? '인터넷 연결을 확인하고 다시 시도해 주세요.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <Sheet visible={visible} onClose={onClose} title="방 공지 쓰기">
      <AppText variant="subhead" color={theme.subInk}>
        방 맨 위에 고정돼서 모든 이웃이 볼 수 있어요. 모임 시간·장소를 알려 주세요.
      </AppText>
      <TextInput
        value={text}
        onChangeText={setText}
        placeholder="예: 매주 금요일 오전 9시, 중앙공원 정문에서 만나요"
        placeholderTextColor="#9A9AA0"
        multiline
        maxLength={200}
        accessibilityLabel="공지 내용"
        style={{ backgroundColor: theme.gray, borderRadius: 12, paddingHorizontal: 14, paddingVertical: 12, fontSize: 16, minHeight: 90 }}
      />
      <AppText variant="caption" color={theme.subInk} style={{ textAlign: 'right' }}>{`${text.length}/200`}</AppText>
      <View style={{ flexDirection: 'row', gap: 10 }}>
        {current ? <PrimaryButton title="공지 내리기" color={theme.brandDark} onPress={() => save('')} disabled={busy} style={{ flex: 1 }} /> : null}
        <PrimaryButton title={busy ? '올리는 중…' : '공지 올리기'} onPress={() => save(text)} disabled={!text.trim() || busy} style={{ flex: 1 }} />
      </View>
    </Sheet>
  );
}

// ───────── 방 이름 바꾸기 (방장만) ─────────

export function RenameSheet({ visible, onClose, roomId, current, onSaved }: {
  visible: boolean; onClose: () => void; roomId: string; current: string; onSaved: (info: ChatRoomInfo) => void;
}) {
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    if (visible) queueMicrotask(() => setText(current));
  }, [visible, current]);

  const save = async () => {
    if (busy || !text.trim()) return;
    setBusy(true);
    try {
      onSaved(await api.setRoomTitle(roomId, text.trim()));
      onClose();
    } catch (e) {
      showDialog('이름을 바꾸지 못했어요', api.serverMessage(e) ?? '인터넷 연결을 확인하고 다시 시도해 주세요.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <Sheet visible={visible} onClose={onClose} title="방 이름 바꾸기">
      <AppText variant="subhead" color={theme.subInk}>바꾸면 모든 이웃의 화면에 새 이름이 보여요.</AppText>
      <TextInput
        value={text}
        onChangeText={setText}
        placeholder="예: 101동 아침 산책 모임"
        placeholderTextColor="#9A9AA0"
        maxLength={100}
        accessibilityLabel="새 방 이름"
        onSubmitEditing={save}
        style={{ backgroundColor: theme.gray, borderRadius: 12, paddingHorizontal: 14, paddingVertical: 14, fontSize: 18 }}
      />
      <View style={{ flexDirection: 'row', gap: 10 }}>
        <PrimaryButton title="취소" color={theme.brandDark} onPress={onClose} style={{ flex: 1 }} />
        <PrimaryButton title={busy ? '바꾸는 중…' : '바꾸기'} onPress={save} disabled={!text.trim() || text.trim() === current || busy} style={{ flex: 1 }} />
      </View>
    </Sheet>
  );
}

// ───────── 내 일정에 넣기 (채팅 속 약속 → 담화 일정) ─────────

/** 일정 이름: 날짜·시간 말을 빼고 짧게 ("11월 5일 오전 9시 중앙공원에서 만나요" → "중앙공원에서 만나요") */
function titleFromText(text: string): string {
  const one = text.replace(/\s+/g, ' ').trim();
  const cleaned = one
    .replace(/\d{1,2}\s*월\s*\d{1,2}\s*일(에)?/g, '')
    .replace(/(다음\s*주|이번\s*주)?\s*[일월화수목금토]요일(에)?/g, '')
    .replace(/(오늘|내일|모레)(은|에)?/g, '')
    .replace(/(오전|오후|아침|저녁|낮)?\s*\d{1,2}\s*시\s*(반|\d{1,2}\s*분)?(에|부터|까지)?/g, '')
    .replace(/\s+/g, ' ')
    .replace(/^[\s,.]+|[\s,.]+$/g, '');
  return (cleaned.length >= 2 ? cleaned : one).slice(0, 40);
}

/** 일정은 1년 안으로 */
const CALENDAR_DAYS = 365;

/** 글에서 날짜·시간을 찾아 처음 값으로 (못 찾으면 내일 오전 10시) */
function partsFromText(text: string, now: Date): TimeParts {
  const day = extractDay(text, now);
  const time = extractTime(text);
  const base = day ?? new Date(now.getFullYear(), now.getMonth(), now.getDate() + (time ? 0 : 1));
  const d = new Date(base.getFullYear(), base.getMonth(), base.getDate(), time?.h ?? 10, time?.m ?? 0);
  // 날짜 없이 시간만 있는데 이미 지났으면 내일
  if (!day && d.getTime() < now.getTime()) d.setDate(d.getDate() + 1);
  return dateToParts(d, now, CALENDAR_DAYS);
}

export function CalendarSheet({ visible, onClose, sourceText }: {
  visible: boolean; onClose: () => void; sourceText: string;
}) {
  const [title, setTitle] = useState('');
  const [now, setNow] = useState(() => new Date());
  const [parts, setParts] = useState<TimeParts>(() => defaultParts());
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!visible) return;
    queueMicrotask(() => {
      const n = new Date();
      setNow(n);
      setTitle(titleFromText(sourceText));
      setParts(partsFromText(sourceText, n));
    });
  }, [visible, sourceText]);

  const when = partsToDate(parts, now);
  const label = `${dayLabel(parts.day, now)} ${formatAmPm(when.toISOString())}`;
  const past = when.getTime() < now.getTime();

  const save = async () => {
    if (busy || !title.trim() || past) return;
    setBusy(true);
    try {
      await saveToMySchedule(title.trim(), when, sourceText);
      onClose();
      showDialog('내 일정에 넣었어요', `${label} '${title.trim()}'\n일정 화면에서 볼 수 있어요.`);
    } catch {
      showDialog('일정에 넣지 못했어요', '인터넷 연결을 확인하고 다시 시도해 주세요.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <Sheet visible={visible} onClose={onClose} title="내 일정에 넣기">
      <ScrollView contentContainerStyle={{ gap: 12 }} keyboardShouldPersistTaps="handled">
        <AppText variant="subhead" color={theme.subInk}>무슨 일정인가요?</AppText>
        <TextInput
          value={title}
          onChangeText={setTitle}
          maxLength={40}
          accessibilityLabel="일정 이름"
          style={{ backgroundColor: theme.gray, borderRadius: 12, paddingHorizontal: 14, paddingVertical: 12, fontSize: 17 }}
        />
        <TimePicker parts={parts} onChange={setParts} now={now} maxDays={CALENDAR_DAYS}
          hint={past ? '이미 지난 시간이에요' : `${label}`} hintError={past} />
        <PrimaryButton title={busy ? '넣는 중…' : '내 일정에 넣기'} icon="calendar" onPress={save} disabled={!title.trim() || busy || past} />
      </ScrollView>
      <PrimaryButton title="닫기" color={theme.brandDark} onPress={onClose} />
    </Sheet>
  );
}

/** 담화 일정에 저장 (서버가 있으면 서버, 없으면 기기) + 30분 전 알림 */
async function saveToMySchedule(title: string, when: Date, raw: string) {
  const item = { id: makeId(), title, category: '일정' as const, date: when.toISOString() };
  if (USE_MOCK) {
    useAppStore.setState((s) => ({ schedules: [...s.schedules, item].sort((a, b) => a.date.localeCompare(b.date)) }));
  } else {
    const created = await api.createSchedule('1', { title, scheduleTime: when.toISOString(), rawMessage: raw.slice(0, 500) });
    item.id = created.id;
  }
  if (Platform.OS !== 'web') await scheduleReminder(item).catch(() => {});
}
