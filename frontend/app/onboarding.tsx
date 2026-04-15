import AsyncStorage from "@react-native-async-storage/async-storage";
import { router } from "expo-router";
import React, { useRef, useState } from "react";
import {
  Animated,
  FlatList,
  Image,
  StyleSheet,
  Text,
  TouchableOpacity,
  useWindowDimensions,
  View,
} from "react-native";

// 1. 페이지 데이터의 타입을 명확히 정의하여 오류 방지
interface PageItem {
  id: number;
  lines: string[];
  image?: any; // 5번 페이지용
  images?: any[]; // 6번 페이지용
}

const PAGES: PageItem[] = [
  { id: 1, lines: ["담소를", "나누어", "꽃을 피우다."] },
  {
    id: 2,
    lines: ["오늘 하루는", "어땠나요?", "마음의 소리를", "들려주세요."],
  },
  { id: 3, lines: ["당신의 마음이", "머무는 곳에", "우리가 함께할게요."] },
  { id: 4, lines: ["-----", "Dam", "hwa", "-----", "Story of you"] },
  {
    id: 5,
    lines: ["AI와 대화로"],
    image: require("../assets/images/5-page.jpg"),
  },
  {
    id: 6,
    lines: ["일정부터 (image1)", "(image2) 일상까지", "한번에!"],
    images: [
      require("../assets/images/6-page-1.jpg"),
      require("../assets/images/6-page-2.jpg"),
    ],
  },
];

export default function Onboarding() {
  const { width, height } = useWindowDimensions();
  const scrollX = useRef(new Animated.Value(0)).current;
  const flatListRef = useRef<FlatList<PageItem>>(null);
  const [currentIndex, setCurrentIndex] = useState(0);

  // 반응형 수치: 기종 너비에 비례하도록 설정 (아이폰 SE ~ 프로맥스 모두 대응)
  const responsiveFontSize = width * 0.11;
  const responsiveLineHeight = responsiveFontSize * 1.3;

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
                event.nativeEvent.contentOffset.x / width,
              );
              setCurrentIndex(index);
            },
          },
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

          const isPage4 = item.id === 4;
          const isPage5 = item.id === 5;
          const isPage6 = item.id === 6;

          return (
            <View
              style={[
                styles.page,
                { width },
                isPage4 && { backgroundColor: "#D7C999" },
                isPage5 && {
                  justifyContent: "flex-start",
                  paddingTop: height * 0.18,
                },
              ]}
            >
              <Animated.View
                style={{
                  opacity,
                  transform: [{ translateY }, { scale }],
                  width: "100%",
                  alignItems: [4, 5, 6].includes(item.id)
                    ? "center"
                    : "flex-start",
                }}
              >
                {item.lines.map((line, idx) => {
                  // 4페이지 실선 구분선 처리
                  if (isPage4 && line === "-----") {
                    return (
                      <View
                        key={idx}
                        style={[styles.divider, { width: width * 0.6 }]}
                      />
                    );
                  }

                  // 색상 로직 복구
                  let textColor = styles.black;
                  if (isPage5 || isPage6) textColor = styles.black;
                  else if (isPage4) textColor = styles.red;
                  else if (idx <= 1) textColor = styles.red;

                  const lineStyle = [
                    styles.text,
                    {
                      fontSize: responsiveFontSize,
                      lineHeight: responsiveLineHeight,
                    },
                    textColor,
                    (isPage4 || isPage5 || isPage6) && {
                      fontWeight: "900" as any,
                    },
                  ];

                  // 6페이지 이미지 행 처리
                  if (isPage6 && line.includes("(image1)")) {
                    return (
                      <View key={idx} style={styles.inlineContainer}>
                        <Text style={lineStyle}>일정부터 </Text>
                        <Image
                          source={item.images?.[0]}
                          style={styles.page6Image}
                        />
                      </View>
                    );
                  }
                  if (isPage6 && line.includes("(image2)")) {
                    return (
                      <View key={idx} style={styles.inlineContainer}>
                        <Image
                          source={item.images?.[1]}
                          style={styles.page6Image}
                        />
                        <Text style={lineStyle}> 일상까지</Text>
                      </View>
                    );
                  }

                  return (
                    <Text
                      key={idx}
                      style={[
                        lineStyle,
                        (isPage4 || isPage5) && { textAlign: "center" },
                      ]}
                    >
                      {line}
                    </Text>
                  );
                })}

                {/* 5페이지 메인 이미지 */}
                {isPage5 && item.image && (
                  <Image
                    source={item.image}
                    style={[
                      styles.page5Image,
                      { width: width * 0.7, height: width * 0.7 },
                    ]}
                  />
                )}
              </Animated.View>
            </View>
          );
        }}
      />

      {/* 인디케이터 */}
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
  page: { justifyContent: "center", paddingHorizontal: 30 },
  text: { fontWeight: "700", marginBottom: 10 },
  red: { color: "#8B0000" },
  black: { color: "#000" },
  divider: { height: 2, backgroundColor: "#8B0000", marginVertical: 15 },
  page5Image: { resizeMode: "contain", marginTop: 40 },
  inlineContainer: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 10,
  },
  page6Image: { width: 50, height: 50, resizeMode: "contain" },
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
  dotActive: { backgroundColor: "#000" },
  button: {
    position: "absolute",
    bottom: 40,
    alignSelf: "center",
    backgroundColor: "#B36A3C",
    paddingVertical: 16,
    borderRadius: 30,
    alignItems: "center",
  },
  buttonText: { color: "#fff", fontSize: 18, fontWeight: "600" },
});
