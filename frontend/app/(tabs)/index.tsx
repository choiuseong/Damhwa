import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import {
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  useWindowDimensions,
} from "react-native";

export default function Home() {
  const router = useRouter();
  const { width } = useWindowDimensions();

  // 폰 기종 반응형 수치 계산 (어르신 맞춤형)
  const headerFontSize = width * 0.08; // '피드' 타이틀 (약 32px)
  const subTextSize = width * 0.05; // '오늘의 이야기...' (약 20px)
  const bigButtonFontSize = width * 0.1; // '음성대화' (약 32px)
  const smallButtonFontSize = width * 0.06; // '기록/일정' (약 24px)

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.contentContainer}
    >
      {/* 상단 헤더 */}
      <View style={styles.headerWrapper}>
        <Text style={[styles.header, { fontSize: headerFontSize }]}>피드</Text>
      </View>

      {/* 구분선 */}
      <View style={styles.divider} />

      {/* 오늘의 이야기를 들려주세요 */}
      <View style={styles.talkRow}>
        <Ionicons
          name="chatbubble-ellipses-outline"
          size={width * 0.06}
          color="#C07F5C"
        />
        <Text style={[styles.talkText, { fontSize: subTextSize }]}>
          오늘의 이야기를 들려주세요!
        </Text>
      </View>

      {/* 큰 버튼 - 음성대화 */}
      <TouchableOpacity
        style={[styles.bigButton, { paddingVertical: width * 0.12 }]}
        onPress={() => router.push("/voice")}
        activeOpacity={0.8}
      >
        <Text style={[styles.bigButtonText, { fontSize: bigButtonFontSize }]}>
          음성대화
        </Text>
      </TouchableOpacity>

      {/* 기록, 일정 버튼 */}
      <View style={styles.rowButtons}>
        <TouchableOpacity
          style={styles.smallButton}
          onPress={() => router.push("/(tabs)/record")}
        >
          <Text
            style={[styles.smallButtonText, { fontSize: smallButtonFontSize }]}
          >
            기록
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.smallButton}
          onPress={() => router.push("/(tabs)/schedule")}
        >
          <Text
            style={[styles.smallButtonText, { fontSize: smallButtonFontSize }]}
          >
            일정
          </Text>
        </TouchableOpacity>
      </View>

      {/* 알림 박스 */}
      <View style={styles.alertBox}>
        <Ionicons
          name="notifications-outline"
          size={width * 0.06}
          color="#B36A3C"
        />
        <Text style={[styles.alertText, { fontSize: width * 0.045 }]}>
          1개의 알림이 있어요.
        </Text>
      </View>

      {/* 순희님을 위한 추천 (광고 전 정보 제공 섹션) */}
      <View style={styles.recommendBox}>
        <Text style={[styles.recommendTitle, { fontSize: width * 0.05 }]}>
          순희님을 위한 추천
        </Text>
        <Text style={[styles.recommendDesc, { fontSize: width * 0.045 }]}>
          전어회를 좋아하는 황순희님!{"\n"}지금이 철이네요~
        </Text>
        <TouchableOpacity>
          <Text style={styles.more}>더보기</Text>
        </TouchableOpacity>
      </View>

      {/* 하단 광고/정보제공형 배너 공간 (이미지처럼 배치될 곳) */}
      <View style={styles.adSpace}>
        <View style={styles.adPlaceholder}>
          <Text style={styles.adPlaceholderText}>
            광고 및 정보제공 배너 영역
          </Text>
        </View>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#fff",
  },
  contentContainer: {
    paddingHorizontal: "6%",
    paddingTop: 60,
    paddingBottom: 40, // 하단 여백
  },
  headerWrapper: {
    marginBottom: 10,
  },
  header: {
    fontWeight: "800",
    color: "#000",
  },
  divider: {
    height: 1.5,
    backgroundColor: "#F0F0F0",
    marginBottom: 24,
  },
  talkRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 16,
  },
  talkText: {
    marginLeft: 8,
    color: "#C07F5C",
    fontWeight: "700",
  },
  bigButton: {
    width: "100%", //
    borderRadius: 28, //
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#B36A3C",
    marginBottom: 16,
  },
  bigButtonText: {
    color: "#fff",
    fontWeight: "900",
  },
  rowButtons: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 20,
  },
  smallButton: {
    flex: 1,
    paddingVertical: 26,
    borderRadius: 24,
    alignItems: "center",
    backgroundColor: "#B36A3C",
    marginHorizontal: 6,
    elevation: 3,
  },
  smallButtonText: {
    color: "#fff",
    fontWeight: "800",
  },
  alertBox: {
    flexDirection: "row",
    backgroundColor: "#FFEFD7",
    padding: 18,
    borderRadius: 20,
    alignItems: "center",
    marginBottom: 20,
  },
  alertText: {
    marginLeft: 12,
    color: "#B36A3C",
    fontWeight: "700",
  },
  recommendBox: {
    backgroundColor: "#F9F9F9",
    padding: 20,
    borderRadius: 20,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: "#F0F0F0",
  },
  recommendTitle: {
    fontWeight: "800",
    color: "#7DA05B",
    marginBottom: 8,
  },
  recommendDesc: {
    color: "#444",
    marginBottom: 10,
    lineHeight: 26, // 줄간격 조절
    fontWeight: "500",
  },
  more: {
    textAlign: "right",
    color: "#B39E7A",
    fontSize: 14,
    fontWeight: "600",
  },
  // 광고 영역 스타일
  adSpace: {
    marginTop: 10,
    width: "100%",
  },
  adPlaceholder: {
    backgroundColor: "#EEE",
    height: 180, // 광고가 들어갈 높이 확보
    borderRadius: 20,
    justifyContent: "center",
    alignItems: "center",
    borderStyle: "dashed",
    borderWidth: 1,
    borderColor: "#CCC",
  },
  adPlaceholderText: {
    color: "#999",
    fontSize: 16,
  },
});
