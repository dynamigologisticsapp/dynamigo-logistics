/**
 * Optimization Service V2
 * 
 * Complete optimization pipeline with:
 * - Pluggable distance providers
 * - Segment-based optimization
 * - Routing explanations
 * - Comprehensive error handling
 */

import type { JobRecord } from "@/shared/route-planner";
import { OptimizationExplanation } from "@/shared/route-planner";
import { HaversineDistanceProvider, CachedDistanceProvider, type DistanceProvider } from "./distance-provider";
import { buildRoute, type RouteBuilderOptions } from "./route-builder";
import { optimizeSegments, generateRoutingExplanation } from "./segment-optimizer";

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

export interface OptimizationResultStop {
  id: string;
  type: string;
  label: string;
  latitude?: string | number;
  longitude?: string | number;
  loadBefore: number;
  loadAfter: number;
  sofaChange: number;
  jobId?: string;
}

export interface OptimizationResult {
  success: boolean;
  stops: OptimizationResultStop[];
  explanation: OptimizationExplanation;
  warnings: string[];
  errors: string[];
  stats: {
    jobsProcessed: number;
    jobsSkipped: number;
    depotVisits: number;
    totalStops: number;
  };
}

/**
 * Execute complete optimization pipeline
 */
export async function optimizeRouteV2(
  request: OptimizationRequest,
  distanceProvider?: any
): Promise<OptimizationResult> {
  const result: OptimizationResult = {
    success: false,
    stops: [],
    explanation: { reason: "", depotVisits: 0, totalDistance: 0, totalTime: 0, segmentsOptimized: 0 },
    warnings: [],
    errors: [],
    stats: {
      jobsProcessed: 0,
      jobsSkipped: 0,
      depotVisits: 0,
      totalStops: 0,
    },
  };

  try {
    // Use Haversine by default, wrap with caching
    const provider = distanceProvider || 
      new CachedDistanceProvider(new HaversineDistanceProvider());

    // Step 1: Build initial route with business logic
    const routeBuilderOptions: RouteBuilderOptions = {
      jobs: request.jobs,
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

    const initialRoute = buildRoute(routeBuilderOptions);

    // Step 2: Optimize segments
    const { optimizedStops, explanation: optimization } = await optimizeSegments(
      initialRoute,
      provider
    );

    // Step 3: Generate routing explanation
    const explanation = generateRoutingExplanation(optimizedStops, optimization);

    result.stops = optimizedStops as OptimizationResultStop[];
    result.explanation = {
      ...optimization,
      reason: explanation,
    };
    result.success = true;

    // Update stats
    result.stats.jobsProcessed = request.jobs.length;
    result.stats.depotVisits = optimizedStops.filter((s) => s.type === "depot").length;
    result.stats.totalStops = optimizedStops.length;

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
  summary.push(`${result.stats.totalStops} stops`);
  summary.push(`${result.stats.jobsProcessed} jobs`);
  summary.push(`${result.stats.depotVisits} depot visits`);

  return summary.join(" • ");
}
