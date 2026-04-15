// app/(tabs)/community/index.tsx
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import {
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  useWindowDimensions,
  View,
} from "react-native";

export default function CommunityScreen() {
  const router = useRouter();
  const { width } = useWindowDimensions();

  const chatRooms = [
    {
      id: 1,
      title: "오늘 아침 신문 이야기",
      time: "매일 오전 11:30",
      thumb: "☕",
    },
    {
      id: 2,
      title: "우리가 좋아하는 가요 무대",
      time: "매일 오후 02:00",
      thumb: "🐶",
    },
    {
      id: 3,
      title: "7080 노래 같이 들어요",
      time: "매일 오후 07:00",
      thumb: "📀",
    },
  ];

  return (
    <View style={styles.container}>
      {/* 상단 헤더 */}
      <View style={styles.header}>
        <Text style={styles.title}>오픈 채팅방</Text>
        <TouchableOpacity>
          <Ionicons name="search" size={width * 0.08} color="#fff" />
        </TouchableOpacity>
      </View>

      <ScrollView
        contentContainerStyle={styles.list}
        showsVerticalScrollIndicator={false}
      >
        {chatRooms.map((room) => (
          <TouchableOpacity
            key={room.id}
            style={styles.card}
            // 🎯 2번 화면(info.tsx)으로 이동하면서 대화방 이름을 넘깁니다.
            onPress={() =>
              router.push({
                pathname: "/(tabs)/community/info",
                params: { title: room.title },
              })
            }
          >
            {/* 시안의 섬네일 영역 */}
            <View style={styles.thumbArea}>
              <Text style={styles.thumbEmoji}>{room.thumb}</Text>
            </View>

            {/* 정보 영역 */}
            <View style={styles.infoArea}>
              <Text style={styles.roomTag}>강좌</Text>
              <Text style={styles.roomTitle} numberOfLines={2}>
                {room.title}
              </Text>
              <Text style={styles.roomTime}>{room.time} / 정원</Text>

              {/* 참여하기 버튼 */}
              <TouchableOpacity style={styles.joinButton}>
                <Text style={styles.joinButtonText}>참여하기</Text>
              </TouchableOpacity>
            </View>
          </TouchableOpacity>
        ))}
      </ScrollView>

      {/* 하단 채팅방 만들기 버튼 */}
      <TouchableOpacity style={styles.makeButton}>
        <Ionicons name="add-circle" size={30} color="#111" />
        <Text style={styles.makeButtonText}>채팅방 만들기</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#111",
    paddingTop: 60,
    paddingBottom: 20,
  }, // 다크 모드
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 20,
    marginBottom: 20,
  },
  title: { fontSize: 28, fontWeight: "800", color: "#fff" },
  list: { paddingHorizontal: 15, paddingBottom: 100 },
  card: {
    backgroundColor: "#1A1A1A",
    borderRadius: 20,
    overflow: "hidden",
    marginBottom: 20,
  }, // 카드도 살짝 어둡게
  thumbArea: {
    height: 160,
    backgroundColor: "#FFEBCD",
    justifyContent: "center",
    alignItems: "center",
  }, // 시안의 황토색 배경
  thumbEmoji: { fontSize: 60 },
  infoArea: { padding: 16 },
  roomTag: { color: "#AAA", fontSize: 14, marginBottom: 4 },
  roomTitle: {
    color: "#fff",
    fontSize: 22,
    fontWeight: "700",
    marginBottom: 4,
    lineHeight: 28,
  },
  roomTime: { color: "#888", fontSize: 16, marginBottom: 12 },
  joinButton: {
    backgroundColor: "#20E09F",
    alignSelf: "flex-start",
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 10,
  }, // 강조색
  joinButtonText: { color: "#111", fontWeight: "800", fontSize: 16 },
  makeButton: {
    position: "absolute",
    bottom: 20,
    right: 20,
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#20E09F",
    padding: 15,
    borderRadius: 30,
    elevation: 5,
  },
  makeButtonText: {
    color: "#111",
    fontWeight: "800",
    fontSize: 18,
    marginLeft: 8,
  },
});
