/**
 * Traveling Salesman Problem (TSP) Solver
 * Implements nearest neighbor + 2-opt optimization for route planning
 * This replaces paid route optimization APIs
 */

interface Stop {
  id: string;
  latitude: number;
  longitude: number;
  serviceMinutes: number;
}

interface TimeMatrix {
  matrix: number[][];
  stops: Stop[];
}

/**
 * Nearest Neighbor algorithm - fast greedy solution
 * Starts at a location and always goes to the nearest unvisited stop
 */
export function nearestNeighbor(
  timeMatrix: TimeMatrix,
  startIndex: number = 0,
): number[] {
  const { matrix } = timeMatrix;
  const n = matrix.length;
  const visited = new Array(n).fill(false);
  const route: number[] = [startIndex];
  visited[startIndex] = true;

  let current = startIndex;

  for (let i = 1; i < n; i++) {
    let nearest = -1;
    let minTime = Infinity;

    for (let j = 0; j < n; j++) {
      if (!visited[j] && matrix[current][j] < minTime) {
        minTime = matrix[current][j];
        nearest = j;
      }
    }

    if (nearest !== -1) {
      route.push(nearest);
      visited[nearest] = true;
      current = nearest;
    }
  }

  return route;
}

/**
 * Calculate total travel time for a route
 * Includes travel time between stops and service time at each stop
 */
export function calculateRouteCost(
  route: number[],
  timeMatrix: TimeMatrix,
): number {
  const { matrix, stops } = timeMatrix;
  let totalTime = 0;

  for (let i = 0; i < route.length - 1; i++) {
    const from = route[i];
    const to = route[i + 1];
    totalTime += matrix[from][to];
  }

  // Add service time at each stop
  for (const stopIndex of route) {
    totalTime += stops[stopIndex].serviceMinutes;
  }

  return totalTime;
}

/**
 * 2-opt improvement algorithm
 * Iteratively improves the route by reversing segments
 */
export function twoOpt(
  route: number[],
  timeMatrix: TimeMatrix,
  maxIterations: number = 1000,
): number[] {
  const { matrix } = timeMatrix;
  let improved = true;
  let iterations = 0;
  let bestRoute = [...route];
  let bestCost = calculateRouteCost(bestRoute, timeMatrix);

  while (improved && iterations < maxIterations) {
    improved = false;
    iterations++;

    for (let i = 0; i < bestRoute.length - 2; i++) {
      for (let j = i + 2; j < bestRoute.length; j++) {
        // Create new route by reversing segment between i+1 and j
        const newRoute = [
          ...bestRoute.slice(0, i + 1),
          ...bestRoute.slice(i + 1, j + 1).reverse(),
          ...bestRoute.slice(j + 1),
        ];

        const newCost = calculateRouteCost(newRoute, timeMatrix);

        if (newCost < bestCost) {
          bestRoute = newRoute;
          bestCost = newCost;
          improved = true;
          break;
        }
      }
      if (improved) break;
    }
  }

  return bestRoute;
}

/**
 * Optimize route using nearest neighbor + 2-opt
 * Fast and effective for typical delivery route sizes (5-20 stops)
 */
export function optimizeRoute(
  timeMatrix: TimeMatrix,
  startIndex: number = 0,
): { route: number[]; cost: number } {
  // Step 1: Get initial solution with nearest neighbor
  const initialRoute = nearestNeighbor(timeMatrix, startIndex);

  // Step 2: Improve with 2-opt
  const optimizedRoute = twoOpt(initialRoute, timeMatrix);

  const cost = calculateRouteCost(optimizedRoute, timeMatrix);

  return { route: optimizedRoute, cost };
}

/**
 * Try multiple starting points and return the best route
 * Useful for finding global optimum
 */
export function optimizeRouteMultiStart(
  timeMatrix: TimeMatrix,
): { route: number[]; cost: number; startIndex: number } {
  const { matrix } = timeMatrix;
  const n = matrix.length;
  let bestRoute: number[] = [];
  let bestCost = Infinity;
  let bestStartIndex = 0;

  // Try different starting points
  for (let start = 0; start < Math.min(n, 5); start++) {
    const { route, cost } = optimizeRoute(timeMatrix, start);

    if (cost < bestCost) {
      bestCost = cost;
      bestRoute = route;
      bestStartIndex = start;
    }
  }

  return { route: bestRoute, cost: bestCost, startIndex: bestStartIndex };
}

/**
 * Convert route indices to stop objects
 */
export function routeIndicesToStops(
  route: number[],
  stops: Stop[],
): Stop[] {
  return route.map((index) => stops[index]);
}
