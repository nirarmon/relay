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
