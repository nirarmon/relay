// src/lib/engines/duty-legality.ts
export type DutyRecordType = "ON_CALL" | "DUTY" | "FLIGHT" | "REST";
export type PilotCurrencyStatus = "CURRENT" | "EXPIRING" | "EXPIRED";

export interface DutyRecord {
  record_type: DutyRecordType;
  start_at: string;
  end_at: string;
}

export interface DutyLegalityResult {
  legal: boolean;
  reasons: string[];
  dutyHoursUsed: number;
  dutyHoursLimit: 14;
  flightHoursUsed: number;
  flightHoursLimit: 10;
  lastRestHours: number;
  requiredRestHours: 10;
}

export interface CrewAssignmentLegalityResult extends DutyLegalityResult {
  currencyStatus: PilotCurrencyStatus;
}

const DUTY_WINDOW_HOURS = 14;
const FLIGHT_TIME_LIMIT_HOURS = 10;
const REQUIRED_REST_HOURS = 10;
const DUTY_COUNTING_TYPES = new Set<DutyRecordType>(["ON_CALL", "DUTY", "FLIGHT"]);

function round1(n: number): number {
  return Math.round(n * 10) / 10;
}

function overlapMs(recStart: number, recEnd: number, winStart: number, winEnd: number): number {
  const start = Math.max(recStart, winStart);
  const end = Math.min(recEnd, winEnd);
  return Math.max(0, end - start);
}

/**
 * Pure §135.267 + Masterson calculator. `asOf` is the moment the proposed
 * assignment would begin; `proposedFlightHours` is the estimated duration
 * of the leg being considered (0 to just check current standing).
 */
export function computeDutyLegality(
  records: DutyRecord[],
  asOf: Date,
  proposedFlightHours: number = 0
): DutyLegalityResult {
  const windowStartMs = asOf.getTime() - DUTY_WINDOW_HOURS * 3_600_000;
  const asOfMs = asOf.getTime();

  let dutyMs = 0;
  let flightMs = 0;

  for (const record of records) {
    const startMs = new Date(record.start_at).getTime();
    const endMs = new Date(record.end_at).getTime();
    if (DUTY_COUNTING_TYPES.has(record.record_type)) {
      dutyMs += overlapMs(startMs, endMs, windowStartMs, asOfMs);
    }
    if (record.record_type === "FLIGHT") {
      flightMs += overlapMs(startMs, endMs, windowStartMs, asOfMs);
    }
  }

  const dutyHoursUsed = dutyMs / 3_600_000;
  const flightHoursUsed = flightMs / 3_600_000;
  const projectedDutyHours = dutyHoursUsed + proposedFlightHours;
  const projectedFlightHours = flightHoursUsed + proposedFlightHours;

  const lastRest = records
    .filter((r) => r.record_type === "REST" && new Date(r.end_at).getTime() <= asOfMs)
    .sort((a, b) => new Date(b.end_at).getTime() - new Date(a.end_at).getTime())[0];
  const lastRestHours = lastRest
    ? (new Date(lastRest.end_at).getTime() - new Date(lastRest.start_at).getTime()) / 3_600_000
    : 0;

  const reasons: string[] = [];
  if (projectedDutyHours > DUTY_WINDOW_HOURS) {
    reasons.push(
      `Duty limit exceeded: ${round1(projectedDutyHours)}h of ${DUTY_WINDOW_HOURS}h max in the trailing 14h window (§135.267)`
    );
  }
  if (projectedFlightHours > FLIGHT_TIME_LIMIT_HOURS) {
    reasons.push(
      `Flight-time limit exceeded: ${round1(projectedFlightHours)}h of ${FLIGHT_TIME_LIMIT_HOURS}h max (§135.267)`
    );
  }
  if (lastRestHours < REQUIRED_REST_HOURS) {
    reasons.push(
      `Insufficient rest: last rest period was ${round1(lastRestHours)}h, ${REQUIRED_REST_HOURS}h required (§135.267; on-call counts as duty per Masterson)`
    );
  }

  return {
    legal: reasons.length === 0,
    reasons,
    dutyHoursUsed: round1(dutyHoursUsed),
    dutyHoursLimit: DUTY_WINDOW_HOURS,
    flightHoursUsed: round1(flightHoursUsed),
    flightHoursLimit: FLIGHT_TIME_LIMIT_HOURS,
    lastRestHours: round1(lastRestHours),
    requiredRestHours: REQUIRED_REST_HOURS,
  };
}

/** Folds in §135.293 currency on top of the duty/rest calculation. */
export function computeCrewAssignmentLegality(
  pilot: { currencyStatus: PilotCurrencyStatus },
  records: DutyRecord[],
  asOf: Date,
  proposedFlightHours: number = 0
): CrewAssignmentLegalityResult {
  const dutyResult = computeDutyLegality(records, asOf, proposedFlightHours);
  const reasons = [...dutyResult.reasons];
  if (pilot.currencyStatus === "EXPIRED") {
    reasons.push("Pilot currency expired (§135.293) — not assignable");
  }
  return {
    ...dutyResult,
    legal: dutyResult.legal && pilot.currencyStatus !== "EXPIRED",
    reasons,
    currencyStatus: pilot.currencyStatus,
  };
}
