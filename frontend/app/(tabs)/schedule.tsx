import { useState } from "react";
import {
  Dimensions,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { CalendarList, LocaleConfig } from "react-native-calendars";

LocaleConfig.locales["kr"] = {
  monthNames: [
    "1월",
    "2월",
    "3월",
    "4월",
    "5월",
    "6월",
    "7월",
    "8월",
    "9월",
    "10월",
    "11월",
    "12월",
  ],
  monthNamesShort: [
    "1월",
    "2월",
    "3월",
    "4월",
    "5월",
    "6월",
    "7월",
    "8월",
    "9월",
    "10월",
    "11월",
    "12월",
  ],
  dayNames: [
    "일요일",
    "월요일",
    "화요일",
    "수요일",
    "목요일",
    "금요일",
    "토요일",
  ],
  dayNamesShort: ["일", "월", "화", "수", "목", "금", "토"],
};

LocaleConfig.defaultLocale = "kr";

export default function ScheduleScreen() {
  const [selectedDate, setSelectedDate] = useState("");
  const screenWidth = Dimensions.get("window").width;

  const renderCustomHeader = (date: Date) => {
    const year = date.getFullYear();
    const month = date.getMonth() + 1;

    return (
      <View style={styles.monthHeader}>
        <Text style={styles.monthText}>{month}</Text>
        <Text style={styles.yearText}>{year}</Text>
      </View>
    );
  };

  return (
    <View style={styles.container}>
      <Text style={styles.header}>일정</Text>

      <CalendarList
        horizontal
        pagingEnabled
        calendarWidth={screenWidth}
        pastScrollRange={12}
        futureScrollRange={12}
        showScrollIndicator={false}
        firstDay={0}
        renderHeader={(date) => renderCustomHeader(date)}
        onDayPress={(day) => setSelectedDate(day.dateString)}
        markedDates={{
          [selectedDate]: {
            selected: true,
            selectedColor: "#B36A3C",
          },
        }}
        theme={
          {
            todayTextColor: "#B36A3C",
            selectedDayBackgroundColor: "#B36A3C",

            textDayFontSize: 20,
            textDayHeaderFontSize: 18,
            textMonthFontSize: 32,

            textSectionTitleColor: "#444",

            "stylesheet.calendar.header": {
              week: {
                flexDirection: "row",
                justifyContent: "space-between",
                backgroundColor: "#E6E6E6",
                paddingVertical: 8,
                borderRadius: 8,
                marginBottom: 10,
                paddingHorizontal: 10,
              },
            },
          } as any
        }
        dayComponent={({ date }) => {
          if (!date) return null;

          const day = new Date(date.dateString).getDay();
          const isSelected = selectedDate === date.dateString;

          return (
            <TouchableOpacity
              style={[
                styles.dayContainer,
                isSelected && styles.selectedDayContainer,
              ]}
              onPress={() => setSelectedDate(date.dateString)}
            >
              <Text
                style={[
                  styles.dayText,
                  day === 0 && styles.sunday,
                  day === 6 && styles.saturday,
                  isSelected && styles.selectedDayText,
                ]}
              >
                {date.day}
              </Text>
            </TouchableOpacity>
          );
        }}
      />

      <View style={styles.scheduleBox}>
        <Text style={styles.scheduleText}>
          {selectedDate
            ? `${selectedDate} 일정이 표시됩니다`
            : "날짜를 선택하면 일정이 표시됩니다"}
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  selectedDayContainer: {
    backgroundColor: "#E0E0E0",
    borderRadius: 10,
  },

  selectedDayText: {
    fontWeight: "700",
  },

  container: {
    flex: 1,
    backgroundColor: "#fff",
    paddingTop: 60,
  },

  header: {
    fontSize: 26,
    fontWeight: "700",
    marginBottom: 10,
    marginLeft: 20,
  },

  monthHeader: {
    flexDirection: "row",
    alignItems: "flex-end",
    marginLeft: 20,
    marginBottom: 10,
  },

  monthText: {
    fontSize: 48,
    fontWeight: "800",
    marginRight: 6,
  },

  yearText: {
    fontSize: 18,
    color: "#666",
    marginBottom: 6,
  },

  dayContainer: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 10,
    width: 42,
    height: 42,
  },

  dayText: {
    fontSize: 20,
    color: "#333",
  },

  sunday: {
    color: "#E53935",
    fontWeight: "700",
  },

  saturday: {
    color: "#1E88E5",
    fontWeight: "700",
  },

  scheduleBox: {
    marginTop: 30,
    marginHorizontal: 20,
    padding: 20,
    backgroundColor: "#FAFAFA",
    borderRadius: 16,
  },

  scheduleText: {
    fontSize: 16,
    color: "#666",
  },
});
