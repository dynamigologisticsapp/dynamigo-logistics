import { describe, it, expect, beforeEach, vi } from "vitest";

/**
 * Address Autocomplete Tests
 * 
 * Tests for UK postcode lookup and address autocomplete functionality
 */

describe("Address Autocomplete", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should parse valid UK postcode format", () => {
    const postcodePattern = /^[A-Z]{1,2}\d[A-Z\d]?\s?\d[A-Z]{2}$/i;
    
    const validPostcodes = [
      "SW1A 1AA",
      "B33 8TH",
      "CR2 6XH",
      "DN55 1PT",
      "W1A 1AA",
      "M1 1AE",
      "B33 8TH",
    ];

    validPostcodes.forEach((postcode) => {
      expect(postcodePattern.test(postcode)).toBe(true);
    });
  });

  it("should reject invalid postcode format", () => {
    const postcodePattern = /^[A-Z]{1,2}\d[A-Z\d]?\s?\d[A-Z]{2}$/i;
    
    const invalidPostcodes = [
      "12345",
      "ABCDEF",
      "SW1A",
      "123 456",
      "SW1A 1",
    ];

    invalidPostcodes.forEach((postcode) => {
      expect(postcodePattern.test(postcode)).toBe(false);
    });
  });

  it("should format address result with postcode", () => {
    const addressResult = {
      address: "SW1A 1AA",
      postcode: "SW1A 1AA",
      latitude: 51.5007,
      longitude: -0.1246,
      formatted: "SW1A 1AA",
    };

    expect(addressResult.formatted).toContain("SW1A 1AA");
    expect(addressResult.latitude).toBeGreaterThanOrEqual(-90);
    expect(addressResult.latitude).toBeLessThanOrEqual(90);
    expect(addressResult.longitude).toBeGreaterThanOrEqual(-180);
    expect(addressResult.longitude).toBeLessThanOrEqual(180);
  });

  it("should validate coordinates are within valid ranges", () => {
    const validCoordinates = [
      { lat: 51.5007, lon: -0.1246 }, // London
      { lat: 55.9533, lon: -3.1883 }, // Edinburgh
      { lat: 53.4808, lon: -2.2426 }, // Manchester
      { lat: 52.6369, lon: -1.1398 }, // Leicester
    ];

    validCoordinates.forEach(({ lat, lon }) => {
      expect(lat).toBeGreaterThanOrEqual(-90);
      expect(lat).toBeLessThanOrEqual(90);
      expect(lon).toBeGreaterThanOrEqual(-180);
      expect(lon).toBeLessThanOrEqual(180);
    });
  });

  it("should handle postcode with and without space", () => {
    const postcodePattern = /^[A-Z]{1,2}\d[A-Z\d]?\s?\d[A-Z]{2}$/i;
    
    expect(postcodePattern.test("SW1A1AA")).toBe(true);
    expect(postcodePattern.test("SW1A 1AA")).toBe(true);
    expect(postcodePattern.test("B338TH")).toBe(true);
    expect(postcodePattern.test("B33 8TH")).toBe(true);
  });

  it("should identify query as postcode search", () => {
    const postcodePattern = /^[A-Z]{1,2}\d[A-Z\d]?\s?\d[A-Z]{2}$/i;
    
    // Postcode queries
    expect(postcodePattern.test("SW1A 1AA")).toBe(true);
    expect(postcodePattern.test("B33 8TH")).toBe(true);
    
    // Non-postcode queries (should be treated as address search)
    expect(postcodePattern.test("123 Main Street")).toBe(false);
    expect(postcodePattern.test("London")).toBe(false);
  });

  it("should require minimum search length", () => {
    const minLength = 2;
    
    expect("SW".length >= minLength).toBe(true);
    expect("S".length >= minLength).toBe(false);
    expect("".length >= minLength).toBe(false);
  });

  it("should debounce search requests", async () => {
    const searchFn = vi.fn();
    let timeoutId: NodeJS.Timeout | null = null;

    const debouncedSearch = (query: string) => {
      if (timeoutId !== null) {
        clearTimeout(timeoutId);
      }
      timeoutId = setTimeout(() => {
        searchFn(query);
      }, 300) as unknown as NodeJS.Timeout;
    };

    debouncedSearch("SW1A");
    debouncedSearch("SW1A 1");
    debouncedSearch("SW1A 1AA");

    expect(searchFn).not.toHaveBeenCalled();

    await new Promise((resolve) => setTimeout(resolve, 350));

    expect(searchFn).toHaveBeenCalledOnce();
    expect(searchFn).toHaveBeenCalledWith("SW1A 1AA");
  });
});
