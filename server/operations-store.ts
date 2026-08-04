import {
  buildOperationsSnapshot,
  createJobRecord,
  createSeedState,
  todayKey,
  TOWN_OPTIONS,
  type BusinessSettings,
  type HelperRecord,
  type JobRecord,
  type JobStatus,
  type SeedState,
  type TownId,
  type VanRecord,
  type VehicleRecord,
} from "../shared/route-planner";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
// Simple ID generator to avoid uuid dependency
const generateId = () => Math.random().toString(36).substring(2, 11);
import { createHelperInDb, createJobInDb, createVanInDb, createVehicleInDb, deleteHelperInDb, deleteJobInDb, deleteJobsForDay, deleteVanInDb, deleteVehicleInDb, getAllHelpers, getAllJobs, getAllVans, getAllVehicles, getBusinessSettings, updateHelperInDb, updateJobInDb, updateVanInDb, updateVehicleInDb, upsertBusinessSettings } from "./db";

let operationsState: SeedState = { ...createSeedState(todayKey()), jobs: [] };
let isInitialized = false;
const LOCAL_STORE_PATH = path.join(process.cwd(), ".data", "operations-store.json");

type PersistedOperationsState = {
  settings: BusinessSettings;
  helpers: HelperRecord[];
  jobs: Array<Omit<JobRecord, "createdAt" | "updatedAt"> & { createdAt: string; updatedAt: string }>;
  vans: VanRecord[];
  vehicles: VehicleRecord[];
  selectedVanId: string | null;
  dayStartTimes?: Record<string, string>;
  dayEndTimes?: Record<string, string>;
};

function townCoordinates(townId: TownId) {
  return TOWN_OPTIONS[townId as keyof typeof TOWN_OPTIONS] ?? TOWN_OPTIONS.edinburgh;
}

function parseCoordinate(value: number | string | null | undefined): number | undefined {
  if (value === null || value === undefined || value === "") return undefined;
  const parsed = typeof value === "string" ? Number(value) : value;
  return Number.isFinite(parsed) ? parsed : undefined;
}

function serializeJob(job: JobRecord): PersistedOperationsState["jobs"][number] {
  return {
    ...job,
    createdAt: new Date(job.createdAt).toISOString(),
    updatedAt: new Date(job.updatedAt).toISOString(),
  };
}

async function saveLocalState() {
  const payload: PersistedOperationsState = {
    settings: operationsState.settings,
    helpers: operationsState.helpers,
    jobs: (operationsState.jobs as JobRecord[]).map(serializeJob),
    vans,
    vehicles,
    selectedVanId,
    dayStartTimes,
    dayEndTimes,
  };
  await mkdir(path.dirname(LOCAL_STORE_PATH), { recursive: true });
  await writeFile(LOCAL_STORE_PATH, JSON.stringify(payload, null, 2));
}

async function loadLocalState() {
  try {
    const raw = await readFile(LOCAL_STORE_PATH, "utf8");
    const parsed = JSON.parse(raw) as PersistedOperationsState;
    operationsState = {
      settings: {
        ...parsed.settings,
        workdayEnd: parsed.settings.workdayEnd ?? operationsState.settings.workdayEnd ?? "17:30",
      },
      helpers: parsed.helpers ?? operationsState.helpers,
      jobs: (parsed.jobs ?? []).map((job) => ({
        ...job,
        createdAt: new Date(job.createdAt),
        updatedAt: new Date(job.updatedAt),
      })),
    };
    vans = parsed.vans ?? vans;
    vehicles = parsed.vehicles ?? vehicles;
    selectedVanId = parsed.selectedVanId ?? selectedVanId;
    dayStartTimes = parsed.dayStartTimes ?? dayStartTimes;
    dayEndTimes = parsed.dayEndTimes ?? dayEndTimes;
    return true;
  } catch {
    return false;
  }
}

