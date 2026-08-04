import { describe, it, expect } from "vitest";
import { buildRoutePlan, createSeedState, todayKey, validateRouteInputs } from "./route-planner";

describe("buildRoutePlan with toggle flags", () => {
  const seedState = createSeedState();
  const dateKey = todayKey();

  // Create test jobs
  const testJobs = [
    {
      id: "job1",
      customerName: "Customer A",
      contactName: "John",
      contactPhone: "01234567890",
      addressLine: "123 Main St",
      townId: "glasgow" as const,
      type: "pickup" as const,
      sofaCount: 2,
      pickupCount: 0,
      scheduledDay: dateKey,
      timeWindow: "09:00-12:00",
      floor: "Ground",
      duration: 30,
      notes: "",
      status: "scheduled" as const,
      latitude: 55.8642,
      longitude: -4.2518,
      createdAt: new Date(),
      updatedAt: new Date(),
    },
    {
      id: "job2",
      customerName: "Customer B",
      contactName: "Jane",
      contactPhone: "01234567891",
      addressLine: "456 Oak Ave",
      townId: "edinburgh" as const,
      latitude: 55.9533,
      longitude: -3.1883,
      type: "delivery" as const,
      sofaCount: 1,
      pickupCount: 0,
      scheduledDay: dateKey,
      timeWindow: "13:00-16:00",
      floor: "First",
      duration: 25,
      notes: "",
      status: "scheduled" as const,
      createdAt: new Date(),
      updatedAt: new Date(),
    },
  ];

  const validatedJobs = validateRouteInputs(testJobs as any, seedState.settings);

  it("should include helper pickup when includeHelper is true", () => {
    const route = buildRoutePlan(
      validatedJobs,
      seedState.helpers,
      seedState.settings,
      dateKey,
      undefined,
      { includeHelper: true, returnToUnit: true }
    );

    const helperPickup = route.stops.find((stop) => stop.kind === "helper");
    expect(helperPickup).toBeDefined();
    expect(helperPickup?.label).toMatch(/Mia|Ross/);
  });

  it("should exclude helper pickup when includeHelper is false", () => {
    const route = buildRoutePlan(
      validatedJobs,
      seedState.helpers,
      seedState.settings,
      dateKey,
      undefined,
      { includeHelper: false, returnToUnit: true }
    );

    const helperPickup = route.stops.find((stop) => stop.kind === "helper");
    expect(helperPickup).toBeUndefined();
  });

  it("should include helper drop-off when includeHelper is true", () => {
    const route = buildRoutePlan(
      validatedJobs,
      seedState.helpers,
      seedState.settings,
      dateKey,
      undefined,
      { includeHelper: true, returnToUnit: true }
    );

    const helperDropoff = route.stops.find((stop) => stop.kind === "helper-dropoff");
    expect(helperDropoff).toBeDefined();
  });

  it("should exclude helper drop-off when includeHelper is false", () => {
    const route = buildRoutePlan(
      validatedJobs,
      seedState.helpers,
      seedState.settings,
      dateKey,
      undefined,
      { includeHelper: false, returnToUnit: true }
    );

    const helperDropoff = route.stops.find((stop) => stop.kind === "helper-dropoff");
    expect(helperDropoff).toBeUndefined();
  });

  it("should include end-of-day unit return when returnToUnit is true", () => {
    const route = buildRoutePlan(
      validatedJobs,
      seedState.helpers,
      seedState.settings,
      dateKey,
      undefined,
      { includeHelper: true, returnToUnit: true }
    );

    const unitReturns = route.stops.filter((stop) => stop.kind === "unit");
    expect(unitReturns.length).toBeGreaterThan(0);
  });

  it("should exclude end-of-day unit return when returnToUnit is false", () => {
    const route = buildRoutePlan(
      validatedJobs,
      seedState.helpers,
      seedState.settings,
      dateKey,
      undefined,
      { includeHelper: true, returnToUnit: false }
    );

    // Should have no unit returns at the end (though may have intermediate ones)
    const finalStop = route.stops[route.stops.length - 1];
    expect(finalStop?.kind).not.toBe("unit");
  });

  it("should have fewer stops when both toggles are false", () => {
    const routeWithToggles = buildRoutePlan(
      validatedJobs,
      seedState.helpers,
      seedState.settings,
      dateKey,
      undefined,
      { includeHelper: true, returnToUnit: true }
    );

    const routeWithoutToggles = buildRoutePlan(
      validatedJobs,
      seedState.helpers,
      seedState.settings,
      dateKey,
      undefined,
      { includeHelper: false, returnToUnit: false }
    );

    expect(routeWithoutToggles.stops.length).toBeLessThan(routeWithToggles.stops.length);
  });

  it("should default to true when options are not provided", () => {
    const routeWithDefaults = buildRoutePlan(
      validatedJobs,
      seedState.helpers,
      seedState.settings,
      dateKey,
      undefined
    );

    const routeWithExplicitTrue = buildRoutePlan(
      validatedJobs,
      seedState.helpers,
      seedState.settings,
      dateKey,
      undefined,
      { includeHelper: true, returnToUnit: true }
    );

    // Both should have the same number of stops
    expect(routeWithDefaults.stops.length).toBe(routeWithExplicitTrue.stops.length);
  });

  it("should still process jobs correctly regardless of helper toggle", () => {
    const routeWithHelper = buildRoutePlan(
      validatedJobs,
      seedState.helpers,
      seedState.settings,
      dateKey,
      undefined,
      { includeHelper: true, returnToUnit: true }
    );

    const routeWithoutHelper = buildRoutePlan(
      validatedJobs,
      seedState.helpers,
      seedState.settings,
      dateKey,
      undefined,
      { includeHelper: false, returnToUnit: true }
    );

    // Both should have the same number of job stops
    const jobStopsWithHelper = routeWithHelper.stops.filter((stop) => stop.kind === "job");
    const jobStopsWithoutHelper = routeWithoutHelper.stops.filter((stop) => stop.kind === "job");

    expect(jobStopsWithHelper.length).toBe(jobStopsWithoutHelper.length);
    expect(jobStopsWithHelper.length).toBe(validatedJobs.length);
  });
});
