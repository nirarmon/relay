"use server";

import { createClient } from "@/lib/supabase/server";
import { assignCarrier, type AssignCarrierInput, type AssignCarrierResult } from "./assign-carrier-action";

// The actual Next.js Server Action entrypoint client components call. Creates its
// own server-side Supabase client (from the request's own cookies, via
// @/lib/supabase/server) rather than accepting one as an argument -- see the
// comment atop assign-carrier-action.ts for why a client-supplied client
// instance can't cross the Server Action boundary.
export async function submitCarrierAssignment(
  operatorOrgId: string,
  contractId: string,
  input: AssignCarrierInput
): Promise<AssignCarrierResult> {
  const supabase = await createClient();
  return assignCarrier(supabase, operatorOrgId, contractId, input);
}
