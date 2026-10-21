import * as fs from 'fs';
import * as path from 'path';
import { TIER_CATALOG } from '../design/catalog';
import { colors } from '../design/tokens';
import { en } from '../i18n/messages.en';
import { id } from '../i18n/messages.id';

const RES = path.resolve(__dirname, '..', '..', 'android', 'app', 'src', 'main', 'res');
const read = (file: string) => fs.readFileSync(path.join(RES, file), 'utf8');

/** The widget is drawn by RemoteViews, which cannot load these from JavaScript; they live in res. */
describe('Home widget resources', () => {
  it('keeps the design tokens in step with the widget colors', () => {
    const xml = read('values/colors.xml');
    const color = (name: string) =>
      new RegExp(`<color name="${name}">(#[0-9A-Fa-f]{6})</color>`).exec(xml)?.[1].toUpperCase();
    expect(color('widget_surface')).toBe(colors.overlayBg);
    expect(color('widget_text')).toBe(colors.text.toUpperCase());
    expect(color('widget_muted')).toBe(colors.textMuted.toUpperCase());
    expect(color('widget_vibing')).toBe(TIER_CATALOG[0].textColor);
  });

  it('has a dark, softly rounded surface like the pill', () => {
    const xml = read('drawable/widget_background.xml');
    expect(xml).toContain('@color/widget_surface');
    expect(xml).toContain('android:radius="20dp"');
  });

  it('is 2x2 by default and can only be made bigger', () => {
    const xml = read('xml/doommeter_widget_info.xml');
    expect(xml).toContain('android:targetCellWidth="2"');
    expect(xml).toContain('android:targetCellHeight="2"');
    expect(xml).toContain('android:resizeMode="horizontal|vertical"');
    expect(xml).toMatch(/android:minResizeWidth="110dp"/);
    expect(xml).toMatch(/android:minResizeHeight="110dp"/);
    expect(xml).toContain('android:previewImage="@drawable/widget_preview"');
  });

  it('says the empty state in English and Indonesian for a widget the app has not drawn yet', () => {
    expect(read('values/strings.xml')).toContain(`<string name="widget_empty">${en['widget.empty']}</string>`);
    expect(read('values-in/strings.xml')).toContain(
      `<string name="widget_empty">${id['widget.empty']}</string>`,
    );
  });

  it('is registered in the manifest', () => {
    const manifest = fs.readFileSync(path.join(RES, '..', 'AndroidManifest.xml'), 'utf8');
    expect(manifest).toContain('android:name=".widget.DoomMeterWidgetProvider"');
    expect(manifest).toContain('@xml/doommeter_widget_info');
  });
});