async function initializeFromDatabase() {
  if (isInitialized) return;

  try {
    const dbJobs = await getAllJobs();
    const dbHelpers = await getAllHelpers();
    const dbSettings = await getBusinessSettings();
    const dbVans = await getAllVans();
    const dbVehicles = await getAllVehicles();

    if (dbJobs.length > 0 || dbHelpers.length > 0 || dbSettings || dbVans.length > 0 || dbVehicles.length > 0) {
      // Convert database records to in-memory format
      const convertedJobs: JobRecord[] = dbJobs.map((job) => ({
        ...job,
        townId: job.townId as TownId,
        notes: job.notes ?? undefined,
        latitude: job.latitude ?? undefined,
        longitude: job.longitude ?? undefined,
        createdAt: job.createdAt instanceof Date ? job.createdAt : new Date(job.createdAt),
        updatedAt: job.updatedAt instanceof Date ? job.updatedAt : new Date(job.updatedAt),
      }));

      const convertedHelpers: HelperRecord[] = dbHelpers.map((helper) => {
        const helperTownId = helper.townId as TownId;
        const townCoords = townCoordinates(helperTownId);
        const latitude = parseCoordinate(helper.latitude) ?? townCoords.latitude;
        const longitude = parseCoordinate(helper.longitude) ?? townCoords.longitude;
        return {
          id: helper.id,
          name: helper.name,
          addressLine: helper.addressLine ?? undefined,
          townId: helperTownId,
          latitude,
          longitude,
          weekdayAvailable: Boolean(helper.weekdayAvailable),
          weekendAvailable: Boolean(helper.weekendAvailable),
          notes: helper.notes ?? undefined,
        };
      });

      const unitTownId = dbSettings?.unitTownId as TownId;
      const unitTownCoords = unitTownId ? townCoordinates(unitTownId) : null;
      const unitLatitude = parseCoordinate(dbSettings?.unitLatitude) ?? unitTownCoords?.latitude ?? 55.9533;
      const unitLongitude = parseCoordinate(dbSettings?.unitLongitude) ?? unitTownCoords?.longitude ?? -3.1883;
      const convertedSettings: BusinessSettings = dbSettings
        ? {
            businessName: dbSettings.businessName,
            unitTownId: unitTownId,
            unitLabel: dbSettings.unitLabel,
            unitAddress: dbSettings.unitAddress || "",
            unitLatitude,
            unitLongitude,
            vanCapacity: dbSettings.vanCapacity,
            optimizeFor: "time" as const,
            workdayStart: dbSettings.workdayStart,
            workdayEnd: (dbSettings as { workdayEnd?: string }).workdayEnd ?? operationsState.settings.workdayEnd ?? "17:30",
          }
        : operationsState.settings;

      operationsState = {
        settings: convertedSettings,
        helpers: convertedHelpers.length > 0 ? convertedHelpers : operationsState.helpers,
        jobs: convertedJobs.length > 0 ? convertedJobs : operationsState.jobs as JobRecord[],
      };
      if (dbVans.length > 0) {
        vans = dbVans.map((van) => {
          const vanTownId = van.startingTownId as TownId;
          const townCoords = townCoordinates(vanTownId);
          return {
            id: van.id,
            driverName: van.driverName,
            vehicleId: van.vehicleId,
            startingTownId: vanTownId,
            addressLine: van.addressLine || "",
            latitude: parseCoordinate(van.latitude) ?? townCoords.latitude,
            longitude: parseCoordinate(van.longitude) ?? townCoords.longitude,
            assignedHelperIds: [],
            notes: van.notes || "",
          };
        });
      }
      if (dbVehicles.length > 0) {
        vehicles = dbVehicles.map((vehicle) => ({
          id: vehicle.id,
          name: vehicle.name,
          capacity: vehicle.capacity,
          notes: vehicle.notes || "",
        }));
      }
    } else {
      await loadLocalState();
    }
  } catch (error) {
    console.warn("[Operations] Failed to initialize from database, using seed data:", error);
    await loadLocalState();
  }

  isInitialized = true;
}

