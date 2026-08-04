/**
 * Optimization Performance Metrics Dashboard
 * 
 * Tracks optimization performance and API costs
 * Provides visibility into cache hit rate, API calls, and optimization time
 */

export interface OptimizationMetrics {
  optimizationId: string;
  timestamp: Date;
  jobCount: number;
  segmentCount: number;
  optimizationTimeMs: number;
  cacheHitRate: number; // 0-100%
  cacheMisses: number;
  cacheHits: number;
  googleApiCalls: number;
  averageApiCallsPerJob: number;
  distanceReduction: number; // percentage
  depotVisits: number;
  totalDistance: number;
  totalDrivingTime: number;
  memoryUsageMb?: number;
}

export interface MetricsSummary {
  totalOptimizations: number;
  averageOptimizationTimeMs: number;
  averageCacheHitRate: number;
  totalGoogleApiCalls: number;
  totalJobsProcessed: number;
  averageDistanceReduction: number;
  costEstimate: {
    googleApiCostUsd: number;
    estimatedMonthlyCostUsd: number;
  };
}

class OptimizationMetricsDashboard {
  private metrics: OptimizationMetrics[] = [];
  private googleApiCostPerCall = 0.005; // $0.005 per API call (estimate)

  /**
   * Record optimization metrics
   */
  recordOptimization(metrics: OptimizationMetrics): void {
    this.metrics.push(metrics);
    console.log(`\n📊 Optimization ${metrics.optimizationId} recorded`);
    console.log(`   Jobs: ${metrics.jobCount}`);
    console.log(`   Time: ${metrics.optimizationTimeMs}ms`);
    console.log(`   Cache Hit Rate: ${metrics.cacheHitRate.toFixed(1)}%`);
    console.log(`   Google API Calls: ${metrics.googleApiCalls}`);
  }

  /**
   * Get summary statistics
   */
  getSummary(): MetricsSummary {
    if (this.metrics.length === 0) {
      return {
        totalOptimizations: 0,
        averageOptimizationTimeMs: 0,
        averageCacheHitRate: 0,
        totalGoogleApiCalls: 0,
        totalJobsProcessed: 0,
        averageDistanceReduction: 0,
        costEstimate: {
          googleApiCostUsd: 0,
          estimatedMonthlyCostUsd: 0,
        },
      };
    }

    const totalGoogleApiCalls = this.metrics.reduce((sum, m) => sum + m.googleApiCalls, 0);
    const totalJobsProcessed = this.metrics.reduce((sum, m) => sum + m.jobCount, 0);
    const averageOptimizationTimeMs =
      this.metrics.reduce((sum, m) => sum + m.optimizationTimeMs, 0) / this.metrics.length;
    const averageCacheHitRate =
      this.metrics.reduce((sum, m) => sum + m.cacheHitRate, 0) / this.metrics.length;
    const averageDistanceReduction =
      this.metrics.reduce((sum, m) => sum + m.distanceReduction, 0) / this.metrics.length;

    // Cost estimate: assume 20 optimizations per day
    const costPerOptimization = totalGoogleApiCalls * this.googleApiCostPerCall;
    const estimatedDailyCost = costPerOptimization * 20;
    const estimatedMonthlyCost = estimatedDailyCost * 30;

    return {
      totalOptimizations: this.metrics.length,
      averageOptimizationTimeMs,
      averageCacheHitRate,
      totalGoogleApiCalls,
      totalJobsProcessed,
      averageDistanceReduction,
      costEstimate: {
        googleApiCostUsd: costPerOptimization,
        estimatedMonthlyCostUsd: estimatedMonthlyCost,
      },
    };
  }

