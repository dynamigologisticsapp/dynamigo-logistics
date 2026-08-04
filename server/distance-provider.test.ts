import { afterEach, describe, expect, it, vi } from "vitest";
import {
  GeoapifyDistanceProvider,
  OsrmDistanceProvider,
  toPracticalPlanningMinutes,
} from "./distance-provider";

describe("GeoapifyDistanceProvider", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("uses Geoapify route matrix travel time in minutes", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        sources_to_targets: [
          [{ distance: 12000, time: 1800, source_index: 0, target_index: 0 }],
        ],
      }),
    });
    vi.stubGlobal("fetch", fetchMock);

    const provider = new GeoapifyDistanceProvider("test-key");
    const minutes = await provider.getTravelTime([55.86, -4.25], [56.0, -3.78]);

    expect(minutes).toBe(30);

    const [url, options] = fetchMock.mock.calls[0];
    expect(String(url)).toContain("https://api.geoapify.com/v1/routematrix");
    expect(String(url)).toContain("apiKey=test-key");
    expect(options.method).toBe("POST");
    expect(JSON.parse(options.body)).toMatchObject({
      mode: "drive",
      traffic: "free_flow",
      sources: [{ location: [-4.25, 55.86] }],
      targets: [{ location: [-3.78, 56] }],
    });
  });

  it("uses raw rounded provider timing values", () => {
    expect(toPracticalPlanningMinutes(18)).toBe(18);
    expect(toPracticalPlanningMinutes(30)).toBe(30);
    expect(toPracticalPlanningMinutes(45)).toBe(45);
  });
});

describe("OsrmDistanceProvider", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("uses OSRM table service road duration in minutes", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        code: "Ok",
        durations: [[1800]],
      }),
    });
    vi.stubGlobal("fetch", fetchMock);

    const provider = new OsrmDistanceProvider("https://router.project-osrm.org");
    const minutes = await provider.getTravelTime([55.86, -4.25], [56.0, -3.78]);

    expect(minutes).toBe(30);

    const [url] = fetchMock.mock.calls[0];
    expect(String(url)).toContain("https://router.project-osrm.org/table/v1/driving/");
    expect(String(url)).toContain("-4.25,55.86;-3.78,56");
    expect(String(url)).toContain("sources=0");
    expect(String(url)).toContain("destinations=1");
    expect(String(url)).toContain("annotations=duration");
  });
});