export async function getSnapshot(dateKey = todayKey()) {
  await initializeFromDatabase();
  const dbHelpers = await getAllHelpers();
  const helpersFromDb = dbHelpers.map((helper) => {
    const helperTownId = helper.townId as TownId;
    const townCoords = townCoordinates(helperTownId);
    return {
      id: helper.id,
      name: helper.name,
      addressLine: helper.addressLine ?? undefined,
      townId: helperTownId,
      latitude: parseCoordinate(helper.latitude) ?? townCoords.latitude,
      longitude: parseCoordinate(helper.longitude) ?? townCoords.longitude,
      weekdayAvailable: Boolean(helper.weekdayAvailable),
      weekendAvailable: Boolean(helper.weekendAvailable),
      notes: helper.notes ?? undefined,
    };
  });
  operationsState = {
    ...operationsState,
    helpers: helpersFromDb.length > 0 ? helpersFromDb : operationsState.helpers,
  };
  const dbVans = await getAllVans();
  const vansFromDb: VanRecord[] = dbVans.map((van) => {
    const vanTownId = van.startingTownId as TownId;
    const townCoords = townCoordinates(vanTownId);
    const latitude = parseCoordinate(van.latitude) ?? townCoords.latitude;
    const longitude = parseCoordinate(van.longitude) ?? townCoords.longitude;
    return {
      id: van.id,
      driverName: van.driverName,
      vehicleId: van.vehicleId,
      startingTownId: vanTownId,
      addressLine: van.addressLine || "",
      latitude,
      longitude,
      assignedHelperIds: [],
      notes: van.notes || "",
    };
  });
  if (vansFromDb.length > 0) {
    vans = vansFromDb;
  }
  const selectedVan = vans.find((van) => van.id === selectedVanId) ?? vans[0];
  selectedVanId = selectedVan?.id ?? null;

  const dayStartTimeOverride = dayStartTimes[dateKey] ?? null;
  const dayEndTimeOverride = dayEndTimes[dateKey] ?? null;
  const effectiveState = dayStartTimeOverride
    ? {
        ...operationsState,
        settings: {
          ...operationsState.settings,
          workdayStart: dayStartTimeOverride,
          workdayEnd: dayEndTimeOverride ?? operationsState.settings.workdayEnd,
        },
      }
    : dayEndTimeOverride
      ? {
          ...operationsState,
          settings: {
            ...operationsState.settings,
            workdayEnd: dayEndTimeOverride,
          },
        }
      : operationsState;

  return {
    ...buildOperationsSnapshot(effectiveState, dateKey, selectedVan),
    vans,
    selectedVanId,
    dayStartTimeOverride,
    dayEndTimeOverride,
  };
}

export async function createJob(input: {
  customerName: string;
  contactName: string;
  contactPhone: string;
  addressLine: string;
  latitude: number;
  longitude: number;
  townId?: TownId;
  type: "pickup" | "delivery" | "both";
  sofaCount: number;
  pickupCount?: number;
  scheduledDay: string;
  timeWindow: string;
  floor?: string;
  duration?: number;
  notes?: string;
  photoUri?: string;
}) {
  // Create job record with all required fields
  const job = createJobRecord({
    customerName: input.customerName,
    contactName: input.contactName,
    contactPhone: input.contactPhone,
    addressLine: input.addressLine,
    townId: input.townId,
    latitude: input.latitude,
    longitude: input.longitude,
    type: input.type,
    sofaCount: input.sofaCount,
    pickupCount: input.pickupCount,
    scheduledDay: input.scheduledDay,
    timeWindow: input.timeWindow,
    floor: input.floor,
    duration: input.duration,
    notes: input.notes,
    photoUri: input.photoUri,
  });

  // Coordinates are supplied by the selected address provider.
  const latitude = input.latitude;
  const longitude = input.longitude;

  // Persist to database
  await createJobInDb({
    ...job,
    townId: job.townId ?? input.townId ?? "glasgow",
    latitude: String(latitude),
    longitude: String(longitude),
    status: job.status === "in-progress" ? "scheduled" : job.status,
    createdAt: job.createdAt instanceof Date ? job.createdAt : new Date(job.createdAt),
    updatedAt: job.updatedAt instanceof Date ? job.updatedAt : new Date(job.updatedAt),
  });

  // Update in-memory state
  operationsState = {
    ...operationsState,
    jobs: [...operationsState.jobs, job] as JobRecord[],
  };
  await saveLocalState();

  return job;
}

