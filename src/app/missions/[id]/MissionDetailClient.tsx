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
