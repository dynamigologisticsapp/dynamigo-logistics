import { RouteStop } from "@/shared/route-planner";

export interface PerformanceMetrics {
  totalStops: number;
  completedStops: number;
  onTimeStops: number;
  lateStops: number;
  averageTimePerStop: number; // in minutes
  routeEfficiency: number; // percentage (0-100)
  onTimePercentage: number; // percentage (0-100)
  totalRouteDuration: number; // in minutes
  estimatedRouteDuration: number; // in minutes
}

export interface StopPerformance {
  stopId: string;
  label: string;
  scheduledTime: number; // minutes from start
  actualTime?: number; // minutes from start
  isOnTime: boolean;
  timeDeviation: number; // positive = late, negative = early (in minutes)
}

/**
 * Calculate performance metrics for a completed or in-progress route
 */
export function calculatePerformanceMetrics(
  stops: RouteStop[],
  completedStops: Map<string, number>, // stopId -> actual completion time in minutes
  estimatedDuration: number // total estimated route duration in minutes
): PerformanceMetrics {
  let totalStops = 0;
  let completedCount = 0;
  let onTimeCount = 0;
  let totalTimeDeviation = 0;

  // Filter out route-only stops from customer job metrics.
  const jobStops = stops.filter(
    (stop) => stop.kind === "job"
  );

  totalStops = jobStops.length;

  jobStops.forEach((stop) => {
    if (completedStops.has(stop.id)) {
      completedCount++;
      const actualTime = completedStops.get(stop.id)!;
      const scheduledTime = stop.etaMinutesFromStart || 0;
      const deviation = actualTime - scheduledTime;

      totalTimeDeviation += Math.abs(deviation);

      if (deviation <= 0) {
        onTimeCount++;
      }
    }
  });

  const averageTimePerStop =
    completedCount > 0 ? Math.round((totalTimeDeviation / completedCount) * 10) / 10 : 0;

  const onTimePercentage = totalStops > 0 ? Math.round((onTimeCount / totalStops) * 100) : 0;

  const routeEfficiency =
    estimatedDuration > 0
      ? Math.round(
          ((estimatedDuration / (estimatedDuration + totalTimeDeviation)) * 100) * 10
        ) / 10
      : 100;

  return {
    totalStops,
    completedStops: completedCount,
    onTimeStops: onTimeCount,
    lateStops: completedCount - onTimeCount,
    averageTimePerStop,
    routeEfficiency: Math.max(0, Math.min(100, routeEfficiency)),
    onTimePercentage,
    totalRouteDuration: 0, // Will be set by caller if needed
    estimatedRouteDuration: estimatedDuration,
  };
}

/**
 * Calculate performance for individual stops
 */
export function calculateStopPerformance(
  stops: RouteStop[],
  completedStops: Map<string, number>
): StopPerformance[] {
  return stops
    .filter((stop) => stop.kind === "job")
    .map((stop) => {
      const actualTime = completedStops.get(stop.id);
      const scheduledTime = stop.etaMinutesFromStart || 0;
      const timeDeviation = actualTime ? actualTime - scheduledTime : 0;

      return {
        stopId: stop.id,
        label: stop.label,
        scheduledTime,
        actualTime,
        isOnTime: !actualTime || timeDeviation <= 0,
        timeDeviation,
      };
    });
}

/**
 * Format performance metrics for display
 */
export function formatPerformanceMetrics(metrics: PerformanceMetrics) {
  return {
    ...metrics,
    averageTimePerStopDisplay: `${metrics.averageTimePerStop} min`,
    routeEfficiencyDisplay: `${metrics.routeEfficiency}%`,
    onTimePercentageDisplay: `${metrics.onTimePercentage}%`,
  };
}
