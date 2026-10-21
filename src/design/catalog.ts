/**
 * The one place that defines the Platforms and the Tiers (CONTEXT.md): ids, labels,
 * colors (MASTER.md section 3) and mood avatars (MASTER 2.1). Everything else reads from here.
 */

export const PLATFORM_CATALOG = [
  /** `label` is the feed name on chips and rows; `name` is the app as warnings say it. */
  { id: 'instagram', label: 'Reels', name: 'Instagram', color: '#E1306C' },
  { id: 'youtube', label: 'Shorts', name: 'YouTube', color: '#FF3D3D' },
  { id: 'tiktok', label: 'TikTok', name: 'TikTok', color: '#25F4EE' },
  { id: 'facebook', label: 'Facebook', name: 'Facebook', color: '#1877F2' },
] as const;

export const PLATFORMS = PLATFORM_CATALOG.map((p) => p.id) as unknown as readonly Platform[];

/** One of the sources of short-form video (see CONTEXT.md). */
export type Platform = (typeof PLATFORM_CATALOG)[number]['id'];

/**
 * Index is the Tier number, 0 to 4. `avatar` is the mood drawable name; `color` is the face,
 * border and bar color; `textColor` is for label text (Doomed grey is lifted to pass 4.5:1).
 */
export const TIER_CATALOG = [
  { label: 'Vibing', avatar: 'mood_0_vibing', color: '#FACC15', textColor: '#FACC15' },
  { label: 'Cooked', avatar: 'mood_1_cooked', color: '#FB923C', textColor: '#FB923C' },
  { label: 'Washed', avatar: 'mood_2_washed', color: '#F87171', textColor: '#F87171' },
  { label: 'Brainrot', avatar: 'mood_3_brainrot', color: '#A3E635', textColor: '#A3E635' },
  { label: 'Doomed', avatar: 'mood_4_doomed', color: '#6B7280', textColor: '#9CA3AF' },
] as const;

/** The Tier on its own for screen readers, e.g. "Level 3 of 5, Doomed.". */
export function tierSentence(tier: number): string {
  return `Level ${tier + 1} of ${TIER_CATALOG.length}, ${TIER_CATALOG[tier].label}.`;
}

export const PLATFORM_BY_ID = Object.fromEntries(PLATFORM_CATALOG.map((p) => [p.id, p])) as {
  [P in Platform]: Extract<(typeof PLATFORM_CATALOG)[number], { id: P }>;
};
