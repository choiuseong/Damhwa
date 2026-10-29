import * as Notifications from 'expo-notifications';
import Constants from 'expo-constants';
import { Platform } from 'react-native';
import type { ScheduleItem } from '../types';
import { formatAmPm } from './format';
import { registerDevice } from '../api';
import { announceToActiveSession } from '../voice/activeSession';

const DAILY_ID = 'daily-checkin';

/** 일정 시각 알림: 다마 목소리로 "약 드실 시간이에요" 등이 울린다 (assets/sounds) */
const ALARM_CHANNELS = {
  medicine: { id: 'alarm-medicine', sound: 'alarm_medicine.wav' },
  general: { id: 'alarm-general', sound: 'alarm_general.wav' },
} as const;

const alarmId = (id: string) => `alarm-${id}`;

/** '약속', '예약', '약국'은 약 먹는 일정이 아니다 */
const isMedicine = (title: string) => title.replace(/약속|예약|약국/g, '').includes('약');

/** 식사 안부: 일반 알림음 대신 다마 목소리("식사는 하셨어요?")가 울린다 (assets/sounds) */
const MEALS = [
  { id: 'meal-breakfast', sound: 'meal_breakfast.wav', hour: 8, body: '어르신, 좋은 아침이에요. 아침 식사는 하셨어요?' },
  { id: 'meal-lunch', sound: 'meal_lunch.wav', hour: 12, body: '어르신, 점심 식사는 하셨어요?' },
  { id: 'meal-dinner', sound: 'meal_dinner.wav', hour: 18, body: '어르신, 저녁 식사는 맛있게 하셨어요?' },
] as const;

export function configureNotifications() {
  Notifications.setNotificationHandler({
    handleNotification: async (notification) => {
      const { title, data } = notification.request.content;
      // 대화 중이면 알림음 대신 다마가 대화 속에서 직접 말해 준다
      if (data?.type === 'alarm' && announceToActiveSession(String(data.title ?? title ?? ''), String(data.message ?? ''))) {
        return { shouldShowBanner: false, shouldShowList: true, shouldPlaySound: false, shouldSetBadge: false };
      }
      return { shouldShowBanner: true, shouldShowList: true, shouldPlaySound: true, shouldSetBadge: false };
    },
  });
  if (Platform.OS === 'android') {
    Notifications.setNotificationChannelAsync('default', {
      name: '담화',
      importance: Notifications.AndroidImportance.DEFAULT,
    }).catch(() => {});
    // 안드로이드는 채널마다 소리가 정해지고, 만든 뒤에는 바꿀 수 없어서 끼니별 채널을 따로 둔다
    MEALS.forEach((m) =>
      Notifications.setNotificationChannelAsync(m.id, {
        name: '식사 안부',
        importance: Notifications.AndroidImportance.HIGH,
        sound: m.sound,
      }).catch(() => {}),
    );
    Object.values(ALARM_CHANNELS).forEach((c) =>
      Notifications.setNotificationChannelAsync(c.id, {
        name: '일정 알림',
        importance: Notifications.AndroidImportance.HIGH,
        sound: c.sound,
      }).catch(() => {}),
    );
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

/** 일정 시각 알림: 다마가 말 건네듯 알려 준다 (탭하면 다마가 그 일정 이야기로 대화를 시작) */
export async function scheduleAlarm(item: { id: string; title: string; date: string; message: string }): Promise<void> {
  const fire = new Date(item.date);
  if (fire.getTime() <= Date.now()) return;
  if (!(await ensurePermission())) return;
  const channel = isMedicine(item.title) ? ALARM_CHANNELS.medicine : ALARM_CHANNELS.general;
  await Notifications.scheduleNotificationAsync({
    identifier: alarmId(item.id),
    content: {
      title: '다마',
      body: item.message,
      sound: channel.sound,
      data: { type: 'alarm', id: item.id, title: item.title, message: item.message },
    },
    trigger: { type: Notifications.SchedulableTriggerInputTypes.DATE, date: fire, channelId: channel.id },
  });
}

export async function cancelReminder(id: string): Promise<void> {
  await Notifications.cancelScheduledNotificationAsync(id).catch(() => {});
  await Notifications.cancelScheduledNotificationAsync(alarmId(id)).catch(() => {});
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

/** 매일 아침·점심·저녁 식사 안부 (탭하면 다마가 식사 이야기로 대화를 시작) */
export async function scheduleMealCheckIns(): Promise<void> {
  await cancelMealCheckIns();
  for (const m of MEALS) {
    await Notifications.scheduleNotificationAsync({
      identifier: m.id,
      content: {
        title: '다마',
        body: m.body,
        sound: m.sound,
        data: { type: 'meal' },
      },
      trigger: {
        type: Notifications.SchedulableTriggerInputTypes.DAILY,
        hour: m.hour,
        minute: 0,
        channelId: m.id,
      },
    });
  }
}

export async function cancelMealCheckIns(): Promise<void> {
  await Promise.all(MEALS.map((m) => Notifications.cancelScheduledNotificationAsync(m.id).catch(() => {})));
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
