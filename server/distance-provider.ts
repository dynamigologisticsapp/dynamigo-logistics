/**
 * Pluggable Distance Provider Interface
 * 
 * Allows swapping between different distance calculation sources:
 * - Haversine (free, straight-line)
 * - OSRM (road routing, free public demo or self-hosted)
 * - Google Distance Matrix (accurate, paid)
 * - Cached (stored results)
 */

export interface DistanceProvider {
  /**
   * Get travel time between two locations
   * @param origin - [latitude, longitude]
   * @param destination - [latitude, longitude]
   * @returns Travel time in minutes
   */
  getTravelTime(
    origin: [number, number],
    destination: [number, number]
  ): Promise<number>;

  /**
   * Get travel distance between two locations
   * @param origin - [latitude, longitude]
   * @param destination - [latitude, longitude]
   * @returns Distance in kilometers
   */
  getTravelDistance(
    origin: [number, number],
    destination: [number, number]
  ): Promise<number>;

  /**
   * Get batch travel times (more efficient for multiple routes)
   */
  getBatchTravelTimes(
    origins: [number, number][],
    destinations: [number, number][]
  ): Promise<number[][]>;
}

/**
 * Haversine Distance Provider
 * Uses straight-line distance and assumes average speed
 */
export class HaversineDistanceProvider implements DistanceProvider {
  private averageSpeedKmh = 50; // Average delivery speed

  async getTravelTime(
    origin: [number, number],
    destination: [number, number]
  ): Promise<number> {
    const distanceKm = this.haversineDistance(origin, destination);
    return Math.round((distanceKm / this.averageSpeedKmh) * 60); // Convert to minutes
  }

  async getTravelDistance(
    origin: [number, number],
    destination: [number, number]
  ): Promise<number> {
    return this.haversineDistance(origin, destination);
  }

  async getBatchTravelTimes(
    origins: [number, number][],
    destinations: [number, number][]
  ): Promise<number[][]> {
    const matrix: number[][] = [];
    for (const origin of origins) {
      const row: number[] = [];
      for (const destination of destinations) {
        row.push(await this.getTravelTime(origin, destination));
      }
      matrix.push(row);
    }
    return matrix;
  }

  private haversineDistance(
    [lat1, lon1]: [number, number],
    [lat2, lon2]: [number, number]
  ): number {
    const R = 6371; // Earth's radius in km
    const dLat = ((lat2 - lat1) * Math.PI) / 180;
    const dLon = ((lon2 - lon1) * Math.PI) / 180;
    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos((lat1 * Math.PI) / 180) *
        Math.cos((lat2 * Math.PI) / 180) *
        Math.sin(dLon / 2) *
        Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
  }
}

/**
 * Cached Distance Provider
 * Wraps another provider and caches results
 */
export class CachedDistanceProvider implements DistanceProvider {
  private cache: Map<string, number> = new Map();
  private provider: DistanceProvider;

  constructor(provider: DistanceProvider) {
    this.provider = provider;
  }

  private getCacheKey(
    origin: [number, number],
    destination: [number, number],
    type: "time" | "distance"
  ): string {
    return `${type}:${origin[0]},${origin[1]}→${destination[0]},${destination[1]}`;
  }

  async getTravelTime(
    origin: [number, number],
    destination: [number, number]
  ): Promise<number> {
    const key = this.getCacheKey(origin, destination, "time");
    if (this.cache.has(key)) {
      return this.cache.get(key)!;
    }

    const time = await this.provider.getTravelTime(origin, destination);
    this.cache.set(key, time);
    return time;
  }

  async getTravelDistance(
    origin: [number, number],
    destination: [number, number]
  ): Promise<number> {
    const key = this.getCacheKey(origin, destination, "distance");
    if (this.cache.has(key)) {
      return this.cache.get(key)!;
    }

    const distance = await this.provider.getTravelDistance(origin, destination);
    this.cache.set(key, distance);
    return distance;
  }

  async getBatchTravelTimes(
    origins: [number, number][],
    destinations: [number, number][]
  ): Promise<number[][]> {
    // Try to use cache for as many as possible
    const matrix: number[][] = [];
    for (const origin of origins) {
      const row: number[] = [];
      for (const destination of destinations) {
        row.push(await this.getTravelTime(origin, destination));
      }
      matrix.push(row);
    }
    return matrix;
  }

