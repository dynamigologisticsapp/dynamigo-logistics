import { ScreenContainer } from "@/components/screen-container";
import { useColors } from "@/hooks/use-colors";
import { useDriverLocation } from "@/hooks/use-driver-location";
import { getTownLabel, TOWN_OPTIONS } from "@/shared/route-planner";
import { useMemo, useEffect, useState, useRef } from "react";
import { useRouteDate } from "@/lib/route-date-context";
import { useEnhancedRoute } from "@/lib/use-enhanced-route";
import { formatDateParts, parseDateKey, todayDateKey } from "@/lib/date-key";
import {
  ActivityIndicator,
  Text,
  View,
  Platform,
  Linking,
  Pressable,
  ScrollView,
  AppState,
  useWindowDimensions,
} from "react-native";
import { trpc } from "@/lib/trpc";
import StartRouteConfirmation from "@/components/start-route-confirmation";
import { geocodeAddress } from "@/lib/geocoding";
import { useIsFocused } from "@react-navigation/native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

function getTodayKey() {
  return todayDateKey();
}

interface MapStop {
  id: string;
  label: string;
  latitude: number;
  longitude: number;
  type: "pickup" | "delivery" | "helper" | "helper-dropoff" | "home" | "unit" | "start";
  status: string;
  addressLine: string;
  index: number;
}

