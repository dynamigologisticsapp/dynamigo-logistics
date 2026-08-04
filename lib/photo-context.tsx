import React, { createContext, useContext, useState, useCallback } from "react";

export interface DeliveryPhoto {
  id: string;
  stopId: string;
  uri: string;
  timestamp: number;
  description?: string;
}

interface PhotoContextType {
  photos: DeliveryPhoto[];
  addPhoto: (stopId: string, uri: string, description?: string) => void;
  removePhoto: (photoId: string) => void;
  getPhotosByStop: (stopId: string) => DeliveryPhoto[];
  clearPhotos: () => void;
}

const PhotoContext = createContext<PhotoContextType | undefined>(undefined);

export function PhotoProvider({ children }: { children: React.ReactNode }) {
  const [photos, setPhotos] = useState<DeliveryPhoto[]>([]);

  const addPhoto = useCallback(
    (stopId: string, uri: string, description?: string) => {
      const newPhoto: DeliveryPhoto = {
        id: `photo_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        stopId,
        uri,
        timestamp: Date.now(),
        description,
      };
      setPhotos((prev) => [...prev, newPhoto]);
    },
    []
  );

  const removePhoto = useCallback((photoId: string) => {
    setPhotos((prev) => prev.filter((p) => p.id !== photoId));
  }, []);

  const getPhotosByStop = useCallback(
    (stopId: string): DeliveryPhoto[] => {
      return photos.filter((p) => p.stopId === stopId);
    },
    [photos]
  );

  const clearPhotos = useCallback(() => {
    setPhotos([]);
  }, []);

  return (
    <PhotoContext.Provider
      value={{ photos, addPhoto, removePhoto, getPhotosByStop, clearPhotos }}
    >
      {children}
    </PhotoContext.Provider>
  );
}

export function usePhotos() {
  const context = useContext(PhotoContext);
  if (!context) {
    throw new Error("usePhotos must be used within PhotoProvider");
  }
  return context;
}
