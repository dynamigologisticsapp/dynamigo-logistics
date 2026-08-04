import React from "react";
import { View, Text, Pressable, ScrollView } from "react-native";

interface RouteStop {
  id: string;
  label: string;
  type: "pickup" | "delivery" | "helper" | "helper-dropoff" | "home" | "unit" | "start";
  addressLine: string;
  index: number;
}

interface StartRouteConfirmationProps {
  visible: boolean;
  stops: RouteStop[];
  totalDistance: string;
  totalTime: string;
  onConfirm: () => void;
  onCancel: () => void;
}

export default function StartRouteConfirmation({
  visible,
  stops,
  totalDistance,
  totalTime,
  onConfirm,
  onCancel,
}: StartRouteConfirmationProps) {
  if (!visible) return null;

  const getStopTypeLabel = (type: string): string => {
    switch (type) {
      case "helper":
        return "Helper Pickup";
      case "helper-dropoff":
        return "Helper Drop-off";
      case "pickup":
        return "Pickup";
      case "delivery":
        return "Delivery";
      case "unit":
        return "Unit Return";
      case "home":
        return "Home";
      case "start":
        return "Driver Start";
      default:
        return type;
    }
  };

  const getStopEmoji = (type: string): string => {
    switch (type) {
      case "helper":
      case "helper-dropoff":
        return "🧍";
      case "pickup":
        return "📦";
      case "delivery":
        return "🚚";
      case "unit":
        return "🏭";
      case "home":
        return "HM";
      case "start":
        return "S";
      default:
        return "📍";
    }
  };

  // Hardcoded colors
  const colors = {
    background: "#ffffff",
    foreground: "#11181C",
    muted: "#687076",
    surface: "#f5f5f5",
    border: "#E5E7EB",
    primary: "#0a7ea4",
  };

  return (
    <View
      style={{
        position: "absolute",
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: "rgba(0, 0, 0, 0.5)",
        justifyContent: "center",
        alignItems: "center",
        padding: 16,
        zIndex: 1000,
      }}
    >
      <View
        style={{
          backgroundColor: colors.background,
          borderRadius: 12,
          padding: 24,
          width: "100%",
          maxWidth: 400,
          maxHeight: "80%",
          shadowColor: "#000",
          shadowOffset: { width: 0, height: 2 },
          shadowOpacity: 0.25,
          shadowRadius: 3.84,
          elevation: 5,
        }}
      >
        {/* Header */}
        <Text
          style={{
            fontSize: 20,
            fontWeight: "700",
            color: colors.foreground,
            marginBottom: 8,
          }}
        >
          Start Route?
        </Text>
        <Text
          style={{
            fontSize: 14,
            color: colors.muted,
            marginBottom: 16,
          }}
        >
          Review your route details before starting
        </Text>

        {/* Route Summary */}
        <View
          style={{
            backgroundColor: colors.surface,
            borderRadius: 8,
            padding: 12,
            marginBottom: 16,
            borderLeftWidth: 4,
            borderLeftColor: colors.primary,
          }}
        >
          <View
            style={{
              flexDirection: "row",
              justifyContent: "space-between",
              marginBottom: 8,
            }}
          >
            <Text style={{ fontSize: 12, color: colors.muted }}>
              Total Distance
            </Text>
            <Text
              style={{
                fontSize: 14,
                fontWeight: "600",
                color: colors.foreground,
              }}
            >
              {totalDistance}
            </Text>
          </View>
          <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
            <Text style={{ fontSize: 12, color: colors.muted }}>
              Estimated Time
            </Text>
            <Text
              style={{
                fontSize: 14,
                fontWeight: "600",
                color: colors.foreground,
              }}
            >
              {totalTime}
            </Text>
          </View>
        </View>

        {/* Stops List */}
        <Text
          style={{
            fontSize: 12,
            fontWeight: "600",
            color: colors.muted,
            marginBottom: 8,
            textTransform: "uppercase",
          }}
        >
          Route Stops ({stops.length})
        </Text>
        <ScrollView
          style={{
            maxHeight: 200,
            marginBottom: 16,
            borderRadius: 8,
            backgroundColor: colors.surface,
          }}
        >
          {stops.map((stop, index) => (
            <View
              key={stop.id}
              style={{
                flexDirection: "row",
                padding: 12,
                borderBottomWidth: index < stops.length - 1 ? 1 : 0,
                borderBottomColor: colors.border,
                alignItems: "flex-start",
              }}
            >
              <Text style={{ fontSize: 18, marginRight: 12 }}>
                {getStopEmoji(stop.type)}
              </Text>
              <View style={{ flex: 1 }}>
                <Text
                  style={{
                    fontSize: 12,
                    color: colors.muted,
                    marginBottom: 2,
                  }}
                >
                  Stop {index + 1} • {getStopTypeLabel(stop.type)}
                </Text>
                <Text
                  style={{
                    fontSize: 13,
                    fontWeight: "500",
                    color: colors.foreground,
                  }}
                  numberOfLines={2}
                >
                  {stop.label}
                </Text>
                <Text
                  style={{
                    fontSize: 11,
                    color: colors.muted,
                    marginTop: 2,
                  }}
                  numberOfLines={1}
                >
                  {stop.addressLine}
                </Text>
              </View>
            </View>
          ))}
        </ScrollView>

        {/* Action Buttons */}
        <View
          style={{
            flexDirection: "row",
            gap: 12,
          }}
        >
          <Pressable
            onPress={onCancel}
            style={({ pressed }) => ({
              flex: 1,
              paddingVertical: 12,
              paddingHorizontal: 16,
              borderRadius: 8,
              backgroundColor: colors.surface,
              borderWidth: 1,
              borderColor: colors.border,
              opacity: pressed ? 0.7 : 1,
            })}
          >
            <Text
              style={{
                textAlign: "center",
                fontSize: 14,
                fontWeight: "600",
                color: colors.foreground,
              }}
            >
              Cancel
            </Text>
          </Pressable>
          <Pressable
            onPress={onConfirm}
            style={({ pressed }) => ({
              flex: 1,
              paddingVertical: 12,
              paddingHorizontal: 16,
              borderRadius: 8,
              backgroundColor: colors.primary,
              opacity: pressed ? 0.8 : 1,
            })}
          >
            <Text
              style={{
                textAlign: "center",
                fontSize: 14,
                fontWeight: "600",
                color: "white",
              }}
            >
              Start Route
            </Text>
          </Pressable>
        </View>
      </View>
    </View>
  );
}
