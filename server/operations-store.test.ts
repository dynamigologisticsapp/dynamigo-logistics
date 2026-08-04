import { describe, expect, it } from "vitest";
import { getSnapshot } from "./operations-store";
import { todayKey } from "../shared/route-planner";

describe("operations store date snapshots", () => {
  it("returns an empty snapshot for a selected day with no jobs instead of seeding or leaking another day", async () => {
    const today = todayKey();
    const emptyDate = "2099-01-17";

    expect(emptyDate).not.toBe(today);

    const snapshot = await getSnapshot(emptyDate);

    expect(snapshot.dateKey).toBe(emptyDate);
    expect(snapshot.jobs).toHaveLength(0);
    expect(snapshot.todaysJobs).toHaveLength(0);
    expect(snapshot.activeJobs).toHaveLength(0);
    expect(snapshot.routePlan.dateKey).toBe(emptyDate);
    expect(snapshot.routePlan.stops).toHaveLength(0);
  });
});
