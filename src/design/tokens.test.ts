import * as fs from 'fs';
import * as path from 'path';
import { colors } from './tokens';
import { platformColors } from './platformTokens';

const SRC = path.resolve(__dirname, '..');
const ROOT = path.resolve(SRC, '..');

function sourceFiles(dir: string): string[] {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) return sourceFiles(full);
    return /\.(ts|tsx)$/.test(entry.name) && !/\.test\.ts$/.test(entry.name) ? [full] : [];
  });
}

describe('design tokens (MASTER 3, 10)', () => {
  it('keeps raw hex colors in src/design only; components use tokens', () => {
    const offenders = [...sourceFiles(SRC), path.join(ROOT, 'App.tsx')]
      .filter((file) => !file.startsWith(path.join(SRC, 'design')))
      .filter((file) => /#[0-9A-Fa-f]{6}\b|rgba?\(/.test(fs.readFileSync(file, 'utf8')))
      .map((file) => path.relative(ROOT, file));
    expect(offenders).toEqual([]);
  });

  it('has the five Tier colors in order', () => {
    expect(colors.sev).toEqual(['#FACC15', '#FB923C', '#F87171', '#A3E635', '#6B7280']);
    expect(colors.sevText).toEqual(['#FACC15', '#FB923C', '#F87171', '#A3E635', '#9CA3AF']);
  });

  it('shares one set of Platform colors', () => {
    expect(platformColors).toEqual(colors.platform);
  });
});
