import { chooseEngine, failureMessage, fallbackAfter, normalizeBounds } from './engine';

describe('chooseEngine', () => {
  it('prefers the device, even while its model downloads', () => {
    expect(chooseEngine('ready', true)).toBe('device');
    expect(chooseEngine('needs-download', true)).toBe('device');
  });

  it('falls back to remove.bg only with a key', () => {
    expect(chooseEngine('unsupported', true)).toBe('remove.bg');
    expect(chooseEngine('unsupported', false)).toBeNull();
  });
});

describe('fallbackAfter', () => {
  it('retries with remove.bg after an on-device failure when a key is set', () => {
    expect(fallbackAfter('model', true)).toBe('remove.bg');
    expect(fallbackAfter('no-subject', true)).toBe('remove.bg');
    expect(fallbackAfter('model', false)).toBeNull();
    expect(fallbackAfter('unavailable', true)).toBeNull();
  });
});

describe('normalizeBounds', () => {
  it('turns pixels into fractions of the photo', () => {
    expect(normalizeBounds({ x: 100, y: 200, width: 1000, height: 1200 }, 2000, 1600)).toEqual({
      x: 0.05,
      y: 0.125,
      width: 0.5,
      height: 0.75,
    });
  });

  it('clamps to the photo and rejects nonsense', () => {
    expect(normalizeBounds({ x: -10, y: 0, width: 3000, height: 100 }, 2000, 1000)).toEqual({
      x: 0,
      y: 0,
      width: 1,
      height: 0.1,
    });
    expect(normalizeBounds(null, 100, 100)).toBeNull();
    expect(normalizeBounds({ x: 0, y: 0, width: 0, height: 10 }, 100, 100)).toBeNull();
    expect(normalizeBounds({ x: 0, y: 0, width: 10, height: 10 }, 0, 100)).toBeNull();
  });
});

describe('failureMessage', () => {
  it('always offers a way forward', () => {
    for (const reason of ['no-subject', 'model', 'unavailable', 'failed'] as const) {
      expect(failureMessage(reason).body).toMatch(/keep the photo/);
    }
  });
});
