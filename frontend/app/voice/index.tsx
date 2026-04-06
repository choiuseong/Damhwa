import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import React from "react";
import {
  SafeAreaView,
  StyleSheet,
  Text,
  TouchableOpacity,
  useWindowDimensions,
  View,
} from "react-native";

export default function VoiceScreen() {
  const router = useRouter();
  const { width } = useWindowDimensions();

  // 공통 헤더 규격 (모든 화면 동일 적용)
  const headerFontSize = width * 0.05; // 약 20px
  const headerIconSize = width * 0.08; // 약 32px

  // 본문 및 버튼 반응형 수치
  const messageFontSize = width * 0.11;
  const messageLineHeight = messageFontSize * 1.3;
  const buttonWidth = width * 0.8;
  const buttonFontSize = width * 0.06;

  const handleStart = () => {
    router.push("/voice/talk");
  };

  return (
    <SafeAreaView style={styles.container}>
      {/* 고정 헤더 영역 (speak, talk와 동일하게 맞춤) */}
      <View style={styles.headerRow}>
        <Text style={[styles.headerTitle, { fontSize: headerFontSize }]}>
          음성대화
        </Text>
        <TouchableOpacity
          onPress={() => router.replace("/(tabs)")}
          hitSlop={{ top: 15, bottom: 15, left: 15, right: 15 }}
        >
          <Ionicons name="home-outline" size={headerIconSize} color="#222" />
        </TouchableOpacity>
      </View>

      {/* 가운데 문구 */}
      <View style={styles.center}>
        <Text
          style={[
            styles.message,
            {
              fontSize: messageFontSize,
              lineHeight: messageLineHeight,
              paddingLeft: width * 0.05,
            },
          ]}
        >
          안녕하세요.{`\n`}
          당신의 하루를{`\n`}
          다마와 함께{`\n`}
          나누어보세요.
        </Text>
      </View>

      {/* 하단 버튼 */}
      <View style={styles.bottom}>
        <TouchableOpacity
          style={[styles.button, { width: buttonWidth }]}
          onPress={handleStart}
          activeOpacity={0.8}
        >
          <Text style={[styles.buttonText, { fontSize: buttonFontSize }]}>
            시작하기
          </Text>
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
    // 화면 전체 좌우 여백을 8%로 통일하여 헤더 위치 고정
    paddingHorizontal: "8%",
  },

  headerRow: {
    // 헤더 높이와 내부 여백을 고정하여 화면 전환 시 흔들림 방지
    height: 60,
    marginTop: 10,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 4,
  },

  headerTitle: {
    color: "#555",
    fontWeight: "600",
  },

  center: {
    flex: 1,
    justifyContent: "center",
    alignItems: "flex-start",
  },

  message: {
    fontWeight: "700",
    color: "#111",
  },

  bottom: {
    alignItems: "center",
    marginBottom: "15%",
  },

  button: {
    paddingVertical: 20,
    borderRadius: 25,
    backgroundColor: BUTTON_COLOR,
    alignItems: "center",
    justifyContent: "center",
    elevation: 4,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
  },

  buttonText: {
    color: "#FFF",
    fontWeight: "800",
  },
});
