export type MissionStatus =
  | "OfferReceived" | "MissionCreated" | "CarrierRequested" | "CarrierAssigned"
  | "Positioning" | "TeamAtDonor" | "CustodyStarted"
  | "InTransitGround1" | "InTransitAir" | "InTransitGround2"
  | "Delivered" | "Closed"
  | "Exception_Delay" | "Exception_Divert" | "Exception_Declined" | "Exception_MissedWindow";

export type MissionEventType =
  | "ACCEPT_OFFER" | "REQUEST_CARRIER" | "ASSIGN_CARRIER" | "ALL_DECLINED"
  | "DISPATCH_AIRCRAFT" | "TEAM_ON_SITE" | "CROSS_CLAMP"
  | "DEPART_DONOR_GROUND" | "WHEELS_UP" | "WHEELS_DOWN" | "CONFIRM_DELIVERY" | "CLOSE_MISSION"
  | "DELAY" | "DIVERT" | "DECLINE_ORGAN" | "BREACH_SLA"
  | "RESUME" | "WINDOW_BLOWN" | "STAND_DOWN" | "DELIVER_NON_VIABLE" | "ORGAN_LOST";

export interface Transition {
  from: MissionStatus;
  to: MissionStatus;
  event: MissionEventType;
}

/** Verbatim from personas-and-workflows.md §2.2's mission state diagram. */
export const TRANSITIONS: Transition[] = [
  { from: "OfferReceived", to: "MissionCreated", event: "ACCEPT_OFFER" },
  { from: "MissionCreated", to: "CarrierRequested", event: "REQUEST_CARRIER" },
  { from: "CarrierRequested", to: "CarrierAssigned", event: "ASSIGN_CARRIER" },
  { from: "CarrierRequested", to: "MissionCreated", event: "ALL_DECLINED" },
  { from: "CarrierAssigned", to: "Positioning", event: "DISPATCH_AIRCRAFT" },
  { from: "Positioning", to: "TeamAtDonor", event: "TEAM_ON_SITE" },
  { from: "TeamAtDonor", to: "CustodyStarted", event: "CROSS_CLAMP" },
  { from: "CustodyStarted", to: "InTransitGround1", event: "DEPART_DONOR_GROUND" },
  { from: "InTransitGround1", to: "InTransitAir", event: "WHEELS_UP" },
  { from: "InTransitAir", to: "InTransitGround2", event: "WHEELS_DOWN" },
  { from: "InTransitGround2", to: "Delivered", event: "CONFIRM_DELIVERY" },
  { from: "Delivered", to: "Closed", event: "CLOSE_MISSION" },
  { from: "CarrierAssigned", to: "Exception_Delay", event: "DELAY" },
  { from: "InTransitAir", to: "Exception_Divert", event: "DIVERT" },
  { from: "Positioning", to: "Exception_Declined", event: "DECLINE_ORGAN" },
  { from: "CustodyStarted", to: "Exception_MissedWindow", event: "BREACH_SLA" },
  { from: "Exception_Delay", to: "Positioning", event: "RESUME" },
  { from: "Exception_Divert", to: "InTransitAir", event: "RESUME" },
  { from: "Exception_Divert", to: "Exception_MissedWindow", event: "WINDOW_BLOWN" },
  { from: "Exception_Declined", to: "Closed", event: "STAND_DOWN" },
  { from: "Exception_MissedWindow", to: "Delivered", event: "DELIVER_NON_VIABLE" },
  { from: "Exception_MissedWindow", to: "Closed", event: "ORGAN_LOST" },
];

export function getValidTransition(
  currentStatus: MissionStatus,
  event: MissionEventType
): Transition | null {
  return TRANSITIONS.find((t) => t.from === currentStatus && t.event === event) ?? null;
}

export interface CarrierAssignmentCheck {
  legal: boolean;
  reason?: string;
}

export interface ApplyTransitionInput {
  currentStatus: MissionStatus;
  event: MissionEventType;
  /** Required and must be legal:true for the ASSIGN_CARRIER event — the D085/duty-legal gate. */
  carrierAssignmentCheck?: CarrierAssignmentCheck;
}

export type ApplyTransitionResult =
  | { ok: true; from: MissionStatus; to: MissionStatus }
  | { ok: false; error: string };

const GATED_TARGET: MissionStatus = "CarrierAssigned";

export function applyMissionTransition(input: ApplyTransitionInput): ApplyTransitionResult {
  const transition = getValidTransition(input.currentStatus, input.event);
  if (!transition) {
    return {
      ok: false,
      error: `No transition for event "${input.event}" from state "${input.currentStatus}"`,
    };
  }

  if (transition.to === GATED_TARGET) {
    if (!input.carrierAssignmentCheck || !input.carrierAssignmentCheck.legal) {
      return {
        ok: false,
        error:
          input.carrierAssignmentCheck?.reason ??
          "Carrier assignment blocked: aircraft must be D085-valid and crew duty-legal",
      };
    }
  }

  return { ok: true, from: transition.from, to: transition.to };
}
