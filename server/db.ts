import { drizzle } from "drizzle-orm/mysql2";
import { eq, sql } from "drizzle-orm";
import { InsertUser, users, jobs, helpers, businessSettings, vans, vehicles, routeOrders, routeOrderHistory, type Job, type Helper, type BusinessSettings, type Van, type Vehicle, type RouteOrder, type RouteOrderHistory } from "../drizzle/schema";
import { ENV } from "./_core/env";

let _db: ReturnType<typeof drizzle> | null = null;

function rowsFromRawResult<T>(result: unknown): T[] {
  if (Array.isArray(result)) {
    if (Array.isArray(result[0])) return result[0] as T[];
    return result as T[];
  }
  if (result && typeof result === "object" && Array.isArray((result as { rows?: unknown[] }).rows)) {
    return (result as { rows: T[] }).rows;
  }
  return [];
}

// Lazily create the drizzle instance so local tooling can run without a DB.
export async function getDb() {
  if (!_db && process.env.DATABASE_URL) {
    try {
      _db = drizzle(process.env.DATABASE_URL);
    } catch (error) {
      console.warn("[Database] Failed to connect:", error);
      _db = null;
    }
  }
  return _db;
}

export async function upsertUser(user: InsertUser): Promise<void> {
  if (!user.openId) {
    throw new Error("User openId is required for upsert");
  }

  const db = await getDb();
  if (!db) {
    console.warn("[Database] Cannot upsert user: database not available");
    return;
  }

  try {
    const values: InsertUser = {
      openId: user.openId,
    };
    const updateSet: Record<string, unknown> = {};

    const textFields = ["name", "email", "loginMethod"] as const;
    type TextField = (typeof textFields)[number];

    const assignNullable = (field: TextField) => {
      const value = user[field];
      if (value === undefined) return;
      const normalized = value ?? null;
      values[field] = normalized;
      updateSet[field] = normalized;
    };

    textFields.forEach(assignNullable);

    if (user.lastSignedIn !== undefined) {
      values.lastSignedIn = user.lastSignedIn;
      updateSet.lastSignedIn = user.lastSignedIn;
    }
    if (user.role !== undefined) {
      values.role = user.role;
      updateSet.role = user.role;
    } else if (user.openId === ENV.ownerOpenId) {
      values.role = "admin";
      updateSet.role = "admin";
    }

    if (!values.lastSignedIn) {
      values.lastSignedIn = new Date();
    }

    if (Object.keys(updateSet).length === 0) {
      updateSet.lastSignedIn = new Date();
    }

    await db.insert(users).values(values).onDuplicateKeyUpdate({
      set: updateSet,
    });
  } catch (error) {
    console.error("[Database] Failed to upsert user:", error);
    throw error;
  }
}

export async function getUserByOpenId(openId: string) {
  const db = await getDb();
  if (!db) {
    console.warn("[Database] Cannot get user: database not available");
    return undefined;
  }

  const result = await db.select().from(users).where(eq(users.openId, openId)).limit(1);

  return result.length > 0 ? result[0] : undefined;
}

// Job operations
export async function createJobInDb(job: typeof jobs.$inferInsert): Promise<Job | null> {
  const db = await getDb();
  if (!db) {
    console.warn("[Database] Cannot create job: database not available");
    return null;
  }

  try {
    await db.insert(jobs).values(job);
    return job as Job;
  } catch (error) {
    console.error("[Database] Failed to create job:", error);
    return null;
  }
}

export async function getJobsForDay(scheduledDay: string): Promise<Job[]> {
  const db = await getDb();
  if (!db) {
    console.warn("[Database] Cannot get jobs: database not available");
    return [];
  }

  try {
    return await db.select().from(jobs).where(eq(jobs.scheduledDay, scheduledDay));
  } catch (error) {
    console.error("[Database] Failed to get jobs:", error);
    return [];
  }
}

export async function deleteJobsForDay(scheduledDay: string): Promise<void> {
  const db = await getDb();
  if (!db) {
    console.warn("[Database] Cannot delete jobs: database not available");
    return;
  }

  try {
    await db.delete(jobs).where(eq(jobs.scheduledDay, scheduledDay));
  } catch (error) {
    console.error("[Database] Failed to delete jobs for day:", error);
  }
}

export async function deleteJobInDb(jobId: string): Promise<boolean> {
  const db = await getDb();
  if (!db) {
    console.warn("[Database] Cannot delete job: database not available");
    return false;
  }

  try {
    await db.delete(jobs).where(eq(jobs.id, jobId));
    return true;
  } catch (error) {
    console.error("[Database] Failed to delete job:", error);
    return false;
  }
}

