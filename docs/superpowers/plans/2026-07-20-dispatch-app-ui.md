# Relay Dispatch App — UI Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the component kit from `design-brief.md` §B and the four Dispatch-app screens (Auth/Landing, Dispatch Dashboard, New Mission, Carrier Assignment, Mission Detail) on top of the backend from `2026-07-20-dispatch-app-backend.md`, wired to Supabase Realtime, deployed on Vercel.

**Architecture:** Next.js App Router — Server Components fetch data (via the query helpers in this plan) and pass it to Client Components for interactivity (realtime subscriptions, ticking countdowns, forms, exception actions). Dark theme primary per the design brief; status color (on-time/at-risk/breached) is computed client-side from `organ.viability_deadline_at` via the `sla` engine, never read from the `mission.sla_state` snapshot column (see prior plan's handoff note).

**Tech Stack:** Next.js 15 (App Router), TypeScript, Tailwind, Mapbox GL JS, Vitest + React Testing Library + jsdom, Supabase Realtime (Postgres Changes).

**Prerequisite:** `2026-07-20-dispatch-app-backend.md` complete — local Supabase running, seeded, `transitionMission` action and engines in place.

**External credential needed before Task 11:** a free Mapbox access token (https://account.mapbox.com/access-tokens/) — add as `NEXT_PUBLIC_MAPBOX_TOKEN` in `.env.local`. Nothing before Task 11 needs it.

---

## Task 1: UI testing infra, auth middleware, Auth/Landing screen (0.1)

**Files:**
- Modify: `package.json`
- Modify: `vitest.config.ts`
- Create: `src/test/setup.ts`
- Create: `src/middleware.ts`
- Create: `src/app/login/page.tsx`
- Create: `src/app/login/LoginForm.tsx`
- Test: `src/app/login/LoginForm.test.tsx`

- [ ] **Step 1: Add UI testing dependencies to `package.json`**

Add to `devDependencies`: `"@testing-library/react": "^16.0.1", "@testing-library/jest-dom": "^6.6.2", "@testing-library/user-event": "^14.5.2", "jsdom": "^25.0.1"`.

Run: `npm install`
Expected: installs without error.

- [ ] **Step 2: Write `src/test/setup.ts`**

```typescript
import "@testing-library/jest-dom/vitest";
```

- [ ] **Step 3: Update `vitest.config.ts` to load the setup file**

```typescript
import { defineConfig } from "vitest/config";
import path from "node:path";

export default defineConfig({
  test: {
    environment: "node",
    include: ["src/**/*.test.{ts,tsx}"],
    setupFiles: ["./src/test/setup.ts"],
  },
  resolve: {
    alias: { "@": path.resolve(__dirname, "./src") },
  },
});
```

- [ ] **Step 4: Write `src/middleware.ts`** (refreshes the Supabase session cookie on every request; redirects unauthenticated users to `/login`)

```typescript
import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

const PUBLIC_PATHS = ["/login"];

export async function middleware(request: NextRequest) {
  let response = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          for (const { name, value } of cookiesToSet) request.cookies.set(name, value);
          response = NextResponse.next({ request });
          for (const { name, value, options } of cookiesToSet) response.cookies.set(name, value, options);
        },
      },
    }
  );

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const isPublicPath = PUBLIC_PATHS.some((p) => request.nextUrl.pathname.startsWith(p));

  if (!user && !isPublicPath) {
    const loginUrl = new URL("/login", request.url);
    return NextResponse.redirect(loginUrl);
  }

  if (user && request.nextUrl.pathname === "/login") {
    return NextResponse.redirect(new URL("/dashboard", request.url));
  }

  return response;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
```

- [ ] **Step 5: Write the failing test for the login form**

```tsx
// src/app/login/LoginForm.test.tsx
// @vitest-environment jsdom
import { describe, it, expect, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { LoginForm } from "./LoginForm";

describe("LoginForm", () => {
  it("shows an error message when sign-in fails", async () => {
    const signInWithPassword = vi.fn().mockResolvedValue({ error: { message: "Invalid login credentials" } });
    render(<LoginForm signInWithPassword={signInWithPassword} onSuccess={() => {}} />);

    await userEvent.type(screen.getByLabelText(/email/i), "coordinator@relay.demo");
    await userEvent.type(screen.getByLabelText(/password/i), "wrong-password");
    await userEvent.click(screen.getByRole("button", { name: /sign in/i }));

    await waitFor(() => expect(screen.getByRole("alert")).toHaveTextContent(/invalid login credentials/i));
  });

  it("calls onSuccess after a successful sign-in", async () => {
    const signInWithPassword = vi.fn().mockResolvedValue({ error: null });
    const onSuccess = vi.fn();
    render(<LoginForm signInWithPassword={signInWithPassword} onSuccess={onSuccess} />);

    await userEvent.type(screen.getByLabelText(/email/i), "coordinator@relay.demo");
    await userEvent.type(screen.getByLabelText(/password/i), "correct-password");
    await userEvent.click(screen.getByRole("button", { name: /sign in/i }));

    await waitFor(() => expect(onSuccess).toHaveBeenCalled());
  });
});
```

- [ ] **Step 6: Run test to verify it fails**

Run: `npm test -- LoginForm`
Expected: FAIL — `Cannot find module './LoginForm'`.

- [ ] **Step 7: Write `src/app/login/LoginForm.tsx`**

```tsx
"use client";

import { useState, type FormEvent } from "react";

export interface LoginFormProps {
  signInWithPassword: (args: { email: string; password: string }) => Promise<{ error: { message: string } | null }>;
  onSuccess: () => void;
}

export function LoginForm({ signInWithPassword, onSuccess }: LoginFormProps) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    const { error: signInError } = await signInWithPassword({ email, password });
    setLoading(false);
    if (signInError) {
      setError(signInError.message);
      return;
    }
    onSuccess();
  }

  return (
    <form onSubmit={handleSubmit} className="flex w-full max-w-sm flex-col gap-4">
      {error && (
        <p role="alert" className="rounded-md border border-status-breached/40 bg-status-breached/10 px-3 py-2 text-sm text-status-breached">
          {error}
        </p>
      )}
      <label className="flex flex-col gap-1 text-sm text-slate-300">
        Email
        <input
          type="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="rounded-md border border-slate-700 bg-slate-900 px-3 py-2 text-slate-100"
        />
      </label>
      <label className="flex flex-col gap-1 text-sm text-slate-300">
        Password
        <input
          type="password"
          required
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="rounded-md border border-slate-700 bg-slate-900 px-3 py-2 text-slate-100"
        />
      </label>
      <button
        type="submit"
        disabled={loading}
        className="rounded-md bg-status-info px-4 py-2 font-medium text-white disabled:opacity-50"
      >
        {loading ? "Signing in..." : "Sign in"}
      </button>
    </form>
  );
}
```

- [ ] **Step 8: Run test to verify it passes**

Run: `npm test -- LoginForm`
Expected: PASS — 2 tests.

- [ ] **Step 9: Write `src/app/login/page.tsx`** (screen 0.1 — Auth/Landing)

```tsx
"use client";

import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { LoginForm } from "./LoginForm";

export default function LoginPage() {
  const router = useRouter();
  const supabase = createClient();

  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-8 px-4">
      <div className="text-center">
        <h1 className="font-mono text-2xl font-bold tracking-tight text-slate-100">RELAY</h1>
        <p className="mt-1 text-sm text-slate-400">Dispatch console — OPO Coordinator</p>
      </div>
      <LoginForm
        signInWithPassword={(args) => supabase.auth.signInWithPassword(args)}
        onSuccess={() => router.push("/dashboard")}
      />
    </main>
  );
}
```

- [ ] **Step 10: Commit**

```bash
git add package.json vitest.config.ts src/test/setup.ts src/middleware.ts src/app/login
git commit -m "Add UI testing infra, auth middleware, and Auth/Landing screen"
```

---

## Task 2: Mission data-fetching helpers

**Files:**
- Create: `src/lib/queries/missions.ts`
- Test: `src/lib/queries/missions.test.ts`

- [ ] **Step 1: Write the failing test**

```typescript
// src/lib/queries/missions.test.ts
import { describe, it, expect, vi } from "vitest";
import { getMissionList } from "./missions";

function fakeSupabase(rows: any[]) {
  return {
    from: () => ({
      select: () => ({
        order: async () => ({ data: rows, error: null }),
      }),
    }),
  } as any;
}

describe("getMissionList", () => {
  it("sorts missions by soonest viability deadline first", async () => {
    const client = fakeSupabase([
      { id: "a", status: "InTransitAir", donor_hospital: { name: "Hospital A" }, recipient_hospital: { name: "Hospital B" }, organ: { organ_type: "HEART", preservation_method: "STATIC_COLD", viability_deadline_at: new Date(Date.now() + 3_600_000).toISOString() } },
      { id: "b", status: "OfferReceived", donor_hospital: { name: "Hospital C" }, recipient_hospital: { name: "Hospital D" }, organ: null },
      { id: "c", status: "CustodyStarted", donor_hospital: { name: "Hospital E" }, recipient_hospital: { name: "Hospital F" }, organ: { organ_type: "KIDNEY", preservation_method: "MACHINE_PERFUSION", viability_deadline_at: new Date(Date.now() + 1_800_000).toISOString() } },
    ]);
    const missions = await getMissionList(client);
    expect(missions.map((m) => m.id)).toEqual(["c", "a", "b"]);
  });

  it("marks a mission with no organ/deadline yet as ON_TIME", async () => {
    const client = fakeSupabase([
      { id: "b", status: "OfferReceived", donor_hospital: { name: "Hospital C" }, recipient_hospital: { name: "Hospital D" }, organ: null },
    ]);
    const missions = await getMissionList(client);
    expect(missions[0]!.slaState).toBe("ON_TIME");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- missions.test`
Expected: FAIL — `Cannot find module './missions'`.

- [ ] **Step 3: Write `src/lib/queries/missions.ts`**

```typescript
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database";
import { computeSlaState, type SlaState } from "@/lib/engines/sla";

export interface MissionListRow {
  id: string;
  status: string;
  organType: string | null;
  preservationMethod: string | null;
  donorHospitalName: string;
  recipientHospitalName: string;
  viabilityDeadlineAt: string | null;
  slaState: SlaState;
}

export async function getMissionList(
  supabase: SupabaseClient<Database>
): Promise<MissionListRow[]> {
  const { data, error } = await supabase
    .from("mission")
    .select(
      `id, status,
       donor_hospital:hospital!mission_donor_hospital_id_fkey(name),
       recipient_hospital:hospital!mission_recipient_hospital_id_fkey(name),
       organ:organ!mission_organ_id_fkey(organ_type, preservation_method, viability_deadline_at)`
    )
    .order("created_at", { ascending: false });

  if (error) throw error;

  const now = new Date();
  const rows: MissionListRow[] = (data ?? []).map((row: any) => {
    const viabilityDeadlineAt: string | null = row.organ?.viability_deadline_at ?? null;
    return {
      id: row.id,
      status: row.status,
      organType: row.organ?.organ_type ?? null,
      preservationMethod: row.organ?.preservation_method ?? null,
      donorHospitalName: row.donor_hospital?.name ?? "Unknown",
      recipientHospitalName: row.recipient_hospital?.name ?? "Unknown",
      viabilityDeadlineAt,
      slaState: computeSlaState(now, viabilityDeadlineAt ? new Date(viabilityDeadlineAt) : null),
    };
  });

  return rows.sort((a, b) => {
    if (!a.viabilityDeadlineAt && !b.viabilityDeadlineAt) return 0;
    if (!a.viabilityDeadlineAt) return 1;
    if (!b.viabilityDeadlineAt) return -1;
    return new Date(a.viabilityDeadlineAt).getTime() - new Date(b.viabilityDeadlineAt).getTime();
  });
}

export interface MissionDetail {
  id: string;
  status: string;
  donorHospital: { id: string; name: string };
  recipientHospital: { id: string; name: string };
  organ: {
    id: string;
    organType: string;
    preservationMethod: string;
    ischemicBudgetMinutes: number;
    crossClampAt: string | null;
    viabilityDeadlineAt: string | null;
  } | null;
  legs: Array<{ id: string; sequenceNo: number; mode: string; callSignCategory: string; status: string }>;
  custodyEvents: Array<{ id: string; eventType: string; occurredAt: string; custodianRole: string; proofType: string | null }>;
  assignedAircraft: { id: string; tailNumber: string; type: string } | null;
  crew: Array<{ pilotId: string; pilotName: string; role: string }>;
  auditLog: Array<{ id: string; fromStatus: string | null; toStatus: string; eventType: string; occurredAt: string; note: string | null }>;
}

export async function getMissionDetail(
  supabase: SupabaseClient<Database>,
  missionId: string
): Promise<MissionDetail> {
  const { data: mission, error: missionError } = await supabase
    .from("mission")
    .select(
      `id, status,
       donor_hospital:hospital!mission_donor_hospital_id_fkey(id, name),
       recipient_hospital:hospital!mission_recipient_hospital_id_fkey(id, name),
       organ:organ!mission_organ_id_fkey(id, organ_type, preservation_method, ischemic_budget_minutes, cross_clamp_at, viability_deadline_at),
       assigned_aircraft:aircraft(id, tail_number, type)`
    )
    .eq("id", missionId)
    .single();
  if (missionError) throw missionError;
  const m: any = mission;

  const [{ data: legs, error: legErr }, { data: crew, error: crewErr }, { data: events, error: eventErr }] =
    await Promise.all([
      supabase.from("leg").select("id, sequence_no, mode, call_sign_category, status").eq("mission_id", missionId).order("sequence_no"),
      supabase.from("crew_assignment").select("pilot_id, role, pilot:pilot(name)").eq("mission_id", missionId),
      supabase.from("mission_event").select("id, from_status, to_status, event_type, occurred_at, note").eq("mission_id", missionId).order("occurred_at", { ascending: false }),
    ]);
  if (legErr) throw legErr;
  if (crewErr) throw crewErr;
  if (eventErr) throw eventErr;

  let custodyEvents: MissionDetail["custodyEvents"] = [];
  if (m.organ?.id) {
    const { data: custody, error: custodyErr } = await supabase
      .from("custody_event")
      .select("id, event_type, occurred_at, custodian_role, proof_type")
      .eq("organ_id", m.organ.id)
      .order("occurred_at");
    if (custodyErr) throw custodyErr;
    custodyEvents = (custody ?? []).map((c: any) => ({
      id: c.id, eventType: c.event_type, occurredAt: c.occurred_at, custodianRole: c.custodian_role, proofType: c.proof_type,
    }));
  }

  return {
    id: m.id,
    status: m.status,
    donorHospital: { id: m.donor_hospital.id, name: m.donor_hospital.name },
    recipientHospital: { id: m.recipient_hospital.id, name: m.recipient_hospital.name },
    organ: m.organ
      ? {
          id: m.organ.id,
          organType: m.organ.organ_type,
          preservationMethod: m.organ.preservation_method,
          ischemicBudgetMinutes: m.organ.ischemic_budget_minutes,
          crossClampAt: m.organ.cross_clamp_at,
          viabilityDeadlineAt: m.organ.viability_deadline_at,
        }
      : null,
    legs: (legs ?? []).map((l: any) => ({ id: l.id, sequenceNo: l.sequence_no, mode: l.mode, callSignCategory: l.call_sign_category, status: l.status })),
    custodyEvents,
    assignedAircraft: m.assigned_aircraft ? { id: m.assigned_aircraft.id, tailNumber: m.assigned_aircraft.tail_number, type: m.assigned_aircraft.type } : null,
    crew: (crew ?? []).map((c: any) => ({ pilotId: c.pilot_id, pilotName: c.pilot?.name ?? "Unknown", role: c.role })),
    auditLog: (events ?? []).map((e: any) => ({ id: e.id, fromStatus: e.from_status, toStatus: e.to_status, eventType: e.event_type, occurredAt: e.occurred_at, note: e.note })),
  };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- missions.test`
Expected: PASS — 2 tests.

- [ ] **Step 5: Commit**

```bash
git add src/lib/queries/missions.ts src/lib/queries/missions.test.ts
git commit -m "Add mission list/detail query helpers with client-computed SLA state"
```

---

## Task 3: StatusBadge component

**Files:**
- Create: `src/components/StatusBadge.tsx`
- Test: `src/components/StatusBadge.test.tsx`

- [ ] **Step 1: Write the failing test**

```tsx
// src/components/StatusBadge.test.tsx
// @vitest-environment jsdom
import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { StatusBadge } from "./StatusBadge";

describe("StatusBadge", () => {
  it("renders the label and an icon, not color alone, for each state", () => {
    const { rerender } = render(<StatusBadge state="ON_TIME" />);
    expect(screen.getByText("On time")).toBeInTheDocument();
    expect(screen.getByTestId("status-icon")).toBeInTheDocument();

    rerender(<StatusBadge state="AT_RISK" />);
    expect(screen.getByText("At risk")).toBeInTheDocument();

    rerender(<StatusBadge state="BREACHED" />);
    expect(screen.getByText("Breached")).toBeInTheDocument();

    rerender(<StatusBadge state="IDLE" />);
    expect(screen.getByText("Idle")).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- StatusBadge`
Expected: FAIL — `Cannot find module './StatusBadge'`.

- [ ] **Step 3: Write `src/components/StatusBadge.tsx`**

```tsx
export type StatusBadgeState = "ON_TIME" | "AT_RISK" | "BREACHED" | "IDLE";

const CONFIG: Record<StatusBadgeState, { label: string; icon: string; classes: string }> = {
  ON_TIME: { label: "On time", icon: "●", classes: "bg-status-ontime/10 text-status-ontime border-status-ontime/40" },
  AT_RISK: { label: "At risk", icon: "▲", classes: "bg-status-atrisk/10 text-status-atrisk border-status-atrisk/40" },
  BREACHED: { label: "Breached", icon: "✖", classes: "bg-status-breached/10 text-status-breached border-status-breached/40" },
  IDLE: { label: "Idle", icon: "○", classes: "bg-status-idle/10 text-status-idle border-status-idle/40" },
};

export interface StatusBadgeProps {
  state: StatusBadgeState;
  size?: "inline" | "row" | "hero";
}

export function StatusBadge({ state, size = "row" }: StatusBadgeProps) {
  const { label, icon, classes } = CONFIG[state];
  const sizeClasses =
    size === "hero" ? "px-4 py-2 text-lg" : size === "inline" ? "px-1.5 py-0.5 text-xs" : "px-2.5 py-1 text-sm";

  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full border font-mono font-medium ${classes} ${sizeClasses}`}>
      <span data-testid="status-icon" aria-hidden="true">{icon}</span>
      {label}
    </span>
  );
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- StatusBadge`
Expected: PASS — 1 test.

- [ ] **Step 5: Commit**

```bash
git add src/components/StatusBadge.tsx src/components/StatusBadge.test.tsx
git commit -m "Add StatusBadge component"
```

---

## Task 4: CountdownTimer component

**Files:**
- Create: `src/components/CountdownTimer.tsx`
- Test: `src/components/CountdownTimer.test.tsx`

- [ ] **Step 1: Write the failing test**

```tsx
// src/components/CountdownTimer.test.tsx
// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, act } from "@testing-library/react";
import { CountdownTimer } from "./CountdownTimer";

