// app/voice/speak.tsx
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import {
  SafeAreaView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";

export default function VoiceSpeakScreen() {
  const router = useRouter();

  const handleStopSpeaking = () => {
    // 말하기 끝나면 다시 듣는 화면으로 돌아가는 예시
    router.replace("/voice/talk");
  };

  return (
    <SafeAreaView style={styles.container}>
      {/* 상단 헤더 */}
      <View style={styles.headerRow}>
        <Text style={styles.headerTitle}>음성대화</Text>
        <TouchableOpacity onPress={() => router.replace("/(tabs)")}>
          <Ionicons name="home-outline" size={22} color="#222" />
        </TouchableOpacity>
      </View>

      {/* 말하는 중 배너 */}
      <View style={styles.stateWrapper}>
        <View style={styles.stateBox}>
          <Text style={styles.stateText}>말하는 중</Text>
        </View>
      </View>

      {/* 안내 문구 */}
      <View style={styles.center}>
        <Text style={styles.message}>
          편하게 말씀해 주세요.{`\n`}
          다마가 잘 듣고 있어요.
        </Text>
      </View>

      {/* 하단 버튼: 말하기 종료 */}
      <View style={styles.bottom}>
        <TouchableOpacity style={styles.micButton} onPress={handleStopSpeaking}>
          <Ionicons name="mic-off" size={30} color="#fff" />
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const MAIN_COLOR = "#BF6A2A";

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#FFF",
    paddingHorizontal: 24,
    paddingTop: 60,
  },
  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 20,
  },
  headerTitle: {
    fontSize: 18,
    color: "#555",
  },
  stateWrapper: {
    marginTop: 24,
    alignItems: "center",
  },
  stateBox: {
    paddingHorizontal: 80,
    paddingVertical: 20,
    borderRadius: 20,
    backgroundColor: "#EDEDED",
    alignItems: "center",
    minWidth: 180,
  },
  stateText: {
    fontSize: 28,
    fontWeight: "600",
    color: "#333",
  },
  center: {
    flex: 1,
    justifyContent: "center",
  },
  message: {
    fontSize: 30,
    lineHeight: 38,
    fontWeight: "500",
    color: "#111",
    textAlign: "left",
  },
  bottom: {
    alignItems: "center",
    marginBottom: 56,
  },
  micButton: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: MAIN_COLOR,
    alignItems: "center",
    justifyContent: "center",
  },
});
