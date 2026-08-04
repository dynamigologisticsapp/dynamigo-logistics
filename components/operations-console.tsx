import { type Dispatch, type ReactNode, type SetStateAction, useMemo, useState, useEffect } from "react";
import { Alert, Image, Linking, Modal, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import * as ImagePicker from "expo-image-picker";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { DatePicker } from "@/components/date-picker";
import { ScreenContainer } from "@/components/screen-container";
import { AddressSearch } from "@/components/address-search";
import { trpc } from "@/lib/trpc";
import { useRouteDate } from "@/lib/route-date-context";
import { useEnhancedRoute } from "@/lib/use-enhanced-route";
import { formatDateParts, parseDateKey } from "@/lib/date-key";
import {
  TOWN_OPTIONS,
  getTownLabel,
  todayKey,
  type JobRecord,
  type JobType,
  type HelperRecord,
  type OperationsSnapshot,
  type RoutePlan,
  type RouteStop,
  type TownId,
  type VanRecord,
} from "@/shared/route-planner";

const TOWN_IDS = Object.keys(TOWN_OPTIONS) as string[];
const EMPTY_JOBS: JobRecord[] = [];
const PANEL_TITLES = {
  route: "Driver Route",
  jobs: "Jobs Board",
  planner: "Day Planner",
  settings: "Settings",
} as const;

type PanelKey = keyof typeof PANEL_TITLES;

function inferTownIdFromAddress(address: string, fallback: TownId = "falkirk"): TownId {
  const addressLower = address.toLowerCase();
  const foundTown = TOWN_IDS.find((townId) => {
    const town = TOWN_OPTIONS[townId as keyof typeof TOWN_OPTIONS];
    return addressLower.includes(town.label.toLowerCase());
  });

  return (foundTown as TownId | undefined) ?? fallback;
}

interface OperationsConsoleProps {
  panel: PanelKey;
  setIsRouteStale?: (stale: boolean) => void;
}

interface JobFormState {
  customerName: string;
  contactName: string;
  contactPhone: string;
  addressLine: string;
  latitude?: number;
  longitude?: number;
  townId: string;
  type: "pickup" | "delivery" | "both";
  sofaCount: string;
  pickupCount: string;
  scheduledDay: string;
  timeWindow: string;
  floor: string;
  duration: string;
  notes: string;
  photoUri: string;
}

export function OperationsConsole({ panel, setIsRouteStale: propsSetIsRouteStale }: OperationsConsoleProps) {
  const insets = useSafeAreaInsets();
  const {
    selectedDate: dateKey,
    setSelectedDate: setDateKey,
    isRouteStale,
    setIsRouteStale: contextSetIsRouteStale,
    includeHelper,
    returnToUnit,
    setCommittedIncludeHelper,
    setCommittedReturnToUnit,
    setCustomRouteOrder,
    clearCompletedRouteStops,
  } = useRouteDate();
  const setIsRouteStale = propsSetIsRouteStale || contextSetIsRouteStale;
  const enhancedRouteQuery = useEnhancedRoute();
  
  const buildInitialForm = (): JobFormState => ({
    customerName: "",
    contactName: "",
    contactPhone: "",
    addressLine: "",
    latitude: undefined,
    longitude: undefined,
    townId: "",
    type: "delivery",
    sofaCount: "1",
    pickupCount: "1",
    scheduledDay: dateKey,
    timeWindow: "",
    floor: "",
    duration: "30",
    notes: "",
    photoUri: "",
  })
  
  const [form, setForm] = useState<JobFormState>(() => buildInitialForm());
  const [editingJobId, setEditingJobId] = useState<string | null>(null);

  const utils = trpc.useUtils();
  const snapshotQuery = trpc.operations.snapshot.useQuery(
    { dateKey },
    {
      refetchInterval: 12000,
      retry: 1,
    },
  );

  const refreshSnapshot = async () => {
    await utils.operations.snapshot.invalidate({ dateKey });
  };

  const recalculateRouteAfterJobChange = async () => {
    setCommittedIncludeHelper(includeHelper);
    setCommittedReturnToUnit(returnToUnit);
    setCustomRouteOrder(null);
    clearCompletedRouteStops();
    await refreshSnapshot();
    await utils.operations.enhancedRoutePlan.fetch({ dateKey, includeHelper, returnToUnit });
    await enhancedRouteQuery.refetch();
    setIsRouteStale(false);
  };

  const createJobMutation = trpc.operations.createJob.useMutation({
    onSuccess: async () => {
      setForm(buildInitialForm());
      setEditingJobId(null);
      await recalculateRouteAfterJobChange();
      // Auto-navigate to Route tab after job is created
      // This will be handled by the parent component
    },
  });

  const updateJobMutation = trpc.operations.updateJob.useMutation({
    onSuccess: async () => {
      setForm(buildInitialForm());
      setEditingJobId(null);
      await recalculateRouteAfterJobChange();
    },
  });

  const cancelJobMutation = trpc.operations.cancelJob.useMutation({
    onSuccess: async () => {
      await recalculateRouteAfterJobChange();
    },
  });

  const deleteJobMutation = trpc.operations.deleteJob.useMutation({
    onSuccess: async () => {
      await recalculateRouteAfterJobChange();
    },
  });

  const completeJobMutation = trpc.operations.completeJob.useMutation({
    onSuccess: async () => {
      await recalculateRouteAfterJobChange();
    },
  });

  const updateSettingsMutation = trpc.operations.updateSettings.useMutation({
    onSuccess: refreshSnapshot,
  });

  const resetMutation = trpc.operations.reset.useMutation({
    onSuccess: async () => {
      setForm(buildInitialForm());
      setEditingJobId(null);
      await refreshSnapshot();
    },
  });

  const snapshot = snapshotQuery.data as OperationsSnapshot | undefined;
  const todaysJobs = snapshot?.todaysJobs ?? EMPTY_JOBS;
  const activeJobs = snapshot?.activeJobs ?? EMPTY_JOBS;
  const routePlan = snapshot?.routePlan;

  const isBusy =
    snapshotQuery.isLoading ||
    createJobMutation.isPending ||
    updateJobMutation.isPending ||
    cancelJobMutation.isPending ||
    deleteJobMutation.isPending ||
    completeJobMutation.isPending ||
    updateSettingsMutation.isPending ||
    resetMutation.isPending;

  // Update form scheduledDay when dateKey changes
  useEffect(() => {
    setForm((current) => ({ ...current, scheduledDay: dateKey }));
  }, [dateKey]);

  const changeSummary = useMemo(() => {
    const cancelled = todaysJobs.filter((job) => job.status === "cancelled").length;
    const completed = todaysJobs.filter((job) => job.status === "completed").length;
    const scheduled = todaysJobs.filter((job) => job.status === "scheduled").length;

    return { cancelled, completed, scheduled };
  }, [todaysJobs]);

  const handleSaveJob = async () => {
    if (!form.customerName.trim() || !form.contactName.trim() || !form.addressLine.trim()) {
      showMessage("Please fill in the customer, contact, and address fields before saving the job.");
      return;
    }
    if (form.latitude === undefined || form.longitude === undefined) {
      showMessage("Please select an address from the search results to get coordinates.");
      return;
    }
    const basePayload = {
      customerName: form.customerName.trim(),
      contactName: form.contactName.trim(),
      contactPhone: form.contactPhone.trim() || "No number provided",
      addressLine: form.addressLine.trim(),
      latitude: form.latitude as number,
      longitude: form.longitude as number,
      townId: (form.townId || "falkirk") as any,
      scheduledDay: form.scheduledDay,
      timeWindow: form.timeWindow.trim() || "Flexible",
      floor: form.floor.trim(),
      duration: Math.max(15, Number(form.duration) || 30),
      notes: form.notes.trim(),
      photoUri: form.photoUri || undefined,
    };
    
    const parseSofaCount = (value: string, fallback = 1, minimum = 0) => {
      const parsed = Number(value);
      return Number.isFinite(parsed) ? Math.max(minimum, Math.min(6, parsed)) : fallback;
    };
    const deliveryCount = parseSofaCount(form.sofaCount, 1, 0.1);
    const pickupCount = parseSofaCount(form.pickupCount || form.sofaCount, form.type === "delivery" ? 0 : 1, form.type === "delivery" ? 0 : 0.1);

    if (editingJobId) {
      // Update existing job
      const payload = {
        type: form.type as any,
        sofaCount: form.type === "pickup" ? pickupCount : deliveryCount,
        pickupCount: form.type === "delivery" ? 0 : pickupCount,
        ...basePayload,
      };
      await updateJobMutation.mutateAsync({ id: editingJobId, ...payload } as any);
      return;
    }
    
    const payload = {
      type: form.type,
      sofaCount: form.type === "pickup" ? pickupCount : deliveryCount,
      pickupCount: form.type === "delivery" ? 0 : pickupCount,
      ...basePayload,
    };
    await createJobMutation.mutateAsync(payload);
  };

  const handleEditJob = (job: JobRecord) => {
    setEditingJobId(job.id);
    setForm({
      customerName: job.customerName,
      contactName: job.contactName,
      contactPhone: job.contactPhone,
      addressLine: job.addressLine,
      townId: job.townId || "",
      type: job.type,
      sofaCount: String(job.sofaCount),
      pickupCount: String(job.pickupCount || job.sofaCount),
      scheduledDay: job.scheduledDay,
      timeWindow: job.timeWindow,
      floor: job.floor || "",
      duration: String(job.duration || 30),
      notes: job.notes ?? "",
      photoUri: job.photoUri ?? "",
      latitude: typeof job.latitude === 'number' ? job.latitude : undefined,
      longitude: typeof job.longitude === 'number' ? job.longitude : undefined,
    });
  };

  const handleCancelJob = async (job: JobRecord) => {
    await cancelJobMutation.mutateAsync({ id: job.id, dateKey });
  };

  const handleDeleteJob = async (job: JobRecord) => {
    const deleteNow = async () => {
      await deleteJobMutation.mutateAsync({ id: job.id, dateKey });
    };

    if (Platform.OS === "web") {
      const confirmed =
        typeof window === "undefined" ||
        window.confirm(`Delete ${job.customerName}? This removes the job from ${job.scheduledDay}.`);
      if (confirmed) {
        await deleteNow();
      }
      return;
    }

    Alert.alert("Delete job", `Remove ${job.customerName} from ${job.scheduledDay}?`, [
      { text: "Cancel", style: "cancel" },
      { text: "Delete", style: "destructive", onPress: () => void deleteNow() },
    ]);
  };

  const handleRescheduleJob = async (job: JobRecord) => {
    // Update job status back to scheduled
    await updateJobMutation.mutateAsync({
      id: job.id,
      status: "scheduled",
    });
    // Load the job into the form for editing
    setEditingJobId(job.id);
    const latitude = job.latitude == null ? undefined : Number(job.latitude);
    const longitude = job.longitude == null ? undefined : Number(job.longitude);
    setForm({
      customerName: job.customerName,
      contactName: job.contactName,
      contactPhone: job.contactPhone,
      addressLine: job.addressLine,
      townId: job.townId || "",
      type: job.type,
      sofaCount: String(job.sofaCount),
      pickupCount: String(job.pickupCount || job.sofaCount),
      scheduledDay: job.scheduledDay,
      timeWindow: job.timeWindow,
      floor: job.floor || "",
      duration: String(job.duration || 30),
      notes: job.notes ?? "",
      photoUri: job.photoUri ?? "",
      latitude: Number.isFinite(latitude) ? latitude : undefined,
      longitude: Number.isFinite(longitude) ? longitude : undefined,
    });
  };

  const handleMarkDone = async (job: JobRecord) => {
    await completeJobMutation.mutateAsync({ id: job.id, dateKey });
  };

  const resetForm = () => {
    setEditingJobId(null);
    setForm(buildInitialForm());
  };

  const incrementCapacity = async () => {
    if (!snapshot) return;
    const nextCapacity = Math.max(1, Math.min(6, snapshot.settings.vanCapacity + 1));
    await updateSettingsMutation.mutateAsync({ vanCapacity: nextCapacity, dateKey });
  };

  return (
    <ScreenContainer className="bg-background" edges={["top", "left", "right"]}>
      <ScrollView
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="none"
        contentContainerStyle={{
          paddingHorizontal: 20,
          paddingTop: 16,
          // SafeAreaView already applies the top inset. Add fixed breathing
          // room below the content for the tab bar and keyboard.
          paddingBottom: Math.max(insets.bottom, 12) + 112,
          gap: 16,
        }}
      >
        <View style={styles.heroCard}>
          <Text style={styles.eyebrow}>Dynamigo Logistics</Text>
          <Text style={styles.heroTitle}>{PANEL_TITLES[panel]}</Text>
          <Text style={styles.heroText}>
            Mobile-first route planning for pickups, deliveries, helper collection, and unit returns.
          </Text>
          <View style={styles.inlineRowWrap}>
            <MetricPill label="Day" value={dateKey} />
            <MetricPill label="Live jobs" value={String(activeJobs.length)} />
            <MetricPill label="Busy" value={isBusy ? "Yes" : "No"} />
          </View>
          <DateSelector
            dateKey={dateKey}
            onChange={(next) => {
              setDateKey(next);
              setForm((current) => ({ ...current, scheduledDay: next }));
            }}
          />
        </View>

        {snapshotQuery.isLoading && !snapshot ? <StatusBanner tone="info" text="Loading the shared route snapshot." /> : null}
        {snapshotQuery.error ? (
          <StatusBanner tone="error" text="The route snapshot could not be loaded. Try refresh or reset the day plan." />
        ) : null}

        {panel === "route" ? (
          <RoutePanel routePlan={routePlan} todaysJobs={todaysJobs} dateKey={dateKey} onMarkDone={handleMarkDone} />
        ) : null}

        {panel === "jobs" ? (
          <JobsPanel
            form={form}
            setForm={setForm}
            editingJobId={editingJobId}
            onSave={handleSaveJob}
            onReset={resetForm}
            jobs={todaysJobs}
            activeDate={dateKey}
            isBusy={isBusy}
            onEditJob={handleEditJob}
            onCancelJob={handleCancelJob}
            onDeleteJob={handleDeleteJob}
            onRescheduleJob={handleRescheduleJob}
          />
        ) : null}

        {panel === "planner" ? (
          <PlannerPanel
            routePlan={routePlan}
            todaysJobs={todaysJobs}
            changeSummary={changeSummary}
            onRefresh={refreshSnapshot}
            onReset={async () => resetMutation.mutateAsync({ dateKey })}
          />
        ) : null}

        {panel === "settings" ? (
          <SettingsPanel snapshot={snapshot} dateKey={dateKey} onIncreaseCapacity={incrementCapacity} onRefresh={refreshSnapshot} />
        ) : null}
      </ScrollView>
    </ScreenContainer>
  );
}

function RoutePanel({
  routePlan,
  todaysJobs,
  dateKey,
  onMarkDone,
}: {
  routePlan: RoutePlan | undefined;
  todaysJobs: JobRecord[];
  dateKey: string;
  onMarkDone: (job: JobRecord) => Promise<void>;
}) {
  const [includeHelper, setIncludeHelper] = useState(true);
  const [returnToUnit, setReturnToUnit] = useState(true);
  const [expandedStopIds, setExpandedStopIds] = useState<Record<string, boolean>>({});

  if (!routePlan) {
    return <StatusBanner tone="info" text="No route data is available yet for this day." />;
  }

  const nextJob = todaysJobs.find((job) => job.id === routePlan.nextStop?.relatedJobId);
  
  // Filter stops based on toggles
  const filteredStops = routePlan.stops.filter((stop) => {
    if (stop.kind === "helper" && !includeHelper) return false;
    if (stop.kind === "unit" && !returnToUnit) return false;
    return true;
  });

  return (
    <>
      <SectionCard title="Live route summary" subtitle={routePlan.routeHeadline}>
        <View style={styles.gridTwo}>
          <MetricCard
            label="Next stop"
            value={routePlan.nextStop ? routePlan.nextStop.label : "No stop"}
            helper={routePlan.nextStop ? getTownLabel(routePlan.nextStop.townId) : "Day complete"}
          />
          <MetricCard
            label="Route stops"
            value={String(routePlan.summary.totalStops)}
            helper={`${routePlan.summary.estimatedTravelMinutes} travel min`}
          />
          <MetricCard
            label="Starting load"
            value={`${routePlan.summary.startingLoad} sofas`}
            helper={`Final load ${routePlan.summary.finalLoad}`}
          />
          <MetricCard
            label="Helper"
            value={routePlan.selectedHelper?.name ?? "Unassigned"}
            helper={routePlan.helperReason}
          />
        </View>
        {nextJob ? (
          <View style={styles.highlightCard}>
            <Text style={styles.highlightTitle}>Current actionable stop</Text>
            <Text style={styles.highlightText}>
              {nextJob.type === "pickup" ? "Pickup" : "Delivery"} for {nextJob.customerName} in {nextJob.townId ? getTownLabel(nextJob.townId) : "Unknown town"}.
            </Text>
            <Text style={styles.mutedText}>
              Van load changes {routePlan.nextStop?.loadBefore} → {routePlan.nextStop?.loadAfter}. Window: {nextJob.timeWindow}.
            </Text>
            <Pressable style={({ pressed }) => [styles.primaryButton, pressed && styles.buttonPressed]} onPress={() => onMarkDone(nextJob)}>
              <Text style={styles.primaryButtonText}>Mark current stop complete</Text>
            </Pressable>
          </View>
        ) : null}
      </SectionCard>

      <SectionCard title="Route Options" subtitle="Customize your route">
        <Pressable onPress={() => setIncludeHelper(!includeHelper)} style={{ paddingVertical: 12, paddingHorizontal: 16, backgroundColor: includeHelper ? "#1E5EFF" : "#E0E6F0", borderRadius: 8, marginBottom: 12 }}>
          <Text style={{ color: includeHelper ? "white" : "#10233D", fontWeight: "600" }}>
            {includeHelper ? "✓" : "○"} Pick up helper at start
          </Text>
        </Pressable>
        <Pressable onPress={() => setReturnToUnit(!returnToUnit)} style={{ paddingVertical: 12, paddingHorizontal: 16, backgroundColor: returnToUnit ? "#1E5EFF" : "#E0E6F0", borderRadius: 8 }}>
          <Text style={{ color: returnToUnit ? "white" : "#10233D", fontWeight: "600" }}>
            {returnToUnit ? "✓" : "○"} Return to unit at end
          </Text>
        </Pressable>
      </SectionCard>

      <SectionCard title="Route timeline" subtitle={`Ordered for ${dateKey} with capacity-aware sequencing.`}>
        <View style={styles.stackGap}>
          {filteredStops.map((stop, index) => (
            <RouteTimelineStop
              key={stop.id}
              stop={stop}
              index={index}
              jobs={todaysJobs}
              followingStops={filteredStops.slice(index + 1)}
              isExpanded={!!expandedStopIds[stop.id]}
              onToggle={() => setExpandedStopIds((current) => ({ ...current, [stop.id]: !current[stop.id] }))}
              onMarkDone={onMarkDone}
            />
          ))}
        </View>
      </SectionCard>
    </>
  );
}

function RouteTimelineStop({
  stop,
  index,
  jobs,
  followingStops,
  isExpanded,
  onToggle,
  onMarkDone,
}: {
  stop: RouteStop;
  index: number;
  jobs: JobRecord[];
  followingStops: RouteStop[];
  isExpanded: boolean;
  onToggle: () => void;
  onMarkDone: (job: JobRecord) => Promise<void>;
}) {
  const job = jobs.find((item) => item.id === stop.relatedJobId);
  const loadJobs = getUnitLoadJobs(stop, followingStops, jobs);
  const canShowDetails = stop.kind === "job" || loadJobs.length > 0;

  return (
    <View style={[styles.stopCard, styles.darkStopCard]}>
              <View style={styles.stopHeader}>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.stopIndex, styles.darkStopMeta]}>Stop {index + 1}</Text>
                  <Text style={[styles.stopTitle, styles.darkStopTitle]}>{stop.label}</Text>
                </View>
                <Text style={[styles.stopEta, styles.darkStopTitle]}>ETA +{stop.etaMinutesFromStart} min</Text>
              </View>
              <Text style={[styles.stopMeta, styles.darkStopMeta]}>
                {stop.kind === "job" ? `${capitalize(stop.type ?? "job")} · ` : ""}
                {getTownLabel(stop.townId)} · {stop.addressLine}
              </Text>
              <Text style={[styles.stopMeta, styles.darkStopMeta]}>
                Load {stop.loadBefore} → {stop.loadAfter} · travel {stop.travelMinutesFromPrevious} min
              </Text>
              <Text style={[styles.stopReason, styles.darkStopReason]}>{stop.reason}</Text>
              {canShowDetails ? (
                <>
                  <Pressable
                    onPress={onToggle}
                    style={({ pressed }) => [styles.expandButton, pressed && styles.buttonPressed]}
                  >
                    <Text style={styles.expandButtonText}>{isExpanded ? "Hide job details" : "Show job details"} {isExpanded ? "▲" : "▼"}</Text>
                  </Pressable>
                  {isExpanded && stop.kind === "job" ? <RouteJobDetails job={job} /> : null}
                  {isExpanded && stop.kind === "unit" ? <UnitLoadDetails jobs={loadJobs} /> : null}
                  {job?.status === "scheduled" ? (
                    <Pressable style={({ pressed }) => [styles.completeBar, pressed && styles.buttonPressed]} onPress={() => onMarkDone(job)}>
                      <Text style={styles.completeBarText}>✓ Mark job complete</Text>
                    </Pressable>
                  ) : null}
                </>
              ) : null}
            </View>
  );
}

