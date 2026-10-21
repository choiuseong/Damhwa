import { Pressable, ScrollView, View } from 'react-native';
import { router } from 'expo-router';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { AppText } from '../components/AppText';
import { Card } from '../components/Card';
import { DamaBanner, DamaEmptyState } from '../components/DamaBanner';
import { DateBadge } from '../components/DateBadge';
import { FadeInUp } from '../components/Motion';
import { scheduleVisual } from '../components/ScheduleIcon';
import { formatAmPm } from '../lib/format';
import { useAppStore } from '../store/useAppStore';
import { theme } from '../theme';

/** 홈의 '기록' — 지난 대화 요약 목록 (타임라인) */
export default function RecordsScreen() {
  const records = useAppStore((s) => s.records);

  return (
    <ScrollView style={{ flex: 1, backgroundColor: theme.background }} contentContainerStyle={{ padding: 20, gap: 16 }}>
      {records.length === 0 ? (
        <DamaEmptyState title="아직 기록이 없어요." message={'다마와 대화를 마치면\n이야기가 여기에 차곡차곡 남아요.'} />
      ) : (
        <>
          <FadeInUp>
            <DamaBanner title={`이야기 ${records.length}개`} message="다마와 나눈 소중한 이야기들이에요." />
          </FadeInUp>
          {records.map((r, i) => (
            <FadeInUp key={r.id} delay={100 + Math.min(i, 8) * 70} style={{ flexDirection: 'row', gap: 12 }}>
              <View style={{ alignItems: 'center' }}>
                <DateBadge iso={r.date} color={i === 0 ? theme.brand : theme.brandDark} />
                {i < records.length - 1 && <View style={{ flex: 1, width: 2, borderRadius: 1, backgroundColor: '#EBD9C8', marginTop: 6, marginBottom: -14 }} />}
              </View>
              <Pressable
                accessibilityRole="button"
                accessibilityHint="눌러서 다마와 나눈 대화를 볼 수 있어요"
                onPress={() => router.push(`/record/${r.id}`)}
                style={({ pressed }) => ({ flex: 1, opacity: pressed ? 0.92 : 1, transform: [{ scale: pressed ? 0.98 : 1 }] })}
              >
                <Card style={{ padding: 16, gap: 10 }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5 }}>
                    <Ionicons name="time-outline" size={14} color={theme.subInk} />
                    <AppText variant="caption" color={theme.subInk}>
                      {formatAmPm(r.date)}
                    </AppText>
                  </View>
                  <View style={{ flexDirection: 'row', gap: 8 }}>
                    <Ionicons name="chatbubble-ellipses" size={18} color={theme.brand} style={{ marginTop: 3 }} />
                    <AppText style={{ flex: 1 }}>{r.summary}</AppText>
                  </View>
                  {r.items.length > 0 && (
                    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
                      {r.items.map((item) => {
                        const meta = scheduleVisual(item);
                        return (
                          <View
                            key={item.id}
                            style={{ flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 10, paddingVertical: 5, borderRadius: 999, backgroundColor: `${meta.color}1F` }}
                          >
                            <MaterialCommunityIcons name={meta.icon} size={13} color={meta.color} />
                            <AppText variant="caption" color={meta.color} bold>
                              {item.title}
                            </AppText>
                          </View>
                        );
                      })}
                    </View>
                  )}
                  <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'flex-end', gap: 2, paddingTop: 2, borderTopWidth: 1, borderTopColor: theme.line, marginTop: 2 }}>
                    <AppText variant="subhead" color={theme.brand} bold style={{ paddingTop: 8 }}>
                      {r.transcript?.length ? `대화 ${r.transcript.length}마디 보기` : '자세히 보기'}
                    </AppText>
                    <Ionicons name="chevron-forward" size={16} color={theme.brand} style={{ paddingTop: 8 }} />
                  </View>
                </Card>
              </Pressable>
            </FadeInUp>
          ))}
        </>
      )}
    </ScrollView>
  );
}
