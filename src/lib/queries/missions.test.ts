// src/lib/queries/missions.test.ts
import { describe, it, expect, vi } from "vitest";
import { getMissionList } from "./missions";

function fakeSupabase(rows: any[]) {
  return {
    from: () => ({
      select: () => ({
        order: async () => ({ data: rows, error: null }),
      }),
    }),
  } as any;
}

describe("getMissionList", () => {
  it("sorts missions by soonest viability deadline first", async () => {
    const client = fakeSupabase([
      { id: "a", status: "InTransitAir", donor_hospital: { name: "Hospital A" }, recipient_hospital: { name: "Hospital B" }, organ: { organ_type: "HEART", preservation_method: "STATIC_COLD", viability_deadline_at: new Date(Date.now() + 3_600_000).toISOString() } },
      { id: "b", status: "OfferReceived", donor_hospital: { name: "Hospital C" }, recipient_hospital: { name: "Hospital D" }, organ: null },
      { id: "c", status: "CustodyStarted", donor_hospital: { name: "Hospital E" }, recipient_hospital: { name: "Hospital F" }, organ: { organ_type: "KIDNEY", preservation_method: "MACHINE_PERFUSION", viability_deadline_at: new Date(Date.now() + 1_800_000).toISOString() } },
    ]);
    const missions = await getMissionList(client);
    expect(missions.map((m) => m.id)).toEqual(["c", "a", "b"]);
  });

  it("marks a mission with no organ/deadline yet as ON_TIME", async () => {
    const client = fakeSupabase([
      { id: "b", status: "OfferReceived", donor_hospital: { name: "Hospital C" }, recipient_hospital: { name: "Hospital D" }, organ: null },
    ]);
    const missions = await getMissionList(client);
    expect(missions[0]!.slaState).toBe("ON_TIME");
  });
});
