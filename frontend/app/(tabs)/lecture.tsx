import { Ionicons } from "@expo/vector-icons";
import React from "react";
import {
  Image,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  useWindowDimensions,
  View,
} from "react-native";

export default function LectureScreen() {
  const { width } = useWindowDimensions();

  // 임시 데이터
  const categories = ["뜨개질", "요리", "컴퓨터", "노래"];
  const lectures = [
    {
      id: 1,
      title: "초보 니터를 위한 뜨개질 영상",
      view: "1.1만회",
      date: "1년 전",
      channel: "made by 525",
      desc: "추천해준 곳이 아니어도 여러가지 추천해주고 싶으신 쇼게 좋은 지식들...",
      thumb: "https://via.placeholder.com/150", // 실제 이미지 경로로 대체 가능
    },
    {
      id: 2,
      title: "대바늘 기초 배우기 💛 코만들기 | 겉뜨기",
      view: "7만회",
      date: "3년 전",
      channel: "오늘은 뜨개질",
      desc: "안녕하세요. 취미로 뜨개질을 하는 오프입니다. 오늘은 대바늘...",
      thumb: "https://via.placeholder.com/150",
    },
  ];

  return (
    <View style={styles.container}>
      {/* 상단 헤더 영역 */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>강의</Text>
        <TouchableOpacity>
          <Ionicons name="home-outline" size={width * 0.08} color="black" />
        </TouchableOpacity>
      </View>

      <ScrollView showsVerticalScrollIndicator={false}>
        {/* 안내 문구 */}
        <View style={styles.welcomeSection}>
          <Text style={styles.welcomeText}>
            오늘은 어떤 영상을 시청하시겠어요?
          </Text>
          <Text style={styles.welcomeText}>카테고리별로 확인해보세요!</Text>
        </View>

        {/* 카테고리 가로 스크롤 */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={styles.categoryScroll}
        >
          {categories.map((cat, idx) => (
            <TouchableOpacity key={idx} style={styles.categoryButton}>
              <Text style={styles.categoryButtonText}>{cat}</Text>
            </TouchableOpacity>
          ))}
        </ScrollView>

        {/* 영상 리스트 */}
        <View style={styles.lectureList}>
          {lectures.map((item) => (
            <TouchableOpacity key={item.id} style={styles.lectureCard}>
              {/* 섬네일 */}
              <View style={styles.thumbWrapper}>
                <Image source={{ uri: item.thumb }} style={styles.thumbnail} />
                <View style={styles.timeTag}>
                  <Text style={styles.timeText}>16:17</Text>
                </View>
              </View>

              {/* 텍스트 정보 */}
              <View style={styles.infoWrapper}>
                <Text style={styles.lectureTitle} numberOfLines={2}>
                  {item.title}
                </Text>
                <Text style={styles.subInfo}>
                  조회수 {item.view} • {item.date}
                </Text>
                <View style={styles.channelRow}>
                  <View style={styles.channelIcon} />
                  <Text style={styles.channelName}>{item.channel}</Text>
                </View>
                <Text style={styles.description} numberOfLines={2}>
                  {item.desc}
                </Text>
              </View>
            </TouchableOpacity>
          ))}
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#fff", paddingTop: 50 },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 20,
    marginBottom: 25,
  },
  headerTitle: { fontSize: 28, fontWeight: "700" },
  welcomeSection: { paddingHorizontal: 20, marginBottom: 20 },
  welcomeText: { fontSize: 20, fontWeight: "600", lineHeight: 28 },

  categoryScroll: { paddingLeft: 20, marginBottom: 25, flexDirection: "row" },
  categoryButton: {
    backgroundColor: "#D1C68E", // 이미지와 비슷한 올리브/베이지 톤
    paddingHorizontal: 25,
    paddingVertical: 12,
    borderRadius: 20,
    marginRight: 10,
  },
  categoryButtonText: { fontSize: 20, fontWeight: "700", color: "#333" },

  lectureList: { paddingHorizontal: 15 },
  lectureCard: {
    flexDirection: "row",
    marginBottom: 20,
    alignItems: "flex-start",
  },
  thumbWrapper: {
    width: 140,
    height: 90,
    borderRadius: 10,
    overflow: "hidden",
    backgroundColor: "#eee",
  },
  thumbnail: { width: "100%", height: "100%" },
  timeTag: {
    position: "absolute",
    bottom: 4,
    right: 4,
    backgroundColor: "rgba(0,0,0,0.7)",
    paddingHorizontal: 4,
    borderRadius: 4,
  },
  timeText: { color: "#fff", fontSize: 10 },

  infoWrapper: { flex: 1, marginLeft: 12 },
  lectureTitle: {
    fontSize: 16,
    fontWeight: "700",
    marginBottom: 2,
    color: "#333",
  },
  subInfo: { fontSize: 12, color: "#888", marginBottom: 4 },
  channelRow: { flexDirection: "row", alignItems: "center", marginBottom: 4 },
  channelIcon: {
    width: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: "#E6E6FA",
    marginRight: 5,
  },
  channelName: { fontSize: 12, color: "#666", fontWeight: "600" },
  description: { fontSize: 11, color: "#999", lineHeight: 16 },
});
