export const TOWN_OPTIONS = {
  glasgow: { label: "Glasgow", latitude: 55.8642, longitude: -4.2518 },
  edinburgh: { label: "Edinburgh", latitude: 55.9533, longitude: -3.1883 },
  paisley: { label: "Paisley", latitude: 55.8473, longitude: -4.4401 },
  eastKilbride: { label: "East Kilbride", latitude: 55.7644, longitude: -4.1770 },
  hamilton: { label: "Hamilton", latitude: 55.7776, longitude: -4.0537 },
  cumbernauld: { label: "Cumbernauld", latitude: 55.9456, longitude: -3.9942 },
  falkirk: { label: "Falkirk", latitude: 56.0019, longitude: -3.7839 },
  stirling: { label: "Stirling", latitude: 56.1165, longitude: -3.9369 },
  livingston: { label: "Livingston", latitude: 55.9029, longitude: -3.5226 },
  dunfermline: { label: "Dunfermline", latitude: 56.0717, longitude: -3.4522 },
  kirkcaldy: { label: "Kirkcaldy", latitude: 56.1107, longitude: -3.1617 },
  motherwell: { label: "Motherwell", latitude: 55.7892, longitude: -3.9919 },
} as const;

export type TownId = string;
export type JobType = "pickup" | "delivery" | "both";
export type JobStatus = "scheduled" | "cancelled" | "completed" | "in-progress";
export type StopKind = "helper" | "helper-dropoff" | "home" | "job" | "unit" | "start";

/**
 * JobRecord: Raw database record. Coordinates may be optional, nullable, or string.
 * Database fields may be nullable. Do not assume strict types.
 */
