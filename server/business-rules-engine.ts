/**
 * Business Rules Engine
 * 
 * Determines which jobs are feasible based on business constraints:
 * - Helper availability
 * - Vehicle capacity
 * - Time windows
 * - Delivery/pickup constraints
 */

import { getDeliveryLoad, getJobLoadDelta, getPickupLoad, type JobRecord } from "@/shared/route-planner";

export interface FeasibilityResult {
  feasible: boolean;
  reason?: string;
}

export interface JobFeasibility {
  jobId: string;
  feasible: boolean;
  reason?: string;
}

/**
 * Check if a job is feasible given current constraints
 */
export function checkJobFeasibility(
  job: JobRecord,
  options: {
    helperAvailable: boolean;
    currentLoad: number;
    vanCapacity: number;
    currentTime: string; // HH:MM format
  }
): FeasibilityResult {
  // Check 1: Helper requirement
  if (job.type === "pickup" || job.type === "both") {
    // Pickups don't require helper by default
    // (You could add a "requiresHelper" field to JobRecord if needed)
  }

  // Check 2: Capacity constraint
  if (job.type === "pickup" || job.type === "both") {
    const projectedLoad = options.currentLoad + getPickupLoad(job);
    if (projectedLoad > options.vanCapacity) {
      return {
        feasible: false,
        reason: `Pickup would exceed capacity (${projectedLoad} > ${options.vanCapacity})`,
      };
    }
  }

  // Check 3: Delivery constraint - must have sofas in van
  if (job.type === "delivery" || job.type === "both") {
    if (options.currentLoad < job.sofaCount) {
      return {
        feasible: false,
        reason: `Not enough sofas in van for delivery (${options.currentLoad} < ${job.sofaCount})`,
      };
    }
  }

  // Check 4: Time window constraint
  if (job.timeWindow && job.timeWindow !== "Flexible") {
    const [startStr, endStr] = job.timeWindow.split(" - ");
    const [startHour, startMin] = startStr.split(":").map(Number);
    const [endHour, endMin] = endStr.split(":").map(Number);
    const [currentHour, currentMin] = options.currentTime.split(":").map(Number);

    const currentMinutes = currentHour * 60 + currentMin;
    const startMinutes = startHour * 60 + startMin;
    const endMinutes = endHour * 60 + endMin;

    if (currentMinutes > endMinutes) {
      return {
        feasible: false,
        reason: `Time window has passed (${options.currentTime} > ${endStr})`,
      };
    }

    if (currentMinutes < startMinutes) {
      // Can still visit, but note it
    }
  }

  return { feasible: true };
}

/**
 * Filter jobs to only feasible ones
 */
export function filterFeasibleJobs(
  jobs: JobRecord[],
  options: {
    helperAvailable: boolean;
    currentLoad: number;
    vanCapacity: number;
    currentTime: string;
  }
): { feasible: JobRecord[]; unfeasible: JobFeasibility[] } {
  const feasible: JobRecord[] = [];
  const unfeasible: JobFeasibility[] = [];

  for (const job of jobs) {
    const result = checkJobFeasibility(job, options);
    if (result.feasible) {
      feasible.push(job);
    } else {
      unfeasible.push({
        jobId: job.id,
        feasible: false,
        reason: result.reason,
      });
    }
  }

  return { feasible, unfeasible };
}

/**
 * Validate that a job can be delivered given current van state
 */
export function canDeliver(
  job: JobRecord,
  currentLoad: number,
  vanCapacity: number
): boolean {
  // Delivery requires sofas in van
  if ((job.type === "delivery" || job.type === "both") && currentLoad < job.sofaCount) {
    return false;
  }

  // Pickup requires space in van
  if ((job.type === "pickup" || job.type === "both") && currentLoad - getDeliveryLoad(job) + getPickupLoad(job) > vanCapacity) {
    return false;
  }

  return true;
}

/**
 * Calculate load change after a job
 */
export function calculateLoadChange(job: JobRecord): number {
  return getJobLoadDelta(job);
}

/**
 * Simulate load after applying a job
 */
export function simulateLoad(
  currentLoad: number,
  job: JobRecord,
  vanCapacity: number
): { newLoad: number; exceedsCapacity: boolean } {
  const change = calculateLoadChange(job);
  const newLoad = currentLoad + change;

  return {
    newLoad: Math.max(0, newLoad),
    exceedsCapacity: newLoad > vanCapacity,
  };
}
