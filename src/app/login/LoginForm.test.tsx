// @vitest-environment jsdom
import { describe, it, expect, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { LoginForm } from "./LoginForm";

describe("LoginForm", () => {
  it("shows an error message when sign-in fails", async () => {
    const signInWithPassword = vi.fn().mockResolvedValue({ error: { message: "Invalid login credentials" } });
    render(<LoginForm signInWithPassword={signInWithPassword} onSuccess={() => {}} />);

    await userEvent.type(screen.getByLabelText(/email/i), "coordinator@relay.demo");
    await userEvent.type(screen.getByLabelText(/password/i), "wrong-password");
    await userEvent.click(screen.getByRole("button", { name: /sign in/i }));

    await waitFor(() => expect(screen.getByRole("alert")).toHaveTextContent(/invalid login credentials/i));
  });

  it("calls onSuccess after a successful sign-in", async () => {
    const signInWithPassword = vi.fn().mockResolvedValue({ error: null });
    const onSuccess = vi.fn();
    render(<LoginForm signInWithPassword={signInWithPassword} onSuccess={onSuccess} />);

    await userEvent.type(screen.getByLabelText(/email/i), "coordinator@relay.demo");
    await userEvent.type(screen.getByLabelText(/password/i), "correct-password");
    await userEvent.click(screen.getByRole("button", { name: /sign in/i }));

    await waitFor(() => expect(onSuccess).toHaveBeenCalled());
  });
});
