import {
  JobRecord,
  HelperRecord,
  VanRecord,
  BusinessSettings,
  RoutePlan,
  RouteStop,
  TOWN_OPTIONS,
  calculateLiveVanStock,
  getDeliveryLoad,
  getPickupLoad,
  getTotalLoad,
  getTownLabel,
  isHelperAvailable,
  validateRouteInputs,
} from "../shared/route-planner";
import {
  HaversineDistanceProvider,
  createConfiguredDistanceProvider,
  type DistanceProvider,
} from "./distance-provider";

const HELPER_SERVICE_MINUTES = 0;
const PICKUP_SERVICE_MINUTES = 15;
const DELIVERY_SERVICE_MINUTES = 20;
const UNIT_MINUTES_PER_SOFA_MOVED = 10;
const EARTH_RADIUS_MILES = 3958.8;
const ROAD_INFLATION_FACTOR = 1.27;
const MINUTES_PER_ROAD_MILE = 2.2;

function timeStringToMinutes(value: string) {
  const match = value.trim().match(/^(\d{1,2}):(\d{2})$/);
  if (!match) return null;
  const hours = Number(match[1]);
  const minutes = Number(match[2]);
  if (!Number.isFinite(hours) || !Number.isFinite(minutes) || hours > 23 || minutes > 59) return null;
  return hours * 60 + minutes;
}

function parseTimeWindow(timeWindow?: string) {
  if (!timeWindow || /flexible/i.test(timeWindow)) return null;
  const [startRaw, endRaw] = timeWindow.split(/\s*-\s*/);
  const start = timeStringToMinutes(startRaw ?? "");
  const end = timeStringToMinutes(endRaw ?? "");
  if (start === null || end === null) return null;
  return { start, end: end < start ? end + 1440 : end };
}

function getStopWindow(stop: RouteStop, jobsById: Map<string, JobRecord>) {
  if (stop.kind !== "job" || !stop.relatedJobId) return null;
  return parseTimeWindow(jobsById.get(stop.relatedJobId)?.timeWindow);
}

function rescheduleStopsFromStart(
  stops: RouteStop[],
  jobsById: Map<string, JobRecord>,
  startMinutes: number,
) {
  let previousEta = startMinutes;

  return stops.map((stop, index) => {
    if (index === 0) {
      previousEta = startMinutes;
      return { ...stop, etaMinutesFromStart: startMinutes };
    }

    const arrivalMinutes = previousEta + stop.travelMinutesFromPrevious;
    const window = getStopWindow(stop, jobsById);
    const serviceStartMinutes = window ? Math.max(arrivalMinutes, window.start) : arrivalMinutes;
    const etaMinutesFromStart = serviceStartMinutes + stop.serviceMinutes;
    previousEta = etaMinutesFromStart;
    return { ...stop, etaMinutesFromStart };
  });
}

function routeFitsTimeLimits(
  stops: RouteStop[],
  jobsById: Map<string, JobRecord>,
  workdayEndMinutes: number | null,
) {
  for (const stop of stops) {
    const window = getStopWindow(stop, jobsById);
    if (!window) continue;
    const serviceStartMinutes = stop.etaMinutesFromStart - stop.serviceMinutes;
    if (serviceStartMinutes > window.end) return false;
  }

  const finalEta = stops.at(-1)?.etaMinutesFromStart ?? 0;
  return workdayEndMinutes === null || finalEta <= workdayEndMinutes;
}

function routeHitsWindowStarts(
  stops: RouteStop[],
  jobsById: Map<string, JobRecord>,
) {
  for (const stop of stops) {
    const window = getStopWindow(stop, jobsById);
    if (!window) continue;
    const serviceStartMinutes = stop.etaMinutesFromStart - stop.serviceMinutes;
    if (serviceStartMinutes > window.start) return false;
  }

  return true;
}

