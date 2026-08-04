/**
 * Comprehensive Test Scenarios
 * 
 * Validates business logic before integrating Google Distance Matrix
 */

import { optimizeRouteV2, type OptimizationRequest } from "./optimization-service-v2";
import { HaversineDistanceProvider } from "./distance-provider";
import type { JobRecord } from "@/shared/route-planner";

// Test locations (real coordinates)
const DEPOT = { lat: 51.5074, lon: -0.1278, label: "Depot" }; // London
const HOME = { lat: 51.5174, lon: -0.1278, label: "Home" }; // Near depot
const JOB_A = { lat: 51.52, lon: -0.13, label: "Job A" };
const JOB_B = { lat: 51.53, lon: -0.12, label: "Job B" };
const JOB_C = { lat: 51.54, lon: -0.11, label: "Job C" };
const JOB_D = { lat: 51.55, lon: -0.10, label: "Job D" };
const HELPER = { lat: 51.51, lon: -0.12, label: "Helper" };

/**
 * Test 1: Single pickup → no depot return
 */
export async function test1SinglePickup(): Promise<boolean> {
  const jobs: JobRecord[] = [
    {
      id: "job-1",
      customerName: "Customer A",
      contactName: "John",
      contactPhone: "07700000001",
      addressLine: "123 Main St",
      latitude: JOB_A.lat,
      longitude: JOB_A.lon,
      type: "pickup",
      sofaCount: 1,
      pickupCount: 0,
      scheduledDay: "2026-07-02",
      timeWindow: "09:00 - 17:00",
      floor: "",
      duration: 30,
      notes: "",
      townId: "london",
      status: "scheduled",
      createdAt: new Date(),
      updatedAt: new Date(),
    },
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
  
  // Should have: Start → Job → End (no depot)
  const hasDepot = result.stops.some((s) => s.type === "depot");
  return result.success && !hasDepot && result.stats.totalStops === 3;
}

/**
 * Test 2: 3 pickups (capacity = 3) → no depot return
 */
export async function test2ThreePickupsNoDepot(): Promise<boolean> {
  const jobs: JobRecord[] = [
    {
      id: "job-1",
      customerName: "Customer A",
      contactName: "John",
      contactPhone: "07700000001",
      addressLine: "123 Main St",
      latitude: JOB_A.lat,
      longitude: JOB_A.lon,
      type: "pickup",
      sofaCount: 1,
      pickupCount: 0,
      scheduledDay: "2026-07-02",
      timeWindow: "09:00 - 17:00",
      floor: "",
      duration: 30,
      notes: "",
      townId: "london",
      status: "scheduled",
      createdAt: new Date(),
      updatedAt: new Date(),
    },
    {
      id: "job-2",
      customerName: "Customer B",
      contactName: "Jane",
      contactPhone: "07700000002",
      addressLine: "456 High St",
      latitude: JOB_B.lat,
      longitude: JOB_B.lon,
      type: "pickup",
      sofaCount: 1,
      pickupCount: 0,
      scheduledDay: "2026-07-02",
      timeWindow: "09:00 - 17:00",
      floor: "",
      duration: 30,
      notes: "",
      townId: "london",
      status: "scheduled",
      createdAt: new Date(),
      updatedAt: new Date(),
    },
    {
      id: "job-3",
      customerName: "Customer C",
      contactName: "Bob",
      contactPhone: "07700000003",
      addressLine: "789 Park Ave",
      latitude: JOB_C.lat,
      longitude: JOB_C.lon,
      type: "pickup",
      sofaCount: 1,
      pickupCount: 0,
      scheduledDay: "2026-07-02",
      timeWindow: "09:00 - 17:00",
      floor: "",
      duration: 30,
      notes: "",
      townId: "london",
      status: "scheduled",
      createdAt: new Date(),
      updatedAt: new Date(),
    },
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
  
  // Should have: Start → 3 Jobs → End (no depot)
  const hasDepot = result.stops.some((s) => s.type === "depot");
  return result.success && !hasDepot && result.stats.totalStops === 5;
}

/**
 * Test 3: 4 pickups → depot inserted after 3rd
 */
export async function test3FourPickupsWithDepot(): Promise<boolean> {
  const jobs: JobRecord[] = [
    {
      id: "job-1",
      customerName: "Customer A",
      contactName: "John",
      contactPhone: "07700000001",
      addressLine: "123 Main St",
      latitude: JOB_A.lat,
      longitude: JOB_A.lon,
      type: "pickup",
      sofaCount: 1,
      pickupCount: 0,
      scheduledDay: "2026-07-02",
      timeWindow: "09:00 - 17:00",
      floor: "",
      duration: 30,
      notes: "",
      townId: "london",
      status: "scheduled",
      createdAt: new Date(),
      updatedAt: new Date(),
    },
    {
      id: "job-2",
      customerName: "Customer B",
      contactName: "Jane",
      contactPhone: "07700000002",
      addressLine: "456 High St",
      latitude: JOB_B.lat,
      longitude: JOB_B.lon,
      type: "pickup",
      sofaCount: 1,
      pickupCount: 0,
      scheduledDay: "2026-07-02",
      timeWindow: "09:00 - 17:00",
      floor: "",
      duration: 30,
      notes: "",
      townId: "london",
      status: "scheduled",
      createdAt: new Date(),
      updatedAt: new Date(),
    },
    {
      id: "job-3",
      customerName: "Customer C",
      contactName: "Bob",
      contactPhone: "07700000003",
      addressLine: "789 Park Ave",
      latitude: JOB_C.lat,
      longitude: JOB_C.lon,
      type: "pickup",
      sofaCount: 1,
      pickupCount: 0,
      scheduledDay: "2026-07-02",
      timeWindow: "09:00 - 17:00",
      floor: "",
      duration: 30,
      notes: "",
      townId: "london",
      status: "scheduled",
      createdAt: new Date(),
      updatedAt: new Date(),
    },
    {
      id: "job-4",
      customerName: "Customer D",
      contactName: "Alice",
      contactPhone: "07700000004",
      addressLine: "321 Oak Rd",
      latitude: JOB_D.lat,
      longitude: JOB_D.lon,
      type: "pickup",
      sofaCount: 1,
      pickupCount: 0,
      scheduledDay: "2026-07-02",
      timeWindow: "09:00 - 17:00",
      floor: "",
      duration: 30,
      notes: "",
      townId: "london",
      status: "scheduled",
      createdAt: new Date(),
      updatedAt: new Date(),
    },
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
  
  // Should have: Start → 3 Jobs → Depot → Job 4 → End
  const depotCount = result.stops.filter((s) => s.type === "depot").length;
  return result.success && depotCount >= 1 && result.stats.totalStops === 7;
}

/**
 * Test 4: Helper enabled → pickup/drop-off added
 */
export async function test4HelperEnabled(): Promise<boolean> {
  const jobs: JobRecord[] = [
    {
      id: "job-1",
      customerName: "Customer A",
      contactName: "John",
      contactPhone: "07700000001",
      addressLine: "123 Main St",
      latitude: JOB_A.lat,
      longitude: JOB_A.lon,
      type: "pickup",
      sofaCount: 1,
      pickupCount: 0,
      scheduledDay: "2026-07-02",
      timeWindow: "09:00 - 17:00",
      floor: "",
      duration: 30,
      notes: "",
      townId: "london",
      status: "scheduled",
      createdAt: new Date(),
      updatedAt: new Date(),
    },
  ];

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
  
  // Should have helper collect and drop-off
  const helperCollect = result.stops.some((s) => s.type === "helper-collect");
  const helperDrop = result.stops.some((s) => s.type === "helper-drop");
  return result.success && helperCollect && helperDrop;
}

/**
 * Test 5: Return to depot = true → ends at depot
 */
export async function test5ReturnToDepot(): Promise<boolean> {
  const jobs: JobRecord[] = [
    {
      id: "job-1",
      customerName: "Customer A",
      contactName: "John",
      contactPhone: "07700000001",
      addressLine: "123 Main St",
      latitude: JOB_A.lat,
      longitude: JOB_A.lon,
      type: "pickup",
      sofaCount: 1,
      pickupCount: 0,
      scheduledDay: "2026-07-02",
      timeWindow: "09:00 - 17:00",
      floor: "",
      duration: 30,
      notes: "",
      townId: "london",
      status: "scheduled",
      createdAt: new Date(),
      updatedAt: new Date(),
    },
  ];

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
  
  // Last stop before end should be depot
  const secondToLast = result.stops[result.stops.length - 2];
  return result.success && secondToLast?.type === "depot";
}

/**
 * Run all tests
 */
export async function runAllTests(): Promise<{
  passed: number;
  failed: number;
  results: { name: string; passed: boolean }[];
}> {
  const tests = [
    { name: "Test 1: Single pickup → no depot", fn: test1SinglePickup },
    { name: "Test 2: 3 pickups (capacity=3) → no depot", fn: test2ThreePickupsNoDepot },
    { name: "Test 3: 4 pickups → depot inserted", fn: test3FourPickupsWithDepot },
    { name: "Test 4: Helper enabled", fn: test4HelperEnabled },
    { name: "Test 5: Return to depot", fn: test5ReturnToDepot },
  ];

  const results = [];
  let passed = 0;
  let failed = 0;

  for (const test of tests) {
    try {
      const testPassed = await test.fn();
      if (testPassed) {
        passed++;
      } else {
        failed++;
      }
      results.push({ name: test.name, passed: testPassed });
    } catch (error) {
      failed++;
      results.push({
        name: test.name,
        passed: false,
      });
    }
  }

  return { passed, failed, results };
}
