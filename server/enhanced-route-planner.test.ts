import { describe, expect, it } from "vitest";
import { createJobRecord, createSeedState, TOWN_OPTIONS, type VanRecord } from "../shared/route-planner";
import { buildEnhancedRoutePlan } from "./enhanced-route-planner";
import type { DistanceProvider } from "./distance-provider";

const instantDistanceProvider: DistanceProvider = {
  async getTravelTime() {
    return 1;
  },
  async getTravelDistance() {
    return 1;
  },
  async getBatchTravelTimes(origins, destinations) {
    return origins.map(() => destinations.map(() => 1));
  },
};

function coordinateKey([latitude, longitude]: [number, number]) {
  return `${latitude},${longitude}`;
}

function createMappedDistanceProvider(times: Record<string, number>): DistanceProvider {
  return {
    async getTravelTime(origin, destination) {
      return times[`${coordinateKey(origin)}>${coordinateKey(destination)}`] ?? 1;
    },
    async getTravelDistance() {
      return 1;
    },
    async getBatchTravelTimes(origins, destinations) {
      return Promise.all(origins.map(async (origin) =>
        Promise.all(destinations.map((destination) => this.getTravelTime(origin, destination))),
      ));
    },
  };
}

function createTestVan(): VanRecord {
  return {
    id: "van_test",
    driverName: "Test Driver",
    vehicleId: "vehicle_test",
    startingTownId: "cumbernauld",
    addressLine: "Driver home address",
    latitude: TOWN_OPTIONS.cumbernauld.latitude,
    longitude: TOWN_OPTIONS.cumbernauld.longitude,
    assignedHelperIds: [],
    notes: "",
  };
}