export async function getAllJobs(): Promise<Job[]> {
  const db = await getDb();
  if (!db) {
    console.warn("[Database] Cannot get jobs: database not available");
    return [];
  }

  try {
    return await db.select().from(jobs);
  } catch (error) {
    console.error("[Database] Failed to get all jobs:", error);
    return [];
  }
}

export async function updateJobInDb(id: string, updates: Partial<typeof jobs.$inferInsert>): Promise<Job | null> {
  const db = await getDb();
  if (!db) {
    console.warn("[Database] Cannot update job: database not available");
    return null;
  }

  try {
    await db.update(jobs).set({ ...updates, updatedAt: new Date() }).where(eq(jobs.id, id));
    const result = await db.select().from(jobs).where(eq(jobs.id, id)).limit(1);
    return result.length > 0 ? result[0] : null;
  } catch (error) {
    console.error("[Database] Failed to update job:", error);
    return null;
  }
}

// Helper operations
export async function createHelperInDb(helper: typeof helpers.$inferInsert): Promise<Helper | null> {
  const db = await getDb();
  if (!db) {
    console.warn("[Database] Cannot create helper: database not available");
    return null;
  }

  try {
    await db.insert(helpers).values(helper);
    return helper as Helper;
  } catch (error) {
    console.error("[Database] Failed to create helper:", error);
    return null;
  }
}

export async function getAllHelpers(): Promise<Helper[]> {
  const db = await getDb();
  if (!db) {
    console.warn("[Database] Cannot get helpers: database not available");
    return [];
  }

  try {
    return await db.select().from(helpers);
  } catch (error) {
    try {
      const result = await db.execute(sql`
        SELECT id, name, townId, weekdayAvailable, weekendAvailable, notes, addressLine,
               NULL AS latitude, NULL AS longitude
        FROM helpers
      `);
      return rowsFromRawResult<Helper>(result);
    } catch (fallbackError) {
      console.error("[Database] Failed to get helpers:", fallbackError);
      return [];
    }
  }
}

// Business settings operations
export async function getBusinessSettings(): Promise<BusinessSettings | null> {
  const db = await getDb();
  if (!db) {
    console.warn("[Database] Cannot get settings: database not available");
    return null;
  }

  try {
    const result = await db.select().from(businessSettings).limit(1);
    return result.length > 0 ? result[0] : null;
  } catch (error) {
    try {
      const result = await db.execute(sql`
        SELECT id, businessName, unitTownId, unitLabel, unitAddress,
               NULL AS unitLatitude, NULL AS unitLongitude,
               vanCapacity, workdayStart, optimizeFor, createdAt, updatedAt
        FROM businessSettings
        LIMIT 1
      `);
      const rows = rowsFromRawResult<BusinessSettings>(result);
      return rows.length > 0 ? rows[0] : null;
    } catch (fallbackError) {
      console.error("[Database] Failed to get settings:", fallbackError);
      return null;
    }
  }
}

export async function upsertBusinessSettings(settings: typeof businessSettings.$inferInsert): Promise<BusinessSettings | null> {
  const db = await getDb();
  if (!db) {
    console.warn("[Database] Cannot upsert settings: database not available");
    return null;
  }

  try {
    const existing = await getBusinessSettings();
    if (existing) {
      await db.update(businessSettings).set({ ...settings, updatedAt: new Date() }).where(eq(businessSettings.id, existing.id));
      const result = await db.select().from(businessSettings).where(eq(businessSettings.id, existing.id)).limit(1);
      return result.length > 0 ? result[0] : null;
    } else {
      await db.insert(businessSettings).values(settings);
      return settings as BusinessSettings;
    }
  } catch (error) {
    try {
      const {
        unitLatitude: _unitLatitude,
        unitLongitude: _unitLongitude,
        workdayEnd: _workdayEnd,
        ...settingsWithoutCoordinates
      } = settings;
      const existing = await getBusinessSettings();
      if (existing) {
        await db.update(businessSettings).set({ ...settingsWithoutCoordinates, updatedAt: new Date() }).where(eq(businessSettings.id, existing.id));
        return { ...existing, ...settingsWithoutCoordinates, unitLatitude: null, unitLongitude: null } as BusinessSettings;
      }
      await db.insert(businessSettings).values(settingsWithoutCoordinates);
      return { ...settingsWithoutCoordinates, unitLatitude: null, unitLongitude: null } as BusinessSettings;
    } catch (fallbackError) {
      console.error("[Database] Failed to upsert settings:", fallbackError);
      return null;
    }
  }
}

// Vehicle operations
export async function createVehicleInDb(vehicle: typeof vehicles.$inferInsert): Promise<Vehicle | null> {
  const db = await getDb();
  if (!db) {
    console.warn("[Database] Cannot create vehicle: database not available");
    return null;
  }

  try {
    await db.insert(vehicles).values(vehicle);
    return vehicle as Vehicle;
  } catch (error) {
    console.error("[Database] Failed to create vehicle:", error);
    return null;
  }
}

