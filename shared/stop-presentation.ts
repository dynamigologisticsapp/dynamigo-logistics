import type { JobStatus, JobType, RouteStop, StopKind } from "./route-planner";

export function getStopTitle(kind: StopKind, type?: JobType) {
  if (kind === "helper") return "Helper pickup";
  if (kind === "helper-dropoff") return "Helper drop-off";
  if (kind === "home") return "Return home";
  if (kind === "start") return "Driver start";
  if (kind === "unit") return "Unit return";
  return type === "pickup" ? "Pickup stop" : "Delivery stop";
}

export function isActionableJobStop(stop: RouteStop | null | undefined, jobStatus?: JobStatus) {
  return Boolean(stop && stop.kind === "job" && stop.relatedJobId && jobStatus === "scheduled");
}

export function getNonJobStopGuidance(kind: StopKind) {
  if (kind === "start") {
    return {
      title: "Start from the driver address.",
      body: "This is the driver's starting point from settings. It prepares the route but is not a customer job.",
    };
  }

  if (kind === "helper") {
    return {
      title: "Pick up helper before the first job.",
      body: "This stop prepares the day but should not be marked as a completed customer job. Once you have the helper onboard, the next customer stop becomes actionable.",
    };
  }

  if (kind === "helper-dropoff") {
    return {
      title: "Drop off helper after the job sequence.",
      body: "This finishes the helper part of the route and should not be marked as a completed customer job.",
    };
  }

  if (kind === "home") {
    return {
      title: "Return home after the route.",
      body: "This is the driver's final home leg. Mark it complete when the route is finished.",
    };
  }

  return {
    title: "Return to the unit before continuing.",
    body: "This unit stop is part of the route logic for van load balancing. After the unit visit, the next customer stop becomes actionable.",
  };
}
