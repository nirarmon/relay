import { describe, it, expect, vi } from "vitest";
import { transitionMission } from "./mission-actions";

function fakeClient(missionStatus: string) {
  const rpc = vi.fn().mockResolvedValue({ error: null });
  return {
    rpc,
    from: () => ({
      select: () => ({
        eq: () => ({
          single: async () => ({ data: { status: missionStatus }, error: null }),
        }),
      }),
    }),
  } as any;
}

describe("transitionMission", () => {
  it("calls record_mission_transition for a valid, ungated transition", async () => {
    const client = fakeClient("MissionCreated");
    const result = await transitionMission(client, {
      missionId: "11111111-1111-1111-1111-111111111111",
      event: "REQUEST_CARRIER",
    });
    expect(result.ok).toBe(true);
    expect(client.rpc).toHaveBeenCalledWith("record_mission_transition", expect.objectContaining({
      p_mission_id: "11111111-1111-1111-1111-111111111111",
      p_from_status: "MissionCreated",
      p_to_status: "CarrierRequested",
      p_event_type: "REQUEST_CARRIER",
    }));
  });

  it("rejects an invalid transition without calling the RPC", async () => {
    const client = fakeClient("OfferReceived");
    const result = await transitionMission(client, {
      missionId: "11111111-1111-1111-1111-111111111111",
      event: "WHEELS_UP",
    });
    expect(result.ok).toBe(false);
    expect(client.rpc).not.toHaveBeenCalled();
  });
});
