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
  useWindowDimensions,
  View,
} from "react-native";

export default function VoiceTalkScreen() {
  const router = useRouter();
  const { width } = useWindowDimensions();

  // 공통 헤더 규격 (index, speak와 100% 동일하게 맞춤)
  const headerFontSize = width * 0.05;
  const headerIconSize = width * 0.08;

  // 본문 반응형 수치
  const stateBoxWidth = width * 0.8;
  const stateTextSize = width * 0.07;
  const questionTextSize = width * 0.09;
  const micButtonSize = width * 0.28;

  const [mode, setMode] = useState<"listening" | "speaking">("listening");
  const questionText = "오늘 점심\n잘 챙겨\n드셨어요?\n뭐 드셨어요?";
  const speakingText = "편하게 말씀해 주세요.\n다마가 잘 듣고 있어요.";

  const isListening = mode === "listening";
  const micAnim = useRef(new Animated.Value(1)).current;
  const micLoopRef = useRef<Animated.CompositeAnimation | null>(null);

  const handleMicPress = () => {
    setMode((prev) => (prev === "listening" ? "speaking" : "listening"));
  };

  useEffect(() => {
    if (!isListening) {
      const loop = Animated.loop(
        Animated.sequence([
          Animated.timing(micAnim, {
            toValue: 1.2,
            duration: 800,
            useNativeDriver: true,
            easing: Easing.out(Easing.ease),
          }),
          Animated.timing(micAnim, {
            toValue: 1,
            duration: 800,
            useNativeDriver: true,
            easing: Easing.in(Easing.ease),
          }),
        ]),
      );
      micLoopRef.current = loop;
      loop.start();
    } else {
      micLoopRef.current?.stop();
      micAnim.setValue(1);
    }
    return () => micLoopRef.current?.stop();
  }, [isListening, micAnim]);

  return (
    <SafeAreaView style={styles.container}>
      {/* 고정 헤더 영역 (index, speak와 동일 규격) */}
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

      {/* 상태 박스 */}
      <View style={styles.stateWrapper}>
        <View
          style={[
            styles.stateBox,
            {
              width: stateBoxWidth,
              backgroundColor: isListening ? "#EDEDED" : "#CDB66D",
              borderColor: isListening ? "#DDD" : "#B5A15A",
            },
          ]}
        >
          <Text
            style={[
              styles.stateText,
              { fontSize: stateTextSize, color: isListening ? "#333" : "#FFF" },
            ]}
          >
            {isListening ? "듣는중" : "말씀 중이에요"}
          </Text>
        </View>
      </View>

      {/* 대화 텍스트 */}
      <View style={styles.questionWrapper}>
        {(isListening ? questionText : speakingText)
          .split("\n")
          .map((line, idx) => (
            <Text
              key={idx}
              style={[
                styles.questionText,
                {
                  fontSize: questionTextSize,
                  lineHeight: questionTextSize * 1.4,
                  color: isListening ? "#111" : "#BF6A2A",
                },
              ]}
            >
              {line}
            </Text>
          ))}
      </View>

      {/* 마이크 버튼 */}
      <View style={styles.micWrapper}>
        <Animated.View style={{ transform: [{ scale: micAnim }] }}>
          <TouchableOpacity
            style={[
              styles.micButton,
              {
                width: micButtonSize,
                height: micButtonSize,
                borderRadius: micButtonSize / 2,
              },
            ]}
            onPress={handleMicPress}
            activeOpacity={0.8}
          >
            <Ionicons
              name={isListening ? "mic" : "mic-outline"}
              size={micButtonSize * 0.5}
              color="#fff"
            />
          </TouchableOpacity>
        </Animated.View>
        <Text
          style={[styles.micHint, { fontSize: width * 0.045, marginTop: 15 }]}
        >
          {isListening
            ? "마이크를 눌러 대화를 시작하기"
            : "말씀을 다 하시면 마이크를 누르세요"}
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
    paddingVertical: 18,
    borderRadius: 25,
    alignItems: "center",
    borderWidth: 1.5,
  },
  stateText: {
    fontWeight: "800",
  },
  questionWrapper: {
    flex: 1,
    justifyContent: "center",
    paddingHorizontal: 10,
  },
  questionText: {
    fontWeight: "700",
    textAlign: "left",
  },
  micWrapper: {
    alignItems: "center",
    marginBottom: "15%",
  },
  micButton: {
    backgroundColor: MAIN_COLOR,
    alignItems: "center",
    justifyContent: "center",
    elevation: 10,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 5 },
    shadowOpacity: 0.3,
    shadowRadius: 6,
  },
  micHint: {
    color: "#666",
    fontWeight: "500",
    textAlign: "center",
  },
});
