import { ActivityIndicator, Pressable, ScrollView, Text, View } from "react-native";
import { useMemo } from "react";
import { Stack, router, useLocalSearchParams } from "expo-router";

import { ScreenContainer } from "@/components/screen-container";
import { trpc } from "@/lib/trpc";
import { getTownLabel, todayKey } from "@/shared/route-planner";
import { getNonJobStopGuidance, getStopTitle, isActionableJobStop } from "@/shared/stop-presentation";
import { useColors } from "@/hooks/use-colors";
import { useStopStatus } from "@/lib/stop-status-context";
import { PhotoCapture } from "@/components/photo-capture";
import { usePhotos } from "@/lib/photo-context";

export default function StopDetailScreen() {
  const colors = useColors();
  const { getStopStatus, setStopStatus } = useStopStatus();
  const { getPhotosByStop } = usePhotos();
  const params = useLocalSearchParams<{ stopId?: string; dateKey?: string }>();
  const stopId = typeof params.stopId === "string" ? params.stopId : "";
  const dateKey = typeof params.dateKey === "string" ? params.dateKey : todayKey();
  const currentStatus = getStopStatus(stopId);

  const snapshotQuery = trpc.operations.snapshot.useQuery(
    { dateKey },
    {
      refetchInterval: 12000,
      retry: 1,
    },
  );

  const completeMutation = trpc.operations.completeJob.useMutation({
    onSuccess: async () => {
      await snapshotQuery.refetch();
      router.back();
    },
  });

  const snapshot = snapshotQuery.data;
  const stop = useMemo(() => snapshot?.routePlan.stops.find((item) => item.id === stopId) ?? null, [snapshot, stopId]);
  const job = useMemo(() => {
    if (!stop?.relatedJobId) return null;
    return snapshot?.todaysJobs.find((item) => item.id === stop.relatedJobId) ?? null;
  }, [snapshot, stop]);
  const isActionableJob = isActionableJobStop(stop, job?.status);

  if (snapshotQuery.isLoading && !snapshot) {
    return (
      <ScreenContainer className="items-center justify-center px-6">
        <ActivityIndicator size="large" color={colors.primary} />
        <Text className="mt-4 text-base text-muted text-center">Loading stop details.</Text>
      </ScreenContainer>
    );
  }

  if (!stop) {
    return (
      <ScreenContainer className="px-5 pt-4">
        <Stack.Screen options={{ title: "Stop detail", headerShown: false }} />
        <View className="rounded-[28px] border border-border bg-surface p-5">
          <Text className="text-xl font-bold text-foreground">Stop not found</Text>
          <Text className="mt-3 text-sm leading-6 text-muted">
            This stop may have moved because the route was updated. Go back to the route list and open the latest stop card.
          </Text>
          <Pressable
            onPress={() => router.back()}
            style={({ pressed }) => ({
              marginTop: 18,
              borderRadius: 999,
              backgroundColor: colors.primary,
              paddingHorizontal: 18,
              paddingVertical: 14,
              opacity: pressed ? 0.85 : 1,
            })}
          >
            <Text className="text-center text-sm font-semibold text-white">Back to route</Text>
          </Pressable>
        </View>
      </ScreenContainer>
    );
  }

  return (
    <ScreenContainer className="px-5 pt-4">
      <Stack.Screen options={{ title: stop.label, headerShown: false }} />
      <ScrollView contentContainerStyle={{ paddingBottom: 32, gap: 16 }}>
        <View className="rounded-[30px] bg-primary px-5 py-5">
          <Text className="text-sm font-semibold uppercase tracking-wide text-white/75">{getStopTitle(stop.kind, stop.type)}</Text>
          <Text className="mt-2 text-3xl font-bold text-white">{stop.label}</Text>
          <Text className="mt-2 text-sm leading-6 text-white/80">{stop.addressLine}</Text>
          <View className="mt-4 flex-row flex-wrap gap-2">
            <View className="rounded-full bg-white/15 px-3 py-2">
              <Text className="text-xs font-medium text-white">{getTownLabel(stop.townId)}</Text>
            </View>
            <View className="rounded-full bg-white/15 px-3 py-2">
              <Text className="text-xs font-medium text-white">ETA +{stop.etaMinutesFromStart} min</Text>
            </View>
            <View className="rounded-full bg-white/15 px-3 py-2">
              <Text className="text-xs font-medium text-white">Load {stop.loadBefore} → {stop.loadAfter}</Text>
            </View>
          </View>
        </View>

        <View className="rounded-[28px] border border-border bg-surface p-5">
          <Text className="text-xs font-semibold uppercase tracking-wide text-muted">Operational guidance</Text>
          <Text className="mt-3 text-base leading-7 text-foreground">{stop.reason}</Text>
          <Text className="mt-4 text-sm leading-6 text-muted">
            Drive time from previous stop: {stop.travelMinutesFromPrevious} minutes. Planned on-site time: {stop.serviceMinutes} minutes.
          </Text>
          {stop.kind !== "job" ? (
            <Text className="mt-4 text-sm leading-6 text-muted">
              {getNonJobStopGuidance(stop.kind).body}
            </Text>
          ) : null}
        </View>

        {job ? (
          <View className="rounded-[28px] border border-border bg-surface p-5">
            <Text className="text-xs font-semibold uppercase tracking-wide text-muted">Customer detail</Text>
            <Text className="mt-3 text-lg font-semibold text-foreground">{job.customerName}</Text>
            <Text className="mt-2 text-sm text-muted">{job.contactName} · {job.contactPhone}</Text>
            <Text className="mt-2 text-sm text-muted">Window: {job.timeWindow}</Text>
            <Text className="mt-2 text-sm text-muted">Status: {job.status}</Text>
            <Text className="mt-4 text-sm leading-6 text-foreground">
              {job.notes || "No extra access notes were added for this stop."}
            </Text>
          </View>
        ) : null}

        {/* Photo Capture */}
        <View className="rounded-[28px] border border-border bg-surface p-5">
          <PhotoCapture stopId={stopId} stopLabel={stop.label} />
        </View>

        {/* Stop status buttons */}
        <View className="gap-3">
          <Text className="text-xs font-semibold uppercase tracking-wide text-muted">Stop Status</Text>
          <View className="flex-row gap-2">
            <Pressable
              onPress={() => setStopStatus(stopId, "pending")}
              style={({ pressed }) => ({
                flex: 1,
                borderRadius: 8,
                backgroundColor: currentStatus === "pending" ? "#9CA3AF" : "#E5E7EB",
                paddingHorizontal: 12,
                paddingVertical: 10,
                opacity: pressed ? 0.85 : 1,
              })}
            >
              <Text className="text-center text-xs font-semibold" style={{ color: currentStatus === "pending" ? "white" : "#6B7280" }}>
                Pending
              </Text>
            </Pressable>
            <Pressable
              onPress={() => setStopStatus(stopId, "in-progress")}
              style={({ pressed }) => ({
                flex: 1,
                borderRadius: 8,
                backgroundColor: currentStatus === "in-progress" ? "#FBBF24" : "#FEF3C7",
                paddingHorizontal: 12,
                paddingVertical: 10,
                opacity: pressed ? 0.85 : 1,
              })}
            >
              <Text className="text-center text-xs font-semibold" style={{ color: currentStatus === "in-progress" ? "white" : "#92400E" }}>
                In Progress
              </Text>
            </Pressable>
            <Pressable
              onPress={() => {
                const hasPhotos = getPhotosByStop(stopId).length > 0;
                if (hasPhotos) {
                  setStopStatus(stopId, "completed");
                }
              }}
              style={({ pressed }) => {
                const hasPhotos = getPhotosByStop(stopId).length > 0;
                return {
                  flex: 1,
                  borderRadius: 8,
                  backgroundColor: currentStatus === "completed" ? "#34D399" : "#D1FAE5",
                  paddingHorizontal: 12,
                  paddingVertical: 10,
                  opacity: (pressed && hasPhotos) ? 0.85 : 1,
                };
              }}
              disabled={getPhotosByStop(stopId).length === 0}
            >
              <Text className="text-center text-xs font-semibold" style={{ color: currentStatus === "completed" ? "white" : "#065F46" }}>
                Completed
              </Text>
            </Pressable>
          </View>
        </View>

        {isActionableJob ? (
          <Pressable
            onPress={() => {
              const hasPhotos = getPhotosByStop(stopId).length > 0;
              if (hasPhotos) {
                completeMutation.mutate({ id: stop.relatedJobId!, dateKey });
              }
            }}
            style={({ pressed }) => {
              const hasPhotos = getPhotosByStop(stopId).length > 0;
              return {
                borderRadius: 999,
                backgroundColor: hasPhotos ? colors.success : "#D1D5DB",
                paddingHorizontal: 18,
                paddingVertical: 15,
                opacity: (pressed && hasPhotos) ? 0.85 : 1,
                transform: [{ scale: (pressed && hasPhotos) ? 0.985 : 1 }],
              };
            }}
            disabled={completeMutation.isPending || getPhotosByStop(stopId).length === 0}
          >
            <Text className="text-center text-sm font-semibold" style={{ color: getPhotosByStop(stopId).length === 0 ? "#9CA3AF" : "white" }}>
              {completeMutation.isPending
                ? "Completing stop…"
                : getPhotosByStop(stopId).length === 0
                ? "Take a photo first"
                : stop.type === "pickup"
                  ? "Complete pickup stop"
                  : "Complete delivery stop"}
            </Text>
          </Pressable>
        ) : null}

        <Pressable
          onPress={() => router.back()}
          style={({ pressed }) => ({
            borderRadius: 999,
            borderWidth: 1,
            borderColor: colors.border,
            paddingHorizontal: 18,
            paddingVertical: 14,
            opacity: pressed ? 0.7 : 1,
          })}
        >
          <Text className="text-center text-sm font-semibold text-foreground">Back to route</Text>
        </Pressable>
      </ScrollView>
    </ScreenContainer>
  );
}
