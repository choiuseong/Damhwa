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

interface PageItem {
  id: number;
  lines: string[];
  image?: any;
  images?: any[];
}

// 🎯 기존 1, 2, 3번을 삭제하고 4, 5, 6번만 남김
const PAGES: PageItem[] = [
  { 
    id: 4, 
    lines: ["-----", "Dam", "hwa", "-----", "Story of you"] 
  },
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

  const responsiveFontSize = width * 0.11;
  const responsiveLineHeight = responsiveFontSize * 1.3;

  const finishOnboarding = async () => {
  await AsyncStorage.setItem("onboardingDone", "true");
  // router.replace("/(tabs)");  <-- 기존 코드를 아래로 변경
  router.push("/signup"); // 회원가입 화면으로 이동
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
                // 🎯 4번 배경색 유지, 5번 레이아웃 최적화
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
                  alignItems: "center", // 4, 5, 6 모두 중앙 정렬
                }}
              >
                {item.lines.map((line, idx) => {
                  if (isPage4 && line === "-----") {
                    return (
                      <View
                        key={idx}
                        style={[styles.divider, { width: width * 0.6 }]}
                      />
                    );
                  }

                  // 색상 로직: 4번은 레드, 5/6번은 블랙
                  let textColor = styles.black;
                  if (isPage4) textColor = styles.red;

                  const lineStyle = [
                    styles.text,
                    {
                      fontSize: responsiveFontSize,
                      lineHeight: responsiveLineHeight,
                    },
                    textColor,
                    { fontWeight: "900" as any }, // 4, 5, 6 모두 볼드 적용
                  ];

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
                        { textAlign: "center" }, // 4, 5, 6 모두 텍스트 중앙 정렬
                      ]}
                    >
                      {line}
                    </Text>
                  );
                })}

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

      {/* 인디케이터: 이제 3개만 표시됨 */}
      <View style={styles.dotsWrapper}>
        {PAGES.map((_, idx) => (
          <View
            key={idx}
            style={[styles.dot, currentIndex === idx && styles.dotActive]}
          />
        ))}
      </View>

      {/* 🎯 마지막 페이지(index 2)에서 버튼 활성화 */}
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

// 스타일 시트는 기존과 동일하게 유지 (수정 불필요)
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