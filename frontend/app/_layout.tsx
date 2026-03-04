// app/_layout.tsx
import { Stack } from "expo-router";

export default function RootLayout() {
  return (
    <Stack screenOptions={{ headerShown: false }}>
      {/* 온보딩 */}
      <Stack.Screen name="onboarding" />
      {/* 탭(홈) */}
      <Stack.Screen name="(tabs)" />
      {/* 음성대화 화면 */}
      <Stack.Screen name="voice" />
    </Stack>
  );
}
