import type { ComponentProps } from 'react';
import { View } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { theme } from '../theme';
import type { ScheduleItem } from '../types';

type McIcon = ComponentProps<typeof MaterialCommunityIcons>['name'];

interface Visual {
  icon: McIcon;
  color: string;
  /** 한눈에 알아보는 짧은 이름 (예: 치과) */
  label: string;
}

/** 일정 제목·장소의 낱말로 알아보기 쉬운 그림을 고른다. 위에 있을수록 우선. */
const KEYWORDS: { words: string[]; visual: Visual }[] = [
  { words: ['치과', '이빨', '치아', '임플란트', '틀니'], visual: { icon: 'tooth', color: theme.blue, label: '치과' } },
  { words: ['약국', '약 ', '약을', '약 타', '처방'], visual: { icon: 'pill', color: theme.blue, label: '약' } },
  { words: ['병원', '진료', '검진', '한의원', '내과', '안과', '정형외과', '물리치료'], visual: { icon: 'stethoscope', color: theme.blue, label: '병원' } },
  { words: ['경로당', '복지관'], visual: { icon: 'home-heart', color: theme.success, label: '경로당' } },
  { words: ['생일', '잔치', '칠순', '팔순'], visual: { icon: 'cake-variant', color: theme.pink, label: '생일' } },
  { words: ['식사', '점심', '저녁 약속', '밥', '외식'], visual: { icon: 'silverware-fork-knife', color: theme.brand, label: '식사' } },
  { words: ['백화점', '쇼핑'], visual: { icon: 'shopping', color: theme.pink, label: '쇼핑' } },
  { words: ['마트', '시장', '장보'], visual: { icon: 'cart-outline', color: theme.pink, label: '장보기' } },
  { words: ['산책', '운동', '등산', '체조'], visual: { icon: 'walk', color: theme.success, label: '산책' } },
  { words: ['미용실', '머리', '이발'], visual: { icon: 'content-cut', color: theme.brandDark, label: '미용실' } },
  { words: ['은행', '우체국'], visual: { icon: 'bank', color: theme.brandDark, label: '은행' } },
  { words: ['교회', '성당', '절에', '예배', '미사'], visual: { icon: 'church', color: theme.brandDark, label: '종교' } },
  { words: ['전화', '통화'], visual: { icon: 'phone', color: theme.success, label: '전화' } },
  { words: ['딸', '아들', '손주', '손자', '손녀', '가족', '친구'], visual: { icon: 'account-group', color: theme.brand, label: '만남' } },
];

const BY_CATEGORY: Record<ScheduleItem['category'], Visual> = {
  '외출/쇼핑': { icon: 'shopping', color: theme.pink, label: '외출' },
  '경로당 방문': { icon: 'home-heart', color: theme.success, label: '경로당' },
  '병원': { icon: 'stethoscope', color: theme.blue, label: '병원' },
  '일정': { icon: 'calendar-star', color: theme.brand, label: '일정' },
};

export function scheduleVisual(item: Pick<ScheduleItem, 'title' | 'place' | 'category'>): Visual {
  const text = `${item.title} ${item.place ?? ''} `;
  return KEYWORDS.find((k) => k.words.some((w) => text.includes(w)))?.visual ?? BY_CATEGORY[item.category];
}

/** 동그란 배경 위의 일정 아이콘 */
export function ScheduleIcon({ item, size = 48, solid }: { item: Pick<ScheduleItem, 'title' | 'place' | 'category'>; size?: number; solid?: boolean }) {
  const v = scheduleVisual(item);
  return (
    <View
      style={{
        width: size,
        height: size,
        borderRadius: size / 2,
        backgroundColor: solid ? v.color : `${v.color}1F`,
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <MaterialCommunityIcons name={v.icon} size={size * 0.52} color={solid ? '#fff' : v.color} />
    </View>
  );
}
