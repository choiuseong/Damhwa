import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { useEffect, useRef, useState } from "react";
import {
  Animated,
  Easing,
  SafeAreaView,
  Text,
  TouchableOpacity,
  View,
  StyleSheet,
} from "react-native";
import { Audio } from "expo-av";

type VoiceMode =
  | "intro"
  | "idle"
  | "listening"
  | "speaking"
  | "processing";

export default function VoiceScreen() {
  const router = useRouter();

  const [mode, setMode] = useState<VoiceMode>("intro");
  const [responseText, setResponseText] = useState("");
  const [recording, setRecording] = useState<Audio.Recording | null>(null);

  const micAnim = useRef(new Animated.Value(1)).current;
  const soundRef = useRef<Audio.Sound | null>(null);

  const SERVER_URL = process.env.EXPO_PUBLIC_SERVER_URL!;

  // 🎤 듣는중일 때만 애니메이션
  useEffect(() => {
    if (mode === "listening") {
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
      loop.start();
      return () => loop.stop();
    }
  }, [mode]);

  // 🎙 녹음 시작
  const startRecording = async () => {
    try {
      const permission = await Audio.requestPermissionsAsync();
      if (!permission.granted) {
        alert("마이크 권한 필요");
        return;
      }

      await Audio.setAudioModeAsync({
        allowsRecordingIOS: true,
        playsInSilentModeIOS: true,
      });

      const { recording } = await Audio.Recording.createAsync(
        Audio.RecordingOptionsPresets.HIGH_QUALITY
      );

      setRecording(recording);
      setMode("listening");
    } catch (err) {
      console.error(err);
    }
  };

  // 🎙 녹음 종료 + 서버 전송
  const stopRecording = async () => {
    try {
      if (!recording) return;

      setMode("processing");

      await recording.stopAndUnloadAsync();
      const uri = recording.getURI();
      
      setRecording(null);

      const formData = new FormData();
      formData.append("audio", {
        uri,
        name: "voice.m4a",
        type: "audio/m4a",
      } as any);

      formData.append("userId", "1");

      const res = await fetch(`${SERVER_URL}/api/speech/stt`, {
        method: "POST",
        body: formData,
      });

      const data = await res.json();

      if (data.reply) {
        setResponseText(data.reply);
      }

      // 🔊 TTS
      if (data.ttsUrl) {
        setMode("speaking");

        const { sound } = await Audio.Sound.createAsync({
          uri: data.ttsUrl,
        });

        soundRef.current = sound;
        await sound.playAsync();

        sound.setOnPlaybackStatusUpdate((status) => {
          if (status.isLoaded && status.didJustFinish) {
            soundRef.current?.unloadAsync();
            setMode("idle");
          }
        });
      } else {
        setMode("idle");
      }
    } catch (err) {
      console.error(err);
      setMode("idle");
    }
  };

  // 🎤 버튼
  const handleMicPress = () => {
    if (mode === "idle") startRecording();
    else if (mode === "listening") stopRecording();
  };

  const questionText =
    "오늘 점심\n잘 챙겨\n드셨어요?\n뭐 드셨어요?";

  const renderContent = () => {
    if (mode === "intro") {
      return (
        <View style={styles.center}>
          <Text style={styles.message}>
            안녕하세요.{"\n"}
            당신의 하루를{"\n"}
            다마와 함께{"\n"}
            나누어보세요.
          </Text>
        </View>
      );
    }

    return (
      <>
        {/* ✅ 상태 (항상 위 고정, 크기 동일) */}
        <View style={styles.stateWrapper}>
          <View
            style={[
              styles.stateBox,
              mode === "idle" && { backgroundColor: "#f5f5f5" },      
              mode === "listening" && { backgroundColor: "#EDEDED" },  
              mode === "processing" && { backgroundColor: "#A8D08D" },
              mode === "speaking" && { backgroundColor: "#D6C27A" },
            ]}
          >
            <Text style={styles.stateText}>
              {mode === "idle" && "대기중"}
              {mode === "listening" && "듣는중"}
              {mode === "processing" && "정리중"}
              {mode === "speaking" && "말하는중"}
            </Text>
          </View>
        </View>

        {/* ✅ 중앙 UI */}
        {mode === "processing" ? (
          <View style={styles.center}>
            <Text style={styles.processingText}>
              잠시만 기다려주세요
            </Text>
          </View>
        ) : mode === "speaking" ? (
          <View style={styles.center}>
            <Ionicons name="volume-high" size={60} color="#333" />
          </View>
        ) : (
          <>
            <View style={styles.questionWrapper}>
              {questionText.split("\n").map((line, i) => (
                <Text key={i} style={styles.questionText}>
                  {line}
                </Text>
              ))}
            </View>

            {responseText ? (
              <View style={styles.answerBox}>
                <Text style={styles.answerText}>
                  {responseText}
                </Text>
              </View>
            ) : null}

            <View style={styles.micWrapper}>
              <Animated.View style={{ transform: [{ scale: micAnim }] }}>
                <TouchableOpacity
                  style={styles.micButton}
                  onPress={handleMicPress}
                >
                  <Ionicons name="mic" size={45} color="#fff" />
                </TouchableOpacity>
              </Animated.View>
            </View>
          </>
        )}
      </>
    );
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.headerRow}>
        <Text style={styles.headerTitle}>음성대화</Text>

        <TouchableOpacity onPress={() => router.replace("/(tabs)")}>
          <Ionicons name="home-outline" size={28} color="#222" />
        </TouchableOpacity>
      </View>

      {renderContent()}

      {mode === "intro" && (
        <View style={styles.bottom}>
          <TouchableOpacity
            style={styles.button}
            onPress={() => setMode("idle")}
          >
            <Text style={styles.buttonText}>시작하기</Text>
          </TouchableOpacity>
        </View>
      )}
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
    flexDirection: "row",
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
    fontSize: 36,
    lineHeight: 50,
    fontWeight: "700",
  },
  bottom: {
    alignItems: "center",
    marginBottom: 60,
  },
  button: {
    paddingHorizontal: 40,
    paddingVertical: 16,
    borderRadius: 20,
    backgroundColor: MAIN_COLOR,
  },
  buttonText: {
    color: "#FFF",
    fontSize: 18,
  },
  stateWrapper: {
    alignItems: "center",
    marginTop: 20,
  },
  stateBox: {
    paddingHorizontal: 90,
    paddingVertical: 26,
    borderRadius: 24,
    backgroundColor: "#EDEDED",
  },
  stateText: {
    fontSize: 30,
    fontWeight: "600",
  },
  questionWrapper: {
    flex: 1,
    justifyContent: "center",
  },
  questionText: {
    fontSize: 30,
    lineHeight: 40,
  },
  answerBox: {
    padding: 20,
    backgroundColor: "#F4F4F4",
    borderRadius: 12,
    marginBottom: 20,
  },
  answerText: {
    fontSize: 22,
  },
  micWrapper: {
    alignItems: "center",
    marginBottom: 50,
  },
  micButton: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: MAIN_COLOR,
    alignItems: "center",
    justifyContent: "center",
  },
  processingText: {
    fontSize: 22,
    marginTop: 20,
  },
});