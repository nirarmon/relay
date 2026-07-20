# Relay — Dispatch App: Design Spec

> Source plan: `../../../OPO/plan/` (design-brief.md, data-model.md, personas-and-workflows.md, functional-modules.md, architecture-and-stack.md, roadmap.md, open-questions.md). This spec scopes the **first implementation pass**: the Dispatch (OPO/Coordinator) app only.

## 1. Goal

Build the four Group-1 "Dispatch app" screens from `design-brief.md` against a real Supabase backend, running on Vercel, so the product can be demoed end-to-end for a single synthetic mission moving through its lifecycle.

**In scope (screens):**
- 0.1 Auth / Landing
- 1.1 Dispatch Mission Dashboard
- 1.2 New Mission (intake)
- 1.3 Mission Detail ⭐ (flagship screen — countdown, stepper, map, custody timeline, exception controls)
- 1.4 Carrier Assignment & Feasibility (shows only legal/available tails — the product's defining differentiator)

**Out of scope (this pass):** Aviation Ops app UI (2.x), Business Ops UI (3.x), Field app (4.x — pilot/courier mobile), Inngest durable workflows, email/SMS notifications, real FlightAware/Mapbox live feeds, multi-operator brokering, billing UI, DonorNet/UNet integration.

## 2. Stack

- **Next.js 15** (App Router, TypeScript, React Server Components), deployed on **Vercel**.
- **Supabase**: Postgres + PostGIS, Auth, Realtime (Postgres Changes), Storage (custody proof — schema only in this pass, no upload UI yet), Row-Level Security by `org_id`.
- **Mapbox GL JS** for the Mission Detail map (static/seeded positions — no live tracking feed yet).
- UI: Tailwind + a small custom component kit per `design-brief.md` §B (dark theme primary, light variant).

## 3. Data model

Implement the full schema from `OPO/plan/data-model.md` §4.2 (Organization, Hospital, Contract, Organ, Mission, MissionEvent, Leg, CustodyEvent, Aircraft, Pilot, DutyRecord, CrewAssignment, MaintenanceRecord, Airport, Invoice, User/Role), even though only a subset is rendered by Dispatch-app screens — Carrier Assignment (1.4) reads Aircraft/Pilot/DutyRecord to compute legality, so those tables need to be real and correctly shaped now.

RLS: every PHI-bearing table scoped by `org_id`; a user only sees their org's missions/fleet.

Compliance invariants from data-model.md §4.3 apply: `MissionEvent` and `CustodyEvent` are append-only (DB revokes UPDATE/DELETE), `sla_state`/`viability_deadline_at` are derived not hand-edited, every mutation is actor-attributed.

## 4. Engines (server-side, pure-function core + thin persistence wrapper)

- **Mission state machine** (`functional-modules.md` A3): implements the full transition graph in `personas-and-workflows.md` §2.2, including the four exception paths (Delay, Divert, Declined, MissedWindow). Runs as guarded Next.js Server Actions. Every transition writes a `MissionEvent` row. Gate: cannot enter `CarrierAssigned` without a D085-valid aircraft + duty-legal crew.
- **Duty-legality calculator** (B2, native-lite): pure function over `DutyRecord` rows → per-pilot legal/illegal + reason, enforcing §135.267 (≤14h duty, ≤10h flight, ≥10h rest, on-call counts as duty per *Masterson*) and §135.293 currency. Unit-tested against a few worked examples. This is what powers the "only legal tails" view in Carrier Assignment.
- **SLA/countdown**: `viability_deadline_at = cross_clamp_at + ischemic_budget_minutes`; `sla_state` (on-time/at-risk/breached) computed from now vs. deadline at render time. Client ticks the displayed countdown locally between Realtime-driven row refreshes; no server timer/cron in this pass.

## 5. Realtime

Supabase Realtime (Postgres Changes) on `mission`, `mission_event`, `custody_event` — dashboard and mission-detail subscribe so a state transition made by one tab appears live in another (this is the "both sides alerted at once" demo requirement from the roadmap's Phase-1 definition of done, minus the actual cross-persona alerting since there's only one app/persona in this pass).

## 6. Auth & roles

Supabase Auth, email/password. One role implemented for login: **OPO Coordinator**. The `Role` enum and RLS are built per `data-model.md` §4.2 so other roles can be added later without a schema change, but only the coordinator role has a UI in this pass.

## 7. Seed data (synthetic, no real PHI — per Q3/R6)

- 1 OPO org + 1 operator org, 2–3 hospitals, 2 airports.
- 2–3 aircraft: at least one D085-authorized and available, one deliberately **not** on D085 (proves the assignment gate visibly blocks it).
- 4 pilots with `DutyRecord` histories: most legal, at least one deliberately in violation (proves the duty-legality block).
- 1 active `Contract` (CSL, billing rate, 15% override).
- 2 seeded missions: one fresh (`OfferReceived`, nothing dispatched yet) and one mid-flight (`InTransitAir`, custody chain partially populated, countdown ticking) — so the dashboard and Mission Detail aren't empty on first load.

## 8. What "done" looks like for this pass

- Coordinator logs in, sees the Dashboard with the two seeded missions, sorted by time-remaining, correct status colors.
- Can create a New Mission via the intake form and see it appear on the dashboard.
- Can open Mission Detail on the in-flight mission and see the countdown hero, state-machine stepper, map (static positions), custody timeline, and exception controls (delay/divert/declined/missed-window) — triggering an exception visibly flips status color and recomputes the countdown per the state machine.
- On Carrier Assignment, only the D085-authorized aircraft with legal crew is selectable; the non-authorized aircraft and the pilot with a duty violation are visibly blocked with a reason, not just hidden.
- All of the above runs against real Supabase (not mocked), deployed on Vercel.

## 9. Open items carried forward (not blocking this pass)

Per `OPO/plan/open-questions.md`: Q2 (own vs managed Part 135 cert), Q5 (exact ischemic-window defaults — using the plan's assumed machine-perfusion defaults, editable), Q10 (East-Coast corridor for seed geography) — assumptions from the plan are used as-is; nothing here needs new decisions to proceed.
