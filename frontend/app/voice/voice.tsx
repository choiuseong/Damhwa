import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { useEffect, useRef, useState } from "react";
import {
  Animated,
  ActivityIndicator,
  Easing,
  SafeAreaView,
  Text,
  TouchableOpacity,
  View,
  StyleSheet,
} from "react-native";
import { Audio } from "expo-av";
import * as FileSystem from 'expo-file-system/legacy';
import io from "socket.io-client";

type VoiceMode = "intro" | "idle" | "listening" | "speaking" | "processing";

export default function VoiceScreen() {
  const router = useRouter();
  const [mode, setMode] = useState<VoiceMode>("intro");
  const [responseText, setResponseText] = useState("");
  const [recording, setRecording] = useState<Audio.Recording | null>(null);

  const micAnim = useRef(new Animated.Value(1)).current;
  const soundRef = useRef<Audio.Sound | null>(null);
  const socketRef = useRef<any>(null);

  const SERVER_URL = process.env.EXPO_PUBLIC_SERVER_URL!;

  // 듣는중 애니메이션
  useEffect(() => {
    if (mode === "listening") {
      const loop = Animated.loop(
        Animated.sequence([
          Animated.timing(micAnim, { toValue: 1.15, duration: 700, useNativeDriver: true, easing: Easing.out(Easing.ease) }),
          Animated.timing(micAnim, { toValue: 1, duration: 700, useNativeDriver: true, easing: Easing.in(Easing.ease) }),
        ])
      );
      loop.start();
      return () => loop.stop();
    }
  }, [mode]);

  // 웹소켓 연결
  useEffect(() => {
    socketRef.current = io(SERVER_URL);

    socketRef.current.on("connect", () => console.log("웹소켓 연결됨"));

    interface SpeechStatus { status: VoiceMode; }
    interface SpeechText { text: string; }
    interface SpeechReply { reply: string; }
    interface SpeechTts { ttsBase64: string; }

    socketRef.current.on("speech:status", (data: SpeechStatus) => setMode(data.status));
    socketRef.current.on("speech:text", (data: SpeechText) => setResponseText(data.text));
    socketRef.current.on("speech:reply", (data: SpeechReply) => setResponseText(data.reply));
    socketRef.current.on("speech:tts", async (data: SpeechTts) => {
      setMode("speaking");
      const { sound } = await Audio.Sound.createAsync({
        uri: `data:audio/mpeg;base64,${data.ttsBase64}`,
      });
      soundRef.current = sound;
      await sound.playAsync();
      sound.setOnPlaybackStatusUpdate((status) => {
        if (status.isLoaded && status.didJustFinish) {
          soundRef.current?.unloadAsync();
          setMode("idle");
        }
      });
    });

    return () => socketRef.current.disconnect();
  }, []);

  // 녹음 시작
  const startRecording = async () => {
    const permission = await Audio.requestPermissionsAsync();
    if (!permission.granted) return alert("마이크 권한 필요");

    await Audio.setAudioModeAsync({ allowsRecordingIOS: true, playsInSilentModeIOS: true });
    const { recording } = await Audio.Recording.createAsync(Audio.RecordingOptionsPresets.HIGH_QUALITY);

    setRecording(recording);
    setMode("listening");
  };

  // 녹음 종료 → 서버 전송 (legacy FileSystem)
  const stopRecording = async () => {
    if (!recording) return;
    setMode("processing");

    await recording.stopAndUnloadAsync();
    const uri = recording.getURI();
    setRecording(null);

    if (!uri) return alert("녹음 파일이 존재하지 않습니다.");

    try {
      const audioBase64 = await FileSystem.readAsStringAsync(uri, { encoding: FileSystem.EncodingType.Base64 });

      socketRef.current.emit("speech:send", {
        userId: "1",
        audioBase64,
      });
    } catch (err) {
      console.error("파일 처리 중 오류:", err);
      alert("녹음 파일을 읽는 중 오류가 발생했습니다.");
      setMode("idle");
    }
  };

  const handleMicPress = () => {
    if (mode === "idle") startRecording();
    else if (mode === "listening") stopRecording();
    else if (mode === "speaking") {
      if (soundRef.current) {
        soundRef.current.stopAsync();
        soundRef.current.unloadAsync();
        soundRef.current = null;
        setMode("idle");
      }
    }
  };

  const renderContent = () => {
    if (mode === "intro") return (
      <View style={styles.center}>
        <Text style={styles.message}>
          안녕하세요.{"\n"}당신의 하루를{"\n"}다마와 함께{"\n"}나누어보세요.
        </Text>
      </View>
    );

    return (
      <View style={{ flex: 1 }}>
        <View style={styles.stateWrapper}>
          <View style={[styles.stateBox,
            mode === "idle" && { backgroundColor: "#f5f5f5" },
            mode === "listening" && { backgroundColor: "#EDEDED" },
            mode === "processing" && { backgroundColor: "#A8D08D" },
            mode === "speaking" && { backgroundColor: "#D6C27A" },
          ]}>
            <Text style={styles.stateText}>
              {mode === "idle" && "대기중"}
              {mode === "listening" && "듣는중"}
              {mode === "processing" && "정리중"}
              {mode === "speaking" && "말하는중"}
            </Text>
          </View>
        </View>

        <View style={styles.centerContent}>
          {mode === "processing" ? (
            <ActivityIndicator size="large" color="#000" style={{ transform: [{ scale: 1.5 }] }} />
          ) : mode === "speaking" ? (
            <Ionicons name="volume-high" size={60} color="#333" />
          ) : (
            <Text style={styles.questionText}>
              {responseText || "마이크를 눌러 대화를 시작하세요."}
            </Text>
          )}
        </View>

        <View style={styles.micWrapper}>
          <Animated.View style={{ transform: [{ scale: micAnim }] }}>
            <TouchableOpacity style={styles.micButton} onPress={handleMicPress}>
              <Ionicons name="mic" size={45} color="#fff" />
            </TouchableOpacity>
          </Animated.View>
        </View>
      </View>
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
          <TouchableOpacity style={styles.button} onPress={() => setMode("idle")}>
            <Text style={styles.buttonText}>시작하기</Text>
          </TouchableOpacity>
        </View>
      )}
    </SafeAreaView>
  );
}

const MAIN_COLOR = "#BF6A2A";
const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#FFF", paddingHorizontal: 32, paddingTop: 24 },
  headerRow: { flexDirection: "row", justifyContent: "space-between", marginBottom: 20 },
  headerTitle: { fontSize: 18, color: "#555" },
  center: { flex: 1, justifyContent: "center", alignItems: "center" },
  message: { fontSize: 36, lineHeight: 50, fontWeight: "700" },
  bottom: { alignItems: "center", marginBottom: 60 },
  button: { paddingHorizontal: 40, paddingVertical: 16, borderRadius: 20, backgroundColor: MAIN_COLOR },
  buttonText: { color: "#FFF", fontSize: 18 },
  stateWrapper: { alignItems: "center", marginTop: 20 },
  stateBox: { width: 220, paddingVertical: 26, borderRadius: 24, justifyContent: "center", alignItems: "center" },
  stateText: { fontSize: 30, fontWeight: "600", textAlign: "center" },
  centerContent: { flex: 1, justifyContent: "center", alignItems: "center", paddingBottom: 160 },
  questionText: { fontSize: 30, lineHeight: 40, textAlign: "center" },
  micWrapper: { position: "absolute", bottom: 40, left: 0, right: 0, alignItems: "center" },
  micButton: { width: 100, height: 100, borderRadius: 50, backgroundColor: MAIN_COLOR, alignItems: "center", justifyContent: "center" },
});