export async function updateJob(input: {
  id: string;
  customerName?: string;
  contactName?: string;
  contactPhone?: string;
  addressLine?: string;
  townId?: TownId;
  type?: "pickup" | "delivery" | "both";
  sofaCount?: number;
  pickupCount?: number;
  scheduledDay?: string;
  timeWindow?: string;
  floor?: string;
  duration?: number;
  notes?: string;
  photoUri?: string;
  status?: JobStatus;
}) {
  // Find the existing job first (outside of callback)
  const existingJob = operationsState.jobs.find((job) => job.id === input.id);
  if (!existingJob) return null;

  // Construct the updated job synchronously
  const updatedJob: JobRecord = {
    ...existingJob,
    ...input,
    updatedAt: new Date(),
  };

  // Update in-memory state
  operationsState = {
    ...operationsState,
    jobs: operationsState.jobs.map((job) => (job.id === input.id ? updatedJob : job)),
  };

  // Persist to database
  await updateJobInDb(input.id, {
    customerName: updatedJob.customerName,
    contactName: updatedJob.contactName,
    contactPhone: updatedJob.contactPhone,
    addressLine: updatedJob.addressLine,
    townId: updatedJob.townId,
    type: updatedJob.type,
    sofaCount: updatedJob.sofaCount,
    pickupCount: updatedJob.pickupCount,
    scheduledDay: updatedJob.scheduledDay,
    timeWindow: updatedJob.timeWindow,
    floor: updatedJob.floor,
    duration: updatedJob.duration,
    notes: updatedJob.notes,
    status: updatedJob.status === "in-progress" ? undefined : updatedJob.status,
    createdAt: new Date(updatedJob.createdAt),
    updatedAt: new Date(updatedJob.updatedAt),
  });
  await saveLocalState();

  return updatedJob;
}

let dayStartTimes: Record<string, string> = {};
let dayEndTimes: Record<string, string> = {};

export async function updateDayStartTime(dateKey: string, startTime: string | null) {
  if (startTime) {
    dayStartTimes = { ...dayStartTimes, [dateKey]: startTime };
  } else {
    const { [dateKey]: _removed, ...remaining } = dayStartTimes;
    dayStartTimes = remaining;
  }
  await saveLocalState();
  return getSnapshot(dateKey);
}

export async function updateDayEndTime(dateKey: string, endTime: string | null) {
  if (endTime) {
    dayEndTimes = { ...dayEndTimes, [dateKey]: endTime };
  } else {
    const { [dateKey]: _removed, ...remaining } = dayEndTimes;
    dayEndTimes = remaining;
  }
  await saveLocalState();
  return getSnapshot(dateKey);
}

export async function cancelJob(id: string) {
  return updateJob({ id, status: "cancelled" });
}

export async function deleteJob(id: string) {
  await deleteJobInDb(id);
  operationsState = {
    ...operationsState,
    jobs: operationsState.jobs.filter((job) => job.id !== id),
  };
  await saveLocalState();
  return true;
}

export async function completeJob(id: string) {
  return updateJob({ id, status: "completed" });
}

export async function updateSettings(input: Partial<BusinessSettings>) {
  operationsState = {
    ...operationsState,
    settings: {
      ...operationsState.settings,
      ...input,
    },
  };

  // Persist to database
  await upsertBusinessSettings({
    ...operationsState.settings,
    unitLatitude: String(operationsState.settings.unitLatitude),
    unitLongitude: String(operationsState.settings.unitLongitude),
  });
  await saveLocalState();

  return operationsState.settings;
}

export async function resetOperations(dateKey = todayKey()) {
  await deleteJobsForDay(dateKey);
  operationsState = { ...operationsState, jobs: operationsState.jobs.filter((job) => job.scheduledDay !== dateKey) };
  await saveLocalState();
  return getSnapshot(dateKey);
}

// Van management
let vans: VanRecord[] = [];
let vehicles: VehicleRecord[] = [];
let selectedVanId: string | null = null;

export async function getVehicles(): Promise<VehicleRecord[]> {
  await initializeFromDatabase();
  const dbVehicles = await getAllVehicles();
  if (dbVehicles.length > 0) {
    vehicles = dbVehicles.map((vehicle) => ({
      id: vehicle.id,
      name: vehicle.name,
      capacity: vehicle.capacity,
      notes: vehicle.notes || "",
    }));
  }
  return vehicles;
}

export async function createVehicle(input: {
  name: string;
  capacity: number;
  notes?: string;
}): Promise<VehicleRecord> {
  const vehicle: VehicleRecord = {
    id: generateId(),
    name: input.name,
    capacity: input.capacity,
    notes: input.notes || "",
  };
  await createVehicleInDb(vehicle);
  vehicles = [...vehicles.filter((item) => item.id !== vehicle.id), vehicle];
  await saveLocalState();
  return vehicle;
}

