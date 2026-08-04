import { Alert, Image, Modal, Platform, Pressable, ScrollView, Text, View, StyleSheet } from "react-native";
import { useState } from "react";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { ScreenContainer } from "@/components/screen-container";
import { useRouteDate } from "@/lib/route-date-context";
import { useEnhancedRoute } from "@/lib/use-enhanced-route";
import { trpc } from "@/lib/trpc";
import { getTownLabel, type JobRecord } from "@/shared/route-planner";
const capitalize = (str: string) => str.charAt(0).toUpperCase() + str.slice(1);

function CompletedJobPhoto({ uri }: { uri?: string }) {
  const [isOpen, setIsOpen] = useState(false);
  if (!uri) return null;

  return (
    <>
      <Pressable onPress={() => setIsOpen(true)} style={({ pressed }) => [styles.photoButton, pressed && { opacity: 0.75 }]}>
        <Image source={{ uri }} style={styles.photoImage} />
      </Pressable>
      <Modal visible={isOpen} transparent animationType="fade" onRequestClose={() => setIsOpen(false)}>
        <Pressable style={styles.photoModalBackdrop} onPress={() => setIsOpen(false)}>
          <Image source={{ uri }} resizeMode="contain" style={styles.photoModalImage} />
          <Text style={styles.photoModalClose}>Tap anywhere to close</Text>
        </Pressable>
      </Modal>
    </>
  );
}

