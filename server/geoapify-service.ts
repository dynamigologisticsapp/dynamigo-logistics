const GEOAPIFY_BASE_URL = "https://api.geoapify.com/v1/geocode";

export interface GeoapifyAddress {
  address: string;
  postcode: string;
  town: string;
  latitude: number;
  longitude: number;
  formatted: string;
  placeId?: string;
}

interface GeoapifyResult {
  address_line1?: string;
  city?: string;
  county?: string;
  formatted?: string;
  lat?: number;
  lon?: number;
  place_id?: string;
  postcode?: string;
  town?: string;
  village?: string;
}

interface GeoapifyResponse {
  results?: GeoapifyResult[];
}

export interface AddressProvider {
  autocomplete(query: string, limit?: number): Promise<GeoapifyAddress[]>;
  geocode(address: string): Promise<GeoapifyAddress | null>;
}

function compactAddress(parts: {
  line1?: string;
  formatted: string;
  postcode?: string;
  town?: string;
}) {
  const line1 = parts.line1?.trim() || parts.formatted.split(",")[0]?.trim() || parts.formatted;
  const town = parts.town?.trim() || "";
  const postcode = parts.postcode?.trim().toUpperCase() || "";
  return [line1, town, postcode].filter(Boolean).join(", ");
}

function getTypedDoorNumber(query: string) {
  const match = query.trim().match(/^(\d+)\s*([a-z])\b/i);
  if (!match) return null;

  return {
    full: `${match[1]}${match[2]}`,
    number: match[1],
  };
}

function applyTypedDoorNumber(line: string, query: string) {
  const typedDoor = getTypedDoorNumber(query);
  const trimmedLine = line.trim();
  if (!typedDoor || !trimmedLine) return trimmedLine;
  if (trimmedLine.toLowerCase().startsWith(typedDoor.full.toLowerCase())) return trimmedLine;

  const matchingNumber = new RegExp(`^${typedDoor.number}(?:\\s*[a-z])?\\b`, "i");
  if (matchingNumber.test(trimmedLine)) {
    return trimmedLine.replace(matchingNumber, typedDoor.full);
  }

  return trimmedLine;
}

function preserveTypedDoorNumber(address: GeoapifyAddress, query: string): GeoapifyAddress {
  const line1 = applyTypedDoorNumber(address.address, query);
  if (line1 === address.address) return address;

  return {
    ...address,
    address: line1,
    formatted: compactAddress({
      line1,
      formatted: address.formatted,
      postcode: address.postcode,
      town: address.town,
    }),
  };
}

function mapResult(result: GeoapifyResult): GeoapifyAddress | null {
  const latitude = Number(result.lat);
  const longitude = Number(result.lon);
  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) {
    return null;
  }

  const sourceFormatted = result.formatted?.trim() || result.address_line1?.trim() || "";
  if (!sourceFormatted) {
    return null;
  }
  const town =
    result.city?.trim() ||
    result.town?.trim() ||
    result.village?.trim() ||
    result.county?.trim() ||
    "";
  const formatted = compactAddress({
    line1: result.address_line1,
    formatted: sourceFormatted,
    postcode: result.postcode,
    town,
  });

  return {
    address: result.address_line1?.trim() || formatted.split(",")[0]?.trim() || formatted,
    postcode: result.postcode?.trim() || "",
    town,
    latitude,
    longitude,
    formatted,
    placeId: result.place_id,
  };
}

async function requestGeoapify(
  path: "autocomplete" | "search",
  text: string,
  limit: number,
  apiKey?: string,
): Promise<GeoapifyAddress[]> {
  const key = apiKey ?? process.env.GEOAPIFY_API_KEY;
  if (!key) {
    throw new Error("GEOAPIFY_API_KEY is not configured");
  }

  const params = new URLSearchParams({
    text,
    format: "json",
    filter: "countrycode:gb",
    bias: "rect:-8.65,54.55,-0.7,60.9",
    lang: "en",
    limit: String(limit),
    apiKey: key,
  });
  const response = await fetch(`${GEOAPIFY_BASE_URL}/${path}?${params}`);

  if (!response.ok) {
    throw new Error(`Geoapify request failed with status ${response.status}`);
  }

  const data = (await response.json()) as GeoapifyResponse;
  return (data.results ?? [])
    .map(mapResult)
    .filter((result): result is GeoapifyAddress => result !== null)
    .map((result) => preserveTypedDoorNumber(result, text));
}

export class GeoapifyAddressProvider implements AddressProvider {
  constructor(private readonly apiKey?: string) {}

  async autocomplete(query: string, limit = 10) {
    const normalizedQuery = query.trim();
    if (normalizedQuery.length < 2) {
      return [];
    }
    return requestGeoapify("autocomplete", normalizedQuery, limit, this.apiKey);
  }

  async geocode(address: string) {
    const normalizedAddress = address.trim();
    if (!normalizedAddress) {
      return null;
    }
    const results = await requestGeoapify("search", normalizedAddress, 1, this.apiKey);
    return results[0] ?? null;
  }
}

export function createGeoapifyAddressProvider(apiKey?: string) {
  return new GeoapifyAddressProvider(apiKey);
}
