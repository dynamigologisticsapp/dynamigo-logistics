import { describe, it, expect } from "vitest";
import {
  nearestNeighbor,
  calculateRouteCost,
  twoOpt,
  optimizeRoute,
} from "./tsp-solver";

describe("TSP Solver", () => {
  // Create a simple test time matrix
  // Represents 4 stops with travel times between them
  const timeMatrix = {
    matrix: [
      [0, 10, 15, 20], // From stop 0
      [10, 0, 35, 25], // From stop 1
      [15, 35, 0, 30], // From stop 2
      [20, 25, 30, 0], // From stop 3
    ],
    stops: [
      { id: "stop_0", latitude: 51.5074, longitude: -0.1278, serviceMinutes: 10 },
      { id: "stop_1", latitude: 53.4808, longitude: -2.2426, serviceMinutes: 15 },
      { id: "stop_2", latitude: 55.8642, longitude: -4.2518, serviceMinutes: 12 },
      { id: "stop_3", latitude: 52.5, longitude: -1.5, serviceMinutes: 10 },
    ],
  };

  it("should find a valid route with nearest neighbor", () => {
    const route = nearestNeighbor(timeMatrix, 0);

    // Route should have all stops
    expect(route).toHaveLength(4);

    // Route should start at the specified stop
    expect(route[0]).toBe(0);

    // All stops should be unique
    const uniqueStops = new Set(route);
    expect(uniqueStops.size).toBe(4);
  });

  it("should calculate route cost including service time", () => {
    const route = [0, 1, 2, 3];
    const cost = calculateRouteCost(route, timeMatrix);

    // Cost should include travel time + service time
    // Travel: 0->1 (10) + 1->2 (35) + 2->3 (30) = 75
    // Service: 10 + 15 + 12 + 10 = 47
    // Total: 122
    expect(cost).toBe(122);
  });

  it("should improve route with 2-opt", () => {
    const initialRoute = [0, 2, 1, 3];
    const initialCost = calculateRouteCost(initialRoute, timeMatrix);

    const improvedRoute = twoOpt(initialRoute, timeMatrix, 100);
    const improvedCost = calculateRouteCost(improvedRoute, timeMatrix);

    // Improved route should be at least as good as initial
    expect(improvedCost).toBeLessThanOrEqual(initialCost);
  });

  it("should find optimal route with full optimization", () => {
    const { route, cost } = optimizeRoute(timeMatrix, 0);

    // Route should be valid
    expect(route).toHaveLength(4);
    expect(route[0]).toBe(0);

    // Cost should be positive
    expect(cost).toBeGreaterThan(0);

    // Cost should match calculated cost
    const calculatedCost = calculateRouteCost(route, timeMatrix);
    expect(cost).toBe(calculatedCost);
  });

  it("should handle single stop", () => {
    const singleStopMatrix = {
      matrix: [[0]],
      stops: [{ id: "stop_0", latitude: 51.5074, longitude: -0.1278, serviceMinutes: 10 }],
    };

    const route = nearestNeighbor(singleStopMatrix, 0);
    expect(route).toEqual([0]);

    const cost = calculateRouteCost(route, singleStopMatrix);
    expect(cost).toBe(10); // Only service time
  });

  it("should handle two stops", () => {
    const twoStopMatrix = {
      matrix: [
        [0, 20],
        [20, 0],
      ],
      stops: [
        { id: "stop_0", latitude: 51.5074, longitude: -0.1278, serviceMinutes: 10 },
        { id: "stop_1", latitude: 53.4808, longitude: -2.2426, serviceMinutes: 15 },
      ],
    };

    const route = nearestNeighbor(twoStopMatrix, 0);
    expect(route).toEqual([0, 1]);

    const cost = calculateRouteCost(route, twoStopMatrix);
    // Travel: 0->1 (20) = 20
    // Service: 10 + 15 = 25
    // Total: 45
    expect(cost).toBe(45);
  });

  it("should not exceed max iterations in 2-opt", () => {
    const route = [0, 1, 2, 3];
    const maxIterations = 5;

    // Should complete without hanging
    const improved = twoOpt(route, timeMatrix, maxIterations);
    expect(improved).toBeDefined();
    expect(improved.length).toBe(4);
  });
});
