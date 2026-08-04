import React, { useMemo } from "react";
import { View, Text, ActivityIndicator } from "react-native";
import { useColors } from "@/hooks/use-colors";
import WebView from "react-native-webview";

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

interface NativeMapProps {
  stops: MapStop[];
  driverLocation?: DriverLocation | null;
}

const getMarkerColor = (type: string) => {
  const normalizedType = String(type).toLowerCase().trim();
  
  switch (normalizedType) {
    case "helper":
    case "helper-dropoff":
    case "helper_dropoff":
      return "#FF9800"; // Orange
    case "delivery":
      return "#9C27B0"; // Purple
    case "pickup":
    case "customer_pickup":
      return "#00BCD4"; // Teal
    case "unit":
    case "unit_return":
      return "#757575"; // Slate
    case "home":
      return "#10B981"; // Green
    case "start":
    case "driver_start":
      return "#2563EB"; // Blue
    default:
      return "#9C27B0"; // Purple
  }
};

export default function NativeMap({ stops, driverLocation }: NativeMapProps) {
  const colors = useColors();

  // Generate HTML for Google Maps
  const mapHtml = useMemo(() => {
    if (!stops || stops.length === 0) {
      return `
        <!DOCTYPE html>
        <html>
          <head>
            <meta charset="utf-8" />
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <style>
              body { margin: 0; padding: 0; font-family: Arial, sans-serif; }
              #map { position: absolute; top: 0; bottom: 0; width: 100%; }
            </style>
          </head>
          <body>
            <div id="map" style="background: #f0f0f0; display: flex; align-items: center; justify-content: center;">
              <p>No stops available</p>
            </div>
          </body>
        </html>
      `;
    }

    const apiKey = process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY || "AIzaSyCQurCbQ2iQ0m2zGvnrHxU3EDt7frwFDUw";
    
    // Create markers data
    const markersData = stops.map((stop, index) => ({
      lat: stop.latitude,
      lng: stop.longitude,
      label: String(index + 1),
      title: `${index + 1}. ${stop.label}`,
      type: stop.type,
      address: stop.addressLine,
      status: stop.status,
      color: getMarkerColor(stop.type),
    }));

    // Create polyline path
    const polylinePath = stops.map((stop) => `{lat: ${stop.latitude}, lng: ${stop.longitude}}`).join(",");

    // Create driver marker if available
    const driverMarkerCode = driverLocation ? `
      const driverMarker = new google.maps.Marker({
        position: {lat: ${driverLocation.latitude}, lng: ${driverLocation.longitude}},
        map: map,
        icon: {
          path: google.maps.SymbolPath.FORWARD_CLOSED_ARROW,
          scale: 8,
          fillColor: '#FF5722',
          fillOpacity: 1,
          strokeColor: '#fff',
          strokeWeight: 2,
          rotation: ${driverLocation.heading || 0}
        },
        title: 'Driver Location'
      });
    ` : '';

    const html = `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="utf-8" />
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <style>
            body { margin: 0; padding: 0; }
            #map { position: absolute; top: 0; bottom: 0; width: 100%; }
          </style>
        </head>
        <body>
          <div id="map"></div>
          <script src="https://maps.googleapis.com/maps/api/js?key=${apiKey}" async defer></script>
          <script>
            const stops = ${JSON.stringify(markersData)};
            const driverLocation = ${JSON.stringify(driverLocation)};
            
            function initializeMap() {
              if (!window.google || !window.google.maps) {
                setTimeout(initializeMap, 100);
                return;
              }
              
              // Initialize map
              const center = stops.length > 0 
                ? {lat: stops[0].lat, lng: stops[0].lng}
                : {lat: 51.5074, lng: -0.1278};
              
              const map = new google.maps.Map(document.getElementById('map'), {
                zoom: 13,
                center: center,
                mapTypeId: 'roadmap',
                disableDefaultUI: true,
                zoomControl: false,
                fullscreenControl: false,
                streetViewControl: false,
                mapTypeControl: false,
                keyboardShortcuts: false
              });
            
            // Add markers
            stops.forEach((stop, index) => {
              const marker = new google.maps.Marker({
                position: {lat: stop.lat, lng: stop.lng},
                map: map,
                icon: {
                  path: google.maps.SymbolPath.CIRCLE,
                  scale: 10,
                  fillColor: stop.color,
                  fillOpacity: 1,
                  strokeColor: '#fff',
                  strokeWeight: 2
                },
                label: {
                  text: stop.label,
                  color: '#fff',
                  fontSize: '12px',
                  fontWeight: 'bold'
                },
                title: stop.title
              });
              
              const infoWindow = new google.maps.InfoWindow({
                content: '<div style="padding: 8px; font-size: 12px; max-width: 200px;"><strong>' + stop.title + '</strong><br/><small>' + stop.type + '</small><br/><small>' + stop.address + '</small><br/><small>Status: ' + stop.status + '</small></div>'
              });
              
              marker.addListener('click', () => {
                infoWindow.open(map, marker);
              });
            });
            
            // Add polyline
            const polyline = new google.maps.Polyline({
              path: [${polylinePath}],
              geodesic: true,
              strokeColor: '#0a7ea4',
              strokeOpacity: 0.7,
              strokeWeight: 3,
              map: map
            });
            
            // Add driver marker if available
            ${driverMarkerCode}
            
              // Fit bounds
              const bounds = new google.maps.LatLngBounds();
              stops.forEach(stop => {
                bounds.extend({lat: stop.lat, lng: stop.lng});
              });
              map.fitBounds(bounds, {top: 50, right: 50, bottom: 50, left: 50});
            }
            
            // Wait for Google Maps API to load
            if (document.readyState === 'loading') {
              document.addEventListener('DOMContentLoaded', initializeMap);
            } else {
              initializeMap();
            }
          </script>
        </body>
      </html>
    `;

    return html;
  }, [stops, driverLocation]);

  if (!stops || stops.length === 0) {
    return (
      <View className="flex-1 items-center justify-center" style={{ backgroundColor: colors.background }}>
        <Text className="text-muted">No stops available</Text>
      </View>
    );
  }

  return (
    <View className="flex-1">
      <WebView
        source={{ html: mapHtml }}
        style={{ flex: 1 }}
        scrollEnabled={true}
        scalesPageToFit={true}
        javaScriptEnabled={true}
        startInLoadingState={true}
        renderLoading={() => (
          <View className="flex-1 items-center justify-center" style={{ backgroundColor: colors.background }}>
            <ActivityIndicator size="large" color={colors.primary} />
            <Text className="mt-2 text-sm text-muted">Loading map...</Text>
          </View>
        )}
      />
    </View>
  );
}