export default function CompletedScreen() {
  const insets = useSafeAreaInsets();
  const {
    selectedDate: dateKey,
    setIsRouteStale,
    includeHelper,
    returnToUnit,
    setCommittedIncludeHelper,
    setCommittedReturnToUnit,
    setCustomRouteOrder,
    clearCompletedRouteStops,
  } = useRouteDate();
  const utils = trpc.useUtils();
  const enhancedRouteQuery = useEnhancedRoute();

  const snapshotQuery = trpc.operations.snapshot.useQuery({ dateKey });
  const snapshot = snapshotQuery.data;
  
  const completedJobs = (snapshot?.jobs.filter(j => j.status === 'completed') || []) as JobRecord[];
  const completedJobsQuery = {
    isLoading: snapshotQuery.isLoading,
    error: snapshotQuery.error,
    data: completedJobs,
  };

  const recalculateRouteAfterJobChange = async () => {
    setCommittedIncludeHelper(includeHelper);
    setCommittedReturnToUnit(returnToUnit);
    setCustomRouteOrder(null);
    clearCompletedRouteStops();
    await utils.operations.snapshot.invalidate({ dateKey });
    await utils.operations.enhancedRoutePlan.fetch({ dateKey, includeHelper, returnToUnit });
    await enhancedRouteQuery.refetch();
    setIsRouteStale(false);
  };

  const restoreJobMutation = trpc.operations.updateJob.useMutation({
    onSuccess: async () => {
      await recalculateRouteAfterJobChange();
    },
  });
  const deleteJobMutation = trpc.operations.deleteJob.useMutation({
    onSuccess: async () => {
      await recalculateRouteAfterJobChange();
    },
  });

  const restoreJob = (job: JobRecord) => {
    restoreJobMutation.mutate({
      id: job.id,
      status: "scheduled",
      scheduledDay: dateKey,
    });
  };

  const deleteJob = (job: JobRecord) => {
    const runDelete = () => {
      deleteJobMutation.mutate({ id: job.id, dateKey });
    };

    if (Platform.OS === "web") {
      const confirmed =
        typeof window === "undefined" ||
        window.confirm(`Delete ${job.customerName}? This permanently removes the completed job.`);
      if (confirmed) runDelete();
      return;
    }

    Alert.alert("Delete completed job", `Are you sure you want to delete ${job.customerName}?`, [
      { text: "Cancel", style: "cancel" },
      { text: "Delete", style: "destructive", onPress: runDelete },
    ]);
  };

  return (
    <ScreenContainer className="bg-background" edges={["top", "left", "right"]}>
      <ScrollView
        contentContainerStyle={{
          paddingHorizontal: 20,
          paddingTop: 16,
          // SafeAreaView already handles the top inset. Keep bottom content
          // above the tab bar and iPhone home indicator.
          paddingBottom: Math.max(insets.bottom, 12) + 104,
          gap: 16,
        }}
      >
        <View style={styles.heroCard}>
          <Text style={styles.eyebrow}>Dynamigo Logistics</Text>
          <Text style={styles.heroTitle}>Completed Stops</Text>
          <Text style={styles.heroText}>
            Jobs marked as complete for today. Restore one if it was completed by mistake.
          </Text>
          <View style={styles.metricRow}>
            <View style={styles.metricBox}>
              <Text style={styles.metricValue}>{completedJobs.length}</Text>
              <Text style={styles.metricLabel}>Completed</Text>
            </View>
          </View>
        </View>

        {completedJobsQuery.isLoading && !completedJobs.length ? (
          <View style={styles.infoBanner}>
            <Text style={styles.infoBannerText}>Loading completed jobs...</Text>
          </View>
        ) : null}

        {completedJobsQuery.error ? (
          <View style={styles.errorBanner}>
            <Text style={styles.errorBannerText}>Failed to load completed jobs.</Text>
          </View>
        ) : null}

        {completedJobs.length === 0 ? (
          <View style={styles.infoBanner}>
            <Text style={styles.infoBannerText}>No completed jobs yet for this day.</Text>
          </View>
        ) : (
          <View>
            <View style={styles.jobsList}>
              {completedJobs.map((job) => (
                <View key={job.id} style={styles.completedJobCard}>
                  <View style={styles.jobHeader}>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.jobTitle}>{job.customerName}</Text>
                      <Text style={styles.jobMeta}>
                        {job.type === "both" ? "Pickup & Delivery" : capitalize(job.type)} · {job.townId ? getTownLabel(job.townId) : "Unknown town"}
                      </Text>
                    </View>
                    <View style={styles.completeBadge}>
                      <Text style={styles.completeBadgeText}>✓</Text>
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
                  <View style={styles.jobBottomRow}>
                    <View style={{ flex: 1 }}>
                      {job.notes ? <Text style={styles.jobNotes}>{job.notes}</Text> : null}
                    </View>
                    <CompletedJobPhoto uri={job.photoUri} />
                  </View>
                  <Pressable
                    onPress={() => restoreJob(job)}
                    disabled={restoreJobMutation.isPending}
                    style={({ pressed }) => [
                      styles.restoreButton,
                      (pressed || restoreJobMutation.isPending) && styles.restoreButtonPressed,
                    ]}
                  >
                    <Text style={styles.restoreButtonText}>
                      {restoreJobMutation.isPending ? "Restoring..." : "Restore to scheduled"}
                    </Text>
                  </Pressable>
                  <Pressable
                    onPress={() => deleteJob(job)}
                    disabled={deleteJobMutation.isPending}
                    style={({ pressed }) => [
                      styles.deleteButton,
                      (pressed || deleteJobMutation.isPending) && styles.restoreButtonPressed,
                    ]}
                  >
                    <Text style={styles.deleteButtonText}>
                      {deleteJobMutation.isPending ? "Deleting..." : "Delete"}
                    </Text>
                  </Pressable>
                </View>
              ))}
            </View>
          </View>
        )}
      </ScrollView>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  infoBanner: {
    backgroundColor: "rgba(30, 58, 138, 0.15)",
    borderRadius: 12,
    padding: 12,
    borderLeftWidth: 4,
    borderLeftColor: "#3b82f6",
  },
  infoBannerText: {
    color: "#93c5fd",
    fontSize: 14,
    fontWeight: "600",
  },
  errorBanner: {
    backgroundColor: "rgba(127, 29, 29, 0.15)",
    borderRadius: 12,
    padding: 12,
    borderLeftWidth: 4,
    borderLeftColor: "#ef4444",
  },
  errorBannerText: {
    color: "#fca5a5",
    fontSize: 14,
    fontWeight: "600",
  },
  heroCard: {
    backgroundColor: "#0f172a",
    borderRadius: 28,
    padding: 20,
    gap: 12,
    borderWidth: 1,
    borderColor: "#334155",
  },
  eyebrow: {
    color: "#DDE7FF",
    fontSize: 13,
    fontWeight: "600",
  },
  heroTitle: {
    color: "#FFFFFF",
    fontSize: 28,
    lineHeight: 34,
    fontWeight: "800",
  },
  heroText: {
    color: "#E9EEFF",
    fontSize: 15,
    lineHeight: 22,
  },
  metricRow: {
    flexDirection: "row",
    gap: 12,
  },
  metricBox: {
    flex: 1,
    backgroundColor: "rgba(255, 255, 255, 0.2)",
    borderRadius: 12,
    padding: 12,
    alignItems: "center",
  },
  metricValue: {
    color: "#FFFFFF",
    fontSize: 24,
    fontWeight: "800",
  },
  metricLabel: {
    color: "#DDE7FF",
    fontSize: 12,
    fontWeight: "600",
  },
  jobsList: {
    gap: 12,
  },
  completedJobCard: {
    backgroundColor: "#1e293b",
    borderRadius: 16,
    padding: 14,
    borderLeftWidth: 4,
    borderLeftColor: "#10b981",
    gap: 8,
    borderWidth: 1,
    borderColor: "#334155",
  },
  jobHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
  },
  jobTitle: {
    fontSize: 16,
    fontWeight: "700",
    color: "#f1f5f9",
  },
  jobMeta: {
    fontSize: 12,
    color: "#94a3b8",
    marginTop: 2,
  },
  completeBadge: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: "rgba(16, 185, 129, 0.2)",
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#10b981",
  },
  completeBadgeText: {
    color: "#10b981",
    fontSize: 18,
    fontWeight: "800",
  },
  jobAddress: {
    fontSize: 13,
    color: "#cbd5e1",
  },
  jobDetails: {
    fontSize: 13,
    color: "#e2e8f0",
    fontWeight: "600",
  },
  jobNotes: {
    fontSize: 12,
    color: "#607086",
    fontStyle: "italic",
  },
  jobBottomRow: {
    flexDirection: "row",
    alignItems: "flex-end",
    gap: 12,
  },
  photoButton: {
    width: 76,
    height: 76,
    borderRadius: 12,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: "#334155",
    backgroundColor: "#111827",
  },
  photoImage: {
    width: "100%",
    height: "100%",
  },
  photoModalBackdrop: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.9)",
    alignItems: "center",
    justifyContent: "center",
    padding: 20,
  },
  photoModalImage: {
    width: "100%",
    height: "82%",
  },
  photoModalClose: {
    marginTop: 16,
    color: "#FFFFFF",
    fontSize: 14,
    fontWeight: "700",
  },
  restoreButton: {
    marginTop: 4,
    alignSelf: "flex-start",
    backgroundColor: "#0f766e",
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 9,
  },
  restoreButtonPressed: {
    opacity: 0.7,
  },
  restoreButtonText: {
    color: "#ffffff",
    fontSize: 13,
    fontWeight: "700",
  },
  deleteButton: {
    marginTop: 8,
    alignSelf: "flex-start",
    backgroundColor: "rgba(239, 68, 68, 0.16)",
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "rgba(248, 113, 113, 0.45)",
    paddingHorizontal: 12,
    paddingVertical: 9,
  },
  deleteButtonText: {
    color: "#fecaca",
    fontSize: 13,
    fontWeight: "700",
  },
});
