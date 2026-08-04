import React, { useState, useRef, useCallback } from "react";
import { useColors } from "@/hooks/use-colors";

export interface AddressOption {
  address: string;
  postcode: string;
  town: string;
  latitude: number;
  longitude: number;
  placeId?: string;
}

interface AddressSearchWebProps {
  value: string;
  onChangeText: (text: string) => void;
  onSelectAddress: (address: AddressOption) => void;
  placeholder?: string;
  style?: React.CSSProperties;
}

/**
 * Web-specific Address Search Component
 * Uses plain HTML dropdown (not datalist) for better compatibility
 */
export function AddressSearchWeb({
  value,
  onChangeText,
  onSelectAddress,
  placeholder = "Search address or postcode",
  style,
}: AddressSearchWebProps) {
  const colors = useColors();
  const [suggestions, setSuggestions] = useState<AddressOption[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [showDropdown, setShowDropdown] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const searchTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  /**
   * Search UK addresses using backend API
   */
  const searchAddresses = useCallback(
    async (query: string): Promise<void> => {
      if (query.length < 2) {
        setSuggestions([]);
        setShowDropdown(false);
        setError(null);
        setIsLoading(false);
        return;
      }

      try {
        setIsLoading(true);
        setError(null);

        // Use absolute URL pointing to API server on port 3000
        const apiUrl = `${window.location.protocol}//${window.location.hostname}:3000/api/search-addresses`;
        const response = await fetch(apiUrl, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ query }),
        });

        if (!response.ok) {
          throw new Error(`API error: ${response.status}`);
        }

        const data = await response.json();

        if (data.success && data.addresses) {
          setSuggestions(data.addresses);
          setShowDropdown(true);

          if (data.addresses.length === 0) {
            setError(
              "No addresses found. Try a different search term or postcode."
            );
          }
        } else {
          setError(data.error || "Failed to search addresses");
          setSuggestions([]);
        }
      } catch (err) {
        console.error("[AddressSearchWeb] Error:", err);
        setError("Failed to search addresses. Please check your connection.");
        setSuggestions([]);
      } finally {
        setIsLoading(false);
      }
    },
    []
  );

  /**
   * Handle text input change
   */
  const handleChangeText = useCallback(
    (text: string) => {
      onChangeText(text);

      if (searchTimeoutRef.current !== null) {
        clearTimeout(searchTimeoutRef.current);
      }

      if (text.length < 2) {
        setSuggestions([]);
        setShowDropdown(false);
        setError(null);
        return;
      }

      setIsLoading(true);
      searchTimeoutRef.current = setTimeout((): void => {
        searchAddresses(text);
      }, 500) as unknown as NodeJS.Timeout;
    },
    [onChangeText, searchAddresses]
  );

  const handleSelectAddress = useCallback(
    (address: AddressOption) => {
      const displayText = `${address.address}, ${address.postcode}${address.town ? `, ${address.town}` : ""}`;
      onChangeText(displayText);
      onSelectAddress(address);
      setSuggestions([]);
      setShowDropdown(false);
      setError(null);
    },
    [onChangeText, onSelectAddress]
  );

  return (
    <div
      ref={containerRef}
      style={{
        position: "relative",
        width: "100%",
      }}
    >
      <input
        type="text"
        placeholder={placeholder}
        value={value}
        onChange={(e) => handleChangeText(e.currentTarget.value)}
        onFocus={() => {
          if (suggestions.length > 0) {
            setShowDropdown(true);
          }
        }}
        onBlur={() => {
          setTimeout(() => setShowDropdown(false), 200);
        }}
        style={{
          width: "100%",
          boxSizing: "border-box",
          border: `1px solid ${colors.border}`,
          borderRadius: "6px",
          padding: "10px 12px",
          fontSize: "14px",
          color: colors.foreground,
          backgroundColor: colors.background,
          fontFamily: "inherit",
          ...style,
        }}
      />

      {showDropdown && (
        <ul
          style={{
            marginTop: "4px",
            border: `1px solid ${colors.border}`,
            borderRadius: "6px",
            maxHeight: "300px",
            overflow: "auto",
            backgroundColor: colors.background,
            position: "absolute",
            top: "100%",
            left: 0,
            right: 0,
            zIndex: 1000,
            boxShadow: "0 2px 8px rgba(0, 0, 0, 0.1)",
            listStyle: "none",
            padding: 0,
            margin: "4px 0 0 0",
          }}
        >
          {isLoading ? (
            <li
              style={{
                padding: "10px 12px",
                textAlign: "center",
                color: colors.muted,
              }}
            >
              Searching...
            </li>
          ) : error ? (
            <li
              style={{
                padding: "10px 12px",
                fontSize: "12px",
                color: colors.error,
              }}
            >
              {error}
            </li>
          ) : suggestions.length > 0 ? (
            suggestions.map((item, index) => (
              <li
                key={item.placeId || `${item.postcode}-${index}`}
                onClick={() => handleSelectAddress(item)}
                style={{
                  padding: "12px",
                  borderBottom: `1px solid ${colors.border}`,
                  cursor: "pointer",
                  backgroundColor: colors.background,
                  transition: "background-color 0.2s",
                }}
                onMouseEnter={(e) => {
                  (e.currentTarget as HTMLLIElement).style.backgroundColor =
                    colors.surface;
                }}
                onMouseLeave={(e) => {
                  (e.currentTarget as HTMLLIElement).style.backgroundColor =
                    colors.background;
                }}
              >
                <div
                  style={{
                    fontSize: "14px",
                    fontWeight: "500",
                    color: colors.foreground,
                  }}
                >
                  {item.address}
                </div>
                <div
                  style={{
                    fontSize: "12px",
                    marginTop: "2px",
                    color: colors.muted,
                  }}
                >
                  {item.postcode}
                  {item.town ? `, ${item.town}` : ""}
                </div>
              </li>
            ))
          ) : null}
        </ul>
      )}
    </div>
  );
}
