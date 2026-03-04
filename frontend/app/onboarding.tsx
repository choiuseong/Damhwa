import AsyncStorage from "@react-native-async-storage/async-storage";
import { router } from "expo-router";
import React, { useRef, useState } from "react";
import {
  Animated,
  FlatList,
  StyleSheet,
  Text,
  TouchableOpacity,
  useWindowDimensions,
  View,
} from "react-native";

const PAGES = [
  {
    id: 1,
    lines: ["담소를", "나누어", "꽃을 피우다."],
  },
  {
    id: 2,
    lines: ["오늘 하루는", "어땠나요?", "마음의 소리를", "들려주세요."],
  },
  {
    id: 3,
    lines: ["당신의 마음이", "머무는 곳에", "우리가 함께할게요."],
  },
];

export default function Onboarding() {
  const { width } = useWindowDimensions();
  const scrollX = useRef(new Animated.Value(0)).current;
  const flatListRef = useRef<FlatList>(null);
  const [currentIndex, setCurrentIndex] = useState(0);

  const finishOnboarding = async () => {
    await AsyncStorage.setItem("onboardingDone", "true");
    router.replace("/(tabs)");
  };

  return (
    <View style={styles.container}>
      <Animated.FlatList
        ref={flatListRef}
        data={PAGES}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        keyExtractor={(item) => item.id.toString()}
        scrollEventThrottle={16}
        onScroll={Animated.event(
          [{ nativeEvent: { contentOffset: { x: scrollX } } }],
          {
            useNativeDriver: true,
            listener: (event: any) => {
              const index = Math.round(
                event.nativeEvent.contentOffset.x / width
              );
              setCurrentIndex(index);
            },
          }
        )}
        renderItem={({ item, index }) => {
          const inputRange = [
            (index - 1) * width,
            index * width,
            (index + 1) * width,
          ];

          const opacity = scrollX.interpolate({
            inputRange,
            outputRange: [0, 1, 0],
            extrapolate: "clamp",
          });

          const translateY = scrollX.interpolate({
            inputRange,
            outputRange: [40, 0, 40],
            extrapolate: "clamp",
          });

          const scale = scrollX.interpolate({
            inputRange,
            outputRange: [0.9, 1, 0.9],
            extrapolate: "clamp",
          });

          return (
            <View style={[styles.page, { width }]}>
              <Animated.View
                style={{
                  opacity,
                  transform: [{ translateY }, { scale }],
                }}
              >
                {item.lines.map((line, idx) => (
                  <Text
                    key={idx}
                    style={[styles.text, idx <= 1 ? styles.red : styles.black]}
                  >
                    {line}
                  </Text>
                ))}
              </Animated.View>
            </View>
          );
        }}
      />

      {/* Dot indicator */}
      <View style={styles.dotsWrapper}>
        {PAGES.map((_, idx) => (
          <View
            key={idx}
            style={[styles.dot, currentIndex === idx && styles.dotActive]}
          />
        ))}
      </View>

      {/* 마지막 페이지 버튼 */}
      {currentIndex === PAGES.length - 1 && (
        <TouchableOpacity
          style={[styles.button, { width: width * 0.8 }]}
          onPress={finishOnboarding}
        >
          <Text style={styles.buttonText}>홈으로 가기</Text>
        </TouchableOpacity>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#fff" },

  page: {
    justifyContent: "center",
    paddingHorizontal: 30,
  },

  text: {
    fontSize: 46,
    fontWeight: "700",
    marginBottom: 12,
    lineHeight: 60,
  },

  red: { color: "#8B0000" },
  black: { color: "#000" },

  dotsWrapper: {
    position: "absolute",
    bottom: 120,
    width: "100%",
    flexDirection: "row",
    justifyContent: "center",
  },

  dot: {
    width: 7,
    height: 7,
    borderRadius: 4,
    backgroundColor: "#CFCFCF",
    marginHorizontal: 4,
  },

  dotActive: {
    backgroundColor: "#000",
  },

  button: {
    position: "absolute",
    bottom: 40,
    alignSelf: "center",
    backgroundColor: "#B36A3C",
    paddingVertical: 16,
    borderRadius: 30,
    alignItems: "center",
  },

  buttonText: {
    color: "#fff",
    fontSize: 18,
    fontWeight: "600",
  },
});
