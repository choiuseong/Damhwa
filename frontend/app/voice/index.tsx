// app/voice/index.tsx
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import React from "react";
import {
  SafeAreaView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";

export default function VoiceScreen() {
  const router = useRouter();

  const handleStart = () => {
    router.push("/voice/talk");

    // router.push("/voice/talk");
  };

  return (
    <SafeAreaView style={styles.container}>
      {/* 상단 헤더 */}
      <View style={styles.headerRow}>
        <Text style={styles.headerTitle}>음성대화</Text>
        <TouchableOpacity onPress={() => router.replace("/(tabs)")}>
          <Ionicons name="home-outline" size={30} color="#222" />
        </TouchableOpacity>
      </View>

      {/* 가운데 문구 */}
      <View style={styles.center}>
        <Text style={styles.message}>
          안녕하세요.{`\n`}
          당신의 하루를{`\n`}
          다마와 함께{`\n`}
          나누어보세요.
        </Text>
      </View>

      {/* 하단 버튼 */}
      <View style={styles.bottom}>
        <TouchableOpacity style={styles.button} onPress={handleStart}>
          <Text style={styles.buttonText}>시작하기</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const BUTTON_COLOR = "#BF6A2A";

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#FFF",
    paddingHorizontal: 24, // 좌우 여백 조금 더
    paddingTop: 60, // 위쪽 여백도 살짝
  },

  headerRow: {
    marginTop: 4,
    paddingHorizontal: 4, // 헤더도 살짝 안쪽으로
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 20,
  },

  headerTitle: {
    fontSize: 18,
    color: "#555",
  },

  center: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },

  message: {
    fontSize: 40, // 살짝 줄여서 덜 깨지게
    lineHeight: 52,
    marginBottom: 32, // 아래 여백 여유 있게
    fontWeight: "700",
    color: "#111",
    marginLeft: -130, // ← 중앙보다 20px 왼쪽으로 이동 (원하는 만큼 조절)
  },

  bottom: {
    alignItems: "center",
    marginBottom: 56, // 하단에서 약간 위로 띄우기
  },

  button: {
    minWidth: 240, // 버튼 더 넓게
    paddingHorizontal: 36,
    paddingVertical: 16, // 세로도 키워서 큼직하게
    borderRadius: 20,
    backgroundColor: BUTTON_COLOR,
    alignItems: "center",
    justifyContent: "center",
  },

  buttonText: {
    color: "#FFF",
    fontSize: 18, // 글자도 살짝 키움
    fontWeight: "600",
  },
});
