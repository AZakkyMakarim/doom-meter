import * as fs from 'fs';
import * as path from 'path';

const ROOT = path.resolve(__dirname, '..', '..');

function screenFiles(dir: string): string[] {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) return screenFiles(full);
    return entry.name.endsWith('.tsx') ? [full] : [];
  });
}

/** Text written straight into a screen: words between tags, or in a label-like prop. */
function inlineTexts(source: string): string[] {
  // The debug simulator panel exists only in development builds and is not user-facing.
  const shipped = source.split('{__DEV__ &&')[0];
  const found: string[] = [];
  for (const match of shipped.matchAll(/>\s*([^<>{}\n]*[A-Za-z][^<>{}\n]*?)\s*<\//g)) found.push(match[1]);
  for (const match of shipped.matchAll(
    /\b(?:label|title|caption|hint|placeholder|accessibilityLabel|accessibilityHint)="([^"]*[A-Za-z][^"]*)"/g,
  )) {
    found.push(match[1]);
  }
  return found;
}

describe('texts live in the catalog', () => {
  it('spots words written inline in a screen', () => {
    expect(inlineTexts('<Text>Hello</Text>')).toEqual(['Hello']);
    expect(inlineTexts('<Text>\n  Hello there\n</Text>')).toEqual(['Hello there']);
    expect(inlineTexts('<Button label="Save" />')).toEqual(['Save']);
    expect(inlineTexts("<Text>{t(locale, 'x')}</Text>")).toEqual([]);
  });

  it('has no user text written directly in any screen', () => {
    const files = [path.join(ROOT, 'App.tsx'), ...screenFiles(path.join(ROOT, 'src'))];
    const offenders = files.flatMap((file) =>
      inlineTexts(fs.readFileSync(file, 'utf8')).map(
        (text) => `${path.relative(ROOT, file)}: ${text}`,
      ),
    );
    expect(offenders).toEqual([]);
  });
});
