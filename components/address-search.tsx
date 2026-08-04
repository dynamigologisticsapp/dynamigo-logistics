import { trpc } from "@/lib/trpc";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Keyboard,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";

interface AddressSearchProps {
  value: string;
  onChange: (address: string, postcode: string, latitude?: number, longitude?: number) => void;
  placeholder?: string;
}

interface AddressResult {
  description: string;
  postcode: string;
  latitude?: number;
  longitude?: number;
}

function normaliseResults(searchData: unknown): AddressResult[] {
  const predictions = Array.isArray((searchData as any)?.predictions)
    ? (searchData as any).predictions
    : [];

  return predictions
    .map((prediction: any) => ({
      description: String(prediction.description ?? "").trim(),
      postcode: String(prediction.postcode ?? "").trim(),
      latitude: typeof prediction.latitude === "number" ? prediction.latitude : undefined,
      longitude: typeof prediction.longitude === "number" ? prediction.longitude : undefined,
    }))
    .filter((prediction: AddressResult) => prediction.description.length > 0);
}

function searchError(searchData: unknown) {
  const error = (searchData as any)?.error;
  return typeof error === "string" && error.trim() ? error.trim() : "";
}

function postcodeFromAddress(address: string): string {
  const ukPostcode = address.match(/[A-Z]{1,2}\d[A-Z\d]?\s*\d[A-Z]{2}/i);
  if (ukPostcode?.[0]) return ukPostcode[0].toUpperCase();

  const parts = address.split(",");
  return parts[parts.length - 1]?.trim() ?? "";
}

function hasUkPostcode(address: string) {
  return /[A-Z]{1,2}\d[A-Z\d]?\s*\d[A-Z]{2}/i.test(address);
}

function leadingDoorNumber(value: string) {
  return value.trim().match(/^(\d+[a-zA-Z]?)\b/)?.[1] ?? "";
}

function withTypedDoorNumber(description: string, typedValue: string) {
  const doorNumber = leadingDoorNumber(typedValue);
  if (!doorNumber || description.trim().toLowerCase().startsWith(doorNumber.toLowerCase())) {
    return description;
  }

  const firstComma = description.indexOf(",");
  const firstLine = firstComma === -1 ? description : description.slice(0, firstComma);
  const rest = firstComma === -1 ? "" : description.slice(firstComma);
  const typedDoorMatch = doorNumber.match(/^(\d+)([a-z])$/i);
  if (typedDoorMatch) {
    const matchingNumber = new RegExp(`^${typedDoorMatch[1]}(?:\\s*[a-z])?\\b`, "i");
    if (matchingNumber.test(firstLine.trim())) {
      return `${firstLine.trim().replace(matchingNumber, doorNumber)}${rest}`;
    }
  }

  if (/\d/.test(firstLine)) {
    return description;
  }

  return `${doorNumber} ${firstLine.trim()}${rest}`;
}

