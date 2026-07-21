import Link from "next/link";
import type { MissionListRow } from "@/lib/queries/missions";
import { CountdownTimer } from "./CountdownTimer";

export function MissionCard({ mission }: { mission: MissionListRow }) {
  return (
    <Link
      href={`/missions/${mission.id}`}
      className="flex flex-col gap-3 rounded-lg border border-slate-800 bg-slate-900 p-4 hover:border-slate-700"
    >
      <div className="flex items-center justify-between">
        <span className="font-mono text-sm font-semibold text-slate-100">{mission.organType ?? "Organ TBD"}</span>
        <span className="font-mono text-xs text-slate-500">{mission.status}</span>
      </div>
      <p className="text-sm text-slate-400">
        {mission.donorHospitalName} → {mission.recipientHospitalName}
      </p>
      <CountdownTimer viabilityDeadlineAt={mission.viabilityDeadlineAt} size="medium" />
    </Link>
  );
}
