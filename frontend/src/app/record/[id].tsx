import { ScrollView, View } from 'react-native';
import { Stack, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { AppText } from '../../components/AppText';
import { Card } from '../../components/Card';
import { DamaEmptyState } from '../../components/DamaBanner';
import { DamaMascot } from '../../components/DamaMascot';
import { FadeInUp } from '../../components/Motion';
import { ScheduleIcon, scheduleVisual } from '../../components/ScheduleIcon';
import { formatAmPm, formatDay, formatDayLong } from '../../lib/format';
import { useAppStore } from '../../store/useAppStore';
import { theme } from '../../theme';
import type { TranscriptTurn } from '../../types';

/** 기록 하나 — 다마와 주고받은 대화를 채팅처럼 */
export default function RecordDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const record = useAppStore((s) => s.records.find((r) => r.id === id));

  if (!record) {
    return (
      <View style={{ flex: 1, backgroundColor: theme.background, padding: 20 }}>
        <DamaEmptyState title="기록을 찾지 못했어요." message="지워졌거나 없는 기록이에요." />
      </View>
    );
  }

  const turns = record.transcript ?? [];

  return (
    <>
      <Stack.Screen options={{ title: formatDay(record.date) }} />
      <ScrollView style={{ flex: 1, backgroundColor: theme.background }} contentContainerStyle={{ padding: 20, paddingBottom: 36, gap: 14 }}>
        {/* 요약 */}
        <FadeInUp>
          <View style={{ padding: 18, borderRadius: 24, backgroundColor: theme.peach, gap: 8, overflow: 'hidden' }}>
            <View style={{ position: 'absolute', width: 150, height: 150, borderRadius: 75, backgroundColor: 'rgba(255,255,255,0.45)', right: -40, top: -60 }} />
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
              <Ionicons name="sparkles" size={14} color={theme.brand} />
              <AppText variant="subhead" color={theme.brand} bold>
                {`${formatDayLong(record.date)} ${formatAmPm(record.date)}`}
              </AppText>
            </View>
            <AppText variant="title3">{record.summary}</AppText>
          </View>
        </FadeInUp>

        {/* 대화 */}
        {turns.length === 0 ? (
          <FadeInUp delay={120}>
            <Card style={{ padding: 18, flexDirection: 'row', alignItems: 'center', gap: 12 }}>
              <DamaMascot size={44} />
              <AppText variant="callout" color={theme.subInk} style={{ flex: 1 }}>
                {'이 기록은 대화 내용이 저장되기 전에 만들어졌어요.\n다음 대화부터는 여기서 다시 볼 수 있어요.'}
              </AppText>
            </Card>
          </FadeInUp>
        ) : (
          <View style={{ gap: 12, paddingTop: 4 }}>
            <DayDivider text="다마와 나눈 이야기" />
            {turns.map((t, i) => (
              <Bubble key={i} turn={t} showAvatar={t.role === 'assistant' && turns[i - 1]?.role !== 'assistant'} delay={150 + Math.min(i, 10) * 60} />
            ))}
          </View>
        )}

        {/* 정리된 일정 */}
        {record.items.length > 0 && (
          <FadeInUp delay={300} style={{ gap: 10, paddingTop: 10 }}>
            <DayDivider text="이 대화에서 정리한 일정" />
            {record.items.map((item) => (
              <Card key={item.id} style={{ padding: 14, flexDirection: 'row', alignItems: 'center', gap: 14 }}>
                <ScheduleIcon item={item} size={48} />
                <View style={{ flex: 1 }}>
                  <AppText variant="caption" color={scheduleVisual(item).color} bold>
                    {`${formatDay(item.date)} ${formatAmPm(item.date)}`}
                  </AppText>
                  <AppText variant="headline">{item.title}</AppText>
                </View>
              </Card>
            ))}
          </FadeInUp>
        )}
      </ScrollView>
    </>
  );
}

function DayDivider({ text }: { text: string }) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
      <View style={{ flex: 1, height: 1, backgroundColor: '#EBD9C8' }} />
      <AppText variant="caption" color={theme.brandDark} bold>
        {text}
      </AppText>
      <View style={{ flex: 1, height: 1, backgroundColor: '#EBD9C8' }} />
    </View>
  );
}

function Bubble({ turn, showAvatar, delay }: { turn: TranscriptTurn; showAvatar: boolean; delay: number }) {
  const mine = turn.role === 'user';
  return (
    <FadeInUp delay={delay} distance={10} style={{ flexDirection: 'row', justifyContent: mine ? 'flex-end' : 'flex-start', alignItems: 'flex-end', gap: 8 }}>
      {!mine && (
        <View style={{ width: 40, alignItems: 'center' }}>
          {showAvatar ? (
            <View style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: theme.peach, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' }}>
              <DamaMascot size={30} mood="still" />
            </View>
          ) : null}
        </View>
      )}
      <View style={{ maxWidth: '78%', gap: 4 }}>
        {showAvatar && (
          <AppText variant="caption" color={theme.brandDark} bold style={{ marginLeft: 4 }}>
            다마
          </AppText>
        )}
        <View
          style={{
            paddingHorizontal: 16,
            paddingVertical: 12,
            borderRadius: 22,
            borderBottomLeftRadius: mine ? 22 : 6,
            borderBottomRightRadius: mine ? 6 : 22,
            backgroundColor: mine ? theme.brand : theme.white,
            shadowColor: '#C77338',
            shadowOpacity: mine ? 0 : 0.08,
            shadowRadius: 6,
            shadowOffset: { width: 0, height: 2 },
            elevation: mine ? 0 : 1,
          }}
        >
          <AppText color={mine ? '#fff' : theme.ink}>{turn.text}</AppText>
        </View>
      </View>
    </FadeInUp>
  );
}
