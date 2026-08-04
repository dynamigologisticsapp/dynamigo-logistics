/**
 * Optimization Logger
 * 
 * Provides detailed logging for every optimization
 * Enables debugging and transparency
 */

import type { Stop } from "./capacity-engine";

export interface OptimizationLog {
  optimizationId: string;
  timestamp: Date;
  startingLoad: number;
  capacity: number;
  jobs: Array<{
    id: string;
    type: "pickup" | "delivery";
    sofaCount: number;
    label: string;
  }>;
  depotInsertions: Array<{
    afterJob: string;
    reason: string;
  }>;
  segments: Array<{
    number: number;
    jobs: string[];
    distanceReduction: number; // percentage
  }>;
  finalLoad: number;
  totalDistance: number;
  totalDrivingTime: number;
  notes: string[];
}

let optimizationCounter = 0;

/**
 * Create new optimization log
 */
export function createOptimizationLog(
  startingLoad: number,
  capacity: number
): OptimizationLog {
  optimizationCounter++;
  return {
    optimizationId: `OPT-${optimizationCounter.toString().padStart(5, "0")}`,
    timestamp: new Date(),
    startingLoad,
    capacity,
    jobs: [],
    depotInsertions: [],
    segments: [],
    finalLoad: 0,
    totalDistance: 0,
    totalDrivingTime: 0,
    notes: [],
  };
}

/**
 * Add job to log
 */
export function logJob(
  log: OptimizationLog,
  id: string,
  type: "pickup" | "delivery",
  sofaCount: number,
  label: string
): void {
  log.jobs.push({ id, type, sofaCount, label });
}

/**
 * Log depot insertion
 */
export function logDepotInsertion(
  log: OptimizationLog,
  afterJob: string,
  reason: string
): void {
  log.depotInsertions.push({ afterJob, reason });
}

/**
 * Log segment optimization
 */
export function logSegmentOptimization(
  log: OptimizationLog,
  segmentNumber: number,
  jobs: string[],
  distanceReduction: number
): void {
  log.segments.push({
    number: segmentNumber,
    jobs,
    distanceReduction,
  });
}

/**
 * Add note to log
 */
export function logNote(log: OptimizationLog, note: string): void {
  log.notes.push(note);
}

/**
 * Finalize log with results
 */
export function finalizeLog(
  log: OptimizationLog,
  stops: Stop[],
  totalDistance: number,
  totalDrivingTime: number
): void {
  log.finalLoad = stops[stops.length - 1]?.loadAfter || 0;
  log.totalDistance = totalDistance;
  log.totalDrivingTime = totalDrivingTime;
}

/**
 * Format log for display
 */
export function formatOptimizationLog(log: OptimizationLog): string {
  let output = "";

  output += `\n${"=".repeat(60)}\n`;
  output += `Optimization ${log.optimizationId}\n`;
  output += `${log.timestamp.toISOString()}\n`;
  output += `${"=".repeat(60)}\n\n`;

  output += `STARTING CONDITIONS\n`;
  output += `Starting load: ${log.startingLoad} sofas\n`;
  output += `Van capacity: ${log.capacity} sofas\n\n`;

  output += `JOBS\n`;
  for (const job of log.jobs) {
    const symbol = job.type === "pickup" ? "📦" : "🚚";
    output += `${symbol} ${job.label}: ${job.type} ${job.sofaCount} sofa(s)\n`;
  }
  output += `\n`;

  if (log.depotInsertions.length > 0) {
    output += `DEPOT INSERTIONS\n`;
    for (const insertion of log.depotInsertions) {
      output += `• After ${insertion.afterJob}: ${insertion.reason}\n`;
    }
    output += `\n`;
  }

  output += `OPTIMIZATION\n`;
  if (log.segments.length > 0) {
    for (const segment of log.segments) {
      output += `Segment ${segment.number}: [${segment.jobs.join(" → ")}]\n`;
      output += `  Distance reduced: ${segment.distanceReduction.toFixed(1)}%\n`;
    }
  } else {
    output += `No segments optimized (single job or no optimization needed)\n`;
  }
  output += `\n`;

  output += `RESULTS\n`;
  output += `Final load: ${log.finalLoad} sofas\n`;
  output += `Total distance: ${log.totalDistance.toFixed(1)} km\n`;
  output += `Total driving time: ${log.totalDrivingTime.toFixed(0)} minutes\n`;

  if (log.notes.length > 0) {
    output += `\nNOTES\n`;
    for (const note of log.notes) {
      output += `• ${note}\n`;
    }
  }

  output += `\n${"=".repeat(60)}\n`;

  return output;
}

/**
 * Format multiple logs as summary
 */
export function formatOptimizationSummary(logs: OptimizationLog[]): string {
  let output = "";

  output += `\n${"=".repeat(60)}\n`;
  output += `OPTIMIZATION SUMMARY (${logs.length} optimizations)\n`;
  output += `${"=".repeat(60)}\n\n`;

  let totalJobs = 0;
  let totalDistance = 0;
  let totalTime = 0;
  let totalDepots = 0;

  for (const log of logs) {
    totalJobs += log.jobs.length;
    totalDistance += log.totalDistance;
    totalTime += log.totalDrivingTime;
    totalDepots += log.depotInsertions.length;
  }

  output += `Total jobs processed: ${totalJobs}\n`;
  output += `Total depot insertions: ${totalDepots}\n`;
  output += `Total distance: ${totalDistance.toFixed(1)} km\n`;
  output += `Total driving time: ${totalTime.toFixed(0)} minutes\n`;
  output += `Average distance per optimization: ${(totalDistance / logs.length).toFixed(1)} km\n`;
  output += `Average time per optimization: ${(totalTime / logs.length).toFixed(0)} minutes\n`;

  output += `\n${"=".repeat(60)}\n`;

  return output;
}

/**
 * Export logs to JSON
 */
export function exportLogsAsJSON(logs: OptimizationLog[]): string {
  return JSON.stringify(logs, null, 2);
}
