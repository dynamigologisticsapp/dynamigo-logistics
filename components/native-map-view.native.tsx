import NativeMap from "@/components/native-map";

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

interface NativeMapViewProps {
  stops: MapStop[];
  driverLocation?: {
    latitude: number;
    longitude: number;
    accuracy: number;
    heading: number;
    speed: number;
    timestamp: number;
  } | null;
}

export function NativeMapView({ stops, driverLocation }: NativeMapViewProps) {
  return <NativeMap stops={stops} driverLocation={driverLocation} />;
}
