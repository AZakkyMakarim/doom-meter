import { parseRawEvent } from './rawEvent';

describe('parseRawEvent', () => {
  it('reads events from the Facebook Platform', () => {
    expect(parseRawEvent('{"type":"videoChanged","platform":"facebook","at":5}')).toEqual({
      type: 'videoChanged',
      platform: 'facebook',
      at: 5,
    });
  });

  it('reads the same-video hint on a focus gain, and only there', () => {
    expect(
      parseRawEvent('{"type":"surfaceFocusGained","platform":"tiktok","sameVideo":true,"at":1}'),
    ).toEqual({ type: 'surfaceFocusGained', platform: 'tiktok', sameVideo: true, at: 1 });
    expect(
      parseRawEvent('{"type":"surfaceFocusGained","platform":"tiktok","sameVideo":"yes"}'),
    ).toEqual({ type: 'surfaceFocusGained', platform: 'tiktok' });
    expect(
      parseRawEvent('{"type":"videoChanged","platform":"tiktok","sameVideo":true}'),
    ).toEqual({ type: 'videoChanged', platform: 'tiktok' });
  });

  it('parses a surface event with a timestamp', () => {
    expect(
      parseRawEvent('{"type":"surfaceFocusGained","platform":"tiktok","at":1700000000000}'),
    ).toEqual({ type: 'surfaceFocusGained', platform: 'tiktok', at: 1_700_000_000_000 });
  });

  it('parses every platform event without a timestamp', () => {
    expect(parseRawEvent('{"type":"videoChanged","platform":"youtube"}')).toEqual({
      type: 'videoChanged',
      platform: 'youtube',
    });
    expect(parseRawEvent('{"type":"detectionFailed","platform":"instagram"}')).toEqual({
      type: 'detectionFailed',
      platform: 'instagram',
    });
  });

  it('parses the accessibility activity signal of a Platform app', () => {
    expect(parseRawEvent('{"type":"accessibilityActivity","platform":"youtube","at":7}')).toEqual({
      type: 'accessibilityActivity',
      platform: 'youtube',
      at: 7,
    });
    expect(parseRawEvent('{"type":"accessibilityActivity"}')).toBeNull();
  });

  it('parses screen events, which carry no platform', () => {
    expect(parseRawEvent('{"type":"screenOff","at":5}')).toEqual({ type: 'screenOff', at: 5 });
    expect(parseRawEvent('{"type":"screenOn"}')).toEqual({ type: 'screenOn' });
  });

  it('drops anything it does not recognise instead of throwing', () => {
    expect(parseRawEvent('not json')).toBeNull();
    expect(parseRawEvent('null')).toBeNull();
    expect(parseRawEvent('{"type":"explode"}')).toBeNull();
    expect(parseRawEvent('{"type":"videoChanged","platform":"vine"}')).toBeNull();
    expect(parseRawEvent('{"type":"videoChanged"}')).toBeNull();
  });

  it('ignores a timestamp that is not a finite number', () => {
    expect(parseRawEvent('{"type":"screenOn","at":"soon"}')).toEqual({ type: 'screenOn' });
  });

  it('never carries extra fields through, so no content can leak into the engine', () => {
    const event = parseRawEvent(
      '{"type":"videoChanged","platform":"tiktok","title":"secret","at":1}',
    );
    expect(event).toEqual({ type: 'videoChanged', platform: 'tiktok', at: 1 });
  });
});
