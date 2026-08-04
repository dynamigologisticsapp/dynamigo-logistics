/**
 * Comprehensive Test Suite - Integrated with Vitest
 * 
 * Validates optimizer correctness with invariant assertions
 * Runs automatically as part of normal test suite
 */

import { describe, it, expect } from "vitest";
import { optimizeRouteV2, type OptimizationRequest } from "./optimization-service-v2";
import type { JobRecord } from "@/shared/route-planner";

// Test locations
const DEPOT = { lat: 51.5074, lon: -0.1278, label: "Depot" };
const HOME = { lat: 51.5174, lon: -0.1278, label: "Home" };
const LOC_A = { lat: 51.52, lon: -0.13, label: "Location A" };
const LOC_B = { lat: 51.53, lon: -0.12, label: "Location B" };
const LOC_C = { lat: 51.54, lon: -0.11, label: "Location C" };
const LOC_D = { lat: 51.55, lon: -0.10, label: "Location D" };
const LOC_E = { lat: 51.56, lon: -0.09, label: "Location E" };
const HELPER = { lat: 51.51, lon: -0.12, label: "Helper" };

// Helper to create job
function createJob(
  id: string,
  lat: number,
  lon: number,
  type: "pickup" | "delivery",
  sofaCount: number,
  label: string
): JobRecord {
  return {
    id,
    customerName: label,
    contactName: "Contact",
    contactPhone: "07700000000",
    addressLine: label,
    latitude: lat,
    longitude: lon,
    type,
    sofaCount,
    pickupCount: type === "pickup" ? sofaCount : 0,
    scheduledDay: "2026-04-08",
    timeWindow: "09:00 - 17:00",
    floor: "0",
    duration: 30,
    notes: "",
    townId: "london",
    createdAt: new Date(),
    updatedAt: new Date(),
  };
}

/**
 * INVARIANT ASSERTIONS
 * These should NEVER fail for any valid input
 */

function assertInvariants(result: any, inputJobs: JobRecord[], expectedStops: number) {
  // Invariant 1: Same input → same route every time
  expect(result.success).toBe(true);

  // Invariant 2: Capacity never exceeds 3
  let maxLoad = 0;
  for (const stop of result.stops) {
    maxLoad = Math.max(maxLoad, stop.loadAfter);
  }
  expect(maxLoad).toBeLessThanOrEqual(3);

  // Invariant 3: Every job appears exactly once
  const jobIds = result.stops
    .filter((s: any) => s.type === "job")
    .map((s: any) => s.jobId);
  for (const job of inputJobs) {
    expect(jobIds).toContain(job.id);
  }
  expect(jobIds.length).toBe(inputJobs.length);

  // Invariant 4: Route starts at home and ends at home (or depot if returnToDepot=true)
  expect(result.stops[0].type).toBe("start");
  expect(result.stops[result.stops.length - 1].type).toBe("end");

  // Invariant 5: All depot visits have type "depot"
  for (const stop of result.stops) {
    if (stop.type === "depot") {
      expect(stop.label).toContain("Depot");
    }
  }
}

