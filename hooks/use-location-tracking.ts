import { useState, useEffect, useRef } from 'react';
import * as Location from 'expo-location';
import { Platform } from 'react-native';

export interface DriverLocation {
  latitude: number;
  longitude: number;
  accuracy: number;
  timestamp: number;
}

interface UseLocationTrackingOptions {
  enabled: boolean;
  accuracy?: Location.Accuracy;
  timeInterval?: number; // milliseconds
  distanceInterval?: number; // meters
}

/**
 * Hook for tracking driver's real-time location during route execution
 */
export function useLocationTracking(options: UseLocationTrackingOptions) {
  const [location, setLocation] = useState<DriverLocation | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isTracking, setIsTracking] = useState(false);
  const subscriberRef = useRef<Location.LocationSubscription | null>(null);

  useEffect(() => {
    if (!options.enabled) {
      // Stop tracking if disabled
      if (subscriberRef.current) {
        subscriberRef.current.remove();
        subscriberRef.current = null;
        setIsTracking(false);
      }
      return;
    }

    // Start tracking
    let isMounted = true;

    const startTracking = async () => {
      try {
        // Check if location services are available
        if (Platform.OS === 'web' && !window.navigator.geolocation) {
          setError('Geolocation is not supported by this browser.');
          return;
        }

        // Request permissions
        const { status } = await Location.requestForegroundPermissionsAsync();
        if (status !== 'granted') {
          setError('Location permission denied');
          return;
        }

        if (!isMounted) return;

        // Get initial location
        const initialLocation = await Location.getCurrentPositionAsync({
          accuracy: options.accuracy || Location.Accuracy.High,
        });

        if (isMounted) {
          setLocation({
            latitude: initialLocation.coords.latitude,
            longitude: initialLocation.coords.longitude,
            accuracy: initialLocation.coords.accuracy || 0,
            timestamp: initialLocation.timestamp,
          });
          setError(null);
        }

        // Subscribe to location updates
        const subscriber = await Location.watchPositionAsync(
          {
            accuracy: options.accuracy || Location.Accuracy.High,
            timeInterval: options.timeInterval || 10000, // 10 seconds
            distanceInterval: options.distanceInterval || 10, // 10 meters
          },
          (newLocation) => {
            if (isMounted) {
              setLocation({
                latitude: newLocation.coords.latitude,
                longitude: newLocation.coords.longitude,
                accuracy: newLocation.coords.accuracy || 0,
                timestamp: newLocation.timestamp,
              });
              setError(null);
            }
          }
        );

        if (isMounted) {
          subscriberRef.current = subscriber;
          setIsTracking(true);
        }
      } catch (err) {
        if (isMounted) {
          setError(err instanceof Error ? err.message : 'Failed to start location tracking');
          setIsTracking(false);
        }
      }
    };

    startTracking();

    return () => {
      isMounted = false;
      if (subscriberRef.current) {
        subscriberRef.current.remove();
        subscriberRef.current = null;
      }
    };
  }, [options.enabled, options.accuracy, options.timeInterval, options.distanceInterval]);

  return {
    location,
    error,
    isTracking,
  };
}
