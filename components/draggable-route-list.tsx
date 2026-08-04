import React, { useState, useCallback } from "react";
import {
  View,
  FlatList,
  Pressable,
  Text,
  Animated,
  PanResponder,
  useWindowDimensions,
  Platform,
  RefreshControlProps,
} from "react-native";
import { RouteStop } from "@/shared/route-planner";
import { useColors } from "@/hooks/use-colors";

interface DraggableRouteListProps {
  stops: RouteStop[];
  onReorder: (reorderedStops: RouteStop[]) => void;
  renderStop: (item: RouteStop, index: number) => React.ReactElement;
  onMarkComplete?: (stopId: string) => void;
  onReset?: () => void;
  hasCustomOrder?: boolean;
  ListHeaderComponent?: React.ReactElement;
  ListEmptyComponent?: React.ReactElement;
  refreshControl?: React.ReactElement<RefreshControlProps>;
  contentContainerStyle?: any;
}

export function DraggableRouteList({
  stops,
  onReorder,
  renderStop,
  onMarkComplete,
  onReset,
  hasCustomOrder,
  ListHeaderComponent,
  ListEmptyComponent,
  refreshControl,
  contentContainerStyle,
}: DraggableRouteListProps) {
  const [orderedStops, setOrderedStops] = useState(stops);
  const [draggedIndex, setDraggedIndex] = useState<number | null>(null);
  const [isEditMode, setIsEditMode] = useState(false);
  const colors = useColors();
  const { height: screenHeight } = useWindowDimensions();

  const getStopListKey = useCallback((item: RouteStop, index: number) => {
    return [
      item.id,
      item.kind,
      item.relatedJobId ?? "",
      item.relatedHelperId ?? "",
      item.label,
      item.addressLine,
      Math.round(item.etaMinutesFromStart),
      index,
    ].join("|");
  }, []);

  // Update ordered stops when incoming stops change
  React.useEffect(() => {
    setOrderedStops(stops);
  }, [stops]);

  const handleMoveUp = useCallback(
    (index: number) => {
      if (index <= 0) return;
      const newStops = [...orderedStops];
      [newStops[index], newStops[index - 1]] = [newStops[index - 1], newStops[index]];
      setOrderedStops(newStops);
      onReorder(newStops);
    },
    [orderedStops, onReorder]
  );

  const handleMoveDown = useCallback(
    (index: number) => {
      if (index >= orderedStops.length - 1) return;
      const newStops = [...orderedStops];
      [newStops[index], newStops[index + 1]] = [newStops[index + 1], newStops[index]];
      setOrderedStops(newStops);
      onReorder(newStops);
    },
    [orderedStops, onReorder]
  );

  const renderStopWithControls = ({ item, index }: { item: RouteStop; index: number }) => (
    <View style={{ marginBottom: 12 }}>
      {isEditMode && (
        <View
          style={{
            flexDirection: "row",
            alignItems: "center",
            gap: 8,
            marginBottom: 8,
            paddingHorizontal: 4,
          }}
        >
          <Pressable
            onPress={() => handleMoveUp(index)}
            disabled={index === 0}
            style={({ pressed }) => ({
              paddingVertical: 8,
              paddingHorizontal: 12,
              borderRadius: 6,
              backgroundColor: index === 0 ? colors.border : colors.primary,
              opacity: pressed ? 0.7 : 1,
            })}
          >
            <Text style={{ color: "white", fontSize: 12, fontWeight: "600" }}>↑ Up</Text>
          </Pressable>

          <Pressable
            onPress={() => handleMoveDown(index)}
            disabled={index === orderedStops.length - 1}
            style={({ pressed }) => ({
              paddingVertical: 8,
              paddingHorizontal: 12,
              borderRadius: 6,
              backgroundColor: index === orderedStops.length - 1 ? colors.border : colors.primary,
              opacity: pressed ? 0.7 : 1,
            })}
          >
            <Text style={{ color: "white", fontSize: 12, fontWeight: "600" }}>Down ↓</Text>
          </Pressable>

          <View style={{ flex: 1 }} />

          <View
            style={{
              paddingVertical: 6,
              paddingHorizontal: 10,
              borderRadius: 6,
              backgroundColor: colors.surface,
              borderWidth: 1,
              borderColor: colors.border,
            }}
          >
            <Text style={{ color: colors.foreground, fontSize: 12, fontWeight: "600" }}>
              Stop {index + 1}
            </Text>
          </View>
        </View>
      )}
      {renderStop(item, index)}
      {!isEditMode && onMarkComplete && item.kind !== "start" && (
        <Pressable
          onPress={() => onMarkComplete(item.id)}
          style={({ pressed }) => ({
            marginTop: 8,
            paddingVertical: 10,
            paddingHorizontal: 12,
            borderRadius: 8,
            backgroundColor: colors.success,
            opacity: pressed ? 0.7 : 1,
          })}
        >
          <Text style={{ color: "white", fontSize: 12, fontWeight: "600", textAlign: "center" }}>✓ Mark Complete</Text>
        </Pressable>
      )}
    </View>
  );

  return (
    <View style={{ flex: 1 }}>
      <FlatList
        data={orderedStops}
        keyExtractor={getStopListKey}
        renderItem={renderStopWithControls}
        contentContainerStyle={contentContainerStyle}
        ListEmptyComponent={ListEmptyComponent}
        refreshControl={refreshControl}
        ListHeaderComponent={
          ListHeaderComponent ? (
            <View>
              {ListHeaderComponent}
              <View
                style={{
                  flexDirection: "row",
                  justifyContent: "flex-end",
                  paddingHorizontal: 4,
                  marginBottom: 12,
                  gap: 8,
                }}
              >
                <Pressable
                  onPress={() => setIsEditMode(!isEditMode)}
                  style={({ pressed }) => ({
                    paddingVertical: 10,
                    paddingHorizontal: 16,
                    borderRadius: 8,
                    backgroundColor: isEditMode ? colors.primary : colors.surface,
                    borderWidth: isEditMode ? 0 : 1,
                    borderColor: colors.border,
                    opacity: pressed ? 0.7 : 1,
                  })}
                >
                  <Text
                    style={{
                      color: isEditMode ? "white" : colors.foreground,
                      fontSize: 14,
                      fontWeight: "600",
                    }}
                  >
                    {isEditMode ? "✓ Done" : "✎ Reorder"}
                  </Text>
                </Pressable>
                {hasCustomOrder && (
                  <Pressable
                    onPress={onReset}
                    style={({ pressed }) => ({
                      paddingVertical: 10,
                      paddingHorizontal: 16,
                      borderRadius: 8,
                      backgroundColor: colors.surface,
                      borderWidth: 1,
                      borderColor: colors.error,
                      opacity: pressed ? 0.7 : 1,
                    })}
                  >
                    <Text
                      style={{
                        color: colors.error,
                        fontSize: 14,
                        fontWeight: "600",
                      }}
                    >
                      ↻ Reset
                    </Text>
                  </Pressable>
                )}
              </View>
            </View>
          ) : null
        }
      />
    </View>
  );
}
