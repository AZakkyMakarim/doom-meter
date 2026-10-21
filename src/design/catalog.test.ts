import * as fs from 'fs';
import * as path from 'path';
import { PLATFORMS, PLATFORM_CATALOG, TIER_CATALOG, tierSentence } from './catalog';
import { colors } from './tokens';
import { platformColors } from './platformTokens';
import { PLATFORMS as ENGINE_PLATFORMS } from '../engine';

const SRC = path.resolve(__dirname, '..');

function sourceFiles(dir: string): string[] {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) return sourceFiles(full);
    return /\.(ts|tsx)$/.test(entry.name) && !/\.test\.ts$/.test(entry.name) ? [full] : [];
  });
}

describe('Platform and Tier catalog', () => {
  it('lists the Platforms once, in display order, with feed label, name and color', () => {
    expect(PLATFORM_CATALOG).toEqual([
      { id: 'instagram', label: 'Reels', name: 'Instagram', color: '#E1306C' },
      { id: 'youtube', label: 'Shorts', name: 'YouTube', color: '#FF3D3D' },
      { id: 'tiktok', label: 'TikTok', name: 'TikTok', color: '#25F4EE' },
    ]);
    expect(PLATFORMS).toEqual(['instagram', 'youtube', 'tiktok']);
    expect(ENGINE_PLATFORMS).toBe(PLATFORMS);
  });

  it('lists the five Tiers once with label, mood avatar and color', () => {
    expect(TIER_CATALOG).toEqual([
      { label: 'Fresh', avatar: 'mood_0_fresh', color: '#34D399' },
      { label: 'Drifting', avatar: 'mood_1_drifting', color: '#FACC15' },
      { label: 'Doomed', avatar: 'mood_2_doomed', color: '#FB923C' },
      { label: 'Cooked', avatar: 'mood_3_cooked', color: '#F87171' },
      { label: 'Terminal', avatar: 'mood_4_terminal', color: '#FF4D8D' },
    ]);
  });

  it('feeds the design tokens', () => {
    expect(colors.sev).toEqual(TIER_CATALOG.map((t) => t.color));
    expect(platformColors).toEqual(colors.platform);
    expect(Object.keys(colors.platform)).toEqual([...PLATFORMS]);
  });

  it('says a Tier as one sentence', () => {
    expect(tierSentence(2)).toBe('Level 3 of 5, Doomed.');
  });

  it('keeps Tier names, mood avatars and Platform labels out of every other source file', () => {
    const catalog = path.join(SRC, 'design', 'catalog.ts');
    const words = [
      ...TIER_CATALOG.flatMap((t) => [t.label, t.avatar]),
      ...PLATFORM_CATALOG.flatMap((p) => [p.label, p.name]),
    ];
    const offenders = sourceFiles(SRC)
      .filter((file) => file !== catalog)
      .filter((file) => {
        const text = fs.readFileSync(file, 'utf8');
        return words.some((w) => text.includes(`'${w}'`) || text.includes(`"${w}"`));
      })
      .map((file) => path.relative(SRC, file));
    expect(offenders).toEqual([]);
  });
});