export async function getAllVehicles(): Promise<Vehicle[]> {
  const db = await getDb();
  if (!db) {
    console.warn("[Database] Cannot get vehicles: database not available");
    return [];
  }

  try {
    return await db.select().from(vehicles);
  } catch (error) {
    console.error("[Database] Failed to get vehicles:", error);
    return [];
  }
}

export async function updateVehicleInDb(
  vehicleId: string,
  updates: Partial<typeof vehicles.$inferInsert>
): Promise<Vehicle | null> {
  const db = await getDb();
  if (!db) {
    console.warn("[Database] Cannot update vehicle: database not available");
    return null;
  }

  try {
    await db.update(vehicles).set(updates).where(eq(vehicles.id, vehicleId));
    const result = await db.select().from(vehicles).where(eq(vehicles.id, vehicleId)).limit(1);
    return result.length > 0 ? result[0] : null;
  } catch (error) {
    console.error("[Database] Failed to update vehicle:", error);
    return null;
  }
}

export async function deleteVehicleInDb(vehicleId: string): Promise<boolean> {
  const db = await getDb();
  if (!db) {
    console.warn("[Database] Cannot delete vehicle: database not available");
    return false;
  }

  try {
    await db.delete(vehicles).where(eq(vehicles.id, vehicleId));
    return true;
  } catch (error) {
    console.error("[Database] Failed to delete vehicle:", error);
    return false;
  }
}

// Helper operations (update, delete)
export async function updateHelperInDb(helperId: string, updates: Partial<typeof helpers.$inferInsert>): Promise<Helper | null> {
  const db = await getDb();
  if (!db) {
    console.warn("[Database] Cannot update helper: database not available");
    return null;
  }

  try {
    await db.update(helpers).set(updates).where(eq(helpers.id, helperId));
    const result = await db.select().from(helpers).where(eq(helpers.id, helperId)).limit(1);
    return result.length > 0 ? result[0] : null;
  } catch (error) {
    try {
      const { latitude: _latitude, longitude: _longitude, ...updatesWithoutCoordinates } = updates;
      await db.update(helpers).set(updatesWithoutCoordinates).where(eq(helpers.id, helperId));
      const result = await db.execute(sql`
        SELECT id, name, townId, weekdayAvailable, weekendAvailable, notes, addressLine,
               NULL AS latitude, NULL AS longitude
        FROM helpers
        WHERE id = ${helperId}
        LIMIT 1
      `);
      const rows = rowsFromRawResult<Helper>(result);
      return rows.length > 0 ? rows[0] : null;
    } catch (fallbackError) {
      console.error("[Database] Failed to update helper:", fallbackError);
      return null;
    }
  }
}

export async function deleteHelperInDb(helperId: string): Promise<boolean> {
  const db = await getDb();
  if (!db) {
    console.warn("[Database] Cannot delete helper: database not available");
    return false;
  }

  try {
    await db.delete(helpers).where(eq(helpers.id, helperId));
    return true;
  } catch (error) {
    console.error("[Database] Failed to delete helper:", error);
    return false;
  }
}

// Van operations (drivers assigned to vehicles)
export async function createVanInDb(van: typeof vans.$inferInsert): Promise<Van | null> {
  const db = await getDb();
  if (!db) {
    console.warn("[Database] Cannot create van: database not available");
    return null;
  }

  try {
    await db.insert(vans).values(van);
    return van as Van;
  } catch (error) {
    console.error("[Database] Failed to create van:", error);
    return null;
  }
}

export async function getAllVans(): Promise<Van[]> {
  const db = await getDb();
  if (!db) {
    console.warn("[Database] Cannot get vans: database not available");
    return [];
  }

  try {
    return await db.select().from(vans);
  } catch (error) {
    try {
      const result = await db.execute(sql`
        SELECT id, driverName, vehicleId, startingTownId, notes, addressLine,
               NULL AS latitude, NULL AS longitude, createdAt, updatedAt
        FROM vans
      `);
      return rowsFromRawResult<Van>(result);
    } catch (fallbackError) {
      console.error("[Database] Failed to get vans:", fallbackError);
      return [];
    }
  }
}

