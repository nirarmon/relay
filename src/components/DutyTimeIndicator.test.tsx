// src/components/DutyTimeIndicator.test.tsx
// @vitest-environment jsdom
import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { DutyTimeIndicator } from "./DutyTimeIndicator";

describe("DutyTimeIndicator", () => {
  it("shows a legal, assignable state with the reason absent", () => {
    render(
      <DutyTimeIndicator
        legality={{ legal: true, reasons: [], dutyHoursUsed: 4, dutyHoursLimit: 14, flightHoursUsed: 1, flightHoursLimit: 10, lastRestHours: 12, requiredRestHours: 10 }}
      />
    );
    expect(screen.getByText(/legal/i)).toBeInTheDocument();
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });

  it("shows the specific blocking reason when illegal", () => {
    render(
      <DutyTimeIndicator
        legality={{
          legal: false,
          reasons: ["Insufficient rest: last rest period was 3.0h, 10h required (§135.267; on-call counts as duty per Masterson)"],
          dutyHoursUsed: 2, dutyHoursLimit: 14, flightHoursUsed: 0, flightHoursLimit: 10, lastRestHours: 3, requiredRestHours: 10,
        }}
      />
    );
    expect(screen.getByRole("alert")).toHaveTextContent(/insufficient rest/i);
  });
});
