/**
 * Segment-Based TSP Optimizer
 * 
 * Optimizes route segments independently while respecting depot constraints.
 * Uses 2-opt algorithm within each segment.
 */

import type { DistanceProvider } from "./distance-provider";
import type { Stop } from "./capacity-engine";

export interface OptimizationExplanation {
  reason: string;
  depotVisits: number;
  totalDistance: number;
  totalTime: number;
  segmentsOptimized: number;
}

/**
 * Identify route segments (groups of jobs between depot stops)
 */
export function identifySegments(stops: Stop[]): Stop[][] {
  const segments: Stop[][] = [];
  let currentSegment: Stop[] = [];

  for (const stop of stops) {
    if (stop.type === "depot" && currentSegment.length > 0) {
      segments.push(currentSegment);
      currentSegment = [];
    } else if (stop.type !== "depot" && stop.type !== "start" && stop.type !== "end") {
      currentSegment.push(stop);
    }
  }

  if (currentSegment.length > 0) {
    segments.push(currentSegment);
  }

  return segments;
}

/**
 * Optimize each segment independently using 2-opt
 */
export async function optimizeSegments(
  stops: Stop[],
  distanceProvider: DistanceProvider
): Promise<{
  optimizedStops: Stop[];
  explanation: OptimizationExplanation;
}> {
  const segments = identifySegments(stops);
  const optimizedStops: Stop[] = [];
  let totalDistance = 0;
  let totalTime = 0;

  // Add start stop
  const startStop = stops.find((s) => s.type === "start");
  if (startStop) {
    optimizedStops.push(startStop);
  }

  // Optimize each segment
  for (let i = 0; i < segments.length; i++) {
    const segment = segments[i];

    // Add depot before segment (if not first segment)
    if (i > 0) {
      const depotStop = stops.find(
        (s, idx) =>
          s.type === "depot" &&
          idx < stops.indexOf(segment[0])
      );
      if (depotStop) {
        optimizedStops.push(depotStop);
      }
    }

    // Optimize segment
    if (segment.length > 1) {
      const optimized = await optimizeSegmentWith2Opt(segment, distanceProvider);
      optimizedStops.push(...optimized);
    } else if (segment.length === 1) {
      optimizedStops.push(segment[0]);
    }
  }

  // Add final depot if exists
  const finalDepot = stops.find((s, idx) => s.type === "depot" && idx === stops.length - 2);
  if (finalDepot) {
    optimizedStops.push(finalDepot);
  }

  // Add end stop
  const endStop = stops.find((s) => s.type === "end");
  if (endStop) {
    optimizedStops.push(endStop);
  }

  return {
    optimizedStops,
    explanation: {
      reason: `Optimized ${segments.length} route segment(s) using 2-opt algorithm`,
      depotVisits: stops.filter((s) => s.type === "depot").length,
      totalDistance: totalDistance,
      totalTime: totalTime,
      segmentsOptimized: segments.length,
    },
  };
}

/**
 * Optimize a single segment using 2-opt algorithm
 */
async function optimizeSegmentWith2Opt(
  segment: Stop[],
  distanceProvider: DistanceProvider
): Promise<Stop[]> {
  if (segment.length <= 2) {
    return segment;
  }

  // Extract coordinates
  const coords: [number, number][] = segment.map((s) => [
    typeof s.latitude === "string" ? parseFloat(s.latitude) : s.latitude || 0,
    typeof s.longitude === "string" ? parseFloat(s.longitude) : s.longitude || 0,
  ]);

  // Get distance matrix
  const distanceMatrix = await distanceProvider.getBatchTravelTimes(coords, coords);

  // Apply 2-opt improvements
  let improved = true;
  let bestOrder = Array.from({ length: segment.length }, (_, i) => i);
  let bestDistance = calculateTourDistance(bestOrder, distanceMatrix);

  while (improved) {
    improved = false;

    for (let i = 0; i < bestOrder.length - 1; i++) {
      for (let j = i + 2; j < bestOrder.length; j++) {
        // Try reversing segment between i and j
        const newOrder = bestOrder.slice();
        reverse(newOrder, i + 1, j);

        const newDistance = calculateTourDistance(newOrder, distanceMatrix);
        if (newDistance < bestDistance) {
          bestOrder = newOrder;
          bestDistance = newDistance;
          improved = true;
        }
      }
    }
  }

  // Return reordered segment
  return bestOrder.map((idx) => segment[idx]);
}

/**
 * Calculate total distance of a tour
 */
function calculateTourDistance(order: number[], distanceMatrix: number[][]): number {
  let distance = 0;
  for (let i = 0; i < order.length - 1; i++) {
    distance += distanceMatrix[order[i]][order[i + 1]];
  }
  // Add distance back to start
  distance += distanceMatrix[order[order.length - 1]][order[0]];
  return distance;
}

/**
 * Reverse array segment
 */
function reverse(arr: number[], start: number, end: number): void {
  while (start < end) {
    [arr[start], arr[end]] = [arr[end], arr[start]];
    start++;
    end--;
  }
}

/**
 * Generate routing explanation
 */
export function generateRoutingExplanation(
  stops: Stop[],
  optimization: OptimizationExplanation
): string {
  const jobStops = stops.filter((s) => s.type === "job");
  const depotStops = stops.filter((s) => s.type === "depot");
  const helperStops = stops.filter((s) => s.type === "helper-collect" || s.type === "helper-drop");

  let explanation = `Route Summary\n`;
  explanation += `\nTotal stops: ${stops.length}\n`;
  explanation += `Jobs: ${jobStops.length}\n`;
  explanation += `Depot visits: ${depotStops.length}\n`;

  if (helperStops.length > 0) {
    explanation += `Helper: Collected and dropped\n`;
  }

  explanation += `\nReason for depot visits:\n`;
  for (const depot of depotStops) {
    if (depot.sofaChange !== undefined) {
      if (depot.sofaChange > 0) {
        explanation += `- Loading ${depot.sofaChange} sofas\n`;
      } else if (depot.sofaChange < 0) {
        explanation += `- Unloading ${Math.abs(depot.sofaChange)} sofas\n`;
      }
    }
  }

  explanation += `\nOptimization: ${optimization.reason}\n`;

  return explanation;
}