  getCacheStats(): { size: number; entries: string[] } {
    return {
      size: this.cache.size,
      entries: Array.from(this.cache.keys()),
    };
  }

  clearCache(): void {
    this.cache.clear();
  }
}

/**
 * Google Distance Matrix Provider
 * Uses Google Distance Matrix API for accurate routing
 */
export class GoogleDistanceProvider implements DistanceProvider {
  private apiKey: string;
  private baseUrl = "https://maps.googleapis.com/maps/api/distancematrix/json";

  constructor(apiKey: string) {
    this.apiKey = apiKey;
  }

  async getTravelTime(
    origin: [number, number],
    destination: [number, number]
  ): Promise<number> {
    const [time] = await this.getBatchTravelTimes([origin], [destination]);
    return time[0];
  }

  async getTravelDistance(
    origin: [number, number],
    destination: [number, number]
  ): Promise<number> {
    // For now, use Haversine for distance (Google API returns meters)
    const haversine = new HaversineDistanceProvider();
    return haversine.getTravelDistance(origin, destination);
  }

  async getBatchTravelTimes(
    origins: [number, number][],
    destinations: [number, number][]
  ): Promise<number[][]> {
    const originsStr = origins.map((o) => `${o[0]},${o[1]}`).join("|");
    const destinationsStr = destinations.map((d) => `${d[0]},${d[1]}`).join("|");

    const url = new URL(this.baseUrl);
    url.searchParams.append("origins", originsStr);
    url.searchParams.append("destinations", destinationsStr);
    url.searchParams.append("key", this.apiKey);

    try {
      const response = await fetch(url.toString());
      const data = await response.json();

      if (data.status !== "OK") {
        throw new Error(`Google API error: ${data.status}`);
      }

      // Parse response into matrix of travel times (in minutes)
      const matrix: number[][] = [];
      for (const row of data.rows) {
        const timeRow: number[] = [];
        for (const element of row.elements) {
          if (element.status === "OK") {
            timeRow.push(Math.round(element.duration.value / 60)); // Convert seconds to minutes
          } else {
            timeRow.push(Infinity); // Unreachable
          }
        }
        matrix.push(timeRow);
      }
      return matrix;
    } catch (error) {
      throw new Error(
        `Failed to get travel times from Google: ${error instanceof Error ? error.message : "Unknown error"}`
      );
    }
  }
}

export class GeoapifyDistanceProvider implements DistanceProvider {
  private baseUrl = "https://api.geoapify.com/v1/routematrix";

  constructor(private readonly apiKey: string) {}

  async getTravelTime(
    origin: [number, number],
    destination: [number, number]
  ): Promise<number> {
    const [time] = await this.getBatchTravelTimes([origin], [destination]);
    return time[0];
  }

  async getTravelDistance(
    origin: [number, number],
    destination: [number, number]
  ): Promise<number> {
    const [[distance]] = await this.getBatchTravelDistances([origin], [destination]);
    return distance;
  }

  async getBatchTravelTimes(
    origins: [number, number][],
    destinations: [number, number][]
  ): Promise<number[][]> {
    const matrix = await this.requestMatrix(origins, destinations);
    return matrix.sources_to_targets.map((row) =>
      row.map((element) => toPracticalPlanningMinutes(element.time / 60))
    );
  }

  private async getBatchTravelDistances(
    origins: [number, number][],
    destinations: [number, number][]
  ): Promise<number[][]> {
    const matrix = await this.requestMatrix(origins, destinations);
    return matrix.sources_to_targets.map((row) =>
      row.map((element) => Math.round(element.distance / 100) / 10)
    );
  }