export async function updateVehicle(id: string, input: Partial<VehicleRecord>): Promise<VehicleRecord | null> {
  const persisted = await updateVehicleInDb(id, input);
  const existing = vehicles.find((vehicle) => vehicle.id === id);
  const updated = existing
    ? { ...existing, ...input }
    : persisted
      ? {
          id: persisted.id,
          name: persisted.name,
          capacity: persisted.capacity,
          notes: persisted.notes || "",
        }
      : null;
  if (!updated) return null;
  vehicles = vehicles.some((vehicle) => vehicle.id === id)
    ? vehicles.map((vehicle) => (vehicle.id === id ? updated : vehicle))
    : [...vehicles, updated];
  await saveLocalState();
  return updated;
}

export async function deleteVehicle(id: string): Promise<boolean> {
  const deletedFromDb = await deleteVehicleInDb(id);
  const existedLocally = vehicles.some((vehicle) => vehicle.id === id);
  vehicles = vehicles.filter((vehicle) => vehicle.id !== id);
  vans = vans.filter((van) => van.vehicleId !== id);
  if (selectedVanId && !vans.some((van) => van.id === selectedVanId)) {
    selectedVanId = vans[0]?.id ?? null;
  }
  await saveLocalState();
  return deletedFromDb || existedLocally;
}

export async function createVan(input: {
  driverName: string;
  vehicleId: string;
  startingTownId: TownId;
  addressLine?: string;
  latitude?: number;
  longitude?: number;
  assignedHelperIds?: string[];
  notes?: string;
}): Promise<VanRecord> {
  const townCoords = townCoordinates(input.startingTownId);
  const latitude = input.latitude ?? townCoords.latitude;
  const longitude = input.longitude ?? townCoords.longitude;
  const van: VanRecord = {
    id: generateId(),
    driverName: input.driverName,
    vehicleId: input.vehicleId,
    startingTownId: input.startingTownId,
    addressLine: input.addressLine || "",
    latitude,
    longitude,
    assignedHelperIds: input.assignedHelperIds || [],
    notes: input.notes || "",
  };
  // Persist to database
  const createdVan = await createVanInDb({
    ...van,
    latitude: String(latitude),
    longitude: String(longitude),
  });
  vans.push(van);
  if (!selectedVanId) {
    selectedVanId = van.id;
  }
  await saveLocalState();
  return van;
}

export async function updateVan(id: string, input: Partial<VanRecord>): Promise<VanRecord | null> {
  const persisted = await updateVanInDb(id, {
    ...input,
    latitude: input.latitude === undefined ? undefined : String(input.latitude),
    longitude: input.longitude === undefined ? undefined : String(input.longitude),
  });

  const existing = vans.find((v) => v.id === id);
  const updated = existing ? { ...existing, ...input } : {
    id,
    driverName: persisted?.driverName ?? input.driverName ?? "Driver",
    vehicleId: persisted?.vehicleId ?? input.vehicleId ?? "",
    startingTownId: (persisted?.startingTownId ?? input.startingTownId ?? "falkirk") as TownId,
    addressLine: persisted?.addressLine || input.addressLine || "",
    latitude: parseCoordinate(persisted?.latitude ?? input.latitude) ?? townCoordinates((persisted?.startingTownId ?? input.startingTownId ?? "falkirk") as TownId).latitude,
    longitude: parseCoordinate(persisted?.longitude ?? input.longitude) ?? townCoordinates((persisted?.startingTownId ?? input.startingTownId ?? "falkirk") as TownId).longitude,
    assignedHelperIds: [],
    notes: persisted?.notes || input.notes || "",
  };
  vans = vans.map((van) => (van.id === id ? updated : van));
  if (!existing) vans.push(updated);
  await saveLocalState();
  return updated;
}

export async function deleteVan(id: string): Promise<boolean> {
  const deletedFromDb = await deleteVanInDb(id);
  const index = vans.findIndex((v) => v.id === id);
  if (index !== -1) {
    vans.splice(index, 1);
  }
  if (selectedVanId === id) {
    selectedVanId = vans.length > 0 ? vans[0].id : null;
  }
  await saveLocalState();
  return deletedFromDb || index !== -1;
}

