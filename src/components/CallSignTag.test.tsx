// @vitest-environment jsdom
import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { CallSignTag } from "./CallSignTag";

describe("CallSignTag", () => {
  it("renders MEDEVAC and COMPASSION distinctly", () => {
    const { rerender } = render(<CallSignTag category="MEDEVAC" />);
    expect(screen.getByText("MEDEVAC")).toBeInTheDocument();
    rerender(<CallSignTag category="COMPASSION" />);
    expect(screen.getByText("COMPASSION")).toBeInTheDocument();
  });
});
