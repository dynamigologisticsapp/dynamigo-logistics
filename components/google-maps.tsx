import { useEffect, useRef, useState } from "react";
import { View, Text, ActivityIndicator } from "react-native";
import { useColors } from "@/hooks/use-colors";

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

interface DriverLocation {
  latitude: number;
  longitude: number;
  accuracy: number;
  heading: number;
  speed: number;
  timestamp: number;
}

interface RouteInfo {
  totalDistance: number; // km
  totalDuration: number; // minutes
  legs: Array<{
    distance: string;
    duration: string;
    startAddress: string;
    endAddress: string;
  }>;
  waypoints?: Array<{ lat: number; lng: number }>; // Route waypoints
}

interface GoogleMapsProps {
  stops: MapStop[];
  driverLocation?: DriverLocation | null;
  routeInfo?: RouteInfo | null;
}

declare global {
  interface Window {
    google?: {
      maps: any;
    };
  }
}

export default function GoogleMapsComponent({ stops, driverLocation, routeInfo }: GoogleMapsProps) {
  const colors = useColors();
  const mapRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<any>(null);
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showDirections, setShowDirections] = useState(false);

  // Load Google Maps script once on component mount
  useEffect(() => {
    const apiKey = process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY || "AIzaSyCQurCbQ2iQ0m2zGvnrHxU3EDt7frwFDUw";
    
    if (!apiKey) {
      setError("Google Maps API key not configured");
      setLoaded(true);
      return;
    }
    
    console.log("Loading Google Maps with API key...");

    // Check if script already exists
    const existingScript = document.querySelector('script[src*="maps.googleapis.com"]');
    if (existingScript) {
      if (window.google?.maps) {
        setLoaded(true);
      }
      return;
    }

    // Create and load script
    const script = document.createElement("script");
    script.src = `https://maps.googleapis.com/maps/api/js?key=${apiKey}`;
    script.async = true;
    script.defer = true;

    script.onload = () => {
      console.log("Google Maps script loaded successfully");
      console.log("window.google available:", typeof window.google !== 'undefined');
      setLoaded(true);
    };

    script.onerror = (error) => {
      console.error("Failed to load Google Maps script:", error);
      console.error("Script src was:", script.src);
      setError("Failed to load Google Maps. Check console for details.");
      setLoaded(true);
    };

    document.head.appendChild(script);

    return () => {
      // Cleanup is optional - we keep the script loaded for performance
    };
  }, []); // Empty dependency array - only load script once

  // Initialize map when stops change and script is loaded
  useEffect(() => {
    if (!loaded || !mapRef.current) {
      return;
    }

    initMap();
  }, [loaded, stops, driverLocation, routeInfo]); // Re-initialize when stops or driver location changes

  const initMap = () => {
    if (!mapRef.current) {
      console.warn("Map container not found");
      return;
    }

    if (!window.google?.maps) {
      console.warn("Google Maps API not available");
      setTimeout(() => initMap(), 100);
      return;
    }

    try {
      // Clear existing map if it exists
      if (mapInstanceRef.current) {
        // Remove all markers and polylines by clearing the map
        mapInstanceRef.current.setCenter({ lat: 0, lng: 0 });
      }

      // Default center (London)
      const center = stops.length > 0 
        ? { lat: stops[0].latitude, lng: stops[0].longitude }
        : { lat: 51.5074, lng: -0.1278 };

      const map = new window.google.maps.Map(mapRef.current, {
        zoom: 13,
        center,
        mapTypeId: "roadmap",
        disableDefaultUI: true,
        zoomControl: false,
        mapTypeControl: false,
        streetViewControl: false,
        fullscreenControl: false,
        keyboardShortcuts: false,
      });

      mapInstanceRef.current = map;

      // Add markers for each stop
      stops.forEach((stop, index) => {
        const color = getMarkerColor(stop.type);
        
        const marker = new window.google!.maps.Marker({
          position: { lat: stop.latitude, lng: stop.longitude },
          map,
          icon: {
            path: window.google!.maps.SymbolPath.CIRCLE,
            scale: 10,
            fillColor: color,
            fillOpacity: 1,
            strokeColor: "#fff",
            strokeWeight: 2,
          },
          label: {
            text: String(index + 1),
            color: "#fff",
            fontSize: "12px",
            fontWeight: "bold",
          },
          title: `${index + 1}. ${stop.label}`,
        });

        const infoWindow = new window.google!.maps.InfoWindow({
          content: `
            <div style="padding: 8px; font-size: 12px; max-width: 200px; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;">
              <strong>${index + 1}. ${stop.label}</strong><br/>
              <small style="color: #666;">${stop.type}</small><br/>
              <small style="color: #666;">${stop.addressLine}</small><br/>
              <small style="color: #666;">Status: ${stop.status}</small>
            </div>
          `,
        });

        marker.addListener("click", () => {
          infoWindow.open(map, marker);
        });
      });

      // Add polyline for the optimized route
      if (routeInfo?.waypoints && routeInfo.waypoints.length > 0) {
        // Use actual route waypoints from Google Directions API
        new window.google!.maps.Polyline({
          path: routeInfo.waypoints,
          geodesic: true,
          strokeColor: "#0a7ea4",
          strokeOpacity: 0.8,
          strokeWeight: 4,
          map,
        });
      } else if (stops.length > 1) {
        // Fallback: simple polyline connecting stops
        const polylinePath = stops.map((s) => ({
          lat: s.latitude,
          lng: s.longitude,
        }));

        new window.google!.maps.Polyline({
          path: polylinePath,
          geodesic: true,
          strokeColor: "#0a7ea4",
          strokeOpacity: 0.7,
          strokeWeight: 3,
          map,
        });
      }

      // Add driver location marker
      if (driverLocation) {
        new window.google!.maps.Marker({
          position: {
            lat: driverLocation.latitude,
            lng: driverLocation.longitude,
          },
          map,
          icon: {
            path: window.google.maps.SymbolPath.FORWARD_CLOSED_ARROW,
            scale: 6,
            fillColor: "#FF5722",
            fillOpacity: 1,
            strokeColor: "#fff",
            strokeWeight: 2,
            rotation: driverLocation.heading || 0,
          },
          title: "Driver Location",
        });
      }

      // Fit bounds to show all stops
      if (stops.length > 0) {
        const bounds = new window.google!.maps.LatLngBounds();
        stops.forEach((stop) => {
          bounds.extend({ lat: stop.latitude, lng: stop.longitude });
        });
        map.fitBounds(bounds, { top: 50, right: 50, bottom: 50, left: 50 });
      }

      console.log("Map initialized successfully");
    } catch (err) {
      console.error("Error initializing map:", err);
      setError("Error initializing map");
    }
  };

  const getMarkerColor = (type: string): string => {
    const colorMap: Record<string, string> = {
      helper: "#FF9800",
      "helper-dropoff": "#FF9800",
      home: "#10B981",
      unit: "#757575",
      pickup: "#00BCD4",
      delivery: "#9C27B0",
    };
    return colorMap[type] || "#9C27B0";
  };

  if (error) {
    return (
      <View style={{ flex: 1, justifyContent: "center", alignItems: "center", padding: 16 }}>
        <Text style={{ color: colors.error, textAlign: "center", marginBottom: 8 }}>
          {error}
        </Text>
        <Text style={{ color: colors.muted, fontSize: 12, textAlign: "center" }}>
          Check the browser console for more details
        </Text>
      </View>
    );
  }

  if (!loaded) {
    return (
      <View style={{ flex: 1, justifyContent: "center", alignItems: "center" }}>
        <ActivityIndicator size="large" color={colors.primary} />
        <Text style={{ marginTop: 12, color: colors.muted }}>Loading map...</Text>
      </View>
    );
  }

  const handleShowDirections = () => {
    setShowDirections(!showDirections);
  };

  return (
    <div style={{ position: "relative", width: "100%", height: "100%" }}>
      <div
        ref={mapRef}
        style={{
          width: "100%",
          height: "100%",
          borderRadius: 8,
          overflow: "hidden",
        }}
      />
      {routeInfo && stops.length > 1 && (
        <div
          style={{
            position: "absolute",
            bottom: 16,
            right: 16,
            background: "white",
            padding: "12px 16px",
            borderRadius: 8,
            boxShadow: "0 2px 8px rgba(0,0,0,0.15)",
            fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
            fontSize: 14,
            cursor: "pointer",
            zIndex: 10,
          }}
          onClick={handleShowDirections}
        >
          <div style={{ fontWeight: 600, marginBottom: 4, color: "#0a7ea4" }}>📍 Route Info</div>
          <div style={{ fontSize: 12, color: "#666" }}>
            {routeInfo.totalDistance} km • {routeInfo.totalDuration} min
          </div>
        </div>
      )}
      {showDirections && routeInfo && (
        <div
          style={{
            position: "absolute",
            top: 16,
            left: 16,
            background: "white",
            padding: "16px",
            borderRadius: 8,
            boxShadow: "0 2px 8px rgba(0,0,0,0.15)",
            fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
            maxWidth: 300,
            maxHeight: 400,
            overflowY: "auto",
            zIndex: 11,
          }}
        >
          <div style={{ fontWeight: 600, marginBottom: 12, fontSize: 16, color: "#0a7ea4" }}>
            Turn-by-Turn Directions
          </div>
          {routeInfo.legs.map((leg, idx) => (
            <div key={idx} style={{ marginBottom: 12, paddingBottom: 12, borderBottom: "1px solid #eee" }}>
              <div style={{ fontWeight: 600, fontSize: 12, color: "#333", marginBottom: 4 }}>
                Leg {idx + 1}
              </div>
              <div style={{ fontSize: 11, color: "#666", marginBottom: 4 }}>
                {leg.startAddress} → {leg.endAddress}
              </div>
              <div style={{ fontSize: 12, color: "#0a7ea4" }}>
                {leg.distance} • {leg.duration}
              </div>
            </div>
          ))}
          <button
            onClick={() => setShowDirections(false)}
            style={{
              width: "100%",
              padding: "8px 12px",
              background: "#0a7ea4",
              color: "white",
              border: "none",
              borderRadius: 4,
              cursor: "pointer",
              fontSize: 12,
              fontWeight: 600,
            }}
          >
            Close
          </button>
        </div>
      )}
    </div>
  );
}
