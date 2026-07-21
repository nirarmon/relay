"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { createMission, suggestIschemicBudgetMinutes } from "@/lib/actions/create-mission-action";

export interface NewMissionFormProps {
  hospitals: Array<{ id: string; name: string; type: string }>;
  contractId: string;
  opoOrgId: string;
  operatorOrgId: string;
}

const ORGAN_TYPES = ["HEART", "LUNG", "LIVER", "PANCREAS", "KIDNEY"] as const;
const PRESERVATION_METHODS = ["STATIC_COLD", "MACHINE_PERFUSION"] as const;

export function NewMissionForm({ hospitals, contractId, opoOrgId, operatorOrgId }: NewMissionFormProps) {
  const router = useRouter();
  const [organType, setOrganType] = useState<(typeof ORGAN_TYPES)[number]>("KIDNEY");
  const [preservationMethod, setPreservationMethod] = useState<(typeof PRESERVATION_METHODS)[number]>("STATIC_COLD");
  const [budgetMinutes, setBudgetMinutes] = useState(suggestIschemicBudgetMinutes("KIDNEY", "STATIC_COLD"));
  const [donorHospitalId, setDonorHospitalId] = useState(hospitals[0]?.id ?? "");
  const [recipientHospitalId, setRecipientHospitalId] = useState(hospitals[1]?.id ?? "");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  function handleOrganOrMethodChange(nextOrgan: typeof organType, nextMethod: typeof preservationMethod) {
    setOrganType(nextOrgan);
    setPreservationMethod(nextMethod);
    setBudgetMinutes(suggestIschemicBudgetMinutes(nextOrgan, nextMethod));
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    const supabase = createClient();
    const result = await createMission(supabase, {
      organType, preservationMethod, ischemicBudgetMinutes: budgetMinutes,
      donorHospitalId, recipientHospitalId, contractId, opoOrgId, operatorOrgId,
    });
    setSubmitting(false);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    router.push(`/missions/${result.missionId}`);
  }

  const isTight = budgetMinutes < 6 * 60;

  return (
    <form onSubmit={handleSubmit} className="flex max-w-lg flex-col gap-4 p-6">
      {error && <p role="alert" className="text-sm text-status-breached">{error}</p>}

      <label className="flex flex-col gap-1 text-sm text-slate-300">
        Organ type
        <select
          value={organType}
          onChange={(e) => handleOrganOrMethodChange(e.target.value as typeof organType, preservationMethod)}
          className="rounded-md border border-slate-700 bg-slate-900 px-3 py-2"
        >
          {ORGAN_TYPES.map((o) => <option key={o} value={o}>{o}</option>)}
        </select>
      </label>

      <label className="flex flex-col gap-1 text-sm text-slate-300">
        Preservation method
        <select
          value={preservationMethod}
          onChange={(e) => handleOrganOrMethodChange(organType, e.target.value as typeof preservationMethod)}
          className="rounded-md border border-slate-700 bg-slate-900 px-3 py-2"
        >
          {PRESERVATION_METHODS.map((m) => <option key={m} value={m}>{m}</option>)}
        </select>
      </label>

      <label className="flex flex-col gap-1 text-sm text-slate-300">
        Ischemic budget (minutes)
        <input
          type="number"
          min={1}
          value={budgetMinutes}
          onChange={(e) => setBudgetMinutes(Number(e.target.value))}
          className="rounded-md border border-slate-700 bg-slate-900 px-3 py-2"
        />
      </label>
      {isTight && (
        <p className="text-sm text-status-atrisk">Feasibility: this is a tight window — confirm carrier availability before committing.</p>
      )}

      <label className="flex flex-col gap-1 text-sm text-slate-300">
        Donor hospital
        <select value={donorHospitalId} onChange={(e) => setDonorHospitalId(e.target.value)} className="rounded-md border border-slate-700 bg-slate-900 px-3 py-2">
          {hospitals.map((h) => <option key={h.id} value={h.id}>{h.name}</option>)}
        </select>
      </label>

      <label className="flex flex-col gap-1 text-sm text-slate-300">
        Recipient center
        <select value={recipientHospitalId} onChange={(e) => setRecipientHospitalId(e.target.value)} className="rounded-md border border-slate-700 bg-slate-900 px-3 py-2">
          {hospitals.map((h) => <option key={h.id} value={h.id}>{h.name}</option>)}
        </select>
      </label>

      <button type="submit" disabled={submitting} className="rounded-md bg-status-info px-4 py-2 font-medium text-white disabled:opacity-50">
        {submitting ? "Creating..." : "Create Mission"}
      </button>
    </form>
  );
}
