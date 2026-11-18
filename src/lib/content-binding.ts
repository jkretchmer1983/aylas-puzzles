import { makeRng } from '@/gen/rng';

/** Shared presentation policy: bindings never change the generator's mathematical task. */
export const CONTENT_POLICY_VERSION = 'scene-binding-1';
const missions = [
  { id: 'cloud-post', title: 'The Cloud Post Mix-up', story: 'Pip packed the cloud mail upside down. Our airship needs a wooden fitting before the letters float away!', prop: 'mail', tint: 'blue' },
  { id: 'soup-rescue', title: 'Soup Above the Clouds', story: 'The sky café ordered soup. Pip brought a fork! Fit the airship so we can deliver a spoon.', prop: 'spoon', tint: 'green' },
  { id: 'sock-patrol', title: 'The Runaway Sock Patrol', story: 'A sock escaped the washing line and declared itself captain. Ready the airship for a very silly rescue!', prop: 'sock', tint: 'red' },
  { id: 'moon-picnic', title: 'The Moon Forgot Lunch', story: 'Pip promised the moon a picnic. He packed only napkins! Help prepare the airship for another trip.', prop: 'picnic', tint: 'gold' },
  { id: 'kite-traffic', title: 'A Terrible Kite Jam', story: 'The kites have tangled their tails. Pip is directing traffic backwards! Prepare the airship to help.', prop: 'kite', tint: 'blue' },
  { id: 'snore-delivery', title: 'Special Delivery: A Snore', story: 'A sleepy cloud sent us a snore in a bottle. Pip keeps shaking it! Fit the airship to take it home.', prop: 'bottle', tint: 'green' },
] as const;
export type ContentBinding = { policy: string; instance: string; mission: string; title: string; story: string; prop: string; tint: string; source: 'curated' | 'ai' };
export function bindContent(seed: number, instance = String(seed)): ContentBinding {
  const mission = missions[((seed % missions.length) + missions.length) % missions.length];
  const chosen = mission ?? missions[0];
  return { policy: CONTENT_POLICY_VERSION, instance, mission: chosen.id, title: chosen.title, story: chosen.story, prop: chosen.prop, tint: chosen.tint, source: 'curated' };
}
export function freshContentSeed(previous?: number): number {
  const seed = Math.floor(Math.random() * 2147483646) + 1;
  return previous !== undefined && bindContent(seed).mission === bindContent(previous).mission ? seed + 1 : seed;
}
export function validNarrative(binding: ContentBinding, text: { title: string; story: string }): boolean {
  const combined = `${text.title} ${text.story}`;
  return text.title.length > 0 && text.title.length <= 80 && text.story.length > 0 && text.story.length <= 450
    && !/\d|triangle|square|rectangle|circle|pentagon|hexagon|octagon|sides|corners/i.test(combined)
    && combined.toLowerCase().includes('pip') && combined.toLowerCase().includes('airship')
    && binding.policy === CONTENT_POLICY_VERSION;
}
export function decorationSeed(seed: number) { return makeRng(seed ^ 0x713a).int(1, 2147483646); }