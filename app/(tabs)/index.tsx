import { trpc } from "@/lib/trpc";

import { ScreenContainer } from "@/components/screen-container";
import { calculateLiveVanLoad, getTownLabel, type JobRecord, type OperationsSnapshot, type RouteStop } from "@/shared/route-planner";
import { getNonJobStopGuidance, isActionableJobStop } from "@/shared/stop-presentation";
import { useColors } from "@/hooks/use-colors";
import { DraggableRouteList } from "@/components/draggable-route-list";
import { HistoryPanel } from "@/components/history-panel";
import { useEffect, useMemo, useState } from "react";
import { useRouteDate } from "@/lib/route-date-context";
import { useEnhancedRoute } from "@/lib/use-enhanced-route";
import { formatDateParts, parseDateKey, todayDateKey } from "@/lib/date-key";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import {
  ActivityIndicator,
  Image,
  Linking,
  Modal,
  Pressable,
  RefreshControl,
  ScrollView,
  Text,
  View,
} from "react-native";

function getTodayKey() {
  return todayDateKey();
}

function minutesToTimeLabel(totalMinutes: number, workdayStart: string = "08:30") {
  const [workdayHours, workdayMinutes] = workdayStart.split(':').map(Number);
  const startMinutes = workdayHours * 60 + workdayMinutes + totalMinutes;
  const wrappedMinutes = ((startMinutes % 1440) + 1440) % 1440;
  const hours = Math.floor(wrappedMinutes / 60);
  const minutes = wrappedMinutes % 60;
  return `${hours.toString().padStart(2, "0")}:${minutes.toString().padStart(2, "0")}`;
}

function timeToMinutes(time: string) {
  const [hours = 0, minutes = 0] = time.split(":").map(Number);
  return hours * 60 + minutes;
}

function absoluteMinutesToTimeLabel(totalMinutes: number) {
  const wrappedMinutes = ((Math.round(totalMinutes) % 1440) + 1440) % 1440;
  const hours = Math.floor(wrappedMinutes / 60);
  const minutes = wrappedMinutes % 60;
  return `${hours.toString().padStart(2, "0")}:${minutes.toString().padStart(2, "0")}`;
}

function routeStopTimeLabel(stop: RouteStop, workdayStart: string, isAbsoluteRoute: boolean) {
  const arrivalValue = stop.etaMinutesFromStart - stop.serviceMinutes;
  return isAbsoluteRoute ? absoluteMinutesToTimeLabel(arrivalValue) : minutesToTimeLabel(arrivalValue, workdayStart);
}

function getStopTypeLabel(stop: RouteStop) {
  if (stop.kind === "start") return "Driver start";
  if (stop.kind === "helper") return "Helper pickup";
  if (stop.kind === "helper-dropoff") return "Helper drop-off";
  if (stop.kind === "home") return "Home";
  if (stop.kind === "unit") return "Unit return";
  return stop.type === "pickup" ? "Pickup" : "Delivery";
}

const START_TIME_OPTIONS = ["06:00", "06:30", "07:00", "07:30", "08:00", "08:30", "09:00", "09:30", "10:00"];
const END_TIME_OPTIONS = ["15:00", "15:30", "16:00", "16:30", "17:00", "17:30", "18:00", "18:30", "19:00", "20:00"];

function callPhoneNumber(phoneNumber: string) {
  const normalized = phoneNumber.replace(/[^\d+]/g, "");
  if (!normalized) return;
  Linking.openURL(`tel:${normalized}`).catch(() => {
    console.error("Failed to start phone call");
  });
}

function openDirections(stop: RouteStop) {
  const destination = stop.latitude && stop.longitude
    ? `${stop.latitude},${stop.longitude}`
    : stop.addressLine;
  if (!destination) return;

  const url = `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(destination)}&travelmode=driving`;
  Linking.openURL(url).catch(() => {
    console.error("Failed to open directions");
  });
}

function JobPhotoPreview({ uri }: { uri?: string }) {
  const [isOpen, setIsOpen] = useState(false);
  if (!uri) return null;

  return (
    <>
      <Pressable
        onPress={() => setIsOpen(true)}
        style={({ pressed }) => ({
          width: 76,
          height: 76,
          borderRadius: 12,
          overflow: "hidden",
          borderWidth: 1,
          borderColor: "#334155",
          backgroundColor: "#111827",
          opacity: pressed ? 0.75 : 1,
        })}
      >
        <Image source={{ uri }} style={{ width: "100%", height: "100%" }} />
      </Pressable>
      <Modal visible={isOpen} transparent animationType="fade" onRequestClose={() => setIsOpen(false)}>
        <Pressable
          onPress={() => setIsOpen(false)}
          style={{
            flex: 1,
            backgroundColor: "rgba(0, 0, 0, 0.9)",
            alignItems: "center",
            justifyContent: "center",
            padding: 20,
          }}
        >
          <Image source={{ uri }} resizeMode="contain" style={{ width: "100%", height: "82%" }} />
          <Text style={{ marginTop: 16, color: "#FFFFFF", fontSize: 14, fontWeight: "700" }}>Tap anywhere to close</Text>
        </Pressable>
      </Modal>
    </>
  );
}

function UnitLoadDetails({ jobs }: { jobs: JobRecord[] }) {
  if (!jobs.length) return null;
  const loadOrder = [...jobs].reverse();

  return (
    <View style={{ marginTop: 10, borderRadius: 14, borderWidth: 1, borderColor: "#334155", backgroundColor: "#0F172A", padding: 12, gap: 10 }}>
      <Text style={{ color: "#FFFFFF", fontSize: 17, lineHeight: 22, fontWeight: "800" }}>Van load order</Text>
      <Text style={{ color: "#CBD5E1", fontSize: 14, lineHeight: 20 }}>Load the last delivery first, then work backwards.</Text>
      {loadOrder.map((job, index) => (
        <View
          key={job.id}
          style={{
            flexDirection: "row",
            alignItems: "center",
            gap: 10,
            borderTopWidth: 1,
            borderTopColor: "#334155",
            paddingTop: 10,
          }}
        >
          <Text
            style={{
              width: 28,
              height: 28,
              borderRadius: 14,
              backgroundColor: "rgba(34, 197, 94, 0.2)",
              borderWidth: 1,
              borderColor: "rgba(34, 197, 94, 0.4)",
              color: "#FFFFFF",
              fontSize: 13,
              lineHeight: 26,
              fontWeight: "900",
              textAlign: "center",
            }}
          >
            {index + 1}
          </Text>
          <View style={{ flex: 1, gap: 2 }}>
            <Text style={{ color: "#FFFFFF", fontSize: 15, lineHeight: 20, fontWeight: "800" }}>{job.customerName}</Text>
            <Text style={{ color: "#CBD5E1", fontSize: 13, lineHeight: 18 }}>{job.addressLine}</Text>
            <Text style={{ color: "#E2E8F0", fontSize: 13, lineHeight: 18 }}>{job.sofaCount} sofas</Text>
          </View>
          <JobPhotoPreview uri={job.photoUri} />
        </View>
      ))}
    </View>
  );
}

