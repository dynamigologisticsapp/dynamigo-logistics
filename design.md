# Sofa Route Optimizer Design Plan

## Product Intent

**Sofa Route Optimizer** is a mobile-first operations app for a sofa reselling business working across Central Scotland. The product is designed primarily for the van driver, who needs a fast, one-handed mobile interface while on the road, and secondarily for sales staff who need to add, edit, or cancel jobs from a computer. The core design goal is to reduce wasted driving time by continuously recalculating the route based on pickups, deliveries, van capacity, helper collection, and returns to the storage unit.

The app should feel close to a first-party iOS operations tool: calm, readable, high-contrast, and efficient. The main experience should favor glanceable information, large touch targets, strong status color cues, and minimal typing for the driver.

## Operating Assumptions

| Topic | Current Assumption |
|---|---|
| Service area | The business operates across Central Scotland, so the routing engine must handle geographically spread jobs rather than tight urban-only routes. |
| Vehicle capacity | The van can hold **3 sofas** at once. Capacity logic is therefore central to route ordering. |
| Depot model | There is **one storage unit**, which acts as the base for overflow drops, stock pickups, and route resets when van load constraints require it. |
| Team roles | One driver uses the mobile app on the road, around three sales staff create and edit jobs, and two helpers are candidates for daily pickup with one having weekday-only availability. |
| Optimization priority | The primary optimization target is **time**, with fuel efficiency treated as a secondary outcome. |
| Live operations | Jobs may be added, changed, or cancelled during the day, so the route must be re-evaluated without making the driver rebuild the plan manually. |

## Mobile-First Information Hierarchy

The mobile app should prioritize the following information order on the driver side.

| Priority | Information |
|---|---|
| 1 | **What stop is next** |
| 2 | **What action happens there**: pickup, delivery, helper pickup, unit return, or stock load |
| 3 | **Current van load** and expected load after the stop |
| 4 | **Why the stop is in this position** if the sequence changed |
| 5 | **Route impact from live changes** such as cancellations or new urgent jobs |

This means the driver home screen should not behave like a generic admin dashboard. It should behave like a live operations console.

## Screen List

| Screen | Audience | Purpose |
|---|---|---|
| Route Home | Driver | Shows the live day plan, next stop, route summary, helper status, and current van load. |
| Route Timeline | Driver | Displays the ordered sequence of stops with stop type, address, ETA, load change, and dependency warnings. |
| Stop Detail | Driver | Shows full stop information, contact details, notes, sofa count, navigation action, and completion controls. |
| Live Changes Sheet | Driver | Surfaces new, changed, and cancelled jobs while on the road and explains route impact. |
| Unit Actions | Driver | Manages returns to the storage unit, stock pickups from the unit, and explains why the unit must be visited. |
| Helper Selection | Driver / Planner | Shows available helpers for the day, pickup feasibility, travel impact, and recommended helper. |
| Jobs Board | Sales Team | Lets staff add, edit, cancel, and reschedule pickups and deliveries from mobile web or desktop layout. |
| Job Form | Sales Team | Captures customer details, address, time window, sofa count, stop type, notes, and status. |
| Day Planner | Driver / Planner | Lets the business view all jobs for a selected day and trigger route recalculation. |
| Settings & Rules | Admin | Stores van capacity, unit address, helper availability, default workday rules, and route preferences. |

## Primary Content and Functionality by Screen

### Route Home

This screen should open directly into today’s active route. The upper portion should contain a strong summary card with the next stop, its type, estimated arrival time, travel duration, and the van load transition such as **2 → 3 sofas** or **1 → 0 sofas**. A secondary row should show helper status, whether a unit return is currently expected, and a compact count of remaining pickups and deliveries.

The lower portion should contain a scrollable route preview with the next few stops, each rendered as a card with a colored left border by stop type. A persistent bottom action area should allow the driver to mark the current stop complete, open navigation, or review live changes.

### Route Timeline

This screen should present the full ordered route as a vertical timeline optimized for thumb scrolling. Each stop card should include the stop sequence, type icon, customer or helper label, address snippet, ETA, stop window if any, and the van load before and after the stop. If the system inserted a storage-unit visit, the card should include a short reason such as **capacity protection** or **load required for later delivery**.

### Stop Detail

This screen should focus on a single job and provide the operational detail needed when the driver arrives. It should include full address, contact information, job notes, sofa count, whether payment or confirmation is needed, and a clear action list. Completion controls should allow outcomes such as completed, cancelled, customer unavailable, delayed, or needs re-routing.

### Live Changes Sheet

This should be a modal-style sheet that opens over the current workflow. It should show changes in plain language, for example: a delivery was cancelled, a new pickup was added, or helper availability changed. Each change should show whether the route was automatically recalculated and whether the current next stop changed.

### Unit Actions

This screen should explain all interactions with the storage unit. It should show current van load, projected downstream load conflicts, and the exact reason the route recommends returning to the unit. It should also allow manual confirmation when sofas are dropped off or collected from the unit.

### Helper Selection

This screen should compare available helpers for the current day. Each helper card should show name, availability, home area, estimated pickup detour, and total route impact. The recommended helper should be highlighted with a clear explanation such as **saves 18 minutes compared with the alternative**. On weekends, the unavailable helper should be visually disabled with a reason.

