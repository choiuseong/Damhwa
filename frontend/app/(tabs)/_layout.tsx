import { Ionicons } from "@expo/vector-icons";
import { Tabs } from "expo-router";

export default function TabLayout() {
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: "#B36A3C", // 활성화 색상 (다마 메인 컬러)
        tabBarInactiveTintColor: "#888", // 비활성화 색상
        tabBarLabelStyle: { fontWeight: "700", fontSize: 13 }, // 3개이므로 폰트를 키워 시인성 확보
        tabBarStyle: { 
          backgroundColor: "#fff", 
          height: 65, 
          paddingBottom: 10 
        },
      }}
    >
      {/* 1. 홈: 메인 대시보드 (음성대화 버튼 등이 있는 곳) */}
      <Tabs.Screen
        name="index"
        options={{
          title: "홈",
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="home" size={size + 2} color={color} />
          ),
        }}
      />

      {/* 2. 사이버경로당: 커뮤니티 기능을 대표하는 탭 */}
      <Tabs.Screen
        name="community/index" // 기존 경로당 목록 화면 연결
        options={{
          title: "사이버경로당",
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="people" size={size + 4} color={color} />
          ),
        }}
      />

      {/* 3. 설정: 앱 설정 및 사용자 관리 */}
      {/* 만약 설정 파일명이 다르면 'name' 부분을 실제 파일명(예: settings)으로 바꿔주세요 */}
      <Tabs.Screen
        name="settings" 
        options={{
          title: "설정",
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="settings-sharp" size={size + 2} color={color} />
          ),
        }}
      />

      {/* --- 하단 탭 바에서 숨겨지는 화면들 --- */}
      {/* 홈 화면의 큰 버튼으로 들어가는 '음성 대화'나 '기록' 등은 여기서 숨깁니다. */}
      <Tabs.Screen name="community/room" options={{ href: null }} />
      <Tabs.Screen name="record" options={{ href: null }} />
      <Tabs.Screen name="schedule" options={{ href: null }} />
      <Tabs.Screen name="lecture" options={{ href: null }} />
    </Tabs>
  );
}