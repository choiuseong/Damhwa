import { useMemo, useState } from 'react';
import { Alert, Pressable, ScrollView, View } from 'react-native';
import { router } from 'expo-router';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import * as api from '../api';
import { AppText } from '../components/AppText';
import { Card } from '../components/Card';
import { DamaMascot } from '../components/DamaMascot';
import { FadeInUp } from '../components/Motion';
import { PrimaryButton } from '../components/PrimaryButton';
import { ScheduleIcon, scheduleVisual } from '../components/ScheduleIcon';
import { dayKey, formatAmPm, formatDayLong, isSameDay, relativeDayLabel } from '../lib/format';
import { cancelReminder } from '../lib/notifications';
import { useAppStore } from '../store/useAppStore';
import { theme } from '../theme';
import type { ScheduleItem } from '../types';

const WEEK = ['일', '월', '화', '수', '목', '금', '토'];
const SUNDAY = '#D9453B';

/** 이 달의 칸들 (앞쪽 빈칸은 null) */
function monthCells(month: Date): (Date | null)[] {
  const first = new Date(month.getFullYear(), month.getMonth(), 1);
  const days = new Date(month.getFullYear(), month.getMonth() + 1, 0).getDate();
  const cells: (Date | null)[] = Array.from({ length: first.getDay() }, () => null);
  for (let d = 1; d <= days; d++) cells.push(new Date(month.getFullYear(), month.getMonth(), d));
  while (cells.length % 7) cells.push(null);
  return cells;
}

/** PPT '일정 관리' 화면 — 달력 + 고른 날의 일정을 크게 */
export default function ScheduleScreen() {
  const schedules = useAppStore((s) => s.schedules);
  const removeSchedule = useAppStore((s) => s.removeSchedule);
  const [today] = useState(() => new Date());
  const [month, setMonth] = useState(() => new Date(today.getFullYear(), today.getMonth(), 1));
  const [selected, setSelected] = useState(today);

  const byDay = useMemo(() => {
    const map = new Map<string, ScheduleItem[]>();
    [...schedules]
      .sort((a, b) => a.date.localeCompare(b.date))
      .forEach((s) => {
        const k = dayKey(s.date);
        map.set(k, [...(map.get(k) ?? []), s]);
      });
    return map;
  }, [schedules]);

  const cells = useMemo(() => monthCells(month), [month]);
  const monthCount = cells.reduce((n, d) => n + (d ? (byDay.get(dayKey(d.toISOString()))?.length ?? 0) : 0), 0);
  const selectedIso = selected.toISOString();
  const dayItems = byDay.get(dayKey(selectedIso)) ?? [];
  const rel = relativeDayLabel(selectedIso);

  const moveMonth = (delta: number) => setMonth((m) => new Date(m.getFullYear(), m.getMonth() + delta, 1));
  const goToday = () => {
    setMonth(new Date(today.getFullYear(), today.getMonth(), 1));
    setSelected(today);
  };

  const askDelete = (item: ScheduleItem) => {
    Alert.alert('일정을 지울까요?', item.title, [
      { text: '취소', style: 'cancel' },
      {
        text: '지우기',
        style: 'destructive',
        onPress: () => {
          removeSchedule(item.id);
          cancelReminder(item.id);
          api.deleteSchedule(item.id).catch(() => {});
        },
      },
    ]);
  };

  return (
    <ScrollView style={{ flex: 1, backgroundColor: theme.background }} contentContainerStyle={{ padding: 20, gap: 20 }}>
      {/* 달력 */}
      <FadeInUp>
        <Card radius={28} style={{ paddingHorizontal: 12, paddingTop: 16, paddingBottom: 10 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 4, marginBottom: 14 }}>
            <MonthArrow icon="chevron-back" label="지난달" onPress={() => moveMonth(-1)} />
            <View style={{ flex: 1, alignItems: 'center' }}>
              <AppText variant="title2">{`${month.getFullYear()}년 ${month.getMonth() + 1}월`}</AppText>
              <AppText variant="caption" color={theme.subInk}>
                {monthCount ? `이 달 일정 ${monthCount}개` : '이 달은 일정이 없어요'}
              </AppText>
            </View>
            <MonthArrow icon="chevron-forward" label="다음달" onPress={() => moveMonth(1)} />
          </View>

          <View style={{ flexDirection: 'row', marginBottom: 4 }}>
            {WEEK.map((w, i) => (
              <View key={w} style={{ width: `${100 / 7}%`, alignItems: 'center', paddingVertical: 4 }}>
                <AppText variant="caption" bold color={i === 0 ? SUNDAY : i === 6 ? theme.blue : theme.subInk}>
                  {w}
                </AppText>
              </View>
            ))}
          </View>

          <FadeInUp key={dayKey(month.toISOString())} distance={8} style={{ flexDirection: 'row', flexWrap: 'wrap' }}>
            {cells.map((d, i) =>
              d ? (
                <DayCell
                  key={i}
                  date={d}
                  items={byDay.get(dayKey(d.toISOString())) ?? []}
                  isToday={isSameDay(d, today)}
                  isSelected={isSameDay(d, selected)}
                  onPress={() => setSelected(d)}
                />
              ) : (
                <View key={i} style={{ width: `${100 / 7}%`, height: 64 }} />
              ),
            )}
          </FadeInUp>

          {!(isSameDay(selected, today) && month.getMonth() === today.getMonth() && month.getFullYear() === today.getFullYear()) && (
            <Pressable accessibilityRole="button" onPress={goToday} hitSlop={8} style={{ alignSelf: 'center', flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 14, paddingVertical: 6, marginTop: 4, borderRadius: 999, backgroundColor: theme.peach }}>
              <Ionicons name="today-outline" size={14} color={theme.brand} />
              <AppText variant="caption" color={theme.brand} bold>
                오늘로 가기
              </AppText>
            </Pressable>
          )}
        </Card>
      </FadeInUp>

      {/* 고른 날의 일정 */}
      <FadeInUp key={dayKey(selectedIso)} distance={12} style={{ gap: 12 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 4 }}>
          <AppText variant="title2" style={{ flexShrink: 1 }}>
            {formatDayLong(selectedIso)}
          </AppText>
          {rel ? (
            <View style={{ paddingHorizontal: 10, paddingVertical: 3, borderRadius: 999, backgroundColor: theme.brand }}>
              <AppText variant="caption" color="#fff" bold>
                {rel}
              </AppText>
            </View>
          ) : null}
        </View>

        {dayItems.length === 0 ? (
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 14, padding: 18, borderRadius: 24, borderWidth: 1.5, borderStyle: 'dashed', borderColor: '#E8D3C0' }}>
            <DamaMascot size={54} />
            <AppText variant="callout" color={theme.subInk} style={{ flex: 1 }}>
              {'이 날은 일정이 없어요.\n다마에게 말하면 일정을 넣어 드려요.'}
            </AppText>
          </View>
        ) : (
          dayItems.map((item, i) => <DayScheduleCard key={item.id} item={item} delay={80 + i * 80} onDelete={() => askDelete(item)} />)
        )}
      </FadeInUp>

      <PrimaryButton title="확 인" color={theme.brandDark} onPress={() => router.back()} />
    </ScrollView>
  );
}