describe("enhanced route planner stock flow", () => {
  it("starts delivery-only routes empty and inserts unit reloads before deliveries", async () => {
    const dateKey = "2026-07-21";
    const state = createSeedState(dateKey);
    const deliveryJobs = Array.from({ length: 4 }, (_, index) =>
      createJobRecord({
        id: `delivery_${index + 1}`,
        customerName: `Delivery ${index + 1}`,
        contactName: "Customer",
        contactPhone: "07000 000 010",
        addressLine: `${index + 1} Delivery Road`,
        townId: "glasgow",
        latitude: TOWN_OPTIONS.glasgow.latitude,
        longitude: TOWN_OPTIONS.glasgow.longitude,
        type: "delivery",
        sofaCount: 1,
        pickupCount: 0,
        scheduledDay: dateKey,
        timeWindow: "09:00 - 17:00",
        floor: "",
        duration: 30,
        notes: "",
        status: "scheduled",
      }),
    );

    const plan = await buildEnhancedRoutePlan(
      deliveryJobs,
      [],
      state.settings,
      dateKey,
      createTestVan(),
      { includeHelper: false, returnToUnit: false, distanceProvider: instantDistanceProvider },
    );

    const reloadStops = plan.stops.filter((stop) => stop.kind === "unit" && stop.deltaSofas > 0);
    const jobStops = plan.stops.filter((stop) => stop.kind === "job");

    expect(plan.summary.startingLoad).toBe(0);
    expect(reloadStops[0]?.loadBefore).toBe(0);
    expect(reloadStops[0]?.loadAfter).toBe(3);
    expect(reloadStops[0]?.serviceMinutes).toBe(30);
    expect(jobStops.map((stop) => stop.deltaSofas)).toEqual([-1, -1, -1, -1]);
    expect(plan.stops.every((stop) => stop.loadAfter >= 0 && stop.loadAfter <= state.settings.vanCapacity)).toBe(true);
  });

  it("does not add on-site time for helper pickup or drop-off", async () => {
    const dateKey = "2026-07-21";
    const state = createSeedState(dateKey);
    const helper = {
      id: "helper_zero_time",
      name: "Helper",
      townId: "falkirk" as const,
      addressLine: "9 Knowehead Road, Redding, FK2 9YA",
      latitude: TOWN_OPTIONS.falkirk.latitude,
      longitude: TOWN_OPTIONS.falkirk.longitude,
      weekdayAvailable: true,
      weekendAvailable: true,
      notes: "",
    };
    const job = createJobRecord({
      id: "helper_route_job",
      customerName: "Helper Route Job",
      contactName: "Customer",
      contactPhone: "07000 000 011",
      addressLine: "Delivery Road",
      townId: "glasgow",
      latitude: TOWN_OPTIONS.glasgow.latitude,
      longitude: TOWN_OPTIONS.glasgow.longitude,
      type: "delivery",
      sofaCount: 1,
      pickupCount: 0,
      scheduledDay: dateKey,
      timeWindow: "09:00 - 17:00",
      floor: "",
      duration: 30,
      notes: "",
      status: "scheduled",
    });

    const plan = await buildEnhancedRoutePlan(
      [job],
      [helper],
      state.settings,
      dateKey,
      createTestVan(),
      { includeHelper: true, returnToUnit: true, distanceProvider: instantDistanceProvider },
    );

    expect(plan.stops.find((stop) => stop.kind === "helper")?.serviceMinutes).toBe(0);
    expect(plan.stops.find((stop) => stop.kind === "helper-dropoff")?.serviceMinutes).toBe(0);
    expect(plan.stops.find((stop) => stop.kind === "helper")?.addressLine).toBe(helper.addressLine);
    expect(plan.stops.find((stop) => stop.kind === "helper-dropoff")?.addressLine).toBe(helper.addressLine);
  });

  it("uses each job duration as the on-site time", async () => {
    const dateKey = "2026-07-21";
    const state = createSeedState(dateKey);
    const job = createJobRecord({
      id: "long_job",
      customerName: "Long Job",
      contactName: "Customer",
      contactPhone: "07000 000 022",
      addressLine: "Long Job Road",
      townId: "glasgow",
      latitude: TOWN_OPTIONS.glasgow.latitude,
      longitude: TOWN_OPTIONS.glasgow.longitude,
      type: "pickup",
      sofaCount: 1,
      pickupCount: 1,
      scheduledDay: dateKey,
      timeWindow: "10:00 - 11:00",
      floor: "",
      duration: 45,
      notes: "",
      status: "scheduled",
    });

    const plan = await buildEnhancedRoutePlan(
      [job],
      [],
      state.settings,
      dateKey,
      createTestVan(),
      { includeHelper: false, returnToUnit: false, distanceProvider: instantDistanceProvider },
    );

    expect(plan.stops.find((stop) => stop.relatedJobId === job.id)?.serviceMinutes).toBe(45);
  });

  it("does not arrive before a job time window starts", async () => {
    const dateKey = "2026-07-21";
    const state = createSeedState(dateKey);
    state.settings.workdayStart = "09:00";
    const afternoonPickup = createJobRecord({
      id: "afternoon_pickup",
      customerName: "Afternoon Pickup",
      contactName: "Customer",
      contactPhone: "07000 000 023",
      addressLine: "Afternoon Road",
      townId: "glasgow",
      latitude: TOWN_OPTIONS.glasgow.latitude,
      longitude: TOWN_OPTIONS.glasgow.longitude,
      type: "pickup",
      sofaCount: 1,
      pickupCount: 1,
      scheduledDay: dateKey,
      timeWindow: "16:00 - 22:00",
      floor: "",
      duration: 30,
      notes: "",
      status: "scheduled",
    });

    const plan = await buildEnhancedRoutePlan(
      [afternoonPickup],
      [],
      state.settings,
      dateKey,
      createTestVan(),
      { includeHelper: false, returnToUnit: false, distanceProvider: instantDistanceProvider },
    );
    const stop = plan.stops.find((item) => item.relatedJobId === afternoonPickup.id);

    expect(stop).toBeDefined();
    expect(stop!.etaMinutesFromStart - stop!.serviceMinutes).toBeGreaterThanOrEqual(16 * 60);
  });

  it("protects tight time windows instead of doing a flexible nearby job too early", async () => {
    const dateKey = "2026-07-21";
    const state = createSeedState(dateKey);
    state.settings.workdayStart = "09:00";
    state.settings.unitLatitude = 9;
    state.settings.unitLongitude = 9;
    const van = {
      ...createTestVan(),
      latitude: 0,
      longitude: 0,
    };
    const tightWindowJob = createJobRecord({
      id: "tight_window",
      customerName: "Tight Window",
      contactName: "Customer",
      contactPhone: "07000 000 024",
      addressLine: "Tight Window Road",
      townId: "glasgow",
      latitude: 2,
      longitude: 2,
      type: "pickup",
      sofaCount: 1,
      pickupCount: 1,
      scheduledDay: dateKey,
      timeWindow: "10:00 - 10:15",
      floor: "",
      duration: 30,
      notes: "",
      status: "scheduled",
    });
    const flexibleJob = createJobRecord({
      id: "flexible_nearby",
      customerName: "Flexible Nearby",
      contactName: "Customer",
      contactPhone: "07000 000 025",
      addressLine: "Flexible Road",
      townId: "glasgow",
      latitude: 1,
      longitude: 1,
      type: "pickup",
      sofaCount: 1,
      pickupCount: 1,
      scheduledDay: dateKey,
      timeWindow: "Flexible",
      floor: "",
      duration: 30,
      notes: "",
      status: "scheduled",
    });
    const provider = createMappedDistanceProvider({
      "0,0>1,1": 30,
      "0,0>2,2": 20,
      "1,1>2,2": 60,
      "2,2>1,1": 10,
    });

    const plan = await buildEnhancedRoutePlan(
      [flexibleJob, tightWindowJob],
      [],
      state.settings,
      dateKey,
      van,
      { includeHelper: false, returnToUnit: false, distanceProvider: provider },
    );
    const jobStops = plan.stops.filter((stop) => stop.kind === "job");
    const tightWindowArrival = jobStops[0]!.etaMinutesFromStart - jobStops[0]!.serviceMinutes;

    expect(jobStops[0]?.relatedJobId).toBe(tightWindowJob.id);
    expect(tightWindowArrival).toBeGreaterThanOrEqual(10 * 60);
    expect(tightWindowArrival).toBeLessThanOrEqual(10 * 60 + 15);
  });

  it("can choose to load delivery stock before doing an available flexible pickup", async () => {
    const dateKey = "2026-07-21";
    const state = createSeedState(dateKey);
    state.settings.unitLatitude = 0;
    state.settings.unitLongitude = 1;
    const van = {
      ...createTestVan(),
      latitude: 0,
      longitude: 0,
    };
    const flexiblePickup = createJobRecord({
      id: "flexible_pickup",
      customerName: "Flexible Pickup",
      contactName: "Customer",
      contactPhone: "07000 000 026",
      addressLine: "Pickup Road",
      townId: "glasgow",
      latitude: 1,
      longitude: 0,
      type: "pickup",
      sofaCount: 1,
      pickupCount: 1,
      scheduledDay: dateKey,
      timeWindow: "Flexible",
      floor: "",
      duration: 30,
      notes: "",
      status: "scheduled",
    });
    const deliveryWaitingAtUnit = createJobRecord({
      id: "delivery_waiting_at_unit",
      customerName: "Delivery Waiting",
      contactName: "Customer",
      contactPhone: "07000 000 027",
      addressLine: "Delivery Road",
      townId: "glasgow",
      latitude: 0,
      longitude: 2,
      type: "delivery",
      sofaCount: 1,
      pickupCount: 0,
      scheduledDay: dateKey,
      timeWindow: "Flexible",
      floor: "",
      duration: 30,
      notes: "",
      status: "scheduled",
    });
    const provider = createMappedDistanceProvider({
      "0,0>1,0": 10,
      "0,0>0,1": 5,
    });

    const plan = await buildEnhancedRoutePlan(
      [flexiblePickup, deliveryWaitingAtUnit],
      [],
      state.settings,
      dateKey,
      van,
      { includeHelper: false, returnToUnit: false, distanceProvider: provider },
    );

    const firstActionStop = plan.stops.find((stop) => stop.kind !== "start");

    expect(firstActionStop?.kind).toBe("unit");
    expect(firstActionStop?.loadAfter).toBe(1);
  });

  it("moves the day start later when that keeps a timed job flowing without idle waiting", async () => {
    const dateKey = "2026-07-21";
    const state = createSeedState(dateKey);
    state.settings.workdayStart = "08:30";
    state.settings.workdayEnd = "17:30";
    const van = {
      ...createTestVan(),
      latitude: 0,
      longitude: 0,
    };
    const afternoonDelivery = createJobRecord({
      id: "afternoon_delivery",
      customerName: "Afternoon Delivery",
      contactName: "Customer",
      contactPhone: "07000 000 028",
      addressLine: "Afternoon Delivery Road",
      townId: "glasgow",
      latitude: 1,
      longitude: 1,
      type: "delivery",
      sofaCount: 1,
      pickupCount: 0,
      scheduledDay: dateKey,
      timeWindow: "14:30 - 15:00",
      floor: "",
      duration: 30,
      notes: "",
      status: "scheduled",
    });
    const provider = createMappedDistanceProvider({
      "0,0>1,1": 30,
    });

    const plan = await buildEnhancedRoutePlan(
      [afternoonDelivery],
      [],
      state.settings,
      dateKey,
      van,
      { includeHelper: false, returnToUnit: false, distanceProvider: provider },
    );
    const startStop = plan.stops[0];
    const jobStop = plan.stops.find((stop) => stop.relatedJobId === afternoonDelivery.id);
    const jobArrival = jobStop!.etaMinutesFromStart - jobStop!.serviceMinutes;

    expect(startStop.etaMinutesFromStart).toBeGreaterThan(8 * 60 + 30);
    expect(jobArrival).toBe(14 * 60 + 30);
  });

  it("does not move the day start later when every job is flexible", async () => {
    const dateKey = "2026-08-05";
    const state = createSeedState(dateKey);
    state.settings.workdayStart = "08:30";
    state.settings.workdayEnd = "17:30";
    state.settings.unitLatitude = 0;
    state.settings.unitLongitude = 0;
    const van = {
      ...createTestVan(),
      latitude: 0,
      longitude: 0,
    };
    const flexibleDelivery = createJobRecord({
      id: "flexible_delivery_only",
      customerName: "Flexible Delivery",
      contactName: "Customer",
      contactPhone: "07000 000 032",
      addressLine: "Flexible Road",
      townId: "glasgow",
      latitude: 1,
      longitude: 0,
      type: "delivery",
      sofaCount: 1,
      pickupCount: 0,
      scheduledDay: dateKey,
      timeWindow: "Flexible",
      floor: "",
      duration: 30,
      notes: "",
      status: "scheduled",
    });

    const plan = await buildEnhancedRoutePlan(
      [flexibleDelivery],
      [],
      state.settings,
      dateKey,
      van,
      { includeHelper: false, returnToUnit: false, distanceProvider: instantDistanceProvider },
    );

    expect(plan.stops[0].etaMinutesFromStart).toBe(8 * 60 + 30);
  });

  it("fills a large gap before a timed job with a flexible stop when it can still arrive on time", async () => {
    const dateKey = "2026-07-21";
    const state = createSeedState(dateKey);
    state.settings.workdayStart = "08:30";
    state.settings.workdayEnd = "17:30";
    state.settings.unitLatitude = 0;
    state.settings.unitLongitude = 0;
    state.settings.vanCapacity = 3;
    const van = {
      ...createTestVan(),
      latitude: 0,
      longitude: 0,
    };
    const firstFlexibleDelivery = createJobRecord({
      id: "first_flexible_delivery",
      customerName: "First Flexible Delivery",
      contactName: "Customer",
      contactPhone: "07000 000 029",
      addressLine: "First Road",
      townId: "glasgow",
      latitude: 1,
      longitude: 0,
      type: "delivery",
      sofaCount: 1,
      pickupCount: 0,
      scheduledDay: dateKey,
      timeWindow: "Flexible",
      floor: "",
      duration: 30,
      notes: "",
      status: "scheduled",
    });
    const timedDelivery = createJobRecord({
      id: "timed_delivery",
      customerName: "Timed Delivery",
      contactName: "Customer",
      contactPhone: "07000 000 030",
      addressLine: "Timed Road",
      townId: "glasgow",
      latitude: 3,
      longitude: 0,
      type: "delivery",
      sofaCount: 1,
      pickupCount: 0,
      scheduledDay: dateKey,
      timeWindow: "14:30 - 15:00",
      floor: "",
      duration: 30,
      notes: "",
      status: "scheduled",
    });
    const gapFillerDelivery = createJobRecord({
      id: "gap_filler_delivery",
      customerName: "Gap Filler Delivery",
      contactName: "Customer",
      contactPhone: "07000 000 031",
      addressLine: "Gap Filler Road",
      townId: "glasgow",
      latitude: 2,
      longitude: 0,
      type: "delivery",
      sofaCount: 1,
      pickupCount: 0,
      scheduledDay: dateKey,
      timeWindow: "Flexible",
      floor: "",
      duration: 30,
      notes: "",
      status: "scheduled",
    });
    const provider = createMappedDistanceProvider({
      "0,0>1,0": 30,
      "0,0>2,0": 70,
      "0,0>3,0": 65,
      "1,0>2,0": 35,
      "1,0>3,0": 65,
      "2,0>3,0": 45,
    });

    const plan = await buildEnhancedRoutePlan(
      [firstFlexibleDelivery, timedDelivery, gapFillerDelivery],
      [],
      state.settings,
      dateKey,
      van,
      { includeHelper: false, returnToUnit: false, distanceProvider: provider },
    );
    const jobStops = plan.stops.filter((stop) => stop.kind === "job");
    const timedStop = jobStops.find((stop) => stop.relatedJobId === timedDelivery.id);
    const timedArrival = timedStop!.etaMinutesFromStart - timedStop!.serviceMinutes;

    expect(jobStops.findIndex((stop) => stop.relatedJobId === timedDelivery.id)).toBeGreaterThan(0);
    expect(jobStops.slice(0, 2).some((stop) => stop.relatedJobId === gapFillerDelivery.id)).toBe(true);
    expect(timedArrival).toBe(14 * 60 + 30);
  });

  it("keeps completed pickup stock dirty and reloads clean stock before a delivery", async () => {
    const dateKey = "2026-07-21";
    const state = createSeedState(dateKey);
    const completedPickup = createJobRecord({
      id: "completed_pickup",
      customerName: "Completed Pickup",
      contactName: "Customer",
      contactPhone: "07000 000 020",
      addressLine: "Pickup Road",
      townId: "livingston",
      latitude: TOWN_OPTIONS.livingston.latitude,
      longitude: TOWN_OPTIONS.livingston.longitude,
      type: "pickup",
      sofaCount: 1,
      pickupCount: 1,
      scheduledDay: dateKey,
      timeWindow: "09:00 - 10:00",
      floor: "",
      duration: 30,
      notes: "",
      status: "completed",
      updatedAt: new Date("2026-07-21T09:30:00Z"),
    });
    const scheduledDelivery = createJobRecord({
      id: "scheduled_delivery",
      customerName: "Scheduled Delivery",
      contactName: "Customer",
      contactPhone: "07000 000 021",
      addressLine: "Delivery Road",
      townId: "glasgow",
      latitude: TOWN_OPTIONS.glasgow.latitude,
      longitude: TOWN_OPTIONS.glasgow.longitude,
      type: "delivery",
      sofaCount: 1,
      pickupCount: 0,
      scheduledDay: dateKey,
      timeWindow: "10:00 - 11:00",
      floor: "",
      duration: 30,
      notes: "",
      status: "scheduled",
    });

    const plan = await buildEnhancedRoutePlan(
      [completedPickup, scheduledDelivery],
      [],
      state.settings,
      dateKey,
      createTestVan(),
      { includeHelper: false, returnToUnit: false, distanceProvider: instantDistanceProvider },
    );

    const deliveryStop = plan.stops.find((stop) => stop.relatedJobId === "scheduled_delivery");
    const reloadStop = plan.stops.find((stop) => stop.kind === "unit" && stop.loadBefore === 1 && stop.loadAfter === 1);

    expect(plan.summary.startingLoad).toBe(1);
    expect(reloadStop?.dirtyLoadBefore).toBe(1);
    expect(reloadStop?.dirtyLoadAfter).toBe(0);
    expect(reloadStop?.cleanLoadAfter).toBe(1);
    expect(deliveryStop?.loadBefore).toBe(1);
    expect(deliveryStop?.cleanLoadBefore).toBe(1);
    expect(deliveryStop?.dirtyLoadBefore).toBe(0);
    expect(deliveryStop?.loadAfter).toBe(0);
  });

  it("supports one stop that both delivers clean stock and collects a dirty removal with decimal counts", async () => {
    const dateKey = "2026-07-21";
    const state = createSeedState(dateKey);
    const bothJob = createJobRecord({
      id: "both_decimal",
      customerName: "Swap Customer",
      contactName: "Customer",
      contactPhone: "07000 000 040",
      addressLine: "Swap Road",
      townId: "glasgow",
      latitude: TOWN_OPTIONS.glasgow.latitude,
      longitude: TOWN_OPTIONS.glasgow.longitude,
      type: "both",
      sofaCount: 1.5,
      pickupCount: 0.8,
      scheduledDay: dateKey,
      timeWindow: "09:00 - 17:00",
      floor: "",
      duration: 30,
      notes: "",
      status: "scheduled",
    });

    const plan = await buildEnhancedRoutePlan(
      [bothJob],
      [],
      state.settings,
      dateKey,
      createTestVan(),
      { includeHelper: false, returnToUnit: false, distanceProvider: instantDistanceProvider },
    );

    const jobStop = plan.stops.find((stop) => stop.relatedJobId === "both_decimal");

    expect(plan.stops.some((stop) => stop.kind === "unit" && stop.cleanLoadAfter === 1.5)).toBe(true);
    expect(jobStop?.cleanLoadBefore).toBe(1.5);
    expect(jobStop?.cleanLoadAfter).toBe(0);
    expect(jobStop?.dirtyLoadBefore).toBe(0);
    expect(jobStop?.dirtyLoadAfter).toBe(0.8);
    expect(jobStop?.loadAfter).toBe(0.8);
  });

  it("inserts a unit unload when pickups would exceed van capacity", async () => {
    const dateKey = "2026-07-21";
    const state = createSeedState(dateKey);
    const pickupJobs = Array.from({ length: 4 }, (_, index) =>
      createJobRecord({
        id: `pickup_${index + 1}`,
        customerName: `Pickup ${index + 1}`,
        contactName: "Customer",
        contactPhone: "07000 000 030",
        addressLine: `${index + 1} Pickup Road`,
        townId: "edinburgh",
        latitude: TOWN_OPTIONS.edinburgh.latitude,
        longitude: TOWN_OPTIONS.edinburgh.longitude,
        type: "pickup",
        sofaCount: 1,
        pickupCount: 1,
        scheduledDay: dateKey,
        timeWindow: "09:00 - 17:00",
        floor: "",
        duration: 30,
        notes: "",
        status: "scheduled",
      }),
    );

    const plan = await buildEnhancedRoutePlan(
      pickupJobs,
      [],
      state.settings,
      dateKey,
      createTestVan(),
      { includeHelper: false, returnToUnit: false, distanceProvider: instantDistanceProvider },
    );

    const unloadStops = plan.stops.filter((stop) => stop.kind === "unit" && stop.deltaSofas < 0);

    expect(unloadStops.some((stop) => stop.loadBefore === 3 && stop.loadAfter === 0)).toBe(true);
    expect(plan.stops.every((stop) => stop.loadAfter >= 0 && stop.loadAfter <= state.settings.vanCapacity)).toBe(true);
  });

  it("adds a final home leg after the work route", async () => {
    const dateKey = "2026-07-21";
    const state = createSeedState(dateKey);
    const van = createTestVan();
    const job = createJobRecord({
      id: "home_leg_delivery",
      customerName: "Home Leg Delivery",
      contactName: "Customer",
      contactPhone: "07000 000 050",
      addressLine: "Delivery Road",
      townId: "glasgow",
      latitude: TOWN_OPTIONS.glasgow.latitude,
      longitude: TOWN_OPTIONS.glasgow.longitude,
      type: "delivery",
      sofaCount: 1,
      pickupCount: 0,
      scheduledDay: dateKey,
      timeWindow: "09:00 - 17:00",
      floor: "",
      duration: 30,
      notes: "",
      status: "scheduled",
    });

    const plan = await buildEnhancedRoutePlan(
      [job],
      [],
      state.settings,
      dateKey,
      van,
      { includeHelper: false, returnToUnit: false, distanceProvider: instantDistanceProvider },
    );

    const finalStop = plan.stops.at(-1);

    expect(finalStop?.kind).toBe("home");
    expect(finalStop?.addressLine).toBe(van.addressLine);
    expect(finalStop?.latitude).toBe(van.latitude);
    expect(finalStop?.longitude).toBe(van.longitude);
  });

  it("orders pickup batches to finish closer to the unit when a unit return is likely", async () => {
    const dateKey = "2026-07-21";
    const state = createSeedState(dateKey);
    state.settings.unitTownId = "falkirk";
    state.settings.unitLatitude = TOWN_OPTIONS.falkirk.latitude;
    state.settings.unitLongitude = TOWN_OPTIONS.falkirk.longitude;
    const van = createTestVan();
    const stirlingPickup = createJobRecord({
      id: "pickup_stirling_farther_from_unit",
      customerName: "Stirling Pickup",
      contactName: "Customer",
      contactPhone: "07000 000 060",
      addressLine: "Stirling Pickup Road",
      townId: "stirling",
      latitude: TOWN_OPTIONS.stirling.latitude,
      longitude: TOWN_OPTIONS.stirling.longitude,
      type: "pickup",
      sofaCount: 1,
      pickupCount: 1,
      scheduledDay: dateKey,
      timeWindow: "09:00 - 17:00",
      floor: "",
      duration: 30,
      notes: "",
      status: "scheduled",
    });
    const falkirkPickup = createJobRecord({
      id: "pickup_falkirk_near_unit",
      customerName: "Falkirk Pickup",
      contactName: "Customer",
      contactPhone: "07000 000 061",
      addressLine: "Falkirk Pickup Road",
      townId: "falkirk",
      latitude: TOWN_OPTIONS.falkirk.latitude,
      longitude: TOWN_OPTIONS.falkirk.longitude,
      type: "pickup",
      sofaCount: 1,
      pickupCount: 1,
      scheduledDay: dateKey,
      timeWindow: "09:00 - 17:00",
      floor: "",
      duration: 30,
      notes: "",
      status: "scheduled",
    });

    const plan = await buildEnhancedRoutePlan(
      [falkirkPickup, stirlingPickup],
      [],
      state.settings,
      dateKey,
      van,
      { includeHelper: false, returnToUnit: true, distanceProvider: instantDistanceProvider },
    );

    const jobStops = plan.stops.filter((stop) => stop.kind === "job");

    expect(jobStops.map((stop) => stop.relatedJobId)).toEqual([
      "pickup_stirling_farther_from_unit",
      "pickup_falkirk_near_unit",
    ]);
    expect(plan.stops.at(-2)?.kind).toBe("unit");
    expect(plan.stops.at(-1)?.kind).toBe("home");
  });
});