function chooseFlowStartMinutes(
  stops: RouteStop[],
  jobsById: Map<string, JobRecord>,
  earliestStartMinutes: number,
  _workdayEndMinutes: number | null,
) {
  const hasTimedStop = stops.some((stop) => getStopWindow(stop, jobsById) !== null);
  if (!hasTimedStop) {
    return earliestStartMinutes;
  }

  const latestPossibleStart = earliestStartMinutes + 720;
  let bestStart = earliestStartMinutes;
  let bestStartForWindowStarts: number | null = null;

  for (let start = earliestStartMinutes; start <= latestPossibleStart; start += 5) {
    const scheduledStops = rescheduleStopsFromStart(stops, jobsById, start);
    if (routeFitsTimeLimits(scheduledStops, jobsById, null)) {
      bestStart = start;
      if (routeHitsWindowStarts(scheduledStops, jobsById)) {
        bestStartForWindowStarts = start;
      }
    } else if (start > bestStart) {
      break;
    }
  }

  return bestStartForWindowStarts ?? bestStart;
}

function toRadians(value: number) {
  return (value * Math.PI) / 180;
}

function estimateMinutesBetween(
  origin: [number, number],
  destination: [number, number],
) {
  const dLat = toRadians(destination[0] - origin[0]);
  const dLon = toRadians(destination[1] - origin[1]);
  const lat1 = toRadians(origin[0]);
  const lat2 = toRadians(destination[0]);

  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.sin(dLon / 2) * Math.sin(dLon / 2) * Math.cos(lat1) * Math.cos(lat2);

  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return Math.max(1, Math.round(EARTH_RADIUS_MILES * c * ROAD_INFLATION_FACTOR * MINUTES_PER_ROAD_MILE));
}

/**
 * Calculate travel time between two validated coordinates.
 */
export async function calculateTravelMinutes(
  origin: [number, number],
  destination: [number, number],
  distanceProvider: DistanceProvider = new HaversineDistanceProvider(),
): Promise<number> {
  return distanceProvider.getTravelTime(origin, destination);
}

/**
 * Build a route plan using the configured distance provider.
 * Haversine is the default; a paid driving-time provider can be injected later.
 */
