import React from "react";
import { View, Text } from "react-native";
import { ScreenContainer } from "@/components/screen-container";

interface MapStop {
  id: string;
  label: string;
  latitude: number;
  longitude: number;
  type: "pickup" | "delivery" | "helper" | "helper-dropoff" | "home" | "unit" | "start";
  status: string;
  addressLine: string;
  index: number;
}

interface NativeMapProps {
  stops: MapStop[];
}

// Web fallback - use Leaflet map instead
export default function NativeMapWeb({ stops }: NativeMapProps) {
  // Dynamically import Leaflet map for web
  const LeafletMap = React.lazy(() =>
    import("@/components/leaflet-map").then((m) => ({ default: m.default }))
  );

  return (
    <React.Suspense
      fallback={
        <ScreenContainer className="items-center justify-center">
          <Text>Loading map...</Text>
        </ScreenContainer>
      }
    >
      <LeafletMap stops={stops} />
    </React.Suspense>
  );
}
