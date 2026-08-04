import { Pressable, Text, View } from "react-native";
import { useEffect, useState } from "react";
import { formatDateKeyForDisplay, formatDateParts, parseDateKey } from "@/lib/date-key";

interface DatePickerProps {
  value: string; // YYYY-MM-DD format
  onChange: (date: string) => void;
  minDate?: string;
  maxDate?: string;
}

export function DatePicker({ value, onChange, minDate, maxDate }: DatePickerProps) {
  const [showPicker, setShowPicker] = useState(false);
  const [calendarMonth, setCalendarMonth] = useState(() => {
    const current = value ? parseDateKey(value) : new Date();
    return new Date(current.getFullYear(), current.getMonth(), 1);
  });

  useEffect(() => {
    if (!value) return;
    const current = parseDateKey(value);
    setCalendarMonth(new Date(current.getFullYear(), current.getMonth(), 1));
  }, [value]);

  const daysInMonth = new Date(calendarMonth.getFullYear(), calendarMonth.getMonth() + 1, 0).getDate();
  const firstDayOfMonth = new Date(calendarMonth.getFullYear(), calendarMonth.getMonth(), 1).getDay();

  const days = [];
  for (let i = 0; i < firstDayOfMonth; i++) {
    days.push(null);
  }
  for (let i = 1; i <= daysInMonth; i++) {
    days.push(i);
  }

  const handleSelectDate = (day: number) => {
    onChange(formatDateParts(calendarMonth.getFullYear(), calendarMonth.getMonth(), day));
    setShowPicker(false);
  };

  const handlePrevMonth = () => {
    setCalendarMonth((current) => new Date(current.getFullYear(), current.getMonth() - 1, 1));
  };

  const handleNextMonth = () => {
    setCalendarMonth((current) => new Date(current.getFullYear(), current.getMonth() + 1, 1));
  };

  const monthNames = [
    "January", "February", "March", "April", "May", "June",
    "July", "August", "September", "October", "November", "December"
  ];

  return (
    <View>
      <Pressable
        onPress={() => setShowPicker(!showPicker)}
        style={{
          padding: 12,
          borderRadius: 8,
          borderWidth: 1,
          borderColor: "#E5E7EB",
          backgroundColor: "#ffffff",
        }}
      >
        <Text style={{ color: value ? "#11181C" : "#607086", fontSize: 16 }}>
          {value ? formatDateKeyForDisplay(value) : "Select date"}
        </Text>
      </Pressable>

      {showPicker && (
        <View
          style={{
            marginTop: 12,
            padding: 16,
            borderRadius: 12,
            backgroundColor: "#f5f5f5",
            borderWidth: 1,
            borderColor: "#E5E7EB",
          }}
        >
          {/* Month/Year Header */}
          <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
            <Pressable onPress={handlePrevMonth} style={{ padding: 8 }}>
              <Text style={{ fontSize: 18, fontWeight: "bold", color: "#0a7ea4" }}>{"<"}</Text>
            </Pressable>
            <Text style={{ fontSize: 16, fontWeight: "600", color: "#11181C" }}>
              {monthNames[calendarMonth.getMonth()]} {calendarMonth.getFullYear()}
            </Text>
            <Pressable onPress={handleNextMonth} style={{ padding: 8 }}>
              <Text style={{ fontSize: 18, fontWeight: "bold", color: "#0a7ea4" }}>{">"}</Text>
            </Pressable>
          </View>

          {/* Day Headers */}
          <View style={{ flexDirection: "row", justifyContent: "space-around", marginBottom: 8 }}>
            {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((day) => (
              <Text key={day} style={{ width: "14.28%", textAlign: "center", fontWeight: "600", color: "#687076", fontSize: 12 }}>
                {day}
              </Text>
            ))}
          </View>

          {/* Calendar Grid */}
          <View style={{ flexDirection: "row", flexWrap: "wrap" }}>
            {days.map((day, index) => {
              const dayDate = day ? formatDateParts(calendarMonth.getFullYear(), calendarMonth.getMonth(), day) : null;
              const isSelected = dayDate === value;
              return (
                <View key={index} style={{ width: "14.28%", aspectRatio: 1, justifyContent: "center", alignItems: "center" }}>
                  {day ? (
                  <Pressable
                    onPress={() => handleSelectDate(day)}
                    style={{
                      width: "90%",
                      height: "90%",
                      justifyContent: "center",
                      alignItems: "center",
                      borderRadius: 6,
                      backgroundColor: isSelected ? "#0a7ea4" : "#ffffff",
                    }}
                  >
                    <Text
                      style={{
                        color: isSelected ? "#ffffff" : "#11181C",
                        fontWeight: isSelected ? "600" : "400",
                      }}
                    >
                      {day}
                    </Text>
                  </Pressable>
                  ) : null}
                </View>
              );
            })}
          </View>

          {/* Close Button */}
          <Pressable
            onPress={() => setShowPicker(false)}
            style={{
              marginTop: 16,
              padding: 12,
              backgroundColor: "#ffffff",
              borderRadius: 8,
              borderWidth: 1,
              borderColor: "#E5E7EB",
            }}
          >
            <Text style={{ textAlign: "center", color: "#11181C", fontWeight: "600" }}>Done</Text>
          </Pressable>
        </View>
      )}
    </View>
  );
}