const MapComponent = require("@/components/native-map-view").NativeMapView;

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
    <View style={{ backgroundColor: "rgba(30, 41, 59, 0.95)", borderRadius: 12, padding: 12, marginBottom: 12, borderWidth: 1, borderColor: "rgba(148, 163, 184, 0.2)" }}>
      <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
        <Pressable onPress={handlePrevMonth} style={{ padding: 8 }}>
          <Text style={{ fontSize: 18, color: "#0a7ea4" }}>←</Text>
        </Pressable>
        <Text style={{ fontSize: 14, fontWeight: "600", color: "#F8FAFC" }}>
          {calendarMonth.toLocaleDateString("en-US", { month: "long", year: "numeric" })}
        </Text>
        <Pressable onPress={handleNextMonth} style={{ padding: 8 }}>
          <Text style={{ fontSize: 18, color: "#0a7ea4" }}>→</Text>
        </Pressable>
      </View>
      <View style={{ flexDirection: "row", justifyContent: "space-between", marginBottom: 8 }}>
        {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((day) => (
            <Text key={day} style={{ textAlign: "center", fontSize: 12, fontWeight: "600", color: "#CBD5E1", flex: 1 }}>
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
    </View>
  );
}

export default function MapScreen() {
  const colors = useColors();
  const isFocused = useIsFocused();
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const isPhoneLayout = width < 768;
  const {
    selectedDate,
    setSelectedDate,
    customRouteOrder,
    setCustomRouteOrder,
    isRouteStale,
    completedRouteStopIds,
  } = useRouteDate();
  const [showCalendar, setShowCalendar] = useState(false);
  const [isTrackingEnabled, setIsTrackingEnabled] = useState(false);
  const [showConfirmation, setShowConfirmation] = useState(false);
  const { location: driverLocation, error: locationError, isTracking } = useDriverLocation(isTrackingEnabled);

  // Track geocoded coordinates with state to trigger re-renders and cache results
  // Geocoded coordinates state removed - using route stop coordinates directly

  // Handle app state changes (e.g., returning from Google Maps)
  useEffect(() => {
    const subscription = AppState.addEventListener('change', (state) => {
      if (state === 'active') {
        // App has come to foreground - close confirmation modal to prevent stale state
        setShowConfirmation(false);
      }
    });

    return () => {
      subscription.remove();
    };
  }, []);

  const snapshotQuery = trpc.operations.snapshot.useQuery(
    { dateKey: selectedDate },
    {
      refetchInterval: 12000,
    },
  );

  // Use shared enhanced route query so both tabs display the same recalculated route
  const enhancedRouteQuery = useEnhancedRoute();

  const loadRouteOrderQuery = trpc.operations.loadRouteOrder.useQuery(
    { dateKey: selectedDate },
    {
      enabled: !!selectedDate,
    },
  );

  const snapshot = snapshotQuery.data;
  const enhancedRoute = enhancedRouteQuery.data;
  
  // Use enhanced route if available (has toggle parameters), otherwise fall back to snapshot
  const displayRoute = enhancedRoute ? { routePlan: enhancedRoute } : snapshot;
  
  
  // Clear custom route order when route becomes fresh (recalculation complete)
  useEffect(() => {
    if (!isRouteStale) {
      // Route was just recalculated, clear any stale custom order
      setCustomRouteOrder(null);
    }
  }, [isRouteStale]);

  // Also clear when enhanced route data changes significantly
  useEffect(() => {
    if (enhancedRoute && enhancedRoute !== snapshot?.routePlan) {
      setCustomRouteOrder(null);
    }
  }, [enhancedRoute, snapshot?.routePlan]);

  // Load persisted route order from backend when date changes
  useEffect(() => {
    if (loadRouteOrderQuery.data && displayRoute?.routePlan.stops) {
      const persistedStopIds = loadRouteOrderQuery.data;
      if (Array.isArray(persistedStopIds) && persistedStopIds.length > 0) {
        // Reorder stops based on persisted order
        const stopMap = new Map(displayRoute.routePlan.stops.map(stop => [stop.id, stop]));
        const reorderedStops = persistedStopIds
          .map(id => stopMap.get(id))
          .filter(Boolean) as typeof displayRoute.routePlan.stops;
        
        if (reorderedStops.length > 0 && reorderedStops.length === displayRoute.routePlan.stops.length) {
          setCustomRouteOrder(reorderedStops);
        }
      }
    }
    }, [loadRouteOrderQuery.data, displayRoute?.routePlan.stops?.length, enhancedRoute]);

  // Lazy geocoding: geocode addresses after map loads, non-blocking
  // Updates map markers in real-time as geocoding completes
  // NOTE: Lazy geocoding removed - coordinates are already available from route calculation
  // The enhanced route planner returns stops with latitude/longitude from Distance Matrix API
  // No need to geocode again on the map tab

  // Convert route stops to map coordinates
  // Uses geocoded coordinates if available, otherwise falls back to town coordinates
  // If custom route order exists, use that instead of the default route plan
  const activeRouteStops = useMemo(() => {
    // Use customRouteOrder if available (user-reordered), otherwise use displayRoute
    const stopsToUse = customRouteOrder || displayRoute?.routePlan.stops;
    if (!stopsToUse) return [];

    return stopsToUse.filter((stop) => {
      if (stop.kind === "start") return false;
      if (completedRouteStopIds[stop.id]) return false;
      if (stop.kind === "job" && stop.relatedJobId) {
        const jobStatus = snapshot?.todaysJobs.find((job) => job.id === stop.relatedJobId)?.status;
        return jobStatus !== "completed";
      }
      return true;
    });
  }, [displayRoute, customRouteOrder, completedRouteStopIds, snapshot?.todaysJobs]);

  const mapStops = useMemo(() => {
    return activeRouteStops.map((stop, index) => {
      const town = stop.townId ? TOWN_OPTIONS[stop.townId as keyof typeof TOWN_OPTIONS] : null;
      let displayType: "pickup" | "delivery" | "helper" | "helper-dropoff" | "home" | "unit" | "start";
      if (stop.kind === "job") {
        displayType = (stop.type || "delivery") as "pickup" | "delivery";
      } else if (stop.kind === "helper-dropoff") {
        displayType = "helper-dropoff";
      } else if (stop.kind === "home") {
        displayType = "home";
      } else if (stop.kind === "start") {
        displayType = "start";
      } else {
        displayType = stop.kind as "helper" | "unit";
      }
      
      // Use stop coordinates from route calculation (already geocoded via Distance Matrix API)
      // Fallback to town coordinates if stop coordinates are missing
      const latitude = stop.latitude ? parseFloat(stop.latitude as any) : (town?.latitude || 54.5973);
      const longitude = stop.longitude ? parseFloat(stop.longitude as any) : (town?.longitude || -3.4360);
      
      return {
        id: stop.id,
        label: stop.label,
        latitude,
        longitude,
        type: displayType,
        status: stop.status || "scheduled",
        addressLine: stop.addressLine || "",
        index,
      };
    });
  }, [activeRouteStops]); // Re-run when route or custom order changes

  const topPanelOffset = Platform.OS === "web"
    ? (isPhoneLayout ? 58 : 16)
    : Math.max(insets.top + 16, 36);
  const actionDockBottom = isPhoneLayout ? 8 : 14;
  const primaryButtonPadding = isPhoneLayout ? 8 : 14;
  const hasCalculatedRoute = !!displayRoute?.routePlan;
  const startRouteDisabled = mapStops.length === 0 || !hasCalculatedRoute;
  


  // Show error if queries failed
  const snapshotError = snapshotQuery.error;
  const routeError = enhancedRouteQuery.error;
  
  if (snapshotError || routeError) {
    const errorMsg = snapshotError?.message || routeError?.message || 'Failed to load route data';
    return (
      <ScreenContainer className="items-center justify-center p-4">
        <Text className="text-lg font-bold text-error mb-2">Error Loading Route</Text>
        <Text className="text-sm text-muted text-center mb-6">{errorMsg}</Text>
        <Pressable
          onPress={() => {
            snapshotQuery.refetch();
            enhancedRouteQuery.refetch();
          }}
          className="bg-primary px-6 py-3 rounded-lg"
        >
          <Text className="text-background font-semibold">Retry</Text>
        </Pressable>
      </ScreenContainer>
    );
  }
  
  if ((snapshotQuery.isLoading || !snapshot) && !enhancedRoute) {
    return (
      <ScreenContainer className="items-center justify-center">
        <ActivityIndicator size="large" color={colors.primary} />
        <Text className="mt-4 text-base text-muted text-center">
          Loading route map...
        </Text>
      </ScreenContainer>
    );
  }

  if (!isFocused) {
    return <View style={{ flex: 1, overflow: "hidden" }} />;
  }

  const handleStartRoute = () => {
    if (mapStops.length === 0) return;
    setShowConfirmation(true);
  };

  const handleConfirmRoute = async () => {
    try {
      setShowConfirmation(false);

      if (mapStops.length === 0) return;

      const destination = mapStops[mapStops.length - 1];
      const waypoints = mapStops.slice(0, -1);

      const waypointString = waypoints
        .map((stop) => `${stop.latitude},${stop.longitude}`)
        .join("|")
        .replace(/\|$/, "");

      const mapsUrl = `https://www.google.com/maps/dir/?api=1&origin=Current+Location&destination=${destination.latitude},${destination.longitude}${waypointString ? `&waypoints=${waypointString}` : ""}`;

      setIsTrackingEnabled(true);
      await Linking.openURL(mapsUrl);
    } catch (error) {
      console.error("Failed to open Google Maps", error);
      // Ensure confirmation modal is closed even if there's an error
      setShowConfirmation(false);
    }
  };

  const handleCancelRoute = () => {
    setShowConfirmation(false);
  };

  const handleStopTracking = () => {
    setIsTrackingEnabled(false);
  };

  if (MapComponent) {
    return (
      <View
        className="flex-1"
        style={{
          overflow: "hidden",
          isolation: "isolate",
          backgroundColor: colors.background,
        } as any}
      >
        <MapComponent stops={mapStops} driverLocation={driverLocation} />
        <View
          className="absolute left-0 right-0 px-4 z-10"
          style={{ top: topPanelOffset }}
          pointerEvents="box-none"
        >
          <View
            style={{
              backgroundColor: "#1E2233",
              borderRadius: 16,
              padding: isPhoneLayout ? 12 : 16,
              borderWidth: 1,
              borderColor: "#334155",
              shadowColor: "#000",
              shadowOffset: { width: 0, height: 4 },
              shadowOpacity: 0.22,
              shadowRadius: 12,
              elevation: 8,
            }}
          >
            {/* Calendar Toggle and Date Display */}
            <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: isPhoneLayout ? 8 : 12 }}>
              <Text style={{ color: "#CBD5E1", fontSize: 12, fontWeight: "800", letterSpacing: 1.2, textTransform: "uppercase" }}>Route Date</Text>
              <Pressable
                onPress={() => setShowCalendar(!showCalendar)}
                style={({ pressed }) => ({
                  paddingHorizontal: isPhoneLayout ? 10 : 12,
                  paddingVertical: isPhoneLayout ? 6 : 8,
                  borderRadius: 8,
                  backgroundColor: "#32B771",
                  borderWidth: 1,
                  borderColor: "rgba(255,255,255,0.24)",
                  opacity: pressed ? 0.7 : 1,
                })}
              >
                <Text className="text-xs font-semibold text-white">📅 {selectedDate}</Text>
              </Pressable>
            </View>

            {/* Calendar Picker */}
            {showCalendar && (
              <DateSelector dateKey={selectedDate} onChange={(date) => {
                setSelectedDate(date);
                setShowCalendar(false);
              }} />
            )}

            {hasCalculatedRoute ? (
              <View style={{
                marginTop: isPhoneLayout ? 6 : 12,
                marginBottom: isPhoneLayout ? 8 : 12,
                padding: isPhoneLayout ? 10 : 12,
                backgroundColor: 'rgba(34, 197, 94, 0.15)',
                borderRadius: 8,
                borderWidth: 1,
                borderColor: 'rgba(34, 197, 94, 0.4)',
                flexDirection: 'row',
                alignItems: 'flex-start',
                gap: 8,
              }}>
                <Text style={{ fontSize: 16, marginTop: 2 }}>✓</Text>
                <View style={{ flex: 1 }}>
                  <Text style={{ color: '#32B771', fontWeight: '700', fontSize: 13 }}>Route is live</Text>
                  <Text style={{ color: '#F8FAFC', fontSize: 12, marginTop: 2 }}>Automatically showing the best current route.</Text>
                </View>
              </View>
            ) : null}
          </View>
        </View>
        {isTrackingEnabled ? (
          <Pressable
            onPress={handleStopTracking}
            style={({ pressed }) => ({
              position: 'absolute',
              bottom: actionDockBottom,
              left: 16,
              right: 16,
              zIndex: 40,
              backgroundColor: 'rgba(239, 68, 68, 0.9)',
              borderRadius: 12,
              padding: 16,
              borderWidth: 1,
              borderColor: 'rgba(239, 68, 68, 0.5)',
              opacity: pressed ? 0.8 : 1,
            })}
          >
            <Text style={{ textAlign: 'center', color: 'white', fontWeight: '600', fontSize: 16 }}>
              {driverLocation ? '📍 Stop Tracking (Live)' : '⏳ Stop Tracking (Waiting...)'}
            </Text>
          </Pressable>
        ) : (
          <>
            <Pressable
              onPress={handleStartRoute}
              style={({ pressed }) => ({
                position: "absolute",
                bottom: actionDockBottom,
                left: 16,
                right: 16,
                zIndex: 30,
                backgroundColor: startRouteDisabled ? "rgba(107, 114, 128, 0.8)" : "rgba(16, 185, 129, 0.95)",
                borderRadius: 12,
                padding: primaryButtonPadding,
                borderWidth: 1,
                borderColor: startRouteDisabled ? "rgba(107, 114, 128, 0.4)" : "rgba(16, 185, 129, 0.6)",
                opacity: pressed ? 0.8 : 1,
              })}
              disabled={startRouteDisabled}
            >
              <Text style={{ textAlign: "center", color: "white", fontWeight: "600", fontSize: isPhoneLayout ? 15 : 16 }}>
                🚗 Start Route
              </Text>
              {startRouteDisabled ? (
                <Text style={{ marginTop: 4, textAlign: "center", color: "rgba(255,255,255,0.85)", fontSize: 12, fontWeight: "600" }}>
                  {mapStops.length === 0 ? "Add a job first" : "Preparing route"}
                </Text>
              ) : null}
            </Pressable>
          </>
        )}
        <StartRouteConfirmation
          visible={showConfirmation}
          stops={mapStops}
          totalDistance={`${displayRoute?.routePlan?.summary.estimatedTravelMinutes ?? 0} min`}
          totalTime={`${displayRoute?.routePlan?.summary.estimatedWorkMinutes ?? 0} min work`}
          onConfirm={handleConfirmRoute}
          onCancel={handleCancelRoute}
        />
      </View>
    );
  }

  // Fallback if map component fails to load
  return (
    <ScreenContainer className="items-center justify-center">
      <Text className="text-base text-muted text-center">
        Unable to load map. Please try again.
      </Text>
    </ScreenContainer>
  );
}