  /**
   * Format dashboard for display
   */
  formatDashboard(): string {
    const summary = this.getSummary();

    let output = "";
    output += `\n${"=".repeat(70)}\n`;
    output += `OPTIMIZATION PERFORMANCE DASHBOARD\n`;
    output += `${"=".repeat(70)}\n\n`;

    output += `OPTIMIZATION STATISTICS\n`;
    output += `Total Optimizations: ${summary.totalOptimizations}\n`;
    output += `Total Jobs Processed: ${summary.totalJobsProcessed}\n`;
    output += `Average Jobs per Optimization: ${(summary.totalJobsProcessed / Math.max(summary.totalOptimizations, 1)).toFixed(1)}\n\n`;

    output += `PERFORMANCE\n`;
    output += `Average Optimization Time: ${summary.averageOptimizationTimeMs.toFixed(0)}ms\n`;
    output += `Average Distance Reduction: ${summary.averageDistanceReduction.toFixed(1)}%\n\n`;

    output += `CACHING\n`;
    output += `Average Cache Hit Rate: ${summary.averageCacheHitRate.toFixed(1)}%\n`;
    const totalCacheHits = this.metrics.reduce((sum, m) => sum + m.cacheHits, 0);
    const totalCacheMisses = this.metrics.reduce((sum, m) => sum + m.cacheMisses, 0);
    output += `Total Cache Hits: ${totalCacheHits}\n`;
    output += `Total Cache Misses: ${totalCacheMisses}\n\n`;

    output += `API USAGE\n`;
    output += `Total Google API Calls: ${summary.totalGoogleApiCalls}\n`;
    output += `Average API Calls per Job: ${(summary.totalGoogleApiCalls / Math.max(summary.totalJobsProcessed, 1)).toFixed(2)}\n\n`;

    output += `COST ANALYSIS\n`;
    output += `Cost per Optimization: $${summary.costEstimate.googleApiCostUsd.toFixed(3)}\n`;
    output += `Estimated Daily Cost (20 optimizations): $${(summary.costEstimate.googleApiCostUsd * 20).toFixed(2)}\n`;
    output += `Estimated Monthly Cost: $${summary.costEstimate.estimatedMonthlyCostUsd.toFixed(2)}\n\n`;

    output += `${"=".repeat(70)}\n`;

    return output;
  }

  /**
   * Format individual optimization for display
   */
  formatOptimization(metrics: OptimizationMetrics): string {
    let output = "";
    output += `\n${"=".repeat(70)}\n`;
    output += `Optimization ${metrics.optimizationId}\n`;
    output += `${metrics.timestamp.toISOString()}\n`;
    output += `${"=".repeat(70)}\n\n`;

    output += `INPUT\n`;
    output += `Jobs: ${metrics.jobCount}\n`;
    output += `Segments: ${metrics.segmentCount}\n\n`;

    output += `PERFORMANCE\n`;
    output += `Optimization Time: ${metrics.optimizationTimeMs}ms\n`;
    output += `Distance Reduction: ${metrics.distanceReduction.toFixed(1)}%\n\n`;

    output += `CACHING\n`;
    output += `Cache Hit Rate: ${metrics.cacheHitRate.toFixed(1)}%\n`;
    output += `Cache Hits: ${metrics.cacheHits}\n`;
    output += `Cache Misses: ${metrics.cacheMisses}\n\n`;

    output += `API USAGE\n`;
    output += `Google API Calls: ${metrics.googleApiCalls}\n`;
    output += `Average API Calls per Job: ${metrics.averageApiCallsPerJob.toFixed(2)}\n\n`;

    output += `RESULTS\n`;
    output += `Depot Visits: ${metrics.depotVisits}\n`;
    output += `Total Distance: ${metrics.totalDistance.toFixed(1)}km\n`;
    output += `Total Driving Time: ${metrics.totalDrivingTime.toFixed(0)}min\n`;

    if (metrics.memoryUsageMb) {
      output += `Memory Usage: ${metrics.memoryUsageMb.toFixed(1)}MB\n`;
    }

    output += `\n${"=".repeat(70)}\n`;

    return output;
  }

  /**
   * Export metrics as JSON
   */
  exportAsJSON(): string {
    return JSON.stringify(
      {
        metrics: this.metrics,
        summary: this.getSummary(),
      },
      null,
      2
    );
  }

  /**
   * Clear all metrics (for testing)
   */
  clear(): void {
    this.metrics = [];
  }

  /**
   * Get all metrics
   */
  getAllMetrics(): OptimizationMetrics[] {
    return [...this.metrics];
  }
}

// Global instance
export const optimizationMetrics = new OptimizationMetricsDashboard();

/**
 * Helper to measure optimization time
 */
export async function measureOptimization<T>(
  fn: () => Promise<T>
): Promise<{ result: T; timeMs: number }> {
  const start = performance.now();
  const result = await fn();
  const timeMs = performance.now() - start;
  return { result, timeMs };
}

/**
 * Helper to calculate cache hit rate
 */
export function calculateCacheHitRate(hits: number, misses: number): number {
  if (hits + misses === 0) return 100; // No cache accesses = 100% (no misses)
  return (hits / (hits + misses)) * 100;
}
