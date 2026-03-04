import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { StyleSheet, Text, TouchableOpacity, View } from "react-native";

export default function Home() {
  const router = useRouter();

  const goVoiceScreen = () => {
    router.push("/voice"); // app/voice/index.tsx 로 이동
  };

  const goRecordScreen = () => {
    router.push("/(tabs)/record");
  };

  const goScheduleScreen = () => {
    router.push("/(tabs)/schedule");
  };

  return (
    <View style={styles.container}>
      {/* 상단 헤더 */}
      <Text style={styles.header}>피드</Text>

      {/* 구분선 */}
      <View style={styles.divider} />

      {/* 오늘의 이야기를 들려주세요 */}
      <View style={styles.talkRow}>
        <Ionicons
          name="chatbubble-ellipses-outline"
          size={20}
          color="#C07F5C"
        />
        <Text style={styles.talkText}>오늘의 이야기를 들려주세요!</Text>
      </View>

      {/* 큰 버튼 - 음성대화 */}
      <TouchableOpacity style={styles.bigButton} onPress={goVoiceScreen}>
        <Text style={styles.bigButtonText}>음성대화</Text>
      </TouchableOpacity>

      {/* 기록, 일정 버튼 */}
      <TouchableOpacity
        style={styles.smallButton}
        onPress={() => router.push("/record")}
      >
        <Text style={styles.smallButtonText}>기록</Text>
      </TouchableOpacity>

        <TouchableOpacity style={styles.smallButton} onPress={goScheduleScreen}>
          <Text style={styles.smallButtonText}>일정</Text>
        </TouchableOpacity>
      </View>

      {/* 알림 박스 */}
      <View style={styles.alertBox}>
        <Ionicons name="notifications-outline" size={20} color="#B36A3C" />
        <Text style={styles.alertText}>1개의 알림이 있어요.</Text>
      </View>

      {/* 추천 박스 */}
      <View style={styles.recommendBox}>
        <Text style={styles.recommendTitle}>순희님을 위한 추천</Text>
        <Text style={styles.recommendDesc}>
          전어회를 좋아하는 황순희님!{"\n"}지금이 철이네요~
        </Text>
        <Text style={styles.more}>더보기</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#fff",
    paddingHorizontal: 24,
    paddingTop: 60,
  },
  header: {
    fontSize: 26,
    fontWeight: "700",
  },
  divider: {
    height: 1,
    backgroundColor: "#E2E2E2",
    marginVertical: 20,
  },
  talkRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 18,
  },
  talkText: {
    marginLeft: 6,
    fontSize: 16,
    color: "#C07F5C",
    fontWeight: "600",
  },
  bigButton: {
    paddingVertical: 26,
    borderRadius: 20,
    alignItems: "center",
    backgroundColor: "#B36A3C",
    marginBottom: 16,
  },
  bigButtonText: {
    color: "#fff",
    fontSize: 24,
    fontWeight: "700",
  },
  rowButtons: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 18,
  },
  smallButton: {
    flex: 1,
    paddingVertical: 22,
    borderRadius: 20,
    alignItems: "center",
    backgroundColor: "#B36A3C",
    marginHorizontal: 4,
  },
  smallButtonText: {
    color: "#fff",
    fontSize: 20,
    fontWeight: "700",
  },
  alertBox: {
    flexDirection: "row",
    backgroundColor: "#FFEFD7",
    padding: 15,
    borderRadius: 16,
    alignItems: "center",
    marginBottom: 26,
  },
  alertText: {
    marginLeft: 10,
    fontSize: 15,
    color: "#B36A3C",
    fontWeight: "600",
  },
  recommendBox: {
    backgroundColor: "#FAFAFA",
    padding: 16,
    borderRadius: 16,
  },
  recommendTitle: {
    fontSize: 16,
    fontWeight: "700",
    color: "#7DA05B",
    marginBottom: 4,
  },
  recommendDesc: {
    fontSize: 14,
    color: "#666",
    marginBottom: 6,
    lineHeight: 20,
  },
  more: {
    textAlign: "right",
    color: "#B39E7A",
    fontSize: 12,
  },
});
