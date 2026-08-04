/**
 * Depot Decision Engine
 * 
 * Determines whether returning to depot is beneficial based on:
 * - Vehicle capacity
 * - Remaining jobs
 * - Load status
 */

import type { JobRecord } from "@/shared/route-planner";
import { calculateLoadChange } from "./business-rules-engine";

export interface DepotDecision {
  shouldReturn: boolean;
  reason: string;
}

/**
 * Decide if van should return to depot
 */
export function shouldReturnToDepot(
  currentLoad: number,
  remainingJobs: JobRecord[],
  vanCapacity: number,
  userPreference: boolean
): DepotDecision {
  // If user disabled "return to depot", don't return
  if (!userPreference) {
    return {
      shouldReturn: false,
      reason: "User disabled 'return to depot' option",
    };
  }

  // If van is empty, no need to return
  if (currentLoad === 0) {
    return {
      shouldReturn: false,
      reason: "Van is empty",
    };
  }

  // If no remaining jobs, should return to unload
  if (remainingJobs.length === 0) {
    return {
      shouldReturn: true,
      reason: "No remaining jobs, should unload",
    };
  }

  // Check if remaining jobs need more sofas than currently in van
  const remainingDeliveries = remainingJobs.filter(
    (j) => j.type === "delivery" || j.type === "both"
  );
  const totalDeliveriesNeeded = remainingDeliveries.reduce(
    (sum, j) => sum + j.sofaCount,
    0
  );

  if (totalDeliveriesNeeded > currentLoad) {
    return {
      shouldReturn: true,
      reason: `More deliveries needed (${totalDeliveriesNeeded}) than in van (${currentLoad})`,
    };
  }

  // Check if we can fit all remaining pickups without returning
  const remainingPickups = remainingJobs.filter(
    (j) => j.type === "pickup" || j.type === "both"
  );
  const totalPickupsNeeded = remainingPickups.reduce(
    (sum, j) => sum + j.sofaCount,
    0
  );
  const availableCapacity = vanCapacity - currentLoad;

  if (totalPickupsNeeded > availableCapacity) {
    return {
      shouldReturn: true,
      reason: `Not enough capacity for remaining pickups (need ${totalPickupsNeeded}, have ${availableCapacity})`,
    };
  }

  return {
    shouldReturn: false,
    reason: "Can complete remaining jobs without returning",
  };
}

/**
 * Estimate if returning to depot would be more efficient
 */
export function isDepotReturnBeneficial(
  currentLoad: number,
  remainingJobs: JobRecord[],
  vanCapacity: number
): boolean {
  // Vehicle full - should return
  if (currentLoad >= vanCapacity) {
    return true;
  }

  // More deliveries needed than in van - should return
  const deliveriesNeeded = remainingJobs
    .filter((j) => j.type === "delivery" || j.type === "both")
    .reduce((sum, j) => sum + j.sofaCount, 0);

  if (deliveriesNeeded > currentLoad) {
    return true;
  }

  // Not enough capacity for remaining pickups - should return
  const pickupsNeeded = remainingJobs
    .filter((j) => j.type === "pickup" || j.type === "both")
    .reduce((sum, j) => sum + j.sofaCount, 0);

  const availableCapacity = vanCapacity - currentLoad;
  if (pickupsNeeded > availableCapacity) {
    return true;
  }

  return false;
}

/**
 * Get recommendation for user
 */
export function getDepotReturnRecommendation(
  currentLoad: number,
  remainingJobs: JobRecord[],
  vanCapacity: number
): string {
  if (isDepotReturnBeneficial(currentLoad, remainingJobs, vanCapacity)) {
    return "Returning to depot would be more efficient for today's route";
  }

  return "Can complete remaining jobs without returning to depot";
}
