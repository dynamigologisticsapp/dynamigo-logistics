import { describe, expect, it } from "vitest";

import { getNonJobStopGuidance, getStopTitle, isActionableJobStop } from "../shared/stop-presentation";
import type { RouteStop } from "../shared/route-planner";

const baseJobStop: RouteStop = {
  id: "stop_job_1",
  kind: "job",
  label: "Customer stop",
  townId: "glasgow",
  addressLine: "1 High Street, Glasgow",
  latitude: 55.8642,
  longitude: -4.2518,
  etaMinutesFromStart: 60,
  travelMinutesFromPrevious: 18,
  serviceMinutes: 18,
  loadBefore: 2,
  loadAfter: 1,
  deltaSofas: -1,
  reason: "Delivery removes stock from the van.",
  relatedJobId: "job_1",
  type: "delivery",
  status: "scheduled",
};

describe("stop presentation", () => {
  it("returns the correct stop titles for helper, unit, pickup, and delivery stops", () => {
    expect(getStopTitle("helper")).toBe("Helper pickup");
    expect(getStopTitle("unit")).toBe("Unit return");
    expect(getStopTitle("job", "pickup")).toBe("Pickup stop");
    expect(getStopTitle("job", "delivery")).toBe("Delivery stop");
  });

  it("marks only scheduled job stops as actionable", () => {
    expect(isActionableJobStop(baseJobStop, "scheduled")).toBe(true);
    expect(isActionableJobStop(baseJobStop, "completed")).toBe(false);
    expect(isActionableJobStop({ ...baseJobStop, relatedJobId: undefined }, "scheduled")).toBe(false);
    expect(
      isActionableJobStop(
        {
          ...baseJobStop,
          kind: "helper",
          relatedHelperId: "helper_1",
          relatedJobId: undefined,
        },
        undefined,
      ),
    ).toBe(false);
  });

  it("returns non-job guidance matched to helper and unit stops", () => {
    expect(getNonJobStopGuidance("helper").title).toContain("Pick up helper");
    expect(getNonJobStopGuidance("helper").body).toContain("should not be marked as a completed customer job");
    expect(getNonJobStopGuidance("unit").title).toContain("Return to the unit");
    expect(getNonJobStopGuidance("unit").body).toContain("van load balancing");
  });
});
