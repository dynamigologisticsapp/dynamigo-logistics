/**
 * Haversine Distance Calculator
 * Calculates great-circle distances between coordinates using the Haversine formula
 * This is completely free and runs locally - no API calls needed
 */

const EARTH_RADIUS_MILES = 3958.8;
const EARTH_RADIUS_KM = 6371;
const ROAD_INFLATION_FACTOR = 1.27; // Roads are ~27% longer than straight line
const MINUTES_PER_MILE = 2.2; // Average driving speed ~27 mph

interface Coordinate {
  latitude: number;
  longitude: number;
}

/**
 * Calculate great-circle distance between two coordinates in miles
 * Uses the Haversine formula for accuracy
 */
export function calculateHaversineDistance(
  from: Coordinate,
  to: Coordinate,
): number {
  const lat1 = (from.latitude * Math.PI) / 180;
  const lat2 = (to.latitude * Math.PI) / 180;
  const deltaLat = ((to.latitude - from.latitude) * Math.PI) / 180;
  const deltaLon = ((to.longitude - from.longitude) * Math.PI) / 180;

  const a =
    Math.sin(deltaLat / 2) * Math.sin(deltaLat / 2) +
    Math.cos(lat1) *
      Math.cos(lat2) *
      Math.sin(deltaLon / 2) *
      Math.sin(deltaLon / 2);

  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  const distance = EARTH_RADIUS_MILES * c;

  return distance;
}

/**
 * Calculate estimated driving distance in miles
 * Applies road inflation factor to account for actual road routes
 */
export function calculateDrivingDistance(
  from: Coordinate,
  to: Coordinate,
): number {
  const straightLineDistance = calculateHaversineDistance(from, to);
  return straightLineDistance * ROAD_INFLATION_FACTOR;
}

/**
 * Calculate estimated driving time in minutes
 * Based on average driving speed of ~27 mph (2.2 minutes per mile)
 */
export function calculateDrivingTime(
  from: Coordinate,
  to: Coordinate,
): number {
  const drivingDistance = calculateDrivingDistance(from, to);
  return Math.round(drivingDistance * MINUTES_PER_MILE);
}

/**
 * Calculate distance matrix for multiple locations
 * Returns a 2D array where matrix[i][j] is the distance from location i to location j
 * This replaces the paid Google Distance Matrix API
 */
export function calculateDistanceMatrix(
  locations: Coordinate[],
): number[][] {
  const matrix: number[][] = [];

  for (let i = 0; i < locations.length; i++) {
    matrix[i] = [];
    for (let j = 0; j < locations.length; j++) {
      if (i === j) {
        matrix[i][j] = 0;
      } else {
        matrix[i][j] = calculateDrivingTime(locations[i], locations[j]);
      }
    }
  }

  return matrix;
}

/**
 * Calculate time matrix for multiple locations
 * Returns a 2D array where matrix[i][j] is the time in minutes from location i to location j
 */
export function calculateTimeMatrix(
  locations: Coordinate[],
): number[][] {
  return calculateDistanceMatrix(locations);
}
