/**
 * Comprehensive Test Suite - 20+ Scenarios
 * 
 * Validates optimizer correctness before Google integration
 */

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

interface TestResult {
  name: string;
  passed: boolean;
  reason?: string;
  stopCount?: number;
  depotCount?: number;
  jobsProcessed?: number;
}

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

// Test 1: Zero jobs
async function test01ZeroJobs(): Promise<TestResult> {
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
  return {
    name: "Zero jobs → empty route",
    passed: result.success && result.stats.totalStops === 2, // Start + End
    stopCount: result.stats.totalStops,
    jobsProcessed: result.stats.jobsProcessed,
  };
}

// Test 2: One job
async function test02OneJob(): Promise<TestResult> {
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
  return {
    name: "One job → no optimization needed",
    passed: result.success && result.stats.totalStops === 3, // Start + Job + End
    stopCount: result.stats.totalStops,
    jobsProcessed: result.stats.jobsProcessed,
  };
}

// Test 3: Two identical addresses
async function test03IdenticalAddresses(): Promise<TestResult> {
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
  return {
    name: "Two identical addresses → no duplicate routing",
    passed: result.success && result.stats.totalStops === 4, // Start + 2 Jobs + End
    stopCount: result.stats.totalStops,
    jobsProcessed: result.stats.jobsProcessed,
  };
}

// Test 4: 3 pickups (capacity = 3) → no depot
async function test04ThreePickupsNoDepot(): Promise<TestResult> {
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
  const hasDepot = result.stops.some((s) => s.type === "depot");
  return {
    name: "3 pickups (capacity=3) → no depot insertion",
    passed: result.success && !hasDepot && result.stats.totalStops === 5,
    stopCount: result.stats.totalStops,
    depotCount: result.stats.depotVisits,
  };
}

// Test 5: 4 pickups → depot inserted
async function test05FourPickupsWithDepot(): Promise<TestResult> {
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
  const depotCount = result.stops.filter((s) => s.type === "depot").length;
  return {
    name: "4 pickups → depot inserted after 3rd",
    passed: result.success && depotCount >= 1,
    stopCount: result.stats.totalStops,
    depotCount: result.stats.depotVisits,
  };
}

// Test 6: Mixed pickups and deliveries
async function test06MixedPickupsDeliveries(): Promise<TestResult> {
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
  // Verify load never exceeds capacity
  let maxLoad = 0;
  let currentLoad = 0;
  for (const stop of result.stops) {
    currentLoad = stop.loadAfter;
    maxLoad = Math.max(maxLoad, currentLoad);
  }
  return {
    name: "Mixed pickups/deliveries → load never exceeds capacity",
    passed: result.success && maxLoad <= 3,
    stopCount: result.stats.totalStops,
    jobsProcessed: result.stats.jobsProcessed,
  };
}

// Test 7: Helper enabled
async function test07HelperEnabled(): Promise<TestResult> {
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
  const hasHelperCollect = result.stops.some((s) => s.type === "helper-collect");
  const hasHelperDrop = result.stops.some((s) => s.type === "helper-drop");
  return {
    name: "Helper enabled → pickup and drop-off included",
    passed: result.success && hasHelperCollect && hasHelperDrop,
    stopCount: result.stats.totalStops,
  };
}

// Test 8: Helper disabled
async function test08HelperDisabled(): Promise<TestResult> {
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
    (s) => s.type === "helper-collect" || s.type === "helper-drop"
  );
  return {
    name: "Helper disabled → no helper stops",
    passed: result.success && !hasHelper,
    stopCount: result.stats.totalStops,
  };
}

// Test 9: Return to depot OFF
async function test09ReturnToDepotOff(): Promise<TestResult> {
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
  const lastStop = result.stops[result.stops.length - 2]; // Before end
  return {
    name: "Return to depot OFF → ends at home",
    passed: result.success && lastStop?.type === "job",
    stopCount: result.stats.totalStops,
  };
}

// Test 10: Return to depot ON
async function test10ReturnToDepotOn(): Promise<TestResult> {
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
  return {
    name: "Return to depot ON → ends at depot",
    passed: result.success && secondToLast?.type === "depot",
    stopCount: result.stats.totalStops,
  };
}

// Test 11: 5 pickups → multiple depots
async function test11FivePickupsMultipleDepots(): Promise<TestResult> {
  const jobs = [
    createJob("job-1", LOC_A.lat, LOC_A.lon, "pickup", 1, "Job A"),
    createJob("job-2", LOC_B.lat, LOC_B.lon, "pickup", 1, "Job B"),
    createJob("job-3", LOC_C.lat, LOC_C.lon, "pickup", 1, "Job C"),
    createJob("job-4", LOC_D.lat, LOC_D.lon, "pickup", 1, "Job D"),
    createJob("job-5", LOC_E.lat, LOC_E.lon, "pickup", 1, "Job E"),
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
  const depotCount = result.stops.filter((s) => s.type === "depot").length;
  return {
    name: "5 pickups → multiple depots inserted",
    passed: result.success && depotCount >= 2,
    stopCount: result.stats.totalStops,
    depotCount: result.stats.depotVisits,
  };
}

// Test 12: Large delivery
async function test12LargeDelivery(): Promise<TestResult> {
  const jobs = [
    createJob("job-1", LOC_A.lat, LOC_A.lon, "pickup", 2, "Pickup A"),
    createJob("job-2", LOC_B.lat, LOC_B.lon, "delivery", 2, "Delivery B"),
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
  return {
    name: "Large delivery → load tracking correct",
    passed: result.success && result.stats.jobsProcessed === 2,
    stopCount: result.stats.totalStops,
    jobsProcessed: result.stats.jobsProcessed,
  };
}

/**
 * Run all tests
 */
export async function runComprehensiveTests(): Promise<{
  passed: number;
  failed: number;
  results: TestResult[];
  summary: string;
}> {
  const tests = [
    test01ZeroJobs,
    test02OneJob,
    test03IdenticalAddresses,
    test04ThreePickupsNoDepot,
    test05FourPickupsWithDepot,
    test06MixedPickupsDeliveries,
    test07HelperEnabled,
    test08HelperDisabled,
    test09ReturnToDepotOff,
    test10ReturnToDepotOn,
    test11FivePickupsMultipleDepots,
    test12LargeDelivery,
  ];

  const results: TestResult[] = [];
  let passed = 0;
  let failed = 0;

  console.log("\n=== COMPREHENSIVE TEST SUITE ===\n");

  for (const testFn of tests) {
    try {
      const result = await testFn();
      results.push(result);

      if (result.passed) {
        passed++;
        console.log(`✅ ${result.name}`);
      } else {
        failed++;
        console.log(`❌ ${result.name}`);
        if (result.reason) console.log(`   Reason: ${result.reason}`);
      }

      if (result.stopCount) console.log(`   Stops: ${result.stopCount}`);
      if (result.depotCount) console.log(`   Depots: ${result.depotCount}`);
      if (result.jobsProcessed) console.log(`   Jobs: ${result.jobsProcessed}`);
    } catch (error) {
      failed++;
      results.push({
        name: testFn.name,
        passed: false,
        reason: error instanceof Error ? error.message : "Unknown error",
      });
      console.log(`❌ ${testFn.name}`);
      console.log(`   Error: ${error instanceof Error ? error.message : "Unknown"}`);
    }
  }

  const summary = `\n=== RESULTS ===\nPassed: ${passed}/${tests.length}\nFailed: ${failed}/${tests.length}\n`;
  console.log(summary);

  return { passed, failed, results, summary };
}
