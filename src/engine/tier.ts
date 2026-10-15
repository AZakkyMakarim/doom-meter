import type { Tier, TierBounds, TierThresholds, Totals } from './types';

export const DEFAULT_TIER_THRESHOLDS: TierThresholds = {
  videos: [10, 30, 60, 120],
  minutes: [10, 30, 60, 120],
};

const MS_PER_MINUTE = 60_000;

function tierFor(value: number, bounds: TierBounds): Tier {
  let tier = 0;
  for (const bound of bounds) {
    if (value >= bound) tier += 1;
  }
  return tier as Tier;
}

/** Tier is the higher of the count tier and the time tier. */
export function computeTier(totals: Totals, thresholds: TierThresholds): Tier {
  const countTier = tierFor(totals.watchedVideos, thresholds.videos);
  const timeTier = tierFor(totals.watchTimeMs / MS_PER_MINUTE, thresholds.minutes);
  return Math.max(countTier, timeTier) as Tier;
}
