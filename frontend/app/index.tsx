// app/index.tsx
import { Redirect } from "expo-router";

export default function Index() {
  // ✅ 앱 켜지면 무조건 온보딩으로 보냄
  return <Redirect href="/onboarding" />;
}
