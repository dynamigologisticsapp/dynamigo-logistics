import { trpc } from "@/lib/trpc";
import { useRouteDate } from "@/lib/route-date-context";

/**
 * Custom hook that provides a shared enhancedRouteQuery instance.
 * Both Route and Maps tabs use this hook to ensure they display the same route data.
 * It follows the live Helper/Return Unit choices so the app always shows
 * the best current route without a manual recalculation step.
 */
export function useEnhancedRoute() {
  const { selectedDate, includeHelper, returnToUnit } = useRouteDate();
  
  const enhancedRouteQuery = trpc.operations.enhancedRoutePlan.useQuery(
    { dateKey: selectedDate, includeHelper, returnToUnit },
    {
      enabled: true,
      refetchInterval: false, // Do NOT auto-refetch periodically
      refetchOnMount: true,
      refetchOnWindowFocus: false, // Do NOT refetch on window focus
      refetchOnReconnect: true,
    },
  );

  return enhancedRouteQuery;
}