export async function updateVanInDb(vanId: string, updates: Partial<typeof vans.$inferInsert>): Promise<Van | null> {
  const db = await getDb();
  if (!db) {
    console.warn("[Database] Cannot update van: database not available");
    return null;
  }

  try {
    await db.update(vans).set(updates).where(eq(vans.id, vanId));
    const result = await db.select().from(vans).where(eq(vans.id, vanId)).limit(1);
    return result.length > 0 ? result[0] : null;
  } catch (error) {
    try {
      const { latitude: _latitude, longitude: _longitude, ...updatesWithoutCoordinates } = updates;
      await db.update(vans).set(updatesWithoutCoordinates).where(eq(vans.id, vanId));
      const result = await db.execute(sql`
        SELECT id, driverName, vehicleId, startingTownId, notes, addressLine,
               NULL AS latitude, NULL AS longitude, createdAt, updatedAt
        FROM vans
        WHERE id = ${vanId}
        LIMIT 1
      `);
      const rows = rowsFromRawResult<Van>(result);
      return rows.length > 0 ? rows[0] : null;
    } catch (fallbackError) {
      console.error("[Database] Failed to update van:", fallbackError);
      return null;
    }
  }
}

export async function deleteVanInDb(vanId: string): Promise<boolean> {
  const db = await getDb();
  if (!db) {
    console.warn("[Database] Cannot delete van: database not available");
    return false;
  }

  try {
    await db.delete(vans).where(eq(vans.id, vanId));
    return true;
  } catch (error) {
    console.error("[Database] Failed to delete van:", error);
    return false;
  }
}

// Route Order operations
export async function saveRouteOrderInDb(dateKey: string, stopIds: string[]): Promise<void> {
  const db = await getDb();
  if (!db) {
    console.warn("[Database] Cannot save route order: database not available");
    return;
  }

  try {
    const id = Math.random().toString(36).substring(2, 11);
    const stopIdsJson = JSON.stringify(stopIds);
    
    // Try to update existing route order for this date, or insert if not exists
    const existing = await db.select().from(routeOrders).where(eq(routeOrders.dateKey, dateKey)).limit(1);
    
    if (existing.length > 0) {
      await db.update(routeOrders).set({ stopIds: stopIdsJson }).where(eq(routeOrders.dateKey, dateKey));
    } else {
      await db.insert(routeOrders).values({
        id,
        dateKey,
        stopIds: stopIdsJson,
      });
    }
  } catch (error) {
    console.error("[Database] Failed to save route order:", error);
    throw error;
  }
}

export async function loadRouteOrderFromDb(dateKey: string): Promise<RouteOrder | null> {
  const db = await getDb();
  if (!db) {
    console.warn("[Database] Cannot load route order: database not available");
    return null;
  }

  try {
    const result = await db.select().from(routeOrders).where(eq(routeOrders.dateKey, dateKey)).limit(1);
    return result.length > 0 ? result[0] : null;
  } catch (error) {
    console.error("[Database] Failed to load route order:", error);
    return null;
  }
}

export async function deleteRouteOrderInDb(dateKey: string): Promise<void> {
  const db = await getDb();
  if (!db) {
    console.warn("[Database] Cannot delete route order: database not available");
    return;
  }

  try {
    await db.delete(routeOrders).where(eq(routeOrders.dateKey, dateKey));
  } catch (error) {
    console.error("[Database] Failed to delete route order:", error);
    throw error;
  }
}

// ============================================================================
// Route Order History (Track changes for undo capability)
// ============================================================================

export async function saveRouteOrderHistoryInDb(dateKey: string, stopIds: string[], changeType: "reorder" | "reset"): Promise<void> {
  const db = await getDb();
  if (!db) {
    console.warn("[Database] Cannot save route order history: database not available");
    return;
  }

  try {
    const id = `history_${dateKey}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    await db.insert(routeOrderHistory).values({
      id,
      dateKey,
      stopIds: JSON.stringify(stopIds),
      changeType,
      createdAt: new Date(),
    });
  } catch (error) {
    console.error("[Database] Failed to save route order history:", error);
    throw error;
  }
}

export async function getRouteOrderHistoryFromDb(dateKey: string): Promise<RouteOrderHistory[]> {
  const db = await getDb();
  if (!db) {
    console.warn("[Database] Cannot get route order history: database not available");
    return [];
  }

  try {
    const history = await db
      .select()
      .from(routeOrderHistory)
      .where(eq(routeOrderHistory.dateKey, dateKey));
    return history;
  } catch (error) {
    console.error("[Database] Failed to get route order history:", error);
    throw error;
  }
}

export async function getRouteOrderHistoryItemFromDb(historyId: string): Promise<RouteOrderHistory | null> {
  const db = await getDb();
  if (!db) {
    console.warn("[Database] Cannot get route order history item: database not available");
    return null;
  }

  try {
    const items = await db
      .select()
      .from(routeOrderHistory)
      .where(eq(routeOrderHistory.id, historyId));
    return items.length > 0 ? items[0] : null;
  } catch (error) {
    console.error("[Database] Failed to get route order history item:", error);
    throw error;
  }
}
