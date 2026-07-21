// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, act } from "@testing-library/react";
import { CountdownTimer } from "./CountdownTimer";

describe("CountdownTimer", () => {
  afterEach(() => vi.useRealTimers());

  it("shows 'Not started' when there is no deadline", () => {
    render(<CountdownTimer viabilityDeadlineAt={null} />);
    expect(screen.getByText(/not started/i)).toBeInTheDocument();
  });

  it("counts down and ticks every second", () => {
    vi.useFakeTimers();
    const deadline = new Date(Date.now() + 5000).toISOString();
    render(<CountdownTimer viabilityDeadlineAt={deadline} />);
    const first = screen.getByTestId("countdown-value").textContent;
    act(() => {
      vi.advanceTimersByTime(1000);
    });
    const second = screen.getByTestId("countdown-value").textContent;
    expect(second).not.toBe(first);
  });

  it("shows a counting-up breached state past the deadline", () => {
    const deadline = new Date(Date.now() - 60_000).toISOString();
    render(<CountdownTimer viabilityDeadlineAt={deadline} />);
    expect(screen.getByText(/breached/i)).toBeInTheDocument();
  });
});
