export type SlaState = "ON_TIME" | "AT_RISK" | "BREACHED";

const DEFAULT_AT_RISK_THRESHOLD_MINUTES = 30;

/** viability_deadline_at = cross_clamp_at + ischemic_budget_minutes (data-model.md §4.3). */
export function computeViabilityDeadline(
  crossClampAt: Date | null,
  ischemicBudgetMinutes: number
): Date | null {
  if (!crossClampAt) return null;
  return new Date(crossClampAt.getTime() + ischemicBudgetMinutes * 60_000);
}

/** sla_state is derived from now vs. deadline at render/read time, never hand-edited. */
export function computeSlaState(
  now: Date,
  viabilityDeadlineAt: Date | null,
  atRiskThresholdMinutes: number = DEFAULT_AT_RISK_THRESHOLD_MINUTES
): SlaState {
  if (!viabilityDeadlineAt) return "ON_TIME";
  const msRemaining = viabilityDeadlineAt.getTime() - now.getTime();
  if (msRemaining <= 0) return "BREACHED";
  if (msRemaining <= atRiskThresholdMinutes * 60_000) return "AT_RISK";
  return "ON_TIME";
}
