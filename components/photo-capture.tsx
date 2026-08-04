import React, { useState } from "react";
import { View, Text, Pressable, Image, ScrollView, Alert, Platform } from "react-native";
import * as ImagePicker from "expo-image-picker";
import { useColors } from "@/hooks/use-colors";
import { usePhotos } from "@/lib/photo-context";
import { cn } from "@/lib/utils";

interface PhotoCaptureProps {
  stopId: string;
  stopLabel: string;
}

export function PhotoCapture({ stopId, stopLabel }: PhotoCaptureProps) {
  const colors = useColors();
  const { addPhoto, removePhoto, getPhotosByStop } = usePhotos();
  const [isLoading, setIsLoading] = useState(false);
  const photos = getPhotosByStop(stopId);

  const requestCameraPermission = async () => {
    if (Platform.OS !== "web") {
      const { status } = await ImagePicker.requestCameraPermissionsAsync();
      if (status !== "granted") {
        Alert.alert(
          "Permission Denied",
          "Camera permission is required to take photos"
        );
        return false;
      }
    }
    return true;
  };

  const handleTakePhoto = async () => {
    const hasPermission = await requestCameraPermission();
    if (!hasPermission) return;

    setIsLoading(true);
    try {
      const result = await ImagePicker.launchCameraAsync({
        allowsEditing: true,
        aspect: [4, 3],
        quality: 0.8,
        base64: false,
      });

      if (!result.canceled && result.assets[0]) {
        const asset = result.assets[0];
        addPhoto(stopId, asset.uri, `Photo of ${stopLabel}`);
      }
    } catch (error) {
      console.error("Error taking photo:", error);
      Alert.alert("Error", "Failed to take photo");
    } finally {
      setIsLoading(false);
    }
  };

  const handlePickPhoto = async () => {
    setIsLoading(true);
    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        allowsEditing: true,
        aspect: [4, 3],
        quality: 0.8,
        base64: false,
      });

      if (!result.canceled && result.assets[0]) {
        const asset = result.assets[0];
        addPhoto(stopId, asset.uri, `Photo of ${stopLabel}`);
      }
    } catch (error) {
      console.error("Error picking photo:", error);
      Alert.alert("Error", "Failed to pick photo");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <View className="gap-4">
      {/* Photo Capture Buttons */}
      <View className="gap-3">
        <Text className="text-base font-semibold text-foreground">
          Delivery Photos
        </Text>

        <View className="flex-row gap-3">
          <Pressable
            onPress={handleTakePhoto}
            disabled={isLoading}
            className={cn(
              "flex-1 bg-primary rounded-lg p-4 items-center justify-center",
              isLoading && "opacity-50"
            )}
            style={({ pressed }) => [
              {
                opacity: pressed ? 0.8 : 1,
              },
            ]}
          >
            <Text className="text-white font-semibold text-center">
              📷 Take Photo
            </Text>
          </Pressable>

          <Pressable
            onPress={handlePickPhoto}
            disabled={isLoading}
            className={cn(
              "flex-1 bg-surface border border-border rounded-lg p-4 items-center justify-center",
              isLoading && "opacity-50"
            )}
            style={({ pressed }) => [
              {
                opacity: pressed ? 0.8 : 1,
              },
            ]}
          >
            <Text className="text-foreground font-semibold text-center">
              🖼️ Choose Photo
            </Text>
          </Pressable>
        </View>
      </View>

      {/* Photo Gallery */}
      {photos.length > 0 && (
        <View className="gap-3">
          <Text className="text-sm font-semibold text-foreground">
            Attached Photos ({photos.length})
          </Text>

          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            className="gap-3"
            contentContainerStyle={{ gap: 12 }}
          >
            {photos.map((photo) => (
              <View key={photo.id} className="relative">
                <Image
                  source={{ uri: photo.uri }}
                  style={{
                    width: 120,
                    height: 90,
                    borderRadius: 8,
                    backgroundColor: colors.surface,
                  }}
                />

                {/* Delete Button */}
                <Pressable
                  onPress={() => removePhoto(photo.id)}
                  className="absolute top-1 right-1 bg-error rounded-full w-6 h-6 items-center justify-center"
                  style={({ pressed }) => [
                    {
                      opacity: pressed ? 0.7 : 1,
                    },
                  ]}
                >
                  <Text className="text-white text-xs font-bold">✕</Text>
                </Pressable>

                {/* Timestamp */}
                <View className="absolute bottom-1 left-1 bg-black/60 rounded px-2 py-1">
                  <Text className="text-white text-xs">
                    {new Date(photo.timestamp).toLocaleTimeString()}
                  </Text>
                </View>
              </View>
            ))}
          </ScrollView>
        </View>
      )}

      {/* Empty State */}
      {photos.length === 0 && (
        <View className="bg-surface rounded-lg p-4 items-center">
          <Text className="text-muted text-sm text-center">
            No photos attached yet. Take or choose a photo to document this delivery.
          </Text>
        </View>
      )}
    </View>
  );
}
