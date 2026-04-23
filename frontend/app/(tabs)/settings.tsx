import React from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  SafeAreaView,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";

// 담화 컬러군
const MAIN_BROWN = "#BF6A2A";
const SETTINGS_BG = "#F2F2F2"; // 설정 화면만의 차별화된 연그레이 베이지

export default function SettingsScreen() {
  const SettingItem = ({ icon, title, onPress, color = "#555" }: any) => (
    <TouchableOpacity style={styles.item} onPress={onPress} activeOpacity={0.7}>
      <View style={styles.itemLeft}>
        <Ionicons name={icon} size={26} color={color} />
        <Text style={styles.itemTitle}>{title}</Text>
      </View>
      <Ionicons name="chevron-forward" size={22} color="#BBB" />
    </TouchableOpacity>
  );

  return (
    <SafeAreaView style={styles.container}>
      {/* 헤더 영역 - 배경색과 대비를 위해 흰색 유지 */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>설정</Text>
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent}>
        {/* 사용자 정보 카드 - 배경과 분리되도록 흰색 카드 형태 */}
        <View style={styles.profileCard}>
          <View style={styles.avatar}>
            <Ionicons name="person" size={36} color="#FFF" />
          </View>
          <View>
            <Text style={styles.userName}>사용자님</Text>
            <Text style={styles.userSub}>오늘도 다마와 함께해요</Text>
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionLabel}>서비스 관리</Text>
          <View style={styles.menuGroup}>
            <SettingItem icon="person-outline" title="내 정보 수정" />
            <SettingItem icon="notifications-outline" title="알림 설정" />
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionLabel}>고객 지원</Text>
          <View style={styles.menuGroup}>
            <SettingItem icon="volume-high-outline" title="소리 및 글자 크기" />
            <SettingItem icon="help-circle-outline" title="자주 묻는 질문" />
          </View>
        </View>

        <View style={styles.section}>
          <TouchableOpacity style={styles.logoutButton}>
            <Text style={styles.logoutText}>로그아웃</Text>
          </TouchableOpacity>
        </View>

        <Text style={styles.version}>버전 1.0.0 (최신버전)</Text>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { 
    flex: 1, 
    backgroundColor: SETTINGS_BG // 🎯 설정 화면만의 고유 배경색
  },
  header: {
    paddingHorizontal: 24,
    paddingVertical: 20,
    backgroundColor: "#FFF",
    borderBottomWidth: 1,
    borderBottomColor: "#EAEAEA",
  },
  headerTitle: { fontSize: 22, fontWeight: "800", color: "#333" },
  scrollContent: { paddingBottom: 40 },
  profileCard: {
    flexDirection: "row",
    alignItems: "center",
    margin: 20,
    padding: 24,
    backgroundColor: "#FFF",
    borderRadius: 20,
    // 그림자로 카드 느낌 강조
    elevation: 2,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 5,
  },
  avatar: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: MAIN_BROWN,
    justifyContent: "center",
    alignItems: "center",
    marginRight: 16,
  },
  userName: { fontSize: 18, fontWeight: "700", color: "#222" },
  userSub: { fontSize: 13, color: "#888", marginTop: 2 },
  section: { marginTop: 10, paddingHorizontal: 20 },
  sectionLabel: {
    fontSize: 14,
    fontWeight: "700",
    color: "#888",
    marginBottom: 10,
    marginLeft: 4,
  },
  menuGroup: {
    backgroundColor: "#FFF",
    borderRadius: 20,
    paddingHorizontal: 16,
    overflow: "hidden",
  },
  item: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 18,
    borderBottomWidth: 1,
    borderBottomColor: "#F8F8F8",
  },
  itemLeft: { flexDirection: "row", alignItems: "center" },
  itemTitle: { fontSize: 17, fontWeight: "500", color: "#333", marginLeft: 12 },
  logoutButton: {
    marginTop: 20,
    alignItems: "center",
    padding: 18,
  },
  logoutText: { color: "#AAA", fontSize: 15, textDecorationLine: "underline" },
  version: { textAlign: "center", color: "#CCC", marginTop: 20, fontSize: 12 },
});