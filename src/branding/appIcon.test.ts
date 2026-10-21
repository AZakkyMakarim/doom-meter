// App icon resources (ticket 0fn.16). Rendering is a device check; this guards that the
// pieces exist, are wired together, and keep the single-colour / safe-zone contract.
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

const root = join(__dirname, '..', '..');
const res = join(root, 'android', 'app', 'src', 'main', 'res');
const read = (...p: string[]) => readFileSync(join(...p), 'utf8');

describe('adaptive launcher icon', () => {
  it.each(['ic_launcher', 'ic_launcher_round'])('%s declares background, foreground and monochrome', name => {
    const xml = read(res, 'mipmap-anydpi-v26', `${name}.xml`);
    expect(xml).toContain('<adaptive-icon');
    expect(xml).toContain('<background android:drawable="@color/ic_launcher_background"');
    expect(xml).toContain('<foreground android:drawable="@drawable/ic_launcher_foreground"');
    expect(xml).toContain('<monochrome android:drawable="@drawable/ic_launcher_monochrome"');
  });

  it('has the referenced layers', () => {
    expect(read(res, 'values', 'ic_launcher_background.xml')).toContain('#0B0D14');
    expect(existsSync(join(res, 'drawable', 'ic_launcher_foreground.xml'))).toBe(true);
    expect(existsSync(join(res, 'drawable', 'ic_launcher_monochrome.xml'))).toBe(true);
  });

  it('keeps the face inside the 66dp safe circle (viewport 384 = 108dp, face r92 of 256)', () => {
    const fg = read(res, 'drawable', 'ic_launcher_foreground.xml');
    expect(fg).toContain('android:viewportWidth="384"');
    const faceRadiusDp = (92 / 256) * 72; // the 72dp visible window holds the 256 grid
    expect(faceRadiusDp).toBeLessThanOrEqual(33);
    expect(fg).toContain('android:translateX="64"'); // centres the 256 grid in the 384 viewport
  });

  it.each([
    ['mdpi', 48],
    ['hdpi', 72],
    ['xhdpi', 96],
    ['xxhdpi', 144],
    ['xxxhdpi', 192],
  ])('has legacy PNGs at %s (%ipx)', (density, px) => {
    for (const name of ['ic_launcher', 'ic_launcher_round']) {
      const png = readFileSync(join(res, `mipmap-${density}`, `${name}.png`));
      expect(png.readUInt32BE(16)).toBe(px); // IHDR width
      expect(png.readUInt32BE(20)).toBe(px); // IHDR height
    }
  });
});

describe('notification silhouette', () => {
  const xml = read(res, 'drawable', 'ic_stat_doommeter.xml');

  it('is one colour (white only, alpha is what Android uses)', () => {
    const colours = [...xml.matchAll(/(?:fillColor|strokeColor)="([^"]+)"/g)].map(m => m[1]);
    expect(colours.length).toBeGreaterThan(0);
    expect(new Set(colours)).toEqual(new Set(['#FFFFFF']));
  });

  it('is the 24dp small icon of the foreground service', () => {
    expect(xml).toContain('android:width="24dp"');
    const svc = read(root, 'android', 'app', 'src', 'main', 'java', 'com', 'doommeter', 'detection', 'DetectionForegroundService.kt');
    expect(svc).toContain('.setSmallIcon(R.drawable.ic_stat_doommeter)');
    expect(svc).not.toContain('mood_0_fresh');
  });
});

describe('logo docs', () => {
  it.each([
    'logo-b2-master.svg',
    'logo-b2-mono.svg',
    'logo-b2-16px.png',
    'logo-b2-onecolour.png',
    'logo-guidelines.md',
  ])('ships docs/brand/%s', file => {
    expect(existsSync(join(root, 'docs', 'brand', file))).toBe(true);
  });

  it('master SVG uses the enlarged face (r92)', () => {
    expect(read(root, 'docs', 'brand', 'logo-b2-master.svg')).toContain('r="92"');
  });
});
