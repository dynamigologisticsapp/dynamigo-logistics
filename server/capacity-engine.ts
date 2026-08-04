/**
 * Vehicle Capacity Engine
 * 
 * Tracks van load throughout the day and automatically inserts depot stops
 * when capacity is exceeded.
 */

import type { JobRecord } from "@/shared/route-planner";
import { calculateLoadChange } from "./business-rules-engine";

export interface Stop {
  id: string;
  type: "start" | "job" | "depot" | "helper-collect" | "helper-drop" | "end";
  label: string;
  latitude?: string | number | null;
  longitude?: string | number | null;
  loadBefore: number;
  loadAfter: number;
  jobId?: string;
  sofaChange: number;
}

/**
 * Build a stop list with automatic depot insertion when capacity exceeded
 */
export function buildStopsWithCapacityTracking(
  jobs: JobRecord[],
  options: {
    vanCapacity: number;
    depotLatitude: string | number;
    depotLongitude: string | number;
    depotLabel: string;
    startLatitude: string | number;
    startLongitude: string | number;
    startLabel: string;
  }
): Stop[] {
  const stops: Stop[] = [];
  let currentLoad = 0;
  let stopCounter = 0;

  // Start stop
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

  // Process each job
  for (const job of jobs) {
    const loadChange = calculateLoadChange(job);
    const projectedLoad = currentLoad + loadChange;

    // Check if we need to insert a depot stop
    if (projectedLoad > options.vanCapacity && currentLoad > 0) {
      // Insert depot stop to unload
      stops.push({
        id: `stop-${stopCounter++}`,
        type: "depot",
        label: options.depotLabel,
        latitude: options.depotLatitude,
        longitude: options.depotLongitude,
        loadBefore: currentLoad,
        loadAfter: 0,
        sofaChange: -currentLoad, // Unload all
      });
      currentLoad = 0;
    }

    // Add the job stop
    const newLoad = currentLoad + loadChange;
    stops.push({
      id: `stop-${stopCounter++}`,
      type: "job",
      label: job.customerName,
      latitude: job.latitude,
      longitude: job.longitude,
      loadBefore: currentLoad,
      loadAfter: Math.max(0, newLoad),
      jobId: job.id,
      sofaChange: loadChange,
    });

    currentLoad = Math.max(0, newLoad);
  }

  return stops;
}

/**
 * Check if a job would exceed capacity
 */
export function wouldExceedCapacity(
  currentLoad: number,
  jobLoadChange: number,
  vanCapacity: number
): boolean {
  return currentLoad + jobLoadChange > vanCapacity;
}

/**
 * Calculate when depot visit is needed
 */
export function needsDepotVisit(
  currentLoad: number,
  jobLoadChange: number,
  vanCapacity: number
): boolean {
  const projectedLoad = currentLoad + jobLoadChange;
  return projectedLoad > vanCapacity && currentLoad > 0;
}

/**
 * Get remaining capacity
 */
export function getRemainingCapacity(
  currentLoad: number,
  vanCapacity: number
): number {
  return Math.max(0, vanCapacity - currentLoad);
}

/**
 * Check if van is full
 */
export function isVanFull(currentLoad: number, vanCapacity: number): boolean {
  return currentLoad >= vanCapacity;
}

/**
 * Check if van is empty
 */
export function isVanEmpty(currentLoad: number): boolean {
  return currentLoad === 0;
}