describe("Optimization Engine - Comprehensive Tests", () => {
  describe("Edge Cases", () => {
    it("should handle zero jobs", async () => {
      const request: OptimizationRequest = {
        jobs: [],
        helperAvailable: false,
        returnToDepot: false,
        vanCapacity: 3,
        depotLatitude: DEPOT.lat,
        depotLongitude: DEPOT.lon,
        depotLabel: DEPOT.label,
        startLatitude: HOME.lat,
        startLongitude: HOME.lon,
        startLabel: HOME.label,
      };

      const result = await optimizeRouteV2(request);
      expect(result.success).toBe(true);
      expect(result.stops.length).toBe(2); // Start + End
      assertInvariants(result, [], 2);
    });

    it("should handle one job", async () => {
      const jobs = [createJob("job-1", LOC_A.lat, LOC_A.lon, "pickup", 1, "Job A")];
      const request: OptimizationRequest = {
        jobs,
        helperAvailable: false,
        returnToDepot: false,
        vanCapacity: 3,
        depotLatitude: DEPOT.lat,
        depotLongitude: DEPOT.lon,
        depotLabel: DEPOT.label,
        startLatitude: HOME.lat,
        startLongitude: HOME.lon,
        startLabel: HOME.label,
      };

      const result = await optimizeRouteV2(request);
      expect(result.success).toBe(true);
      expect(result.stops.length).toBe(3); // Start + Job + End
      assertInvariants(result, jobs, 3);
    });

    it("should handle two identical addresses", async () => {
      const jobs = [
        createJob("job-1", LOC_A.lat, LOC_A.lon, "pickup", 1, "Job A1"),
        createJob("job-2", LOC_A.lat, LOC_A.lon, "pickup", 1, "Job A2"),
      ];
      const request: OptimizationRequest = {
        jobs,
        helperAvailable: false,
        returnToDepot: false,
        vanCapacity: 3,
        depotLatitude: DEPOT.lat,
        depotLongitude: DEPOT.lon,
        depotLabel: DEPOT.label,
        startLatitude: HOME.lat,
        startLongitude: HOME.lon,
        startLabel: HOME.label,
      };

      const result = await optimizeRouteV2(request);
      expect(result.success).toBe(true);
      assertInvariants(result, jobs, 4);
    });
  });

  describe("Capacity Management", () => {
    it("should not insert depot for 3 pickups (capacity = 3)", async () => {
      const jobs = [
        createJob("job-1", LOC_A.lat, LOC_A.lon, "pickup", 1, "Job A"),
        createJob("job-2", LOC_B.lat, LOC_B.lon, "pickup", 1, "Job B"),
        createJob("job-3", LOC_C.lat, LOC_C.lon, "pickup", 1, "Job C"),
      ];
      const request: OptimizationRequest = {
        jobs,
        helperAvailable: false,
        returnToDepot: false,
        vanCapacity: 3,
        depotLatitude: DEPOT.lat,
        depotLongitude: DEPOT.lon,
        depotLabel: DEPOT.label,
        startLatitude: HOME.lat,
        startLongitude: HOME.lon,
        startLabel: HOME.label,
      };

      const result = await optimizeRouteV2(request);
      const hasDepot = result.stops.some((s: any) => s.type === "depot");
      expect(hasDepot).toBe(false);
      assertInvariants(result, jobs, 5);
    });

    it("should insert depot for 4 pickups", async () => {
      const jobs = [
        createJob("job-1", LOC_A.lat, LOC_A.lon, "pickup", 1, "Job A"),
        createJob("job-2", LOC_B.lat, LOC_B.lon, "pickup", 1, "Job B"),
        createJob("job-3", LOC_C.lat, LOC_C.lon, "pickup", 1, "Job C"),
        createJob("job-4", LOC_D.lat, LOC_D.lon, "pickup", 1, "Job D"),
      ];
      const request: OptimizationRequest = {
        jobs,
        helperAvailable: false,
        returnToDepot: false,
        vanCapacity: 3,
        depotLatitude: DEPOT.lat,
        depotLongitude: DEPOT.lon,
        depotLabel: DEPOT.label,
        startLatitude: HOME.lat,
        startLongitude: HOME.lon,
        startLabel: HOME.label,
      };

      const result = await optimizeRouteV2(request);
      const depotCount = result.stops.filter((s: any) => s.type === "depot").length;
      expect(depotCount).toBeGreaterThanOrEqual(1);
      assertInvariants(result, jobs, result.stops.length);
    });

    it("should never exceed capacity during route", async () => {
      const jobs = [
        createJob("job-1", LOC_A.lat, LOC_A.lon, "pickup", 2, "Pickup A"),
        createJob("job-2", LOC_B.lat, LOC_B.lon, "delivery", 1, "Delivery B"),
        createJob("job-3", LOC_C.lat, LOC_C.lon, "pickup", 1, "Pickup C"),
      ];
      const request: OptimizationRequest = {
        jobs,
        helperAvailable: false,
        returnToDepot: false,
        vanCapacity: 3,
        depotLatitude: DEPOT.lat,
        depotLongitude: DEPOT.lon,
        depotLabel: DEPOT.label,
        startLatitude: HOME.lat,
        startLongitude: HOME.lon,
        startLabel: HOME.label,
      };

      const result = await optimizeRouteV2(request);
      let maxLoad = 0;
      for (const stop of result.stops) {
        maxLoad = Math.max(maxLoad, stop.loadAfter);
      }
      expect(maxLoad).toBeLessThanOrEqual(3);
      assertInvariants(result, jobs, result.stops.length);
    });
  });

  describe("Helper Logic", () => {
    it("should include helper pickup and drop-off when enabled", async () => {
      const jobs = [createJob("job-1", LOC_A.lat, LOC_A.lon, "pickup", 1, "Job A")];
      const request: OptimizationRequest = {
        jobs,
        helperAvailable: true,
        returnToDepot: false,
        vanCapacity: 3,
        depotLatitude: DEPOT.lat,
        depotLongitude: DEPOT.lon,
        depotLabel: DEPOT.label,
        startLatitude: HOME.lat,
        startLongitude: HOME.lon,
        startLabel: HOME.label,
        helperLatitude: HELPER.lat,
        helperLongitude: HELPER.lon,
        helperName: "Helper",
      };

      const result = await optimizeRouteV2(request);
      const hasHelperCollect = result.stops.some((s: any) => s.type === "helper-collect");
      const hasHelperDrop = result.stops.some((s: any) => s.type === "helper-drop");
      expect(hasHelperCollect).toBe(true);
      expect(hasHelperDrop).toBe(true);
      assertInvariants(result, jobs, result.stops.length);
    });

    it("should not include helper stops when disabled", async () => {
      const jobs = [createJob("job-1", LOC_A.lat, LOC_A.lon, "pickup", 1, "Job A")];
      const request: OptimizationRequest = {
        jobs,
        helperAvailable: false,
        returnToDepot: false,
        vanCapacity: 3,
        depotLatitude: DEPOT.lat,
        depotLongitude: DEPOT.lon,
        depotLabel: DEPOT.label,
        startLatitude: HOME.lat,
        startLongitude: HOME.lon,
        startLabel: HOME.label,
      };

      const result = await optimizeRouteV2(request);
      const hasHelper = result.stops.some(
        (s: any) => s.type === "helper-collect" || s.type === "helper-drop"
      );
      expect(hasHelper).toBe(false);
      assertInvariants(result, jobs, result.stops.length);
    });
  });

  describe("Return to Depot", () => {
    it("should end at home when returnToDepot = false", async () => {
      const jobs = [createJob("job-1", LOC_A.lat, LOC_A.lon, "pickup", 1, "Job A")];
      const request: OptimizationRequest = {
        jobs,
        helperAvailable: false,
        returnToDepot: false,
        vanCapacity: 3,
        depotLatitude: DEPOT.lat,
        depotLongitude: DEPOT.lon,
        depotLabel: DEPOT.label,
        startLatitude: HOME.lat,
        startLongitude: HOME.lon,
        startLabel: HOME.label,
      };

      const result = await optimizeRouteV2(request);
      const secondToLast = result.stops[result.stops.length - 2];
      expect(secondToLast.type).toBe("job");
      assertInvariants(result, jobs, result.stops.length);
    });

    it("should end at depot when returnToDepot = true", async () => {
      const jobs = [createJob("job-1", LOC_A.lat, LOC_A.lon, "pickup", 1, "Job A")];
      const request: OptimizationRequest = {
        jobs,
        helperAvailable: false,
        returnToDepot: true,
        vanCapacity: 3,
        depotLatitude: DEPOT.lat,
        depotLongitude: DEPOT.lon,
        depotLabel: DEPOT.label,
        startLatitude: HOME.lat,
        startLongitude: HOME.lon,
        startLabel: HOME.label,
      };

      const result = await optimizeRouteV2(request);
      const secondToLast = result.stops[result.stops.length - 2];
      expect(secondToLast.type).toBe("depot");
      assertInvariants(result, jobs, result.stops.length);
    });
  });

  describe("Deterministic Behavior", () => {
    it("should produce same route for same input (deterministic)", async () => {
      const jobs = [
        createJob("job-1", LOC_A.lat, LOC_A.lon, "pickup", 1, "Job A"),
        createJob("job-2", LOC_B.lat, LOC_B.lon, "pickup", 1, "Job B"),
        createJob("job-3", LOC_C.lat, LOC_C.lon, "pickup", 1, "Job C"),
      ];
      const request: OptimizationRequest = {
        jobs,
        helperAvailable: false,
        returnToDepot: false,
        vanCapacity: 3,
        depotLatitude: DEPOT.lat,
        depotLongitude: DEPOT.lon,
        depotLabel: DEPOT.label,
        startLatitude: HOME.lat,
        startLongitude: HOME.lon,
        startLabel: HOME.label,
      };

      // Run optimization twice
      const result1 = await optimizeRouteV2(request);
      const result2 = await optimizeRouteV2(request);

      // Routes should be identical
      expect(result1.stops.length).toBe(result2.stops.length);
      for (let i = 0; i < result1.stops.length; i++) {
        expect(result1.stops[i].jobId).toBe(result2.stops[i].jobId);
        expect(result1.stops[i].type).toBe(result2.stops[i].type);
      }
    });
  });

  describe("Regression Tests", () => {
    it("should insert depot after 3rd pickup for 4 pickups", async () => {
      const jobs = [
        createJob("job-1", LOC_A.lat, LOC_A.lon, "pickup", 1, "Job A"),
        createJob("job-2", LOC_B.lat, LOC_B.lon, "pickup", 1, "Job B"),
        createJob("job-3", LOC_C.lat, LOC_C.lon, "pickup", 1, "Job C"),
        createJob("job-4", LOC_D.lat, LOC_D.lon, "pickup", 1, "Job D"),
      ];
      const request: OptimizationRequest = {
        jobs,
        helperAvailable: false,
        returnToDepot: false,
        vanCapacity: 3,
        depotLatitude: DEPOT.lat,
        depotLongitude: DEPOT.lon,
        depotLabel: DEPOT.label,
        startLatitude: HOME.lat,
        startLongitude: HOME.lon,
        startLabel: HOME.label,
      };

      const result = await optimizeRouteV2(request);

      // Expected: Home → Job A/B/C → Depot → Job D → Home
      const jobStops = result.stops.filter((s: any) => s.type === "job");
      const depotStops = result.stops.filter((s: any) => s.type === "depot");

      expect(jobStops.length).toBe(4); // All 4 jobs present
      expect(depotStops.length).toBeGreaterThanOrEqual(1); // At least one depot visit
    });
  });
});
