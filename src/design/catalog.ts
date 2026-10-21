/**
 * The one place that defines the Platforms and the Tiers (CONTEXT.md): ids, labels,
 * colors (MASTER.md section 3) and mood avatars (MASTER 2.1). Everything else reads from here.
 */

export const PLATFORM_CATALOG = [
  /** `label` is the feed name on chips and rows; `name` is the app as warnings say it. */
  { id: 'instagram', label: 'Reels', name: 'Instagram', color: '#E1306C' },
  { id: 'youtube', label: 'Shorts', name: 'YouTube', color: '#FF3D3D' },
  { id: 'tiktok', label: 'TikTok', name: 'TikTok', color: '#25F4EE' },
] as const;

export const PLATFORMS = PLATFORM_CATALOG.map((p) => p.id) as unknown as readonly Platform[];

/** One of the sources of short-form video (see CONTEXT.md). */
export type Platform = (typeof PLATFORM_CATALOG)[number]['id'];

/** Index is the Tier number, 0 to 4. `avatar` is the mood drawable name. */
export const TIER_CATALOG = [
  { label: 'Fresh', avatar: 'mood_0_fresh', color: '#34D399' },
  { label: 'Drifting', avatar: 'mood_1_drifting', color: '#FACC15' },
  { label: 'Doomed', avatar: 'mood_2_doomed', color: '#FB923C' },
  { label: 'Cooked', avatar: 'mood_3_cooked', color: '#F87171' },
  { label: 'Terminal', avatar: 'mood_4_terminal', color: '#FF4D8D' },
] as const;

export const PLATFORM_BY_ID = Object.fromEntries(PLATFORM_CATALOG.map((p) => [p.id, p])) as {
  [P in Platform]: Extract<(typeof PLATFORM_CATALOG)[number], { id: P }>;
};
