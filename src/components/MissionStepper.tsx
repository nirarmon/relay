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
