/**
 * Optimization Service
 * 
 * Orchestrates the complete optimization pipeline:
 * 1. Business Rules Engine (feasibility)
 * 2. Capacity Engine (load tracking)
 * 3. Depot Decision Engine (return logic)
 * 4. Route Builder (stop list generation)
 * 5. Routing API (sequence optimization)
 * 
 * CRITICAL: Only called when user presses "Recalculate Route"
 */

import type { JobRecord } from "@/shared/route-planner";
import { filterFeasibleJobs } from "./business-rules-engine";
import { buildRoute, type RouteBuilderOptions, validateRoute } from "./route-builder";

export interface OptimizationRequest {
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

export interface OptimizationResult {
  success: boolean;
  stops: any[]; // Will be filled by routing API
  feasibleJobs: JobRecord[];
  unfeasibleJobs: any[];
  warnings: string[];
  errors: string[];
}

/**
 * Execute complete optimization pipeline
 */
export async function optimizeRoute(
  request: OptimizationRequest
): Promise<OptimizationResult> {
  const result: OptimizationResult = {
    success: false,
    stops: [],
    feasibleJobs: [],
    unfeasibleJobs: [],
    warnings: [],
    errors: [],
  };

  try {
    // Step 1: Filter feasible jobs
    const { feasible, unfeasible } = filterFeasibleJobs(request.jobs, {
      helperAvailable: request.helperAvailable,
      currentLoad: 0,
      vanCapacity: request.vanCapacity,
      currentTime: new Date().toLocaleTimeString("en-GB", {
        hour: "2-digit",
        minute: "2-digit",
      }),
    });

    result.feasibleJobs = feasible;
    result.unfeasibleJobs = unfeasible;

    if (unfeasible.length > 0) {
      result.warnings.push(
        `${unfeasible.length} job(s) are not feasible for today`
      );
    }

    // Step 2: Build route with capacity tracking and depot logic
    const routeBuilderOptions: RouteBuilderOptions = {
      jobs: feasible,
      helperAvailable: request.helperAvailable,
      returnToDepot: request.returnToDepot,
      vanCapacity: request.vanCapacity,
      depotLatitude: request.depotLatitude,
      depotLongitude: request.depotLongitude,
      depotLabel: request.depotLabel,
      startLatitude: request.startLatitude,
      startLongitude: request.startLongitude,
      startLabel: request.startLabel,
      helperLatitude: request.helperLatitude,
      helperLongitude: request.helperLongitude,
      helperName: request.helperName,
    };

    const stops = buildRoute(routeBuilderOptions);

    // Step 3: Validate route
    const validation = validateRoute(stops);
    if (!validation.valid) {
      result.errors.push(...validation.errors);
      return result;
    }

    result.stops = stops;
    result.success = true;

    return result;
  } catch (error) {
    result.errors.push(
      `Optimization failed: ${error instanceof Error ? error.message : "Unknown error"}`
    );
    return result;
  }
}

/**
 * Get optimization status for UI
 */
export function getOptimizationStatus(result: OptimizationResult): string {
  if (!result.success) {
    return `Failed: ${result.errors.join(", ")}`;
  }

  const summary = [];
  summary.push(`${result.stops.length} stops`);
  summary.push(`${result.feasibleJobs.length} jobs`);

  if (result.unfeasibleJobs.length > 0) {
    summary.push(`${result.unfeasibleJobs.length} skipped`);
  }

  return summary.join(" • ");
}
