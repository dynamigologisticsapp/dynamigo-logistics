import { useState } from "react";
import { View, Text, Pressable, ScrollView } from "react-native";

import { useColors } from "@/hooks/use-colors";
import { cn } from "@/lib/utils";

export interface HistoryItem {
  id: string;
  changeType: "reorder" | "reset";
  createdAt: Date;
}

export interface HistoryPanelProps {
  history: HistoryItem[];
  onRevert: (historyId: string) => void;
  isLoading?: boolean;
}

export function HistoryPanel({ history, onRevert, isLoading = false }: HistoryPanelProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const colors = useColors();

  if (!history || history.length === 0) {
    return null;
  }

  const formatTime = (date: Date) => {
    const d = new Date(date);
    return d.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit", second: "2-digit" });
  };

  const getChangeTypeLabel = (changeType: "reorder" | "reset") => {
    return changeType === "reorder" ? "Route Reordered" : "Route Reset";
  };

  return (
    <View className="border-t border-border bg-surface">
      <Pressable
        onPress={() => setIsExpanded(!isExpanded)}
        style={({ pressed }) => [{ opacity: pressed ? 0.7 : 1 }]}
        className="flex-row items-center justify-between px-4 py-3"
      >
        <View className="flex-row items-center gap-2">
          <Text className="text-sm font-semibold text-foreground">Route History</Text>
          <Text className="text-xs text-muted">({history.length})</Text>
        </View>
        <Text className="text-lg text-foreground">{isExpanded ? "▼" : "▶"}</Text>
      </Pressable>

      {isExpanded && (
        <ScrollView className="max-h-64 border-t border-border">
          {history.map((item, index) => (
            <View key={item.id} className="border-b border-border px-4 py-3 last:border-b-0">
              <View className="flex-row items-center justify-between gap-2">
                <View className="flex-1">
                  <Text className="text-sm font-medium text-foreground">
                    {getChangeTypeLabel(item.changeType)}
                  </Text>
                  <Text className="text-xs text-muted mt-1">
                    {formatTime(item.createdAt)}
                  </Text>
                </View>
                <Pressable
                  onPress={() => onRevert(item.id)}
                  disabled={isLoading}
                  style={({ pressed }) => [{ opacity: pressed ? 0.7 : 1 }]}
                  className={cn(
                    "px-3 py-2 rounded-lg",
                    isLoading ? "bg-muted opacity-50" : "bg-primary"
                  )}
                >
                  <Text className="text-xs font-semibold text-background">
                    {isLoading ? "Reverting..." : "Revert"}
                  </Text>
                </Pressable>
              </View>
            </View>
          ))}
        </ScrollView>
      )}
    </View>
  );
}
