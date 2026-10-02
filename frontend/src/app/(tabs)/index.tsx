import { useMemo, useState } from 'react';
import { Pressable, ScrollView, View } from 'react-native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { AppText } from '../../components/AppText';
import { Card } from '../../components/Card';
import { DamaMascot } from '../../components/DamaMascot';
import { DateBadge } from '../../components/DateBadge';
import { FloatingDama } from '../../components/FloatingDama';
import { ScheduleIcon, scheduleVisual } from '../../components/ScheduleIcon';
import { FadeInUp, GlowPulse, Shake } from '../../components/Motion';
import { formatAmPm, formatDay, formatDayLong, isSameDay, relativeDayLabel } from '../../lib/format';
import { useAppStore } from '../../store/useAppStore';
import { theme } from '../../theme';
import type { IconName } from '../../types';

function greeting(hour: number): string {
  if (hour >= 5 && hour < 12) return '좋은 아침이에요';
  if (hour >= 12 && hour < 18) return '좋은 오후예요';
  return '편안한 저녁이에요';
}

/** PPT '한눈에 시작하는 담화' 왼쪽 폰: 피드 (음성대화 / 기록 / 일정 / 알림 / 추천) */
export default function HomeScreen() {
  const insets = useSafeAreaInsets();
  const schedules = useAppStore((s) => s.schedules);
  const records = useAppStore((s) => s.records);
  const [expanded, setExpanded] = useState(false);
  const now = new Date();

  const notices = useMemo(() => {
    const now = new Date();
    const result: string[] = [];
    const next = schedules
      .filter((s) => isSameDay(new Date(s.date), now) && new Date(s.date) > now)
      .sort((a, b) => a.date.localeCompare(b.date))[0];
    if (next) result.push(`${formatAmPm(next.date)}에 '${next.title}' 일정이 있어요.`);
    if (!records.some((r) => isSameDay(new Date(r.date), now))) {
      result.push('다마가 오늘 안부가 궁금해요. 이야기 들려주세요!');
    }
    return result;
  }, [schedules, records]);

  const upcoming = useMemo(() => {
    const now = new Date();
    return schedules.filter((s) => new Date(s.date) > now).sort((a, b) => a.date.localeCompare(b.date))[0];
  }, [schedules]);

  const todayCount = schedules.filter((s) => isSameDay(new Date(s.date), now)).length;

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: theme.background }}
      contentContainerStyle={{ paddingTop: insets.top + 12, paddingHorizontal: 20, paddingBottom: 36, gap: 18 }}
    >
      {/* 인사 */}
      <FadeInUp style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
        <View style={{ flex: 1, gap: 2 }}>
          <AppText variant="subhead" color={theme.brandDark} bold>
            {formatDayLong(now.toISOString())}
          </AppText>
          <AppText variant="title">{`${greeting(now.getHours())}!`}</AppText>
        </View>
        <View style={{ width: 56, height: 56, borderRadius: 28, backgroundColor: theme.peach, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' }}>
          <DamaMascot size={40} />
        </View>
      </FadeInUp>

      {/* 음성대화 */}
      <FadeInUp delay={80}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="음성대화 시작"
          onPress={() => router.push('/voice')}
          style={({ pressed }) => ({
            minHeight: 200,
            borderRadius: 30,
            backgroundColor: theme.brand,
            padding: 22,
            overflow: 'hidden',
            justifyContent: 'center',
            opacity: pressed ? 0.94 : 1,
            transform: [{ scale: pressed ? 0.98 : 1 }],
          })}
        >
          <View style={{ position: 'absolute', width: 230, height: 230, borderRadius: 115, backgroundColor: 'rgba(255,255,255,0.12)', top: -80, right: -60 }} />
          <View style={{ position: 'absolute', width: 120, height: 120, borderRadius: 60, backgroundColor: 'rgba(255,255,255,0.08)', bottom: -50, left: -30 }} />
          <View style={{ position: 'absolute', right: 12, bottom: 10 }}>
            <FloatingDama size={100} />
          </View>

          <View style={{ gap: 12, paddingRight: 104 }}>
            <View style={{ alignSelf: 'flex-start', flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 12, paddingVertical: 5, borderRadius: 999, backgroundColor: 'rgba(255,255,255,0.22)' }}>
              <Ionicons name="sparkles" size={12} color="#fff" />
              <AppText variant="caption" color="#fff" bold>
                다마가 기다리고 있어요
              </AppText>
            </View>
            <AppText variant="title" color="#fff">
              {'오늘 하루,\n어떠셨어요?'}
            </AppText>
            <View style={{ alignSelf: 'flex-start', flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 18, paddingVertical: 12, borderRadius: 999, backgroundColor: '#fff' }}>
              <GlowPulse />
              <Ionicons name="mic" size={20} color={theme.brand} />
              <AppText variant="headline" color={theme.brand}>
                음성대화 시작
              </AppText>
            </View>
          </View>
        </Pressable>
      </FadeInUp>

      {/* 기록 · 일정 */}
      <FadeInUp delay={160} style={{ flexDirection: 'row', gap: 14 }}>
        <Tile
          title="기록"
          subtitle={records.length ? `이야기 ${records.length}개` : '아직 없어요'}
          icon="book"
          color={theme.brandDark}
          tint={theme.peach}
          onPress={() => router.push('/records')}
        />
        <Tile
          title="일정"
          subtitle={todayCount ? `오늘 ${todayCount}개` : `전체 ${schedules.length}개`}
          icon="calendar"
          color={theme.success}
          tint={theme.successSoft}
          onPress={() => router.push('/schedule')}
        />
      </FadeInUp>

      {/* 다가오는 일정 */}
      <FadeInUp delay={240} style={{ gap: 10 }}>
        <SectionHeader title="다가오는 일정" action="전체보기" onAction={() => router.push('/schedule')} />
        {upcoming ? (
          <Pressable accessibilityRole="button" onPress={() => router.push('/schedule')}>
            <Card style={{ padding: 14, flexDirection: 'row', alignItems: 'center', gap: 14 }}>
              <DateBadge iso={upcoming.date} color={scheduleVisual(upcoming).color} />
              <View style={{ flex: 1, gap: 2 }}>
                <AppText variant="caption" color={scheduleVisual(upcoming).color} bold>
                  {`${relativeDayLabel(upcoming.date) ?? formatDay(upcoming.date)} · ${formatAmPm(upcoming.date)}`}
                </AppText>
                <AppText variant="headline" numberOfLines={1}>
                  {upcoming.title}
                </AppText>
                {upcoming.place ? (
                  <AppText variant="subhead" color={theme.subInk} numberOfLines={1}>
                    {upcoming.place}
                  </AppText>
                ) : null}
              </View>
              <ScheduleIcon item={upcoming} size={44} />
            </Card>
          </Pressable>
        ) : (
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, padding: 14, borderRadius: 22, borderWidth: 1.5, borderStyle: 'dashed', borderColor: '#E8D3C0' }}>
            <DamaMascot size={44} />
            <AppText variant="callout" color={theme.subInk} style={{ flex: 1 }}>
              {'다마와 이야기하면\n일정을 자동으로 정리해 드려요.'}
            </AppText>
          </View>
        )}
      </FadeInUp>

      {/* 알림 */}
      <FadeInUp delay={320}>
        <Card style={{ padding: 16, gap: 12 }}>
          <Pressable
            accessibilityRole="button"
            onPress={() => setExpanded((v) => !v)}
            style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}
          >
            <View style={{ width: 42, height: 42, borderRadius: 21, backgroundColor: theme.peach, alignItems: 'center', justifyContent: 'center' }}>
              <Shake active={notices.length > 0}>
                <Ionicons name="notifications" size={20} color={theme.brand} />
              </Shake>
              {notices.length > 0 && (
                <View style={{ position: 'absolute', top: 8, right: 9, width: 9, height: 9, borderRadius: 5, backgroundColor: theme.listening, borderWidth: 1.5, borderColor: theme.peach }} />
              )}
            </View>
            <AppText variant="headline" style={{ flex: 1 }}>
              {notices.length === 0 ? '새로운 알림이 없어요.' : `${notices.length}개의 알림이 있어요.`}
            </AppText>
            {notices.length > 0 && <Ionicons name={expanded ? 'chevron-up' : 'chevron-down'} size={18} color={theme.subInk} />}
          </Pressable>
          {expanded &&
            notices.map((n) => (
              <View key={n} style={{ flexDirection: 'row', gap: 10, paddingLeft: 16 }}>
                <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: theme.brand, marginTop: 9 }} />
                <AppText variant="callout" style={{ flex: 1 }}>
                  {n}
                </AppText>
              </View>
            ))}
        </Card>
      </FadeInUp>

      {/* 추천 */}
      <FadeInUp delay={400} style={{ flexDirection: 'row', alignItems: 'center', gap: 14, padding: 18, borderRadius: 22, backgroundColor: theme.successSoft, overflow: 'hidden' }}>
        <View style={{ position: 'absolute', width: 120, height: 120, borderRadius: 60, backgroundColor: 'rgba(255,255,255,0.5)', right: -30, bottom: -50 }} />
        <View style={{ width: 48, height: 48, borderRadius: 24, backgroundColor: '#fff', alignItems: 'center', justifyContent: 'center' }}>
          <Ionicons name="leaf" size={22} color={theme.success} />
        </View>
        <View style={{ flex: 1, gap: 4 }}>
          <AppText variant="headline" color={theme.success}>
            사용자님을 위한 추천
          </AppText>
          <AppText variant="callout">{'좋아하시는 정보를 기반으로\n새로운 소식을 준비했습니다!'}</AppText>
        </View>
      </FadeInUp>
    </ScrollView>
  );
}

