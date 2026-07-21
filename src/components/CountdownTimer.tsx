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
