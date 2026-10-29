import { useEffect, useState } from 'react';
import { router, Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import * as Notifications from 'expo-notifications';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { theme } from '../theme';
import { useAppStore } from '../store/useAppStore';
import {
  cancelDailyCheckIn,
  cancelMealCheckIns,
  configureNotifications,
  ensurePermission,
  registerPushToken,
  scheduleDailyCheckIn,
  scheduleMealCheckIns,
} from '../lib/notifications';

configureNotifications();

export default function RootLayout() {
  const [ready, setReady] = useState(useAppStore.persist.hasHydrated());
  const hasOnboarded = useAppStore((s) => s.hasOnboarded);
  const notificationsEnabled = useAppStore((s) => s.notificationsEnabled);
  const checkInMinutes = useAppStore((s) => s.checkInMinutes);
  const setNotificationsEnabled = useAppStore((s) => s.setNotificationsEnabled);
  const mealCheckInEnabled = useAppStore((s) => s.mealCheckInEnabled);
  const setMealCheckInEnabled = useAppStore((s) => s.setMealCheckInEnabled);

  // 저장된 상태를 다 불러온 뒤에 화면을 그린다
  useEffect(() => {
    if (useAppStore.persist.hasHydrated()) setReady(true);
    return useAppStore.persist.onFinishHydration(() => setReady(true));
  }, []);

  // 먼저 다가오는 AI: 매일 안부 알림
  useEffect(() => {
    if (!ready || !hasOnboarded) return;
    (async () => {
      if (notificationsEnabled) {
        if (await ensurePermission()) {
          await scheduleDailyCheckIn(checkInMinutes);
          registerPushToken();
        } else {
          setNotificationsEnabled(false);
        }
      } else {
        await cancelDailyCheckIn();
      }
    })().catch(() => {});
  }, [ready, hasOnboarded, notificationsEnabled, checkInMinutes, setNotificationsEnabled]);

  // 아침·점심·저녁 식사 안부 알림 (다마 목소리)
  useEffect(() => {
    if (!ready || !hasOnboarded) return;
    (async () => {
      if (mealCheckInEnabled) {
        if (await ensurePermission()) await scheduleMealCheckIns();
        else setMealCheckInEnabled(false);
      } else {
        await cancelMealCheckIns();
      }
    })().catch(() => {});
  }, [ready, hasOnboarded, mealCheckInEnabled, setMealCheckInEnabled]);

  // 알림을 누르면 해당 화면으로 이동
  useEffect(() => {
    const sub = Notifications.addNotificationResponseReceivedListener((response) => {
      const data = response.notification.request.content.data;
      const type = data?.type;
      if (type === 'checkin') router.push('/voice');
      else if (type === 'meal') router.push({ pathname: '/voice', params: { topic: 'meal' } });
      else if (type === 'alarm')
        router.push({ pathname: '/voice', params: { topic: 'alarm', title: String(data?.title ?? ''), message: String(data?.message ?? '') } });
      else if (type === 'schedule') router.push('/schedule');
    });
    return () => sub.remove();
  }, []);

  if (!ready) return null;

  return (
    <SafeAreaProvider>
      <StatusBar style="dark" />
      <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: theme.background } }}>
        <Stack.Screen name="voice" options={{ presentation: 'fullScreenModal', animation: 'slide_from_bottom', gestureEnabled: false }} />
        <Stack.Screen
          name="schedule"
          options={{ headerShown: true, title: '일정 관리', headerTintColor: theme.brand, headerStyle: { backgroundColor: theme.background }, headerShadowVisible: false, headerBackTitle: '뒤로' }}
        />
        <Stack.Screen
          name="records"
          options={{ headerShown: true, title: '기록', headerTintColor: theme.brand, headerStyle: { backgroundColor: theme.background }, headerShadowVisible: false, headerBackTitle: '뒤로' }}
        />
        <Stack.Screen
          name="record/[id]"
          options={{ headerShown: true, title: '', headerTintColor: theme.brand, headerStyle: { backgroundColor: theme.background }, headerShadowVisible: false, headerBackTitle: '뒤로' }}
        />
        <Stack.Screen
          name="room/[id]"
          options={{ headerShown: true, title: '', headerTintColor: theme.brand, headerShadowVisible: false, headerBackTitle: '뒤로' }}
        />
      </Stack>
    </SafeAreaProvider>
  );
}
