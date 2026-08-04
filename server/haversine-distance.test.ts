import { describe, it, expect } from "vitest";
import {
  calculateHaversineDistance,
  calculateDrivingDistance,
  calculateDrivingTime,
  calculateDistanceMatrix,
} from "./haversine-distance";

describe("Haversine Distance Calculator", () => {
  // Test coordinates
  const london = { latitude: 51.5074, longitude: -0.1278 };
  const manchester = { latitude: 53.4808, longitude: -2.2426 };
  const glasgow = { latitude: 55.8642, longitude: -4.2518 };

  it("should calculate distance between two points", () => {
    const distance = calculateHaversineDistance(london, manchester);
    // London to Manchester is approximately 160 miles
    expect(distance).toBeGreaterThan(150);
    expect(distance).toBeLessThan(170);
  });

  it("should return 0 for same location", () => {
    const distance = calculateHaversineDistance(london, london);
    expect(distance).toBe(0);
  });

  it("should apply road inflation factor", () => {
    const straightLine = calculateHaversineDistance(london, manchester);
    const driving = calculateDrivingDistance(london, manchester);
    // Driving distance should be ~27% more than straight line
    expect(driving).toBeGreaterThan(straightLine);
    expect(driving / straightLine).toBeCloseTo(1.27, 1);
  });

  it("should calculate driving time in minutes", () => {
    const time = calculateDrivingTime(london, manchester);
    // London to Manchester is ~160 miles, at 27 mph = ~6 hours (360 minutes)
    // With road inflation: ~200 miles * 2.2 min/mile = ~440 minutes
    expect(time).toBeGreaterThan(400);
    expect(time).toBeLessThan(500);
  });

  it("should calculate distance matrix for multiple locations", () => {
    const locations = [london, manchester, glasgow];
    const matrix = calculateDistanceMatrix(locations);

    // Matrix should be 3x3
    expect(matrix).toHaveLength(3);
    expect(matrix[0]).toHaveLength(3);

    // Diagonal should be 0 (same location)
    expect(matrix[0][0]).toBe(0);
    expect(matrix[1][1]).toBe(0);
    expect(matrix[2][2]).toBe(0);

    // Distance from A to B should equal distance from B to A
    expect(matrix[0][1]).toBe(matrix[1][0]);
    expect(matrix[0][2]).toBe(matrix[2][0]);
    expect(matrix[1][2]).toBe(matrix[2][1]);

    // All distances should be positive
    for (let i = 0; i < 3; i++) {
      for (let j = 0; j < 3; j++) {
        expect(matrix[i][j]).toBeGreaterThanOrEqual(0);
      }
    }
  });

  it("should handle very close locations", () => {
    const point1 = { latitude: 51.5074, longitude: -0.1278 };
    const point2 = { latitude: 51.5075, longitude: -0.1277 };
    const distance = calculateHaversineDistance(point1, point2);
    // Should be a very small distance (less than 1 mile)
    expect(distance).toBeGreaterThan(0);
    expect(distance).toBeLessThan(0.1);
  });

  it("should handle antipodal points", () => {
    const northPole = { latitude: 90, longitude: 0 };
    const southPole = { latitude: -90, longitude: 0 };
    const distance = calculateHaversineDistance(northPole, southPole);
    // Distance from north to south pole is half Earth's circumference
    // Earth radius ~3958.8 miles, so half circumference = π * 3958.8 ≈ 12,430 miles
    expect(distance).toBeGreaterThan(12000);
    expect(distance).toBeLessThan(13000);
  });
});