function SectionHeader({ title, action, onAction }: { title: string; action?: string; onAction?: () => void }) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
      <AppText variant="title3">{title}</AppText>
      {action ? (
        <Pressable accessibilityRole="button" hitSlop={10} onPress={onAction} style={{ flexDirection: 'row', alignItems: 'center', gap: 2 }}>
          <AppText variant="subhead" color={theme.subInk}>
            {action}
          </AppText>
          <Ionicons name="chevron-forward" size={14} color={theme.subInk} />
        </Pressable>
      ) : null}
    </View>
  );
}

function Tile({
  title,
  subtitle,
  icon,
  color,
  tint,
  onPress,
}: {
  title: string;
  subtitle: string;
  icon: IconName;
  color: string;
  tint: string;
  onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={title}
      onPress={onPress}
      style={({ pressed }) => ({ flex: 1, opacity: pressed ? 0.92 : 1, transform: [{ scale: pressed ? 0.97 : 1 }] })}
    >
      <Card style={{ padding: 16, gap: 16 }}>
        <View style={{ flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between' }}>
          <View style={{ width: 50, height: 50, borderRadius: 17, backgroundColor: tint, alignItems: 'center', justifyContent: 'center' }}>
            <Ionicons name={icon} size={24} color={color} />
          </View>
          <Ionicons name="chevron-forward" size={18} color="#C9BCB0" />
        </View>
        <View style={{ gap: 2 }}>
          <AppText variant="title2">{title}</AppText>
          <AppText variant="subhead" color={theme.subInk}>
            {subtitle}
          </AppText>
        </View>
      </Card>
    </Pressable>
  );
}
