import { createFileRoute, redirect } from "@tanstack/react-router";
import { hostEntryHref } from "@/host/config";

/**
 * Pruned from this host package: this path belongs to another deployment. It only exists so shared
 * typed links still compile; visiting it redirects to this host's own entry (the root route does too).
 */
export const Route = createFileRoute("/ticket-machine")({
  validateSearch: (search: Record<string, unknown>) => search as { band?: number; [key: string]: unknown },
  beforeLoad: ({ search }) => { throw redirect({ href: hostEntryHref(search as Record<string, unknown>), replace: true }); },
});