function MonthArrow({ icon, label, onPress }: { icon: 'chevron-back' | 'chevron-forward'; label: string; onPress: () => void }) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={onPress}
      hitSlop={8}
      style={({ pressed }) => ({ width: 44, height: 44, borderRadius: 22, backgroundColor: pressed ? theme.peach : theme.background, alignItems: 'center', justifyContent: 'center' })}
    >
      <Ionicons name={icon} size={22} color={theme.brandDark} />
    </Pressable>
  );
}

function DayCell({ date, items, isToday, isSelected, onPress }: { date: Date; items: ScheduleItem[]; isToday: boolean; isSelected: boolean; onPress: () => void }) {
  const dow = date.getDay();
  const numColor = isSelected ? '#fff' : dow === 0 ? SUNDAY : dow === 6 ? theme.blue : theme.ink;
  const first = items[0] ? scheduleVisual(items[0]) : null;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${date.getMonth() + 1}월 ${date.getDate()}일${items.length ? `, 일정 ${items.length}개` : ''}`}
      onPress={onPress}
      style={{ width: `${100 / 7}%`, height: 64, alignItems: 'center', paddingTop: 2, gap: 3 }}
    >
      <View
        style={{
          width: 36,
          height: 36,
          borderRadius: 18,
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: isSelected ? theme.brand : 'transparent',
          borderWidth: isToday && !isSelected ? 2 : 0,
          borderColor: theme.brand,
        }}
      >
        <AppText variant="callout" bold={isSelected || isToday} color={numColor}>
          {String(date.getDate())}
        </AppText>
      </View>
      {first ? (
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 1 }}>
          <MaterialCommunityIcons name={first.icon} size={15} color={first.color} />
          {items.length > 1 && (
            <AppText variant="caption" color={theme.subInk} style={{ fontSize: 10, lineHeight: 12 }}>
              {`+${items.length - 1}`}
            </AppText>
          )}
        </View>
      ) : null}
    </Pressable>
  );
}

function DayScheduleCard({ item, delay, onDelete }: { item: ScheduleItem; delay: number; onDelete: () => void }) {
  const v = scheduleVisual(item);
  return (
    <FadeInUp delay={delay}>
      <Card radius={24} style={{ padding: 18, flexDirection: 'row', gap: 16 }}>
        <ScheduleIcon item={item} size={64} solid />
        <View style={{ flex: 1, gap: 2 }}>
          <AppText variant="subhead" color={v.color} bold>
            {v.label}
          </AppText>
          <AppText variant="title">
            {item.title}
          </AppText>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 4 }}>
            <Ionicons name="time" size={18} color={theme.brandDark} />
            <AppText variant="title3" color={theme.brandDark}>
              {formatAmPm(item.date)}
            </AppText>
          </View>
          {item.place ? (
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
              <Ionicons name="location" size={16} color={theme.subInk} />
              <AppText variant="callout" color={theme.subInk}>
                {item.place}
              </AppText>
            </View>
          ) : null}
        </View>
        <Pressable accessibilityRole="button" accessibilityLabel={`${item.title} 지우기`} onPress={onDelete} hitSlop={10} style={{ alignSelf: 'flex-start', padding: 4 }}>
          <Ionicons name="trash-outline" size={20} color="#B9ABA0" />
        </Pressable>
      </Card>
    </FadeInUp>
  );
}