### Jobs Board

This screen must work well on both phone and computer widths. On mobile it should be a filterable stacked list. On desktop it should expand into a multi-column board or table with quick actions. Sales staff should be able to add jobs, edit existing jobs, cancel jobs, and see whether a job is already assigned into today’s route.

### Job Form

This screen should minimize friction for staff input. The form should capture job type, address, customer name, contact details, sofa count, requested day, preferred time window, and notes. The form should clearly explain the operational meaning of each job: a pickup increases van load, while a delivery decreases it.

### Day Planner

This screen should act as the business overview. It should show all jobs scheduled for a day, helper availability, van starting assumptions, and a route summary. It should allow a recalculation action if new data comes in.

### Settings & Rules

This screen should be reserved for the core business rules. It should contain van capacity, unit address, helper records and availability rules, default work start location, default start time, and optimization preference. These values should not clutter operational screens.

## Key User Flows

| Flow | Step-by-step path |
|---|---|
| Start the day | Driver opens app → Route Home shows today’s plan → Driver reviews recommended helper → Driver starts route. |
| Helper assignment | App checks weekday/weekend availability → compares helper pickup detours → recommends helper → driver confirms helper selection. |
| Complete a stop | Driver taps current stop → Stop Detail opens → driver marks complete → van load updates → route recalculates if needed. |
| Capacity overflow handling | New pickup appears or current plan would exceed 3 sofas → app inserts storage-unit stop at the most efficient point → Route Home and Timeline update. |
| Delivery cancellation | Sales staff cancel a delivery from Jobs Board → app removes stop → recalculates downstream load and timing → driver sees change in Live Changes Sheet. |
| New pickup during route | Sales staff add a pickup → app evaluates whether it fits current load plan → if yes inserts it optimally, if no inserts with unit return logic → driver receives updated next steps. |
| Sales team input from computer | Staff open Jobs Board on desktop width → add or edit jobs → changes sync into active route view used by the driver. |

## Routing Logic Principles Reflected in the Design

The interface should visibly reinforce the routing rules so that the user trusts the recommendation. The app should treat pickups as **+1 sofa** by default and deliveries as **-1 sofa**, with room to support more than one sofa per job later. The route engine should not merely sort by nearest address. It should sequence stops based on travel time, current van load, future delivery commitments, unit returns, and helper pickup impact.

If a later delivery requires stock from the unit, the app should surface that dependency. If a new pickup would break van capacity, the route should either schedule a prior delivery or schedule a return to the unit. If two helpers are available, the app should choose the helper whose pickup causes the smaller route delay while staying compatible with the day’s job geography.

## Layout and Interaction Principles

| Design Principle | Implementation |
|---|---|
| One-handed operation | Primary actions should sit in the bottom portion of the screen, with large touch targets and limited text entry for the driver. |
| Glanceable state | Van load, next stop, helper status, and route change alerts should be visible without scrolling on the home screen. |
| Plain-language reasoning | Whenever the route changes, the app should explain the reason rather than silently reshuffling stops. |
| Role separation | Driver-facing screens should remain operational and simple, while sales-team screens can expose more editing controls. |
| Desktop adaptability | Jobs Board and Day Planner should gracefully widen into desktop-friendly layouts so staff can work from a computer. |

## Color Choices

The visual identity should feel dependable, practical, and transport-oriented rather than flashy.

| Token | Color | Use |
|---|---|---|
| Primary | `#1E5EFF` | Main actions, selected states, route emphasis |
| Background | `#F4F7FB` | App background |
| Surface | `#FFFFFF` | Cards, sheets, panels |
| Foreground | `#10233D` | Primary text |
| Muted | `#607086` | Secondary text and metadata |
| Border | `#D8E1EC` | Card separators and inputs |
| Success | `#1F9D68` | Completed stops and positive route updates |
| Warning | `#F3A218` | Capacity pressure, timing risks, pending confirmations |
| Error | `#D64545` | Cancelled jobs, failed stops, severe conflicts |
| Pickup Accent | `#0EA5A4` | Pickup stops and load increases |
| Delivery Accent | `#7C3AED` | Delivery stops and load decreases |
| Unit Accent | `#475569` | Storage-unit actions |
| Helper Accent | `#F97316` | Helper pickup and staffing context |

## Outstanding Product Questions

Some operational details are still open and should be confirmed during implementation. The app currently assumes that one pickup or delivery usually corresponds to one sofa, but the data model should support multiple sofas per job. It also assumes one driver route per day rather than multiple vans. Finally, it assumes the sales team needs shared live access, which means cloud sync is required rather than device-only storage.

## Build Recommendation

The best product shape is a **mobile app for the driver** with a responsive **shared web-capable operations interface** for the sales team. The driver’s experience should remain mobile-native in layout and interaction, while staff can access the same live data from a computer browser. This gives you the combination you asked for: easy use on the road plus editable updates from a computer.

## Initial Delivery Scope

The first working version should focus on the daily route view, job entry and editing, helper selection logic, unit return logic, and a transparent route explanation layer. More advanced optimization, calendar integration, navigation handoff, and historical reporting can follow once the core workflow is stable.
