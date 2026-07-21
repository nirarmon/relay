"use client";

import { useCallback, useEffect, useState, useTransition } from "react";
import Link from "next/link";
import type { MissionListRow } from "@/lib/queries/missions";
import { useRealtimeMissionList } from "@/lib/hooks/useRealtimeMissionList";
import { MissionCard } from "@/components/MissionCard";
import { AlertBanner } from "@/components/AlertBanner";

export interface DashboardClientProps {
  initialMissions: MissionListRow[];
  refreshMissions: () => Promise<MissionListRow[]>;
}

export function DashboardClient({ initialMissions, refreshMissions }: DashboardClientProps) {
  const [missions, setMissions] = useState(initialMissions);
  const [, startTransition] = useTransition();

  const refresh = useCallback(() => {
    startTransition(async () => {
      setMissions(await refreshMissions());
    });
  }, [refreshMissions]);

  useRealtimeMissionList(refresh);

  // Client-side re-sort every 30s so a mission crossing into AT_RISK/BREACHED moves without a DB write.
  useEffect(() => {
    const interval = setInterval(refresh, 30_000);
    return () => clearInterval(interval);
  }, [refresh]);

  const breached = missions.filter((m) => m.slaState === "BREACHED");
  const atRisk = missions.filter((m) => m.slaState === "AT_RISK");

  return (
    <div className="flex flex-col gap-6 p-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-mono text-xl font-bold text-slate-100">Mission Dashboard</h1>
          <p className="text-sm text-slate-500">
            {breached.length} breached · {atRisk.length} at risk · {missions.length} active
          </p>
        </div>
        <Link
          href="/missions/new"
          className="rounded-md bg-status-info px-4 py-2 text-sm font-medium text-white"
        >
          New Mission
        </Link>
      </div>

      {breached.length > 0 && (
        <AlertBanner state="BREACHED" message={`${breached.length} mission(s) have breached their ischemic window.`} />
      )}

      {missions.length === 0 ? (
        <p className="text-sm text-slate-500">No active missions.</p>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {missions.map((mission) => (
            <MissionCard key={mission.id} mission={mission} />
          ))}
        </div>
      )}
    </div>
  );
}
