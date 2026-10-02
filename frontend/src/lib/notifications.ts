import * as Notifications from 'expo-notifications';
import Constants from 'expo-constants';
import { Platform } from 'react-native';
import type { ScheduleItem } from '../types';
import { formatAmPm } from './format';
import { registerDevice } from '../api';

const DAILY_ID = 'daily-checkin';

export function configureNotifications() {
  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowBanner: true,
      shouldShowList: true,
      shouldPlaySound: true,
      shouldSetBadge: false,
    }),
  });
  if (Platform.OS === 'android') {
    Notifications.setNotificationChannelAsync('default', {
      name: '담화',
      importance: Notifications.AndroidImportance.DEFAULT,
    }).catch(() => {});
  }
}

export async function ensurePermission(): Promise<boolean> {
  const current = await Notifications.getPermissionsAsync();
  if (current.granted) return true;
  if (!current.canAskAgain) return false;
  const next = await Notifications.requestPermissionsAsync();
  return next.granted;
}

/** 일정 30분 전 알림 */
export async function scheduleReminder(item: ScheduleItem): Promise<void> {
  const fire = new Date(new Date(item.date).getTime() - 30 * 60 * 1000);
  if (fire.getTime() <= Date.now()) return;
  await Notifications.scheduleNotificationAsync({
    identifier: item.id,
    content: {
      title: '일정 알림',
      body: `${formatAmPm(item.date)} '${item.title}' 준비하실 시간이 다가와요.`,
      data: { type: 'schedule', id: item.id },
    },
    trigger: { type: Notifications.SchedulableTriggerInputTypes.DATE, date: fire },
  });
}

export async function cancelReminder(id: string): Promise<void> {
  await Notifications.cancelScheduledNotificationAsync(id).catch(() => {});
}

/** 먼저 다가오는 AI: 매일 정해진 시간에 안부 묻기 (탭하면 음성대화로 이동) */
export async function scheduleDailyCheckIn(minutes: number): Promise<void> {
  await Notifications.cancelScheduledNotificationAsync(DAILY_ID).catch(() => {});
  await Notifications.scheduleNotificationAsync({
    identifier: DAILY_ID,
    content: {
      title: '다마가 안부를 여쭤요',
      body: '오늘 하루는 어떠세요? 이야기 들려주세요.',
      data: { type: 'checkin' },
    },
    trigger: {
      type: Notifications.SchedulableTriggerInputTypes.DAILY,
      hour: Math.floor(minutes / 60),
      minute: minutes % 60,
    },
  });
}

export async function cancelDailyCheckIn(): Promise<void> {
  await Notifications.cancelScheduledNotificationAsync(DAILY_ID).catch(() => {});
}

/** 서버 푸시용 Expo push token 등록 (서버 모드 + 개발 빌드에서만 의미 있음) */
export async function registerPushToken(): Promise<void> {
  try {
    const projectId = (Constants.expoConfig?.extra as { eas?: { projectId?: string } } | undefined)?.eas?.projectId;
    if (!projectId) return;
    const { data } = await Notifications.getExpoPushTokenAsync({ projectId });
    await registerDevice(data);
  } catch {
    // 시뮬레이터/권한 없음 등은 조용히 무시
  }
}
