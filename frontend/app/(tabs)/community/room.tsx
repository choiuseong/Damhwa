// app/(tabs)/community/room.tsx
import {
  FontAwesome5,
  Ionicons,
  MaterialCommunityIcons,
} from "@expo/vector-icons";
import { useRouter } from "expo-router";
import React from "react";
import {
  FlatList,
  StyleSheet,
  Text,
  TouchableOpacity,
  useWindowDimensions,
  View,
} from "react-native";

// 🎯 1. 데이터 타입 정의 (item 오류 해결의 핵심)
interface Member {
  id: number;
  name: string;
  icon: React.ReactNode;
  speaking: boolean;
}

export default function RoomScreen() {
  const router = useRouter();
  const { width } = useWindowDimensions();

  // 참여자 임시 데이터
  const members: Member[] = [
    {
      id: 1,
      name: "김순희",
      icon: <Ionicons name="people" size={width * 0.12} color="#4A90E2" />,
      speaking: true,
    },
    {
      id: 2,
      name: "박철수",
      icon: <FontAwesome5 name="robot" size={width * 0.12} color="#F5A623" />,
      speaking: false,
    },
    {
      id: 3,
      name: "이말숙",
      icon: (
        <MaterialCommunityIcons
          name="face-woman"
          size={width * 0.12}
          color="#D0021B"
        />
      ),
      speaking: false,
    },
    {
      id: 4,
      name: "최진호",
      icon: <Ionicons name="fitness" size={width * 0.12} color="#7ED321" />,
      speaking: true,
    },
  ];

  // 🎯 2. renderMember 함수 수정 (타입 지정 및 구조 분해 할당)
  const renderMember = ({ item }: { item: Member }) => (
    <View style={styles.memberCard}>
      {/* 말하는 사람일 경우 테두리색 강조 (speakingBorder) */}
      <View
        style={[styles.avatarCircle, item.speaking && styles.speakingBorder]}
      >
        {item.icon}
      </View>
      <Text style={styles.memberName}>{item.name}</Text>
    </View>
  );

  return (
    <View style={styles.container}>
      {/* 상단 헤더 */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()}>
          <Ionicons name="chevron-back" size={width * 0.08} color="#AAA" />
        </TouchableOpacity>

        <Text style={styles.headerTitle} numberOfLines={1}>
          오늘 아침 신문 이야기
        </Text>

        <TouchableOpacity
          style={styles.exitButton}
          onPress={() => router.back()} // 실제 나가기 동작
        >
          <Text style={styles.exitButtonText}>나가기</Text>
        </TouchableOpacity>
      </View>

      {/* 중앙 참여자 목록 (2열 그리드) */}
      <FlatList
        data={members}
        renderItem={renderMember}
        keyExtractor={(item) => item.id.toString()}
        numColumns={2}
        contentContainerStyle={styles.memberList}
        showsVerticalScrollIndicator={false}
      />

      {/* 하단 음성 컨트롤 바 */}
      <View style={styles.controls}>
        <TouchableOpacity style={styles.controlBtn}>
          <Ionicons
            name="volume-medium-outline"
            size={width * 0.1}
            color="white"
          />
        </TouchableOpacity>

        {/* 중앙 마이크 버튼 (강조색 적용) */}
        <TouchableOpacity style={styles.micBtn}>
          <Ionicons name="mic" size={width * 0.12} color="#111" />
        </TouchableOpacity>

        <TouchableOpacity style={styles.controlBtn}>
          <MaterialCommunityIcons
            name="comment-text-multiple-outline"
            size={width * 0.1}
            color="white"
          />
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#111",
    paddingTop: 60,
    paddingBottom: 30,
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 15,
    marginBottom: 30,
  },
  headerTitle: {
    flex: 1,
    fontSize: 20,
    fontWeight: "700",
    color: "#fff",
    textAlign: "center",
    marginHorizontal: 10,
  },
  exitButton: {
    backgroundColor: "#333",
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 10,
  },
  exitButtonText: {
    color: "#FF5252",
    fontWeight: "800",
    fontSize: 14,
  },
  memberList: {
    paddingHorizontal: 10,
    paddingBottom: 100, // 하단 컨트롤바에 가려지지 않게 여백 추가
  },
  memberCard: {
    width: "50%", // 2열을 꽉 채우기 위해 50%로 설정
    alignItems: "center",
    marginBottom: 30,
  },
  avatarCircle: {
    width: 130,
    height: 130,
    borderRadius: 65,
    backgroundColor: "#222",
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 12,
    borderWidth: 4,
    borderColor: "#333",
  },
  // 🎯 시안에서 본 '말하는 중' 표시 테두리
  speakingBorder: {
    borderColor: "#20E09F",
  },
  memberName: {
    color: "#fff",
    fontSize: 20,
    fontWeight: "700",
  },
  controls: {
    position: "absolute",
    bottom: 40,
    left: 20,
    right: 20,
    flexDirection: "row",
    justifyContent: "space-around",
    alignItems: "center",
    backgroundColor: "rgba(40, 40, 40, 0.95)",
    paddingVertical: 15,
    borderRadius: 50,
    // 그림자 효과로 입체감 부여
    elevation: 10,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.5,
    shadowRadius: 10,
  },
  controlBtn: {
    padding: 10,
  },
  micBtn: {
    width: 85,
    height: 85,
    borderRadius: 42.5,
    backgroundColor: "#20E09F",
    justifyContent: "center",
    alignItems: "center",
  },
});
