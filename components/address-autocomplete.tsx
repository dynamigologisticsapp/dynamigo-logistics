import React, { useState } from "react";
import { TextInput, StyleSheet } from "react-native";
import { useColors } from "@/hooks/use-colors";

export interface AddressResult {
  address: string;
  postcode: string;
  latitude: number;
  longitude: number;
  formatted: string;
}

interface AddressAutocompleteProps {
  value: string;
  onChangeText: (text: string) => void;
  onSelectAddress?: (address: AddressResult) => void;
  placeholder?: string;
  style?: any;
}

const styles = StyleSheet.create({
  input: {
    borderWidth: 1,
    borderRadius: 6,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
  },
});

/**
 * Address Autocomplete Component
 * 
 * Simple address input that accepts postcodes and addresses.
 * Can be extended with autocomplete dropdown in future.
 */
export function AddressAutocomplete({
  value,
  onChangeText,
  placeholder = "Search address or postcode",
  style,
}: AddressAutocompleteProps) {
  const colors = useColors();

  return (
    <TextInput
      style={[
        styles.input,
        {
          borderColor: colors.border,
          color: colors.foreground,
          backgroundColor: colors.background,
        },
        style,
      ]}
      placeholder={placeholder}
      placeholderTextColor={colors.muted}
      value={value}
      onChangeText={onChangeText || (() => {})}
      editable={true}
    />
  );
}
