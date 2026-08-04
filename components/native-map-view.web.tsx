import LeafletMap from "@/components/leaflet-map";

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
}

export function NativeMapView({ stops }: NativeMapViewProps) {
  return <LeafletMap stops={stops} />;
}
