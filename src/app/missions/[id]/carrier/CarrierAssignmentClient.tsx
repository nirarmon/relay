"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { submitCarrierAssignment } from "@/lib/actions/assign-carrier.server";
import type { CarrierCandidate } from "@/lib/actions/assign-carrier-action";
import { DutyTimeIndicator } from "@/components/DutyTimeIndicator";
import { StatusBadge } from "@/components/StatusBadge";

export interface CarrierAssignmentClientProps {
  missionId: string;
  operatorOrgId: string;
  contractId: string;
  candidates: CarrierCandidate[];
}

export function CarrierAssignmentClient({ missionId, operatorOrgId, contractId, candidates }: CarrierAssignmentClientProps) {
  const router = useRouter();
  const [selectedAircraftId, setSelectedAircraftId] = useState<string | null>(null);
  const [selectedPilotId, setSelectedPilotId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const selectedCandidate = candidates.find((c) => c.aircraft.id === selectedAircraftId) ?? null;

  async function handleAssign() {
    if (!selectedAircraftId || !selectedPilotId) return;
    setSubmitting(true);
    setError(null);
    const result = await submitCarrierAssignment(operatorOrgId, contractId, {
      missionId,
      aircraftId: selectedAircraftId,
      crew: [{ pilotId: selectedPilotId, role: "PIC" }],
    });
    setSubmitting(false);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    router.push(`/missions/${missionId}`);
  }

  return (
    <div className="flex flex-col gap-6 p-6">
      <h1 className="font-mono text-xl font-bold text-slate-100">Carrier Assignment & Feasibility</h1>
      {error && <p role="alert" className="text-sm text-status-breached">{error}</p>}

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        {candidates.map((candidate) => {
          const isSelected = selectedAircraftId === candidate.aircraft.id;
          return (
            <div
              key={candidate.aircraft.id}
              className={`flex flex-col gap-3 rounded-lg border p-4 ${
                candidate.aircraftLegal
                  ? isSelected ? "border-status-info bg-status-info/5" : "border-slate-800 bg-slate-900"
                  : "border-status-breached/30 bg-status-breached/5 opacity-70"
              }`}
            >
              <div className="flex items-center justify-between">
                <span className="font-mono text-sm font-semibold text-slate-100">{candidate.aircraft.tailNumber} — {candidate.aircraft.type}</span>
                <StatusBadge state={candidate.aircraftLegal ? "ON_TIME" : "BREACHED"} size="inline" />
              </div>

              {!candidate.aircraftLegal ? (
                <p role="alert" className="text-xs text-status-breached">{candidate.aircraftReasons.join(" ")}</p>
              ) : (
                <>
                  <p className="text-xs text-slate-500">Crew — select a legal pilot to assign as PIC:</p>
                  <div className="flex flex-col gap-2">
                    {candidate.pilots.map((pilot) => (
                      <div key={pilot.id} className="flex flex-col gap-1">
                        <label className={`flex items-center gap-2 rounded-md border p-2 ${pilot.legality.legal ? "border-slate-800" : "border-status-breached/30 opacity-60"}`}>
                          <input
                            type="radio"
                            name="pilot"
                            disabled={!pilot.legality.legal}
                            checked={selectedAircraftId === candidate.aircraft.id && selectedPilotId === pilot.id}
                            onChange={() => {
                              setSelectedAircraftId(candidate.aircraft.id);
                              setSelectedPilotId(pilot.id);
                            }}
                          />
                          <span className="flex-1 text-sm text-slate-200">{pilot.name}</span>
                        </label>
                        {/*
                          A blocked pilot's radio is disabled, so it can never become the
                          "selected" pilot — meaning the DutyTimeIndicator below (which only
                          renders for the selected pilot) would never surface this pilot's
                          block reason. Render it unconditionally here instead, mirroring how
                          aircraftReasons are shown unconditionally for a blocked aircraft, so
                          the pilot is "visibly blocked with a reason, not just hidden" per the
                          design spec's Carrier Assignment definition of done.
                        */}
                        {!pilot.legality.legal && (
                          <p role="alert" className="pl-2 text-xs text-status-breached">
                            {pilot.legality.reasons.join(" ")}
                          </p>
                        )}
                      </div>
                    ))}
                  </div>
                  {isSelected && selectedPilotId && (
                    <DutyTimeIndicator legality={candidate.pilots.find((p) => p.id === selectedPilotId)!.legality} />
                  )}
                </>
              )}
            </div>
          );
        })}
      </div>

      <button
        type="button"
        disabled={!selectedAircraftId || !selectedPilotId || !selectedCandidate?.aircraftLegal || submitting}
        onClick={handleAssign}
        className="w-fit rounded-md bg-status-info px-4 py-2 font-medium text-white disabled:opacity-50"
      >
        {submitting ? "Assigning..." : "Assign Carrier"}
      </button>
    </div>
  );
}
