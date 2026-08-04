import React, { createContext, useContext, useState, ReactNode, useEffect } from "react";
import { RouteStop } from "@/shared/route-planner";
import { todayDateKey } from "@/lib/date-key";

interface RouteDateContextType {
  selectedDate: string;
  setSelectedDate: (date: string) => void;
  customRouteOrder: RouteStop[] | null;
  setCustomRouteOrder: (stops: RouteStop[] | null) => void;
  isRouteStale: boolean;
  setIsRouteStale: (stale: boolean) => void;
  // UI toggles - can change freely, just mark route as stale
  includeHelper: boolean;
  setIncludeHelper: (include: boolean) => void;
  returnToUnit: boolean;
  setReturnToUnit: (return_: boolean) => void;
  // Committed toggles - only updated when user clicks Recalculate
  // These are used for the query to prevent auto-refetch
  committedIncludeHelper: boolean;
  setCommittedIncludeHelper: (include: boolean) => void;
  committedReturnToUnit: boolean;
  setCommittedReturnToUnit: (return_: boolean) => void;
  completedRouteStopIds: Record<string, true>;
  markRouteStopComplete: (stopId: string) => void;
  clearCompletedRouteStops: () => void;
}

const RouteDateContext = createContext<RouteDateContextType | undefined>(undefined);

export function RouteDateProvider({ children }: { children: ReactNode }) {
  const [selectedDate, setSelectedDate] = useState(() => {
    return todayDateKey();
  });
  const [customRouteOrder, setCustomRouteOrder] = useState<RouteStop[] | null>(null);
  const [isRouteStale, setIsRouteStale] = useState(false);
  

  
  // UI toggles - reflect what the user wants
  const [includeHelper, setIncludeHelper] = useState(true);
  const [returnToUnit, setReturnToUnit] = useState(true);
  // Committed toggles - only updated when user clicks Recalculate
  // These are used for the API query to prevent auto-refetch when UI toggles change
  const [committedIncludeHelper, setCommittedIncludeHelper] = useState(true);
  const [committedReturnToUnit, setCommittedReturnToUnit] = useState(true);
  const [completedRouteStopIds, setCompletedRouteStopIds] = useState<Record<string, true>>({});

  useEffect(() => {
    setCustomRouteOrder(null);
    setCompletedRouteStopIds({});
  }, [selectedDate]);

  const markRouteStopComplete = (stopId: string) => {
    setCompletedRouteStopIds((current) => ({ ...current, [stopId]: true }));
  };

  const clearCompletedRouteStops = () => {
    setCompletedRouteStopIds({});
  };

  return (
    <RouteDateContext.Provider value={{ 
      selectedDate, setSelectedDate, 
      customRouteOrder, setCustomRouteOrder, 
      isRouteStale, setIsRouteStale, 
      includeHelper, setIncludeHelper, 
      returnToUnit, setReturnToUnit,
      committedIncludeHelper, setCommittedIncludeHelper,
      committedReturnToUnit, setCommittedReturnToUnit,
      completedRouteStopIds, markRouteStopComplete, clearCompletedRouteStops,
    }}>
      {children}
    </RouteDateContext.Provider>
  );
}

export function useRouteDate() {
  const context = useContext(RouteDateContext);
  if (!context) {
    throw new Error("useRouteDate must be used within RouteDateProvider");
  }
  return context;
}
