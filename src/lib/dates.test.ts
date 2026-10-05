import { addDays, daysBetween, formatRelativeDay, fromDayKey, greetingFor, toDayKey } from './dates';

describe('day keys', () => {
  it('uses the local calendar day', () => {
    expect(toDayKey(new Date(2026, 9, 5, 23, 59))).toBe('2026-10-05');
    expect(toDayKey(new Date(2026, 0, 1, 0, 0))).toBe('2026-01-01');
  });

  it('round-trips', () => {
    const key = '2026-02-28';
    expect(toDayKey(fromDayKey(key))).toBe(key);
  });
});

describe('arithmetic', () => {
  it('adds days across month ends without mutating the input', () => {
    const start = new Date(2026, 0, 30);
    expect(toDayKey(addDays(start, 3))).toBe('2026-02-02');
    expect(toDayKey(start)).toBe('2026-01-30');
  });

  it('counts whole calendar days, ignoring time of day', () => {
    expect(daysBetween(new Date(2026, 9, 1, 23), new Date(2026, 9, 5, 1))).toBe(4);
    expect(daysBetween(new Date(2026, 9, 5), new Date(2026, 9, 1))).toBe(-4);
  });
});

describe('formatRelativeDay', () => {
  const now = new Date(2026, 9, 5, 9);
  const ago = (days: number) => addDays(new Date(2026, 9, 5, 20), -days);

  it.each([
    [0, 'Today'],
    [1, 'Yesterday'],
    [6, '6 days ago'],
    [13, '13 days ago'],
    [14, '2 weeks ago'],
    [45, '6 weeks ago'],
    [112, '4 months ago'],
    [412, '1 year ago'],
    [800, '2 years ago'],
  ])('%i days → %s', (days, expected) => {
    expect(formatRelativeDay(ago(days), now)).toBe(expected);
  });

  it('says never for a missing date', () => {
    expect(formatRelativeDay(null, now)).toBe('Never');
  });
});

describe('greetingFor', () => {
  it.each([
    [7, 'Good morning'],
    [13, 'Good afternoon'],
    [20, 'Good evening'],
  ])('%i:00 → %s', (hour, expected) => {
    expect(greetingFor(new Date(2026, 9, 5, hour))).toBe(expected);
  });
});
