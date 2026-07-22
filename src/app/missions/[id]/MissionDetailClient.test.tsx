// @vitest-environment jsdom
import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { MissionDetail } from "@/lib/queries/missions";
import { MissionDetailClient } from "./MissionDetailClient";

vi.mock("@/lib/hooks/useRealtimeMission", () => ({ useRealtimeMission: () => {} }));
vi.mock("@/components/MissionMap", () => ({ MissionMap: () => null }));

const submitMissionTransition = vi.fn().mockResolvedValue({ ok: true });
vi.mock("@/lib/actions/mission-transition.server", () => ({
  submitMissionTransition: (...args: unknown[]) => submitMissionTransition(...args),
}));

function baseMission(status: string): MissionDetail {
  return {
    id: "mission-1",
    status,
    donorHospital: { id: "h1", name: "Donor Hospital" },
    recipientHospital: { id: "h2", name: "Recipient Hospital" },
    organ: null,
    legs: [],
    custodyEvents: [],
    assignedAircraft: null,
    crew: [],
    auditLog: [],
  };
}

describe("MissionDetailClient happy-path progression", () => {
  it("fires ACCEPT_OFFER when the next-step button is clicked from OfferReceived", async () => {
    render(
      <MissionDetailClient
        initialMission={baseMission("OfferReceived")}
        refreshMission={async () => baseMission("OfferReceived")}
        mapMarkers={[]}
      />
    );

    await userEvent.click(screen.getByRole("button", { name: /accept offer/i }));
    expect(submitMissionTransition).toHaveBeenCalledWith({ missionId: "mission-1", event: "ACCEPT_OFFER" });
  });

  it("links to the Carrier Assignment screen instead of firing an event from CarrierRequested", () => {
    render(
      <MissionDetailClient
        initialMission={baseMission("CarrierRequested")}
        refreshMission={async () => baseMission("CarrierRequested")}
        mapMarkers={[]}
      />
    );

    const link = screen.getByRole("link", { name: /assign carrier/i });
    expect(link).toHaveAttribute("href", "/missions/mission-1/carrier");
    expect(screen.queryByRole("button", { name: /request carrier/i })).not.toBeInTheDocument();
  });

  it("shows no next-step control in a terminal status", () => {
    render(
      <MissionDetailClient
        initialMission={baseMission("Closed")}
        refreshMission={async () => baseMission("Closed")}
        mapMarkers={[]}
      />
    );

    expect(screen.queryByRole("link", { name: /assign carrier/i })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /accept offer|request carrier|dispatch aircraft/i })).not.toBeInTheDocument();
  });
});