export async function buildEnhancedRoutePlan(
  jobs: JobRecord[],
  helpers: HelperRecord[],
  settings: BusinessSettings,
  dateKey: string,
  van?: VanRecord,
  options?: {
    includeHelper?: boolean;
    returnToUnit?: boolean;
    distanceProvider?: DistanceProvider;
  }
): Promise<RoutePlan> {
  const validatedJobs = validateRouteInputs(jobs, settings, van, undefined);
  const jobsForDate = validatedJobs.filter((job) => job.scheduledDay === dateKey);
  const scheduledJobs = jobsForDate.filter((job) => job.status === "scheduled");
  const startingStock = calculateLiveVanStock(jobsForDate, settings.vanCapacity);
  const startingLoad = getTotalLoad(startingStock);

  if (scheduledJobs.length === 0) {
    return {
      dateKey,
      selectedHelper: null,
      helperReason: "No jobs scheduled for this date.",
      stops: [],
      nextStop: null,
      routeHeadline: startingLoad > 0
        ? `No active customer stops remain. Van load is ${startingLoad}/${settings.vanCapacity}.`
        : "No jobs scheduled for this date.",
      currentLoad: startingLoad,
      summary: {
        totalStops: 0,
        totalJobs: 0,
        pickupJobs: 0,
        deliveryJobs: 0,
        unitReturns: 0,
        estimatedTravelMinutes: 0,
        estimatedWorkMinutes: 0,
        startingLoad,
        finalLoad: startingLoad,
      },
    };
  }

  const vanCapacity = settings.vanCapacity;
  const remainingJobs = [...scheduledJobs];
  const stops: RouteStop[] = [];
  const getDeliveryNeed = (items: typeof remainingJobs) =>
    Math.round(items.reduce((sum, job) => sum + getDeliveryLoad(job), 0) * 100) / 100;
  const getLoadJobs = (items: typeof remainingJobs) => {
    const selected: typeof remainingJobs = [];
    let selectedLoad = 0;
    for (const job of items) {
      const deliveryLoad = getDeliveryLoad(job);
      if (deliveryLoad <= 0) continue;
      if (selectedLoad + deliveryLoad > vanCapacity) break;
      selected.push(job);
      selectedLoad = Math.round((selectedLoad + deliveryLoad) * 100) / 100;
    }
    return selected;
  };
  
  const distanceProvider =
    options?.distanceProvider ??
    createConfiguredDistanceProvider();

  // Convert workday start time (HH:MM) to minutes from midnight for ETA calculations
  const [workdayHours, workdayMinutes] = settings.workdayStart.split(':').map(Number);
  const workdayStartMinutes = workdayHours * 60 + workdayMinutes;

  // Get starting address
  let currentCoordinates: [number, number] = van
    ? [van.latitude, van.longitude]
    : [settings.unitLatitude, settings.unitLongitude];

  let elapsedMinutes = 0;
  let cleanLoad = startingStock.clean;
  let dirtyLoad = startingStock.dirty;
  const currentLoad = () => Math.round((cleanLoad + dirtyLoad) * 100) / 100;
  const unitCoordinates: [number, number] = [
    settings.unitLatitude,
    settings.unitLongitude,
  ];

  const addUnitStop = async (reason: string) => {
    const unitAddress = settings.unitAddress || getTownLabel(settings.unitTownId);
    const travelMinutes = await calculateTravelMinutes(
      currentCoordinates,
      unitCoordinates,
      distanceProvider,
    );
    elapsedMinutes += travelMinutes;
    const loadBefore = currentLoad();
    const cleanBefore = cleanLoad;
    const dirtyBefore = dirtyLoad;
    const loadJobs = getLoadJobs(remainingJobs);
    const nextCleanLoad = Math.min(vanCapacity, getDeliveryNeed(loadJobs.length ? loadJobs : remainingJobs));
    const sofasMoved = Math.round((dirtyBefore + Math.max(0, nextCleanLoad - cleanBefore)) * 100) / 100;
    const serviceMinutes = Math.round(sofasMoved * UNIT_MINUTES_PER_SOFA_MOVED);

    dirtyLoad = 0;
    cleanLoad = Math.round(nextCleanLoad * 100) / 100;
    elapsedMinutes += serviceMinutes;

    stops.push({
      id: `unit-return-${stops.length}`,
      kind: "unit",
      label: settings.unitLabel,
      townId: settings.unitTownId,
      addressLine: unitAddress,
      latitude: settings.unitLatitude,
      longitude: settings.unitLongitude,
      etaMinutesFromStart: workdayStartMinutes + elapsedMinutes,
      travelMinutesFromPrevious: travelMinutes,
      serviceMinutes,
      loadBefore,
      loadAfter: currentLoad(),
      deltaSofas: Math.round((currentLoad() - loadBefore) * 100) / 100,
      cleanLoadBefore: cleanBefore,
      cleanLoadAfter: cleanLoad,
      dirtyLoadBefore: dirtyBefore,
      dirtyLoadAfter: dirtyLoad,
      reason,
      loadJobIds: loadJobs.map((job) => job.id),
    });

    currentCoordinates = unitCoordinates;
  };

  stops.push({
    id: van ? `start-${van.id}` : "start-unit",
    kind: van ? "start" : "unit",
    label: van ? `${van.driverName} start` : settings.unitLabel,
    townId: van?.startingTownId ?? settings.unitTownId,
    addressLine: van?.addressLine || settings.unitAddress || getTownLabel(settings.unitTownId),
    latitude: currentCoordinates[0],
    longitude: currentCoordinates[1],
    etaMinutesFromStart: workdayStartMinutes,
    travelMinutesFromPrevious: 0,
    serviceMinutes: 0,
    loadBefore: currentLoad(),
    loadAfter: currentLoad(),
    deltaSofas: 0,
    cleanLoadBefore: cleanLoad,
    cleanLoadAfter: cleanLoad,
    dirtyLoadBefore: dirtyLoad,
    dirtyLoadAfter: dirtyLoad,
    reason: van ? "Start from the driver's saved address." : "Start from the unit address.",
  });

  // Select and pick up helper if available
  const includeHelper = options?.includeHelper !== false;
  const returnToUnit = options?.returnToUnit !== false;
  const availableHelpers = helpers.filter((helper) => isHelperAvailable(helper, dateKey));

  // Track which helper was picked up (if any)
  let pickedUpHelper: HelperRecord | null = null;
  if (includeHelper && availableHelpers.length > 0) {
    const selectedHelper = availableHelpers[0];
    pickedUpHelper = selectedHelper; // Store for later drop-off
    const helperAddress = selectedHelper.addressLine || `${getTownLabel(selectedHelper.townId)}, Scotland`;

    try {
      const helperCoordinates: [number, number] = [
        selectedHelper.latitude,
        selectedHelper.longitude,
      ];
      const travelMinutes = await calculateTravelMinutes(
        currentCoordinates,
        helperCoordinates,
        distanceProvider,
      );
      elapsedMinutes += travelMinutes + HELPER_SERVICE_MINUTES;

      stops.push({
        id: `helper-${selectedHelper.id}`,
        kind: "helper",
        label: selectedHelper.name,
        townId: selectedHelper.townId,
        addressLine: helperAddress,
        latitude: selectedHelper.latitude,
        longitude: selectedHelper.longitude,
        etaMinutesFromStart: workdayStartMinutes + elapsedMinutes,
        travelMinutesFromPrevious: travelMinutes,
        serviceMinutes: HELPER_SERVICE_MINUTES,
        loadBefore: currentLoad(),
        loadAfter: currentLoad(),
        deltaSofas: 0,
        cleanLoadBefore: cleanLoad,
        cleanLoadAfter: cleanLoad,
        dirtyLoadBefore: dirtyLoad,
        dirtyLoadAfter: dirtyLoad,
        reason: "Helper pickup",
        relatedHelperId: selectedHelper.id,
      });

      currentCoordinates = helperCoordinates;
    } catch (error) {
      console.error("Error calculating helper pickup travel time:", error);
    }
  }

  // Process jobs in order
  let jobIndex = 0;
  while (remainingJobs.length && jobIndex < 40) {
    jobIndex++;

    // Filter feasible jobs based on clean stock and dirty return space.
    const feasibleJobs = remainingJobs.filter((job) => {
      const deliveryLoad = getDeliveryLoad(job);
      const pickupLoad = getPickupLoad(job);
      return deliveryLoad <= cleanLoad && cleanLoad + dirtyLoad - deliveryLoad + pickupLoad <= vanCapacity;
    });

    if (!feasibleJobs.length) {
      try {
        await addUnitStop("Return to unit to unload pickup returns and load clean delivery stock.");
      } catch (error) {
        console.error("Error calculating return to unit travel time:", error);
      }
      continue;
    }

    const canDoJobWithStock = (job: typeof remainingJobs[number], clean: number, dirty: number) => {
      const deliveryLoad = getDeliveryLoad(job);
      const pickupLoad = getPickupLoad(job);
      return deliveryLoad <= clean && clean + dirty - deliveryLoad + pickupLoad <= vanCapacity;
    };

    const stockAfterJob = (job: typeof remainingJobs[number], clean: number, dirty: number) => ({
      clean: Math.round((clean - getDeliveryLoad(job)) * 100) / 100,
      dirty: Math.round((dirty + getPickupLoad(job)) * 100) / 100,
    });

    const scoreNextJob = async (job: typeof remainingJobs[number]) => {
      const jobCoordinates: [number, number] = [job.latitude, job.longitude];
      const after = stockAfterJob(job, cleanLoad, dirtyLoad);
      const remainingAfter = remainingJobs.filter((candidate) => candidate.id !== job.id);
      const feasibleAfter = remainingAfter.filter((candidate) => canDoJobWithStock(candidate, after.clean, after.dirty));
      const travelMinutes = await calculateTravelMinutes(currentCoordinates, jobCoordinates, distanceProvider);
      const window = parseTimeWindow(job.timeWindow);
      const serviceMinutes = Math.max(1, Math.round(job.duration || DELIVERY_SERVICE_MINUTES));
      const arrivalMinutes = workdayStartMinutes + elapsedMinutes + travelMinutes;
      const serviceStartMinutes = window ? Math.max(arrivalMinutes, window.start) : arrivalMinutes;
      const finishMinutes = serviceStartMinutes + serviceMinutes;
      const lateMinutes = window ? Math.max(0, serviceStartMinutes - window.end) : 0;
      const waitMinutes = window ? Math.max(0, window.start - arrivalMinutes) : 0;

      let score = travelMinutes + waitMinutes + lateMinutes * 10000;

      for (const later of remainingAfter) {
        const laterWindow = parseTimeWindow(later.timeWindow);
        if (!laterWindow) continue;
        const laterCoordinates: [number, number] = [later.latitude, later.longitude];
        const nextTravelEstimate = estimateMinutesBetween(jobCoordinates, laterCoordinates);
        const earliestLaterArrival = finishMinutes + nextTravelEstimate;
        const laterLateMinutes = Math.max(0, earliestLaterArrival - laterWindow.end);
        score += laterLateMinutes * 5000;
      }

      if (remainingAfter.length === 0) {
        return score + estimateMinutesBetween(jobCoordinates, unitCoordinates) * 0.2;
      }

      if (!feasibleAfter.length) {
        return score + estimateMinutesBetween(jobCoordinates, unitCoordinates);
      }

      const bestSecondLeg = Math.min(
        ...feasibleAfter.map((candidate) => {
          const candidateCoordinates: [number, number] = [candidate.latitude, candidate.longitude];
          const afterCandidate = stockAfterJob(candidate, after.clean, after.dirty);
          const stillRemaining = remainingAfter.filter((later) => later.id !== candidate.id);
          const loadAfterCandidate = Math.round((afterCandidate.clean + afterCandidate.dirty) * 100) / 100;
          const mustVisitUnitSoon =
            returnToUnit ||
            loadAfterCandidate >= vanCapacity ||
            stillRemaining.length > 0 &&
            !stillRemaining.some((later) => canDoJobWithStock(later, afterCandidate.clean, afterCandidate.dirty));

          return (
            estimateMinutesBetween(jobCoordinates, candidateCoordinates) +
            (mustVisitUnitSoon ? estimateMinutesBetween(candidateCoordinates, unitCoordinates) : 0)
          );
        }),
      );

      score += bestSecondLeg * 0.75;

      if (getDeliveryLoad(job) > 0) score -= 3;

      return score;
    };

    const scoredJobs = await Promise.all(
      feasibleJobs.map(async (job) => ({ job, score: await scoreNextJob(job) })),
    );
    const bestScoredJob = scoredJobs.sort((a, b) => a.score - b.score)[0];

    const deliveryNeed = getDeliveryNeed(remainingJobs);
    const canLoadMoreDeliveryStock =
      remainingJobs.some((job) => getDeliveryLoad(job) > 0) &&
      cleanLoad < Math.min(vanCapacity, deliveryNeed);

    if (canLoadMoreDeliveryStock) {
      const unitTravelMinutes = await calculateTravelMinutes(currentCoordinates, unitCoordinates, distanceProvider);
      const cleanAfterUnit = Math.min(vanCapacity, deliveryNeed);
      const feasibleAfterUnit = remainingJobs.filter((job) => canDoJobWithStock(job, cleanAfterUnit, 0));
      const bestNextLeg = feasibleAfterUnit.length
        ? Math.min(
            ...feasibleAfterUnit.map((job) =>
              estimateMinutesBetween(unitCoordinates, [job.latitude, job.longitude]),
            ),
          )
        : 0;

      let unitScore = unitTravelMinutes + bestNextLeg * 0.75;
      for (const later of remainingJobs) {
        const laterWindow = parseTimeWindow(later.timeWindow);
        if (!laterWindow) continue;
        const laterArrivalEstimate =
          workdayStartMinutes +
          elapsedMinutes +
          unitTravelMinutes +
          estimateMinutesBetween(unitCoordinates, [later.latitude, later.longitude]);
        unitScore += Math.max(0, laterArrivalEstimate - laterWindow.end) * 5000;
      }

      if (!bestScoredJob || unitScore < bestScoredJob.score) {
        await addUnitStop("Load clean delivery stock at the unit before continuing the route.");
        continue;
      }
    }

    const nextJob = bestScoredJob?.job;

    if (!nextJob) continue;

    const jobAddress = nextJob.addressLine || getTownLabel(nextJob.townId);
    const serviceMinutes = Math.max(1, Math.round(nextJob.duration || DELIVERY_SERVICE_MINUTES));

    try {
      const jobCoordinates: [number, number] = [
        nextJob.latitude,
        nextJob.longitude,
      ];
      const travelMinutes = await calculateTravelMinutes(
        currentCoordinates,
        jobCoordinates,
        distanceProvider,
      );
      elapsedMinutes += travelMinutes;
      const window = parseTimeWindow(nextJob.timeWindow);
      if (window) {
        const arrivalMinutes = workdayStartMinutes + elapsedMinutes;
        if (arrivalMinutes < window.start) {
          elapsedMinutes += window.start - arrivalMinutes;
        }
      }
      
      // Smart intermediate drop logic disabled to reduce API costs
      // TODO: Re-enable when caching is implemented
      // const loadPercentage = (currentLoad / vanCapacity) * 100;
      // const isHeavyLoad = loadPercentage > 60;
      // const isDistantJob = travelMinutes > 20;
      elapsedMinutes += serviceMinutes;

      const cleanBefore = cleanLoad;
      const dirtyBefore = dirtyLoad;
      const loadBefore = currentLoad();
      const deliveryLoad = getDeliveryLoad(nextJob);
      const pickupLoad = getPickupLoad(nextJob);
      cleanLoad = Math.round((cleanLoad - deliveryLoad) * 100) / 100;
      dirtyLoad = Math.round((dirtyLoad + pickupLoad) * 100) / 100;
      const loadAfter = currentLoad();
      const loadDelta = Math.round((loadAfter - loadBefore) * 100) / 100;

      stops.push({
        id: nextJob.id,
        kind: "job",
        label: `${nextJob.type === "both" ? "Delivery + Pickup" : nextJob.type === "pickup" ? "Pickup" : "Delivery"}: ${nextJob.customerName}`,
        townId: nextJob.townId,
        addressLine: jobAddress,
        latitude: nextJob.latitude,
        longitude: nextJob.longitude,
        etaMinutesFromStart: workdayStartMinutes + elapsedMinutes,
        travelMinutesFromPrevious: travelMinutes,
        serviceMinutes,
        loadBefore,
        loadAfter,
        deltaSofas: loadDelta,
        cleanLoadBefore: cleanBefore,
        cleanLoadAfter: cleanLoad,
        dirtyLoadBefore: dirtyBefore,
        dirtyLoadAfter: dirtyLoad,
        reason: nextJob.type === "both"
          ? "Deliver clean stock from the unit and collect a dirty return."
          : nextJob.type === "pickup"
            ? "Collect dirty return stock."
            : "Deliver clean stock loaded from the unit.",
        relatedJobId: nextJob.id,
        type: nextJob.type,
        status: nextJob.status,
      });

      currentCoordinates = jobCoordinates;

      // Remove job from remaining
      remainingJobs.splice(remainingJobs.indexOf(nextJob), 1);
    } catch (error) {
      console.error("Error calculating job travel time:", error);
      // Remove job anyway to avoid infinite loop
      remainingJobs.splice(remainingJobs.indexOf(nextJob), 1);
    }
  }

  // Return to unit at end
  if ((currentLoad() > 0 || stops.length > 0) && returnToUnit) {
    const unitAddress = settings.unitAddress || getTownLabel(settings.unitTownId);
    try {
      const unitCoordinates: [number, number] = [
        settings.unitLatitude,
        settings.unitLongitude,
      ];
      const travelMinutes = await calculateTravelMinutes(
        currentCoordinates,
        unitCoordinates,
        distanceProvider,
      );
      elapsedMinutes += travelMinutes;
      const loadBefore = currentLoad();
      const cleanBefore = cleanLoad;
      const dirtyBefore = dirtyLoad;
      const serviceMinutes = Math.round(loadBefore * UNIT_MINUTES_PER_SOFA_MOVED);
      cleanLoad = 0;
      dirtyLoad = 0;
      elapsedMinutes += serviceMinutes;

      stops.push({
        id: `unit-return-final`,
        kind: "unit",
        label: settings.unitLabel,
        townId: settings.unitTownId,
        addressLine: unitAddress,
        latitude: settings.unitLatitude,
        longitude: settings.unitLongitude,
        etaMinutesFromStart: workdayStartMinutes + elapsedMinutes,
        travelMinutesFromPrevious: travelMinutes,
        serviceMinutes,
        loadBefore,
        loadAfter: 0,
        deltaSofas: -loadBefore,
        cleanLoadBefore: cleanBefore,
        cleanLoadAfter: cleanLoad,
        dirtyLoadBefore: dirtyBefore,
        dirtyLoadAfter: dirtyLoad,
        reason: "Return to unit",
      });

      currentCoordinates = unitCoordinates;
    } catch (error) {
      console.error("Error calculating final return to unit travel time:", error);
    }
  }

  // Drop off helper at end of route (if one was picked up)
  if (pickedUpHelper) {
    const helperAddress = pickedUpHelper.addressLine || `${getTownLabel(pickedUpHelper.townId)}, Scotland`;
    try {
      const helperCoordinates: [number, number] = [
        pickedUpHelper.latitude,
        pickedUpHelper.longitude,
      ];
      const travelMinutes = await calculateTravelMinutes(
        currentCoordinates,
        helperCoordinates,
        distanceProvider,
      );
      elapsedMinutes += travelMinutes + HELPER_SERVICE_MINUTES;

      stops.push({
        id: `helper-dropoff-${pickedUpHelper.id}`,
        kind: "helper-dropoff",
        label: `Drop off ${pickedUpHelper.name}`,
        townId: pickedUpHelper.townId,
        addressLine: helperAddress,
        latitude: pickedUpHelper.latitude,
        longitude: pickedUpHelper.longitude,
        etaMinutesFromStart: workdayStartMinutes + elapsedMinutes,
        travelMinutesFromPrevious: travelMinutes,
        serviceMinutes: HELPER_SERVICE_MINUTES,
        loadBefore: currentLoad(),
        loadAfter: currentLoad(),
        deltaSofas: 0,
        cleanLoadBefore: cleanLoad,
        cleanLoadAfter: cleanLoad,
        dirtyLoadBefore: dirtyLoad,
        dirtyLoadAfter: dirtyLoad,
        reason: "Helper drop-off",
        relatedHelperId: pickedUpHelper.id,
      });

      currentCoordinates = helperCoordinates;
    } catch (error) {
      console.error("Error calculating helper drop-off travel time:", error);
    }
  }

  if (van) {
    try {
      const homeCoordinates: [number, number] = [van.latitude, van.longitude];
      const travelMinutes = await calculateTravelMinutes(
        currentCoordinates,
        homeCoordinates,
        distanceProvider,
      );
      elapsedMinutes += travelMinutes;

      stops.push({
        id: `home-${van.id}`,
        kind: "home",
        label: `${van.driverName} home`,
        townId: van.startingTownId,
        addressLine: van.addressLine,
        latitude: van.latitude,
        longitude: van.longitude,
        etaMinutesFromStart: workdayStartMinutes + elapsedMinutes,
        travelMinutesFromPrevious: travelMinutes,
        serviceMinutes: 0,
        loadBefore: currentLoad(),
        loadAfter: currentLoad(),
        deltaSofas: 0,
        cleanLoadBefore: cleanLoad,
        cleanLoadAfter: cleanLoad,
        dirtyLoadBefore: dirtyLoad,
        dirtyLoadAfter: dirtyLoad,
        reason: "Return home after the route.",
      });

      currentCoordinates = homeCoordinates;
    } catch (error) {
      console.error("Error calculating return home travel time:", error);
    }
  }

  const jobsById = new Map(scheduledJobs.map((job) => [job.id, job]));
  const workdayEndMinutes = timeStringToMinutes(settings.workdayEnd ?? "");
  const flowStartMinutes = chooseFlowStartMinutes(stops, jobsById, workdayStartMinutes, workdayEndMinutes);
  if (flowStartMinutes > workdayStartMinutes) {
    stops.splice(0, stops.length, ...rescheduleStopsFromStart(stops, jobsById, flowStartMinutes));
  }

  // Calculate summary
  const totalTravelMinutes = stops.reduce((sum, stop) => sum + stop.travelMinutesFromPrevious, 0);
  const totalServiceMinutes = stops.reduce((sum, stop) => sum + stop.serviceMinutes, 0);

  const pickupJobs = scheduledJobs.filter((job) => job.type === "pickup" || job.type === "both").length;
  const deliveryJobs = scheduledJobs.filter((job) => job.type === "delivery" || job.type === "both").length;
  const unitReturns = stops.filter((s) => s.kind === "unit").length;

  const nextStop = stops[0] || null;
  const routeHeadline = nextStop 
    ? `Starting with ${nextStop.label} in ${nextStop.townId}`
    : "No stops scheduled for this date.";

  return {
    dateKey,
    selectedHelper: null,
    helperReason: "Route helper selection pending.",
    stops,
    nextStop,
    routeHeadline,
    currentLoad: currentLoad(),
    summary: {
      totalStops: stops.length,
      totalJobs: scheduledJobs.length,
      pickupJobs,
      deliveryJobs,
      unitReturns,
      estimatedTravelMinutes: totalTravelMinutes,
      estimatedWorkMinutes: totalServiceMinutes,
      startingLoad: startingLoad,
      finalLoad: currentLoad(),
    },
  };
}
