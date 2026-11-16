/**
 * Shared, versioned instance-content contract for scene-game adapters.
 * Mathematical truth stays in each generator; this binding coordinates only
 * narrative, artwork and presentation subjects for one stable instance.
 */
export const INSTANCE_CONTENT_POLICY_VERSION = "scene-instance-v1";

export type InstanceContentBinding = {
  policyVersion: string;
  instanceId: string;
  themeId: string;
};

export function instanceContentKey(game: string, band: number, instanceSeed: number) {
  return `${INSTANCE_CONTENT_POLICY_VERSION}:${game}:${band}:${instanceSeed}`;
}
