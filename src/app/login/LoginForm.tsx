"use client";

import { useState, type FormEvent } from "react";

export interface LoginFormProps {
  signInWithPassword: (args: { email: string; password: string }) => Promise<{ error: { message: string } | null }>;
  onSuccess: () => void;
}

export function LoginForm({ signInWithPassword, onSuccess }: LoginFormProps) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    const { error: signInError } = await signInWithPassword({ email, password });
    setLoading(false);
    if (signInError) {
      setError(signInError.message);
      return;
    }
    onSuccess();
  }

  return (
    <form onSubmit={handleSubmit} className="flex w-full max-w-sm flex-col gap-4">
      {error && (
        <p role="alert" className="rounded-md border border-status-breached/40 bg-status-breached/10 px-3 py-2 text-sm text-status-breached">
          {error}
        </p>
      )}
      <label className="flex flex-col gap-1 text-sm text-slate-300">
        Email
        <input
          type="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="rounded-md border border-slate-700 bg-slate-900 px-3 py-2 text-slate-100"
        />
      </label>
      <label className="flex flex-col gap-1 text-sm text-slate-300">
        Password
        <input
          type="password"
          required
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="rounded-md border border-slate-700 bg-slate-900 px-3 py-2 text-slate-100"
        />
      </label>
      <button
        type="submit"
        disabled={loading}
        className="rounded-md bg-status-info px-4 py-2 font-medium text-white disabled:opacity-50"
      >
        {loading ? "Signing in..." : "Sign in"}
      </button>
    </form>
  );
}
