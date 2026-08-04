/**
 * Geocoding utility for converting addresses to coordinates
 * Uses Google Maps Geocoding API
 */

interface GeocodeResult {
  latitude: number;
  longitude: number;
  formattedAddress: string;
}

const GEOCODING_CACHE: Map<string, GeocodeResult> = new Map();

export async function geocodeAddress(address: string, postcode: string): Promise<GeocodeResult | null> {
  const cacheKey = `${address},${postcode}`;
  
  // Check cache first
  if (GEOCODING_CACHE.has(cacheKey)) {
    console.log(`[GEOCODE] Cache hit for: ${address}`);
    return GEOCODING_CACHE.get(cacheKey)!;
  }

  try {
    // Build full address: if postcode exists, append it; otherwise just use address
    const fullAddress = postcode ? `${address}, ${postcode}` : address;
    const apiKey = process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY;
    
    console.log(`[GEOCODE] Starting geocoding for: ${fullAddress}`);
    
    if (!apiKey) {
      console.warn("[GEOCODE] Google Maps API key not configured");
      return null;
    }

    const response = await fetch(
      `https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(fullAddress)}&key=${apiKey}`
    );

    const data = await response.json();
    console.log(`[GEOCODE] Response status:`, data.status);

    if (data.results && data.results.length > 0) {
      const result = data.results[0];
      const geocoded: GeocodeResult = {
        latitude: result.geometry.location.lat,
        longitude: result.geometry.location.lng,
        formattedAddress: result.formatted_address,
      };

      console.log(`[GEOCODE] Success: ${fullAddress} -> (${geocoded.latitude}, ${geocoded.longitude})`);
      // Cache the result
      GEOCODING_CACHE.set(cacheKey, geocoded);
      return geocoded;
    }

    console.warn(`[GEOCODE] No geocoding results for: ${fullAddress}`);
    return null;
  } catch (error) {
    console.error("[GEOCODE] Geocoding error:", error);
    return null;
  }
}

export function clearGeocodeCache() {
  GEOCODING_CACHE.clear();
}
