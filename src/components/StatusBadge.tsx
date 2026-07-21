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
