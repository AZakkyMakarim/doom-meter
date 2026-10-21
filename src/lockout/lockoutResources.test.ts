import * as fs from 'fs';
import * as path from 'path';
import { colors } from '../design/tokens';

const MAIN = path.resolve(__dirname, '..', '..', 'android', 'app', 'src', 'main');
const read = (file: string) => fs.readFileSync(path.join(MAIN, file), 'utf8');

/** The block screen is drawn by native views, which cannot load the tokens from JavaScript. */
describe('block screen resources', () => {
  it('keeps the design tokens in step with the block screen colors', () => {
    const xml = read('res/values/colors.xml');
    const color = (name: string) =>
      new RegExp(`<color name="${name}">(#[0-9A-Fa-f]{6})</color>`).exec(xml)?.[1].toUpperCase();
    expect(color('lockout_bg')).toBe(colors.appBg.toUpperCase());
    expect(color('lockout_action')).toBe(colors.action.toUpperCase());
    expect(color('lockout_on_action')).toBe(colors.onAction.toUpperCase());
  });

  it('has a single way out: the Back to Home button, at least 48dp tall', () => {
    const xml = read('res/layout/lockout_block.xml');
    expect(xml.match(/<Button/g)).toHaveLength(1);
    expect(xml).toContain('android:id="@+id/lockout_back"');
    expect(xml).toMatch(/android:minHeight="48dp"/);
  });

  it('is registered in the manifest, out of Recents, as a separate task', () => {
    const manifest = read('AndroidManifest.xml');
    expect(manifest).toContain('android:name=".lockout.LockoutBlockActivity"');
    expect(manifest).toContain('android:excludeFromRecents="true"');
    expect(manifest).toContain('android:taskAffinity=""');
    expect(manifest).toContain('android:exported="false"');
  });
});
