import { describe, expect, it } from "vitest";

import {
  buildRoutePlan,
  buildOperationsSnapshot,
  chooseBestHelper,
  createSeedState,
  isHelperAvailable,
  validateRouteInputs,
  type JobRecord,
} from "../shared/route-planner";

describe("route planner", () => {
  it("recommends the weekend-available helper on weekends", () => {
    const weekendDate = "2026-04-11";
    const state = createSeedState(weekendDate);

    expect(isHelperAvailable(state.helpers[0], weekendDate)).toBe(true);
    expect(isHelperAvailable(state.helpers[1], weekendDate)).toBe(false);

    const validatedJobs = validateRouteInputs(state.jobs, state.settings);
    const recommendation = chooseBestHelper(state.helpers, validatedJobs, state.settings, weekendDate);

    expect(recommendation.helper?.id).toBe("helper_mia");
  });

  it("creates a route with at least one helper stop and one unit stop for the default sample day", () => {
    const dateKey = "2026-04-08";
    const state = createSeedState(dateKey);

    const validatedJobs = validateRouteInputs(state.jobs, state.settings);
    const plan = buildRoutePlan(validatedJobs, state.helpers, state.settings, dateKey);

    expect(plan.stops.length).toBeGreaterThan(0);
    expect(plan.stops.some((stop) => stop.kind === "helper")).toBe(true);
    expect(plan.stops.some((stop) => stop.kind === "unit")).toBe(true);
    expect(plan.summary.totalJobs).toBe(4);
  });

  it("keeps van load within capacity throughout the generated route", () => {
    const dateKey = "2026-04-08";
    const state = createSeedState(dateKey);

    const validatedJobs = validateRouteInputs(state.jobs, state.settings);
    const plan = buildRoutePlan(validatedJobs, state.helpers, state.settings, dateKey);

    for (const stop of plan.stops) {
      expect(stop.loadBefore).toBeGreaterThanOrEqual(0);
      expect(stop.loadAfter).toBeGreaterThanOrEqual(0);
      expect(stop.loadBefore).toBeLessThanOrEqual(state.settings.vanCapacity);
      expect(stop.loadAfter).toBeLessThanOrEqual(state.settings.vanCapacity);
    }
  });

  it("builds an operations snapshot with active jobs and a next stop", () => {
    const dateKey = "2026-04-08";
    const state = createSeedState(dateKey);

    const snapshot = buildOperationsSnapshot(state, dateKey);

    expect(snapshot.todaysJobs.length).toBe(4);
    expect(snapshot.activeJobs.length).toBe(4);
    expect(snapshot.routePlan.nextStop).not.toBeNull();
    expect(snapshot.routePlan.summary.totalStops).toBe(snapshot.routePlan.stops.length);
  });

  it("starts a weekday route with the recommended helper stop before any customer job", () => {
    const dateKey = "2026-04-07";
    const state = createSeedState(dateKey);

    const validatedJobs = validateRouteInputs(state.jobs, state.settings);
    const plan = buildRoutePlan(validatedJobs, state.helpers, state.settings, dateKey);

    expect(plan.selectedHelper?.name).toBe("Ross");
    expect(plan.nextStop?.kind).toBe("helper");
    expect(plan.nextStop?.label).toBe("Ross");
    expect(plan.routeHeadline).toContain("Pick up Ross next");
    expect(plan.stops[2]?.kind).toBe("job");
  });

  it("adds a unit return when sequential pickups would exceed van capacity", () => {
    const dateKey = "2026-04-08";
    const state = createSeedState(dateKey);

    const pickupJobs: JobRecord[] = [
      {
        id: "pickup_one",
        customerName: "First Pickup",
        contactName: "A Customer",
        contactPhone: "07000 000 001",
        addressLine: "1 High Street",
        latitude: 55.8642,
        longitude: -4.2518,
        townId: "glasgow",
        type: "pickup",
        sofaCount: 2,
        pickupCount: 2,
        scheduledDay: dateKey,
        timeWindow: "09:00 - 10:00",
        floor: "",
        duration: 30,
        notes: "",
        status: "scheduled",
        createdAt: new Date("2026-04-08T08:00:00Z"),
        updatedAt: new Date("2026-04-08T08:00:00Z"),
      },
      {
        id: "pickup_two",
        customerName: "Second Pickup",
        contactName: "B Customer",
        contactPhone: "07000 000 002",
        addressLine: "2 Main Road",
        latitude: 55.9533,
        longitude: -3.1883,
        townId: "edinburgh",
        type: "pickup",
        sofaCount: 2,
        pickupCount: 2,
        floor: "",
        duration: 30,
        scheduledDay: dateKey,
        timeWindow: "10:30 - 12:00",
        notes: "",
        status: "scheduled",
        createdAt: new Date("2026-04-08T08:00:00Z"),
        updatedAt: new Date("2026-04-08T08:00:00Z"),
      },
    ];

    const validatedJobs = validateRouteInputs(pickupJobs, state.settings);
    const plan = buildRoutePlan(validatedJobs, state.helpers, state.settings, dateKey);
    const unitStops = plan.stops.filter((stop) => stop.kind === "unit");
    const overflowProtectionStop = unitStops.find(
      (stop) => stop.loadBefore > 0 && stop.loadAfter === 0 && stop.reason !== "Finish by returning collected stock to the unit and clearing the van.",
    );

    expect(unitStops.length).toBeGreaterThanOrEqual(2);
    expect(overflowProtectionStop).toBeTruthy();
    expect(overflowProtectionStop?.loadBefore).toBeGreaterThan(0);
    expect(overflowProtectionStop?.loadAfter).toBe(0);
  });

  it("reloads at the unit when deliveries exceed van capacity", () => {
    const dateKey = "2026-04-08";
    const state = createSeedState(dateKey);
    const deliveryJobs: JobRecord[] = Array.from({ length: 4 }, (_, index) => ({
      id: `delivery_${index + 1}`,
      customerName: `Delivery ${index + 1}`,
      contactName: "Customer",
      contactPhone: "07000 000 010",
      addressLine: `${index + 1} Delivery Road`,
      latitude: 55.8642,
      longitude: -4.2518,
      townId: "glasgow",
      type: "delivery",
      sofaCount: 1,
      pickupCount: 0,
      scheduledDay: dateKey,
      timeWindow: "09:00 - 17:00",
      floor: "",
      duration: 30,
      notes: "",
      status: "scheduled",
      createdAt: new Date("2026-04-08T08:00:00Z"),
      updatedAt: new Date("2026-04-08T08:00:00Z"),
    }));

    const validatedJobs = validateRouteInputs(deliveryJobs, state.settings);
    const plan = buildRoutePlan(validatedJobs, [], state.settings, dateKey);
    const jobStops = plan.stops.filter((stop) => stop.kind === "job");
    const reloadStops = plan.stops.filter((stop) => stop.kind === "unit" && stop.deltaSofas > 0);

    expect(plan.summary.startingLoad).toBe(0);
    expect(reloadStops[0]?.loadBefore).toBe(0);
    expect(reloadStops[0]?.loadAfter).toBe(3);
    expect(jobStops.map((stop) => stop.deltaSofas)).toEqual([-1, -1, -1, -1]);
    expect(reloadStops.length).toBeGreaterThanOrEqual(1);
    expect(plan.stops.every((stop) => stop.loadAfter >= 0 && stop.loadAfter <= state.settings.vanCapacity)).toBe(true);
  });
});
