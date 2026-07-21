// src/lib/engines/sla.test.ts
import { describe, it, expect } from "vitest";
import { computeViabilityDeadline, computeSlaState } from "./sla";

describe("computeViabilityDeadline", () => {
  it("returns null when the ischemic clock hasn't started", () => {
    expect(computeViabilityDeadline(null, 240)).toBeNull();
  });

  it("adds the ischemic budget in minutes to cross-clamp time", () => {
    const crossClampAt = new Date("2026-07-20T10:00:00Z");
    const deadline = computeViabilityDeadline(crossClampAt, 240);
    expect(deadline?.toISOString()).toBe("2026-07-20T14:00:00.000Z");
  });
});

describe("computeSlaState", () => {
  it("is ON_TIME when the countdown hasn't started", () => {
    expect(computeSlaState(new Date("2026-07-20T10:00:00Z"), null)).toBe("ON_TIME");
  });

  it("is ON_TIME well before the deadline", () => {
    const now = new Date("2026-07-20T10:00:00Z");
    const deadline = new Date("2026-07-20T12:00:00Z");
    expect(computeSlaState(now, deadline)).toBe("ON_TIME");
  });

  it("is AT_RISK inside the at-risk threshold", () => {
    const now = new Date("2026-07-20T10:00:00Z");
    const deadline = new Date("2026-07-20T10:20:00Z");
    expect(computeSlaState(now, deadline, 30)).toBe("AT_RISK");
  });

  it("is BREACHED once the deadline has passed", () => {
    const now = new Date("2026-07-20T10:00:01Z");
    const deadline = new Date("2026-07-20T10:00:00Z");
    expect(computeSlaState(now, deadline)).toBe("BREACHED");
  });
});
