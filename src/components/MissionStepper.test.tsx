// src/components/MissionStepper.test.tsx
// @vitest-environment jsdom
import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { MissionStepper } from "./MissionStepper";

describe("MissionStepper", () => {
  it("highlights the current happy-path step", () => {
    render(<MissionStepper currentStatus="CustodyStarted" />);
    expect(screen.getByText("Custody started")).toHaveAttribute("aria-current", "step");
  });

  it("shows an exception as an off-path alert branch, not a hidden state", () => {
    render(<MissionStepper currentStatus="Exception_Delay" />);
    expect(screen.getByText(/delay/i)).toBeInTheDocument();
    expect(screen.getByTestId("stepper-exception-banner")).toBeInTheDocument();
  });
});
