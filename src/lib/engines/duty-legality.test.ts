// src/lib/engines/duty-legality.test.ts
import { describe, it, expect } from "vitest";
import { computeDutyLegality, computeCrewAssignmentLegality, type DutyRecord } from "./duty-legality";

const hoursAgo = (asOf: Date, h: number) => new Date(asOf.getTime() - h * 3600_000);

describe("computeDutyLegality", () => {
  it("is legal with a full rest period and duty well under limits", () => {
    const asOf = new Date("2026-07-20T12:00:00Z");
    const records: DutyRecord[] = [
      { record_type: "REST", start_at: hoursAgo(asOf, 20).toISOString(), end_at: hoursAgo(asOf, 6).toISOString() },
      { record_type: "DUTY", start_at: hoursAgo(asOf, 6).toISOString(), end_at: asOf.toISOString() },
    ];
    const result = computeDutyLegality(records, asOf, 3);
    expect(result.legal).toBe(true);
    expect(result.reasons).toEqual([]);
  });

  it("blocks when the trailing-14h duty limit would be exceeded (Masterson: on-call counts as duty)", () => {
    const asOf = new Date("2026-07-20T12:00:00Z");
    const records: DutyRecord[] = [
      { record_type: "REST", start_at: hoursAgo(asOf, 26).toISOString(), end_at: hoursAgo(asOf, 13).toISOString() },
      { record_type: "ON_CALL", start_at: hoursAgo(asOf, 13).toISOString(), end_at: asOf.toISOString() },
    ];
    const result = computeDutyLegality(records, asOf, 2);
    expect(result.legal).toBe(false);
    expect(result.reasons.some((r) => r.includes("Duty limit exceeded"))).toBe(true);
  });

  it("blocks when proposed flight time would exceed the 10h flight-time limit", () => {
    const asOf = new Date("2026-07-20T12:00:00Z");
    const records: DutyRecord[] = [
      { record_type: "REST", start_at: hoursAgo(asOf, 20).toISOString(), end_at: hoursAgo(asOf, 9).toISOString() },
      { record_type: "FLIGHT", start_at: hoursAgo(asOf, 9).toISOString(), end_at: asOf.toISOString() },
    ];
    const result = computeDutyLegality(records, asOf, 2);
    expect(result.legal).toBe(false);
    expect(result.reasons.some((r) => r.includes("Flight-time limit exceeded"))).toBe(true);
  });

  it("blocks when the immediately preceding rest period is under 10 hours", () => {
    const asOf = new Date("2026-07-20T12:00:00Z");
    const records: DutyRecord[] = [
      { record_type: "REST", start_at: hoursAgo(asOf, 4).toISOString(), end_at: hoursAgo(asOf, 0.5).toISOString() },
    ];
    const result = computeDutyLegality(records, asOf, 2);
    expect(result.legal).toBe(false);
    expect(result.reasons.some((r) => r.includes("Insufficient rest"))).toBe(true);
  });
});

describe("computeCrewAssignmentLegality", () => {
  it("blocks an otherwise-legal pilot whose currency has expired (§135.293)", () => {
    const asOf = new Date("2026-07-20T12:00:00Z");
    const records: DutyRecord[] = [
      { record_type: "REST", start_at: hoursAgo(asOf, 20).toISOString(), end_at: hoursAgo(asOf, 6).toISOString() },
    ];
    const result = computeCrewAssignmentLegality({ currencyStatus: "EXPIRED" }, records, asOf, 2);
    expect(result.legal).toBe(false);
    expect(result.reasons.some((r) => r.includes("currency expired"))).toBe(true);
  });

  it("is legal for a current pilot with adequate rest and duty margin", () => {
    const asOf = new Date("2026-07-20T12:00:00Z");
    const records: DutyRecord[] = [
      { record_type: "REST", start_at: hoursAgo(asOf, 20).toISOString(), end_at: hoursAgo(asOf, 6).toISOString() },
    ];
    const result = computeCrewAssignmentLegality({ currencyStatus: "CURRENT" }, records, asOf, 2);
    expect(result.legal).toBe(true);
  });
});