export interface JobRecord {
  id: string;
  customerName: string;
  contactName: string;
  contactPhone: string;
  addressLine: string;
  townId?: TownId;
  latitude?: number | string | null;
  longitude?: number | string | null;
  type: JobType;
  sofaCount: number;
  pickupCount: number;
  scheduledDay: string;
  timeWindow: string;
  floor: string;
  duration: number;
  notes?: string;
  photoUri?: string;
  status?: JobStatus;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * OptimizableJob: Validated routing record. All routing-critical fields are required and properly typed.
 * Guaranteed to have valid coordinates, townId, and status after validation.
 */
export interface OptimizableJob {
  id: string;
  customerName: string;
  contactName: string;
  contactPhone: string;
  addressLine: string;
  townId: TownId;
  latitude: number;
  longitude: number;
  type: JobType;
  sofaCount: number;
  pickupCount: number;
  scheduledDay: string;
  timeWindow: string;
  floor: string;
  duration: number;
  notes: string;
  photoUri?: string;
  status: JobStatus;
  createdAt: Date;
  updatedAt: Date;
}

export interface HelperRecord {
  id: string;
  name: string;
  addressLine?: string;
  townId: TownId;
  latitude: number;
  longitude: number;
  weekdayAvailable: boolean;
  weekendAvailable: boolean;
  notes?: string;
}

export interface VehicleRecord {
  id: string;
  name: string;
  capacity: number;
  notes: string;
}

export interface VanRecord {
  id: string;
  driverName: string;
  vehicleId: string;
  startingTownId: TownId;
  addressLine: string;
  latitude: number;
  longitude: number;
  assignedHelperIds: string[];
  notes: string;
}

export interface BusinessSettings {
  businessName: string;
  unitTownId: TownId;
  unitLabel: string;
  unitAddress: string;
  unitLatitude: number;
  unitLongitude: number;
  vanCapacity: number;
  optimizeFor: "time";
  workdayStart: string;
  workdayEnd: string;
}

export interface RouteStop {
  id: string;
  kind: StopKind;
  label: string;
  townId: TownId;
  addressLine: string;
  latitude: number;
  longitude: number;
  etaMinutesFromStart: number;
  travelMinutesFromPrevious: number;
  serviceMinutes: number;
  loadBefore: number;
  loadAfter: number;
  deltaSofas: number;
  cleanLoadBefore?: number;
  cleanLoadAfter?: number;
  dirtyLoadBefore?: number;
  dirtyLoadAfter?: number;
  reason: string;
  relatedJobId?: string;
  relatedHelperId?: string;
  loadJobIds?: string[];
  type?: JobType;
  status?: JobStatus;
}

export interface RouteSummary {
  totalStops: number;
  totalJobs: number;
  pickupJobs: number;
  deliveryJobs: number;
  unitReturns: number;
  estimatedTravelMinutes: number;
  estimatedWorkMinutes: number;
  startingLoad: number;
  finalLoad: number;
}

export interface RoutePlan {
  dateKey: string;
  selectedHelper: HelperRecord | null;
  helperReason: string;
  stops: RouteStop[];
  summary: RouteSummary;
  currentLoad: number;
  nextStop: RouteStop | null;
  routeHeadline: string;
}

export interface OptimizationExplanation {
  reason: string;
  depotVisits: number;
  totalDistance: number;
  totalTime: number;
  segmentsOptimized: number;
  segments?: Array<{ distance: number; time: number; stops: number }>;
  distanceReduction?: number;
}

export interface OperationsSnapshot {
  dateKey: string;
  settings: BusinessSettings;
  helpers: HelperRecord[];
  vans: VanRecord[];
  selectedVanId: string | null;
  selectedHelper: HelperRecord | null;
  jobs: JobRecord[];
  todaysJobs: OptimizableJob[];
  activeJobs: OptimizableJob[];
  routePlan: RoutePlan;
  routePlans: Record<string, RoutePlan>;
  dayStartTimeOverride?: string | null;
  dayEndTimeOverride?: string | null;
  lastUpdatedAt: string;
}

/**
 * Validate and convert JobRecord[] to OptimizableJob[].
 * This is the single conversion point where all validation happens.
 * 
 * Validates:
 * - Every job has a valid ID
 * - No duplicate job IDs
 * - Every job has valid coordinates (converts string to number)
 * - Every job has a townId
 * - Depot/unit has valid coordinates
 * - Van starting coordinates are valid (if van provided)
 * - Helper coordinates are valid (if helper provided)
 * - Capacity > 0
 * - All required routing fields are present
 */
export function validateRouteInputs(
  jobs: JobRecord[],
  settings: BusinessSettings,
  van?: VanRecord,
  helper?: HelperRecord,
): OptimizableJob[] {
  const optimizableJobs: OptimizableJob[] = [];
  const seenIds = new Set<string>();

  // Validate depot/unit coordinates
  if (settings.unitLatitude == null || isNaN(settings.unitLatitude) ||
      settings.unitLongitude == null || isNaN(settings.unitLongitude)) {
    throw new Error(
      `Depot/Unit coordinates are invalid. Latitude: ${settings.unitLatitude}, Longitude: ${settings.unitLongitude}.`
    );
  }

  // Validate van starting coordinates if provided
  if (van) {
    if (van.latitude == null || isNaN(van.latitude) ||
        van.longitude == null || isNaN(van.longitude)) {
      throw new Error(
        `Van ${van.driverName} starting coordinates are invalid. Latitude: ${van.latitude}, Longitude: ${van.longitude}.`
      );
    }
  }

  // Validate helper coordinates if provided
  if (helper) {
    if (helper.latitude == null || isNaN(helper.latitude) ||
        helper.longitude == null || isNaN(helper.longitude)) {
      throw new Error(
        `Helper ${helper.name} coordinates are invalid. Latitude: ${helper.latitude}, Longitude: ${helper.longitude}.`
      );
    }
  }

  // Validate capacity
  if (settings.vanCapacity <= 0) {
    throw new Error(`Van capacity is invalid (${settings.vanCapacity}). Must be greater than 0.`);
  }

  // Process and validate each job
  for (const job of jobs) {
    // Validate job ID exists
    if (!job.id) {
      throw new Error("Job is missing an ID.");
    }

    // Check for duplicate IDs
    if (seenIds.has(job.id)) {
      throw new Error(`Duplicate job ID: ${job.id}. Each job must have a unique ID.`);
    }
    seenIds.add(job.id);

    // Validate townId exists
    if (!job.townId) {
      throw new Error(`Job ${job.id} is missing a townId.`);
    }

    // Validate sofa counts. Delivery amount and pickup/removal amount may be fractional.
    if (job.sofaCount <= 0) {
      throw new Error(`Job ${job.id} has invalid sofaCount (${job.sofaCount}). Must be greater than 0.`);
    }
    if ((job.type === "pickup" || job.type === "both") && getPickupLoad(job) <= 0) {
      throw new Error(`Job ${job.id} has invalid pickupCount (${job.pickupCount}). Must be greater than 0 for pickups.`);
    }

    // Convert and validate coordinates
    let latitude: number;
    let longitude: number;

    if (job.latitude == null) {
      throw new Error(`Job ${job.id} is missing latitude.`);
    }
    latitude = typeof job.latitude === "string" ? parseFloat(job.latitude) : job.latitude;
    if (isNaN(latitude)) {
      throw new Error(`Job ${job.id} has invalid latitude: ${job.latitude}.`);
    }

    if (job.longitude == null) {
      throw new Error(`Job ${job.id} is missing longitude.`);
    }
    longitude = typeof job.longitude === "string" ? parseFloat(job.longitude) : job.longitude;
    if (isNaN(longitude)) {
      throw new Error(`Job ${job.id} has invalid longitude: ${job.longitude}.`);
    }

    // Build validated job with defaults for optional fields
    optimizableJobs.push({
      id: job.id,
      customerName: job.customerName,
      contactName: job.contactName,
      contactPhone: job.contactPhone,
      addressLine: job.addressLine,
      townId: job.townId,
      latitude,
      longitude,
      type: job.type,
      sofaCount: job.sofaCount,
      pickupCount: job.pickupCount,
      scheduledDay: job.scheduledDay,
      timeWindow: job.timeWindow,
      floor: job.floor,
      duration: job.duration,
      notes: job.notes ?? "",
      photoUri: job.photoUri,
      status: job.status ?? "scheduled",
      createdAt: job.createdAt,
      updatedAt: job.updatedAt,
    });
  }

  return optimizableJobs;
}

export interface SeedState {
  settings: BusinessSettings;
  helpers: HelperRecord[];
  jobs: JobRecord[];
}

const EARTH_RADIUS_MILES = 3958.8;
const ROAD_INFLATION_FACTOR = 1.27;
const MINUTES_PER_ROAD_MILE = 2.2;
const DEFAULT_SERVICE_MINUTES = 18;
const UNIT_SERVICE_MINUTES = 12;
const HELPER_SERVICE_MINUTES = 0;
const UNIT_MINUTES_PER_SOFA_MOVED = 10;

function timeStringToMinutes(value: string) {
  const match = value.trim().match(/^(\d{1,2}):(\d{2})$/);
  if (!match) return null;
  const hours = Number(match[1]);
  const minutes = Number(match[2]);
  if (!Number.isFinite(hours) || !Number.isFinite(minutes) || hours > 23 || minutes > 59) return null;
  return hours * 60 + minutes;
}

function parseTimeWindow(timeWindow?: string) {
  if (!timeWindow || /flexible/i.test(timeWindow)) return null;
  const [startRaw, endRaw] = timeWindow.split(/\s*-\s*/);
  const start = timeStringToMinutes(startRaw ?? "");
  const end = timeStringToMinutes(endRaw ?? "");
  if (start === null || end === null) return null;
  return { start, end: end < start ? end + 1440 : end };
}

export function getTownLabel(townId: TownId) {
  return TOWN_OPTIONS[townId as keyof typeof TOWN_OPTIONS]?.label ?? townId;
}

export function todayKey(now = new Date()) {
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function isWeekend(dateKey: string) {
  const day = new Date(`${dateKey}T12:00:00Z`).getUTCDay();
  return day === 0 || day === 6;
}

export function isHelperAvailable(helper: HelperRecord, dateKey: string) {
  return isWeekend(dateKey) ? helper.weekendAvailable : helper.weekdayAvailable;
}

export interface VanStockState {
  clean: number;
  dirty: number;
}

function roundLoad(value: number) {
  return Math.round(value * 100) / 100;
}

export function getDeliveryLoad(job: Pick<OptimizableJob, "type" | "sofaCount">) {
  return job.type === "delivery" || job.type === "both" ? roundLoad(job.sofaCount) : 0;
}

export function getPickupLoad(job: Pick<OptimizableJob, "type" | "sofaCount" | "pickupCount">) {
  if (job.type === "delivery") return 0;
  if (job.type === "pickup") return roundLoad(job.pickupCount || job.sofaCount);
  return roundLoad(job.pickupCount || job.sofaCount);
}

export function getTotalLoad(stock: VanStockState) {
  return roundLoad(stock.clean + stock.dirty);
}

export function getJobLoadDelta(job: Pick<OptimizableJob, "type" | "sofaCount" | "pickupCount">) {
  return roundLoad(getPickupLoad(job) - getDeliveryLoad(job));
}

export function calculateLiveVanStock(
  jobs: Array<Pick<OptimizableJob, "type" | "sofaCount" | "pickupCount" | "status" | "createdAt" | "updatedAt">>,
  vanCapacity: number,
  initialStock: Partial<VanStockState> = {},
): VanStockState {
  const completedJobs = jobs
    .filter((job) => job.status === "completed")
    .sort((left, right) => {
      const leftDate = left.updatedAt ?? left.createdAt;
      const rightDate = right.updatedAt ?? right.createdAt;
      return new Date(leftDate).getTime() - new Date(rightDate).getTime();
    });

  return completedJobs.reduce<VanStockState>((stock, job) => {
    const clean = Math.max(0, stock.clean - getDeliveryLoad(job));
    const dirty = Math.max(0, stock.dirty + getPickupLoad(job));
    const overflow = Math.max(0, clean + dirty - vanCapacity);
    return {
      clean: roundLoad(Math.max(0, clean - overflow)),
      dirty: roundLoad(Math.min(vanCapacity, dirty)),
    };
  }, {
    clean: Math.max(0, initialStock.clean ?? 0),
    dirty: Math.max(0, initialStock.dirty ?? 0),
  });
}

export function calculateLiveVanLoad(
  jobs: Array<Pick<OptimizableJob, "type" | "sofaCount" | "pickupCount" | "status" | "createdAt" | "updatedAt">>,
  vanCapacity: number,
  initialLoad = 0,
) {
  return getTotalLoad(calculateLiveVanStock(jobs, vanCapacity, { dirty: initialLoad }));
}

function toRadians(value: number) {
  return (value * Math.PI) / 180;
}

function crowFlightMiles(fromTown: TownId, toTown: TownId) {
  const from = TOWN_OPTIONS[fromTown as keyof typeof TOWN_OPTIONS];
  const to = TOWN_OPTIONS[toTown as keyof typeof TOWN_OPTIONS];
  
  if (!from || !to) return 20;

  const dLat = toRadians(to.latitude - from.latitude);
  const dLon = toRadians(to.longitude - from.longitude);
  const lat1 = toRadians(from.latitude);
  const lat2 = toRadians(to.latitude);

  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.sin(dLon / 2) * Math.sin(dLon / 2) * Math.cos(lat1) * Math.cos(lat2);

  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return EARTH_RADIUS_MILES * c;
}

export function estimateTravelMinutes(fromTown: TownId | undefined, toTown: TownId | undefined) {
  if (!fromTown || !toTown) return 15;
  if (fromTown === toTown) return 8;
  const roadMiles = crowFlightMiles(fromTown, toTown) * ROAD_INFLATION_FACTOR;
  return Math.max(10, Math.round(roadMiles * MINUTES_PER_ROAD_MILE));
}

function uniqueId(prefix: string) {
  return `${prefix}_${Math.random().toString(36).slice(2, 10)}`;
}

function deterministicStopId(kind: StopKind, relatedId?: string, index?: number): string {
  if (kind === "helper" && relatedId) {
    return `stop_helper_${relatedId}`;
  }
  if (kind === "home" && relatedId) {
    return `stop_home_${relatedId}`;
  }
  if (kind === "unit") {
    return `stop_unit_${index ?? 0}`;
  }
  if (kind === "job" && relatedId) {
    return `stop_job_${relatedId}`;
  }
  return uniqueId(`stop_${kind}`);
}

function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

export function createSeedState(dateKey = todayKey()): SeedState {
  const now = new Date();

  return {
    settings: {
      businessName: "Sofa Route Optimizer",
      unitTownId: "falkirk",
      unitLabel: "Main Storage Unit",
      unitAddress: "123 Industrial Estate, Falkirk FK1 1XA",
      unitLatitude: TOWN_OPTIONS.falkirk.latitude,
      unitLongitude: TOWN_OPTIONS.falkirk.longitude,
      vanCapacity: 3,
      optimizeFor: "time",
      workdayStart: "08:30",
      workdayEnd: "17:30",
    },
    helpers: [
      {
        id: "helper_mia",
        name: "Mia",
        townId: "glasgow",
        latitude: TOWN_OPTIONS.glasgow.latitude,
        longitude: TOWN_OPTIONS.glasgow.longitude,
        weekdayAvailable: true,
        weekendAvailable: true,
        notes: "Available every day.",
      },
      {
        id: "helper_ross",
        name: "Ross",
        townId: "livingston",
        latitude: TOWN_OPTIONS.livingston.latitude,
        longitude: TOWN_OPTIONS.livingston.longitude,
        weekdayAvailable: true,
        weekendAvailable: false,
        notes: "Weekday helper only.",
      },
    ],
    jobs: [
      createJobRecord({
        id: "seed_pickup_livingston",
        customerName: "Livingston Pickup",
        contactName: "A Customer",
        contactPhone: "07000 000 101",
        addressLine: "1 Almondvale Road",
        townId: "livingston",
        latitude: TOWN_OPTIONS.livingston.latitude,
        longitude: TOWN_OPTIONS.livingston.longitude,
        type: "pickup",
        sofaCount: 1,
        pickupCount: 1,
        scheduledDay: dateKey,
        timeWindow: "09:00 - 10:30",
        floor: "0",
        duration: 30,
        notes: "",
        status: "scheduled",
        createdAt: now,
        updatedAt: now,
      }),
      createJobRecord({
        id: "seed_delivery_livingston",
        customerName: "Livingston Delivery",
        contactName: "B Customer",
        contactPhone: "07000 000 102",
        addressLine: "2 Almondvale Road",
        townId: "livingston",
        latitude: TOWN_OPTIONS.livingston.latitude,
        longitude: TOWN_OPTIONS.livingston.longitude,
        type: "delivery",
        sofaCount: 1,
        pickupCount: 0,
        scheduledDay: dateKey,
        timeWindow: "10:30 - 12:00",
        floor: "1",
        duration: 30,
        notes: "",
        status: "scheduled",
        createdAt: now,
        updatedAt: now,
      }),
      createJobRecord({
        id: "seed_pickup_edinburgh",
        customerName: "Edinburgh Pickup",
        contactName: "C Customer",
        contactPhone: "07000 000 103",
        addressLine: "3 Princes Street",
        townId: "edinburgh",
        latitude: TOWN_OPTIONS.edinburgh.latitude,
        longitude: TOWN_OPTIONS.edinburgh.longitude,
        type: "pickup",
        sofaCount: 1,
        pickupCount: 1,
        scheduledDay: dateKey,
        timeWindow: "12:30 - 14:00",
        floor: "0",
        duration: 30,
        notes: "",
        status: "scheduled",
        createdAt: now,
        updatedAt: now,
      }),
      createJobRecord({
        id: "seed_delivery_glasgow",
        customerName: "Glasgow Delivery",
        contactName: "D Customer",
        contactPhone: "07000 000 104",
        addressLine: "4 Buchanan Street",
        townId: "glasgow",
        latitude: TOWN_OPTIONS.glasgow.latitude,
        longitude: TOWN_OPTIONS.glasgow.longitude,
        type: "delivery",
        sofaCount: 1,
        pickupCount: 0,
        scheduledDay: dateKey,
        timeWindow: "14:30 - 16:00",
        floor: "2",
        duration: 30,
        notes: "",
        status: "scheduled",
        createdAt: now,
        updatedAt: now,
      }),
    ],
  };
}

export function chooseBestHelper(
  helpers: HelperRecord[],
  jobs: OptimizableJob[],
  settings: BusinessSettings,
  dateKey: string,
): { helper: HelperRecord | null; reason: string } {
  const availableHelpers = helpers.filter((helper) => isHelperAvailable(helper, dateKey));

  if (!availableHelpers.length) {
    return {
      helper: null,
      reason: "No helper is available for the selected day, so the route is shown without a helper pickup.",
    };
  }

  if (!jobs.length) {
    const fallback = [...availableHelpers].sort(
      (a, b) => estimateTravelMinutes(settings.unitTownId, a.townId) - estimateTravelMinutes(settings.unitTownId, b.townId),
    )[0];

    return {
      helper: fallback,
      reason: `${fallback.name} is recommended because they are the closest available helper to the unit when no jobs are scheduled.`,
    };
  }

  const firstTownWeight = jobs.reduce<Record<TownId, number>>((accumulator, job) => {
    accumulator[job.townId] = (accumulator[job.townId] ?? 0) + job.sofaCount;
    return accumulator;
  }, {} as Record<TownId, number>);

  const hotspotTown = Object.entries(firstTownWeight).sort((a, b) => b[1] - a[1])[0]?.[0] as TownId | undefined;
  const comparisonTown = hotspotTown ?? settings.unitTownId;

  const rankedHelpers = [...availableHelpers].sort((left, right) => {
    const leftScore = estimateTravelMinutes(settings.unitTownId, left.townId) + estimateTravelMinutes(left.townId, comparisonTown);
    const rightScore = estimateTravelMinutes(settings.unitTownId, right.townId) + estimateTravelMinutes(right.townId, comparisonTown);
    return leftScore - rightScore;
  });

  const best = rankedHelpers[0];
  const nextBest = rankedHelpers[1];

  if (!nextBest) {
    return {
      helper: best,
      reason: `${best.name} is the only helper available for the selected day.`,
    };
  }

  const bestScore = estimateTravelMinutes(settings.unitTownId, best.townId) + estimateTravelMinutes(best.townId, comparisonTown);
  const nextScore = estimateTravelMinutes(settings.unitTownId, nextBest.townId) + estimateTravelMinutes(nextBest.townId, comparisonTown);
  const advantage = Math.max(1, nextScore - bestScore);

  return {
    helper: best,
    reason: `${best.name} is recommended because their pickup adds about ${advantage} fewer minutes than ${nextBest.name} for the current job mix.`,
  };
}

function createRouteHeadline(plan: RoutePlan) {
  if (!plan.nextStop) {
    return "No active stops remain for this day.";
  }

  if (plan.nextStop.kind === "unit") {
    return `Return to the unit next. ${plan.nextStop.reason}`;
  }

  if (plan.nextStop.kind === "helper") {
    return `Pick up ${plan.nextStop.label} next before starting the main job sequence.`;
  }

  const action = plan.nextStop.type === "pickup" ? "Pickup" : "Delivery";
  return `${action} next in ${getTownLabel(plan.nextStop.townId)} with van load ${plan.nextStop.loadBefore} → ${plan.nextStop.loadAfter}.`;
}

export function buildRoutePlan(
  jobs: OptimizableJob[],
  helpers: HelperRecord[],
  settings: BusinessSettings,
  dateKey: string,
  van?: VanRecord,
  options?: {
    includeHelper?: boolean;
    returnToUnit?: boolean;
  },
): RoutePlan {
  const jobsForDate = jobs.filter((job) => job.scheduledDay === dateKey);
  const scheduledJobs = jobsForDate.filter((job) => job.status === "scheduled");
  const { helper: initialHelper, reason: helperReason } = chooseBestHelper(helpers, scheduledJobs, settings, dateKey);
  const includeHelper = options?.includeHelper ?? true;
  const returnToUnit = options?.returnToUnit ?? true;

  const stops: RouteStop[] = [];
  const getDeliveryNeed = (items: OptimizableJob[]) => roundLoad(items.reduce((sum, job) => sum + getDeliveryLoad(job), 0));
  const getLoadJobs = (items: OptimizableJob[]) => {
    const selected: OptimizableJob[] = [];
    let selectedLoad = 0;
    for (const job of items) {
      const deliveryLoad = getDeliveryLoad(job);
      if (deliveryLoad <= 0) continue;
      if (selectedLoad + deliveryLoad > settings.vanCapacity) break;
      selected.push(job);
      selectedLoad = roundLoad(selectedLoad + deliveryLoad);
    }
    return selected;
  };
  const startingStock = calculateLiveVanStock(jobsForDate, settings.vanCapacity);
  const startingLoad = getTotalLoad(startingStock);
  let cleanLoad = startingStock.clean;
  let dirtyLoad = startingStock.dirty;
  const currentLoad = () => getTotalLoad({ clean: cleanLoad, dirty: dirtyLoad });
  let currentTownId = van?.startingTownId ?? settings.unitTownId;
  let currentLatitude = van?.latitude ?? settings.unitLatitude;
  let currentLongitude = van?.longitude ?? settings.unitLongitude;
  let etaMinutesFromStart = 0;

  const addUnitStop = (reason: string, remainingJobs: OptimizableJob[]) => {
    const travelToUnit = estimateTravelMinutes(currentTownId, settings.unitTownId);
    etaMinutesFromStart += travelToUnit;
    const loadBefore = currentLoad();
    const cleanBefore = cleanLoad;
    const dirtyBefore = dirtyLoad;
    const loadJobs = getLoadJobs(remainingJobs);
    const nextClean = Math.min(settings.vanCapacity, getDeliveryNeed(loadJobs.length ? loadJobs : remainingJobs));
    const serviceMinutes = Math.round(roundLoad(dirtyBefore + Math.max(0, nextClean - cleanBefore)) * UNIT_MINUTES_PER_SOFA_MOVED);

    dirtyLoad = 0;
    cleanLoad = roundLoad(nextClean);
    etaMinutesFromStart += serviceMinutes;

    stops.push({
      id: deterministicStopId("unit", undefined, stops.length),
      kind: "unit",
      label: settings.unitLabel,
      townId: settings.unitTownId,
      addressLine: settings.unitAddress,
      latitude: settings.unitLatitude,
      longitude: settings.unitLongitude,
      etaMinutesFromStart,
      travelMinutesFromPrevious: travelToUnit,
      serviceMinutes,
      loadBefore,
      loadAfter: currentLoad(),
      deltaSofas: roundLoad(currentLoad() - loadBefore),
      cleanLoadBefore: cleanBefore,
      cleanLoadAfter: cleanLoad,
      dirtyLoadBefore: dirtyBefore,
      dirtyLoadAfter: dirtyLoad,
      reason,
      loadJobIds: loadJobs.map((job) => job.id),
    });

    currentTownId = settings.unitTownId;
    currentLatitude = settings.unitLatitude;
    currentLongitude = settings.unitLongitude;
  };

  if (!scheduledJobs.length) {
    const emptySummary: RouteSummary = {
      totalStops: 0,
      totalJobs: 0,
      pickupJobs: 0,
      deliveryJobs: 0,
      unitReturns: 0,
      estimatedTravelMinutes: 0,
      estimatedWorkMinutes: 0,
      startingLoad,
      finalLoad: currentLoad(),
    };

    return {
      dateKey,
      selectedHelper: null,
      helperReason: "No jobs scheduled for this date.",
      stops: [],
      summary: emptySummary,
      currentLoad: currentLoad(),
      nextStop: null,
      routeHeadline: currentLoad() > 0
        ? `No active customer stops remain. Van load is ${currentLoad()}/${settings.vanCapacity}; return to the unit if you want to empty it.`
        : "No active stops remain for this day.",
    };
  }

  // Add start stop. If a driver van has a starting address, start from there; otherwise start from the Rules unit address.
  stops.push({
    id: van ? `stop_start_${van.id}` : deterministicStopId("unit", undefined, 0),
    kind: van ? "start" : "unit",
    label: van ? `${van.driverName} start` : settings.unitLabel,
    townId: currentTownId,
    addressLine: van?.addressLine || settings.unitAddress,
    latitude: currentLatitude,
    longitude: currentLongitude,
    etaMinutesFromStart: 0,
    travelMinutesFromPrevious: 0,
    serviceMinutes: 0,
    loadBefore: currentLoad(),
    loadAfter: currentLoad(),
    deltaSofas: 0,
    cleanLoadBefore: cleanLoad,
    cleanLoadAfter: cleanLoad,
    dirtyLoadBefore: dirtyLoad,
    dirtyLoadAfter: dirtyLoad,
    reason: van ? "Start of day from the driver address." : "Start of day from the Rules start address.",
  });

  // Add helper pickup if applicable
  if (includeHelper && initialHelper) {
    const travelMinutes = estimateTravelMinutes(currentTownId, initialHelper.townId);
    etaMinutesFromStart += travelMinutes;

    stops.push({
      id: deterministicStopId("helper", initialHelper.id),
      kind: "helper",
      label: initialHelper.name,
      townId: initialHelper.townId,
      addressLine: initialHelper.addressLine || `${initialHelper.name}'s location`,
      latitude: initialHelper.latitude,
      longitude: initialHelper.longitude,
      etaMinutesFromStart,
      travelMinutesFromPrevious: travelMinutes,
      serviceMinutes: HELPER_SERVICE_MINUTES,
      loadBefore: currentLoad(),
      loadAfter: currentLoad(),
      deltaSofas: 0,
      cleanLoadBefore: cleanLoad,
      cleanLoadAfter: cleanLoad,
      dirtyLoadBefore: dirtyLoad,
      dirtyLoadAfter: dirtyLoad,
      reason: `Pick up helper ${initialHelper.name}.`,
      relatedHelperId: initialHelper.id,
    });

    currentTownId = initialHelper.townId;
    currentLatitude = initialHelper.latitude;
    currentLongitude = initialHelper.longitude;
  }

  // Add job stops
  for (let jobIndex = 0; jobIndex < scheduledJobs.length; jobIndex++) {
    const job = scheduledJobs[jobIndex];
    const remainingJobs = scheduledJobs.slice(jobIndex);
    const deliveryLoad = getDeliveryLoad(job);
    const pickupLoad = getPickupLoad(job);

    if (deliveryLoad > cleanLoad) {
      addUnitStop("Reload clean stock at unit before continuing deliveries. Pickup returns already in the van are unloaded here.", remainingJobs);
    }

    if (cleanLoad + dirtyLoad - deliveryLoad + pickupLoad > settings.vanCapacity) {
      addUnitStop("Unload dirty pickup stock at unit before continuing because the next pickup would exceed van capacity.", remainingJobs);
    }

    const travelMinutes = estimateTravelMinutes(currentTownId, job.townId);
    const serviceMinutes = Math.max(1, Math.round(job.duration || DEFAULT_SERVICE_MINUTES));
    etaMinutesFromStart += travelMinutes;
    const window = parseTimeWindow(job.timeWindow);
    if (window) {
      etaMinutesFromStart = Math.max(etaMinutesFromStart, window.start);
    }
    etaMinutesFromStart += serviceMinutes;
    const cleanBefore = cleanLoad;
    const dirtyBefore = dirtyLoad;
    const loadBefore = currentLoad();
    cleanLoad = roundLoad(cleanLoad - deliveryLoad);
    dirtyLoad = roundLoad(dirtyLoad + pickupLoad);
    const loadAfter = currentLoad();
    const deltaSofas = roundLoad(loadAfter - loadBefore);

    stops.push({
      id: deterministicStopId("job", job.id),
      kind: "job",
      label: job.customerName,
      townId: job.townId,
      addressLine: job.addressLine,
      latitude: job.latitude,
      longitude: job.longitude,
      etaMinutesFromStart,
      travelMinutesFromPrevious: travelMinutes,
      serviceMinutes,
      loadBefore,
      loadAfter,
      deltaSofas,
      cleanLoadBefore: cleanBefore,
      cleanLoadAfter: cleanLoad,
      dirtyLoadBefore: dirtyBefore,
      dirtyLoadAfter: dirtyLoad,
      reason: job.type === "both"
        ? `Deliver clean stock and collect pickup return for ${job.customerName}.`
        : `${job.type === "pickup" ? "Pickup return" : "Delivery from unit stock"} for ${job.customerName}.`,
      relatedJobId: job.id,
      type: job.type,
      status: job.status,
    });

    currentTownId = job.townId;
    currentLatitude = job.latitude;
    currentLongitude = job.longitude;
  }

  // Add helper dropoff if applicable
  if (includeHelper && initialHelper) {
    const travelMinutes = estimateTravelMinutes(currentTownId, initialHelper.townId);
    etaMinutesFromStart += travelMinutes + HELPER_SERVICE_MINUTES;

    stops.push({
      id: deterministicStopId("helper-dropoff", initialHelper.id),
      kind: "helper-dropoff",
      label: `Drop off ${initialHelper.name}`,
      townId: initialHelper.townId,
      addressLine: initialHelper.addressLine || `${initialHelper.name}'s location`,
      latitude: initialHelper.latitude,
      longitude: initialHelper.longitude,
      etaMinutesFromStart,
      travelMinutesFromPrevious: travelMinutes,
      serviceMinutes: HELPER_SERVICE_MINUTES,
      loadBefore: currentLoad(),
      loadAfter: currentLoad(),
      deltaSofas: 0,
      cleanLoadBefore: cleanLoad,
      cleanLoadAfter: cleanLoad,
      dirtyLoadBefore: dirtyLoad,
      dirtyLoadAfter: dirtyLoad,
      reason: `Drop off helper ${initialHelper.name}.`,
      relatedHelperId: initialHelper.id,
    });

    currentTownId = initialHelper.townId;
    currentLatitude = initialHelper.latitude;
    currentLongitude = initialHelper.longitude;
  }

  // Add return to unit if applicable
  if (returnToUnit) {
    const travelMinutes = estimateTravelMinutes(currentTownId, settings.unitTownId);
    etaMinutesFromStart += travelMinutes;
    const loadBefore = currentLoad();
    const cleanBefore = cleanLoad;
    const dirtyBefore = dirtyLoad;
    const serviceMinutes = Math.round(loadBefore * UNIT_MINUTES_PER_SOFA_MOVED);
    cleanLoad = 0;
    dirtyLoad = 0;
    etaMinutesFromStart += serviceMinutes;

    stops.push({
      id: deterministicStopId("unit", undefined, 1),
      kind: "unit",
      label: settings.unitLabel,
      townId: settings.unitTownId,
      addressLine: settings.unitAddress,
      latitude: settings.unitLatitude,
      longitude: settings.unitLongitude,
      etaMinutesFromStart,
      travelMinutesFromPrevious: travelMinutes,
      serviceMinutes,
      loadBefore,
      loadAfter: 0,
      deltaSofas: -loadBefore,
      cleanLoadBefore: cleanBefore,
      cleanLoadAfter: cleanLoad,
      dirtyLoadBefore: dirtyBefore,
      dirtyLoadAfter: dirtyLoad,
      reason: "End of day return to unit.",
    });

    currentTownId = settings.unitTownId;
    currentLatitude = settings.unitLatitude;
    currentLongitude = settings.unitLongitude;
  }

  if (van) {
    const travelMinutes = estimateTravelMinutes(currentTownId, van.startingTownId);
    etaMinutesFromStart += travelMinutes;

    stops.push({
      id: deterministicStopId("home", van.id),
      kind: "home",
      label: `${van.driverName} home`,
      townId: van.startingTownId,
      addressLine: van.addressLine,
      latitude: van.latitude,
      longitude: van.longitude,
      etaMinutesFromStart,
      travelMinutesFromPrevious: travelMinutes,
      serviceMinutes: 0,
      loadBefore: currentLoad(),
      loadAfter: currentLoad(),
      deltaSofas: 0,
      cleanLoadBefore: cleanLoad,
      cleanLoadAfter: cleanLoad,
      dirtyLoadBefore: dirtyLoad,
      dirtyLoadAfter: dirtyLoad,
      reason: "Return home after the route.",
    });

    currentLatitude = van.latitude;
    currentLongitude = van.longitude;
  }

  // Calculate summary
  const summary: RouteSummary = {
    totalStops: stops.length,
    totalJobs: scheduledJobs.length,
    pickupJobs: scheduledJobs.filter((j) => j.type === "pickup" || j.type === "both").length,
    deliveryJobs: scheduledJobs.filter((j) => j.type === "delivery" || j.type === "both").length,
    unitReturns: stops.filter((s) => s.kind === "unit").length,
    estimatedTravelMinutes: stops.reduce((sum, s) => sum + s.travelMinutesFromPrevious, 0),
    estimatedWorkMinutes: stops.reduce((sum, s) => sum + s.serviceMinutes, 0),
    startingLoad,
    finalLoad: currentLoad(),
  };

  const nextStop = stops.find((s) => s.kind !== "unit" && s.kind !== "start") || null;

  return {
    dateKey,
    selectedHelper: initialHelper ?? null,
    helperReason,
    stops,
    summary,
    currentLoad: currentLoad(),
    nextStop,
    routeHeadline: createRouteHeadline({
      dateKey,
      selectedHelper: initialHelper ?? null,
      helperReason,
      stops,
      summary,
      currentLoad: currentLoad(),
      nextStop,
      routeHeadline: "",
    }),
  };
}

export function buildOperationsSnapshot(state: SeedState, dateKey = todayKey(), van?: VanRecord): OperationsSnapshot {
  const jobsForDate = state.jobs.filter((job) => job.scheduledDay === dateKey);
  const validatedJobs = validateRouteInputs(jobsForDate, state.settings);
  const todaysJobs = validatedJobs.filter((j) => j.scheduledDay === dateKey);
  const activeJobs = todaysJobs.filter((j) => j.status === "scheduled");

  const routePlan = buildRoutePlan(
    validatedJobs,
    state.helpers,
    state.settings,
    dateKey,
    van,
    { includeHelper: true, returnToUnit: true },
  );

  return {
    dateKey,
    settings: state.settings,
    helpers: state.helpers,
    vans: [],
    selectedVanId: null,
    selectedHelper: routePlan.selectedHelper,
    jobs: jobsForDate,
    todaysJobs,
    activeJobs,
    routePlan,
    routePlans: { [dateKey]: routePlan },
    lastUpdatedAt: new Date().toISOString(),
  };
}

export function buildMultiVanRoutes(
  jobs: OptimizableJob[],
  vans: VanRecord[],
  helpers: HelperRecord[],
  settings: BusinessSettings,
  dateKey: string,
): Record<string, RoutePlan> {
  const routePlans: Record<string, RoutePlan> = {};

  for (const van of vans) {
    const vanJobs = jobs.filter((j) => j.scheduledDay === dateKey && j.status === "scheduled");
    routePlans[van.id] = buildRoutePlan(
      vanJobs,
      helpers,
      settings,
      dateKey,
      van,
      { includeHelper: true, returnToUnit: true },
    );
  }

  return routePlans;
}

export function createJobRecord(
  customerNameOrInput: string | Partial<JobRecord>,
  contactName?: string,
  contactPhone?: string,
  addressLine?: string,
  townId?: TownId,
  latitude?: number | string,
  longitude?: number | string,
  type?: JobType,
  sofaCount?: number,
  pickupCount?: number,
  scheduledDay?: string,
  timeWindow?: string,
  floor?: string,
  duration?: number,
  notes?: string,
  status?: JobStatus,
): JobRecord {
  if (typeof customerNameOrInput === "object") {
    const input = customerNameOrInput;
    return {
      id: input.id ?? uniqueId("job"),
      customerName: input.customerName ?? "",
      contactName: input.contactName ?? "",
      contactPhone: input.contactPhone ?? "",
      addressLine: input.addressLine ?? "",
      townId: input.townId,
      latitude: input.latitude,
      longitude: input.longitude,
      type: input.type ?? "pickup",
      sofaCount: input.sofaCount ?? 0,
      pickupCount: input.pickupCount ?? 0,
      scheduledDay: input.scheduledDay ?? todayKey(),
      timeWindow: input.timeWindow ?? "09:00-17:00",
      floor: input.floor ?? "0",
      duration: input.duration ?? 30,
      notes: input.notes,
      photoUri: input.photoUri,
      status: input.status ?? "scheduled",
      createdAt: input.createdAt ?? new Date(),
      updatedAt: input.updatedAt ?? new Date(),
    };
  }

  return {
    id: uniqueId("job"),
    customerName: customerNameOrInput,
    contactName: contactName ?? "",
    contactPhone: contactPhone ?? "",
    addressLine: addressLine ?? "",
    townId,
    latitude,
    longitude,
    type: type ?? "pickup",
    sofaCount: sofaCount ?? 0,
    pickupCount: pickupCount ?? 0,
    scheduledDay: scheduledDay ?? todayKey(),
    timeWindow: timeWindow ?? "09:00-17:00",
    floor: floor ?? "0",
    duration: duration ?? 30,
    notes,
    photoUri: undefined,
    status: status ?? "scheduled",
    createdAt: new Date(),
    updatedAt: new Date(),
  };
}
