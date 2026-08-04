"use client";

import { useEffect, useState } from "react";
import { Platform } from "react-native";
import { ScreenContainer } from "@/components/screen-container";
import { useColors } from "@/hooks/use-colors";
import { useDriverLocation } from "@/hooks/use-driver-location";
import { useStopStatus } from "@/lib/stop-status-context";
import { offlineMapCache } from "@/lib/offline-map-cache";

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

interface LeafletMapProps {
  stops: MapStop[];
  driverLocation?: DriverLocation | null;
}

export default function LeafletMap({ stops, driverLocation }: LeafletMapProps) {
  const colors = useColors();
  const { getStopStatus } = useStopStatus();
  const [mounted, setMounted] = useState(false);
  const [MapContainer, setMapContainer] = useState<any>(null);
  const [TileLayer, setTileLayer] = useState<any>(null);
  const [Marker, setMarker] = useState<any>(null);
  const [Popup, setPopup] = useState<any>(null);
  const [Polyline, setPolyline] = useState<any>(null);
  const [L, setL] = useState<any>(null);
  const [cacheStatus, setCacheStatus] = useState<string>("Ready");
  const [isCaching, setIsCaching] = useState(false);

  // Initialize offline cache and cache map tiles
  const cacheMapTiles = async () => {
    if (!L) return;

    setIsCaching(true);
    setCacheStatus("Caching map tiles...");

    try {
      await offlineMapCache.init();

      // Cache tiles for the route area
      const tileUrls = generateTileUrls(stops, 8); // zoom level 8
      let cached = 0;

      for (const url of tileUrls) {
        try {
          const response = await fetch(url);
          if (response.ok) {
            const blob = await response.blob();
            await offlineMapCache.cacheTile(url, blob);
            cached++;
          }
        } catch (e) {
          // Silently skip failed tiles
        }
      }

      const size = await offlineMapCache.getCacheSize();
      const sizeInMB = (size / (1024 * 1024)).toFixed(2);
      setCacheStatus(`Cached ${cached} tiles (${sizeInMB} MB)`);
    } catch (error) {
      console.error("Error caching map tiles:", error);
      setCacheStatus("Cache failed");
    } finally {
      setIsCaching(false);
    }
  };

  const generateTileUrls = (stops: MapStop[], zoom: number): string[] => {
    const urls: string[] = [];
    const baseUrl = "https://{s}.basemaps.cartocdn.com/light_all";
    const servers = ["a", "b", "c", "d"];

    // Return empty if no stops
    if (stops.length === 0) return urls;

    // Calculate bounding box from stops
    const lats = stops.map((s) => s.latitude);
    const lngs = stops.map((s) => s.longitude);
    const minLat = Math.min(...lats);
    const maxLat = Math.max(...lats);
    const minLng = Math.min(...lngs);
    const maxLng = Math.max(...lngs);

    // Add padding
    const padding = 0.05;
    const paddedMinLat = minLat - padding;
    const paddedMaxLat = maxLat + padding;
    const paddedMinLng = minLng - padding;
    const paddedMaxLng = maxLng + padding;

    // Generate tile coordinates for the bounding box
    for (let lat = paddedMinLat; lat <= paddedMaxLat; lat += 0.5) {
      for (let lng = paddedMinLng; lng <= paddedMaxLng; lng += 0.5) {
        const tile = latLngToTile(lat, lng, zoom);
        servers.forEach((server) => {
          urls.push(
            `${baseUrl.replace("{s}", server)}/${zoom}/${tile.x}/${tile.y}.png`
          );
        });
      }
    }

    return urls;
  };

  const latLngToTile = (lat: number, lng: number, zoom: number) => {
    const n = Math.pow(2, zoom);
    const x = Math.floor(((lng + 180) / 360) * n);
    const y = Math.floor(
      ((1 -
        Math.log(
          Math.tan((lat * Math.PI) / 180) + 1 / Math.cos((lat * Math.PI) / 180)
        ) /
          Math.PI) /
        2) *
        n
    );
    return { x, y };
  };

  useEffect(() => {
    // Only load on client side and web platform
    if (typeof window === "undefined" || Platform.OS !== "web") return;

    Promise.all([
      import("react-leaflet"),
      import("leaflet")
    ]).then(([reactLeaflet, leaflet]: any[]) => {
      setMapContainer(() => reactLeaflet.MapContainer);
      setTileLayer(() => reactLeaflet.TileLayer);
      setMarker(() => reactLeaflet.Marker);
      setPopup(() => reactLeaflet.Popup);
      setPolyline(() => reactLeaflet.Polyline);
      setL(() => leaflet.default);
      
      // Load CSS
      const link = document.createElement("link");
      link.rel = "stylesheet";
      link.href = "https://unpkg.com/leaflet@1.9.4/dist/leaflet.css";
      document.head.appendChild(link);
    }).catch((error) => {
      console.error("Failed to load Leaflet:", error);
    });

    setMounted(true);
  }, []);

  // Auto-cache tiles when component mounts
  useEffect(() => {
    if (mounted && L && stops.length > 0) {
      cacheMapTiles();
    }
  }, [mounted, L, stops.length]);

  if (!mounted || !MapContainer || !L) {
    return (
      <ScreenContainer className="items-center justify-center">
        <div style={{ padding: 20, textAlign: "center" }}>
          <p>Loading map...</p>
        </div>
      </ScreenContainer>
    );
  }

  // Handle empty stops - show empty map centered on UK
  const center: [number, number] = stops.length > 0 
    ? [stops[0].latitude, stops[0].longitude]
    : [54.5973, -3.4360]; // Center of UK

  const polylinePoints = stops.map(
    (stop) => [stop.latitude, stop.longitude] as [number, number]
  );

  // If no stops, show empty map with message
  if (stops.length === 0) {
    return (
      <div
        style={{
          width: "100%",
          height: "100%",
          minHeight: 0,
          display: "flex",
          flexDirection: "column",
          position: "relative",
          overflow: "hidden",
          zIndex: 1,
        }}
      >
        <div
          style={{
            padding: "8px 12px",
            backgroundColor: colors.surface,
            borderBottom: `1px solid ${colors.border}`,
            fontSize: "12px",
            color: colors.muted,
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            position: "relative",
            zIndex: 10,
          }}
        >
          <span>No jobs scheduled - Map Ready</span>
        </div>
        <MapContainer
          center={center}
          zoom={6}
          zoomControl={false}
          style={{ width: "100%", height: "100%", minHeight: 0, flexGrow: 1, position: "relative", zIndex: 0 }}
        >
          <TileLayer
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors, &copy; <a href="https://carto.com/attributions">CARTO</a>'
            url="https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png"
          />
        </MapContainer>
        <div
          style={{
            position: "absolute",
            top: "50%",
            left: "50%",
            transform: "translate(-50%, -50%)",
            backgroundColor: "white",
            padding: "20px 30px",
            borderRadius: "8px",
            boxShadow: "0 2px 8px rgba(0,0,0,0.1)",
            textAlign: "center",
            zIndex: 100,
          }}
        >
          <p
            style={{
              margin: "0 0 10px 0",
              fontSize: "16px",
              fontWeight: "bold",
              color: colors.foreground,
            }}
          >
            📍 No jobs scheduled for this date
          </p>
          <p style={{ margin: "0", fontSize: "14px", color: colors.muted }}>
            Add jobs from the Jobs tab to see them on the map
          </p>
        </div>
      </div>
    );
  }

  // Create custom icons for different stop types with status badges
  const createIcon = (type: string, stopId: string) => {
    const colorMap: Record<string, string> = {
      helper: "#F97316",
      "helper-dropoff": "#F97316",
      home: "#10B981",
      unit: "#475569",
      start: "#2563EB",
      pickup: "#06B6D4",
      delivery: "#A855F7",
    };

    const color = colorMap[type] || "#A855F7";
    
    // Custom marker text/glyph (no emoji)
    const markerText =
      type === "helper"
          ? "H"
        : type === "helper-dropoff"
          ? "HD"
        : type === "unit"
            ? "U"
            : type === "home"
              ? "HM"
            : type === "start"
              ? "S"
              : type === "pickup"
                ? "P"
                : "D";
    const stopStatus = getStopStatus(stopId);

    // Status badge colors
    const statusColors: Record<string, string> = {
      pending: "#9CA3AF",
      "in-progress": "#FBBF24",
      completed: "#34D399",
    };

    const statusColor = statusColors[stopStatus] || "#9CA3AF";
    const statusSymbol =
      stopStatus === "completed"
        ? "✓"
        : stopStatus === "in-progress"
          ? "→"
          : "○";

    return L.divIcon({
      html: `
        <div style="
          position: relative;
          width: 44px;
          height: 44px;
        ">
          <div style="
            background-color: ${color};
            width: 100%;
            height: 100%;
            border-radius: 50%;
            display: flex;
            align-items: center;
            justify-content: center;
            color: white;
            font-weight: bold;
            font-size: 16px;
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            border: 3px solid white;
            box-shadow: 0 2px 8px rgba(0,0,0,0.2);
            letter-spacing: 0;
          ">
            ${markerText}
          </div>
          <div style="
            position: absolute;
            bottom: -2px;
            right: -2px;
            background-color: ${statusColor};
            width: 18px;
            height: 18px;
            border-radius: 50%;
            display: flex;
            align-items: center;
            justify-content: center;
            color: white;
            font-weight: bold;
            font-size: 11px;
            border: 2px solid white;
            box-shadow: 0 1px 4px rgba(0,0,0,0.2);
          ">
            ${statusSymbol}
          </div>
        </div>
      `,
      iconSize: [40, 40],
      iconAnchor: [20, 20],
      popupAnchor: [0, -16],
      className: "custom-marker",
    });
  };

  // Create driver location icon with direction indicator
  const createDriverIcon = () => {
    if (!driverLocation) return null;

    const rotation = driverLocation.heading || 0;
    return L.divIcon({
      html: `
        <div style="
          width: 40px;
          height: 40px;
          position: relative;
          transform: rotate(${rotation}deg);
        ">
          <div style="
            width: 100%;
            height: 100%;
            background: linear-gradient(to top, #3B82F6, #1E40AF);
            border-radius: 50%;
            border: 3px solid white;
            box-shadow: 0 2px 8px rgba(0,0,0,0.3), inset 0 0 0 2px #3B82F6;
            display: flex;
            align-items: center;
            justify-content: center;
            color: white;
            font-weight: bold;
            font-size: 16px;
          ">
            ▲
          </div>
        </div>
      `,
      iconSize: [40, 40],
      iconAnchor: [20, 20],
      popupAnchor: [0, -20],
      className: "driver-marker",
    });
  };

  return (
    <div
      style={{
        width: "100%",
        height: "100%",
        minHeight: 0,
        display: "flex",
        flexDirection: "column",
        position: "relative",
        overflow: "hidden",
        zIndex: 1,
      }}
    >
      {/* Cache status bar */}
      <div
        style={{
          padding: "8px 12px",
          backgroundColor: colors.surface,
          borderBottom: `1px solid ${colors.border}`,
          fontSize: "12px",
          color: colors.muted,
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          position: "relative",
          zIndex: 10,
        }}
      >
        <span>{cacheStatus} (Positron Theme)</span>
        {!isCaching && (
          <button
            onClick={cacheMapTiles}
            style={{
              padding: "4px 8px",
              backgroundColor: colors.primary,
              color: "white",
              border: "none",
              borderRadius: "4px",
              cursor: "pointer",
              fontSize: "12px",
              fontWeight: "bold",
            }}
          >
            Refresh Cache
          </button>
        )}
      </div>
      <MapContainer
        center={center}
        zoom={8}
        zoomControl={false}
        style={{ width: "100%", height: "100%", minHeight: 0, flexGrow: 1, position: "relative", zIndex: 0 }}
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors, &copy; <a href="https://carto.com/attributions">CARTO</a>'
          url="https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png"
        />

        {/* Draw route polyline */}
        <Polyline
          positions={polylinePoints}
          color={colors.primary}
          weight={3}
          opacity={0.7}
          dashArray="5, 5"
        />

        {/* Driver location marker */}
        {driverLocation && createDriverIcon() && (
          <Marker
            position={[driverLocation.latitude, driverLocation.longitude]}
            icon={createDriverIcon()}
          >
            <Popup>
              <div style={{ minWidth: 180 }}>
                <h3
                  style={{
                    margin: "0 0 8px 0",
                    fontSize: 14,
                    fontWeight: "bold",
                  }}
                >
                  🏠 Driver Start/End Location
                </h3>
                <p style={{ margin: "4px 0", fontSize: 12, color: "#666" }}>
                  <strong>Lat:</strong> {driverLocation.latitude.toFixed(4)}
                </p>
                <p style={{ margin: "4px 0", fontSize: 12, color: "#666" }}>
                  <strong>Lng:</strong> {driverLocation.longitude.toFixed(4)}
                </p>
                <p style={{ margin: "4px 0", fontSize: 12, color: "#666" }}>
                  <strong>Accuracy:</strong> ±{Math.round(driverLocation.accuracy)}m
                </p>
                <p style={{ margin: "4px 0", fontSize: 12, color: "#666" }}>
                  <strong>Speed:</strong>{" "}
                  {(driverLocation.speed * 3.6).toFixed(1)} km/h
                </p>
              </div>
            </Popup>
          </Marker>
        )}



        {/* Add markers for each stop */}
        {stops.map((stop) => (
          <Marker
            key={stop.id}
            position={[stop.latitude, stop.longitude]}
            icon={createIcon(stop.type, stop.id)}
          >
            <Popup>
              <div style={{ minWidth: 200 }}>
                <h3
                  style={{
                    margin: "0 0 8px 0",
                    fontSize: 16,
                    fontWeight: "bold",
                  }}
                >
                  Stop {stop.index + 1}: {stop.label}
                </h3>
                <p style={{ margin: "4px 0", fontSize: 12, color: "#666" }}>
                  <strong>Type:</strong> {stop.type}
                </p>
                <p style={{ margin: "4px 0", fontSize: 12, color: "#666" }}>
                  <strong>Status:</strong> {getStopStatus(stop.id)}
                </p>
                <p style={{ margin: "4px 0", fontSize: 12, color: "#666" }}>
                  <strong>Address:</strong> {stop.addressLine}
                </p>
                <a
                  href={`https://www.google.com/maps/search/${encodeURIComponent(
                    stop.addressLine
                  )}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{
                    display: "inline-block",
                    marginTop: 8,
                    padding: "6px 12px",
                    backgroundColor: colors.primary,
                    color: "white",
                    textDecoration: "none",
                    borderRadius: 4,
                    fontSize: 12,
                    fontWeight: "bold",
                  }}
                >
                  Open in Google Maps
                </a>
              </div>
            </Popup>
          </Marker>
        ))}
      </MapContainer>
    </div>
  );
}
