/**
 * Distance Matrix Caching
 * Caches distance calculations to avoid redundant computations
 * Dramatically reduces API calls and improves performance
 */

import crypto from "crypto";

interface CachedDistance {
  key: string;
  fromLat: number;
  fromLon: number;
  toLat: number;
  toLon: number;
  distanceMinutes: number;
  createdAt: Date;
}

// In-memory cache for the current session
const distanceCache = new Map<string, number>();

/**
 * Generate a cache key from two coordinates
 * Uses rounding to group nearby coordinates together
 */
export function generateCacheKey(
  fromLat: number,
  fromLon: number,
  toLat: number,
  toLon: number,
): string {
  // Round to 4 decimal places (~11 meters accuracy)
  // This groups nearby locations together for better cache hits
  const precision = 4;
  const from = `${Math.round(fromLat * Math.pow(10, precision))}:${Math.round(fromLon * Math.pow(10, precision))}`;
  const to = `${Math.round(toLat * Math.pow(10, precision))}:${Math.round(toLon * Math.pow(10, precision))}`;
  return `${from}=>${to}`;
}

/**
 * Generate a hash of a set of locations for bulk caching
 */
export function generateLocationSetHash(
  locations: Array<{ latitude: number; longitude: number }>,
): string {
  const locationStr = locations
    .map((loc) => `${loc.latitude.toFixed(4)},${loc.longitude.toFixed(4)}`)
    .join("|");
  return crypto.createHash("md5").update(locationStr).digest("hex");
}

/**
 * Get distance from cache if available
 */
export function getCachedDistance(
  fromLat: number,
  fromLon: number,
  toLat: number,
  toLon: number,
): number | null {
  const key = generateCacheKey(fromLat, fromLon, toLat, toLon);
  return distanceCache.get(key) ?? null;
}

/**
 * Store distance in cache
 */
export function setCachedDistance(
  fromLat: number,
  fromLon: number,
  toLat: number,
  toLon: number,
  distanceMinutes: number,
): void {
  const key = generateCacheKey(fromLat, fromLon, toLat, toLon);
  distanceCache.set(key, distanceMinutes);
}

/**
 * Get cache statistics
 */
export function getCacheStats(): {
  size: number;
  entries: number;
} {
  return {
    size: distanceCache.size,
    entries: distanceCache.size,
  };
}

/**
 * Clear the cache
 */
export function clearCache(): void {
  distanceCache.clear();
}

/**
 * Preload cache with known distances
 * Useful for frequently used routes
 */
export function preloadCache(
  distances: Array<{
    fromLat: number;
    fromLon: number;
    toLat: number;
    toLon: number;
    distanceMinutes: number;
  }>,
): void {
  for (const distance of distances) {
    setCachedDistance(
      distance.fromLat,
      distance.fromLon,
      distance.toLat,
      distance.toLon,
      distance.distanceMinutes,
    );
  }
}