describe("CountdownTimer", () => {
  afterEach(() => vi.useRealTimers());

  it("shows 'Not started' when there is no deadline", () => {
    render(<CountdownTimer viabilityDeadlineAt={null} />);
    expect(screen.getByText(/not started/i)).toBeInTheDocument();
  });

  it("counts down and ticks every second", () => {
    vi.useFakeTimers();
    const deadline = new Date(Date.now() + 5000).toISOString();
    render(<CountdownTimer viabilityDeadlineAt={deadline} />);
    const first = screen.getByTestId("countdown-value").textContent;
    act(() => {
      vi.advanceTimersByTime(1000);
    });
    const second = screen.getByTestId("countdown-value").textContent;
    expect(second).not.toBe(first);
  });

  it("shows a counting-up breached state past the deadline", () => {
    const deadline = new Date(Date.now() - 60_000).toISOString();
    render(<CountdownTimer viabilityDeadlineAt={deadline} />);
    expect(screen.getByText(/breached/i)).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- CountdownTimer`
Expected: FAIL — `Cannot find module './CountdownTimer'`.

- [ ] **Step 3: Write `src/components/CountdownTimer.tsx`**

```tsx
"use client";

import { useEffect, useState } from "react";
import { computeSlaState } from "@/lib/engines/sla";
import { StatusBadge } from "./StatusBadge";

export interface CountdownTimerProps {
  viabilityDeadlineAt: string | null;
  size?: "hero" | "medium" | "small";
  atRiskThresholdMinutes?: number;
}

function formatDuration(ms: number): string {
  const totalSeconds = Math.floor(Math.abs(ms) / 1000);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  const pad = (n: number) => n.toString().padStart(2, "0");
  return `${pad(hours)}:${pad(minutes)}:${pad(seconds)}`;
}

export function CountdownTimer({ viabilityDeadlineAt, size = "medium", atRiskThresholdMinutes = 30 }: CountdownTimerProps) {
  const [now, setNow] = useState(() => new Date());

  useEffect(() => {
    const interval = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(interval);
  }, []);

  const sizeClasses = size === "hero" ? "text-5xl" : size === "small" ? "text-sm" : "text-2xl";

  if (!viabilityDeadlineAt) {
    return (
      <div className="flex flex-col items-start gap-1">
        <span className={`font-mono tabular-nums text-slate-500 ${sizeClasses}`}>Not started</span>
        <StatusBadge state="IDLE" size={size === "hero" ? "row" : "inline"} />
      </div>
    );
  }

  const deadline = new Date(viabilityDeadlineAt);
  const msRemaining = deadline.getTime() - now.getTime();
  const slaState = computeSlaState(now, deadline, atRiskThresholdMinutes);
  const colorClass =
    slaState === "BREACHED" ? "text-status-breached" : slaState === "AT_RISK" ? "text-status-atrisk" : "text-status-ontime";

  return (
    <div className="flex flex-col items-start gap-1">
      <span data-testid="countdown-value" className={`font-mono tabular-nums ${colorClass} ${sizeClasses}`}>
        {msRemaining <= 0 ? "+" : ""}
        {formatDuration(msRemaining)}
      </span>
      <StatusBadge state={slaState} size={size === "hero" ? "row" : "inline"} />
    </div>
  );
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- CountdownTimer`
Expected: PASS — 3 tests.

- [ ] **Step 5: Commit**

```bash
git add src/components/CountdownTimer.tsx src/components/CountdownTimer.test.tsx
git commit -m "Add CountdownTimer component (hero/medium/small, ticking, breach counts up)"
```

---

## Task 5: MissionStepper component

**Files:**
- Create: `src/components/MissionStepper.tsx`
- Test: `src/components/MissionStepper.test.tsx`

- [ ] **Step 1: Write the failing test**

```tsx
// src/components/MissionStepper.test.tsx
// @vitest-environment jsdom
import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { MissionStepper } from "./MissionStepper";

describe("MissionStepper", () => {
  it("highlights the current happy-path step", () => {
    render(<MissionStepper currentStatus="CustodyStarted" />);
    expect(screen.getByText("Custody started")).toHaveAttribute("aria-current", "step");
  });

  it("shows an exception as an off-path alert branch, not a hidden state", () => {
    render(<MissionStepper currentStatus="Exception_Delay" />);
    expect(screen.getByText(/delay/i)).toBeInTheDocument();
    expect(screen.getByTestId("stepper-exception-banner")).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- MissionStepper`
Expected: FAIL — `Cannot find module './MissionStepper'`.

- [ ] **Step 3: Write `src/components/MissionStepper.tsx`**

```tsx
import type { MissionStatus } from "@/lib/engines/state-machine";

const HAPPY_PATH: Array<{ status: MissionStatus; label: string }> = [
  { status: "OfferReceived", label: "Offer received" },
  { status: "MissionCreated", label: "Mission created" },
  { status: "CarrierRequested", label: "Carrier requested" },
  { status: "CarrierAssigned", label: "Carrier assigned" },
  { status: "Positioning", label: "Positioning" },
  { status: "TeamAtDonor", label: "Team at donor" },
  { status: "CustodyStarted", label: "Custody started" },
  { status: "InTransitGround1", label: "In transit (ground)" },
  { status: "InTransitAir", label: "In transit (air)" },
  { status: "InTransitGround2", label: "In transit (ground)" },
  { status: "Delivered", label: "Delivered" },
  { status: "Closed", label: "Closed" },
];

const EXCEPTION_LABELS: Record<string, string> = {
  Exception_Delay: "Delay",
  Exception_Divert: "Weather/mechanical divert",
  Exception_Declined: "Organ declined",
  Exception_MissedWindow: "Missed window (SLA breached)",
};

export interface MissionStepperProps {
  currentStatus: MissionStatus;
}

export function MissionStepper({ currentStatus }: MissionStepperProps) {
  const isException = currentStatus in EXCEPTION_LABELS;
  const currentIndex = HAPPY_PATH.findIndex((s) => s.status === currentStatus);

  return (
    <div className="flex flex-col gap-3">
      <ol className="flex flex-wrap items-center gap-2">
        {HAPPY_PATH.map((step, i) => {
          const isCurrent = !isException && step.status === currentStatus;
          const isPast = currentIndex >= 0 && i < currentIndex;
          return (
            <li key={step.status} className="flex items-center gap-2">
              <span
                aria-current={isCurrent ? "step" : undefined}
                className={`rounded-full px-3 py-1 text-xs font-mono ${
                  isCurrent
                    ? "bg-status-info text-white"
                    : isPast
                    ? "bg-slate-700 text-slate-300"
                    : "bg-slate-800 text-slate-500"
                }`}
              >
                {step.label}
              </span>
              {i < HAPPY_PATH.length - 1 && <span className="text-slate-700">→</span>}
            </li>
          );
        })}
      </ol>
      {isException && (
        <div
          data-testid="stepper-exception-banner"
          className="rounded-md border border-status-breached/40 bg-status-breached/10 px-3 py-2 text-sm text-status-breached"
        >
          Exception: {EXCEPTION_LABELS[currentStatus]}
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- MissionStepper`
Expected: PASS — 2 tests.

- [ ] **Step 5: Commit**

```bash
git add src/components/MissionStepper.tsx src/components/MissionStepper.test.tsx
git commit -m "Add MissionStepper component with off-path exception branches"
```

---

## Task 6: DutyTimeIndicator component

**Files:**
- Create: `src/components/DutyTimeIndicator.tsx`
- Test: `src/components/DutyTimeIndicator.test.tsx`

- [ ] **Step 1: Write the failing test**

```tsx
// src/components/DutyTimeIndicator.test.tsx
// @vitest-environment jsdom
import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { DutyTimeIndicator } from "./DutyTimeIndicator";

describe("DutyTimeIndicator", () => {
  it("shows a legal, assignable state with the reason absent", () => {
    render(
      <DutyTimeIndicator
        legality={{ legal: true, reasons: [], dutyHoursUsed: 4, dutyHoursLimit: 14, flightHoursUsed: 1, flightHoursLimit: 10, lastRestHours: 12, requiredRestHours: 10 }}
      />
    );
    expect(screen.getByText(/legal/i)).toBeInTheDocument();
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });

  it("shows the specific blocking reason when illegal", () => {
    render(
      <DutyTimeIndicator
        legality={{
          legal: false,
          reasons: ["Insufficient rest: last rest period was 3.0h, 10h required (§135.267; on-call counts as duty per Masterson)"],
          dutyHoursUsed: 2, dutyHoursLimit: 14, flightHoursUsed: 0, flightHoursLimit: 10, lastRestHours: 3, requiredRestHours: 10,
        }}
      />
    );
    expect(screen.getByRole("alert")).toHaveTextContent(/insufficient rest/i);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- DutyTimeIndicator`
Expected: FAIL — `Cannot find module './DutyTimeIndicator'`.

- [ ] **Step 3: Write `src/components/DutyTimeIndicator.tsx`**

```tsx
import type { DutyLegalityResult } from "@/lib/engines/duty-legality";
import { StatusBadge } from "./StatusBadge";

export interface DutyTimeIndicatorProps {
  legality: DutyLegalityResult;
}

export function DutyTimeIndicator({ legality }: DutyTimeIndicatorProps) {
  return (
    <div className="flex flex-col gap-2 rounded-md border border-slate-800 bg-slate-900 p-3">
      <div className="flex items-center gap-2">
        <StatusBadge state={legality.legal ? "ON_TIME" : "BREACHED"} />
        <span className="font-mono text-sm text-slate-300">
          {legality.legal ? "Legal to assign" : "Not legal to assign"}
        </span>
      </div>
      <dl className="grid grid-cols-2 gap-x-4 gap-y-1 font-mono text-xs text-slate-400">
        <dt>Duty (14h window)</dt>
        <dd className="text-right tabular-nums">{legality.dutyHoursUsed}h / {legality.dutyHoursLimit}h</dd>
        <dt>Flight time</dt>
        <dd className="text-right tabular-nums">{legality.flightHoursUsed}h / {legality.flightHoursLimit}h</dd>
        <dt>Last rest</dt>
        <dd className="text-right tabular-nums">{legality.lastRestHours}h (need {legality.requiredRestHours}h)</dd>
      </dl>
      {!legality.legal && (
        <p role="alert" className="text-xs text-status-breached">
          {legality.reasons.join(" ")}
        </p>
      )}
    </div>
  );
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- DutyTimeIndicator`
Expected: PASS — 2 tests.

- [ ] **Step 5: Commit**

```bash
git add src/components/DutyTimeIndicator.tsx src/components/DutyTimeIndicator.test.tsx
git commit -m "Add DutyTimeIndicator component"
```

---

## Task 7: AlertBanner and CallSignTag components

**Files:**
- Create: `src/components/AlertBanner.tsx`
- Create: `src/components/CallSignTag.tsx`
- Test: `src/components/AlertBanner.test.tsx`
- Test: `src/components/CallSignTag.test.tsx`

- [ ] **Step 1: Write the failing tests**

```tsx
// src/components/AlertBanner.test.tsx
// @vitest-environment jsdom
import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { AlertBanner } from "./AlertBanner";

describe("AlertBanner", () => {
  it("renders as dismissible when onDismiss is provided", async () => {
    const onDismiss = vi.fn();
    render(<AlertBanner state="BREACHED" message="Ischemic window breached" onDismiss={onDismiss} />);
    await userEvent.click(screen.getByRole("button", { name: /dismiss/i }));
    expect(onDismiss).toHaveBeenCalled();
  });

  it("renders as persistent with no dismiss button when onDismiss is omitted", () => {
    render(<AlertBanner state="AT_RISK" message="Deadline at risk" />);
    expect(screen.queryByRole("button", { name: /dismiss/i })).not.toBeInTheDocument();
  });
});
```

```tsx
// src/components/CallSignTag.test.tsx
// @vitest-environment jsdom
import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { CallSignTag } from "./CallSignTag";

describe("CallSignTag", () => {
  it("renders MEDEVAC and COMPASSION distinctly", () => {
    const { rerender } = render(<CallSignTag category="MEDEVAC" />);
    expect(screen.getByText("MEDEVAC")).toBeInTheDocument();
    rerender(<CallSignTag category="COMPASSION" />);
    expect(screen.getByText("COMPASSION")).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm test -- AlertBanner CallSignTag`
Expected: FAIL — modules not found.

- [ ] **Step 3: Write `src/components/AlertBanner.tsx`**

```tsx
import type { StatusBadgeState } from "./StatusBadge";

export interface AlertBannerProps {
  state: Exclude<StatusBadgeState, "IDLE">;
  message: string;
  onDismiss?: () => void;
}

const CLASSES: Record<AlertBannerProps["state"], string> = {
  ON_TIME: "border-status-ontime/40 bg-status-ontime/10 text-status-ontime",
  AT_RISK: "border-status-atrisk/40 bg-status-atrisk/10 text-status-atrisk",
  BREACHED: "border-status-breached/40 bg-status-breached/10 text-status-breached",
};

export function AlertBanner({ state, message, onDismiss }: AlertBannerProps) {
  return (
    <div role="alert" className={`flex items-center justify-between gap-4 rounded-md border px-4 py-2 text-sm ${CLASSES[state]}`}>
      <span>{message}</span>
      {onDismiss && (
        <button type="button" onClick={onDismiss} aria-label="Dismiss" className="font-mono text-xs opacity-70 hover:opacity-100">
          Dismiss
        </button>
      )}
    </div>
  );
}
```

- [ ] **Step 4: Write `src/components/CallSignTag.tsx`**

```tsx
export type CallSignCategory = "MEDEVAC" | "COMPASSION" | "NONE";

const CONFIG: Record<CallSignCategory, string> = {
  MEDEVAC: "bg-status-breached/10 text-status-breached border-status-breached/40",
  COMPASSION: "bg-status-info/10 text-status-info border-status-info/40",
  NONE: "bg-status-idle/10 text-status-idle border-status-idle/40",
};

export function CallSignTag({ category }: { category: CallSignCategory }) {
  if (category === "NONE") return null;
  return (
    <span className={`rounded border px-1.5 py-0.5 font-mono text-[10px] font-bold tracking-wide ${CONFIG[category]}`}>
      {category}
    </span>
  );
}
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `npm test -- AlertBanner CallSignTag`
Expected: PASS — 3 tests.

- [ ] **Step 6: Commit**

```bash
git add src/components/AlertBanner.tsx src/components/CallSignTag.tsx src/components/AlertBanner.test.tsx src/components/CallSignTag.test.tsx
git commit -m "Add AlertBanner and CallSignTag components"
```

---

## Task 8: DataTable component

**Files:**
- Create: `src/components/DataTable.tsx`
- Test: `src/components/DataTable.test.tsx`

- [ ] **Step 1: Write the failing test**

```tsx
// src/components/DataTable.test.tsx
// @vitest-environment jsdom
import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { DataTable } from "./DataTable";

interface Row {
  id: string;
  name: string;
}

describe("DataTable", () => {
  const rows: Row[] = [{ id: "1", name: "Alpha" }, { id: "2", name: "Bravo" }];
  const columns = [{ key: "name" as const, header: "Name" }];

  it("renders one row per item with a sticky header", () => {
    render(<DataTable rows={rows} columns={columns} getRowId={(r) => r.id} />);
    expect(screen.getByText("Alpha")).toBeInTheDocument();
    expect(screen.getByText("Bravo")).toBeInTheDocument();
  });

  it("calls onRowSelect when a row is clicked", async () => {
    const onRowSelect = vi.fn();
    render(<DataTable rows={rows} columns={columns} getRowId={(r) => r.id} onRowSelect={onRowSelect} />);
    await userEvent.click(screen.getByText("Alpha"));
    expect(onRowSelect).toHaveBeenCalledWith(rows[0]);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- DataTable`
Expected: FAIL — `Cannot find module './DataTable'`.

- [ ] **Step 3: Write `src/components/DataTable.tsx`**

```tsx
export interface DataTableColumn<T> {
  key: keyof T | string;
  header: string;
  render?: (row: T) => React.ReactNode;
  className?: string;
}

export interface DataTableProps<T> {
  rows: T[];
  columns: DataTableColumn<T>[];
  getRowId: (row: T) => string;
  onRowSelect?: (row: T) => void;
  rowClassName?: (row: T) => string;
}

export function DataTable<T>({ rows, columns, getRowId, onRowSelect, rowClassName }: DataTableProps<T>) {
  return (
    <div className="overflow-auto rounded-md border border-slate-800">
      <table className="w-full border-collapse text-sm">
        <thead className="sticky top-0 bg-slate-900">
          <tr>
            {columns.map((col) => (
              <th key={String(col.key)} className="border-b border-slate-800 px-3 py-2 text-left font-mono text-xs uppercase tracking-wide text-slate-400">
                {col.header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr
              key={getRowId(row)}
              onClick={onRowSelect ? () => onRowSelect(row) : undefined}
              className={`border-b border-slate-900 leading-relaxed hover:bg-slate-900/60 ${onRowSelect ? "cursor-pointer" : ""} ${rowClassName?.(row) ?? ""}`}
            >
              {columns.map((col) => (
                <td key={String(col.key)} className={`px-3 py-2 ${col.className ?? ""}`}>
                  {col.render ? col.render(row) : String((row as any)[col.key] ?? "")}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- DataTable`
Expected: PASS — 2 tests.

- [ ] **Step 5: Commit**

```bash
git add src/components/DataTable.tsx src/components/DataTable.test.tsx
git commit -m "Add generic DataTable component"
```

---

## Task 9: MissionCard component

**Files:**
- Create: `src/components/MissionCard.tsx`
- Test: `src/components/MissionCard.test.tsx`

- [ ] **Step 1: Write the failing test**

```tsx
// src/components/MissionCard.test.tsx
// @vitest-environment jsdom
import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { MissionCard } from "./MissionCard";
import type { MissionListRow } from "@/lib/queries/missions";

const baseMission: MissionListRow = {
  id: "m1",
  status: "InTransitAir",
  organType: "HEART",
  preservationMethod: "STATIC_COLD",
  donorHospitalName: "NewYork-Presbyterian",
  recipientHospitalName: "Penn Presbyterian",
  viabilityDeadlineAt: new Date(Date.now() + 3_600_000).toISOString(),
  slaState: "ON_TIME",
};

describe("MissionCard", () => {
  it("shows organ type, route, and countdown", () => {
    render(<MissionCard mission={baseMission} />);
    expect(screen.getByText("HEART")).toBeInTheDocument();
    expect(screen.getByText(/NewYork-Presbyterian/)).toBeInTheDocument();
    expect(screen.getByText(/Penn Presbyterian/)).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- MissionCard`
Expected: FAIL — `Cannot find module './MissionCard'`.

- [ ] **Step 3: Write `src/components/MissionCard.tsx`**

```tsx
import Link from "next/link";
import type { MissionListRow } from "@/lib/queries/missions";
import { CountdownTimer } from "./CountdownTimer";

export function MissionCard({ mission }: { mission: MissionListRow }) {
  return (
    <Link
      href={`/missions/${mission.id}`}
      className="flex flex-col gap-3 rounded-lg border border-slate-800 bg-slate-900 p-4 hover:border-slate-700"
    >
      <div className="flex items-center justify-between">
        <span className="font-mono text-sm font-semibold text-slate-100">{mission.organType ?? "Organ TBD"}</span>
        <span className="font-mono text-xs text-slate-500">{mission.status}</span>
      </div>
      <p className="text-sm text-slate-400">
        {mission.donorHospitalName} → {mission.recipientHospitalName}
      </p>
      <CountdownTimer viabilityDeadlineAt={mission.viabilityDeadlineAt} size="medium" />
    </Link>
  );
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- MissionCard`
Expected: PASS — 1 test.

- [ ] **Step 5: Commit**

```bash
git add src/components/MissionCard.tsx src/components/MissionCard.test.tsx
git commit -m "Add MissionCard component"
```

---

## Task 10: CustodyTimeline component

**Files:**
- Create: `src/components/CustodyTimeline.tsx`
- Test: `src/components/CustodyTimeline.test.tsx`

- [ ] **Step 1: Write the failing test**

```tsx
// src/components/CustodyTimeline.test.tsx
// @vitest-environment jsdom
import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { CustodyTimeline } from "./CustodyTimeline";

describe("CustodyTimeline", () => {
  it("shows an empty state before cross-clamp", () => {
    render(<CustodyTimeline events={[]} />);
    expect(screen.getByText(/awaiting cross-clamp/i)).toBeInTheDocument();
  });

  it("lists each custody event with actor role, time, and proof type", () => {
    render(
      <CustodyTimeline
        events={[
          { id: "1", eventType: "TAKE", occurredAt: "2026-07-20T10:00:00Z", custodianRole: "COURIER", proofType: "SIGNATURE" },
          { id: "2", eventType: "HANDOFF", occurredAt: "2026-07-20T10:30:00Z", custodianRole: "COURIER", proofType: "PHOTO" },
        ]}
      />
    );
    expect(screen.getByText("TAKE")).toBeInTheDocument();
    expect(screen.getByText("HANDOFF")).toBeInTheDocument();
    expect(screen.getAllByText("COURIER")).toHaveLength(2);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- CustodyTimeline`
Expected: FAIL — `Cannot find module './CustodyTimeline'`.

- [ ] **Step 3: Write `src/components/CustodyTimeline.tsx`**

```tsx
export interface CustodyTimelineEvent {
  id: string;
  eventType: string;
  occurredAt: string;
  custodianRole: string;
  proofType: string | null;
}

export function CustodyTimeline({ events }: { events: CustodyTimelineEvent[] }) {
  if (events.length === 0) {
    return <p className="text-sm text-slate-500">Awaiting cross-clamp — no custody events yet.</p>;
  }

  return (
    <ol className="flex flex-col gap-3 border-l border-slate-800 pl-4">
      {events.map((event) => (
        <li key={event.id} className="relative">
          <span className="absolute -left-[21px] top-1 h-2 w-2 rounded-full bg-status-info" />
          <div className="flex items-center gap-2 font-mono text-sm text-slate-200">
            <span className="font-semibold">{event.eventType}</span>
            <span className="text-slate-500">{event.custodianRole}</span>
          </div>
          <div className="flex items-center gap-2 text-xs text-slate-500">
            <time dateTime={event.occurredAt}>{new Date(event.occurredAt).toLocaleString()}</time>
            {event.proofType && <span>· proof: {event.proofType}</span>}
          </div>
        </li>
      ))}
    </ol>
  );
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- CustodyTimeline`
Expected: PASS — 2 tests.

- [ ] **Step 5: Commit**

```bash
git add src/components/CustodyTimeline.tsx src/components/CustodyTimeline.test.tsx
git commit -m "Add CustodyTimeline component"
```

---

## Task 11: MissionMap component (Mapbox GL JS, static/seeded positions)

**Files:**
- Modify: `package.json`
- Create: `src/components/MissionMap.tsx`
- Modify: `.env.local.example`

- [ ] **Step 1: Add the Mapbox dependency**

Add to `dependencies`: `"mapbox-gl": "^3.7.0"`. Add to `devDependencies`: `"@types/mapbox-gl": "^3.4.1"`.

Run: `npm install`
Expected: installs without error.

- [ ] **Step 2: Add the Mapbox token placeholder to `.env.local.example`**

```
NEXT_PUBLIC_MAPBOX_TOKEN=replace-with-your-mapbox-access-token
```

Then add the real token to your own `.env.local` (get one free at https://account.mapbox.com/access-tokens/).

- [ ] **Step 3: Write `src/components/MissionMap.tsx`**

No test for this component — it wraps a third-party imperative canvas library (Mapbox GL) with no branching logic to unit-test; verify visually in Task 16's browser walkthrough per the project's UI-testing convention.

```tsx
"use client";

import { useEffect, useRef } from "react";
import mapboxgl from "mapbox-gl";
import "mapbox-gl/dist/mapbox-gl.css";

export interface MapMarker {
  id: string;
  lngLat: [number, number];
  label: string;
  kind: "hospital" | "airport" | "custody";
  status?: "ON_TIME" | "AT_RISK" | "BREACHED";
}

export interface MissionMapProps {
  markers: MapMarker[];
  routeLngLats?: [number, number][];
}

const STATUS_COLOR: Record<NonNullable<MapMarker["status"]>, string> = {
  ON_TIME: "#1FAE7A",
  AT_RISK: "#E8A33D",
  BREACHED: "#E5484D",
};

export function MissionMap({ markers, routeLngLats }: MissionMapProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<mapboxgl.Map | null>(null);

  useEffect(() => {
    if (!containerRef.current) return;
    mapboxgl.accessToken = process.env.NEXT_PUBLIC_MAPBOX_TOKEN!;

    const map = new mapboxgl.Map({
      container: containerRef.current,
      style: "mapbox://styles/mapbox/dark-v11",
      center: markers[0]?.lngLat ?? [-74.006, 40.7128],
      zoom: 7,
    });
    mapRef.current = map;

    for (const marker of markers) {
      const el = document.createElement("div");
      el.style.width = "12px";
      el.style.height = "12px";
      el.style.borderRadius = "50%";
      el.style.border = "2px solid white";
      el.style.background = marker.status ? STATUS_COLOR[marker.status] : marker.kind === "airport" ? "#3E7BFA" : "#6B7280";

      new mapboxgl.Marker(el)
        .setLngLat(marker.lngLat)
        .setPopup(new mapboxgl.Popup({ offset: 12 }).setText(marker.label))
        .addTo(map);
    }

    if (routeLngLats && routeLngLats.length > 1) {
      map.on("load", () => {
        map.addSource("mission-route", {
          type: "geojson",
          data: { type: "Feature", properties: {}, geometry: { type: "LineString", coordinates: routeLngLats } },
        });
        map.addLayer({
          id: "mission-route-line",
          type: "line",
          source: "mission-route",
          paint: { "line-color": "#3E7BFA", "line-width": 2, "line-dasharray": [2, 1] },
        });
      });
    }

    return () => map.remove();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return <div ref={containerRef} className="h-full min-h-[320px] w-full rounded-lg" />;
}
```

- [ ] **Step 4: Verify the project builds with the new dependency**

Run: `npm run build`
Expected: `Compiled successfully`.

- [ ] **Step 5: Commit**

```bash
git add package.json .env.local.example src/components/MissionMap.tsx
git commit -m "Add MissionMap component (Mapbox GL JS, static custody/route markers)"
```

---

## Task 12: Realtime hooks

**Files:**
- Create: `src/lib/hooks/useRealtimeMissionList.ts`
- Create: `src/lib/hooks/useRealtimeMission.ts`

Both hooks subscribe to Postgres Changes and call a caller-supplied `onChange` to trigger a refetch — kept dumb on purpose so the actual re-query (Task 2's helpers) stays in one place and is easy to test in isolation; the hooks themselves are thin enough that a live Supabase connection is the only meaningful test, which happens in Task 16's browser walkthrough.

- [ ] **Step 1: Write `src/lib/hooks/useRealtimeMissionList.ts`**

```typescript
"use client";

import { useEffect } from "react";
import { createClient } from "@/lib/supabase/client";

/** Re-fires onChange whenever any mission or mission_event row changes, for dashboard list refresh. */
export function useRealtimeMissionList(onChange: () => void) {
  useEffect(() => {
    const supabase = createClient();
    const channel = supabase
      .channel("dashboard-missions")
      .on("postgres_changes", { event: "*", schema: "public", table: "mission" }, onChange)
      .on("postgres_changes", { event: "*", schema: "public", table: "mission_event" }, onChange)
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
}
```

- [ ] **Step 2: Write `src/lib/hooks/useRealtimeMission.ts`**

```typescript
"use client";

import { useEffect } from "react";
import { createClient } from "@/lib/supabase/client";

/** Re-fires onChange whenever this mission's row, its events, or its custody events change. */
export function useRealtimeMission(missionId: string, onChange: () => void) {
  useEffect(() => {
    const supabase = createClient();
    const channel = supabase
      .channel(`mission-detail-${missionId}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "mission", filter: `id=eq.${missionId}` }, onChange)
      .on("postgres_changes", { event: "*", schema: "public", table: "mission_event", filter: `mission_id=eq.${missionId}` }, onChange)
      .on("postgres_changes", { event: "*", schema: "public", table: "custody_event" }, onChange)
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [missionId]);
}
```

- [ ] **Step 3: Verify the project builds**

Run: `npm run build`
Expected: `Compiled successfully`.

- [ ] **Step 4: Commit**

```bash
git add src/lib/hooks
git commit -m "Add realtime subscription hooks for mission list and mission detail"
```

---

## Task 13: Dispatch Dashboard screen (1.1)

**Files:**
- Create: `src/app/dashboard/page.tsx`
- Create: `src/app/dashboard/DashboardClient.tsx`

- [ ] **Step 1: Write `src/app/dashboard/DashboardClient.tsx`** (Client Component: realtime refresh + rendering)

```tsx
"use client";

import { useCallback, useEffect, useState, useTransition } from "react";
import Link from "next/link";
import type { MissionListRow } from "@/lib/queries/missions";
import { useRealtimeMissionList } from "@/lib/hooks/useRealtimeMissionList";
import { MissionCard } from "@/components/MissionCard";
import { AlertBanner } from "@/components/AlertBanner";

export interface DashboardClientProps {
  initialMissions: MissionListRow[];
  refreshMissions: () => Promise<MissionListRow[]>;
}

export function DashboardClient({ initialMissions, refreshMissions }: DashboardClientProps) {
  const [missions, setMissions] = useState(initialMissions);
  const [, startTransition] = useTransition();

  const refresh = useCallback(() => {
    startTransition(async () => {
      setMissions(await refreshMissions());
    });
  }, [refreshMissions]);

  useRealtimeMissionList(refresh);

  // Client-side re-sort every 30s so a mission crossing into AT_RISK/BREACHED moves without a DB write.
  useEffect(() => {
    const interval = setInterval(refresh, 30_000);
    return () => clearInterval(interval);
  }, [refresh]);

  const breached = missions.filter((m) => m.slaState === "BREACHED");
  const atRisk = missions.filter((m) => m.slaState === "AT_RISK");

  return (
    <div className="flex flex-col gap-6 p-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-mono text-xl font-bold text-slate-100">Mission Dashboard</h1>
          <p className="text-sm text-slate-500">
            {breached.length} breached · {atRisk.length} at risk · {missions.length} active
          </p>
        </div>
        <Link
          href="/missions/new"
          className="rounded-md bg-status-info px-4 py-2 text-sm font-medium text-white"
        >
          New Mission
        </Link>
      </div>

      {breached.length > 0 && (
        <AlertBanner state="BREACHED" message={`${breached.length} mission(s) have breached their ischemic window.`} />
      )}

      {missions.length === 0 ? (
        <p className="text-sm text-slate-500">No active missions.</p>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {missions.map((mission) => (
            <MissionCard key={mission.id} mission={mission} />
          ))}
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Write `src/app/dashboard/page.tsx`** (Server Component: initial fetch + server action to refresh)

```tsx
import { createClient } from "@/lib/supabase/server";
import { getMissionList } from "@/lib/queries/missions";
import { DashboardClient } from "./DashboardClient";

export default async function DashboardPage() {
  const supabase = await createClient();
  const missions = await getMissionList(supabase);

  async function refreshMissions() {
    "use server";
    const client = await createClient();
    return getMissionList(client);
  }

  return <DashboardClient initialMissions={missions} refreshMissions={refreshMissions} />;
}
```

- [ ] **Step 3: Run the dev server and verify in the browser**

Run: `npm run dev`
Visit `http://localhost:3000/dashboard` (log in first at `/login` with a seeded coordinator user — see Task 17's manual verification pass for how to create one).
Expected: two mission cards render (`OfferReceived` and `InTransitAir` from the seed data), sorted with the sooner deadline first; the in-flight mission's countdown ticks once per second.

- [ ] **Step 4: Commit**

```bash
git add src/app/dashboard
git commit -m "Add Dispatch Mission Dashboard screen (1.1)"
```

---

## Task 14: New Mission intake screen (1.2)

**Files:**
- Create: `src/lib/actions/create-mission-action.ts`
- Test: `src/lib/actions/create-mission-action.test.ts`
- Create: `src/app/missions/new/page.tsx`
- Create: `src/app/missions/new/NewMissionForm.tsx`

Ischemic budget defaults follow `data-model.md`'s per-organ, per-preservation-method table (assumed machine-perfusion-favorable defaults per `open-questions.md` Q5), editable by the coordinator.

- [ ] **Step 1: Write the failing test for the default-budget lookup**

```typescript
// src/lib/actions/create-mission-action.test.ts
import { describe, it, expect } from "vitest";
import { suggestIschemicBudgetMinutes } from "./create-mission-action";

describe("suggestIschemicBudgetMinutes", () => {
  it("gives a longer window for machine perfusion than static cold, same organ", () => {
    const staticCold = suggestIschemicBudgetMinutes("KIDNEY", "STATIC_COLD");
    const machinePerfusion = suggestIschemicBudgetMinutes("KIDNEY", "MACHINE_PERFUSION");
    expect(machinePerfusion).toBeGreaterThan(staticCold);
  });

  it("gives a much shorter window for a heart than a kidney", () => {
    expect(suggestIschemicBudgetMinutes("HEART", "STATIC_COLD")).toBeLessThan(
      suggestIschemicBudgetMinutes("KIDNEY", "STATIC_COLD")
    );
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- create-mission-action`
Expected: FAIL — `Cannot find module './create-mission-action'`.

- [ ] **Step 3: Write `src/lib/actions/create-mission-action.ts`**

```typescript
"use server";

import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database";

type OrganType = "HEART" | "LUNG" | "LIVER" | "PANCREAS" | "KIDNEY";
type PreservationMethod = "STATIC_COLD" | "MACHINE_PERFUSION";

// Default windows (minutes) — editable per-mission in the UI. Static-cold values follow
// conservative clinical practice; machine-perfusion values extend the window per the
// plan's R5/Q5 assumption. Confirm with a transplant coordinator before relying on these
// clinically (see open-questions.md Q5) — these are POC defaults, not medical advice.
const STATIC_COLD_MINUTES: Record<OrganType, number> = {
  HEART: 4 * 60,
  LUNG: 6 * 60,
  LIVER: 12 * 60,
  PANCREAS: 12 * 60,
  KIDNEY: 24 * 60,
};
const MACHINE_PERFUSION_MULTIPLIER = 1.5;

export function suggestIschemicBudgetMinutes(organType: OrganType, preservationMethod: PreservationMethod): number {
  const base = STATIC_COLD_MINUTES[organType];
  return preservationMethod === "MACHINE_PERFUSION" ? Math.round(base * MACHINE_PERFUSION_MULTIPLIER) : base;
}

export interface CreateMissionInput {
  organType: OrganType;
  preservationMethod: PreservationMethod;
  ischemicBudgetMinutes: number;
  donorHospitalId: string;
  recipientHospitalId: string;
  contractId: string;
  opoOrgId: string;
  operatorOrgId: string;
}

export type CreateMissionResult = { ok: true; missionId: string } | { ok: false; error: string };

export async function createMission(
  supabase: SupabaseClient<Database>,
  input: CreateMissionInput
): Promise<CreateMissionResult> {
  const { data: mission, error: missionError } = await supabase
    .from("mission")
    .insert({
      contract_id: input.contractId,
      opo_org_id: input.opoOrgId,
      operator_org_id: input.operatorOrgId,
      donor_hospital_id: input.donorHospitalId,
      recipient_hospital_id: input.recipientHospitalId,
      status: "OfferReceived",
    })
    .select()
    .single();
  if (missionError || !mission) return { ok: false, error: missionError?.message ?? "Failed to create mission" };

  const { data: organ, error: organError } = await supabase
    .from("organ")
    .insert({
      mission_id: mission.id,
      organ_type: input.organType,
      preservation_method: input.preservationMethod,
      ischemic_budget_minutes: input.ischemicBudgetMinutes,
    })
    .select()
    .single();
  if (organError || !organ) return { ok: false, error: organError?.message ?? "Failed to create organ record" };

  const { error: linkError } = await supabase.from("mission").update({ organ_id: organ.id }).eq("id", mission.id);
  if (linkError) return { ok: false, error: linkError.message };

  return { ok: true, missionId: mission.id };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- create-mission-action`
Expected: PASS — 2 tests.

- [ ] **Step 5: Write `src/app/missions/new/NewMissionForm.tsx`**

```tsx
"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { createMission, suggestIschemicBudgetMinutes } from "@/lib/actions/create-mission-action";

export interface NewMissionFormProps {
  hospitals: Array<{ id: string; name: string; type: string }>;
  contractId: string;
  opoOrgId: string;
  operatorOrgId: string;
}

const ORGAN_TYPES = ["HEART", "LUNG", "LIVER", "PANCREAS", "KIDNEY"] as const;
const PRESERVATION_METHODS = ["STATIC_COLD", "MACHINE_PERFUSION"] as const;

export function NewMissionForm({ hospitals, contractId, opoOrgId, operatorOrgId }: NewMissionFormProps) {
  const router = useRouter();
  const [organType, setOrganType] = useState<(typeof ORGAN_TYPES)[number]>("KIDNEY");
  const [preservationMethod, setPreservationMethod] = useState<(typeof PRESERVATION_METHODS)[number]>("STATIC_COLD");
  const [budgetMinutes, setBudgetMinutes] = useState(suggestIschemicBudgetMinutes("KIDNEY", "STATIC_COLD"));
  const [donorHospitalId, setDonorHospitalId] = useState(hospitals[0]?.id ?? "");
  const [recipientHospitalId, setRecipientHospitalId] = useState(hospitals[1]?.id ?? "");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  function handleOrganOrMethodChange(nextOrgan: typeof organType, nextMethod: typeof preservationMethod) {
    setOrganType(nextOrgan);
    setPreservationMethod(nextMethod);
    setBudgetMinutes(suggestIschemicBudgetMinutes(nextOrgan, nextMethod));
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    const supabase = createClient();
    const result = await createMission(supabase, {
      organType, preservationMethod, ischemicBudgetMinutes: budgetMinutes,
      donorHospitalId, recipientHospitalId, contractId, opoOrgId, operatorOrgId,
    });
    setSubmitting(false);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    router.push(`/missions/${result.missionId}`);
  }

  const isTight = budgetMinutes < 6 * 60;

  return (
    <form onSubmit={handleSubmit} className="flex max-w-lg flex-col gap-4 p-6">
      {error && <p role="alert" className="text-sm text-status-breached">{error}</p>}

      <label className="flex flex-col gap-1 text-sm text-slate-300">
        Organ type
        <select
          value={organType}
          onChange={(e) => handleOrganOrMethodChange(e.target.value as typeof organType, preservationMethod)}
          className="rounded-md border border-slate-700 bg-slate-900 px-3 py-2"
        >
          {ORGAN_TYPES.map((o) => <option key={o} value={o}>{o}</option>)}
        </select>
      </label>

      <label className="flex flex-col gap-1 text-sm text-slate-300">
        Preservation method
        <select
          value={preservationMethod}
          onChange={(e) => handleOrganOrMethodChange(organType, e.target.value as typeof preservationMethod)}
          className="rounded-md border border-slate-700 bg-slate-900 px-3 py-2"
        >
          {PRESERVATION_METHODS.map((m) => <option key={m} value={m}>{m}</option>)}
        </select>
      </label>

      <label className="flex flex-col gap-1 text-sm text-slate-300">
        Ischemic budget (minutes)
        <input
          type="number"
          min={1}
          value={budgetMinutes}
          onChange={(e) => setBudgetMinutes(Number(e.target.value))}
          className="rounded-md border border-slate-700 bg-slate-900 px-3 py-2"
        />
      </label>
      {isTight && (
        <p className="text-sm text-status-atrisk">Feasibility: this is a tight window — confirm carrier availability before committing.</p>
      )}

      <label className="flex flex-col gap-1 text-sm text-slate-300">
        Donor hospital
        <select value={donorHospitalId} onChange={(e) => setDonorHospitalId(e.target.value)} className="rounded-md border border-slate-700 bg-slate-900 px-3 py-2">
          {hospitals.map((h) => <option key={h.id} value={h.id}>{h.name}</option>)}
        </select>
      </label>

      <label className="flex flex-col gap-1 text-sm text-slate-300">
        Recipient center
        <select value={recipientHospitalId} onChange={(e) => setRecipientHospitalId(e.target.value)} className="rounded-md border border-slate-700 bg-slate-900 px-3 py-2">
          {hospitals.map((h) => <option key={h.id} value={h.id}>{h.name}</option>)}
        </select>
      </label>

      <button type="submit" disabled={submitting} className="rounded-md bg-status-info px-4 py-2 font-medium text-white disabled:opacity-50">
        {submitting ? "Creating..." : "Create Mission"}
      </button>
    </form>
  );
}
```

- [ ] **Step 6: Write `src/app/missions/new/page.tsx`**

```tsx
import { createClient } from "@/lib/supabase/server";
import { NewMissionForm } from "./NewMissionForm";

export default async function NewMissionPage() {
  const supabase = await createClient();
  const { data: hospitals } = await supabase.from("hospital").select("id, name, type");
  const { data: contract } = await supabase.from("contract").select("id, opo_org_id, operator_org_id").limit(1).single();

  return (
    <div>
      <h1 className="p-6 pb-0 font-mono text-xl font-bold text-slate-100">New Mission</h1>
      <NewMissionForm
        hospitals={hospitals ?? []}
        contractId={contract?.id ?? ""}
        opoOrgId={contract?.opo_org_id ?? ""}
        operatorOrgId={contract?.operator_org_id ?? ""}
      />
    </div>
  );
}
```

- [ ] **Step 7: Run the dev server and verify in the browser**

Run: `npm run dev`
Visit `http://localhost:3000/missions/new`, submit the form with a hospital pair.
Expected: redirects to `/missions/<new-id>` (a 404 is fine until Task 16 builds that page) and the new mission appears on `/dashboard` with status `OfferReceived`.

- [ ] **Step 8: Commit**

```bash
git add src/lib/actions/create-mission-action.ts src/lib/actions/create-mission-action.test.ts src/app/missions/new
git commit -m "Add New Mission intake screen (1.2)"
```

---

## Task 15: assignCarrier server action + Carrier Assignment screen (1.4)

**Files:**
- Create: `src/lib/actions/assign-carrier-action.ts`
- Test: `src/lib/actions/assign-carrier-action.test.ts`
- Create: `src/app/missions/[id]/carrier/page.tsx`
- Create: `src/app/missions/[id]/carrier/CarrierAssignmentClient.tsx`

This is the product's defining screen per the design brief: only D085-authorized, CSL-sufficient, duty-legal aircraft/crew are selectable — everything else is shown blocked with its reason, never hidden.

- [ ] **Step 1: Write the failing test**

```typescript
// src/lib/actions/assign-carrier-action.test.ts
import { describe, it, expect, vi } from "vitest";
import { getCarrierCandidates } from "./assign-carrier-action";

describe("getCarrierCandidates", () => {
  it("marks an aircraft not on D085 as blocked, with pilots evaluated regardless", async () => {
    const client = {
      from: (table: string) => {
        if (table === "contract") {
          return { select: () => ({ eq: () => ({ single: async () => ({ data: { required_csl_amount: 20_000_000 }, error: null }) }) }) };
        }
        if (table === "aircraft") {
          return {
            select: () => ({
              eq: async () => ({
                data: [
                  { id: "ac1", tail_number: "N42MA", type: "Phenom 300", on_d085: true, liability_csl_amount: 25_000_000, status: "AVAILABLE" },
                  { id: "ac2", tail_number: "N17MA", type: "CJ3+", on_d085: false, liability_csl_amount: 25_000_000, status: "AVAILABLE" },
                ],
                error: null,
              }),
            }),
          };
        }
        if (table === "pilot") {
          return { select: () => ({ eq: async () => ({ data: [{ id: "p1", name: "J. Alvarez", currency_status: "CURRENT" }], error: null }) }) };
        }
        if (table === "duty_record") {
          return { select: () => ({ eq: async () => ({ data: [{ pilot_id: "p1", record_type: "REST", start_at: new Date(Date.now() - 20 * 3_600_000).toISOString(), end_at: new Date(Date.now() - 6 * 3_600_000).toISOString() }], error: null }) }) };
        }
        throw new Error(`unexpected table ${table}`);
      },
    } as any;

    const candidates = await getCarrierCandidates(client, "operator-org-1", "contract-1");
    const blocked = candidates.find((c) => c.aircraft.tailNumber === "N17MA");
    const legal = candidates.find((c) => c.aircraft.tailNumber === "N42MA");

    expect(blocked?.aircraftLegal).toBe(false);
    expect(blocked?.aircraftReasons.some((r) => r.includes("D085"))).toBe(true);
    expect(legal?.aircraftLegal).toBe(true);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- assign-carrier-action`
Expected: FAIL — `Cannot find module './assign-carrier-action'`.

- [ ] **Step 3: Write `src/lib/actions/assign-carrier-action.ts`**

```typescript
"use server";

import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database";
import { computeCrewAssignmentLegality, type CrewAssignmentLegalityResult, type DutyRecord } from "@/lib/engines/duty-legality";

export interface CarrierCandidate {
  aircraft: { id: string; tailNumber: string; type: string };
  aircraftLegal: boolean;
  aircraftReasons: string[];
  pilots: Array<{ id: string; name: string; legality: CrewAssignmentLegalityResult }>;
}

export async function getCarrierCandidates(
  supabase: SupabaseClient<Database>,
  operatorOrgId: string,
  contractId: string
): Promise<CarrierCandidate[]> {
  const { data: contract, error: contractError } = await supabase
    .from("contract")
    .select("required_csl_amount")
    .eq("id", contractId)
    .single();
  if (contractError || !contract) throw contractError ?? new Error("Contract not found");

  const { data: aircraftRows, error: aircraftError } = await supabase
    .from("aircraft")
    .select("id, tail_number, type, on_d085, liability_csl_amount, status")
    .eq("operator_org_id", operatorOrgId);
  if (aircraftError) throw aircraftError;

  const { data: pilotRows, error: pilotError } = await supabase
    .from("pilot")
    .select("id, name, currency_status")
    .eq("operator_org_id", operatorOrgId);
  if (pilotError) throw pilotError;

  const now = new Date();
  const pilotsWithLegality = await Promise.all(
    (pilotRows ?? []).map(async (pilot: any) => {
      const { data: dutyRows, error: dutyError } = await supabase
        .from("duty_record")
        .select("record_type, start_at, end_at")
        .eq("pilot_id", pilot.id);
      if (dutyError) throw dutyError;

      const legality = computeCrewAssignmentLegality(
        { currencyStatus: pilot.currency_status },
        (dutyRows ?? []) as DutyRecord[],
        now
      );
      return { id: pilot.id, name: pilot.name, legality };
    })
  );

  return (aircraftRows ?? []).map((aircraft: any) => {
    const reasons: string[] = [];
    if (!aircraft.on_d085) reasons.push("Aircraft is not authorized on D085 — cannot fly revenue.");
    if (aircraft.liability_csl_amount < contract.required_csl_amount) {
      reasons.push(`Liability coverage ($${aircraft.liability_csl_amount.toLocaleString()}) is below the contract's required CSL ($${contract.required_csl_amount.toLocaleString()}).`);
    }
    if (aircraft.status !== "AVAILABLE") reasons.push(`Aircraft status is ${aircraft.status}, not AVAILABLE.`);

    return {
      aircraft: { id: aircraft.id, tailNumber: aircraft.tail_number, type: aircraft.type },
      aircraftLegal: reasons.length === 0,
      aircraftReasons: reasons,
      pilots: pilotsWithLegality,
    };
  });
}

export interface AssignCarrierInput {
  missionId: string;
  aircraftId: string;
  crew: Array<{ pilotId: string; role: "PIC" | "SIC" }>;
}

export type AssignCarrierResult = { ok: true } | { ok: false; error: string };

export async function assignCarrier(
  supabase: SupabaseClient<Database>,
  operatorOrgId: string,
  contractId: string,
  input: AssignCarrierInput
): Promise<AssignCarrierResult> {
  const candidates = await getCarrierCandidates(supabase, operatorOrgId, contractId);
  const candidate = candidates.find((c) => c.aircraft.id === input.aircraftId);
  if (!candidate || !candidate.aircraftLegal) {
    return { ok: false, error: candidate?.aircraftReasons.join(" ") ?? "Aircraft not found" };
  }

  const crewWithSnapshots = input.crew.map((c) => {
    const pilot = candidate.pilots.find((p) => p.id === c.pilotId);
    if (!pilot || !pilot.legality.legal) {
      return null;
    }
    return { pilot_id: c.pilotId, role: c.role, legality_snapshot: pilot.legality };
  });

  if (crewWithSnapshots.some((c) => c === null)) {
    return { ok: false, error: "One or more selected crew members are not duty-legal for this assignment." };
  }

  const { error } = await supabase.rpc("assign_carrier_and_transition", {
    p_mission_id: input.missionId,
    p_aircraft_id: input.aircraftId,
    p_crew: crewWithSnapshots as any,
  });
  if (error) return { ok: false, error: error.message };

  return { ok: true };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- assign-carrier-action`
Expected: PASS — 1 test.

- [ ] **Step 5: Write `src/app/missions/[id]/carrier/CarrierAssignmentClient.tsx`**

```tsx
"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { assignCarrier, type CarrierCandidate } from "@/lib/actions/assign-carrier-action";
import { DutyTimeIndicator } from "@/components/DutyTimeIndicator";
import { StatusBadge } from "@/components/StatusBadge";

export interface CarrierAssignmentClientProps {
  missionId: string;
  operatorOrgId: string;
  contractId: string;
  candidates: CarrierCandidate[];
}

export function CarrierAssignmentClient({ missionId, operatorOrgId, contractId, candidates }: CarrierAssignmentClientProps) {
  const router = useRouter();
  const [selectedAircraftId, setSelectedAircraftId] = useState<string | null>(null);
  const [selectedPilotId, setSelectedPilotId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const selectedCandidate = candidates.find((c) => c.aircraft.id === selectedAircraftId) ?? null;

  async function handleAssign() {
    if (!selectedAircraftId || !selectedPilotId) return;
    setSubmitting(true);
    setError(null);
    const supabase = createClient();
    const result = await assignCarrier(supabase, operatorOrgId, contractId, {
      missionId,
      aircraftId: selectedAircraftId,
      crew: [{ pilotId: selectedPilotId, role: "PIC" }],
    });
    setSubmitting(false);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    router.push(`/missions/${missionId}`);
  }

  return (
    <div className="flex flex-col gap-6 p-6">
      <h1 className="font-mono text-xl font-bold text-slate-100">Carrier Assignment & Feasibility</h1>
      {error && <p role="alert" className="text-sm text-status-breached">{error}</p>}

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        {candidates.map((candidate) => {
          const isSelected = selectedAircraftId === candidate.aircraft.id;
          return (
            <div
              key={candidate.aircraft.id}
              className={`flex flex-col gap-3 rounded-lg border p-4 ${
                candidate.aircraftLegal
                  ? isSelected ? "border-status-info bg-status-info/5" : "border-slate-800 bg-slate-900"
                  : "border-status-breached/30 bg-status-breached/5 opacity-70"
              }`}
            >
              <div className="flex items-center justify-between">
                <span className="font-mono text-sm font-semibold text-slate-100">{candidate.aircraft.tailNumber} — {candidate.aircraft.type}</span>
                <StatusBadge state={candidate.aircraftLegal ? "ON_TIME" : "BREACHED"} size="inline" />
              </div>

              {!candidate.aircraftLegal ? (
                <p role="alert" className="text-xs text-status-breached">{candidate.aircraftReasons.join(" ")}</p>
              ) : (
                <>
                  <p className="text-xs text-slate-500">Crew — select a legal pilot to assign as PIC:</p>
                  <div className="flex flex-col gap-2">
                    {candidate.pilots.map((pilot) => (
                      <label key={pilot.id} className={`flex items-center gap-2 rounded-md border p-2 ${pilot.legality.legal ? "border-slate-800" : "border-status-breached/30 opacity-60"}`}>
                        <input
                          type="radio"
                          name="pilot"
                          disabled={!pilot.legality.legal}
                          checked={selectedAircraftId === candidate.aircraft.id && selectedPilotId === pilot.id}
                          onChange={() => {
                            setSelectedAircraftId(candidate.aircraft.id);
                            setSelectedPilotId(pilot.id);
                          }}
                        />
                        <span className="flex-1 text-sm text-slate-200">{pilot.name}</span>
                      </label>
                    ))}
                  </div>
                  {isSelected && selectedPilotId && (
                    <DutyTimeIndicator legality={candidate.pilots.find((p) => p.id === selectedPilotId)!.legality} />
                  )}
                </>
              )}
            </div>
          );
        })}
      </div>

      <button
        type="button"
        disabled={!selectedAircraftId || !selectedPilotId || !selectedCandidate?.aircraftLegal || submitting}
        onClick={handleAssign}
        className="w-fit rounded-md bg-status-info px-4 py-2 font-medium text-white disabled:opacity-50"
      >
        {submitting ? "Assigning..." : "Assign Carrier"}
      </button>
    </div>
  );
}
```

- [ ] **Step 6: Write `src/app/missions/[id]/carrier/page.tsx`**

```tsx
import { createClient } from "@/lib/supabase/server";
import { getCarrierCandidates } from "@/lib/actions/assign-carrier-action";
import { CarrierAssignmentClient } from "./CarrierAssignmentClient";

export default async function CarrierAssignmentPage({ params }: { params: Promise<{ id: string }> }) {
  const { id: missionId } = await params;
  const supabase = await createClient();

  const { data: mission } = await supabase.from("mission").select("operator_org_id, contract_id").eq("id", missionId).single();
  if (!mission?.contract_id) {
    return <p className="p-6 text-sm text-status-breached">Mission has no governing contract — cannot assign a carrier.</p>;
  }

  const candidates = await getCarrierCandidates(supabase, mission.operator_org_id, mission.contract_id);

  return (
    <CarrierAssignmentClient
      missionId={missionId}
      operatorOrgId={mission.operator_org_id}
      contractId={mission.contract_id}
      candidates={candidates}
    />
  );
}
```

- [ ] **Step 7: Run the dev server and verify in the browser**

Run: `npm run dev`
Visit `http://localhost:3000/missions/<the-OfferReceived-mission-id>/carrier` (from the seed data, after moving it to `CarrierRequested` — for this manual check it's fine to update the mission's status directly in Supabase Studio to `CarrierRequested` first).
Expected: `N42MA` (D085) shows selectable with 3 legal pilots and one blocked pilot (`T. Whitfield`, insufficient rest); `N17MA` shows blocked with "not authorized on D085" and is not selectable.

- [ ] **Step 8: Commit**

```bash
git add src/lib/actions/assign-carrier-action.ts src/lib/actions/assign-carrier-action.test.ts src/app/missions/[id]/carrier
git commit -m "Add assignCarrier action and Carrier Assignment & Feasibility screen (1.4)"
```

---

## Task 16: Mission Detail screen (1.3) — flagship

**Files:**
- Create: `src/app/missions/[id]/page.tsx`
- Create: `src/app/missions/[id]/MissionDetailClient.tsx`
- Create: `src/lib/hospital-coordinates.ts`

The countdown hero, full stepper (with exception branches), map, custody timeline, crew/aircraft summary, and exception controls must coexist on one screen per the design brief's priority #1. Exception controls call `transitionMission` (from the backend plan) with the four exception events.

- [ ] **Step 1: Write `src/lib/hospital-coordinates.ts`** (small helper to turn PostGIS points already fetched as GeoJSON into Mapbox `[lng, lat]` tuples)

```typescript
export function pointToLngLat(geojsonPoint: { coordinates: [number, number] } | null): [number, number] | null {
  if (!geojsonPoint) return null;
  return geojsonPoint.coordinates;
}
```

- [ ] **Step 2: Write `src/app/missions/[id]/MissionDetailClient.tsx`**

```tsx
"use client";

import { useCallback, useState, useTransition } from "react";
import type { MissionDetail } from "@/lib/queries/missions";
import { transitionMission } from "@/lib/actions/mission-actions";
import { createClient } from "@/lib/supabase/client";
import { useRealtimeMission } from "@/lib/hooks/useRealtimeMission";
import { CountdownTimer } from "@/components/CountdownTimer";
import { MissionStepper } from "@/components/MissionStepper";
import { MissionMap, type MapMarker } from "@/components/MissionMap";
import { CustodyTimeline } from "@/components/CustodyTimeline";
import { CallSignTag } from "@/components/CallSignTag";
import { AlertBanner } from "@/components/AlertBanner";
import type { MissionStatus, MissionEventType } from "@/lib/engines/state-machine";
import { computeSlaState } from "@/lib/engines/sla";

export interface MissionDetailClientProps {
  initialMission: MissionDetail;
  refreshMission: () => Promise<MissionDetail>;
  mapMarkers: MapMarker[];
}

const EXCEPTION_ACTIONS: Array<{ event: MissionEventType; label: string; validFrom: MissionStatus[] }> = [
  { event: "DELAY", label: "Report delay", validFrom: ["CarrierAssigned"] },
  { event: "DIVERT", label: "Report divert", validFrom: ["InTransitAir"] },
  { event: "DECLINE_ORGAN", label: "Decline organ", validFrom: ["Positioning"] },
  { event: "BREACH_SLA", label: "Mark window missed", validFrom: ["CustodyStarted"] },
];

export function MissionDetailClient({ initialMission, refreshMission, mapMarkers }: MissionDetailClientProps) {
  const [mission, setMission] = useState(initialMission);
  const [actionError, setActionError] = useState<string | null>(null);
  const [, startTransition] = useTransition();

  const refresh = useCallback(() => {
    startTransition(async () => {
      setMission(await refreshMission());
    });
  }, [refreshMission]);

  useRealtimeMission(mission.id, refresh);

  async function handleExceptionAction(event: MissionEventType) {
    setActionError(null);
    const supabase = createClient();
    const result = await transitionMission(supabase, { missionId: mission.id, event });
    if (!result.ok) {
      setActionError(result.error);
      return;
    }
    refresh();
  }

  const slaState = mission.organ
    ? computeSlaState(new Date(), mission.organ.viabilityDeadlineAt ? new Date(mission.organ.viabilityDeadlineAt) : null)
    : "ON_TIME";
  const availableExceptions = EXCEPTION_ACTIONS.filter((a) => a.validFrom.includes(mission.status as MissionStatus));

  return (
    <div className="flex flex-col gap-6 p-6">
      {slaState === "BREACHED" && (
        <AlertBanner state="BREACHED" message="Ischemic window breached — organ viability is at maximum risk." />
      )}
      {actionError && <p role="alert" className="text-sm text-status-breached">{actionError}</p>}

      <div className="flex items-start justify-between">
        <div>
          <h1 className="font-mono text-xl font-bold text-slate-100">
            {mission.organ?.organType ?? "Organ TBD"} — {mission.donorHospital.name} → {mission.recipientHospital.name}
          </h1>
          <p className="text-sm text-slate-500">{mission.status}</p>
        </div>
        <CountdownTimer viabilityDeadlineAt={mission.organ?.viabilityDeadlineAt ?? null} size="hero" />
      </div>

      <MissionStepper currentStatus={mission.status as MissionStatus} />

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <div className="h-96 overflow-hidden rounded-lg border border-slate-800">
            <MissionMap markers={mapMarkers} />
          </div>
        </div>

        <div className="flex flex-col gap-4">
          <section className="rounded-lg border border-slate-800 bg-slate-900 p-4">
            <h2 className="mb-2 font-mono text-sm font-semibold text-slate-300">Crew & Aircraft</h2>
            {mission.assignedAircraft ? (
              <p className="text-sm text-slate-200">{mission.assignedAircraft.tailNumber} — {mission.assignedAircraft.type}</p>
            ) : (
              <p className="text-sm text-slate-500">No aircraft assigned yet.</p>
            )}
            <ul className="mt-2 flex flex-col gap-1 text-sm text-slate-400">
              {mission.crew.map((c) => (
                <li key={c.pilotId}>{c.role}: {c.pilotName}</li>
              ))}
            </ul>
          </section>

          <section className="rounded-lg border border-slate-800 bg-slate-900 p-4">
            <h2 className="mb-2 font-mono text-sm font-semibold text-slate-300">Legs</h2>
            <ul className="flex flex-col gap-1 text-sm text-slate-400">
              {mission.legs.map((leg) => (
                <li key={leg.id} className="flex items-center gap-2">
                  <span>#{leg.sequenceNo} {leg.mode}</span>
                  <CallSignTag category={leg.callSignCategory as any} />
                  <span className="text-xs text-slate-600">{leg.status}</span>
                </li>
              ))}
            </ul>
          </section>

          <section className="rounded-lg border border-slate-800 bg-slate-900 p-4">
            <h2 className="mb-2 font-mono text-sm font-semibold text-slate-300">Custody timeline</h2>
            <CustodyTimeline events={mission.custodyEvents} />
          </section>

          {availableExceptions.length > 0 && (
            <section className="rounded-lg border border-status-atrisk/30 bg-status-atrisk/5 p-4">
              <h2 className="mb-2 font-mono text-sm font-semibold text-status-atrisk">Exception controls</h2>
              <div className="flex flex-wrap gap-2">
                {availableExceptions.map((action) => (
                  <button
                    key={action.event}
                    type="button"
                    onClick={() => {
                      if (confirm(`Confirm: ${action.label}? This is logged to the mission audit trail.`)) {
                        handleExceptionAction(action.event);
                      }
                    }}
                    className="rounded-md border border-status-atrisk/40 px-3 py-1.5 text-sm text-status-atrisk hover:bg-status-atrisk/10"
                  >
                    {action.label}
                  </button>
                ))}
              </div>
            </section>
          )}

          <section className="rounded-lg border border-slate-800 bg-slate-900 p-4">
            <h2 className="mb-2 font-mono text-sm font-semibold text-slate-300">Activity log</h2>
            <ul className="flex flex-col gap-1 text-xs text-slate-500">
              {mission.auditLog.map((event) => (
                <li key={event.id}>
                  <time dateTime={event.occurredAt}>{new Date(event.occurredAt).toLocaleString()}</time>
                  {" — "}{event.fromStatus ?? "∅"} → {event.toStatus} ({event.eventType})
                </li>
              ))}
            </ul>
          </section>
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 3: Write `src/app/missions/[id]/page.tsx`**

```tsx
import { createClient } from "@/lib/supabase/server";
import { getMissionDetail } from "@/lib/queries/missions";
import { pointToLngLat } from "@/lib/hospital-coordinates";
import { MissionDetailClient } from "./MissionDetailClient";
import type { MapMarker } from "@/components/MissionMap";

export default async function MissionDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const mission = await getMissionDetail(supabase, id);

  // The `location` column is a PostGIS `geography(point, 4326)`. PostgREST/postgrest-js
  // serializes geography columns as WKB hex by default (e.g. "0101000020E610...") when
  // fetched with a plain `.select()` — not as GeoJSON. `.geojson()` requests the
  // `application/geo+json` representation instead, reshaping the response into a
  // FeatureCollection whose `features[].geometry` matches the `{ coordinates: [lng, lat] }`
  // shape `pointToLngLat` expects.
  const { data: donorGeo } = await supabase
    .from("hospital")
    .select("location")
    .eq("id", mission.donorHospital.id)
    .geojson();
  const { data: recipientGeo } = await supabase
    .from("hospital")
    .select("location")
    .eq("id", mission.recipientHospital.id)
    .geojson();

  const mapMarkers: MapMarker[] = [];
  const donorLngLat = pointToLngLat((donorGeo as any)?.features?.[0]?.geometry ?? null);
  const recipientLngLat = pointToLngLat((recipientGeo as any)?.features?.[0]?.geometry ?? null);
  if (donorLngLat) mapMarkers.push({ id: "donor", lngLat: donorLngLat, label: mission.donorHospital.name, kind: "hospital" });
  if (recipientLngLat) mapMarkers.push({ id: "recipient", lngLat: recipientLngLat, label: mission.recipientHospital.name, kind: "hospital" });

  async function refreshMission() {
    "use server";
    const client = await createClient();
    return getMissionDetail(client, id);
  }

  return <MissionDetailClient initialMission={mission} refreshMission={refreshMission} mapMarkers={mapMarkers} />;
}
```

- [ ] **Step 4: Run the dev server and verify in the browser**

Run: `npm run dev`
Visit `http://localhost:3000/missions/<the-InTransitAir-mission-id>` from the seed data.
Expected: countdown hero ticks; stepper highlights `InTransitAir`; map shows donor + recipient hospital markers; custody timeline shows the two seeded TAKE/HANDOFF events; activity log lists the mission's audit trail (empty for the seeded mission since it was inserted directly, not via a transition — that's expected). No exception controls show yet (none of `EXCEPTION_ACTIONS`'s `validFrom` matches `InTransitAir` — this is correct per the state diagram, which only wires delay from `CarrierAssigned`, divert from `InTransitAir`, decline from `Positioning`, and breach from `CustodyStarted`). Re-check with the mission status manually set to `InTransitAir` in Supabase Studio to confirm the Divert button appears; click it, confirm the dialog, and verify the mission flips to `Exception_Divert` with an audit-log entry.

- [ ] **Step 5: Commit**

```bash
git add src/app/missions/[id]/page.tsx src/app/missions/[id]/MissionDetailClient.tsx src/lib/hospital-coordinates.ts
git commit -m "Add Mission Detail screen (1.3) — countdown hero, stepper, map, custody timeline, exception controls"
```

---

## Task 17: End-to-end manual verification pass

**Files:**
- No new files.

Walk the design spec's §8 "done" checklist against the running app.

- [ ] **Step 1: Create a coordinator login for manual testing**

**Fixed 2026-07-22:** the raw SQL below only sets a few columns; auth.users' other NOT NULL
token columns (`confirmation_token`, `recovery_token`, etc.) default to NULL on this schema
version, which GoTrue then fails to scan (`500: Database error querying schema`) on the very
next login attempt. Use `supabase.auth.admin.createUser` instead (same mechanism the seed
script already uses for `seed-courier@relay.demo`), which populates every column correctly:
```bash
npx tsx scripts/create-demo-coordinator.ts
```
Expected: no error; `select id from auth.users where email='coordinator@relay.demo'` returns one row, and `select * from user_profile where email='coordinator@relay.demo'` shows the auto-provisioned profile (Task 9's trigger). Re-run after every `supabase db reset` — the row doesn't survive it.

<details><summary>Original (broken) approach, kept for context</summary>

```bash
npx supabase db execute --local --sql "
insert into auth.users (id, email, encrypted_password, email_confirmed_at, raw_user_meta_data)
select gen_random_uuid(), 'coordinator@relay.demo', crypt('relay-demo-pw', gen_salt('bf')), now(),
  jsonb_build_object('org_id', (select id from organization where type = 'OPO' limit 1), 'name', 'Demo Coordinator')
where not exists (select 1 from auth.users where email = 'coordinator@relay.demo');
"
```
</details>

- [ ] **Step 2: Run the full test suite**

Run: `npm test`
Expected: all tests from every prior task pass.

- [ ] **Step 3: Manual walkthrough**

Run: `npm run dev`, then in the browser:
1. Visit `/login`, sign in as `coordinator@relay.demo` / `relay-demo-pw`. Expected: redirected to `/dashboard`.
2. Dashboard shows the two seeded missions sorted by soonest deadline, correct status colors. Expected: matches design spec §8 bullet 1.
3. Click "New Mission", create one. Expected: appears on dashboard immediately (bullet 2).
4. Open the `InTransitAir` mission's detail page. Expected: countdown hero, stepper, map, custody timeline, exception controls all render together (bullet 3).
5. Manually move a mission to `CarrierRequested` in Supabase Studio, visit its `/carrier` page. Expected: only the D085 aircraft with a legal pilot is selectable; the non-D085 aircraft and the duty-violating pilot show blocked with a reason (bullet 4).
6. Open the same mission in two browser tabs; trigger an exception in one. Expected: the other tab's stepper/countdown update within a couple seconds via Realtime, no manual refresh (this is the roadmap's fusion benchmark — both sides see it at once).

- [ ] **Step 4: Fix anything the walkthrough surfaces, then commit**

```bash
git add -A
git commit -m "Fix issues found in end-to-end manual verification" --allow-empty
```

---

## Task 18: Deploy to Vercel

**Files:**
- Create: `vercel.json` (only if a build-command override is needed — usually not for Next.js)

- [ ] **Step 1: Create a hosted Supabase project**

The user creates a project at https://supabase.com/dashboard (free tier is enough for the POC) and, once provisioned, applies the same migrations: `npx supabase link --project-ref <ref>` then `npx supabase db push`.

- [ ] **Step 2: Re-run the seed script against the hosted project**

Temporarily point `.env.local` (or a separate `.env.production.local`) at the hosted project's URL/keys, then run: `npm run seed`
Expected: same "Seed complete" output as local, now in the hosted database.

- [ ] **Step 3: Push the repo to a Git remote Vercel can import**

The user connects the `relay` repo to Vercel (via the Vercel dashboard or `vercel` CLI) and sets these environment variables in the Vercel project settings: `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `NEXT_PUBLIC_MAPBOX_TOKEN` — all pointing at the hosted Supabase project and the real Mapbox token.

- [ ] **Step 4: Deploy**

Run: `npx vercel --prod` (or trigger via the Vercel dashboard's Git integration)
Expected: build succeeds; the deployed URL serves `/login` and the full flow from Task 17's walkthrough works against the hosted database.

- [ ] **Step 5: Commit** (only if any deployment-specific config file was added)

```bash
git add vercel.json
git commit -m "Add Vercel deployment config" --allow-empty
```

---

## Definition of done

Matches `2026-07-20-dispatch-app-design.md` §8 verbatim: coordinator login → dashboard with two seeded missions sorted by urgency → New Mission intake → Mission Detail with countdown/stepper/map/custody/exceptions → Carrier Assignment showing only legal/available tails → all running against real (hosted) Supabase, deployed on Vercel.
