import { getSessionCookieOptions } from "./_core/cookies";
import { COOKIE_NAME } from "../shared/const";
import { systemRouter } from "./_core/systemRouter";
import { publicProcedure, router } from "./_core/trpc";
import { z } from "zod";
import { cancelJob, completeJob, createHelper, createJob, createVan, createVehicle, deleteHelper, deleteJob, deleteVan, deleteVehicle, getSnapshot, getSelectedVanId, getVans, getVehicles, resetOperations, selectVan, updateDayEndTime, updateDayStartTime, updateHelper, updateJob, updateSettings, updateVan, updateVehicle } from "./operations-store";
import { buildEnhancedRoutePlan } from "./enhanced-route-planner";
import { createGeoapifyAddressProvider } from "./geoapify-service";

import { TOWN_OPTIONS, type RoutePlan } from "../shared/route-planner";

const townIds = Object.keys(TOWN_OPTIONS) as [keyof typeof TOWN_OPTIONS, ...(keyof typeof TOWN_OPTIONS)[]];
const jobTypeSchema = z.enum(["pickup", "delivery", "both"]);
const jobStatusSchema = z.enum(["scheduled", "cancelled", "completed"]);
const dateSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);
const addressProvider = createGeoapifyAddressProvider();

const jobInputSchema = z.object({
  customerName: z.string().min(1).max(120),
  contactName: z.string().min(1).max(120),
  contactPhone: z.string().min(5).max(30),
  addressLine: z.string().min(1).max(160),
  latitude: z.number(),
  longitude: z.number(),
  townId: z.string().optional(),
  type: jobTypeSchema,
  sofaCount: z.number().positive().max(6),
  pickupCount: z.number().min(0).max(6).optional(),
  scheduledDay: dateSchema,
  timeWindow: z.string().min(1).max(60),
  floor: z.string().max(50).optional(),
  duration: z.number().int().min(1).max(480).optional(),
  notes: z.string().max(240).optional(),
  photoUri: z.string().max(2_000_000).optional(),
});

