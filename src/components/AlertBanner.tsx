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