function getUnitLoadJobs(stop: RouteStop, followingStops: RouteStop[], jobs: JobRecord[]) {
  if (stop.kind !== "unit") {
    return (stop.loadJobIds ?? [])
      .map((jobId) => jobs.find((item) => item.id === jobId))
      .filter(Boolean) as JobRecord[];
  }

  const directJobs = (stop.loadJobIds ?? [])
    .map((jobId) => jobs.find((item) => item.id === jobId))
    .filter(Boolean) as JobRecord[];
  if (directJobs.length > 0) return directJobs;

  const cleanBefore = stop.cleanLoadBefore ?? stop.loadBefore;
  const cleanAfter = stop.cleanLoadAfter ?? stop.loadAfter;
  if (cleanAfter <= cleanBefore) return [];

  const candidates: JobRecord[] = [];
  let remainingCleanLoad = cleanAfter - cleanBefore;
  for (const nextStop of followingStops) {
    if (nextStop.kind === "unit") break;
    if (nextStop.kind !== "job" || !nextStop.relatedJobId) continue;
    const nextJob = jobs.find((item) => item.id === nextStop.relatedJobId);
    if (!nextJob || nextJob.type === "pickup") continue;
    candidates.push(nextJob);
    remainingCleanLoad -= nextJob.sofaCount;
    if (remainingCleanLoad <= 0) break;
  }
  return candidates;
}

function getStopCompletionKey(stop: RouteStop, routeIndex?: number) {
  if (stop.kind === "job" && stop.relatedJobId) {
    return `job|${stop.relatedJobId}`;
  }

  return [
    "action",
    stop.kind,
    stop.id,
    stop.relatedJobId ?? "",
    stop.relatedHelperId ?? "",
    stop.label,
    stop.addressLine,
    Math.round(stop.etaMinutesFromStart),
    Math.round(stop.loadBefore * 100) / 100,
    Math.round(stop.loadAfter * 100) / 100,
    routeIndex ?? "unplaced",
  ].join("|");
}

function isCompletedRouteStop(stop: RouteStop, completedStops: Record<string, RouteStop>, jobs: JobRecord[], routeIndex?: number) {
  if (stop.status === "completed") return true;
  if (completedStops[getStopCompletionKey(stop, routeIndex)]?.status === "completed") return true;
  if (stop.kind === "job" && stop.relatedJobId) {
    return jobs.find((job) => job.id === stop.relatedJobId)?.status === "completed";
  }
  return false;
}

function markStopLocallyCompleted(stop: RouteStop): RouteStop {
  return { ...stop, status: "completed" };
}

function isCancelledRouteStop(stop: RouteStop, jobs: JobRecord[]) {
  if (stop.kind !== "job" || !stop.relatedJobId) return false;
  return jobs.find((job) => job.id === stop.relatedJobId)?.status === "cancelled";
}

function makeManualUnitReturnStop(previousStop: RouteStop, snapshot: OperationsSnapshot): RouteStop {
  const loadBefore = previousStop.loadAfter;
  const cleanBefore = previousStop.cleanLoadAfter ?? loadBefore;
  const dirtyBefore = previousStop.dirtyLoadAfter ?? 0;

  return {
    id: `manual-unit-return-${snapshot.dateKey}-${previousStop.id}-${Math.round(previousStop.etaMinutesFromStart)}`,
    kind: "unit",
    label: snapshot.settings.unitLabel,
    townId: snapshot.settings.unitTownId,
    addressLine: snapshot.settings.unitAddress,
    latitude: snapshot.settings.unitLatitude,
    longitude: snapshot.settings.unitLongitude,
    etaMinutesFromStart: previousStop.etaMinutesFromStart + 1,
    travelMinutesFromPrevious: 0,
    serviceMinutes: 0,
    loadBefore,
    loadAfter: 0,
    deltaSofas: -loadBefore,
    cleanLoadBefore: cleanBefore,
    cleanLoadAfter: 0,
    dirtyLoadBefore: dirtyBefore,
    dirtyLoadAfter: 0,
    reason: "Manual unit return to empty the van before continuing.",
  };
}

// Calendar date picker component
function DateSelector({ dateKey, onChange }: { dateKey: string; onChange: (next: string) => void }) {
  const [calendarMonth, setCalendarMonth] = useState(() => {
    const date = parseDateKey(dateKey);
    return new Date(date.getFullYear(), date.getMonth(), 1);
  });

  useEffect(() => {
    const date = parseDateKey(dateKey);
    setCalendarMonth(new Date(date.getFullYear(), date.getMonth(), 1));
  }, [dateKey]);

  const getDaysInMonth = (date: Date) => {
    return new Date(date.getFullYear(), date.getMonth() + 1, 0).getDate();
  };

  const getFirstDayOfMonth = (date: Date) => {
    return new Date(date.getFullYear(), date.getMonth(), 1).getDay();
  };

  const handleDateSelect = (day: number) => {
    onChange(formatDateParts(calendarMonth.getFullYear(), calendarMonth.getMonth(), day));
  };

  const handlePrevMonth = () => {
    setCalendarMonth(new Date(calendarMonth.getFullYear(), calendarMonth.getMonth() - 1, 1));
  };

  const handleNextMonth = () => {
    setCalendarMonth(new Date(calendarMonth.getFullYear(), calendarMonth.getMonth() + 1, 1));
  };

  const daysInMonth = getDaysInMonth(calendarMonth);
  const firstDay = getFirstDayOfMonth(calendarMonth);
  const days = Array.from({ length: daysInMonth }, (_, i) => i + 1);
  const emptyDays = Array.from({ length: firstDay }, (_, i) => null);
  const calendarDays = [...emptyDays, ...days];

  return (
    <View style={{ backgroundColor: "#f5f5f5", borderRadius: 8, padding: 12, marginBottom: 12 }}>
      <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
        <Pressable onPress={handlePrevMonth} style={{ padding: 8 }}>
          <Text style={{ fontSize: 18, color: "#0a7ea4" }}>←</Text>
        </Pressable>
        <Text style={{ fontSize: 14, fontWeight: "600", color: "#11181C" }}>
          {calendarMonth.toLocaleDateString("en-US", { month: "long", year: "numeric" })}
        </Text>
        <Pressable onPress={handleNextMonth} style={{ padding: 8 }}>
          <Text style={{ fontSize: 18, color: "#0a7ea4" }}>→</Text>
        </Pressable>
      </View>
      <View style={{ flexDirection: "row", justifyContent: "space-between", marginBottom: 8 }}>
        {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((day) => (
          <Text key={day} style={{ textAlign: "center", fontSize: 12, fontWeight: "600", color: "#687076", flex: 1 }}>
            {day}
          </Text>
        ))}
      </View>
      <View style={{ flexDirection: "row", flexWrap: "wrap" }}>
        {calendarDays.map((day, idx) => {
          // Fix timezone issue: format date string directly without timezone conversion
          const dayDate = day ? formatDateParts(calendarMonth.getFullYear(), calendarMonth.getMonth(), day) : null;
          return (
            <View key={idx} style={{ width: "14.28%", aspectRatio: 1, padding: 2 }}>
              {day ? (
                <Pressable
                  onPress={() => handleDateSelect(day)}
                  style={({ pressed }) => [{
                    flex: 1,
                    justifyContent: "center",
                    alignItems: "center",
                    borderRadius: 4,
                    backgroundColor: dayDate === dateKey ? "#0a7ea4" : "white",
                    borderWidth: 1,
                    borderColor: "#E5E7EB",
                  }, pressed && { opacity: 0.7 }]}
                >
                  <Text style={{ fontSize: 12, fontWeight: "600", color: dayDate === dateKey ? "white" : "#11181C" }}>
                    {day}
                  </Text>
                </Pressable>
              ) : null}
            </View>
          );
        })}
      </View>
    </View>
  );
}

