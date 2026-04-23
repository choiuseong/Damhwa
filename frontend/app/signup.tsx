import React, { useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  SafeAreaView,
  Alert,
} from "react-native";
import { useRouter } from "expo-router";

const MAIN_BROWN = "#BF6A2A";

export default function SignUpScreen() {
  const router = useRouter();
  
  // DB 저장을 위한 상태값들
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [nickname, setNickname] = useState("");

  const handleSignUp = async () => {
    // 1. 유효성 검사 (기본)
    if (!email.includes("@") || password.length < 6 || nickname.length < 2) {
      Alert.alert("확인해 주세요", "이메일 형식과 비밀번호(6자 이상),\n이름을 모두 정확히 입력해 주세요.");
      return;
    }

    try {
      // 2. DB 저장 로직 (이곳에 API 호출 코드를 넣으시면 됩니다)
      // const response = await fetch('YOUR_API_URL/signup', { ... });
      
      console.log("회원가입 정보:", { email, password, nickname });
      
      Alert.alert("환영합니다!", `${nickname}님, 가입이 완료되었습니다.`, [
        { text: "확인", onPress: () => router.replace("/(tabs)") }
      ]);
    } catch (error) {
      Alert.alert("오류", "서버와 연결이 원활하지 않습니다.");
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        style={{ flex: 1 }}
      >
        <ScrollView contentContainerStyle={styles.scrollInner}>
          <View style={styles.header}>
            <Text style={styles.title}>회원가입</Text>
            <Text style={styles.subtitle}>다마와 함께 소중한 일상을{"\n"}기록하고 나누어 보세요.</Text>
          </View>

          <View style={styles.form}>
            {/* 이메일 입력 */}
            <View style={styles.inputGroup}>
              <Text style={styles.label}>이메일 주소</Text>
              <TextInput
                style={styles.input}
                placeholder="예: damhwa@email.com"
                value={email}
                onChangeText={setEmail}
                keyboardType="email-address"
                autoCapitalize="none"
              />
            </View>

            {/* 비밀번호 입력 */}
            <View style={styles.inputGroup}>
              <Text style={styles.label}>비밀번호 (6자 이상)</Text>
              <TextInput
                style={styles.input}
                placeholder="비밀번호를 입력하세요"
                value={password}
                onChangeText={setPassword}
                secureTextEntry={true} // 별표 처리
              />
            </View>

            {/* 닉네임 입력 */}
            <View style={styles.inputGroup}>
              <Text style={styles.label}>성함 또는 별명</Text>
              <TextInput
                style={styles.input}
                placeholder="어르신을 어떻게 불러드릴까요?"
                value={nickname}
                onChangeText={setNickname}
              />
            </View>
          </View>

          <TouchableOpacity style={styles.submitButton} onPress={handleSignUp}>
            <Text style={styles.submitText}>가입 완료하고 시작하기</Text>
          </TouchableOpacity>

          <TouchableOpacity 
            style={styles.backButton} 
            onPress={() => router.back()}
          >
            <Text style={styles.backText}>이전으로 돌아가기</Text>
          </TouchableOpacity>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#FFF" },
  scrollInner: { padding: 30, paddingBottom: 50 },
  header: { marginTop: 40, marginBottom: 40 },
  title: { fontSize: 32, fontWeight: "800", color: MAIN_BROWN, marginBottom: 12 },
  subtitle: { fontSize: 18, color: "#666", lineHeight: 26 },
  form: { marginBottom: 40 },
  inputGroup: { marginBottom: 25 },
  label: { fontSize: 16, fontWeight: "700", color: "#444", marginBottom: 10 },
  input: {
    backgroundColor: "#F8F9FA",
    borderWidth: 1.5,
    borderColor: "#EEE",
    borderRadius: 15,
    padding: 18,
    fontSize: 18,
    color: "#000",
  },
  submitButton: {
    backgroundColor: MAIN_BROWN,
    paddingVertical: 20,
    borderRadius: 30,
    alignItems: "center",
    elevation: 4,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
  },
  submitText: { color: "#FFF", fontSize: 20, fontWeight: "800" },
  backButton: { marginTop: 25, alignItems: "center" },
  backText: { color: "#AAA", fontSize: 16, textDecorationLine: "underline" },
});