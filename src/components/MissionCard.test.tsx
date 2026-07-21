// @vitest-environment jsdom
import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { MissionCard } from "./MissionCard";
import type { MissionListRow } from "@/lib/queries/missions";

const baseMission: MissionListRow = {
  id: "m1",
  status: "InTransitAir",
  organType: "HEART",
  preservationMethod: "STATIC_COLD",
  donorHospitalName: "NewYork-Presbyterian",
  recipientHospitalName: "Penn Presbyterian",
  viabilityDeadlineAt: new Date(Date.now() + 3_600_000).toISOString(),
  slaState: "ON_TIME",
};

describe("MissionCard", () => {
  it("shows organ type, route, and countdown", () => {
    render(<MissionCard mission={baseMission} />);
    expect(screen.getByText("HEART")).toBeInTheDocument();
    expect(screen.getByText(/NewYork-Presbyterian/)).toBeInTheDocument();
    expect(screen.getByText(/Penn Presbyterian/)).toBeInTheDocument();
  });
});
