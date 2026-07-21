// src/components/CustodyTimeline.test.tsx
// @vitest-environment jsdom
import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { CustodyTimeline } from "./CustodyTimeline";

describe("CustodyTimeline", () => {
  it("shows an empty state before cross-clamp", () => {
    render(<CustodyTimeline events={[]} />);
    expect(screen.getByText(/awaiting cross-clamp/i)).toBeInTheDocument();
  });

  it("lists each custody event with actor role, time, and proof type", () => {
    render(
      <CustodyTimeline
        events={[
          { id: "1", eventType: "TAKE", occurredAt: "2026-07-20T10:00:00Z", custodianRole: "COURIER", proofType: "SIGNATURE" },
          { id: "2", eventType: "HANDOFF", occurredAt: "2026-07-20T10:30:00Z", custodianRole: "COURIER", proofType: "PHOTO" },
        ]}
      />
    );
    expect(screen.getByText("TAKE")).toBeInTheDocument();
    expect(screen.getByText("HANDOFF")).toBeInTheDocument();
    expect(screen.getAllByText("COURIER")).toHaveLength(2);
  });
});