function callPhoneNumber(phoneNumber: string) {
  const normalized = phoneNumber.replace(/[^\d+]/g, "");
  if (!normalized) return;
  Linking.openURL(`tel:${normalized}`).catch(() => {
    Alert.alert("Phone", "This device could not start a phone call.");
  });
}

function PhotoPreview({ uri, size = 72 }: { uri?: string; size?: number }) {
  const [isOpen, setIsOpen] = useState(false);
  if (!uri) return null;

  return (
    <>
      <Pressable
        onPress={() => setIsOpen(true)}
        style={({ pressed }) => [
          styles.photoThumbButton,
          { width: size, height: size },
          pressed && styles.buttonPressed,
        ]}
      >
        <Image source={{ uri }} style={styles.photoThumbImage} />
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

function RouteJobDetails({ job }: { job?: JobRecord }) {
  if (!job) {
    return <Text style={styles.darkStopMeta}>No job details found for this stop.</Text>;
  }

  return (
    <View style={styles.expandedJobDetails}>
      <View style={styles.jobDetailTextColumn}>
        <Text style={styles.darkStopTitle}>{job.customerName}</Text>
        <Text style={styles.darkStopMeta}>{job.contactName}</Text>
        <Pressable onPress={() => callPhoneNumber(job.contactPhone)}>
          <Text style={styles.phoneText}>{job.contactPhone}</Text>
        </Pressable>
        <Text style={styles.darkStopReason}>
          {job.type === "pickup" ? `Pickup: ${job.pickupCount || job.sofaCount} sofas` : job.type === "delivery" ? `Delivery: ${job.sofaCount} sofas` : `Delivery: ${job.sofaCount} sofas, Pickup: ${job.pickupCount} sofas`}
        </Text>
        <Text style={styles.darkStopReason}>{job.floor ? `Floor: ${job.floor}. ` : ""}{job.notes || "No notes."}</Text>
      </View>
      <View style={styles.cardBottomRightPhoto}>
        <PhotoPreview uri={job.photoUri} />
      </View>
    </View>
  );
}

function getUnitLoadJobs(stop: RouteStop, followingStops: RouteStop[], jobs: JobRecord[]) {
  if (stop.kind !== "unit") {
    return (stop.loadJobIds ?? [])
      .map((jobId) => jobs.find((item) => item.id === jobId))
      .filter((item): item is JobRecord => !!item);
  }

  const directJobs = (stop.loadJobIds ?? [])
    .map((jobId) => jobs.find((item) => item.id === jobId))
    .filter((item): item is JobRecord => !!item);
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

function UnitLoadDetails({ jobs }: { jobs: JobRecord[] }) {
  if (!jobs.length) {
    return <Text style={styles.darkStopMeta}>No delivery load order is needed for this unit stop.</Text>;
  }

  const loadOrder = [...jobs].reverse();

  return (
    <View style={styles.expandedJobDetails}>
      <View style={styles.jobDetailTextColumn}>
        <Text style={styles.darkStopTitle}>Van load order</Text>
        <Text style={styles.darkStopReason}>Load the last delivery first, then work backwards.</Text>
        {loadOrder.map((job, index) => (
          <View key={job.id} style={styles.loadOrderRow}>
            <Text style={styles.loadOrderNumber}>{index + 1}</Text>
            <View style={{ flex: 1 }}>
              <Text style={styles.darkStopTitle}>{job.customerName}</Text>
              <Text style={styles.darkStopMeta}>{job.addressLine}</Text>
              <Text style={styles.darkStopReason}>{job.sofaCount} sofas</Text>
            </View>
            <PhotoPreview uri={job.photoUri} size={56} />
          </View>
        ))}
      </View>
    </View>
  );
}

function JobPhotoPicker({
  photoUri,
  onChange,
}: {
  photoUri: string;
  onChange: (uri: string) => void;
}) {
  const [isLoading, setIsLoading] = useState(false);

  const pickPhoto = async (source: "camera" | "library") => {
    setIsLoading(true);
    try {
      if (source === "camera" && Platform.OS !== "web") {
        const permission = await ImagePicker.requestCameraPermissionsAsync();
        if (permission.status !== "granted") {
          Alert.alert("Camera", "Camera permission is needed to take a stock photo.");
          return;
        }
      }
      const result =
        source === "camera"
          ? await ImagePicker.launchCameraAsync({ allowsEditing: true, aspect: [4, 3], quality: 0.45, base64: true })
          : await ImagePicker.launchImageLibraryAsync({ allowsEditing: true, aspect: [4, 3], quality: 0.45, base64: true });

      const asset = result.canceled ? null : result.assets[0];
      if (asset?.base64) {
        onChange(`data:${asset.mimeType || "image/jpeg"};base64,${asset.base64}`);
      } else if (asset?.uri) {
        onChange(asset.uri);
      }
    } catch {
      Alert.alert("Photo", "Could not attach that photo.");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <View style={styles.photoPickerRow}>
      <View style={{ flex: 1, gap: 8 }}>
        <View style={styles.inlineRowWrap}>
          <SmallAction label={isLoading ? "Opening..." : "Take photo"} onPress={() => pickPhoto("camera")} />
          <SmallAction label="Choose photo" onPress={() => pickPhoto("library")} />
          {photoUri ? <SmallAction label="Remove" onPress={() => onChange("")} tone="danger" /> : null}
        </View>
        <Text style={styles.mutedText}>Attach a stock photo for this job. It appears on the job and route cards.</Text>
      </View>
      <PhotoPreview uri={photoUri} size={74} />
    </View>
  );
}

function JobsPanel({
  form,
  setForm,
  editingJobId,
  onSave,
  onReset,
  jobs,
  activeDate,
  isBusy,
  onEditJob,
  onCancelJob,
  onDeleteJob,
  onRescheduleJob,
}: {
  form: JobFormState;
  setForm: Dispatch<SetStateAction<JobFormState>>;
  editingJobId: string | null;
  onSave: () => Promise<void>;
  onReset: () => void;
  jobs: JobRecord[];
  activeDate: string;
  isBusy: boolean;
  onEditJob: (job: JobRecord) => void;
  onCancelJob: (job: JobRecord) => Promise<void>;
  onDeleteJob: (job: JobRecord) => Promise<void>;
  onRescheduleJob: (job: JobRecord) => Promise<void>;
}) {
  const toggleJobType = (kind: "pickup" | "delivery") => {
    setForm((current) => {
      const hasPickup = current.type === "pickup" || current.type === "both";
      const hasDelivery = current.type === "delivery" || current.type === "both";
      const nextHasPickup = kind === "pickup" ? !hasPickup : hasPickup;
      const nextHasDelivery = kind === "delivery" ? !hasDelivery : hasDelivery;
      const nextType: JobType = nextHasPickup && nextHasDelivery
        ? "both"
        : nextHasPickup
          ? "pickup"
          : "delivery";

      return { ...current, type: nextType };
    });
  };

  return (
    <>
      <SectionCard title="Job form" subtitle="Sales staff can add or update pickups and deliveries while the driver is on the road.">
        <View style={styles.stackGap}>
          <Field label="Customer / job label">
            <TextInput
              value={form.customerName}
              onChangeText={(value) => setForm((current) => ({ ...current, customerName: value }))}
              placeholder="Example: Falkirk Delivery"
              placeholderTextColor="#607086"
              style={styles.input}
            />
          </Field>
          <Field label="Contact name">
            <TextInput
              value={form.contactName}
              onChangeText={(value) => setForm((current) => ({ ...current, contactName: value }))}
              placeholder="Customer contact"
              placeholderTextColor="#607086"
              style={styles.input}
            />
          </Field>
          <Field label="Contact phone">
            <TextInput
              value={form.contactPhone}
              onChangeText={(value) => setForm((current) => ({ ...current, contactPhone: value }))}
              placeholder="07300 555 000"
              placeholderTextColor="#607086"
              style={styles.input}
              keyboardType="phone-pad"
            />
          </Field>
          <Field label="Address line">
            <AddressSearch
              value={form.addressLine}
              onChange={(address: string, postcode: string, latitude?: number, longitude?: number) => {
                // Extract town from address if available
                let townId = form.townId || "falkirk";
                const addressLower = address.toLowerCase();
                if (addressLower.includes("london")) townId = "london";
                else if (addressLower.includes("glasgow")) townId = "glasgow";
                else if (addressLower.includes("edinburgh")) townId = "edinburgh";
                else if (addressLower.includes("manchester")) townId = "manchester";
                else if (addressLower.includes("birmingham")) townId = "birmingham";
                
                setForm((current) => ({
                  ...current,
                  addressLine: address,
                  townId: townId,
                  latitude,
                  longitude,
                }));
              }}
              placeholder="Search address or postcode"
            />
          </Field>

          <Field label="Job type - tap to toggle">
            <View style={styles.typeToggleRow}>
              <Pressable
                style={({ pressed }) => [
                  styles.typeToggleButton,
                  (form.type === "pickup" || form.type === "both") && styles.typeToggleButtonActive,
                  pressed && styles.buttonPressed,
                ]}
                onPress={() => toggleJobType("pickup")}
              >
                <Text
                  style={[
                    styles.typeToggleButtonText,
                    (form.type === "pickup" || form.type === "both") && styles.typeToggleButtonTextActive,
                  ]}
                >
                  Pickup
                </Text>
              </Pressable>
              <Pressable
                style={({ pressed }) => [
                  styles.typeToggleButton,
                  (form.type === "delivery" || form.type === "both") && styles.typeToggleButtonActive,
                  pressed && styles.buttonPressed,
                ]}
                onPress={() => toggleJobType("delivery")}
              >
                <Text
                  style={[
                    styles.typeToggleButtonText,
                    (form.type === "delivery" || form.type === "both") && styles.typeToggleButtonTextActive,
                  ]}
                >
                  Delivery
                </Text>
              </Pressable>
            </View>
            <Text style={styles.mutedText}>
              {form.type === "pickup" && "Pickup only - add sofas to van"}
              {form.type === "delivery" && "Delivery only - remove sofas from van"}
              {form.type === "both" && "Delivery and removal at the same address"}
            </Text>
          </Field>
          {(form.type === "delivery" || form.type === "both") ? (
          <Field label="Delivery sofa amount">
            <TextInput
              value={form.sofaCount}
              onChangeText={(value) => setForm((current) => ({ ...current, sofaCount: value }))}
              placeholder="1 or 1.5"
              placeholderTextColor="#607086"
              style={styles.input}
              keyboardType="decimal-pad"
            />
            <Text style={styles.mutedText}>
              Clean stock loaded from the unit for this delivery.
            </Text>
          </Field>
          ) : null}
          {(form.type === "pickup" || form.type === "both") ? (
          <Field label="Pickup sofa amount">
            <TextInput
              value={form.pickupCount}
              onChangeText={(value) => setForm((current) => ({ ...current, pickupCount: value }))}
              placeholder="1 or 0.8"
              placeholderTextColor="#607086"
              style={styles.input}
              keyboardType="decimal-pad"
            />
            <Text style={styles.mutedText}>
              Dirty return stock. It must go back to the unit before it can be reused.
            </Text>
          </Field>
          ) : null}
          <Field label="Time window">
            <TextInput
              value={form.timeWindow}
              onChangeText={(value) => setForm((current) => ({ ...current, timeWindow: value }))}
              placeholder="09:00 - 11:00"
              placeholderTextColor="#607086"
              style={styles.input}
            />
          </Field>
          <Field label="Floor">
            <TextInput
              value={form.floor}
              onChangeText={(value) => setForm((current) => ({ ...current, floor: value }))}
              placeholder="e.g., Ground, 1st, 2nd, Basement"
              placeholderTextColor="#607086"
              style={styles.input}
            />
          </Field>
          <Field label="Duration (minutes)">
            <TextInput
              value={form.duration}
              onChangeText={(value) => setForm((current) => ({ ...current, duration: value }))}
              placeholder="30"
              placeholderTextColor="#607086"
              style={styles.input}
              keyboardType="numeric"
            />
          </Field>
          <Field label="Notes">
            <TextInput
              value={form.notes}
              onChangeText={(value) => setForm((current) => ({ ...current, notes: value }))}
              placeholder="Access notes, customer requests, stair info"
              placeholderTextColor="#607086"
              style={[styles.input, styles.textArea]}
              multiline
              textAlignVertical="top"
            />
          </Field>
          <Field label="Stock photo">
            <JobPhotoPicker
              photoUri={form.photoUri}
              onChange={(photoUri) => setForm((current) => ({ ...current, photoUri }))}
            />
          </Field>
          <View style={styles.inlineRowWrap}>
            <Pressable
              style={({ pressed }) => [styles.primaryButton, pressed && styles.buttonPressed, isBusy && styles.buttonDisabled]}
              onPress={onSave}
              disabled={isBusy}
            >
              <Text style={styles.primaryButtonText}>{editingJobId ? "Save changes" : "Add job"}</Text>
            </Pressable>
            <Pressable style={({ pressed }) => [styles.secondaryButton, pressed && styles.buttonPressed]} onPress={onReset}>
              <Text style={styles.secondaryButtonText}>Clear form</Text>
            </Pressable>
          </View>
          <Text style={styles.mutedText}>
            Jobs shown below are filtered for {activeDate}. Pickups add sofas into the van; deliveries remove sofas from it.
          </Text>
        </View>
      </SectionCard>

      <SectionCard title="Live jobs board" subtitle="Designed to remain usable on a phone, while still reading cleanly on larger computer screens.">
        <View style={styles.stackGap}>
          {jobs.map((job) => (
            <View key={job.id} style={styles.jobCard}>
              <View style={styles.stopHeader}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.stopTitle}>{job.customerName}</Text>
                  <Text style={styles.stopMeta}>
                    {job.type === "both" ? "Pickup & Delivery" : capitalize(job.type)} · {job.timeWindow}
                  </Text>
                  <Text style={styles.stopMeta}>Date: {job.scheduledDay}</Text>
                </View>
                <StatusBadge status={job.status} />
              </View>
              <View style={styles.jobBodyRow}>
                <View style={styles.jobDetailTextColumn}>
                  <Text style={styles.stopTitle}>{job.addressLine}</Text>
                  <Pressable onPress={() => callPhoneNumber(job.contactPhone)}>
                    <Text style={styles.phoneText}>{job.contactName} · {job.contactPhone}</Text>
                  </Pressable>
                  <Text style={styles.stopReason}>
                    {job.type === "pickup" ? `Pickup: ${job.sofaCount} sofas` : job.type === "delivery" ? `Delivery: ${job.sofaCount} sofas` : `Delivery: ${job.sofaCount} sofas, Pickup: ${job.pickupCount} sofas`}. {job.notes || "No additional notes."}
                  </Text>
                </View>
                <View style={styles.cardBottomRightPhoto}>
                  <PhotoPreview uri={job.photoUri} />
                </View>
              </View>
              <View style={styles.inlineRowWrap}>
                {job.status === "scheduled" ? (
                  <>
                    <SmallAction label="Edit" onPress={() => onEditJob(job)} />
                    <SmallAction label="Cancel" onPress={() => onCancelJob(job)} tone="danger" />
                    <SmallAction label="Delete" onPress={() => onDeleteJob(job)} tone="danger" />
                  </>
                ) : job.status === "cancelled" ? (
                  <>
                    <SmallAction label="Reschedule" onPress={() => onRescheduleJob(job)} />
                    <SmallAction label="Delete" onPress={() => onDeleteJob(job)} tone="danger" />
                  </>
                ) : null}
              </View>
            </View>
          ))}
          {!jobs.length ? <Text style={styles.mutedText}>No jobs are scheduled for this day yet.</Text> : null}
        </View>
      </SectionCard>
    </>
  );
}

function PlannerPanel({
  routePlan,
  todaysJobs,
  changeSummary,
  onRefresh,
  onReset,
}: {
  routePlan: RoutePlan | undefined;
  todaysJobs: JobRecord[];
  changeSummary: { cancelled: number; completed: number; scheduled: number };
  onRefresh: () => Promise<void>;
  onReset: () => Promise<unknown>;
}) {
  return (
    <>
      <SectionCard title="Planner overview" subtitle="This screen gives the whole business a simple picture of the day before and during the run.">
        <View style={styles.gridTwo}>
          <MetricCard label="Scheduled jobs" value={String(changeSummary.scheduled)} helper="Still active in the route" />
          <MetricCard label="Completed" value={String(changeSummary.completed)} helper="Already finished" />
          <MetricCard label="Cancelled" value={String(changeSummary.cancelled)} helper="Removed from the route" />
          <MetricCard label="Unit returns" value={String(routePlan?.summary.unitReturns ?? 0)} helper="Storage reloads or drop-offs" />
        </View>
        <View style={styles.inlineRowWrap}>
          <Pressable style={({ pressed }) => [styles.primaryButton, pressed && styles.buttonPressed]} onPress={onRefresh}>
            <Text style={styles.primaryButtonText}>Refresh route</Text>
          </Pressable>
          <Pressable style={({ pressed }) => [styles.secondaryButton, pressed && styles.buttonPressed]} onPress={onReset}>
            <Text style={styles.secondaryButtonText}>Clear selected day</Text>
          </Pressable>
        </View>
      </SectionCard>

      <SectionCard title="Route explanation" subtitle="The goal is to make route changes easier to trust.">
        <View style={styles.stackGap}>
          <Text style={styles.bodyText}>{routePlan?.helperReason ?? "No helper recommendation is available yet."}</Text>
          <Text style={styles.bodyText}>
            The route starts with enough stock to cover today’s deliveries, then places deliveries or pickups according to travel time, van load, and whether the unit must be visited to protect capacity.
          </Text>
          <Text style={styles.bodyText}>
            When a new pickup would overflow the van, the route adds a unit stop before carrying on. When deliveries remain but the van is short of stock, the route returns to the unit to reload.
          </Text>
        </View>
      </SectionCard>

      <SectionCard title="Today’s sequence in plain language" subtitle="Useful for briefings with the sales team or helper.">
        <View style={styles.stackGap}>
          {todaysJobs.map((job, index) => (
            <Text key={job.id} style={styles.bodyText}>
              {index + 1}. {capitalize(job.type)} in {job.townId ? getTownLabel(job.townId) : "Unknown town"} for {job.customerName}, currently marked as {job.status ?? "scheduled"}.
            </Text>
          ))}
          {!todaysJobs.length ? <Text style={styles.bodyText}>There are no jobs scheduled for this day.</Text> : null}
        </View>
      </SectionCard>
    </>
  );
}

function SettingsPanel({
  snapshot,
  dateKey,
  onIncreaseCapacity,
  onRefresh,
}: {
  snapshot: OperationsSnapshot | undefined;
  dateKey: string;
  onIncreaseCapacity: () => Promise<void>;
  onRefresh: () => Promise<void>
}) {
  const [isBusinessEditMode, setIsBusinessEditMode] = useState(false);
  const [editingVanId, setEditingVanId] = useState<string | null>(null);
  const [editingHelperId, setEditingHelperId] = useState<string | null>(null);
  const [editingVehicleId, setEditingVehicleId] = useState<string | null>(null);
  const [businessName, setBusinessName] = useState("");
  const [unitLabel, setUnitLabel] = useState("");
  const [unitAddress, setUnitAddress] = useState("");
  const [unitLatitude, setUnitLatitude] = useState<number | undefined>(undefined);
  const [unitLongitude, setUnitLongitude] = useState<number | undefined>(undefined);
  const [unitTownId, setUnitTownId] = useState<TownId>("falkirk");
  const [workdayStart, setWorkdayStart] = useState("08:30");
  const [workdayEnd, setWorkdayEnd] = useState("17:30");
  const [vanCapacity, setVanCapacity] = useState("3");
  
  const [driverName, setDriverName] = useState("");
  const [driverVehicleId, setDriverVehicleId] = useState("");
  const [driverStartTown, setDriverStartTown] = useState<TownId>("falkirk");
  const [driverAddress, setDriverAddress] = useState("");
  const [driverLatitude, setDriverLatitude] = useState<number | undefined>(undefined);
  const [driverLongitude, setDriverLongitude] = useState<number | undefined>(undefined);
  const [driverNotes, setDriverNotes] = useState("");
  
  const [vehicleName, setVehicleName] = useState("");
  const [vehicleCapacity, setVehicleCapacity] = useState("3");
  const [vehicleNotes, setVehicleNotes] = useState("");
  
  const [helperName, setHelperName] = useState("");
  const [helperTownId, setHelperTownId] = useState<TownId>("falkirk");
  const [helperWeekday, setHelperWeekday] = useState(true);
  const [helperWeekend, setHelperWeekend] = useState(false);
  const [helperAddress, setHelperAddress] = useState("");
  const [helperLatitude, setHelperLatitude] = useState<number | undefined>(undefined);
  const [helperLongitude, setHelperLongitude] = useState<number | undefined>(undefined);
  const [helperNotes, setHelperNotes] = useState("");

  const [editVanName, setEditVanName] = useState("");
  const [editVanVehicleId, setEditVanVehicleId] = useState("");
  const [editVanStartingTownId, setEditVanStartingTownId] = useState<string>("falkirk");
  const [editVanAddress, setEditVanAddress] = useState("");
  const [editVanLatitude, setEditVanLatitude] = useState<number | undefined>(undefined);
  const [editVanLongitude, setEditVanLongitude] = useState<number | undefined>(undefined);
  const [editVanNotes, setEditVanNotes] = useState("");

  const [editHelperName, setEditHelperName] = useState("");
  const [editHelperTownId, setEditHelperTownId] = useState<string>("falkirk");
  const [editHelperWeekday, setEditHelperWeekday] = useState(true);
  const [editHelperWeekend, setEditHelperWeekend] = useState(false);
  const [editHelperAddress, setEditHelperAddress] = useState("");
  const [editHelperLatitude, setEditHelperLatitude] = useState<number | undefined>(undefined);
  const [editHelperLongitude, setEditHelperLongitude] = useState<number | undefined>(undefined);
  const [editHelperNotes, setEditHelperNotes] = useState("");

  const [editVehicleName, setEditVehicleName] = useState("");
  const [editVehicleCapacity, setEditVehicleCapacity] = useState("");
  const [editVehicleNotes, setEditVehicleNotes] = useState("");

  useEffect(() => {
    if (snapshot && !isBusinessEditMode) {
      setBusinessName(snapshot.settings.businessName);
      setUnitLabel(snapshot.settings.unitLabel);
      setUnitAddress(snapshot.settings.unitAddress);
      setUnitLatitude(snapshot.settings.unitLatitude);
      setUnitLongitude(snapshot.settings.unitLongitude);
      setUnitTownId(snapshot.settings.unitTownId);
      setWorkdayStart(snapshot.settings.workdayStart);
      setWorkdayEnd(snapshot.settings.workdayEnd ?? "17:30");
      setVanCapacity(String(snapshot.settings.vanCapacity));
    }
  }, [isBusinessEditMode, snapshot]);

  const utils = trpc.useUtils();
  const updateSettingsMutation = trpc.operations.updateSettings.useMutation();
  const createVanMutation = trpc.operations.createVan.useMutation({
    onSuccess: async () => {
      await utils.operations.snapshot.invalidate({ dateKey });
      await utils.operations.getVans.invalidate();
    },
  });
  const createVehicleMutation = trpc.operations.createVehicle.useMutation({
    onSuccess: async () => {
      await utils.operations.getVehicles.invalidate();
      await utils.operations.snapshot.invalidate({ dateKey });
    },
  });
  const deleteHelperMutation = trpc.operations.deleteHelper.useMutation({
    onSuccess: async () => {
      await utils.operations.snapshot.invalidate({ dateKey });
    },
  });
  const getVansMutation = trpc.operations.getVans.useQuery();
  const getVehiclesQuery = trpc.operations.getVehicles.useQuery();
  const vehicles = getVehiclesQuery.data || [];
  const sourceDrivers = getVansMutation.data ?? snapshot?.vans ?? [];
  const sourceHelpers = snapshot?.helpers ?? [];
  const [localDrivers, setLocalDrivers] = useState<VanRecord[]>(sourceDrivers);
  const [localHelpers, setLocalHelpers] = useState<HelperRecord[]>(sourceHelpers);
  useEffect(() => {
    setLocalDrivers(sourceDrivers);
  }, [getVansMutation.data, snapshot?.vans]);
  useEffect(() => {
    setLocalHelpers(sourceHelpers);
  }, [snapshot?.helpers]);
  const drivers = localDrivers;
  const helpers = localHelpers;
  const deleteVanMutation = trpc.operations.deleteVan.useMutation({
    onSuccess: async () => {
      await utils.operations.snapshot.invalidate({ dateKey });
      await utils.operations.getVans.invalidate();
    },
  });
  const createHelperMutation = trpc.operations.createHelper.useMutation({
    onSuccess: async () => {
      await utils.operations.snapshot.invalidate({ dateKey });
    },
  });
  const updateVanMutation = trpc.operations.updateVan.useMutation({
    onSuccess: async () => {
      await utils.operations.snapshot.invalidate({ dateKey });
      await utils.operations.getVans.invalidate();
      setEditingVanId(null);
    },
  });
  const updateHelperMutation = trpc.operations.updateHelper.useMutation({
    onSuccess: async () => {
      await utils.operations.snapshot.invalidate({ dateKey });
      setEditingHelperId(null);
    },
  });
  const updateVehicleMutation = trpc.operations.updateVehicle.useMutation({
    onSuccess: async () => {
      await utils.operations.getVehicles.invalidate();
      await utils.operations.snapshot.invalidate({ dateKey });
      setEditingVehicleId(null);
    },
  });
  const deleteVehicleMutation = trpc.operations.deleteVehicle.useMutation({
    onSuccess: async () => {
      await utils.operations.getVehicles.invalidate();
      await utils.operations.snapshot.invalidate({ dateKey });
    },
  });

  const confirmThenRun = (title: string, message: string, onConfirm: () => Promise<void>) => {
    if (Platform.OS === "web") {
      if (!globalThis.confirm?.(`${title}\n\n${message}`)) return;
      void onConfirm();
      return;
    }

    Alert.alert(title, message, [
      { text: "Cancel", style: "cancel" },
      {
        text: "Delete",
        style: "destructive",
        onPress: () => {
          void onConfirm();
        },
      },
    ]);
  };

  const resolveAddressForSave = async (address: string, fallbackTownId: TownId) => {
    const trimmedAddress = address.trim();
    if (!trimmedAddress) {
      return null;
    }

    const data = await utils.system.searchAddresses.fetch({ query: trimmedAddress });
    const predictions = Array.isArray(data.predictions) ? data.predictions : [];
    const bestMatch = predictions.find(
      (prediction) =>
        typeof prediction.latitude === "number" &&
        typeof prediction.longitude === "number",
    );

    if (!bestMatch) {
      return null;
    }

    const resolvedAddress = bestMatch.description || trimmedAddress;
    return {
      address: resolvedAddress,
      townId: inferTownIdFromAddress(resolvedAddress, fallbackTownId),
      latitude: bestMatch.latitude,
      longitude: bestMatch.longitude,
    };
  };

  const handleSaveEditVan = async () => {
    if (!editingVanId) return;
    try {
      let resolvedAddress = editVanAddress;
      let resolvedTownId = editVanStartingTownId;
      let resolvedLatitude = editVanLatitude;
      let resolvedLongitude = editVanLongitude;
      if (resolvedLatitude === undefined || resolvedLongitude === undefined) {
        const resolved = await resolveAddressForSave(editVanAddress, editVanStartingTownId as TownId);
        if (resolved) {
          resolvedAddress = resolved.address;
          resolvedTownId = resolved.townId;
          resolvedLatitude = resolved.latitude;
          resolvedLongitude = resolved.longitude;
          setEditVanAddress(resolved.address);
          setEditVanStartingTownId(resolved.townId);
          setEditVanLatitude(resolved.latitude);
          setEditVanLongitude(resolved.longitude);
        }
      }
      if (!resolvedAddress.trim() || resolvedLatitude === undefined || resolvedLongitude === undefined) {
        Alert.alert("Error", "Please choose one of the addresses shown in the dropdown.");
        return;
      }
      await updateVanMutation.mutateAsync({
        id: editingVanId,
        driverName: editVanName,
        vehicleId: editVanVehicleId,
        startingTownId: resolvedTownId,
        addressLine: resolvedAddress,
        latitude: resolvedLatitude,
        longitude: resolvedLongitude,
        notes: editVanNotes,
      });
      Alert.alert("Success", "Driver updated successfully");
    } catch (error) {
      Alert.alert("Error", "Failed to update driver");
    }
  };

  const handleSaveEditHelper = async () => {
    if (!editingHelperId) return;
    if (!editHelperAddress.trim() || editHelperLatitude === undefined || editHelperLongitude === undefined) {
      Alert.alert("Error", "Please select the helper's home address from the address search results.");
      return;
    }
    try {
      await updateHelperMutation.mutateAsync({
        id: editingHelperId,
        name: editHelperName,
        townId: editHelperTownId,
        weekdayAvailable: editHelperWeekday,
        weekendAvailable: editHelperWeekend,
        addressLine: editHelperAddress,
        latitude: editHelperLatitude,
        longitude: editHelperLongitude,
        notes: editHelperNotes,
      });
      Alert.alert("Success", "Helper updated successfully");
    } catch (error) {
      Alert.alert("Error", "Failed to update helper");
    }
  };

  const handleSaveEditVehicle = async () => {
    if (!editingVehicleId) return;
    try {
      await updateVehicleMutation.mutateAsync({
        id: editingVehicleId,
        name: editVehicleName,
        capacity: parseInt(editVehicleCapacity, 10),
        notes: editVehicleNotes,
      });
      Alert.alert("Success", "Vehicle updated successfully");
    } catch (error) {
      Alert.alert("Error", "Failed to update vehicle");
    }
  };

  const handleAddVehicle = async () => {
    if (!vehicleName.trim()) {
      Alert.alert("Error", "Please enter a vehicle name");
      return;
    }
    if (!vehicleCapacity.trim()) {
      Alert.alert("Error", "Please enter vehicle capacity");
      return;
    }
    try {
      const created = await createVehicleMutation.mutateAsync({
        name: vehicleName,
        capacity: parseInt(vehicleCapacity, 10),
        notes: vehicleNotes,
      });
      if (!created?.success) {
        throw new Error("Vehicle was not saved");
      }
      await getVehiclesQuery.refetch();
      await onRefresh();
      setVehicleName("");
      setVehicleCapacity("3");
      setVehicleNotes("");
      Alert.alert("Success", "Vehicle added successfully. Now assign a driver to it.");
    } catch (error) {
      Alert.alert("Error", "Failed to add vehicle");
    }
  };
  const handleAddHelper = async () => {
    if (!helperName.trim()) {
      Alert.alert("Error", "Please enter a helper name");
      return;
    }
    if (!helperAddress.trim() || helperLatitude === undefined || helperLongitude === undefined) {
      Alert.alert("Error", "Please select the helper's home address from the address search results.");
      return;
    }
    try {
      const created = await createHelperMutation.mutateAsync({
        name: helperName,
        townId: helperTownId,
        weekdayAvailable: helperWeekday,
        weekendAvailable: helperWeekend,
        addressLine: helperAddress,
        latitude: helperLatitude,
        longitude: helperLongitude,
        notes: helperNotes,
      });
      if (!created.createdHelper?.id) {
        throw new Error("Helper was not saved");
      }
      setLocalHelpers(created.helpers.length > 0 ? created.helpers : [...helpers, created.createdHelper]);
      await onRefresh();
      setHelperName("");
      setHelperTownId("falkirk");
      setHelperWeekday(true);
      setHelperWeekend(false);
      setHelperAddress("");
      setHelperLatitude(undefined);
      setHelperLongitude(undefined);
      setHelperNotes("");
      Alert.alert("Success", "Helper added successfully");
    } catch (error) {
      Alert.alert("Error", "Failed to add helper");
    }
  };

  const handleDeleteHelper = async (helperId: string) => {
    confirmThenRun("Delete Helper", "Are you sure you want to delete this helper?", async () => {
      try {
        const result = await deleteHelperMutation.mutateAsync({ id: helperId });
        setLocalHelpers(result.helpers);
        await onRefresh();
        Alert.alert("Success", "Helper deleted successfully");
      } catch (error) {
        Alert.alert("Error", "Failed to delete helper");
      }
    });
  };
  const handleDeleteVan = async (vanId: string) => {
    confirmThenRun("Delete Driver", "Are you sure you want to delete this driver?", async () => {
      try {
        const result = await deleteVanMutation.mutateAsync({ id: vanId });
        setLocalDrivers(result.vans);
        await onRefresh();
        Alert.alert("Success", "Driver deleted successfully");
      } catch (error) {
        Alert.alert("Error", "Failed to delete driver");
      }
    });
  };

  const handleDeleteVehicle = async (vehicleId: string) => {
    confirmThenRun("Delete Vehicle", "Are you sure you want to delete this vehicle?", async () => {
      try {
        await deleteVehicleMutation.mutateAsync({ id: vehicleId });
        await getVehiclesQuery.refetch();
        await onRefresh();
        Alert.alert("Success", "Vehicle deleted successfully");
      } catch (error) {
        Alert.alert("Error", "Failed to delete vehicle");
      }
    });
  };

  const handleAddDriver = async () => {
    if (!driverName.trim()) {
      Alert.alert("Error", "Please enter a driver name");
      return;
    }
    try {
      if (!driverVehicleId.trim()) {
        Alert.alert("Error", "Please select a vehicle for the driver");
        return;
      }
      let resolvedAddress = driverAddress;
      let resolvedTownId = driverStartTown;
      let resolvedLatitude = driverLatitude;
      let resolvedLongitude = driverLongitude;
      if (resolvedLatitude === undefined || resolvedLongitude === undefined) {
        const resolved = await resolveAddressForSave(driverAddress, driverStartTown);
        if (resolved) {
          resolvedAddress = resolved.address;
          resolvedTownId = resolved.townId;
          resolvedLatitude = resolved.latitude;
          resolvedLongitude = resolved.longitude;
          setDriverAddress(resolved.address);
          setDriverStartTown(resolved.townId);
          setDriverLatitude(resolved.latitude);
          setDriverLongitude(resolved.longitude);
        }
      }
      if (!resolvedAddress.trim() || resolvedLatitude === undefined || resolvedLongitude === undefined) {
        Alert.alert("Error", "Please choose one of the addresses shown in the dropdown.");
        return;
      }
      const result = await createVanMutation.mutateAsync({
        driverName,
        vehicleId: driverVehicleId,
        startingTownId: resolvedTownId,
        addressLine: resolvedAddress,
        latitude: resolvedLatitude,
        longitude: resolvedLongitude,
        notes: driverNotes,
      });
      if (!result.createdVan?.id) {
        throw new Error("Driver was not saved");
      }
      setLocalDrivers(result.vans.length > 0 ? result.vans : [...drivers, result.createdVan]);
      await onRefresh();
      setDriverName("");
      setDriverVehicleId("");
      setDriverStartTown("falkirk");
      setDriverAddress("");
      setDriverLatitude(undefined);
      setDriverLongitude(undefined);
      setDriverNotes("");
      Alert.alert("Success", "Driver added successfully");
    } catch (error) {
      Alert.alert("Error", "Failed to add driver");
    }
  };

  const handleSaveSettings = async () => {
    try {
      let resolvedUnitAddress = unitAddress;
      let resolvedUnitTownId = unitTownId;
      let resolvedUnitLatitude = unitLatitude;
      let resolvedUnitLongitude = unitLongitude;
      const previousAddress = snapshot?.settings.unitAddress?.trim() ?? "";
      const isSameAddress = unitAddress.trim() === previousAddress;

      if (resolvedUnitLatitude === undefined || resolvedUnitLongitude === undefined) {
        const resolved = await resolveAddressForSave(unitAddress, unitTownId);
        if (resolved) {
          resolvedUnitAddress = resolved.address;
          resolvedUnitTownId = resolved.townId;
          resolvedUnitLatitude = resolved.latitude;
          resolvedUnitLongitude = resolved.longitude;
          setUnitAddress(resolved.address);
          setUnitTownId(resolved.townId);
          setUnitLatitude(resolved.latitude);
          setUnitLongitude(resolved.longitude);
        } else if (isSameAddress) {
          resolvedUnitLatitude = snapshot?.settings.unitLatitude;
          resolvedUnitLongitude = snapshot?.settings.unitLongitude;
        }
      }

      if (!resolvedUnitAddress.trim() || resolvedUnitLatitude === undefined || resolvedUnitLongitude === undefined) {
        Alert.alert("Error", "Please choose the unit address from the dropdown before saving.");
        return;
      }

      await updateSettingsMutation.mutateAsync({
        businessName,
        unitLabel,
        unitAddress: resolvedUnitAddress,
        unitLatitude: resolvedUnitLatitude,
        unitLongitude: resolvedUnitLongitude,
        unitTownId: resolvedUnitTownId,
        workdayStart,
        workdayEnd,
        vanCapacity: parseInt(vanCapacity, 10),
      });
      await onRefresh();
      setIsBusinessEditMode(false);
      Alert.alert("Success", "Settings updated successfully");
    } catch (error) {
      Alert.alert("Error", "Failed to update settings");
    }
  };

  if (!snapshot) {
    return <StatusBanner tone="info" text="Settings will appear once the day snapshot is loaded." />;
  }

  // Section-based management view
  return (
    <>
      <SectionCard
        title="Business Information"
        subtitle={isBusinessEditMode ? "Update your business details and operational settings." : "Your business details and operational settings."}
        editButton={!isBusinessEditMode ? (
          <Pressable
            style={({ pressed }) => [{ paddingVertical: 8, paddingHorizontal: 12, backgroundColor: "#0a7ea4", borderRadius: 6 }, pressed && { opacity: 0.7 }]}
            onPress={() => setIsBusinessEditMode(true)}
          >
            <Text style={{ color: "white", fontWeight: "600", fontSize: 14 }}>Edit</Text>
          </Pressable>
        ) : undefined}
      >
        <View style={styles.stackGap}>
          {isBusinessEditMode ? (
            <>
              <View>
                <Text style={styles.inputLabel}>Business Name</Text>
                <TextInput
                  style={styles.textInput}
                  value={businessName}
                  onChangeText={setBusinessName}
                  placeholder="Enter business name"
                />
              </View>

              <View>
                <Text style={styles.inputLabel}>Unit Location Label</Text>
                <TextInput
                  style={styles.textInput}
                  value={unitLabel}
                  onChangeText={setUnitLabel}
                  placeholder="e.g., Main Warehouse"
                />
              </View>

              <View>
                <Text style={styles.inputLabel}>Unit Address</Text>
                <AddressSearch
                  value={unitAddress}
                  onChange={(address: string, _postcode: string, latitude?: number, longitude?: number) => {
                    setUnitAddress(address);
                    setUnitTownId(inferTownIdFromAddress(address, unitTownId));
                    setUnitLatitude(latitude);
                    setUnitLongitude(longitude);
                  }}
                  placeholder="e.g., 123 Industrial Estate, Falkirk FK1 1XA"
                />
              </View>

              <View>
                <Text style={styles.inputLabel}>Workday Start Time</Text>
                <TextInput
                  style={styles.textInput}
                  value={workdayStart}
                  onChangeText={setWorkdayStart}
                  placeholder="HH:MM"
                />
              </View>

              <View>
                <Text style={styles.inputLabel}>Workday End Time</Text>
                <TextInput
                  style={styles.textInput}
                  value={workdayEnd}
                  onChangeText={setWorkdayEnd}
                  placeholder="HH:MM"
                />
              </View>

              <View>
                <Text style={styles.inputLabel}>Van Capacity (sofas)</Text>
                <TextInput
                  style={styles.textInput}
                  value={vanCapacity}
                  onChangeText={setVanCapacity}
                  placeholder="3"
                  keyboardType="number-pad"
                />
              </View>

              <View style={{ flexDirection: "row", gap: 8 }}>
                <Pressable
                  style={({ pressed }) => [{ flex: 1, ...styles.primaryButton }, pressed && styles.buttonPressed]}
                  onPress={handleSaveSettings}
                  disabled={updateSettingsMutation.isPending}
                >
                  <Text style={styles.primaryButtonText}>
                    {updateSettingsMutation.isPending ? "Saving..." : "Save Business Information"}
                  </Text>
                </Pressable>
                <Pressable
                  style={({ pressed }) => [{ flex: 1, backgroundColor: "#E5E7EB", paddingVertical: 12, borderRadius: 8, alignItems: "center" }, pressed && { opacity: 0.7 }]}
                  onPress={() => {
                    if (snapshot) {
                      setBusinessName(snapshot.settings.businessName);
                      setUnitLabel(snapshot.settings.unitLabel);
                      setUnitAddress(snapshot.settings.unitAddress);
                      setUnitLatitude(snapshot.settings.unitLatitude);
                      setUnitLongitude(snapshot.settings.unitLongitude);
                      setUnitTownId(snapshot.settings.unitTownId);
                      setWorkdayStart(snapshot.settings.workdayStart);
                      setWorkdayEnd(snapshot.settings.workdayEnd ?? "17:30");
                      setVanCapacity(String(snapshot.settings.vanCapacity));
                    }
                    setIsBusinessEditMode(false);
                  }}
                >
                  <Text style={{ color: "#11181C", fontWeight: "600" }}>Cancel</Text>
                </Pressable>
              </View>
            </>
          ) : (
            <>
              <View>
                <Text style={styles.detailLabel}>Business Name</Text>
                <Text style={styles.detailValue}>{businessName}</Text>
              </View>
              <View>
                <Text style={styles.detailLabel}>Unit Location Label</Text>
                <Text style={styles.detailValue}>{unitLabel}</Text>
              </View>
              <View>
                <Text style={styles.detailLabel}>Unit Address</Text>
                <Text style={styles.detailValue}>{unitAddress || "No unit address selected"}</Text>
              </View>
              <View>
                <Text style={styles.detailLabel}>Workday Start Time</Text>
                <Text style={styles.detailValue}>{workdayStart}</Text>
              </View>
              <View>
                <Text style={styles.detailLabel}>Workday End Time</Text>
                <Text style={styles.detailValue}>{workdayEnd}</Text>
              </View>
              <View>
                <Text style={styles.detailLabel}>Van Capacity</Text>
                <Text style={styles.detailValue}>{vanCapacity} sofas</Text>
              </View>
            </>
          )}
        </View>
      </SectionCard>

      <SectionCard title="Vehicles" subtitle="Manage your fleet of vehicles.">
        <View style={styles.stackGap}>
          <View>
            <Text style={styles.inputLabel}>Vehicle Name</Text>
            <TextInput
              style={styles.textInput}
              value={vehicleName}
              onChangeText={setVehicleName}
              placeholder="e.g., Van A, Van B"
            />
          </View>

          <View>
            <Text style={styles.inputLabel}>Capacity (sofas)</Text>
            <TextInput
              style={styles.textInput}
              value={vehicleCapacity}
              onChangeText={setVehicleCapacity}
              placeholder="3"
              keyboardType="number-pad"
            />
          </View>

          <View>
            <Text style={styles.inputLabel}>Notes (optional)</Text>
            <TextInput
              style={styles.textInput}
              value={vehicleNotes}
              onChangeText={setVehicleNotes}
              placeholder="e.g., Refrigerated, Large items"
            />
          </View>

          <Pressable
            style={({ pressed }) => [styles.primaryButton, pressed && styles.buttonPressed]}
            onPress={handleAddVehicle}
            disabled={createVehicleMutation.isPending}
          >
            <Text style={styles.primaryButtonText}>
              {createVehicleMutation.isPending ? "Adding..." : "Add Vehicle"}
            </Text>
          </Pressable>
        </View>
      </SectionCard>

      <SectionCard title="Your Vehicles" subtitle="Manage your fleet of vehicles.">
        <View style={styles.stackGap}>
          {vehicles && vehicles.length > 0 ? (
            vehicles.map((vehicle) => (
              <View key={vehicle.id} style={[styles.jobCard, { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start" }]}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.stopTitle}>{vehicle.name}</Text>
                  <Text style={styles.stopMeta}>Capacity: {vehicle.capacity} sofas</Text>
                  <Text style={styles.stopReason}>{vehicle.notes || "No notes"}</Text>
                </View>
                <View style={{ flexDirection: "row", gap: 8 }}>
                    <Pressable
                      onPress={() => {
                        setEditingVehicleId(vehicle.id);
                        setEditVehicleName(vehicle.name);
                        setEditVehicleCapacity(String(vehicle.capacity));
                        setEditVehicleNotes(vehicle.notes || "");
                      }}
                      style={({ pressed }) => [{ paddingVertical: 8, paddingHorizontal: 12, backgroundColor: "#0a7ea4", borderRadius: 6 }, pressed && { opacity: 0.7 }]}
                    >
                      <Text style={{ color: "white", fontWeight: "600", fontSize: 12 }}>Edit</Text>
                    </Pressable>
	                    <Pressable
	                      onPress={() => handleDeleteVehicle(vehicle.id)}
                      style={({ pressed }) => [{ paddingVertical: 8, paddingHorizontal: 12, backgroundColor: "#EF4444", borderRadius: 6 }, pressed && { opacity: 0.7 }]}
                    >
                      <Text style={{ color: "white", fontWeight: "600", fontSize: 12 }}>Delete</Text>
                    </Pressable>
                </View>
              </View>
            ))
          ) : (
            <Text style={styles.mutedText}>No vehicles added yet. Add your first vehicle above.</Text>
          )}
        </View>
      </SectionCard>

      <SectionCard title="Add Driver" subtitle="Create a new driver profile for your van.">
        <View style={styles.stackGap}>
          <View>
            <Text style={styles.inputLabel}>Driver Name</Text>
            <TextInput
              style={styles.textInput}
              value={driverName}
              onChangeText={setDriverName}
              placeholder="Driver name"
            />
          </View>

          <View>
            <Text style={styles.inputLabel}>Assign Vehicle</Text>
            <View style={styles.selectContainer}>
              {vehicles && vehicles.length > 0 ? (
                vehicles.map((vehicle) => (
                  <Pressable
                    key={vehicle.id}
                    style={[styles.selectOption, driverVehicleId === vehicle.id && styles.selectOptionActive]}
                    onPress={() => setDriverVehicleId(vehicle.id)}
                  >
                    <Text style={[styles.selectOptionText, driverVehicleId === vehicle.id && styles.selectOptionTextActive]}>
                      {vehicle.name} (Capacity: {vehicle.capacity})
                    </Text>
                  </Pressable>
                ))
              ) : (
                <Text style={styles.mutedText}>Add a vehicle first</Text>
              )}
            </View>
          </View>

          <View>
            <Text style={styles.inputLabel}>Starting Address</Text>
            <AddressSearch
              value={driverAddress}
              onChange={(address: string, _postcode: string, latitude?: number, longitude?: number) => {
                setDriverAddress(address);
                setDriverStartTown(inferTownIdFromAddress(address, driverStartTown));
                setDriverLatitude(latitude);
                setDriverLongitude(longitude);
              }}
              placeholder="Driver's starting address"
            />
          </View>

          <View>
            <Text style={styles.inputLabel}>Notes (optional)</Text>
            <TextInput
              style={[styles.textInput, { height: 60 }]}
              value={driverNotes}
              onChangeText={setDriverNotes}
              placeholder="Any notes about this driver"
              multiline
            />
          </View>

          <Pressable
            style={({ pressed }) => [styles.primaryButton, pressed && styles.buttonPressed]}
            onPress={handleAddDriver}
            disabled={createVanMutation.isPending}
          >
            <Text style={styles.primaryButtonText}>
              {createVanMutation.isPending ? "Adding..." : "Add Driver"}
            </Text>
          </Pressable>
        </View>
      </SectionCard>

      {editingVehicleId && (
        <SectionCard title="Edit Vehicle" subtitle="Update vehicle details.">
          <View style={styles.stackGap}>
            <View>
              <Text style={styles.inputLabel}>Vehicle Name</Text>
              <TextInput
                style={styles.textInput}
                value={editVehicleName}
                onChangeText={setEditVehicleName}
                placeholder="e.g., Van A, Van B"
              />
            </View>

            <View>
              <Text style={styles.inputLabel}>Capacity (items)</Text>
              <TextInput
                style={styles.textInput}
                value={editVehicleCapacity}
                onChangeText={(text) => setEditVehicleCapacity(text)}
                placeholder="e.g., 3"
                keyboardType="numeric"
              />
            </View>

            <View>
              <Text style={styles.inputLabel}>Notes (optional)</Text>
              <TextInput
                style={[styles.textInput, { height: 60 }]}
                value={editVehicleNotes}
                onChangeText={setEditVehicleNotes}
                placeholder="Any notes about this vehicle"
                multiline
              />
            </View>

            <View style={{ flexDirection: "row", gap: 8 }}>
              <Pressable
                style={({ pressed }) => [{ flex: 1, ...styles.primaryButton }, pressed && styles.buttonPressed]}
                onPress={async () => {
                  try {
                    await updateVehicleMutation.mutateAsync({
                      id: editingVehicleId,
                      name: editVehicleName,
                      capacity: parseInt(editVehicleCapacity, 10) || 0,
                      notes: editVehicleNotes,
                    });
                    setEditingVehicleId(null);
                    Alert.alert("Success", "Vehicle updated successfully");
                  } catch (error) {
                    Alert.alert("Error", "Failed to update vehicle");
                  }
                }}
              >
                <Text style={styles.primaryButtonText}>Save Vehicle</Text>
              </Pressable>
              <Pressable
                style={({ pressed }) => [{ flex: 1, backgroundColor: "#999", paddingVertical: 12, borderRadius: 8, alignItems: "center" }, pressed && { opacity: 0.7 }]}
                onPress={() => setEditingVehicleId(null)}
              >
                <Text style={{ color: "white", fontWeight: "600" }}>Cancel</Text>
              </Pressable>
            </View>
          </View>
        </SectionCard>
      )}

      {editingVanId && (
        <SectionCard title="Edit Driver" subtitle="Update driver details.">
          <View style={styles.stackGap}>
            <View>
              <Text style={styles.inputLabel}>Driver Name</Text>
              <TextInput
                style={styles.textInput}
                value={editVanName}
                onChangeText={setEditVanName}
                placeholder="Driver name"
              />
            </View>

            <View>
              <Text style={styles.inputLabel}>Assign Vehicle</Text>
              <View style={styles.selectContainer}>
                {vehicles && vehicles.length > 0 ? (
                  vehicles.map((vehicle) => (
                    <Pressable
                      key={vehicle.id}
                      style={[styles.selectOption, editVanVehicleId === vehicle.id && styles.selectOptionActive]}
                      onPress={() => setEditVanVehicleId(vehicle.id)}
                    >
                      <Text style={[styles.selectOptionText, editVanVehicleId === vehicle.id && styles.selectOptionTextActive]}>
                        {vehicle.name} (Capacity: {vehicle.capacity})
                      </Text>
                    </Pressable>
                  ))
                ) : (
                  <Text style={styles.mutedText}>Add a vehicle first</Text>
                )}
              </View>
            </View>

            <View>
              <Text style={styles.inputLabel}>Starting Address</Text>
              <AddressSearch
                value={editVanAddress}
                onChange={(address: string, _postcode: string, latitude?: number, longitude?: number) => {
                  setEditVanAddress(address);
                  setEditVanStartingTownId(inferTownIdFromAddress(address, editVanStartingTownId as TownId));
                  setEditVanLatitude(latitude);
                  setEditVanLongitude(longitude);
                }}
                placeholder="Driver's starting address"
              />
            </View>

            <View>
              <Text style={styles.inputLabel}>Notes (optional)</Text>
              <TextInput
                style={[styles.textInput, { height: 60 }]}
                value={editVanNotes}
                onChangeText={setEditVanNotes}
                placeholder="Any notes about this driver"
                multiline
              />
            </View>

            <Pressable
              style={({ pressed }) => [styles.primaryButton, pressed && styles.buttonPressed]}
              onPress={handleSaveEditVan}
            >
              <Text style={styles.primaryButtonText}>Save Driver</Text>
            </Pressable>
          </View>
        </SectionCard>
      )}

      <SectionCard title="Your Drivers" subtitle="Manage your drivers and their van capacities.">
        <View style={styles.stackGap}>
          {drivers.length > 0 ? (
            drivers.map((van) => (
              <View key={van.id} style={[styles.jobCard, { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start" }]}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.stopTitle}>{van.driverName}</Text>
                  <Text style={styles.stopMeta}>Vehicle: {vehicles?.find(v => v.id === van.vehicleId)?.name || "Unassigned"}</Text>
                  <Text style={styles.stopMeta}>Starting address</Text>
                  <Text style={styles.stopReason}>{van.addressLine || getTownLabel(van.startingTownId)}</Text>
                  <Text style={styles.stopReason}>{van.notes || "No notes"}</Text>
                </View>
                <View style={{ flexDirection: "row", gap: 8 }}>
                    <Pressable
                      onPress={() => {
                        setEditingVanId(van.id);
                        setEditVanName(van.driverName);
                        setEditVanVehicleId(van.vehicleId);
                        setEditVanStartingTownId(van.startingTownId);
                        setEditVanAddress(van.addressLine || "");
                        setEditVanLatitude(van.latitude);
                        setEditVanLongitude(van.longitude);
                        setEditVanNotes(van.notes || "");
                      }}
                      style={({ pressed }) => [{ paddingVertical: 8, paddingHorizontal: 12, backgroundColor: "#0a7ea4", borderRadius: 6 }, pressed && { opacity: 0.7 }]}
                    >
                      <Text style={{ color: "white", fontWeight: "600", fontSize: 12 }}>Edit</Text>
                    </Pressable>
                    <Pressable
                      onPress={() => handleDeleteVan(van.id)}
                      style={({ pressed }) => [{ paddingVertical: 8, paddingHorizontal: 12, backgroundColor: "#EF4444", borderRadius: 6 }, pressed && { opacity: 0.7 }]}
                    >
                      <Text style={{ color: "white", fontWeight: "600", fontSize: 12 }}>Delete</Text>
                    </Pressable>
                </View>
              </View>
            ))
          ) : (
            <Text style={styles.mutedText}>No drivers added yet. Add your first driver above.</Text>
          )}
        </View>
      </SectionCard>

      <SectionCard title="Add Helper" subtitle="Create a new helper profile.">
        <View style={styles.stackGap}>
          <View>
            <Text style={styles.inputLabel}>Helper Name</Text>
            <TextInput
              style={styles.textInput}
              value={helperName}
              onChangeText={setHelperName}
              placeholder="e.g., John, Sarah"
            />
          </View>

          <View>
            <Text style={styles.inputLabel}>Home Address</Text>
            <AddressSearch
              value={helperAddress}
              onChange={(address: string, _postcode: string, latitude?: number, longitude?: number) => {
                setHelperAddress(address);
                setHelperTownId(inferTownIdFromAddress(address, helperTownId));
                setHelperLatitude(latitude);
                setHelperLongitude(longitude);
              }}
              placeholder="Helper's home address"
            />
          </View>

          <View>
            <Text style={styles.inputLabel}>Availability</Text>
            <View style={{ flexDirection: "row", gap: 12 }}>
              <Pressable
                style={[styles.selectOption, helperWeekday && styles.selectOptionActive]}
                onPress={() => setHelperWeekday(!helperWeekday)}
              >
                <Text style={[styles.selectOptionText, helperWeekday && styles.selectOptionTextActive]}>Weekdays</Text>
              </Pressable>
              <Pressable
                style={[styles.selectOption, helperWeekend && styles.selectOptionActive]}
                onPress={() => setHelperWeekend(!helperWeekend)}
              >
                <Text style={[styles.selectOptionText, helperWeekend && styles.selectOptionTextActive]}>Weekends</Text>
              </Pressable>
            </View>
          </View>

          <View>
            <Text style={styles.inputLabel}>Notes (optional)</Text>
            <TextInput
              style={styles.textInput}
              value={helperNotes}
              onChangeText={setHelperNotes}
              placeholder="e.g., Prefers morning shifts"
            />
          </View>

          <Pressable
            style={({ pressed }) => [styles.primaryButton, pressed && styles.buttonPressed]}
            onPress={handleAddHelper}
            disabled={createHelperMutation.isPending}
          >
            <Text style={styles.primaryButtonText}>
              {createHelperMutation.isPending ? "Adding..." : "Add Helper"}
            </Text>
          </Pressable>
        </View>
      </SectionCard>

      {editingHelperId && (
        <SectionCard title="Edit Helper" subtitle="Update helper details.">
          <View style={styles.stackGap}>
            <View>
              <Text style={styles.inputLabel}>Helper Name</Text>
              <TextInput
                style={styles.textInput}
                value={editHelperName}
                onChangeText={setEditHelperName}
                placeholder="Helper name"
              />
            </View>

            <View>
              <Text style={styles.inputLabel}>Home Address</Text>
              <AddressSearch
                value={editHelperAddress}
                onChange={(address: string, _postcode: string, latitude?: number, longitude?: number) => {
                  setEditHelperAddress(address);
                  setEditHelperTownId(inferTownIdFromAddress(address, editHelperTownId as TownId));
                  setEditHelperLatitude(latitude);
                  setEditHelperLongitude(longitude);
                }}
                placeholder="Helper's home address"
              />
            </View>

            <View>
              <Text style={styles.inputLabel}>Availability</Text>
              <View style={{ gap: 8 }}>
                <Pressable
                  style={[styles.selectOption, editHelperWeekday && styles.selectOptionActive]}
                  onPress={() => setEditHelperWeekday(!editHelperWeekday)}
                >
                  <Text style={[styles.selectOptionText, editHelperWeekday && styles.selectOptionTextActive]}>
                    {editHelperWeekday ? "✓" : "○"} Weekdays
                  </Text>
                </Pressable>
                <Pressable
                  style={[styles.selectOption, editHelperWeekend && styles.selectOptionActive]}
                  onPress={() => setEditHelperWeekend(!editHelperWeekend)}
                >
                  <Text style={[styles.selectOptionText, editHelperWeekend && styles.selectOptionTextActive]}>
                    {editHelperWeekend ? "✓" : "○"} Weekends
                  </Text>
                </Pressable>
              </View>
            </View>

            <View>
              <Text style={styles.inputLabel}>Notes (optional)</Text>
              <TextInput
                style={[styles.textInput, { height: 60 }]}
                value={editHelperNotes}
                onChangeText={setEditHelperNotes}
                placeholder="e.g., Prefers morning shifts"
                multiline
              />
            </View>

            <Pressable
              style={({ pressed }) => [styles.primaryButton, pressed && styles.buttonPressed]}
              onPress={async () => {
                if (!editHelperAddress.trim() || editHelperLatitude === undefined || editHelperLongitude === undefined) {
                  Alert.alert("Error", "Please select the helper's home address from the address search results.");
                  return;
                }
                try {
                  await updateHelperMutation.mutateAsync({
                    id: editingHelperId,
                    name: editHelperName,
                    townId: editHelperTownId,
                    weekdayAvailable: editHelperWeekday,
                    weekendAvailable: editHelperWeekend,
                    addressLine: editHelperAddress,
                    latitude: editHelperLatitude,
                    longitude: editHelperLongitude,
                    notes: editHelperNotes,
                  });
                  setEditingHelperId(null);
                  Alert.alert("Success", "Helper updated successfully");
                } catch (error) {
                  Alert.alert("Error", "Failed to update helper");
                }
              }}
            >
              <Text style={styles.primaryButtonText}>Save Helper</Text>
            </Pressable>
          </View>
        </SectionCard>
      )}

      <SectionCard title="Your Helpers" subtitle="The app compares helper pickup detours to recommend the better daily choice.">
        <View style={styles.stackGap}>
          {helpers.map((helper) => (
            <View key={helper.id} style={styles.jobCard}>
              <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start" }}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.stopTitle}>{helper.name}</Text>
                  <Text style={styles.stopMeta}>Home address</Text>
                  {helper.addressLine ? <Text style={styles.stopReason}>{helper.addressLine}</Text> : <Text style={styles.stopReason}>No address selected</Text>}
                  <Text style={styles.stopReason}>{helper.notes}</Text>
                  <Text style={styles.mutedText}>
                    Weekdays: {helper.weekdayAvailable ? "Available" : "Unavailable"} · Weekends: {helper.weekendAvailable ? "Available" : "Unavailable"}
                  </Text>
                </View>
                <View style={{ flexDirection: "row", gap: 8 }}>
                    <Pressable
                      onPress={() => {
                        setEditingHelperId(helper.id);
                        setEditHelperName(helper.name);
                        setEditHelperTownId(helper.townId);
                        setEditHelperWeekday(helper.weekdayAvailable);
                        setEditHelperWeekend(helper.weekendAvailable);
                        setEditHelperAddress(helper.addressLine ?? "");
                        setEditHelperLatitude(helper.latitude);
                        setEditHelperLongitude(helper.longitude);
                        setEditHelperNotes(helper.notes ?? "");
                      }}
                      style={({ pressed }) => [{ paddingVertical: 8, paddingHorizontal: 12, backgroundColor: "#0a7ea4", borderRadius: 6 }, pressed && { opacity: 0.7 }]}
                    >
                      <Text style={{ color: "white", fontWeight: "600", fontSize: 12 }}>Edit</Text>
                    </Pressable>
                    <Pressable
                      onPress={() => handleDeleteHelper(helper.id)}
                      style={({ pressed }) => [{ paddingVertical: 8, paddingHorizontal: 12, backgroundColor: "#EF4444", borderRadius: 6 }, pressed && { opacity: 0.7 }]}
                    >
                      <Text style={{ color: "white", fontWeight: "600", fontSize: 12 }}>Delete</Text>
                    </Pressable>
                </View>
              </View>
            </View>
          ))}
        </View>
      </SectionCard>
    </>
  );
}

function SectionCard({ title, subtitle, children, editButton }: { title: string; subtitle: string; children: ReactNode; editButton?: ReactNode }) {
  return (
    <View style={styles.sectionCard}>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <View style={{ flex: 1 }}>
          <Text style={styles.sectionTitle}>{title}</Text>
          <Text style={styles.sectionSubtitle}>{subtitle}</Text>
        </View>
        {editButton && <View style={{ marginLeft: 12 }}>{editButton}</View>}
      </View>
      <View style={styles.sectionBody}>{children}</View>
    </View>
  );
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <View style={styles.fieldWrap}>
      <Text style={styles.fieldLabel}>{label}</Text>
      {children}
    </View>
  );
}

function MetricCard({ label, value, helper }: { label: string; value: string; helper: string }) {
  return (
    <View style={styles.metricCard}>
      <Text style={styles.metricLabel}>{label}</Text>
      <Text style={styles.metricValue}>{value}</Text>
      <Text style={styles.metricHelper}>{helper}</Text>
    </View>
  );
}

function MetricPill({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.metricPill}>
      <Text style={styles.metricPillLabel}>{label}</Text>
      <Text style={styles.metricPillValue}>{value}</Text>
    </View>
  );
}

function DateSelector({ dateKey, onChange }: { dateKey: string; onChange: (next: string) => void }) {
  const [showCalendar, setShowCalendar] = useState(false);
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
    setShowCalendar(false);
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

  if (showCalendar) {
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
        <Pressable
          onPress={() => setShowCalendar(false)}
          style={{ marginTop: 12, paddingVertical: 8, backgroundColor: "#E5E7EB", borderRadius: 4 }}
        >
          <Text style={{ textAlign: "center", fontWeight: "600", color: "#11181C" }}>Close</Text>
        </Pressable>
      </View>
    );
  }

  return (
    <View style={styles.inlineRowWrap}>
      <Pressable
        style={({ pressed }) => [styles.filterChip, pressed && styles.buttonPressed]}
        onPress={() => setShowCalendar(true)}
      >
        <Text style={styles.filterChipText}>📅 {dateKey}</Text>
      </Pressable>
    </View>
  );
}

function ChoiceSegment<T extends string>({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: T;
  options: { label: string; value: T }[];
  onChange: (next: T) => void;
}) {
  return (
    <Field label={label}>
      <View style={styles.segmentWrap}>
        {options.map((option) => (
          <Pressable
            key={option.value}
            style={({ pressed }) => [styles.segmentButton, value === option.value && styles.segmentButtonActive, pressed && styles.buttonPressed]}
            onPress={() => onChange(option.value)}
          >
            <Text style={[styles.segmentLabel, value === option.value && styles.segmentLabelActive]}>{option.label}</Text>
          </Pressable>
        ))}
      </View>
    </Field>
  );
}

function TownChips({ value, onChange }: { value: TownId; onChange: (next: TownId) => void }) {
  return (
    <Field label="Town / area">
      <View style={styles.inlineRowWrap}>
        {TOWN_IDS.map((townId) => (
          <Pressable
            key={townId}
            style={({ pressed }) => [styles.filterChip, value === townId && styles.filterChipActive, pressed && styles.buttonPressed]}
            onPress={() => onChange(townId)}
          >
            <Text style={[styles.filterChipText, value === townId && styles.filterChipTextActive]}>{getTownLabel(townId)}</Text>
          </Pressable>
        ))}
      </View>
    </Field>
  );
}

function SmallAction({ label, onPress, tone = "default" }: { label: string; onPress: () => void; tone?: "default" | "danger" }) {
  return (
    <Pressable style={({ pressed }) => [styles.smallAction, tone === "danger" && styles.smallActionDanger, pressed && styles.buttonPressed]} onPress={onPress}>
      <Text style={[styles.smallActionText, tone === "danger" && styles.smallActionTextDanger]}>{label}</Text>
    </Pressable>
  );
}

function StatusBadge({ status }: { status: JobRecord["status"] }) {
  const toneStyle = status === "completed" ? styles.badgeSuccess : status === "cancelled" ? styles.badgeDanger : styles.badgeInfo;
  const textStyle = status === "completed" ? styles.badgeTextSuccess : status === "cancelled" ? styles.badgeTextDanger : styles.badgeTextInfo;

  return (
    <View style={[styles.badge, toneStyle]}>
      <Text style={[styles.badgeText, textStyle]}>{capitalize(status ?? "scheduled")}</Text>
    </View>
  );
}

function StatusBanner({ tone, text }: { tone: "info" | "error"; text: string }) {
  return (
    <View style={[styles.statusBanner, tone === "error" ? styles.badgeDanger : styles.badgeInfo]}>
      <Text style={[styles.bodyText, tone === "error" ? styles.badgeTextDanger : styles.badgeTextInfo]}>{text}</Text>
    </View>
  );
}

function capitalize(value: string) {
  return value.charAt(0).toUpperCase() + value.slice(1);
}

function showMessage(message: string) {
  if (Platform.OS === "web") {
    globalThis.alert?.(message);
    return;
  }
  Alert.alert("Dynamigo Logistics", message);
}

const styles = StyleSheet.create({
  heroCard: {
    backgroundColor: "#1E2233",
    borderRadius: 28,
    padding: 16,
    gap: 8,
    borderWidth: 1,
    borderColor: "#334155",
  },
  eyebrow: {
    color: "#CBD5E1",
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
    color: "#E2E8F0",
    fontSize: 15,
    lineHeight: 22,
  },
  sectionCard: {
    backgroundColor: "#0f172a",
    borderRadius: 24,
    padding: 18,
    borderWidth: 1,
    borderColor: "#334155",
    gap: 12,
  },
  sectionTitle: {
    fontSize: 20,
    lineHeight: 26,
    fontWeight: "800",
    color: "#FFFFFF",
  },
  sectionSubtitle: {
    fontSize: 14,
    lineHeight: 21,
    color: "#CBD5E1",
  },
  sectionBody: {
    gap: 14,
  },
  inlineRowWrap: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
  },
  gridTwo: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 12,
  },
  metricCard: {
    minWidth: 150,
    flexGrow: 1,
    flexBasis: 150,
    backgroundColor: "rgba(148, 163, 184, 0.14)",
    borderRadius: 18,
    padding: 16,
    gap: 6,
  },
  metricLabel: {
    fontSize: 12,
    lineHeight: 16,
    color: "#CBD5E1",
    fontWeight: "600",
  },
  metricValue: {
    fontSize: 22,
    lineHeight: 28,
    color: "#FFFFFF",
    fontWeight: "800",
  },
  metricHelper: {
    fontSize: 13,
    lineHeight: 18,
    color: "#94A3B8",
  },
  metricPill: {
    backgroundColor: "rgba(148, 163, 184, 0.18)",
    borderRadius: 999,
    paddingVertical: 10,
    paddingHorizontal: 14,
    gap: 2,
    borderWidth: 1,
    borderColor: "rgba(203, 213, 225, 0.18)",
  },
  metricPillLabel: {
    color: "#CBD5E1",
    fontSize: 11,
    lineHeight: 14,
  },
  metricPillValue: {
    color: "#FFFFFF",
    fontSize: 14,
    lineHeight: 18,
    fontWeight: "700",
  },
  highlightCard: {
    backgroundColor: "rgba(148, 163, 184, 0.14)",
    borderRadius: 18,
    padding: 16,
    gap: 10,
  },
  highlightTitle: {
    fontSize: 15,
    lineHeight: 20,
    color: "#FFFFFF",
    fontWeight: "700",
  },
  highlightText: {
    fontSize: 16,
    lineHeight: 23,
    color: "#F8FAFC",
    fontWeight: "600",
  },
  primaryButton: {
    backgroundColor: "#1E5EFF",
    borderRadius: 16,
    paddingVertical: 14,
    paddingHorizontal: 18,
    alignItems: "center",
    justifyContent: "center",
    minWidth: 144,
  },
  primaryButtonText: {
    color: "#FFFFFF",
    fontSize: 15,
    lineHeight: 20,
    fontWeight: "700",
  },
  secondaryButton: {
    backgroundColor: "#EAF0F8",
    borderRadius: 16,
    paddingVertical: 14,
    paddingHorizontal: 18,
    alignItems: "center",
    justifyContent: "center",
    minWidth: 144,
  },
  secondaryButtonText: {
    color: "#10233D",
    fontSize: 15,
    lineHeight: 20,
    fontWeight: "700",
  },
  buttonPressed: {
    opacity: 0.82,
    transform: [{ scale: 0.985 }],
  },
  buttonDisabled: {
    opacity: 0.55,
  },
  stopCard: {
    borderRadius: 18,
    padding: 16,
    backgroundColor: "rgba(148, 163, 184, 0.14)",
    borderWidth: 1,
    borderColor: "#334155",
    gap: 8,
  },
  darkStopCard: {
    backgroundColor: "#0B1220",
    borderColor: "#243149",
  },
  stopHeader: {
    flexDirection: "row",
    gap: 12,
    alignItems: "flex-start",
  },
  stopIndex: {
    fontSize: 12,
    lineHeight: 16,
    color: "#CBD5E1",
    fontWeight: "700",
    textTransform: "uppercase",
  },
  stopTitle: {
    fontSize: 18,
    lineHeight: 24,
    color: "#FFFFFF",
    fontWeight: "800",
  },
  stopEta: {
    fontSize: 13,
    lineHeight: 18,
    color: "#67E8F9",
    fontWeight: "700",
  },
  stopMeta: {
    fontSize: 14,
    lineHeight: 20,
    color: "#CBD5E1",
  },
  stopReason: {
    fontSize: 14,
    lineHeight: 21,
    color: "#F8FAFC",
  },
  darkStopTitle: {
    color: "#FFFFFF",
  },
  darkStopMeta: {
    color: "#CBD5E1",
  },
  darkStopReason: {
    color: "#E2E8F0",
  },
  expandButton: {
    marginTop: 8,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#334155",
    backgroundColor: "rgba(148, 163, 184, 0.14)",
    paddingVertical: 12,
    paddingHorizontal: 14,
    alignItems: "center",
  },
  expandButtonText: {
    color: "#E2E8F0",
    fontSize: 14,
    lineHeight: 18,
    fontWeight: "800",
  },
  expandedJobDetails: {
    marginTop: 8,
    borderRadius: 14,
    backgroundColor: "rgba(15, 23, 42, 0.95)",
    borderWidth: 1,
    borderColor: "#334155",
    padding: 12,
    flexDirection: "row",
    gap: 12,
    alignItems: "flex-end",
  },
  jobDetailTextColumn: {
    flex: 1,
    gap: 6,
  },
  cardBottomRightPhoto: {
    alignSelf: "flex-end",
  },
  loadOrderRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    borderTopWidth: 1,
    borderTopColor: "#334155",
    paddingTop: 10,
    marginTop: 4,
  },
  loadOrderNumber: {
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
  },
  completeBar: {
    marginTop: 8,
    minHeight: 44,
    borderRadius: 14,
    backgroundColor: "rgba(34, 197, 94, 0.2)",
    borderWidth: 1,
    borderColor: "rgba(34, 197, 94, 0.4)",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 12,
  },
  completeBarText: {
    color: "#FFFFFF",
    fontSize: 15,
    lineHeight: 20,
    fontWeight: "900",
  },
  stackGap: {
    gap: 12,
  },
  toggleContainer: {
    flexDirection: "column",
    gap: 16,
    marginBottom: 20,
    paddingHorizontal: 0,
  },
  toggleItem: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 14,
    paddingHorizontal: 16,
    backgroundColor: "rgba(148, 163, 184, 0.14)",
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "#334155",
  },
  toggleLabelContainer: {
    flex: 1,
    gap: 4,
  },
  toggleLabel: {
    fontSize: 16,
    lineHeight: 22,
    color: "#FFFFFF",
    fontWeight: "700",
  },
  toggleHelper: {
    fontSize: 13,
    lineHeight: 18,
    color: "#CBD5E1",
  },
  toggle: {
    width: 54,
    height: 32,
    borderRadius: 16,
    backgroundColor: "#E0E6F0",
    justifyContent: "center",
    paddingHorizontal: 2,
  },
  toggleActive: {
    backgroundColor: "#1E5EFF",
  },
  toggleSwitch: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: "#FFFFFF",
  },
  toggleSwitchActive: {
    alignSelf: "flex-end",
  },
  fieldWrap: {
    gap: 8,
    zIndex: 9999,
    overflow: 'visible',
  },
  fieldLabel: {
    fontSize: 14,
    lineHeight: 18,
    color: "#E2E8F0",
    fontWeight: "700",
    zIndex: 9999,
  },
  input: {
    borderRadius: 16,
    borderWidth: 1,
    zIndex: 9999,
    borderColor: "#D8E1EC",
    backgroundColor: "#FFFFFF",
    paddingHorizontal: 14,
    paddingVertical: 13,
    color: "#10233D",
    fontSize: 15,
    lineHeight: 20,
  },
  textArea: {
    minHeight: 112,
  },
  segmentWrap: {
    flexDirection: "row",
    gap: 8,
    flexWrap: "wrap",
  },
  segmentButton: {
    flexGrow: 1,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "#D8E1EC",
    backgroundColor: "#FFFFFF",
    paddingHorizontal: 14,
    paddingVertical: 12,
    minWidth: 120,
    alignItems: "center",
  },
  segmentButtonActive: {
    backgroundColor: "#1E5EFF",
    borderColor: "#1E5EFF",
  },
  segmentLabel: {
    color: "#10233D",
    fontSize: 14,
    lineHeight: 18,
    fontWeight: "700",
  },
  segmentLabelActive: {
    color: "#FFFFFF",
  },
  filterChip: {
    borderRadius: 999,
    paddingHorizontal: 14,
    paddingVertical: 10,
    backgroundColor: "#EEF3F8",
  },
  filterChipActive: {
    backgroundColor: "#1E5EFF",
  },
  filterChipText: {
    fontSize: 13,
    lineHeight: 17,
    color: "#26405F",
    fontWeight: "700",
  },
  filterChipTextActive: {
    color: "#FFFFFF",
  },
  jobCard: {
    borderRadius: 18,
    padding: 16,
    backgroundColor: "rgba(148, 163, 184, 0.14)",
    borderWidth: 1,
    borderColor: "#334155",
    gap: 8,
  },
  jobBodyRow: {
    flexDirection: "row",
    alignItems: "flex-end",
    gap: 12,
  },
  phoneText: {
    color: "#FFFFFF",
    fontSize: 15,
    lineHeight: 20,
    fontWeight: "900",
    textDecorationLine: "underline",
  },
  photoPickerRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  photoThumbButton: {
    borderRadius: 12,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: "#475569",
    backgroundColor: "#111827",
  },
  photoThumbImage: {
    width: "100%",
    height: "100%",
  },
  photoModalBackdrop: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.88)",
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
  smallAction: {
    borderRadius: 999,
    paddingHorizontal: 14,
    paddingVertical: 10,
    backgroundColor: "rgba(148, 163, 184, 0.18)",
    borderWidth: 1,
    borderColor: "#475569",
  },
  smallActionDanger: {
    backgroundColor: "rgba(239, 68, 68, 0.16)",
    borderColor: "#F87171",
  },
  smallActionText: {
    fontSize: 13,
    lineHeight: 17,
    fontWeight: "700",
    color: "#E2E8F0",
  },
  smallActionTextDanger: {
    color: "#FCA5A5",
  },
  badge: {
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  badgeInfo: {
    backgroundColor: "#E7F0FF",
  },
  badgeSuccess: {
    backgroundColor: "#E6F7EF",
  },
  badgeDanger: {
    backgroundColor: "#FFE7E7",
  },
  badgeText: {
    fontSize: 12,
    lineHeight: 16,
    fontWeight: "800",
    textTransform: "uppercase",
  },
  badgeTextInfo: {
    color: "#1E5EFF",
  },
  badgeTextSuccess: {
    color: "#1C8D5B",
  },
  badgeTextDanger: {
    color: "#C03030",
  },
  statusBanner: {
    borderRadius: 18,
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  bodyText: {
    fontSize: 15,
    lineHeight: 23,
    color: "#E2E8F0",
  },
  mutedText: {
    fontSize: 14,
    lineHeight: 21,
    color: "#CBD5E1",
  },
  detailLabel: {
    fontSize: 12,
    fontWeight: "700" as const,
    color: "#CBD5E1",
    marginBottom: 4,
  },
  detailValue: {
    fontSize: 16,
    lineHeight: 22,
    color: "#F8FAFC",
  },
  inputLabel: {
    fontSize: 14,
    fontWeight: "700" as const,
    color: "#E2E8F0",
    marginBottom: 8,
  },
  textInput: {
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#D8E1EC",
    backgroundColor: "#FFFFFF",
    paddingHorizontal: 12,
    paddingVertical: 10,
    color: "#10233D",
    fontSize: 14,
    lineHeight: 20,
  },
  selectContainer: {
    flexDirection: "row" as const,
    flexWrap: "wrap" as const,
    gap: 8,
  },
  selectOption: {
    flex: 1,
    minWidth: 100,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#D8E1EC",
    backgroundColor: "#FFFFFF",
    paddingHorizontal: 12,
    paddingVertical: 10,
    alignItems: "center" as const,
  },
  selectOptionActive: {
    backgroundColor: "#1E5EFF",
    borderColor: "#1E5EFF",
  },
  selectOptionText: {
    fontSize: 13,
    color: "#10233D",
    fontWeight: "600" as const,
  },
  selectOptionTextActive: {
    color: "#FFFFFF",
  },
  typeToggleRow: {
    flexDirection: "row" as const,
    gap: 10,
  },
  typeToggleButton: {
    flex: 1,
    paddingVertical: 12,
    paddingHorizontal: 12,
    borderRadius: 12,
    backgroundColor: "#F4F7FB",
    borderWidth: 2,
    borderColor: "#D8E1EC",
    alignItems: "center" as const,
    justifyContent: "center" as const,
  },
  typeToggleButtonActive: {
    backgroundColor: "#1E5EFF",
    borderColor: "#1E5EFF",
  },
  typeToggleButtonText: {
    fontSize: 14,
    fontWeight: "600" as const,
    color: "#10233D",
  },
  typeToggleButtonTextActive: {
    color: "#FFFFFF",
  },
});
