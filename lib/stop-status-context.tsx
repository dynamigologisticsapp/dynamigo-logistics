import React, { createContext, useContext, useState, useCallback } from "react";

export type StopStatus = "pending" | "in-progress" | "completed";

interface StopStatusMap {
  [stopId: string]: StopStatus;
}

interface StopStatusContextType {
  statuses: StopStatusMap;
  setStopStatus: (stopId: string, status: StopStatus) => void;
  getStopStatus: (stopId: string) => StopStatus;
  resetStatuses: () => void;
}

const StopStatusContext = createContext<StopStatusContextType | undefined>(undefined);

export function StopStatusProvider({ children }: { children: React.ReactNode }) {
  const [statuses, setStatuses] = useState<StopStatusMap>({});

  const setStopStatus = useCallback((stopId: string, status: StopStatus) => {
    setStatuses((prev) => ({
      ...prev,
      [stopId]: status,
    }));
  }, []);

  const getStopStatus = useCallback(
    (stopId: string): StopStatus => {
      return statuses[stopId] || "pending";
    },
    [statuses]
  );

  const resetStatuses = useCallback(() => {
    setStatuses({});
  }, []);

  return (
    <StopStatusContext.Provider value={{ statuses, setStopStatus, getStopStatus, resetStatuses }}>
      {children}
    </StopStatusContext.Provider>
  );
}

export function useStopStatus() {
  const context = useContext(StopStatusContext);
  if (!context) {
    throw new Error("useStopStatus must be used within StopStatusProvider");
  }
  return context;
}