  private async requestMatrix(
    origins: [number, number][],
    destinations: [number, number][]
  ): Promise<{
    sources_to_targets: Array<Array<{ distance: number; time: number }>>;
  }> {
    const response = await fetch(`${this.baseUrl}?apiKey=${encodeURIComponent(this.apiKey)}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        mode: "drive",
        traffic: "free_flow",
        sources: origins.map(([latitude, longitude]) => ({ location: [longitude, latitude] })),
        targets: destinations.map(([latitude, longitude]) => ({ location: [longitude, latitude] })),
      }),
    });

    if (!response.ok) {
      throw new Error(`Geoapify Route Matrix failed with status ${response.status}`);
    }

    const data = await response.json();
    if (!Array.isArray(data?.sources_to_targets)) {
      throw new Error("Geoapify Route Matrix returned an invalid response");
    }

    return data;
  }
}

type OsrmMatrixResponse = {
  code?: string;
  message?: string;
  durations?: Array<Array<number | null>>;
  distances?: Array<Array<number | null>>;
};

export class OsrmDistanceProvider implements DistanceProvider {
  private readonly haversine = new HaversineDistanceProvider();

  constructor(private readonly baseUrl = "https://router.project-osrm.org") {}

  async getTravelTime(
    origin: [number, number],
    destination: [number, number]
  ): Promise<number> {
    const [[time]] = await this.getBatchTravelTimes([origin], [destination]);
    return time;
  }

  async getTravelDistance(
    origin: [number, number],
    destination: [number, number]
  ): Promise<number> {
    const response = await this.requestTable([origin], [destination], "distance").catch(() => null);
    const meters = response?.distances?.[0]?.[0];
    if (typeof meters === "number") {
      return Math.round(meters / 100) / 10;
    }
    return this.haversine.getTravelDistance(origin, destination);
  }

  async getBatchTravelTimes(
    origins: [number, number][],
    destinations: [number, number][]
  ): Promise<number[][]> {
    const response = await this.requestTable(origins, destinations, "duration");
    if (!Array.isArray(response.durations)) {
      throw new Error("OSRM Table returned an invalid duration response");
    }

    return response.durations.map((row) =>
      row.map((seconds) => {
        if (typeof seconds !== "number") {
          return Infinity;
        }
        return toPracticalPlanningMinutes(seconds / 60);
      })
    );
  }

  private async requestTable(
    origins: [number, number][],
    destinations: [number, number][],
    annotation: "duration" | "distance"
  ): Promise<OsrmMatrixResponse> {
    const coordinates = [...origins, ...destinations]
      .map(([latitude, longitude]) => `${longitude},${latitude}`)
      .join(";");
    const sourceIndexes = origins.map((_, index) => index).join(";");
    const destinationIndexes = destinations
      .map((_, index) => origins.length + index)
      .join(";");
    const url = new URL(`/table/v1/driving/${coordinates}`, this.baseUrl);
    url.searchParams.set("sources", sourceIndexes);
    url.searchParams.set("destinations", destinationIndexes);
    url.searchParams.set("annotations", annotation);

    const response = await fetch(url.toString());
    if (!response.ok) {
      throw new Error(`OSRM Table failed with status ${response.status}`);
    }

    const data = (await response.json()) as OsrmMatrixResponse;
    if (data.code && data.code !== "Ok") {
      throw new Error(`OSRM Table error: ${data.message ?? data.code}`);
    }
    return data;
  }
}

export function toPracticalPlanningMinutes(rawMinutes: number) {
  const roundedMinutes = Math.max(1, Math.round(rawMinutes));
  return roundedMinutes;
}

export function createConfiguredDistanceProvider(): DistanceProvider {
  const providerName = (process.env.DISTANCE_PROVIDER ?? (process.env.GEOAPIFY_API_KEY ? "geoapify" : "haversine")).toLowerCase();

  if (providerName === "google") {
    const apiKey = process.env.GOOGLE_ROUTES_API_KEY;
    if (!apiKey) {
      throw new Error("GOOGLE_ROUTES_API_KEY is required when DISTANCE_PROVIDER=google");
    }
    return new CachedDistanceProvider(new GoogleDistanceProvider(apiKey));
  }

  if (providerName === "geoapify") {
    const apiKey = process.env.GEOAPIFY_API_KEY;
    if (!apiKey) {
      throw new Error("GEOAPIFY_API_KEY is required when DISTANCE_PROVIDER=geoapify");
    }
    return new CachedDistanceProvider(new GeoapifyDistanceProvider(apiKey));
  }

  if (providerName === "osrm") {
    return new CachedDistanceProvider(new OsrmDistanceProvider(process.env.OSRM_BASE_URL));
  }

  if (providerName !== "haversine") {
    throw new Error(`Unsupported DISTANCE_PROVIDER: ${providerName}`);
  }

  return new CachedDistanceProvider(new HaversineDistanceProvider());
}
