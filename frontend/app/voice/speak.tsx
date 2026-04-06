// app/voice/speak.tsx
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import {
  SafeAreaView,
  StyleSheet,
  Text,
  TouchableOpacity,
  useWindowDimensions,
  View,
} from "react-native";

export default function VoiceSpeakScreen() {
  const router = useRouter();
  const { width } = useWindowDimensions();

  // 공통 헤더 규격 (index, talk와 100% 동일하게 맞춤)
  const headerFontSize = width * 0.05;
  const headerIconSize = width * 0.08;

  // 본문 반응형 수치
  const stateBoxWidth = width * 0.8;
  const stateTextSize = width * 0.08;
  const messageFontSize = width * 0.085;
  const micButtonSize = width * 0.22;

  const handleStopSpeaking = () => {
    router.replace("/voice/talk");
  };

  return (
    <SafeAreaView style={styles.container}>
      {/* 고정 헤더 영역 (index와 동일 규격) */}
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

      {/* 말하는 중 배너 */}
      <View style={styles.stateWrapper}>
        <View style={[styles.stateBox, { width: stateBoxWidth }]}>
          <Text style={[styles.stateText, { fontSize: stateTextSize }]}>
            말하는 중
          </Text>
        </View>
      </View>

      {/* 안내 문구 */}
      <View style={styles.center}>
        <Text
          style={[
            styles.message,
            {
              fontSize: messageFontSize,
              lineHeight: messageFontSize * 1.4,
            },
          ]}
        >
          편하게 말씀해 주세요.{`\n`}
          다마가 잘 듣고 있어요.
        </Text>
      </View>

      {/* 하단 버튼 */}
      <View style={styles.bottom}>
        <TouchableOpacity
          style={[
            styles.micButton,
            {
              width: micButtonSize,
              height: micButtonSize,
              borderRadius: micButtonSize / 2,
            },
          ]}
          onPress={handleStopSpeaking}
          activeOpacity={0.7}
        >
          <Ionicons name="mic-off" size={micButtonSize * 0.5} color="#fff" />
        </TouchableOpacity>
        <Text
          style={[styles.subText, { fontSize: width * 0.04, marginTop: 10 }]}
        >
          말씀을 마치려면 눌러주세요
        </Text>
      </View>
    </SafeAreaView>
  );
}

const MAIN_COLOR = "#BF6A2A";

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#FFF",
    paddingHorizontal: "8%",
  },
  headerRow: {
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
  stateWrapper: {
    marginTop: "10%",
    alignItems: "center",
  },
  stateBox: {
    paddingVertical: 20,
    borderRadius: 25,
    backgroundColor: "#F5F5F5",
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#E0E0E0",
  },
  stateText: {
    fontWeight: "800",
    color: "#BF6A2A",
  },
  center: {
    flex: 1,
    justifyContent: "center",
  },
  message: {
    fontWeight: "600",
    color: "#111",
    textAlign: "center",
  },
  bottom: {
    alignItems: "center",
    marginBottom: "12%",
  },
  micButton: {
    backgroundColor: MAIN_COLOR,
    alignItems: "center",
    justifyContent: "center",
    elevation: 8,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 5,
  },
  subText: {
    color: "#888",
    fontWeight: "500",
  },
});
