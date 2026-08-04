/**
 * Route Builder
 * 
 * Generates a complete list of stops BEFORE calling the routing API.
 * This is where all business logic decisions are made.
 */

import type { JobRecord } from "@/shared/route-planner";
import {
  buildStopsWithCapacityTracking,
  type Stop,
} from "./capacity-engine";
import { shouldReturnToDepot } from "./depot-decision-engine";

export interface RouteBuilderOptions {
  jobs: JobRecord[];
  helperAvailable: boolean;
  returnToDepot: boolean;
  vanCapacity: number;
  depotLatitude: string | number;
  depotLongitude: string | number;
  depotLabel: string;
  startLatitude: string | number;
  startLongitude: string | number;
  startLabel: string;
  helperLatitude?: string | number;
  helperLongitude?: string | number;
  helperName?: string;
}

/**
 * Build complete route with all stops
 */
export function buildRoute(options: RouteBuilderOptions): Stop[] {
  const stops: Stop[] = [];
  let stopCounter = 0;

  // 1. Start (Home/Depot)
  stops.push({
    id: `stop-${stopCounter++}`,
    type: "start",
    label: options.startLabel,
    latitude: options.startLatitude,
    longitude: options.startLongitude,
    loadBefore: 0,
    loadAfter: 0,
    sofaChange: 0,
  });

  // 2. Collect Helper (if enabled)
  if (options.helperAvailable && options.helperLatitude && options.helperLongitude) {
    stops.push({
      id: `stop-${stopCounter++}`,
      type: "helper-collect",
      label: `Collect ${options.helperName || "Helper"}`,
      latitude: options.helperLatitude,
      longitude: options.helperLongitude,
      loadBefore: 0,
      loadAfter: 0,
      sofaChange: 0,
    });
  }

  // 3. Load from Depot (if needed)
  const needsInitialLoad = options.jobs.some(
    (j) => j.type === "delivery" || j.type === "both"
  );

  if (needsInitialLoad) {
    stops.push({
      id: `stop-${stopCounter++}`,
      type: "depot",
      label: `${options.depotLabel} (Load)`,
      latitude: options.depotLatitude,
      longitude: options.depotLongitude,
      loadBefore: 0,
      loadAfter: options.vanCapacity, // Load full capacity
      sofaChange: options.vanCapacity,
    });
  }

  // 4. Complete Jobs (with automatic depot stops for capacity)
  const jobStops = buildStopsWithCapacityTracking(options.jobs, {
    vanCapacity: options.vanCapacity,
    depotLatitude: options.depotLatitude,
    depotLongitude: options.depotLongitude,
    depotLabel: options.depotLabel,
    startLatitude: options.startLatitude,
    startLongitude: options.startLongitude,
    startLabel: options.startLabel,
  });

  // Skip the first "start" stop from jobStops (we already added it)
  for (let i = 1; i < jobStops.length; i++) {
    const stop = jobStops[i];
    stop.id = `stop-${stopCounter++}`;
    stops.push(stop);
  }

  // Get current load after all jobs
  const finalLoad = jobStops.length > 0 ? jobStops[jobStops.length - 1].loadAfter : 0;

  // 5. Return to Depot (if beneficial and enabled)
  const depotDecision = shouldReturnToDepot(
    finalLoad,
    [],
    options.vanCapacity,
    options.returnToDepot
  );

  if (depotDecision.shouldReturn) {
    stops.push({
      id: `stop-${stopCounter++}`,
      type: "depot",
      label: `${options.depotLabel} (Unload)`,
      latitude: options.depotLatitude,
      longitude: options.depotLongitude,
      loadBefore: finalLoad,
      loadAfter: 0,
      sofaChange: -finalLoad,
    });
  }

  // 6. Drop Helper (if enabled)
  if (options.helperAvailable && options.helperLatitude && options.helperLongitude) {
    stops.push({
      id: `stop-${stopCounter++}`,
      type: "helper-drop",
      label: `Drop ${options.helperName || "Helper"}`,
      latitude: options.helperLatitude,
      longitude: options.helperLongitude,
      loadBefore: 0,
      loadAfter: 0,
      sofaChange: 0,
    });
  }

  // 7. Return Home
  stops.push({
    id: `stop-${stopCounter++}`,
    type: "end",
    label: `${options.startLabel} (End)`,
    latitude: options.startLatitude,
    longitude: options.startLongitude,
    loadBefore: 0,
    loadAfter: 0,
    sofaChange: 0,
  });

  return stops;
}

/**
 * Validate route stops
 */
export function validateRoute(stops: Stop[]): { valid: boolean; errors: string[] } {
  const errors: string[] = [];

  // Check that we have start and end
  if (!stops.some((s) => s.type === "start")) {
    errors.push("Route missing start stop");
  }
  if (!stops.some((s) => s.type === "end")) {
    errors.push("Route missing end stop");
  }

  // Check that load never goes negative
  for (const stop of stops) {
    if (stop.loadAfter < 0) {
      errors.push(`Stop ${stop.label} has negative load: ${stop.loadAfter}`);
    }
  }

  // Check that load doesn't exceed capacity
  for (const stop of stops) {
    if (stop.loadAfter > 3) {
      // Assuming capacity is 3
      errors.push(`Stop ${stop.label} exceeds capacity: ${stop.loadAfter}`);
    }
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}

/**
 * Get route summary
 */
export function getRouteSummary(stops: Stop[]) {
  const jobStops = stops.filter((s) => s.type === "job");
  const depotStops = stops.filter((s) => s.type === "depot");
  const helperStops = stops.filter((s) => s.type === "helper-collect" || s.type === "helper-drop");

  return {
    totalStops: stops.length,
    jobCount: jobStops.length,
    depotStops: depotStops.length,
    helperStops: helperStops.length,
    stops,
  };
}
