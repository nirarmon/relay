// @vitest-environment jsdom
import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { AlertBanner } from "./AlertBanner";

describe("AlertBanner", () => {
  it("renders as dismissible when onDismiss is provided", async () => {
    const onDismiss = vi.fn();
    render(<AlertBanner state="BREACHED" message="Ischemic window breached" onDismiss={onDismiss} />);
    await userEvent.click(screen.getByRole("button", { name: /dismiss/i }));
    expect(onDismiss).toHaveBeenCalled();
  });

  it("renders as persistent with no dismiss button when onDismiss is omitted", () => {
    render(<AlertBanner state="AT_RISK" message="Deadline at risk" />);
    expect(screen.queryByRole("button", { name: /dismiss/i })).not.toBeInTheDocument();
  });
});
