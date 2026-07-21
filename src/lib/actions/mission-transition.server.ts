"use server";

import { createClient } from "@/lib/supabase/server";
import { transitionMission, type TransitionMissionInput, type TransitionMissionResult } from "./mission-actions";

// The actual Next.js Server Action entrypoint client components call. Creates its
// own server-side Supabase client (from the request's own cookies, via
// @/lib/supabase/server) rather than accepting one as an argument -- see the
// comment atop mission-actions.ts for why a client-supplied client instance
// can't cross the Server Action boundary.
export async function submitMissionTransition(input: TransitionMissionInput): Promise<TransitionMissionResult> {
  const supabase = await createClient();
  return transitionMission(supabase, input);
}
