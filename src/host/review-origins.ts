import { isPrivateQaOrigin } from "./origins";
import type { PublicGameId } from "./public-games";
import type { SessionTarget } from "./eligibility";

/**
 * PRIVATE REVIEW HARNESS ONLY. Authenticated private preview origins of each child game's review draft.
 * Used only by the opt-in /review route, and only when the hub itself runs on a private QA origin
 * (isPrivateQaOrigin). Never a registry/catalog entry; production sessions never read this list.
 * Eligibility (age, hidden, release) still comes from the real public manifest; only the origin is swapped.
 */
/** Partial: a game without a supplied exact private review origin (currently water) is left out of /review. */
export const REVIEW_CHILD_ORIGINS: Readonly<Partial<Record<PublicGameId, string>>> = {
  sudoku: "https://id-preview-3--4256ada6-8d33-41e7-9785-c8235aa42260.lovable.app",
  take: "https://id-preview-3--792f56d0-807f-48d8-aba6-23984e13cda1.lovable.app",
  ordering: "https://id-preview-3--6763bd70-cf6b-46ad-b3d4-61a0d21e806a.lovable.app",
  radio: "https://id-preview-3--2271e391-1fce-4bdf-aa1c-496e01d1cc7f.lovable.app",
  robot: "https://id-preview-3--58c66c34-baf4-4363-9f6f-2ac46726ea2a.lovable.app",
  curiosity: "https://id-preview-3--ebaffe03-ede2-42df-a3f1-c57b72f0f4c8.lovable.app",
  sofa: "https://id-preview-3--768d609f-c8f2-4324-b46a-4e824d0084eb.lovable.app",
  seating: "https://id-preview-3--f8fbb7cd-5dbf-4f78-9558-fab6494824d4.lovable.app",
  airship: "https://id-preview-4--3c32d766-44d1-4936-8f96-fe9d1bf7daff.lovable.app",
  seaside: "https://id-preview-4--b01ad17f-feb3-4ec9-bd3f-4fce37116b7f.lovable.app",
  ticket: "https://id-preview-3--734562b7-9af6-4e5e-97e9-2466ddef3755.lovable.app",
  trains: "https://id-preview-2--717b3179-eb4b-47dc-ab6a-60fb01d7197a.lovable.app",
  "money-change": "https://id-preview-1--5585db27-f1ca-4be9-8976-ba8a6abe82c5.lovable.app",
};

/** The review harness is available only when this hub page itself is on a private QA origin. */
export function reviewHarnessAllowed(selfOrigin: string) {
  return isPrivateQaOrigin(selfOrigin);
}

/** Real eligible targets with the origin swapped to the child's private review preview; null when not allowed. */
export function reviewTargets(real: readonly SessionTarget[], selfOrigin: string): SessionTarget[] | null {
  if (!reviewHarnessAllowed(selfOrigin)) return null;
  return real.flatMap((target) => {
    const origin = REVIEW_CHILD_ORIGINS[target.gameId as PublicGameId];
    return origin && isPrivateQaOrigin(origin) ? [{ ...target, origin }] : [];
  });
}

/** Private previews are auth-walled; when their public version endpoint is unreadable both sides use this. */
export const REVIEW_RELEASE_UNVERIFIED = "private-preview-unverified";
