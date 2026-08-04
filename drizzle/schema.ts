import { mysqlTable, varchar, int, text, timestamp, boolean, mysqlEnum, double } from "drizzle-orm/mysql-core";
import { sql } from "drizzle-orm";

/**
 * Single-business schema for the first version.
 * Multi-business support will be added in a future phase.
 */

// ============================================================================
// Users (Legacy OAuth)
// ============================================================================

export const users = mysqlTable("users", {
  id: int("id").autoincrement().primaryKey(),
  openId: varchar("openId", { length: 64 }).notNull().unique(),
  name: text("name"),
  email: varchar("email", { length: 320 }),
  loginMethod: varchar("loginMethod", { length: 64 }),
  role: mysqlEnum("role", ["user", "admin"]).notNull().default("user"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  lastSignedIn: timestamp("lastSignedIn").defaultNow().notNull(),
});

export type User = typeof users.$inferSelect;
export type InsertUser = typeof users.$inferInsert;

// ============================================================================
// Business Settings (Single Business)
// ============================================================================

export const businessSettings = mysqlTable("businessSettings", {
  id: int("id").autoincrement().primaryKey(),
  businessName: varchar("businessName", { length: 120 }).notNull(),
  unitTownId: varchar("unitTownId", { length: 32 }).notNull().default("falkirk"),
  unitLabel: varchar("unitLabel", { length: 120 }).notNull().default("Main Storage Unit"),
  unitAddress: text("unitAddress").notNull(),
  unitLatitude: varchar("unitLatitude", { length: 20 }),
  unitLongitude: varchar("unitLongitude", { length: 20 }),
  vanCapacity: int("vanCapacity").notNull().default(3),
  workdayStart: varchar("workdayStart", { length: 10 }).notNull().default("08:30"),
  workdayEnd: varchar("workdayEnd", { length: 10 }).notNull().default("17:30"),
  optimizeFor: mysqlEnum("optimizeFor", ["time"]).notNull().default("time"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type BusinessSettings = typeof businessSettings.$inferSelect;
export type InsertBusinessSettings = typeof businessSettings.$inferInsert;

// ============================================================================
// Helpers
// ============================================================================

export const helpers = mysqlTable("helpers", {
  id: varchar("id", { length: 64 }).primaryKey(),
  name: varchar("name", { length: 120 }).notNull(),
  townId: varchar("townId", { length: 32 }).notNull(),
  weekdayAvailable: int("weekdayAvailable").notNull().default(1),
  weekendAvailable: int("weekendAvailable").notNull().default(0),
  notes: text("notes"),
  addressLine: text("addressLine"),
  latitude: varchar("latitude", { length: 20 }),
  longitude: varchar("longitude", { length: 20 }),
});

export type Helper = typeof helpers.$inferSelect;
export type InsertHelper = typeof helpers.$inferInsert;

// ============================================================================
// Jobs
// ============================================================================

export const jobs = mysqlTable("jobs", {
  id: varchar("id", { length: 64 }).primaryKey(),
  customerName: varchar("customerName", { length: 120 }).notNull(),
  contactName: varchar("contactName", { length: 120 }).notNull(),
  contactPhone: varchar("contactPhone", { length: 20 }).notNull(),
  addressLine: text("addressLine").notNull(),
  townId: varchar("townId", { length: 32 }).notNull(),
  latitude: varchar("latitude", { length: 20 }),
  longitude: varchar("longitude", { length: 20 }),
  type: mysqlEnum("type", ["pickup", "delivery", "both"]).notNull(),
  sofaCount: double("sofaCount").notNull(),
  pickupCount: double("pickupCount").default(0).notNull(),
  scheduledDay: varchar("scheduledDay", { length: 10 }).notNull(),
  timeWindow: varchar("timeWindow", { length: 50 }).notNull(),
  floor: varchar("floor", { length: 50 }).default("").notNull(),
  duration: int("duration").default(30).notNull(),
  notes: text("notes"),
  status: mysqlEnum("status", ["scheduled", "cancelled", "completed"]).notNull().default("scheduled"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type Job = typeof jobs.$inferSelect;
export type InsertJob = typeof jobs.$inferInsert;

// ============================================================================
// Vans (Drivers assigned to vehicles)
// ============================================================================

export const vans = mysqlTable("vans", {
  id: varchar("id", { length: 64 }).primaryKey(),
  driverName: varchar("driverName", { length: 120 }).notNull(),
  vehicleId: varchar("vehicleId", { length: 64 }).notNull(),
  startingTownId: varchar("startingTownId", { length: 32 }).notNull(),
  notes: text("notes"),
  addressLine: text("addressLine"),
  latitude: varchar("latitude", { length: 20 }),
  longitude: varchar("longitude", { length: 20 }),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type Van = typeof vans.$inferSelect;
export type InsertVan = typeof vans.$inferInsert;

// ============================================================================
// Vehicles
// ============================================================================

export const vehicles = mysqlTable("vehicles", {
  id: varchar("id", { length: 64 }).primaryKey(),
  name: varchar("name", { length: 120 }).notNull(),
  capacity: int("capacity").notNull().default(3),
  notes: text("notes"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type Vehicle = typeof vehicles.$inferSelect;
export type InsertVehicle = typeof vehicles.$inferInsert;

// ============================================================================
// Route Orders (Custom route ordering for specific dates)
// ============================================================================

export const routeOrders = mysqlTable("routeOrders", {
  id: varchar("id", { length: 64 }).primaryKey(),
  dateKey: varchar("dateKey", { length: 10 }).notNull(), // YYYY-MM-DD format
  stopIds: text("stopIds").notNull(), // JSON array of stop IDs in custom order
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type RouteOrder = typeof routeOrders.$inferSelect;
export type InsertRouteOrder = typeof routeOrders.$inferInsert;

// ============================================================================
// Route Order History (Track changes to route orders for undo capability)
// ============================================================================

export const routeOrderHistory = mysqlTable("routeOrderHistory", {
  id: varchar("id", { length: 64 }).primaryKey(),
  dateKey: varchar("dateKey", { length: 10 }).notNull(), // YYYY-MM-DD format
  stopIds: text("stopIds").notNull(), // JSON array of stop IDs in custom order
  changeType: mysqlEnum("changeType", ["reorder", "reset"]).notNull(), // Type of change
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type RouteOrderHistory = typeof routeOrderHistory.$inferSelect;
export type InsertRouteOrderHistory = typeof routeOrderHistory.$inferInsert;
