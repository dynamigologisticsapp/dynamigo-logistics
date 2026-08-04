import { View, Text, Pressable, StyleSheet, Animated } from "react-native";
import { JobRecord, getTownLabel } from "@/shared/route-planner";
import { useState, useRef } from "react";

const capitalize = (str: string) => str.charAt(0).toUpperCase() + str.slice(1);

interface SwipeableJobCardProps {
  job: JobRecord;
  onMarkComplete: (job: JobRecord) => Promise<void>;
  onEdit?: (job: JobRecord) => void;
  isLoading?: boolean;
}

export function SwipeableJobCard({ job, onMarkComplete, onEdit, isLoading }: SwipeableJobCardProps) {
  const [swiped, setSwiped] = useState(false);
  const swipeAnim = useRef(new Animated.Value(0)).current;
  const [isMarking, setIsMarking] = useState(false);

  const handleSwipeComplete = async () => {
    setIsMarking(true);
    try {
      await onMarkComplete(job);
      setSwiped(true);
      Animated.timing(swipeAnim, {
        toValue: 1,
        duration: 300,
        useNativeDriver: false,
      }).start();
    } catch (error) {
      console.error("Failed to mark complete:", error);
      setSwiped(false);
    } finally {
      setIsMarking(false);
    }
  };

  const handleUndo = async () => {
    setSwiped(false);
    Animated.timing(swipeAnim, {
      toValue: 0,
      duration: 300,
      useNativeDriver: false,
    }).start();
  };

  const opacity = swipeAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [1, 0.5],
  });

  const backgroundColor = swipeAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ["#FFFFFF", "#E8F5E9"],
  });

  if (swiped) {
    return (
      <Animated.View style={[styles.completedCard, { backgroundColor }]}>
        <View style={styles.completedContent}>
          <View style={styles.checkmark}>
            <Text style={styles.checkmarkText}>✓</Text>
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.completedTitle}>{job.customerName}</Text>
            <Text style={styles.completedMeta}>Marked complete</Text>
          </View>
          <Pressable onPress={handleUndo} style={styles.undoButton}>
            <Text style={styles.undoText}>Undo</Text>
          </Pressable>
        </View>
      </Animated.View>
    );
  }

  return (
    <View style={styles.container}>
      <Pressable
        onLongPress={handleSwipeComplete}
        style={({ pressed }) => [
          styles.jobCard,
          pressed && styles.jobCardPressed,
          isMarking && styles.jobCardLoading,
        ]}
      >
        <View style={styles.jobHeader}>
          <View style={{ flex: 1 }}>
            <Text style={styles.jobTitle}>{job.customerName}</Text>
            <Text style={styles.jobMeta}>
              {job.type === "both" ? "Pickup & Delivery" : capitalize(job.type)} · {job.townId ? getTownLabel(job.townId) : "Unknown town"} · {job.timeWindow}
            </Text>
          </View>
        </View>
        <Text style={styles.jobAddress}>{job.addressLine}</Text>
        <Text style={styles.jobDetails}>
          {job.type === "pickup"
            ? `Pickup: ${job.sofaCount} sofas`
            : job.type === "delivery"
              ? `Delivery: ${job.sofaCount} sofas`
              : `Delivery: ${job.sofaCount} sofas, Pickup: ${job.pickupCount} sofas`}
        </Text>
        {job.notes ? <Text style={styles.jobNotes}>{job.notes}</Text> : null}

        <View style={styles.actionRow}>
          <Pressable
            style={({ pressed }) => [styles.completeButton, pressed && styles.buttonPressed, isMarking && styles.buttonDisabled]}
            onPress={handleSwipeComplete}
            disabled={isMarking}
          >
            <Text style={styles.completeButtonText}>{isMarking ? "Marking..." : "✓ Mark Complete"}</Text>
          </Pressable>
          {onEdit ? (
            <Pressable style={({ pressed }) => [styles.editButton, pressed && styles.buttonPressed]} onPress={() => onEdit(job)}>
              <Text style={styles.editButtonText}>Edit</Text>
            </Pressable>
          ) : null}
        </View>

        <Text style={styles.hintText}>Long press or tap button to mark complete</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginBottom: 12,
  },
  jobCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 16,
    padding: 14,
    borderWidth: 1,
    borderColor: "#D8E1EC",
    gap: 8,
  },
  jobCardPressed: {
    opacity: 0.8,
    backgroundColor: "#F9FAFB",
  },
  jobCardLoading: {
    opacity: 0.6,
  },
  jobHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
  },
  jobTitle: {
    fontSize: 16,
    fontWeight: "700",
    color: "#10233D",
  },
  jobMeta: {
    fontSize: 12,
    color: "#607086",
    marginTop: 2,
  },
  jobAddress: {
    fontSize: 13,
    color: "#607086",
  },
  jobDetails: {
    fontSize: 13,
    color: "#10233D",
    fontWeight: "600",
  },
  jobNotes: {
    fontSize: 12,
    color: "#607086",
    fontStyle: "italic",
  },
  actionRow: {
    flexDirection: "row",
    gap: 10,
    marginTop: 8,
  },
  completeButton: {
    flex: 1,
    backgroundColor: "#22C55E",
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
  },
  editButton: {
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 10,
    backgroundColor: "#F4F7FB",
    borderWidth: 1,
    borderColor: "#D8E1EC",
    alignItems: "center",
    justifyContent: "center",
    minWidth: 60,
  },
  completeButtonText: {
    color: "#FFFFFF",
    fontWeight: "600",
    fontSize: 13,
  },
  editButtonText: {
    color: "#10233D",
    fontWeight: "600",
    fontSize: 13,
  },
  buttonPressed: {
    opacity: 0.7,
  },
  buttonDisabled: {
    opacity: 0.5,
  },
  hintText: {
    fontSize: 11,
    color: "#9CA3AF",
    marginTop: 4,
    fontStyle: "italic",
  },
  completedCard: {
    backgroundColor: "#E8F5E9",
    borderRadius: 16,
    padding: 14,
    borderLeftWidth: 4,
    borderLeftColor: "#22C55E",
  },
  completedContent: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  checkmark: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "#22C55E",
    justifyContent: "center",
    alignItems: "center",
  },
  checkmarkText: {
    color: "#FFFFFF",
    fontSize: 20,
    fontWeight: "800",
  },
  completedTitle: {
    fontSize: 14,
    fontWeight: "700",
    color: "#10233D",
  },
  completedMeta: {
    fontSize: 12,
    color: "#607086",
    marginTop: 2,
  },
  undoButton: {
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: 8,
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#D8E1EC",
  },
  undoText: {
    fontSize: 12,
    color: "#10233D",
    fontWeight: "600",
  },
});
