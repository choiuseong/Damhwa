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
  {
    id: 4,
    lines: ["-----","Dam", "hwa", "-----", "Story of you"] // 추가 페이지
  },
  {
    id: 5,
    lines: ["AI와 대화로"],
    image: require("../assets/images/5-page.jpg"), // 추가 페이지 2
  },
  {
    id: 6,
    lines: ["일정부터  (image1)", "(image2)  일상까지", "한번에!"],
    images: [
      require("../assets/images/6-page-1.jpg"), // 달력 이미지
      require("../assets/images/6-page-2.jpg"), // 산책 이미지
    ],
  }
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
            <View
              style={[
                styles.page,
                { width },
                // 4번 배경 색 변경
                item.id === 4 && { backgroundColor: "#D7C999" },
                // 5번 페이지는 위쪽으로 정렬
                item.id === 5 && { justifyContent: "flex-start", paddingTop: 150 },
              ]}
            >
              <Animated.View
                style={{
                  opacity,
                  transform: [{ translateY }, { scale }],
                  // 4, 5번 페이지는 width 100% 적용
                  width: [4, 5].includes(item.id) ? "100%" : undefined,
                  alignItems: [5, 6].includes(item.id) ? "center" : undefined, // 5, 6번 페이지 콘텐츠 중앙 정렬
                }}
              >
                {item.lines.map((line, idx) => {
                  const isPage4 = item.id === 4;
                  const isPage5 = item.id === 5;
                  const isPage6 = item.id === 6;

                  // 4페이지의 '-----'를 실선으로 렌더링
                  if (isPage4 && line === "-----") {
                    return <View key={idx} style={styles.divider} />;
                  }

                  const lineStyle = [
                    styles.text,
                    // 5, 6페이지는 검정, 4페이지는 빨강, 나머지는 기본 규칙
                    isPage5 || isPage6
                      ? styles.black
                      : isPage4 || idx <= 1
                      ? styles.red
                      : styles.black,
                    (isPage4 || isPage5 || isPage6) && { fontWeight: "900" },
                  ];

                  // 6페이지는 텍스트와 이미지를 함께 렌더링
                  if (isPage6) {
                    if (line.includes("(image1)")) {
                      return (
                        <View key={idx} style={styles.inlineContainer}>
                          <Text style={lineStyle}>일정부터  </Text>
                          <Image source={item.images[0]} style={styles.page6Image} />
                        </View>
                      );
                    }
                    if (line.includes("(image2)")) {
                      return (
                        <View key={idx} style={styles.inlineContainer}>
                          <Image source={item.images[1]} style={styles.page6Image} />
                          <Text style={lineStyle}>  일상까지</Text>
                        </View>
                      );
                    }
                  }

                  return (
                    <Text key={idx} style={lineStyle}>
                      {line}
                    </Text>
                  );
                })}
                {/* 5번 페이지 이미지 렌더링 */}
                {item.id === 5 && item.image && (
                  <Image source={item.image} style={styles.page5Image} />
                )}
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

  divider: {
    height: 2,
    backgroundColor: '#8B0000', // 빨간색
    marginVertical: 20,
  },

  page5Image: {
    width: 300,
    height: 300,
    resizeMode: "contain",
    marginTop: 60,
  },

  inlineContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12, // styles.text와 동일한 간격
  },

  page6Image: {
    width: 60, // 이미지 크기 조절
    height: 60, // 이미지 크기 조절
    resizeMode: 'contain',
  },

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
