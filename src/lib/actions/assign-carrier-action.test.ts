import { describe, it, expect, vi } from "vitest";
import { getCarrierCandidates } from "./assign-carrier-action";

describe("getCarrierCandidates", () => {
  it("marks an aircraft not on D085 as blocked, with pilots evaluated regardless", async () => {
    const client = {
      from: (table: string) => {
        if (table === "contract") {
          return { select: () => ({ eq: () => ({ single: async () => ({ data: { required_csl_amount: 20_000_000 }, error: null }) }) }) };
        }
        if (table === "aircraft") {
          return {
            select: () => ({
              eq: async () => ({
                data: [
                  { id: "ac1", tail_number: "N42MA", type: "Phenom 300", on_d085: true, liability_csl_amount: 25_000_000, status: "AVAILABLE" },
                  { id: "ac2", tail_number: "N17MA", type: "CJ3+", on_d085: false, liability_csl_amount: 25_000_000, status: "AVAILABLE" },
                ],
                error: null,
              }),
            }),
          };
        }
        if (table === "pilot") {
          return { select: () => ({ eq: async () => ({ data: [{ id: "p1", name: "J. Alvarez", currency_status: "CURRENT" }], error: null }) }) };
        }
        if (table === "duty_record") {
          return { select: () => ({ eq: async () => ({ data: [{ pilot_id: "p1", record_type: "REST", start_at: new Date(Date.now() - 20 * 3_600_000).toISOString(), end_at: new Date(Date.now() - 6 * 3_600_000).toISOString() }], error: null }) }) };
        }
        throw new Error(`unexpected table ${table}`);
      },
    } as any;

    const candidates = await getCarrierCandidates(client, "operator-org-1", "contract-1");
    const blocked = candidates.find((c) => c.aircraft.tailNumber === "N17MA");
    const legal = candidates.find((c) => c.aircraft.tailNumber === "N42MA");

    expect(blocked?.aircraftLegal).toBe(false);
    expect(blocked?.aircraftReasons.some((r) => r.includes("D085"))).toBe(true);
    expect(legal?.aircraftLegal).toBe(true);
  });
});