export function AddressSearch({
  value,
  onChange,
  placeholder = "Search address or postcode",
}: AddressSearchProps) {
  const [input, setInput] = useState(value);
  const [showDropdown, setShowDropdown] = useState(false);
  const lastAutoCommitRef = useRef("");
  const lastSelectedDescriptionRef = useRef("");

  useEffect(() => {
    setInput(value);
  }, [value]);

  const searchQuery = trpc.system.searchAddresses.useQuery(
    { query: input.trim() },
    {
      enabled: input.trim().length > 2,
      staleTime: 0,
    } as any,
  );

  const addressResults = useMemo(
    () =>
      normaliseResults(searchQuery.data).map((result) => ({
        ...result,
        description: withTypedDoorNumber(result.description, input),
      })),
    [input, searchQuery.data],
  );
  const addressSearchError = searchError(searchQuery.data);
  const shouldShowDropdown = showDropdown && input.trim().length > 2;

  useEffect(() => {
    const bestMatch = addressResults[0];
    if (
      bestMatch &&
      hasUkPostcode(input) &&
      typeof bestMatch.latitude === "number" &&
      typeof bestMatch.longitude === "number"
    ) {
      const commitKey = `${bestMatch.description}|${bestMatch.latitude}|${bestMatch.longitude}`;
      if (lastAutoCommitRef.current === commitKey) {
        return;
      }
      lastAutoCommitRef.current = commitKey;
      const postcode = bestMatch.postcode || postcodeFromAddress(bestMatch.description);
      onChange(bestMatch.description, postcode, bestMatch.latitude, bestMatch.longitude);
    }
  }, [addressResults, input, onChange]);

  const handleChangeText = (nextInput: string) => {
    setInput(nextInput);
    setShowDropdown(nextInput.trim().length > 2);
    if (nextInput === lastSelectedDescriptionRef.current) {
      return;
    }
    onChange(nextInput, "");
  };

  const handleAddressSelect = (address: AddressResult) => {
    const postcode = address.postcode || postcodeFromAddress(address.description);
    lastSelectedDescriptionRef.current = address.description;
    setInput(address.description);
    setShowDropdown(false);
    Keyboard.dismiss();
    onChange(address.description, postcode, address.latitude, address.longitude);
  };

  return (
    <View style={styles.container}>
      <TextInput
        value={input}
        onChangeText={handleChangeText}
        placeholder={placeholder}
        placeholderTextColor="#607086"
        autoCapitalize="words"
        autoCorrect={false}
        returnKeyType="search"
        style={styles.input}
        onFocus={() => {
          if (input.trim().length > 2) {
            setShowDropdown(true);
          }
        }}
        onBlur={() => {
          setTimeout(() => setShowDropdown(false), 400);
        }}
      />

      {shouldShowDropdown ? (
        <View style={styles.dropdown}>
          {searchQuery.isFetching ? (
            <View style={styles.statusRow}>
              <ActivityIndicator size="small" color="#0a7ea4" />
              <Text style={styles.statusText}>Searching addresses...</Text>
            </View>
          ) : null}

          {!searchQuery.isFetching && addressSearchError ? (
            <View style={styles.statusRow}>
              <Text style={styles.statusText}>{addressSearchError}</Text>
            </View>
          ) : null}

          {!searchQuery.isFetching && !addressSearchError && addressResults.length === 0 ? (
            <View style={styles.statusRow}>
              <Text style={styles.statusText}>No addresses found</Text>
            </View>
          ) : null}

          {!searchQuery.isFetching && addressResults.length > 0 ? (
            <ScrollView
              nestedScrollEnabled
              keyboardShouldPersistTaps="always"
              style={styles.results}
            >
              {addressResults.map((result, index) => (
                <Pressable
                  key={`${result.description}-${index}`}
                  hitSlop={8}
                  onPressIn={() => handleAddressSelect(result)}
                  style={({ pressed }) => [
                    styles.resultButton,
                    index === addressResults.length - 1 && styles.lastResultButton,
                    pressed && styles.resultButtonPressed,
                  ]}
                >
                  <Text style={styles.resultText}>{result.description}</Text>
                </Pressable>
              ))}
            </ScrollView>
          ) : null}
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: "relative",
    zIndex: 20,
  },
  input: {
    width: "100%",
    borderWidth: 1,
    borderColor: "#D0D8E3",
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    backgroundColor: "#FFFFFF",
    color: "#11181C",
    fontSize: 16,
    lineHeight: 20,
  },
  dropdown: {
    marginTop: 8,
    maxHeight: 220,
    borderWidth: 1,
    borderColor: "#D0D8E3",
    borderRadius: 12,
    backgroundColor: "#FFFFFF",
    overflow: "hidden",
    shadowColor: "#0F172A",
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.12,
    shadowRadius: 14,
    elevation: 8,
  },
  statusRow: {
    minHeight: 48,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingHorizontal: 12,
  },
  statusText: {
    color: "#607086",
    fontSize: 14,
    fontWeight: "600",
  },
  results: {
    maxHeight: 220,
  },
  resultButton: {
    minHeight: 56,
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: "#E5EAF0",
  },
  lastResultButton: {
    borderBottomWidth: 0,
  },
  resultButtonPressed: {
    backgroundColor: "#EAF3FF",
  },
  resultText: {
    color: "#11181C",
    fontSize: 14,
    lineHeight: 19,
    fontWeight: "700",
  },
});
