"use client";

import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { LoginForm } from "./LoginForm";

export default function LoginPage() {
  const router = useRouter();
  const supabase = createClient();

  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-8 px-4">
      <div className="text-center">
        <h1 className="font-mono text-2xl font-bold tracking-tight text-slate-100">RELAY</h1>
        <p className="mt-1 text-sm text-slate-400">Dispatch console — OPO Coordinator</p>
      </div>
      <LoginForm
        signInWithPassword={(args) => supabase.auth.signInWithPassword(args)}
        onSuccess={() => router.push("/dashboard")}
      />
    </main>
  );
}
