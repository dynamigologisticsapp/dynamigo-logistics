import { useEffect, useState } from "react";
import * as Location from "expo-location";
import { Platform } from "react-native";

export interface DriverLocation {
  latitude: number;
  longitude: number;
  accuracy: number;
  heading: number;
  speed: number;
  timestamp: number;
}

export function useDriverLocation(enabled = false) {
  const [location, setLocation] = useState<DriverLocation | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isTracking, setIsTracking] = useState(false);

  useEffect(() => {
    let subscriber: any;

    if (!enabled) {
      // Stop tracking if disabled
      if (subscriber) {
        subscriber.remove();
      }
      setIsTracking(false);
      return;
    }

    const startTracking = async () => {
      try {
        // Request location permissions
        const { status } = await Location.requestForegroundPermissionsAsync();
        if (status !== "granted") {
          setError("Location permission not granted");
          return;
        }

        // Check if location services are enabled
        const enabled = await Location.hasServicesEnabledAsync();
        if (!enabled) {
          setError("Location services are not enabled");
          return;
        }

        // Start watching position
        subscriber = await Location.watchPositionAsync(
          {
            accuracy: Location.Accuracy.High,
            timeInterval: 5000, // Update every 5 seconds
            distanceInterval: 10, // Or when moved 10 meters
          },
          (newLocation) => {
            const { coords } = newLocation;
            setLocation({
              latitude: coords.latitude,
              longitude: coords.longitude,
              accuracy: coords.accuracy || 0,
              heading: coords.heading || 0,
              speed: coords.speed || 0,
              timestamp: newLocation.timestamp,
            });
            setError(null);
          }
        );

        setIsTracking(true);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Unknown error");
        setIsTracking(false);
      }
    };

    // Only start tracking on native platforms
    if (Platform.OS !== "web") {
      startTracking();
    } else {
      // On web, use browser geolocation
      if (navigator.geolocation) {
        const watchId = navigator.geolocation.watchPosition(
          (position) => {
            const { coords } = position;
            setLocation({
              latitude: coords.latitude,
              longitude: coords.longitude,
              accuracy: coords.accuracy || 0,
              heading: coords.heading || 0,
              speed: coords.speed || 0,
              timestamp: position.timestamp,
            });
            setError(null);
          },
          (err) => {
            setError(err.message);
          },
          {
            enableHighAccuracy: true,
            timeout: 5000,
            maximumAge: 0,
          }
        );

        setIsTracking(true);

        return () => {
          navigator.geolocation.clearWatch(watchId);
        };
      }
    }

    return () => {
      if (subscriber) {
        subscriber.remove();
      }
    };
  }, [enabled]);

  return { location, error, isTracking };
}