export default function HomeScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { selectedDate, setSelectedDate, customRouteOrder, setCustomRouteOrder } = useRouteDate();
  const [showCalendar, setShowCalendar] = useState(false);
  const [showResetConfirm, setShowResetConfirm] = useState(false);
  const [showStartTimes, setShowStartTimes] = useState(false);
  const [showEndTimes, setShowEndTimes] = useState(false);
  const [expandedStopIds, setExpandedStopIds] = useState<Record<string, boolean>>({});
  const [rememberedRouteStops, setRememberedRouteStops] = useState<RouteStop[]>([]);
  const {
    isRouteStale,
    setIsRouteStale,
    includeHelper,
    setIncludeHelper,
    returnToUnit,
    setReturnToUnit,
    setCommittedIncludeHelper,
    setCommittedReturnToUnit,
    completedRouteStopIds,
    markRouteStopComplete,
    clearCompletedRouteStops,
  } = useRouteDate();
  const [manualUnitReturn, setManualUnitReturn] = useState<RouteStop | null>(null);
  const [completedStopRecords, setCompletedStopRecords] = useState<Record<string, RouteStop>>({});

  const handleReorderRoute = (reorderedStops: RouteStop[]) => {
    setCustomRouteOrder(reorderedStops);
    // Save custom route order to backend
    const stopIds = reorderedStops.map((stop) => stop.id);
    saveRouteOrderMutation.mutate({ dateKey: selectedDate, stopIds });
  };

  const hasCustomOrder = customRouteOrder !== null;

  const handleMarkComplete = (stop: RouteStop, routeIndex: number) => {
    if (!stop || stop.kind === "start") return;
    const activeIndex = allRouteStops.findIndex((candidate, index) => {
      if (candidate.kind === "start") return false;
      if (isCompletedRouteStop(candidate, completedStopRecords, snapshot?.todaysJobs ?? [], index)) return false;
      if (isCancelledRouteStop(candidate, snapshot?.todaysJobs ?? [])) return false;
      return true;
    });
    if (activeIndex < 0 || activeIndex !== routeIndex) return;

    const driverStartIndex = allRouteStops.findIndex((candidate) => candidate.kind === "start");
    const driverStart = driverStartIndex >= 0 ? allRouteStops[driverStartIndex] : null;
    if (isCompletedRouteStop(stop, completedStopRecords, snapshot?.todaysJobs ?? [], routeIndex) || isCancelledRouteStop(stop, snapshot?.todaysJobs ?? [])) {
      return;
    }

    const completedStop = markStopLocallyCompleted(stop);
    const completedDriverStart = driverStart ? markStopLocallyCompleted(driverStart) : null;

    setCompletedStopRecords((current) => {
      const next = {
        ...current,
        ...(completedDriverStart ? { [getStopCompletionKey(completedDriverStart, driverStartIndex)]: completedDriverStart } : {}),
      };
      next[getStopCompletionKey(completedStop, routeIndex)] = completedStop;
      return next;
    });

    if (driverStart && driverStartIndex >= 0) {
      markRouteStopComplete(getStopCompletionKey(driverStart, driverStartIndex));
    }
    if (completedStop.kind === "job" && completedStop.relatedJobId) {
      markRouteStopComplete(completedStop.id);
      const job = snapshot?.todaysJobs.find((item) => item.id === completedStop.relatedJobId);
      if (job?.status !== "completed") {
        completeMutation.mutate({ id: completedStop.relatedJobId, dateKey: selectedDate });
      }
    } else {
      markRouteStopComplete(getStopCompletionKey(completedStop, routeIndex));
    }
  };

  const utils = trpc.useUtils();
  const snapshotQuery = trpc.operations.snapshot.useQuery(
    { dateKey: selectedDate },
    {
      refetchInterval: false, // Disabled auto-refresh to save API costs
    },
  );

  const enhancedRouteQuery = useEnhancedRoute();

  const completeMutation = trpc.operations.completeJob.useMutation({
    onSuccess: () => {
      utils.operations.snapshot.invalidate({ dateKey: selectedDate });
      enhancedRouteQuery.refetch();
    },
  });

  const cancelMutation = trpc.operations.cancelJob.useMutation({
    onSuccess: () => {
      setCustomRouteOrder(null);
      setManualUnitReturn(null);
      setIsRouteStale(false);
      utils.operations.snapshot.invalidate({ dateKey: selectedDate });
      enhancedRouteQuery.refetch();
    },
  });

  const updateDayStartTimeMutation = trpc.operations.updateDayStartTime.useMutation({
    onSuccess: () => {
      utils.operations.snapshot.invalidate({ dateKey: selectedDate });
      enhancedRouteQuery.refetch();
      setIsRouteStale(false);
    },
  });

  const updateDayEndTimeMutation = trpc.operations.updateDayEndTime.useMutation({
    onSuccess: () => {
      utils.operations.snapshot.invalidate({ dateKey: selectedDate });
      enhancedRouteQuery.refetch();
      setIsRouteStale(false);
    },
  });

  const saveRouteOrderMutation = trpc.operations.saveRouteOrder.useMutation({
    onSuccess: () => {
      setIsRouteStale(false);
      enhancedRouteQuery.refetch();
    },
  });

  const deleteRouteOrderMutation = trpc.operations.deleteRouteOrder.useMutation({
    onSuccess: () => {
      setCustomRouteOrder(null);
      setIsRouteStale(false);
      enhancedRouteQuery.refetch();
    },
  });

  const getHistoryQuery = trpc.operations.getRouteOrderHistory.useQuery(
    { dateKey: selectedDate },
    { enabled: !!selectedDate },
  );

  const revertToHistoryMutation = trpc.operations.revertToHistoryVersion.useMutation({
    onSuccess: () => {
      getHistoryQuery.refetch();
      utils.operations.snapshot.invalidate({ dateKey: selectedDate });
    },
  });

  const handleResetRoute = () => {
    setShowResetConfirm(true);
  };

  const handleConfirmReset = () => {
    setShowResetConfirm(false);
    // Save to history before resetting
    if (customRouteOrder) {
      // History will be saved by backend when route is reset
    }
    deleteRouteOrderMutation.mutate({ dateKey: selectedDate });
  };

  const handleRevertToVersion = (historyId: string) => {
    revertToHistoryMutation.mutate({ dateKey: selectedDate, historyId });
  };

  const handleCancelReset = () => {
    setShowResetConfirm(false);
  };

  const handleEmptyVan = () => {
    if (!snapshot || !allRouteStops.length) return;
    const completedStops = allRouteStops.filter((stop, index) => isCompletedRouteStop(stop, completedStopRecords, snapshot.todaysJobs, index));
    const previousStop = [...completedStops].reverse().find((stop) => stop.kind !== "start") ?? allRouteStops.find((stop) => stop.kind !== "start") ?? allRouteStops[0];
    setManualUnitReturn(makeManualUnitReturnStop(previousStop, snapshot));
  };

  const snapshot = snapshotQuery.data;
  const enhancedRoute = enhancedRouteQuery.data;
  const displayRoute = enhancedRoute;
  const isAbsoluteRoute = true;
  useEffect(() => {
    setManualUnitReturn(null);
    setCompletedStopRecords({});
    setRememberedRouteStops([]);
  }, [selectedDate]);

  useEffect(() => {
    if (displayRoute?.stops?.length) {
      setRememberedRouteStops(displayRoute.stops);
    }
  }, [displayRoute?.stops]);

  const completedUnitLoadJobIds = useMemo(() => {
    const loadedIds = new Set<string>();
    Object.values(completedStopRecords).forEach((completedStop) => {
      if (completedStop.kind !== "unit" || completedStop.status !== "completed") return;
      (completedStop.loadJobIds ?? []).forEach((jobId) => loadedIds.add(jobId));
    });
    return loadedIds;
  }, [completedStopRecords]);

  const baseRouteStops = useMemo(() => {
    const latestRouteStops = displayRoute?.stops?.length ? displayRoute.stops : rememberedRouteStops;
    const stops = customRouteOrder || latestRouteStops;
    if (!completedUnitLoadJobIds.size) return stops;

    return stops.filter((stop) => {
      if (stop.kind !== "unit" || !stop.loadJobIds?.length) return true;
      return !stop.loadJobIds.every((jobId) => completedUnitLoadJobIds.has(jobId));
    });
  }, [completedUnitLoadJobIds, customRouteOrder, displayRoute?.stops, rememberedRouteStops]);
  const allRouteStops = useMemo(() => {
    const mergedStops = [...baseRouteStops];

    Object.entries(completedStopRecords).forEach(([completedKey, completedStop]) => {
      const existingIndex = mergedStops.findIndex((stop, index) => getStopCompletionKey(stop, index) === completedKey);
      if (existingIndex >= 0) {
        mergedStops[existingIndex] = { ...mergedStops[existingIndex], ...completedStop };
      } else {
        const nextStopIndex = mergedStops.findIndex((stop) => stop.etaMinutesFromStart > completedStop.etaMinutesFromStart);
        mergedStops.splice(nextStopIndex >= 0 ? nextStopIndex : mergedStops.length, 0, completedStop);
      }
    });

    if (manualUnitReturn && !mergedStops.some((stop) => stop.id === manualUnitReturn.id)) {
      const completedIndexes = mergedStops
        .map((stop, index) => (isCompletedRouteStop(stop, completedStopRecords, snapshot?.todaysJobs ?? [], index) ? index : -1))
        .filter((index) => index >= 0);
      const nextStopIndex = mergedStops.findIndex((stop) => stop.etaMinutesFromStart > manualUnitReturn.etaMinutesFromStart);
      const insertIndex = completedIndexes.length
        ? Math.max(...completedIndexes) + 1
        : nextStopIndex >= 0
          ? nextStopIndex
          : mergedStops.length;
      mergedStops.splice(insertIndex, 0, manualUnitReturn);
    }

    return mergedStops;
  }, [baseRouteStops, completedStopRecords, manualUnitReturn, snapshot?.todaysJobs]);
  const routeStops = useMemo(() => {
    return allRouteStops;
  }, [allRouteStops]);
  const firstActiveStopEntry = routeStops
    .map((stop, index) => ({ stop, index }))
    .find(({ stop, index }) => {
    if (stop.kind === "start") return false;
    if (isCompletedRouteStop(stop, completedStopRecords, snapshot?.todaysJobs ?? [], index)) return false;
    if (isCancelledRouteStop(stop, snapshot?.todaysJobs ?? [])) return false;
    return true;
  }) ?? null;
  const firstActiveStop = firstActiveStopEntry?.stop ?? null;
  const firstActiveStopIndex = firstActiveStopEntry?.index ?? -1;
  const liveVanLoad = useMemo(() => {
    const latestCompletedRouteStop = allRouteStops
      .map((stop, index) => ({ stop, index }))
      .reverse()
      .find(({ stop, index }) => {
      if (stop.kind === "start") return false;
      if (isCompletedRouteStop(stop, completedStopRecords, snapshot?.todaysJobs ?? [], index)) return true;
      if (stop.kind === "job" && stop.relatedJobId) {
        return snapshot?.todaysJobs.find((job) => job.id === stop.relatedJobId)?.status === "completed";
      }
      return false;
    })?.stop;

    if (latestCompletedRouteStop) return latestCompletedRouteStop.loadAfter;

    return snapshot ? calculateLiveVanLoad(snapshot.todaysJobs, snapshot.settings.vanCapacity) : 0;
  }, [allRouteStops, completedStopRecords, snapshot?.todaysJobs, snapshot?.settings.vanCapacity]);
  const currentStop = firstActiveStop;
  const currentJobStatus = currentStop?.relatedJobId
    ? snapshot?.todaysJobs.find((job) => job.id === currentStop.relatedJobId)?.status
    : undefined;
  const actionableJobStop = isActionableJobStop(currentStop, currentJobStatus) ? currentStop : null;

  const liveChangeText = useMemo(() => {
    if (!snapshot) return "Loading route state.";

    const cancelled = snapshot.todaysJobs.filter((job) => job.status === "cancelled").length;
    const completed = snapshot.todaysJobs.filter((job) => job.status === "completed").length;

    if (!cancelled && !completed) {
      return "No route changes have been applied yet. Sales updates will appear here automatically.";
    }

    return `${completed} completed and ${cancelled} cancelled jobs are already affecting the route order.`;
  }, [snapshot]);

  const routeEndWarning = useMemo(() => {
    if (!displayRoute || !snapshot) return null;
    const finalHomeStop = [...displayRoute.stops].reverse().find((stop) => stop.kind === "home");
    if (!finalHomeStop) return null;
    const homeArrival = isAbsoluteRoute
      ? finalHomeStop.etaMinutesFromStart
      : timeToMinutes(snapshot.settings.workdayStart) + finalHomeStop.etaMinutesFromStart;
    const endTime = snapshot.settings.workdayEnd ?? "17:30";
    const endMinutes = timeToMinutes(endTime);
    if (homeArrival <= endMinutes) return null;
    return {
      homeTime: absoluteMinutesToTimeLabel(homeArrival),
      endTime,
    };
  }, [displayRoute, isAbsoluteRoute, snapshot]);
  const plannedStartLabel = useMemo(() => {
    if (!displayRoute || !snapshot || !isAbsoluteRoute) return null;
    const plannedStart = displayRoute.stops[0]?.etaMinutesFromStart;
    if (plannedStart === undefined) return null;
    const savedStart = timeToMinutes(snapshot.settings.workdayStart);
    if (plannedStart <= savedStart) return null;
    return absoluteMinutesToTimeLabel(plannedStart);
  }, [displayRoute, isAbsoluteRoute, snapshot]);

  if (snapshotQuery.isLoading || !snapshot) {
    return (
      <ScreenContainer className="items-center justify-center px-6">
        <ActivityIndicator size="large" color={colors.primary} />
        <Text className="mt-4 text-base text-muted text-center">
          Building route plan.
        </Text>
      </ScreenContainer>
    );
  }

  if (enhancedRouteQuery.isLoading && !displayRoute) {
    return (
      <ScreenContainer className="items-center justify-center px-6">
        <ActivityIndicator size="large" color={colors.primary} />
        <Text className="mt-4 text-base text-muted text-center">
          Getting road route times.
        </Text>
      </ScreenContainer>
    );
  }

  if (enhancedRouteQuery.isError || !displayRoute) {
    return (
      <ScreenContainer className="items-center justify-center px-6">
        <Text className="text-lg font-bold text-foreground text-center">Road route failed</Text>
        <Text className="mt-3 text-sm leading-6 text-muted text-center">
          The app could not get Geoapify road timings, so it is not showing straight-line guesses.
        </Text>
        <Pressable
          onPress={() => enhancedRouteQuery.refetch()}
          style={({ pressed }) => ({
            marginTop: 18,
            borderRadius: 12,
            backgroundColor: colors.primary,
            paddingHorizontal: 18,
            paddingVertical: 12,
            opacity: pressed ? 0.72 : 1,
          })}
        >
          <Text className="text-sm font-bold text-white">Try again</Text>
        </Pressable>
      </ScreenContainer>
    );
  }

  const renderStop = ({ item, index }: { item: RouteStop; index: number }) => {
    const job = item.relatedJobId ? snapshot?.todaysJobs.find((candidate) => candidate.id === item.relatedJobId) : undefined;
    const loadJobs = getUnitLoadJobs(item, routeStops.slice(index + 1), snapshot.todaysJobs);
    const canShowDetails = item.kind === "job" || loadJobs.length > 0;
    const expansionKey = getStopCompletionKey(item, index);
    const isExpanded = !!expandedStopIds[expansionKey];
    const isCompleted = isCompletedRouteStop(item, completedStopRecords, snapshot.todaysJobs, index);
    const isCancelled = isCancelledRouteStop(item, snapshot.todaysJobs);
    const isInactive = isCompleted || isCancelled;
    const canCompleteThisStop = !isInactive && item.kind !== "start" && index === firstActiveStopIndex;

    return (
      <View
        style={{
          marginBottom: 12,
          borderRadius: 20,
          borderWidth: 1,
          borderColor: isInactive ? "rgba(148, 163, 184, 0.28)" : "#243149",
          backgroundColor: isInactive ? "rgba(30, 41, 59, 0.58)" : "#0B1220",
          padding: 16,
          opacity: isInactive ? 0.78 : 1,
        }}
      >
        <View className="flex-row items-start justify-between gap-3">
          <View className="flex-1 gap-1">
            <Text style={{ color: "#94A3B8", fontSize: 12, fontWeight: "700", textTransform: "uppercase" }}>
              Stop {index + 1} · {getStopTypeLabel(item)}
            </Text>
            {isCompleted || isCancelled ? (
              <View style={{
                alignSelf: "flex-start",
                borderRadius: 999,
                backgroundColor: isCompleted ? "rgba(34, 197, 94, 0.18)" : "rgba(248, 113, 113, 0.18)",
                borderWidth: 1,
                borderColor: isCompleted ? "rgba(34, 197, 94, 0.34)" : "rgba(248, 113, 113, 0.34)",
                paddingHorizontal: 8,
                paddingVertical: 4,
              }}>
                <Text style={{ color: isCompleted ? "#86EFAC" : "#FCA5A5", fontSize: 11, fontWeight: "900" }}>
                  {isCompleted ? "Complete" : "Cancelled"}
                </Text>
              </View>
            ) : null}
            <Text style={{ color: "#FFFFFF", fontSize: 18, lineHeight: 24, fontWeight: "800" }}>{item.label}</Text>
            {item.addressLine ? (
              <Pressable onPress={() => openDirections(item)}>
                <Text style={{ color: "#7DD3FC", fontSize: 14, fontWeight: "800", textDecorationLine: "underline" }}>{item.addressLine}</Text>
              </Pressable>
            ) : null}
          </View>
          <View className="items-end">
            <Text style={{ color: "#94A3B8", fontSize: 10, fontWeight: "800", textTransform: "uppercase" }}>
              Arrive
            </Text>
            <Text style={{ color: "#FFFFFF", fontSize: 16, fontWeight: "800" }}>
              {routeStopTimeLabel(item, snapshot.settings.workdayStart, isAbsoluteRoute)}
            </Text>
          </View>
        </View>

        <View className="mt-4 flex-row flex-wrap gap-2">
          <View style={{ borderRadius: 999, backgroundColor: "#111C2F", borderWidth: 1, borderColor: "#334155", paddingHorizontal: 12, paddingVertical: 8 }}>
            <Text style={{ color: "#E2E8F0", fontSize: 12, fontWeight: "600" }}>Load {item.loadBefore} → {item.loadAfter}</Text>
          </View>
          {item.kind !== "start" ? (
            <View style={{ borderRadius: 999, backgroundColor: "#111C2F", borderWidth: 1, borderColor: "#334155", paddingHorizontal: 12, paddingVertical: 8 }}>
              <Text style={{ color: "#E2E8F0", fontSize: 12, fontWeight: "600" }}>{item.travelMinutesFromPrevious} min drive from previous</Text>
            </View>
          ) : null}
          <View style={{ borderRadius: 999, backgroundColor: "#111C2F", borderWidth: 1, borderColor: "#334155", paddingHorizontal: 12, paddingVertical: 8 }}>
            <Text style={{ color: "#E2E8F0", fontSize: 12, fontWeight: "600" }}>{item.serviceMinutes} min on site</Text>
          </View>
          {item.kind === "job" ? (
            <View style={{ borderRadius: 999, backgroundColor: "#111C2F", borderWidth: 1, borderColor: "#334155", paddingHorizontal: 12, paddingVertical: 8 }}>
              <Text style={{ color: "#E2E8F0", fontSize: 12, fontWeight: "600" }}>{item.deltaSofas > 0 ? "+" : ""}{item.deltaSofas} sofa</Text>
            </View>
          ) : null}
        </View>

        <Text style={{ marginTop: 16, color: "#CBD5E1", fontSize: 14, lineHeight: 21 }}>{item.reason}</Text>

        {canShowDetails ? (
          <>
            <Pressable
              onPress={() => setExpandedStopIds((current) => ({ ...current, [expansionKey]: !current[expansionKey] }))}
              style={({ pressed }) => ({
                marginTop: 14,
                borderRadius: 12,
                borderWidth: 1,
                borderColor: "#334155",
                backgroundColor: "rgba(148, 163, 184, 0.14)",
                paddingVertical: 12,
                alignItems: "center",
                opacity: pressed ? 0.75 : 1,
              })}
            >
              <Text style={{ color: "#E2E8F0", fontSize: 14, fontWeight: "800" }}>
                {isExpanded ? "Hide job details" : "Show job details"} {isExpanded ? "▲" : "▼"}
              </Text>
            </Pressable>

            {isExpanded && item.kind === "unit" ? <UnitLoadDetails jobs={loadJobs} /> : null}

            {isExpanded && item.kind === "job" && job ? (
              <View style={{ marginTop: 10, borderRadius: 14, borderWidth: 1, borderColor: "#334155", backgroundColor: "#0F172A", padding: 12, flexDirection: "row", gap: 12, alignItems: "flex-end" }}>
                <View style={{ flex: 1, gap: 6 }}>
                  <Text style={{ color: "#FFFFFF", fontSize: 17, lineHeight: 22, fontWeight: "800" }}>{job.customerName}</Text>
                  <Text style={{ color: "#CBD5E1", fontSize: 14, lineHeight: 20 }}>{job.contactName}</Text>
                  <Pressable onPress={() => callPhoneNumber(job.contactPhone)}>
                    <Text style={{ color: "#FFFFFF", fontSize: 16, lineHeight: 22, fontWeight: "900", textDecorationLine: "underline" }}>{job.contactPhone}</Text>
                  </Pressable>
                  <Text style={{ color: "#E2E8F0", fontSize: 14, lineHeight: 20 }}>
                    {job.type === "pickup" ? `Pickup: ${job.pickupCount || job.sofaCount} sofas` : job.type === "delivery" ? `Delivery: ${job.sofaCount} sofas` : `Delivery: ${job.sofaCount} sofas, Pickup: ${job.pickupCount} sofas`}
                  </Text>
                  <Text style={{ color: "#CBD5E1", fontSize: 14, lineHeight: 20 }}>{job.floor ? `Floor: ${job.floor}. ` : ""}{job.notes || "No notes."}</Text>
                </View>
                <View style={{ alignSelf: "flex-end" }}>
                  <JobPhotoPreview uri={job.photoUri} />
                </View>
              </View>
            ) : null}
          </>
        ) : null}

        {item.kind !== "start" && !isInactive ? (
          <View style={{ marginTop: 14, gap: 10 }}>
            {item.kind === "job" && item.relatedJobId ? (
              <Pressable
                onPress={() => cancelMutation.mutate({ id: item.relatedJobId!, dateKey: selectedDate })}
                disabled={cancelMutation.isPending}
                style={({ pressed }) => ({
                  alignSelf: "flex-start",
                  minHeight: 34,
                  paddingVertical: 7,
                  paddingHorizontal: 10,
                  borderRadius: 999,
                  backgroundColor: "rgba(239, 68, 68, 0.1)",
                  borderWidth: 1,
                  borderColor: "rgba(248, 113, 113, 0.28)",
                  opacity: pressed || cancelMutation.isPending ? 0.7 : 1,
                  alignItems: "center",
                  justifyContent: "center",
                })}
              >
                <Text style={{ color: "#FCA5A5", fontSize: 12, fontWeight: "800" }}>
                  {cancelMutation.isPending ? "Cancelling..." : "Cancel job"}
                </Text>
              </Pressable>
            ) : null}
            {canCompleteThisStop ? (
              <Pressable
                onPress={() => handleMarkComplete(item, index)}
                disabled={completeMutation.isPending}
                style={({ pressed }) => ({
                  minHeight: 44,
                  paddingVertical: 12,
                  paddingHorizontal: 12,
                  borderRadius: 14,
                  backgroundColor: "rgba(34, 197, 94, 0.2)",
                  borderWidth: 1,
                  borderColor: "rgba(34, 197, 94, 0.4)",
                  opacity: pressed || completeMutation.isPending ? 0.7 : 1,
                  alignItems: "center",
                  justifyContent: "center",
                })}
              >
                <Text className="text-center text-base font-black text-white">
                  {completeMutation.isPending ? "Marking..." : "✓ Mark job complete"}
                </Text>
              </Pressable>
            ) : null}
          </View>
        ) : null}
      </View>
    );
  };

  return (
    <ScreenContainer className="px-4">
      <DraggableRouteList
        stops={routeStops}
        onReorder={handleReorderRoute}
        renderStop={(item, index) => renderStop({ item, index })}
        onReset={handleResetRoute}
        hasCustomOrder={hasCustomOrder}
        contentContainerStyle={{
          paddingTop: 16,
          // SafeAreaView already handles the top inset. Keep enough bottom
          // room for the tab bar and the iPhone home indicator.
          paddingBottom: Math.max(insets.bottom, 12) + 104,
        }}
        ListEmptyComponent={
          <View className="items-center justify-center py-12">
            <Text className="text-lg font-semibold text-foreground">No jobs scheduled for this date</Text>
            <Text className="mt-2 text-sm text-muted">Add jobs from the Jobs tab to create a route</Text>
          </View>
        }
        refreshControl={
          <RefreshControl
            refreshing={snapshotQuery.isRefetching}
            onRefresh={() => snapshotQuery.refetch()}
            tintColor={colors.primary}
          />
        }
        ListHeaderComponent={
          <View className="pb-4">
            <View style={{ height: 12 }} />
            
            {/* Calendar Picker */}
            {showCalendar && (
              <DateSelector dateKey={selectedDate} onChange={(date) => {
                setSelectedDate(date);
                setShowCalendar(false);
              }} />
            )}

            <View
              className="mb-4 rounded-[24px] bg-gradient-to-r from-slate-800 to-slate-900 px-5 py-5 border border-slate-700"
              style={{
                backgroundColor: "#0f172a",
                borderColor: "#334155",
                borderWidth: 1,
              }}
            >
              <View className="flex-row items-center justify-between">
                <View className="flex-1">
                  <View className="flex-row items-center gap-2">
                    <Text className="text-sm font-semibold uppercase tracking-wide text-slate-300">
                      Driver route console
                    </Text>
                    {isRouteStale ? (
                      <View style={{
                        paddingHorizontal: 8,
                        paddingVertical: 4,
                        borderRadius: 6,
                        backgroundColor: 'rgba(217, 119, 6, 0.2)',
                        borderWidth: 1,
                        borderColor: 'rgba(217, 119, 6, 0.4)',
                      }}>
                        <Text style={{ fontSize: 10, fontWeight: '600', color: '#fbbf24' }}>⚠ STALE</Text>
                      </View>
                    ) : displayRoute ? (
                      <View style={{
                        paddingHorizontal: 8,
                        paddingVertical: 4,
                        borderRadius: 6,
                        backgroundColor: 'rgba(34, 197, 94, 0.2)',
                        borderWidth: 1,
                        borderColor: 'rgba(34, 197, 94, 0.4)',
                      }}>
                        <Text style={{ fontSize: 10, fontWeight: '600', color: '#22c55e' }}>✓ FRESH</Text>
                      </View>
                    ) : null}
                  </View>
                  <Text className="mt-2 text-2xl font-bold text-white">
                    {selectedDate === getTodayKey() ? "Today's" : "Route for"} optimum route
                  </Text>
                </View>
                <View className="gap-2">
                  <Pressable
                    onPress={() => setShowCalendar(!showCalendar)}
                    style={({ pressed }) => ({
                      paddingHorizontal: 12,
                      paddingVertical: 8,
                      borderRadius: 8,
                      backgroundColor: "rgba(255, 255, 255, 0.15)",
                      borderWidth: 1,
                      borderColor: "rgba(255, 255, 255, 0.2)",
                      opacity: pressed ? 0.7 : 1,
                    })}
                  >
                    <Text className="text-xs font-semibold text-white">📅 {selectedDate}</Text>
                  </Pressable>
                  <Pressable
                    onPress={() => {
                      setShowStartTimes((current) => !current);
                      setShowEndTimes(false);
                    }}
                    style={({ pressed }) => ({
                      paddingHorizontal: 12,
                      paddingVertical: 8,
                      borderRadius: 8,
                      backgroundColor: snapshot.dayStartTimeOverride ? "rgba(34, 197, 94, 0.22)" : "rgba(255, 255, 255, 0.12)",
                      borderWidth: 1,
                      borderColor: snapshot.dayStartTimeOverride ? "rgba(34, 197, 94, 0.45)" : "rgba(255, 255, 255, 0.2)",
                      opacity: pressed ? 0.7 : 1,
                    })}
                  >
                    <Text className="text-xs font-semibold text-white">Start {snapshot.settings.workdayStart}</Text>
                  </Pressable>
                  <Pressable
                    onPress={() => {
                      setShowEndTimes((current) => !current);
                      setShowStartTimes(false);
                    }}
                    style={({ pressed }) => ({
                      paddingHorizontal: 12,
                      paddingVertical: 8,
                      borderRadius: 8,
                      backgroundColor: snapshot.dayEndTimeOverride ? "rgba(34, 197, 94, 0.22)" : "rgba(255, 255, 255, 0.12)",
                      borderWidth: 1,
                      borderColor: snapshot.dayEndTimeOverride ? "rgba(34, 197, 94, 0.45)" : "rgba(255, 255, 255, 0.2)",
                      opacity: pressed ? 0.7 : 1,
                    })}
                  >
                    <Text className="text-xs font-semibold text-white">End {snapshot.settings.workdayEnd ?? "17:30"}</Text>
                  </Pressable>
                </View>
              </View>
              {showStartTimes ? (
                <View style={{ marginTop: 12, gap: 8 }}>
                  <Text className="text-xs font-semibold uppercase tracking-wide text-slate-300">Start time for this day</Text>
                  <ScrollView horizontal showsHorizontalScrollIndicator={false} keyboardShouldPersistTaps="always">
                    <View style={{ flexDirection: "row", gap: 8, paddingRight: 4 }}>
                      {START_TIME_OPTIONS.map((time) => {
                        const isSelected = snapshot.settings.workdayStart === time;
                        return (
                          <Pressable
                            key={time}
                            onPress={() => {
                              setShowStartTimes(false);
                              updateDayStartTimeMutation.mutate({ dateKey: selectedDate, startTime: time });
                            }}
                            style={({ pressed }) => ({
                              minWidth: 74,
                              paddingVertical: 10,
                              paddingHorizontal: 12,
                              borderRadius: 10,
                              backgroundColor: isSelected ? "#1E5EFF" : "rgba(255, 255, 255, 0.12)",
                              borderWidth: 1,
                              borderColor: isSelected ? "#60A5FA" : "rgba(255, 255, 255, 0.2)",
                              opacity: pressed || updateDayStartTimeMutation.isPending ? 0.72 : 1,
                              alignItems: "center",
                            })}
                          >
                            <Text style={{ color: "#FFFFFF", fontSize: 13, fontWeight: "800" }}>{time}</Text>
                          </Pressable>
                        );
                      })}
                      <Pressable
                        onPress={() => {
                          setShowStartTimes(false);
                          updateDayStartTimeMutation.mutate({ dateKey: selectedDate, startTime: null });
                        }}
                        style={({ pressed }) => ({
                          minWidth: 94,
                          paddingVertical: 10,
                          paddingHorizontal: 12,
                          borderRadius: 10,
                          backgroundColor: "rgba(255, 255, 255, 0.12)",
                          borderWidth: 1,
                          borderColor: "rgba(255, 255, 255, 0.2)",
                          opacity: pressed || updateDayStartTimeMutation.isPending ? 0.72 : 1,
                          alignItems: "center",
                        })}
                      >
                        <Text style={{ color: "#FFFFFF", fontSize: 13, fontWeight: "800" }}>Use default</Text>
                      </Pressable>
                    </View>
                  </ScrollView>
                </View>
              ) : null}
              {showEndTimes ? (
                <View style={{ marginTop: 12, gap: 8 }}>
                  <Text className="text-xs font-semibold uppercase tracking-wide text-slate-300">End time for this day</Text>
                  <ScrollView horizontal showsHorizontalScrollIndicator={false} keyboardShouldPersistTaps="always">
                    <View style={{ flexDirection: "row", gap: 8, paddingRight: 4 }}>
                      {END_TIME_OPTIONS.map((time) => {
                        const isSelected = (snapshot.settings.workdayEnd ?? "17:30") === time;
                        return (
                          <Pressable
                            key={time}
                            onPress={() => {
                              setShowEndTimes(false);
                              updateDayEndTimeMutation.mutate({ dateKey: selectedDate, endTime: time });
                            }}
                            style={({ pressed }) => ({
                              minWidth: 74,
                              paddingVertical: 10,
                              paddingHorizontal: 12,
                              borderRadius: 10,
                              backgroundColor: isSelected ? "#1E5EFF" : "rgba(255, 255, 255, 0.12)",
                              borderWidth: 1,
                              borderColor: isSelected ? "#60A5FA" : "rgba(255, 255, 255, 0.2)",
                              opacity: pressed || updateDayEndTimeMutation.isPending ? 0.72 : 1,
                              alignItems: "center",
                            })}
                          >
                            <Text style={{ color: "#FFFFFF", fontSize: 13, fontWeight: "800" }}>{time}</Text>
                          </Pressable>
                        );
                      })}
                      <Pressable
                        onPress={() => {
                          setShowEndTimes(false);
                          updateDayEndTimeMutation.mutate({ dateKey: selectedDate, endTime: null });
                        }}
                        style={({ pressed }) => ({
                          minWidth: 94,
                          paddingVertical: 10,
                          paddingHorizontal: 12,
                          borderRadius: 10,
                          backgroundColor: "rgba(255, 255, 255, 0.12)",
                          borderWidth: 1,
                          borderColor: "rgba(255, 255, 255, 0.2)",
                          opacity: pressed || updateDayEndTimeMutation.isPending ? 0.72 : 1,
                          alignItems: "center",
                        })}
                      >
                        <Text style={{ color: "#FFFFFF", fontSize: 13, fontWeight: "800" }}>Use default</Text>
                      </Pressable>
                    </View>
                  </ScrollView>
                </View>
              ) : null}
              <Text className="mt-3 text-sm leading-6 text-slate-200">
                {displayRoute?.routeHeadline}
              </Text>
              {plannedStartLabel ? (
                <View className="mt-3 rounded-lg border border-sky-300/35 bg-sky-400/15 px-3 py-2">
                  <Text className="text-xs font-semibold text-sky-100">
                    Planned start moved to {plannedStartLabel} to reduce waiting.
                  </Text>
                </View>
              ) : null}
              {routeEndWarning ? (
                <View className="mt-3 rounded-lg border border-amber-300/40 bg-amber-400/15 px-3 py-2">
                  <Text className="text-xs font-semibold text-amber-100">
                    You are going to get home at {routeEndWarning.homeTime}. Workday end is {routeEndWarning.endTime}. Is that okay?
                  </Text>
                </View>
              ) : null}
              
              {/* Van Load Capacity Bar */}
              <View className="mt-4 rounded-lg bg-slate-700/50 p-3">
                <View className="flex-row items-center justify-between mb-2">
                  <Text className="text-xs font-semibold uppercase tracking-wide text-slate-300">Van Load</Text>
                  <Text className="text-sm font-bold text-white">{liveVanLoad}/{snapshot?.settings.vanCapacity} sofas</Text>
                </View>
                <View className="h-2 rounded-full bg-slate-600 overflow-hidden">
                  <View
                    style={{
                      height: "100%",
                      width: `${(liveVanLoad / (snapshot?.settings.vanCapacity ?? 1)) * 100}%`,
                      backgroundColor: liveVanLoad > (snapshot?.settings.vanCapacity ?? 1) * 0.8 ? "#ef4444" : "#10b981",
                    }}
                  />
                </View>
              </View>
              
              <View className="mt-4 flex-row flex-wrap gap-2">
                <Pressable
                  onPress={() => {
                    const next = !includeHelper;
                      setIncludeHelper(next);
                      setCommittedIncludeHelper(next);
                      setIsRouteStale(false);
                      enhancedRouteQuery.refetch();
                    }}
                  style={({ pressed }) => ({
                    paddingHorizontal: 12,
                    paddingVertical: 8,
                    borderRadius: 8,
                    backgroundColor: includeHelper ? "rgba(34, 197, 94, 0.2)" : "rgba(255, 255, 255, 0.1)",
                    borderWidth: 1,
                    borderColor: includeHelper ? "rgba(34, 197, 94, 0.4)" : "rgba(255, 255, 255, 0.2)",
                    opacity: pressed ? 0.7 : 1,
                  })}
                >
                  <Text className="text-xs font-semibold text-white">{includeHelper ? "✓" : "○"} Helper</Text>
                </Pressable>
                <Pressable
                  onPress={() => {
                    const next = !returnToUnit;
                      setReturnToUnit(next);
                      setCommittedReturnToUnit(next);
                      setIsRouteStale(false);
                      enhancedRouteQuery.refetch();
                    }}
                  style={({ pressed }) => ({
                    paddingHorizontal: 12,
                    paddingVertical: 8,
                    borderRadius: 8,
                    backgroundColor: returnToUnit ? "rgba(34, 197, 94, 0.2)" : "rgba(255, 255, 255, 0.1)",
                    borderWidth: 1,
                    borderColor: returnToUnit ? "rgba(34, 197, 94, 0.4)" : "rgba(255, 255, 255, 0.2)",
                    opacity: pressed ? 0.7 : 1,
                  })}
                >
                  <Text className="text-xs font-semibold text-white">{returnToUnit ? "✓" : "○"} Return Unit</Text>
                </Pressable>
                <View className="rounded-full bg-slate-600/50 px-3 py-2">
                  <Text className="text-xs font-medium text-slate-100">{displayRoute?.summary.totalJobs} jobs</Text>
                </View>
                <View className="rounded-full bg-slate-600/50 px-3 py-2">
                  <Text className="text-xs font-medium text-slate-100">
                    {displayRoute?.summary.estimatedTravelMinutes} min driving
                  </Text>
                </View>
              </View>

              <Pressable
                onPress={handleEmptyVan}
                style={({ pressed }) => ({
                  marginTop: 12,
                  minHeight: 48,
                  paddingHorizontal: 14,
                  paddingVertical: 12,
                  borderRadius: 10,
                  backgroundColor: "rgba(239, 68, 68, 0.22)",
                  borderWidth: 1,
                  borderColor: "rgba(248, 113, 113, 0.55)",
                  opacity: pressed ? 0.75 : 1,
                  alignItems: "center",
                  justifyContent: "center",
                })}
              >
                <Text className="text-sm font-bold text-white">Empty Van</Text>
                <Text className="mt-1 text-xs font-semibold text-red-100">
                  Adds a unit return from your current place in the route.
                </Text>
              </Pressable>
            </View>

            <View className="rounded-[28px] border border-border bg-surface p-4">
              <Text className="text-xs font-semibold uppercase tracking-wide text-muted">Live changes</Text>
              <Text className="mt-2 text-sm leading-6 text-foreground">{liveChangeText}</Text>
            </View>

            <View className="mt-4 rounded-[28px] border border-border bg-surface p-4">
              <Text className="text-xs font-semibold uppercase tracking-wide text-muted">Starting addresses</Text>
              <View className="mt-3 gap-3">
                <View>
                  <Text className="text-xs text-muted">Driver starting address</Text>
                  <Text className="mt-1 text-sm font-semibold text-foreground">{snapshot?.settings.unitAddress}</Text>
                </View>
                {snapshot?.selectedHelper && (
                  <View>
                    <Text className="text-xs text-muted">Helper starting address</Text>
                    <Text className="mt-1 text-sm font-semibold text-foreground">{snapshot.selectedHelper.name}</Text>
                  </View>
                )}
              </View>
            </View>

            <Text className="mt-6 text-xs font-semibold uppercase tracking-wide text-muted">Route timeline</Text>
          </View>
        }
      />
      {showResetConfirm && (
        <View className="absolute inset-0 flex items-center justify-center bg-black/50">
          <View className="mx-4 rounded-2xl bg-background p-6 shadow-lg">
            <Text className="text-lg font-bold text-foreground">Reset to Optimized Route?</Text>
            <Text className="mt-2 text-sm text-muted">
              This will discard your custom route order and revert to the AI-optimized sequence. This action cannot be undone.
            </Text>
            <View className="mt-6 flex-row gap-3">
              <Pressable
                onPress={handleCancelReset}
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
                <Text className="text-center font-semibold text-foreground">Cancel</Text>
              </Pressable>
              <Pressable
                onPress={handleConfirmReset}
                style={({ pressed }) => ({
                  flex: 1,
                  paddingVertical: 12,
                  paddingHorizontal: 16,
                  borderRadius: 8,
                  backgroundColor: colors.error,
                  opacity: pressed ? 0.7 : 1,
                })}
              >
                <Text className="text-center font-semibold text-white">Reset Route</Text>
              </Pressable>
            </View>
          </View>
        </View>
      )}
      <HistoryPanel
        history={getHistoryQuery.data?.map((item) => ({
          id: item.id,
          changeType: item.changeType,
          createdAt: new Date(item.createdAt),
        })) || []}
        onRevert={handleRevertToVersion}
        isLoading={revertToHistoryMutation.isPending}
      />
    </ScreenContainer>
  );
}
