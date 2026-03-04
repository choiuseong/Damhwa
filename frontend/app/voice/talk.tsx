// app/voice/talk.tsx
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { useEffect, useRef, useState } from "react";
import {
  Animated,
  Easing,
  SafeAreaView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";

export default function VoiceTalkScreen() {
  const router = useRouter();

  // listening = 듣는중(질문 읽어주는 중)
  // speaking = 사용자가 말하는 상황
  const [mode, setMode] = useState<"listening" | "speaking">("listening");

  const questionText = "오늘 점심\n잘 챙겨\n드셨어요?\n뭐 드셨어요?";
  const speakingText = "편하게 말씀해 주세요.\n다마가 잘 듣고 있어요.";

  const isListening = mode === "listening";

  const micAnim = useRef(new Animated.Value(1)).current;

  const micLoopRef = useRef<Animated.CompositeAnimation | null>(null);

  const handleMicPress = () => {
    setMode((prev) => (prev === "listening" ? "speaking" : "listening"));
  };

  // 🎯 "말씀 중"일 때만 마이크 애니메이션 시작
  useEffect(() => {
    if (!isListening) {
      // speaking 상태 → 루프 생성 + 시작
      const loop = Animated.loop(
        Animated.sequence([
          Animated.timing(micAnim, {
            toValue: 1.15,
            duration: 700,
            useNativeDriver: true,
            easing: Easing.out(Easing.ease),
          }),
          Animated.timing(micAnim, {
            toValue: 1,
            duration: 700,
            useNativeDriver: true,
            easing: Easing.in(Easing.ease),
          }),
        ])
      );

      micLoopRef.current = loop;
      loop.start();
    } else {
      // listening 상태 → 애니메이션 정지 + 값 리셋
      micLoopRef.current?.stop();
      micAnim.stopAnimation();
      micAnim.setValue(1);
    }

    // 언마운트 or 의존성 변경 시 cleanup
    return () => {
      micLoopRef.current?.stop();
    };
  }, [isListening, micAnim]);

  return (
    <SafeAreaView style={styles.container}>
      {/* 상단 헤더 */}
      <View style={styles.headerRow}>
        <Text style={styles.headerTitle}>음성대화</Text>
        <TouchableOpacity onPress={() => router.replace("/(tabs)")}>
          <Ionicons name="home-outline" size={28} color="#222" />
        </TouchableOpacity>
      </View>

      {/* 상태 박스 */}
      <View style={styles.stateWrapper}>
        <View
          style={[
            styles.stateBox,
            {
              backgroundColor: isListening ? "#EDEDED" : "#CDB66D",
            },
          ]}
        >
          <Text style={styles.stateText}>
            {isListening ? "듣는중" : "말씀 중이에요"}
          </Text>
        </View>
      </View>

      {/* 텍스트 */}
      <View style={styles.questionWrapper}>
        {(isListening ? questionText : speakingText)
          .split("\n")
          .map((line, idx) => (
            <Text key={idx} style={styles.questionText}>
              {line}
            </Text>
          ))}
      </View>

      {/* 마이크 버튼 */}
      <View style={styles.micWrapper}>
        <Animated.View style={{ transform: [{ scale: micAnim }] }}>
          <TouchableOpacity
            style={styles.micButton}
            onPress={handleMicPress}
            activeOpacity={0.8}
          >
            <Ionicons
              name={isListening ? "mic" : "mic-outline"}
              size={45}
              color="#fff"
            />
          </TouchableOpacity>
        </Animated.View>
      </View>
    </SafeAreaView>
  );
}

const MAIN_COLOR = "#BF6A2A";

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#FFF",
    paddingHorizontal: 32,
    paddingTop: 24,
  },
  headerRow: {
    marginTop: 4,
    paddingHorizontal: 4,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
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
    fontSize: 24,
    color: "#333",
  },
  questionWrapper: {
    flex: 1,
    justifyContent: "center",
    paddingHorizontal: 8,
  },
  questionText: {
    fontSize: 32,
    lineHeight: 42,
    fontWeight: "500",
    color: "#111",
    textAlign: "left",
  },
  micWrapper: {
    alignItems: "center",
    marginBottom: 56,
  },
  micButton: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: MAIN_COLOR,
    alignItems: "center",
    justifyContent: "center",
  },
});