export const appRouter = router({
  system: systemRouter,
  auth: router({
    me: publicProcedure.query((opts) => opts.ctx.user),
    logout: publicProcedure.mutation(({ ctx }) => {
      const cookieOptions = getSessionCookieOptions(ctx.req);
      ctx.res.clearCookie(COOKIE_NAME, { ...cookieOptions, maxAge: -1 });
      return {
        success: true,
      } as const;
    }),
  }),
  operations: router({
    snapshot: publicProcedure
      .input(
        z
          .object({
            dateKey: dateSchema.optional(),
          })
          .optional(),
      )
      .query(({ input }) => getSnapshot(input?.dateKey)),
    createJob: publicProcedure.input(jobInputSchema).mutation(async ({ input }) => {
      await createJob(input);
      return getSnapshot(input.scheduledDay);
    }),
    updateJob: publicProcedure
      .input(
        jobInputSchema.partial().extend({
          id: z.string().min(1),
          status: jobStatusSchema.optional(),
        }),
      )
      .mutation(async ({ input }) => {
        const updated = await updateJob(input);
        return {
          updated,
          snapshot: await getSnapshot(input.scheduledDay),
        };
      }),
    cancelJob: publicProcedure
      .input(
        z.object({
          id: z.string().min(1),
          dateKey: dateSchema,
        }),
      )
      .mutation(async ({ input }) => {
        await cancelJob(input.id);
        return getSnapshot(input.dateKey);
      }),
    deleteJob: publicProcedure
      .input(
        z.object({
          id: z.string().min(1),
          dateKey: dateSchema,
        }),
      )
      .mutation(async ({ input }) => {
        await deleteJob(input.id);
        return getSnapshot(input.dateKey);
      }),
    completeJob: publicProcedure
      .input(
        z.object({
          id: z.string().min(1),
          dateKey: dateSchema,
        }),
      )
      .mutation(async ({ input }) => {
        await completeJob(input.id);
        return getSnapshot(input.dateKey);
      }),
    getCompletedJobs: publicProcedure
      .input(
        z.object({
          dateKey: dateSchema.optional(),
        }),
      )
      .query(async ({ input }) => {
        const snapshot = await getSnapshot(input?.dateKey);
        const completedJobs = snapshot.jobs.filter((job) => job.status === 'completed');
        return {
          dateKey: snapshot.dateKey,
          completedJobs,
          totalCompleted: completedJobs.length,
        };
      }),
    updateSettings: publicProcedure
      .input(
        z.object({
          businessName: z.string().min(1).max(120).optional(),
          unitTownId: z.string().optional(),
          unitLabel: z.string().min(1).max(120).optional(),
          unitAddress: z.string().max(500).optional(),
          unitLatitude: z.number().optional(),
          unitLongitude: z.number().optional(),
          vanCapacity: z.number().int().min(1).max(6).optional(),
          optimizeFor: z.literal("time").optional(),
          workdayStart: z.string().min(4).max(10).optional(),
          workdayEnd: z.string().min(4).max(10).optional(),
          dateKey: dateSchema.optional(),
        }),
      )
      .mutation(async ({ input }) => {
        const { dateKey, ...settingsInput } = input;
        await updateSettings(settingsInput);
        return getSnapshot(dateKey);
      }),
    updateDayStartTime: publicProcedure
      .input(
        z.object({
          dateKey: dateSchema,
          startTime: z.string().regex(/^\d{2}:\d{2}$/).nullable(),
        }),
      )
      .mutation(({ input }) => updateDayStartTime(input.dateKey, input.startTime)),
    updateDayEndTime: publicProcedure
      .input(
        z.object({
          dateKey: dateSchema,
          endTime: z.string().regex(/^\d{2}:\d{2}$/).nullable(),
        }),
      )
      .mutation(({ input }) => updateDayEndTime(input.dateKey, input.endTime)),
    reset: publicProcedure
      .input(
        z
          .object({
            dateKey: dateSchema.optional(),
          })
          .optional(),
      )
      .mutation(({ input }) => resetOperations(input?.dateKey)),
    createVan: publicProcedure
      .input(
        z.object({
          driverName: z.string().min(1).max(120),
          vehicleId: z.string().min(1),
          startingTownId: z.string(),
          addressLine: z.string().max(240).optional(),
          latitude: z.number().optional(),
          longitude: z.number().optional(),
          assignedHelperIds: z.array(z.string()).optional(),
          notes: z.string().max(240).optional(),
        }),
      )
      .mutation(async ({ input }) => {
        const createdVan = await createVan(input);
        const vans = await getVans();
        return { createdVan, vans };
      }),
    getVans: publicProcedure.query(() => getVans()),
    getVehicles: publicProcedure.query(() => getVehicles()),
    createVehicle: publicProcedure
      .input(
        z.object({
          name: z.string().min(1).max(120),
          capacity: z.number().int().min(1).max(10),
          notes: z.string().max(240).optional(),
        }),
      )
      .mutation(async ({ input }) => {
        const createdVehicle = await createVehicle({
          name: input.name,
          capacity: input.capacity,
          notes: input.notes || "",
        });
        return { success: true, createdVehicle, vehicles: await getVehicles() };
      }),
    deleteVan: publicProcedure
      .input(
        z.object({
          id: z.string().min(1),
        }),
      )
      .mutation(async ({ input }) => {
        const deleted = await deleteVan(input.id);
        if (!deleted) {
          throw new Error("Failed to delete driver");
        }
        return { deleted: true, vans: await getVans() };
      }),
    createHelper: publicProcedure
      .input(
        z.object({
          name: z.string().min(1).max(120),
          townId: z.string().min(1),
          weekdayAvailable: z.boolean(),
          weekendAvailable: z.boolean(),
          addressLine: z.string().max(240).optional(),
          latitude: z.number().optional(),
          longitude: z.number().optional(),
          notes: z.string().max(240).optional(),
        }),
      )
      .mutation(async ({ input }) => {
        const createdHelper = await createHelper({
          name: input.name,
          townId: input.townId as keyof typeof TOWN_OPTIONS,
          weekdayAvailable: input.weekdayAvailable,
          weekendAvailable: input.weekendAvailable,
          addressLine: input.addressLine,
          latitude: input.latitude,
          longitude: input.longitude,
          notes: input.notes,
        });
        if (!createdHelper) {
          throw new Error("Failed to save helper");
        }
        const snapshot = await getSnapshot();
        return { createdHelper, helpers: snapshot.helpers };
      }),
    deleteHelper: publicProcedure
      .input(
        z.object({
          id: z.string().min(1),
        }),
      )
      .mutation(async ({ input }) => {
        const deleted = await deleteHelper(input.id);
        if (!deleted) {
          throw new Error("Failed to delete helper");
        }
        const snapshot = await getSnapshot();
        return { deleted: true, helpers: snapshot.helpers };
      }),
    updateVan: publicProcedure
      .input(
        z.object({
          id: z.string().min(1),
          driverName: z.string().min(1).max(120).optional(),
          vehicleId: z.string().min(1).optional(),
          startingTownId: z.string().optional(),
          addressLine: z.string().max(240).optional(),
          latitude: z.number().optional(),
          longitude: z.number().optional(),
          assignedHelperIds: z.array(z.string()).optional(),
          notes: z.string().max(240).optional(),
        }),
      )
      .mutation(async ({ input }) => {
        const { id, ...updates } = input;
        const updatedVan = await updateVan(id, updates as Parameters<typeof updateVan>[1]);
        if (!updatedVan) {
          throw new Error("Failed to update driver");
        }
        return getVans();
      }),
    updateHelper: publicProcedure
      .input(
        z.object({
          id: z.string().min(1),
          name: z.string().min(1).max(120).optional(),
          townId: z.string().min(1).optional(),
          weekdayAvailable: z.boolean().optional(),
          weekendAvailable: z.boolean().optional(),
          addressLine: z.string().max(240).optional(),
          latitude: z.number().optional(),
          longitude: z.number().optional(),
          notes: z.string().max(240).optional(),
        }),
      )
      .mutation(async ({ input }) => {
        const updatedHelper = await updateHelper(input.id, {
          name: input.name,
          townId: input.townId as keyof typeof TOWN_OPTIONS | undefined,
          weekdayAvailable: input.weekdayAvailable,
          weekendAvailable: input.weekendAvailable,
          addressLine: input.addressLine,
          latitude: input.latitude,
          longitude: input.longitude,
          notes: input.notes,
        });
        if (!updatedHelper) {
          throw new Error("Failed to update helper");
        }
        return { success: true };
      }),
    updateVehicle: publicProcedure
      .input(
        z.object({
          id: z.string().min(1),
          name: z.string().min(1).max(120).optional(),
          capacity: z.number().int().min(1).max(10).optional(),
          notes: z.string().max(240).optional(),
        }),
      )
      .mutation(async ({ input }) => {
        const { id, ...updates } = input;
        const updatedVehicle = await updateVehicle(id, updates);
        if (!updatedVehicle) {
          throw new Error("Failed to update vehicle");
        }
        return { success: true, updatedVehicle, vehicles: await getVehicles() };
      }),
    deleteVehicle: publicProcedure
      .input(
        z.object({
          id: z.string().min(1),
        }),
      )
      .mutation(async ({ input }) => {
        const deleted = await deleteVehicle(input.id);
        if (!deleted) {
          throw new Error("Failed to delete vehicle");
        }
        return { success: true, vehicles: await getVehicles(), vans: await getVans() };
      }),
    enhancedRoutePlan: publicProcedure
      .input(
        z.object({
          dateKey: dateSchema,
          vanId: z.string().optional(),
          includeHelper: z.boolean().optional(),
          returnToUnit: z.boolean().optional(),
        }),
      )
      .query(async ({ input }) => {
        // Use getSnapshot to get the same data source as the standard route
        const snapshot = await getSnapshot(input.dateKey);

        const van = input.vanId
          ? snapshot.vans.find((candidate) => candidate.id === input.vanId)
          : snapshot.vans.find((candidate) => candidate.id === snapshot.selectedVanId) ?? snapshot.vans[0];
        // Use todaysJobs which are already filtered by dateKey
        const routePlan = await buildEnhancedRoutePlan(
          snapshot.todaysJobs,
          snapshot.helpers,
          snapshot.settings,
          input.dateKey,
          van,
          {
            includeHelper: input.includeHelper,
            returnToUnit: input.returnToUnit,
          }
        );
        return routePlan;
      }),
    saveRouteOrder: publicProcedure
      .input(
        z.object({
          dateKey: dateSchema,
          stopIds: z.array(z.string()),
        }),
      )
      .mutation(async ({ input }) => {
        const { saveRouteOrderInDb, saveRouteOrderHistoryInDb } = await import("./db");
        await saveRouteOrderInDb(input.dateKey, input.stopIds);
        await saveRouteOrderHistoryInDb(input.dateKey, input.stopIds, "reorder");
        return { success: true };
      }),
    loadRouteOrder: publicProcedure
      .input(
        z.object({
          dateKey: dateSchema,
        }),
      )
      .query(async ({ input }) => {
        const { loadRouteOrderFromDb } = await import("./db");
        const routeOrder = await loadRouteOrderFromDb(input.dateKey);
        return routeOrder?.stopIds ? JSON.parse(routeOrder.stopIds) : null;
      }),
    deleteRouteOrder: publicProcedure
      .input(
        z.object({
          dateKey: dateSchema,
        }),
      )
      .mutation(async ({ input }) => {
        const { deleteRouteOrderInDb, saveRouteOrderHistoryInDb } = await import("./db");
        await deleteRouteOrderInDb(input.dateKey);
        await saveRouteOrderHistoryInDb(input.dateKey, [], "reset");
        return { success: true };
      }),
    getRouteOrderHistory: publicProcedure
      .input(
        z.object({
          dateKey: dateSchema,
        }),
      )
      .query(async ({ input }) => {
        const { getRouteOrderHistoryFromDb } = await import("./db");
        const history = await getRouteOrderHistoryFromDb(input.dateKey);
        return history;
      }),
    revertToHistoryVersion: publicProcedure
      .input(
        z.object({
          dateKey: dateSchema,
          historyId: z.string(),
        }),
      )
      .mutation(async ({ input }) => {
        const { getRouteOrderHistoryItemFromDb, saveRouteOrderInDb } = await import("./db");
        const historyItem = await getRouteOrderHistoryItemFromDb(input.historyId);
        if (!historyItem) {
          throw new Error("History item not found");
        }
        await saveRouteOrderInDb(input.dateKey, JSON.parse(historyItem.stopIds));
        return { success: true };
      }),
  }),
  addresses: router({
    search: publicProcedure
      .input(z.object({ query: z.string().min(3) }))
      .query(async ({ input }) => {
        try {
          const results = await addressProvider.autocomplete(input.query);
          return {
            predictions: results.map((result) => ({
              description: result.formatted,
              place_id: result.placeId ?? result.formatted,
              postcode: result.postcode,
              town: result.town,
              latitude: result.latitude,
              longitude: result.longitude,
            })),
            status: "OK",
          };
        } catch (error) {
          console.error("[Geoapify] Address search error:", error);
          throw new Error("Failed to search addresses");
        }
      }),
    getDetails: publicProcedure
      .input(z.object({ placeId: z.string() }))
      .query(async ({ input }) => {
        try {
          const result = await addressProvider.geocode(input.placeId);
          return {
            address: result?.formatted ?? "",
            postcode: result?.postcode ?? "",
            latitude: result?.latitude,
            longitude: result?.longitude,
          };
        } catch (error) {
          console.error("[Geoapify] Address details error:", error);
          throw new Error("Failed to get address details");
        }
      }),
  }),
});

export type AppRouter = typeof appRouter;
