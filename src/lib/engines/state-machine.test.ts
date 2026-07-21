// src/lib/engines/state-machine.test.ts
import { describe, it, expect } from "vitest";
import { getValidTransition, applyMissionTransition } from "./state-machine";

describe("getValidTransition", () => {
  it("finds the happy-path transition for a known event", () => {
    expect(getValidTransition("OfferReceived", "ACCEPT_OFFER")).toEqual({
      from: "OfferReceived",
      to: "MissionCreated",
      event: "ACCEPT_OFFER",
    });
  });

  it("returns null for an event not valid from the current state", () => {
    expect(getValidTransition("OfferReceived", "WHEELS_UP")).toBeNull();
  });

  it("finds the exception branch: CarrierAssigned -> Exception_Delay -> Positioning", () => {
    expect(getValidTransition("CarrierAssigned", "DELAY")?.to).toBe("Exception_Delay");
    expect(getValidTransition("Exception_Delay", "RESUME")?.to).toBe("Positioning");
  });

  it("finds both Exception_MissedWindow exits", () => {
    expect(getValidTransition("Exception_MissedWindow", "DELIVER_NON_VIABLE")?.to).toBe("Delivered");
    expect(getValidTransition("Exception_MissedWindow", "ORGAN_LOST")?.to).toBe("Closed");
  });
});

describe("applyMissionTransition", () => {
  it("rejects an event with no matching transition", () => {
    const result = applyMissionTransition({ currentStatus: "OfferReceived", event: "WHEELS_UP" });
    expect(result.ok).toBe(false);
  });

  it("allows a non-gated transition unconditionally", () => {
    const result = applyMissionTransition({ currentStatus: "MissionCreated", event: "REQUEST_CARRIER" });
    expect(result).toEqual({ ok: true, from: "MissionCreated", to: "CarrierRequested" });
  });

  it("blocks CarrierAssigned when the carrier-assignment check is not legal", () => {
    const result = applyMissionTransition({
      currentStatus: "CarrierRequested",
      event: "ASSIGN_CARRIER",
      carrierAssignmentCheck: { legal: false, reason: "Aircraft not on D085" },
    });
    expect(result.ok).toBe(false);
    expect(result.ok === false && result.error).toBe("Aircraft not on D085");
  });

  it("blocks CarrierAssigned when no carrier-assignment check is provided at all", () => {
    const result = applyMissionTransition({ currentStatus: "CarrierRequested", event: "ASSIGN_CARRIER" });
    expect(result.ok).toBe(false);
  });

  it("allows CarrierAssigned when the carrier-assignment check is legal", () => {
    const result = applyMissionTransition({
      currentStatus: "CarrierRequested",
      event: "ASSIGN_CARRIER",
      carrierAssignmentCheck: { legal: true },
    });
    expect(result).toEqual({ ok: true, from: "CarrierRequested", to: "CarrierAssigned" });
  });
});
