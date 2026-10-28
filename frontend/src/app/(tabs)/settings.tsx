import { useEffect, useState } from "react";
import {
  Alert,
  AppState,
  Linking,
  Pressable,
  ScrollView,
  Switch,
  View,
  type ViewStyle,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { API_URL, NEIGHBOR_RADIUS_KM, USE_MOCK } from "../../api/config";
import { AppText } from "../../components/AppText";
import { Card } from "../../components/Card";
import { useNeighborhood } from "../../hooks/useNeighborhood";
import { formatMinutes } from "../../lib/format";
import { cancelReminder } from "../../lib/notifications";
import { useAppStore } from "../../store/useAppStore";
import { theme } from "../../theme";

export default function SettingsScreen() {
  const insets = useSafeAreaInsets();
  const s = useAppStore();
  const { granted, request } = useNeighborhood();

  // 👈 앱이 포그라운드(화면)로 돌아올 때 위치 권한 상태를 다시 확인하는 로직
  useEffect(() => {
    const subscription = AppState.addEventListener("change", (nextAppState) => {
      if (nextAppState === "active") {
        request(); // 앱으로 다시 돌아왔을 때 권한 상태 재조회
      }
    });

    return () => {
      subscription.remove();
    };
  }, [request]);

  // 시스템 설정으로 이동
  const openAppSettings = () => {
    Linking.openSettings().catch(() => {
      Alert.alert(
        "알림",
        "설정 화면을 열 수 없습니다. 휴대폰 설정에서 권한을 변경해 주세요.",
      );
    });
  };

  // 허용하기 버튼 클릭 시 처리
  const handleRequestLocation = async () => {
    const res = await request();
    // OS 설정에서 이미 권한을 거부했거나 팝업이 안 뜨는 경우 설정으로 안내
    if (!res) {
      Alert.alert(
        "위치 권한 필요",
        "기기의 위치 권한이 켜져있지 않거나 거부되어 있습니다. 설정 화면에서 위치 권한을 허용해 주세요.",
        [
          { text: "취소", style: "cancel" },
          { text: "설정으로 이동", onPress: openAppSettings },
        ],
      );
    }
  };

  const confirmReset = () =>
    Alert.alert(
      "기록과 일정을 모두 지울까요?",
      "지운 뒤에는 되돌릴 수 없어요.",
      [
        { text: "취소", style: "cancel" },
        {
          text: "모두 지우기",
          style: "destructive",
          onPress: () => {
            useAppStore
              .getState()
              .schedules.forEach((x) => cancelReminder(x.id));
            s.resetData();
          },
        },
      ],
    );

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: theme.background }}
      contentContainerStyle={{
        paddingTop: insets.top + 12,
        paddingHorizontal: 20,
        paddingBottom: 40,
        gap: 18,
      }}
    >
      <AppText variant="largeTitle">설정</AppText>

      <Section title="알림">
        <Row
          label="다마가 먼저 안부 묻기"
          right={
            <Switch
              value={s.notificationsEnabled}
              onValueChange={s.setNotificationsEnabled}
              trackColor={{ true: theme.brand }}
            />
          }
        />
        {s.notificationsEnabled && (
          <Row
            label="안부 시간"
            right={
              <View
                style={{ flexDirection: "row", alignItems: "center", gap: 6 }}
              >
                <Stepper
                  icon="remove"
                  label="30분 앞당기기"
                  onPress={() => s.setCheckInMinutes(s.checkInMinutes - 30)}
                />
                <AppText bold style={{ minWidth: 92, textAlign: "center" }}>
                  {formatMinutes(s.checkInMinutes)}
                </AppText>
                <Stepper
                  icon="add"
                  label="30분 늦추기"
                  onPress={() => s.setCheckInMinutes(s.checkInMinutes + 30)}
                />
              </View>
            }
          />
        )}
      </Section>

      <Section title="화면">
        <Row
          label="큰 글씨로 보기"
          right={
            <Switch
              value={s.largeText}
              onValueChange={s.setLargeText}
              trackColor={{ true: theme.brand }}
            />
          }
        />
      </Section>

      <Section title="위치">
        <Row
          label={`반경 ${NEIGHBOR_RADIUS_KM}km 이웃 연결`}
          right={
            granted ? (
              <View
                style={{ flexDirection: "row", alignItems: "center", gap: 8 }}
              >
                <AppText color={theme.subInk}>허용됨</AppText>
                <Pressable
                  accessibilityRole="button"
                  onPress={openAppSettings}
                  style={({ pressed }) => ({
                    paddingHorizontal: 10,
                    paddingVertical: 4,
                    borderRadius: 8,
                    backgroundColor: theme.peach,
                    opacity: pressed ? 0.7 : 1,
                  })}
                >
                  <AppText variant="caption" color={theme.brand} bold>
                    해제하기
                  </AppText>
                </Pressable>
              </View>
            ) : (
              <Pressable
                accessibilityRole="button"
                onPress={handleRequestLocation}
              >
                <AppText color={theme.brand} bold>
                  허용하기
                </AppText>
              </Pressable>
            )
          }
        />
      </Section>

      <Section title="서버 연결 (개발용)">
        <Row label={USE_MOCK ? "데모 모드 (서버 미연결)" : API_URL} />
        <AppText
          variant="caption"
          color={theme.subInk}
          style={{ paddingHorizontal: 16, paddingBottom: 12 }}
        >
          .env 의 EXPO_PUBLIC_API_URL 로 백엔드 주소를 지정하고 앱을 다시
          실행하면 연결돼요.
        </AppText>
      </Section>

      <Pressable
        accessibilityRole="button"
        onPress={confirmReset}
        style={{ alignItems: "center", padding: 14 }}
      >
        <AppText color={theme.listening} bold>
          기록·일정 모두 지우기
        </AppText>
      </Pressable>

      <AppText variant="caption" color={theme.subInk} center>
        담화 0.1.0
      </AppText>
    </ScrollView>
  );
}

function Section({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <View style={{ gap: 8 }}>
      <AppText
        variant="footnote"
        color={theme.subInk}
        bold
        style={{ marginLeft: 6 }}
      >
        {title}
      </AppText>
      <Card radius={16}>{children}</Card>
    </View>
  );
}

function Row({ label, right }: { label: string; right?: React.ReactNode }) {
  const style: ViewStyle = {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
  };
  return (
    <View style={style}>
      <AppText style={{ flex: 1 }}>{label}</AppText>
      {right}
    </View>
  );
}

function Stepper({
  icon,
  label,
  onPress,
}: {
  icon: "add" | "remove";
  label: string;
  onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      hitSlop={6}
      onPress={onPress}
      style={{
        width: 34,
        height: 34,
        borderRadius: 17,
        backgroundColor: theme.peach,
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      <Ionicons name={icon} size={18} color={theme.brand} />
    </Pressable>
  );
}
