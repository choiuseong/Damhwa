import { Ionicons } from "@expo/vector-icons";
import { Tabs } from "expo-router";

export default function TabLayout() {
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: "#B36A3C", // 활성화 색상
        tabBarInactiveTintColor: "#888", // 비활성화 색상
        tabBarLabelStyle: { fontWeight: "700", fontSize: 11 }, // 탭이 많으므로 폰트 살짝 조정
        tabBarStyle: { backgroundColor: "#fff" },
      }}
    >
      {/* 1. 홈 */}
      <Tabs.Screen
        name="index"
        options={{
          title: "홈",
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="home" size={size} color={color} />
          ),
        }}
      />

      {/* 2. 기록 */}
      <Tabs.Screen
        name="record"
        options={{
          title: "기록",
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="mic" size={size} color={color} />
          ),
        }}
      />

      {/* 3. 일정 */}
      <Tabs.Screen
        name="schedule"
        options={{
          title: "일정",
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="calendar" size={size} color={color} />
          ),
        }}
      />

      {/* 4. 커뮤니티1 (경로당 목록) */}
      <Tabs.Screen
        name="community/index" // app/(tabs)/community/index.tsx 연결
        options={{
          title: "경로당",
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="people-circle" size={size + 2} color={color} />
          ),
        }}
      />

      {/* 5. 커뮤니티2 (수다방 - room.tsx 기조 유지) */}
      <Tabs.Screen
        name="community/room" // 🎯 중요: app/(tabs)/community/room.tsx 직접 연결
        options={{
          title: "수다방",
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="chatbubbles-sharp" size={size} color={color} />
          ),
        }}
      />

      {/* 6. 강의 */}
      <Tabs.Screen
        name="lecture"
        options={{
          title: "강의",
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="play-circle" size={size} color={color} />
          ),
        }}
      />
    </Tabs>
  );
}
