import React, { useMemo } from "react";
import { StyleSheet, Text, View } from "react-native";
import { useStopStatus } from "@/lib/stop-status-context";

interface RouteProgressProps {
  totalStops?: number;
  stops?: Array<{ id: string; type?: string; kind?: string }>;
}

export default function RouteProgress({ totalStops, stops }: RouteProgressProps) {
  const { statuses } = useStopStatus();

  const progress = useMemo(() => {
    // Only customer job stops count toward completion progress.
    const jobStops = stops
      ? stops.filter((stop) => stop.kind === "job")
      : [];
    const jobCount = jobStops.length || totalStops || 0;

    if (!statuses || jobCount === 0) {
      return { completed: 0, remaining: jobCount, percentage: 0 };
    }

    // Count completed jobs (excluding helpers and units)
    const completedCount = jobStops.filter(
      (stop) => statuses[stop.id] === "completed"
    ).length;

    return {
      completed: completedCount,
      remaining: jobCount - completedCount,
      percentage: jobCount > 0 ? Math.round((completedCount / jobCount) * 100) : 0,
    };
  }, [statuses, stops, totalStops]);

  return (
    <View style={styles.card}>
      <View style={styles.header}>
        <Text style={styles.title}>Route Progress</Text>
        <Text style={styles.percent}>{progress.percentage}%</Text>
      </View>

      <View style={styles.barTrack}>
        <View
          style={[
            styles.barFill,
            {
              width: `${progress.percentage}%`,
            },
          ]}
        />
      </View>

      <View style={styles.statsRow}>
        <View style={styles.stat}>
          <Text style={styles.statLabel}>Completed</Text>
          <Text style={[styles.statValue, styles.completedValue]}>
            {progress.completed}
          </Text>
        </View>

        <View style={styles.stat}>
          <Text style={styles.statLabel}>Remaining</Text>
          <Text style={[styles.statValue, styles.remainingValue]}>
            {progress.remaining}
          </Text>
        </View>

        <View style={styles.stat}>
          <Text style={styles.statLabel}>Total</Text>
          <Text style={[styles.statValue, styles.totalValue]}>
            {progress.completed + progress.remaining}
          </Text>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: "rgba(148, 163, 184, 0.14)",
    borderRadius: 12,
    padding: 8,
    borderWidth: 1,
    borderColor: "#334155",
  },
  header: {
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 5,
  },
  title: {
    color: "#F8FAFC",
    fontSize: 14,
    fontWeight: "800",
    lineHeight: 18,
  },
  percent: {
    color: "#38BDF8",
    fontSize: 18,
    fontWeight: "800",
    lineHeight: 22,
  },
  barTrack: {
    backgroundColor: "rgba(203, 213, 225, 0.18)",
    borderRadius: 999,
    height: 4,
    marginBottom: 7,
    overflow: "hidden",
    width: "100%",
  },
  barFill: {
    backgroundColor: "#38BDF8",
    borderRadius: 999,
    height: "100%",
  },
  statsRow: {
    flexDirection: "row",
    justifyContent: "space-between",
  },
  stat: {
    alignItems: "center",
    flex: 1,
  },
  statLabel: {
    color: "#CBD5E1",
    fontSize: 10,
    fontWeight: "600",
    lineHeight: 13,
    marginBottom: 1,
  },
  statValue: {
    fontSize: 16,
    fontWeight: "800",
    lineHeight: 20,
  },
  completedValue: {
    color: "#32B771",
  },
  remainingValue: {
    color: "#F59E0B",
  },
  totalValue: {
    color: "#F8FAFC",
  },
});
