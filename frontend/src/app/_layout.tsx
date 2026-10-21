import { useEffect, useSyncExternalStore } from 'react';
import { router, Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import * as Notifications from 'expo-notifications';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { theme } from '../theme';
import { PREVIEW_MODE } from '../api/config';
import { DialogHost } from '../components/DialogHost';
import { useAppStore } from '../store/useAppStore';
import {
  cancelDailyCheckIn,
  configureNotifications,
  ensurePermission,
  registerPushToken,
  scheduleDailyCheckIn,
} from '../lib/notifications';

configureNotifications();

export default function RootLayout() {
  const ready = useSyncExternalStore(
    (notify) => useAppStore.persist.onFinishHydration(notify),
    () => useAppStore.persist.hasHydrated(),
    () => false,
  );
  const hasOnboarded = useAppStore((s) => s.hasOnboarded);
  const notificationsEnabled = useAppStore((s) => s.notificationsEnabled);
  const checkInMinutes = useAppStore((s) => s.checkInMinutes);
  const setNotificationsEnabled = useAppStore((s) => s.setNotificationsEnabled);

  // 미리보기 모드: 가짜 데이터를 한 번 채움 / 끄면 남은 가짜 데이터 정리
  useEffect(() => {
    if (!ready) return;
    if (PREVIEW_MODE) useAppStore.getState().seedPreview();
    else useAppStore.getState().purgePreview();
  }, [ready]);

  // 먼저 다가오는 AI: 매일 안부 알림 (미리보기 모드에서는 기기 알림 등록 생략)
  useEffect(() => {
    if (!ready || !hasOnboarded || PREVIEW_MODE) return;
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

  // 알림을 누르면 해당 화면으로 이동
  useEffect(() => {
    if (PREVIEW_MODE) return;
    const sub = Notifications.addNotificationResponseReceivedListener((response) => {
      const type = response.notification.request.content.data?.type;
      if (type === 'checkin') router.push('/voice');
      else if (type === 'schedule') router.push('/schedule');
    });
    return () => sub.remove();
  }, []);

  if (!ready) return null;

  return (
    <SafeAreaProvider>
      <StatusBar style="dark" />
      <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: theme.white } }}>
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
      {/* 웹에서만 사용 (Alert.alert 가 웹에서 동작하지 않아서). 휴대폰은 시스템 Alert */}
      <DialogHost />
    </SafeAreaProvider>
  );
}
