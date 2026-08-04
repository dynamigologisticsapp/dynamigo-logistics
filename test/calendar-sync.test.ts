import { describe, it, expect, beforeEach } from "vitest";
import { buildOperationsSnapshot, todayKey, createJobRecord, validateRouteInputs, TOWN_OPTIONS } from "../shared/route-planner";
import type { SeedState, JobRecord } from "../shared/route-planner";

describe("Calendar Synchronization and Date Filtering", () => {
  let today: string;
  let tomorrow: string;
  let dayAfter: string;

  beforeEach(() => {
    const now = new Date();
    today = todayKey(now);
    
    const tomorrowDate = new Date(now);
    tomorrowDate.setDate(tomorrowDate.getDate() + 1);
    tomorrow = todayKey(tomorrowDate);
    
    const dayAfterDate = new Date(now);
    dayAfterDate.setDate(dayAfterDate.getDate() + 2);
    dayAfter = todayKey(dayAfterDate);
  });

  it("should filter jobs by scheduled date when building snapshot", () => {
    // Create test state with jobs on different dates
    const state: SeedState = {
      settings: {
        businessName: "Test",
        unitTownId: "falkirk",
        unitLabel: "Unit",
        unitAddress: "Address",
        unitLatitude: TOWN_OPTIONS.falkirk.latitude,
        unitLongitude: TOWN_OPTIONS.falkirk.longitude,
        vanCapacity: 3,
        optimizeFor: "time",
        workdayStart: "08:30",
        workdayEnd: "17:30",
      },
      helpers: [],
      jobs: [
        createJobRecord({
          customerName: "Job 1",
          contactName: "Contact 1",
          contactPhone: "123",
          addressLine: "Address 1",
          townId: "glasgow",
          latitude: TOWN_OPTIONS.glasgow.latitude,
          longitude: TOWN_OPTIONS.glasgow.longitude,
          type: "pickup",
          sofaCount: 1,
          scheduledDay: today,
          timeWindow: "09:00 - 11:00",
        }),
        createJobRecord({
          customerName: "Job 2",
          contactName: "Contact 2",
          contactPhone: "456",
          addressLine: "Address 2",
          townId: "edinburgh",
          latitude: TOWN_OPTIONS.edinburgh.latitude,
          longitude: TOWN_OPTIONS.edinburgh.longitude,
          type: "delivery",
          sofaCount: 1,
          scheduledDay: tomorrow,
          timeWindow: "09:00 - 11:00",
        }),
        createJobRecord({
          customerName: "Job 3",
          contactName: "Contact 3",
          contactPhone: "789",
          addressLine: "Address 3",
          townId: "stirling",
          latitude: TOWN_OPTIONS.stirling.latitude,
          longitude: TOWN_OPTIONS.stirling.longitude,
          type: "pickup",
          sofaCount: 1,
          scheduledDay: dayAfter,
          timeWindow: "09:00 - 11:00",
        }),
      ],
    };

    // Test snapshot for today
    const validatedJobsForToday = validateRouteInputs(state.jobs, state.settings);
    const snapshotToday = buildOperationsSnapshot({ ...state, jobs: validatedJobsForToday }, today);
    expect(snapshotToday.todaysJobs).toHaveLength(1);
    expect(snapshotToday.todaysJobs[0].customerName).toBe("Job 1");
    expect(snapshotToday.todaysJobs[0].scheduledDay).toBe(today);

    // Test snapshot for tomorrow
    const validatedJobsForTomorrow = validateRouteInputs(state.jobs, state.settings);
    const snapshotTomorrow = buildOperationsSnapshot({ ...state, jobs: validatedJobsForTomorrow }, tomorrow);
    expect(snapshotTomorrow.todaysJobs).toHaveLength(1);
    expect(snapshotTomorrow.todaysJobs[0].customerName).toBe("Job 2");
    expect(snapshotTomorrow.todaysJobs[0].scheduledDay).toBe(tomorrow);

    // Test snapshot for day after
    const validatedJobsForDayAfter = validateRouteInputs(state.jobs, state.settings);
    const snapshotDayAfter = buildOperationsSnapshot({ ...state, jobs: validatedJobsForDayAfter }, dayAfter);
    expect(snapshotDayAfter.todaysJobs).toHaveLength(1);
    expect(snapshotDayAfter.todaysJobs[0].customerName).toBe("Job 3");
    expect(snapshotDayAfter.todaysJobs[0].scheduledDay).toBe(dayAfter);
  });

  it("should return only jobs for selected date in snapshot.jobs field", () => {
    const state: SeedState = {
      settings: {
        businessName: "Test",
        unitTownId: "falkirk",
        unitLabel: "Unit",
        unitAddress: "Address",
        unitLatitude: TOWN_OPTIONS.falkirk.latitude,
        unitLongitude: TOWN_OPTIONS.falkirk.longitude,
        vanCapacity: 3,
        optimizeFor: "time",
        workdayStart: "08:30",
        workdayEnd: "17:30",
      },
      helpers: [],
      jobs: [
        createJobRecord({
          customerName: "Job 1",
          contactName: "Contact 1",
          contactPhone: "123",
          addressLine: "Address 1",
          townId: "glasgow",
          latitude: TOWN_OPTIONS.glasgow.latitude,
          longitude: TOWN_OPTIONS.glasgow.longitude,
          type: "pickup",
          sofaCount: 1,
          scheduledDay: today,
          timeWindow: "09:00 - 11:00",
        }),
        createJobRecord({
          customerName: "Job 2",
          contactName: "Contact 2",
          contactPhone: "456",
          addressLine: "Address 2",
          townId: "edinburgh",
          latitude: TOWN_OPTIONS.edinburgh.latitude,
          longitude: TOWN_OPTIONS.edinburgh.longitude,
          type: "delivery",
          sofaCount: 1,
          scheduledDay: tomorrow,
          timeWindow: "09:00 - 11:00",
        }),
      ],
    };

    const validatedJobs = validateRouteInputs(state.jobs, state.settings);
    const snapshot = buildOperationsSnapshot({ ...state, jobs: validatedJobs }, today);
    
    // The jobs field should contain only today's jobs
    expect(snapshot.jobs).toHaveLength(1);
    expect(snapshot.jobs[0].scheduledDay).toBe(today);
  });

  it("should show empty route when no jobs scheduled for a date", () => {
    const state: SeedState = {
      settings: {
        businessName: "Test",
        unitTownId: "falkirk",
        unitLabel: "Unit",
        unitAddress: "Address",
        unitLatitude: TOWN_OPTIONS.falkirk.latitude,
        unitLongitude: TOWN_OPTIONS.falkirk.longitude,
        vanCapacity: 3,
        optimizeFor: "time",
        workdayStart: "08:30",
        workdayEnd: "17:30",
      },
      helpers: [],
      jobs: [
        createJobRecord({
          customerName: "Job 1",
          contactName: "Contact 1",
          contactPhone: "123",
          addressLine: "Address 1",
          townId: "glasgow",
          latitude: TOWN_OPTIONS.glasgow.latitude,
          longitude: TOWN_OPTIONS.glasgow.longitude,
          type: "pickup",
          sofaCount: 1,
          scheduledDay: today,
          timeWindow: "09:00 - 11:00",
        }),
      ],
    };

    // Query for tomorrow when no jobs are scheduled
    const validatedJobs = validateRouteInputs(state.jobs, state.settings);
    const snapshot = buildOperationsSnapshot({ ...state, jobs: validatedJobs }, tomorrow);
    
    expect(snapshot.todaysJobs).toHaveLength(0);
    expect(snapshot.jobs).toHaveLength(0);
    expect(snapshot.routePlan.stops).toHaveLength(0);
    // The headline should indicate no jobs or no active stops
    expect(snapshot.routePlan.routeHeadline).toMatch(/No jobs|No active stops/);
  });

  it("should maintain job date integrity across multiple date selections", () => {
    const state: SeedState = {
      settings: {
        businessName: "Test",
        unitTownId: "falkirk",
        unitLabel: "Unit",
        unitAddress: "Address",
        unitLatitude: TOWN_OPTIONS.falkirk.latitude,
        unitLongitude: TOWN_OPTIONS.falkirk.longitude,
        vanCapacity: 3,
        optimizeFor: "time",
        workdayStart: "08:30",
        workdayEnd: "17:30",
      },
      helpers: [],
      jobs: [
        createJobRecord({
          customerName: "Today Job",
          contactName: "Contact",
          contactPhone: "123",
          addressLine: "Address",
          townId: "glasgow",
          latitude: TOWN_OPTIONS.glasgow.latitude,
          longitude: TOWN_OPTIONS.glasgow.longitude,
          type: "pickup",
          sofaCount: 1,
          scheduledDay: today,
          timeWindow: "09:00 - 11:00",
        }),
        createJobRecord({
          customerName: "Tomorrow Job",
          contactName: "Contact",
          contactPhone: "456",
          addressLine: "Address",
          townId: "edinburgh",
          latitude: TOWN_OPTIONS.edinburgh.latitude,
          longitude: TOWN_OPTIONS.edinburgh.longitude,
          type: "delivery",
          sofaCount: 1,
          scheduledDay: tomorrow,
          timeWindow: "09:00 - 11:00",
        }),
      ],
    };

    // Simulate user switching between dates
    const validatedJobs = validateRouteInputs(state.jobs, state.settings);
    const snapshotToday = buildOperationsSnapshot({ ...state, jobs: validatedJobs }, today);
    const snapshotTomorrow = buildOperationsSnapshot({ ...state, jobs: validatedJobs }, tomorrow);
    const snapshotBackToToday = buildOperationsSnapshot({ ...state, jobs: validatedJobs }, today);

    // Verify today's snapshot is consistent
    expect(snapshotToday.todaysJobs).toHaveLength(1);
    expect(snapshotToday.todaysJobs[0].customerName).toBe("Today Job");
    
    expect(snapshotBackToToday.todaysJobs).toHaveLength(1);
    expect(snapshotBackToToday.todaysJobs[0].customerName).toBe("Today Job");

    // Verify tomorrow's snapshot is correct
    expect(snapshotTomorrow.todaysJobs).toHaveLength(1);
    expect(snapshotTomorrow.todaysJobs[0].customerName).toBe("Tomorrow Job");
  });
});
