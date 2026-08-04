import { afterEach, describe, expect, it, vi } from "vitest";
import { GeoapifyAddressProvider } from "./geoapify-service";

describe("GeoapifyAddressProvider", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("maps UK autocomplete results into the app address shape", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        results: [
          {
            address_line1: "10 Leith Street",
            city: "Edinburgh",
            postcode: "EH1 3AT",
            lat: 55.956,
            lon: -3.185,
            formatted: "10 Leith Street, Edinburgh, EH1 3AT, United Kingdom",
            place_id: "geoapify-place-1",
          },
        ],
      }),
    });
    vi.stubGlobal("fetch", fetchMock);

    const provider = new GeoapifyAddressProvider("test-key");
    const results = await provider.autocomplete("10 Leith Street");

    expect(results).toEqual([
      {
        address: "10 Leith Street",
        postcode: "EH1 3AT",
        town: "Edinburgh",
        latitude: 55.956,
        longitude: -3.185,
        formatted: "10 Leith Street, Edinburgh, EH1 3AT",
        placeId: "geoapify-place-1",
      },
    ]);

    const requestUrl = new URL(fetchMock.mock.calls[0][0]);
    expect(requestUrl.pathname).toBe("/v1/geocode/autocomplete");
    expect(requestUrl.searchParams.get("filter")).toBe("countrycode:gb");
    expect(requestUrl.searchParams.get("bias")).toBe("rect:-8.65,54.55,-0.7,60.9");
    expect(requestUrl.searchParams.get("apiKey")).toBe("test-key");
  });

  it("keeps typed lettered door numbers when the provider only returns the base number", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        results: [
          {
            address_line1: "11 Union Street",
            town: "Carluke",
            postcode: "ML8 4AJ",
            lat: 55.735,
            lon: -3.839,
            formatted: "11 Union Street, Carluke, ML8 4AJ, United Kingdom",
            place_id: "geoapify-place-11",
          },
        ],
      }),
    });
    vi.stubGlobal("fetch", fetchMock);

    const provider = new GeoapifyAddressProvider("test-key");
    const results = await provider.autocomplete("11d Union Street, Carluke, ML8 4AJ");

    expect(results[0]).toMatchObject({
      address: "11d Union Street",
      formatted: "11d Union Street, Carluke, ML8 4AJ",
    });
  });

  it("uses forward geocoding and returns the best result", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          results: [
            {
              address_line1: "1 High Street",
              town: "Falkirk",
              postcode: "FK1 1AA",
              lat: 56.001,
              lon: -3.784,
              formatted: "1 High Street, Falkirk, FK1 1AA, United Kingdom",
            },
          ],
        }),
      }),
    );

    const result = await new GeoapifyAddressProvider("test-key").geocode("1 High Street, Falkirk");
    expect(result?.latitude).toBe(56.001);
    expect(result?.longitude).toBe(-3.784);
    expect(result?.postcode).toBe("FK1 1AA");
  });

  it("does not call Geoapify for a short autocomplete query", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    const results = await new GeoapifyAddressProvider("test-key").autocomplete("a");

    expect(results).toEqual([]);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("requires a Geoapify API key for autocomplete", async () => {
    const originalKey = process.env.GEOAPIFY_API_KEY;
    delete process.env.GEOAPIFY_API_KEY;
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    try {
      await expect(new GeoapifyAddressProvider().autocomplete("Edinburgh")).rejects.toThrow(
        "GEOAPIFY_API_KEY is not configured",
      );
      expect(fetchMock).not.toHaveBeenCalled();
    } finally {
      if (originalKey) {
        process.env.GEOAPIFY_API_KEY = originalKey;
      }
    }
  });
});