export async function getVans(): Promise<VanRecord[]> {
  await initializeFromDatabase();
  // Always fetch from database to ensure consistency
  const dbVans = await getAllVans();
  const vansFromDb = dbVans.map((van) => {
    const startingTownId = van.startingTownId as TownId;
    const townCoords = townCoordinates(startingTownId);
    const latitude = parseCoordinate(van.latitude) ?? townCoords.latitude;
    const longitude = parseCoordinate(van.longitude) ?? townCoords.longitude;
    return {
      id: van.id,
      driverName: van.driverName,
      vehicleId: van.vehicleId,
      startingTownId,
      addressLine: van.addressLine || "",
      latitude,
      longitude,
      assignedHelperIds: [],
      notes: van.notes || "",
    };
  });
  if (vansFromDb.length > 0) {
    vans = vansFromDb;
  }
  return vans;
}

export async function createHelper(input: {
  name: string;
  townId: TownId;
  weekdayAvailable: boolean;
  weekendAvailable: boolean;
  addressLine?: string;
  latitude?: number;
  longitude?: number;
  notes?: string;
}): Promise<HelperRecord> {
  const townCoords = townCoordinates(input.townId);
  const helper: HelperRecord = {
    id: generateId(),
    name: input.name,
    townId: input.townId,
    addressLine: input.addressLine || "",
    latitude: input.latitude ?? townCoords.latitude,
    longitude: input.longitude ?? townCoords.longitude,
    weekdayAvailable: input.weekdayAvailable,
    weekendAvailable: input.weekendAvailable,
    notes: input.notes || "",
  };

  const created = await createHelperInDb({
    id: helper.id,
    name: helper.name,
    townId: helper.townId,
    weekdayAvailable: helper.weekdayAvailable ? 1 : 0,
    weekendAvailable: helper.weekendAvailable ? 1 : 0,
    addressLine: helper.addressLine,
    latitude: String(helper.latitude),
    longitude: String(helper.longitude),
    notes: helper.notes,
  });

  operationsState = {
    ...operationsState,
    helpers: [...operationsState.helpers.filter((item) => item.id !== helper.id), helper],
  };
  await saveLocalState();
  return helper;
}

export async function updateHelper(id: string, input: Partial<HelperRecord>): Promise<HelperRecord | null> {
  const persisted = await updateHelperInDb(id, {
    name: input.name,
    townId: input.townId,
    weekdayAvailable: input.weekdayAvailable === undefined ? undefined : (input.weekdayAvailable ? 1 : 0),
    weekendAvailable: input.weekendAvailable === undefined ? undefined : (input.weekendAvailable ? 1 : 0),
    addressLine: input.addressLine,
    latitude: input.latitude === undefined ? undefined : String(input.latitude),
    longitude: input.longitude === undefined ? undefined : String(input.longitude),
    notes: input.notes,
  });

  const existing = operationsState.helpers.find((helper) => helper.id === id);
  if (!existing && !persisted) {
    return null;
  }
  const updated = existing ? { ...existing, ...input } : {
    id: persisted!.id,
    name: persisted!.name,
    townId: persisted!.townId as TownId,
    addressLine: persisted!.addressLine ?? undefined,
    latitude: parseCoordinate(persisted!.latitude) ?? townCoordinates(persisted!.townId as TownId).latitude,
    longitude: parseCoordinate(persisted!.longitude) ?? townCoordinates(persisted!.townId as TownId).longitude,
    weekdayAvailable: Boolean(persisted!.weekdayAvailable),
    weekendAvailable: Boolean(persisted!.weekendAvailable),
    notes: persisted!.notes ?? undefined,
  };
  operationsState = {
    ...operationsState,
    helpers: operationsState.helpers.some((helper) => helper.id === id)
      ? operationsState.helpers.map((helper) => (helper.id === id ? updated : helper))
      : [...operationsState.helpers, updated],
  };
  await saveLocalState();
  return updated;
}

export async function deleteHelper(id: string): Promise<boolean> {
  const deletedFromDb = await deleteHelperInDb(id);
  const existedInMemory = operationsState.helpers.some((helper) => helper.id === id);
  operationsState = {
    ...operationsState,
    helpers: operationsState.helpers.filter((helper) => helper.id !== id),
  };
  await saveLocalState();
  return deletedFromDb || existedInMemory;
}

export async function selectVan(id: string): Promise<boolean> {
  if (vans.find((v) => v.id === id)) {
    selectedVanId = id;
    await saveLocalState();
    return true;
  }
  return false;
}

export function getSelectedVanId(): string | null {
  return selectedVanId;
}
