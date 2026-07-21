// src/components/StatusBadge.test.tsx
// @vitest-environment jsdom
import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { StatusBadge } from "./StatusBadge";

describe("StatusBadge", () => {
  it("renders the label and an icon, not color alone, for each state", () => {
    const { rerender } = render(<StatusBadge state="ON_TIME" />);
    expect(screen.getByText("On time")).toBeInTheDocument();
    expect(screen.getByTestId("status-icon")).toBeInTheDocument();

    rerender(<StatusBadge state="AT_RISK" />);
    expect(screen.getByText("At risk")).toBeInTheDocument();

    rerender(<StatusBadge state="BREACHED" />);
    expect(screen.getByText("Breached")).toBeInTheDocument();

    rerender(<StatusBadge state="IDLE" />);
    expect(screen.getByText("Idle")).toBeInTheDocument();
  });
});
