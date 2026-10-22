import { toDayKey } from '@/lib/dates';

import {
  calendarRows,
  dayKind,
  dayLabel,
  dotColors,
  kindLabel,
  loadRange,
  monthOfWeek,
  rowOf,
  stepWeek,
  tripDayLabel,
  tripOn,
  weekStart,
} from './calendar';
import { planReminderContent, reminderEvenings } from './planReminder';

jest.mock('expo-notifications', () => ({}));

const d = (y: number, m: number, day: number) => new Date(y, m - 1, day);
const keys = (row: Date[]) => row.map(toDayKey);

describe('planner calendar', () => {
  it('lays a month out in Monday-first weeks, edge days from the neighbouring months', () => {
    const rows = calendarRows(d(2026, 10, 14));
    expect(rows).toHaveLength(5);
    expect(keys(rows[0]!)).toEqual([
      '2026-09-28',
      '2026-09-29',
      '2026-09-30',
      '2026-10-01',
      '2026-10-02',
      '2026-10-03',
      '2026-10-04',
    ]);
    expect(toDayKey(rows[4]![6]!)).toBe('2026-11-01');
    expect(rowOf(rows, d(2026, 10, 14))).toBe(2);
    expect(rowOf(rows, d(2026, 12, 1))).toBe(-1);
  });

  it('finds the start of a week', () => {
    expect(toDayKey(weekStart(d(2026, 10, 14)))).toBe('2026-10-12');
    expect(toDayKey(weekStart(d(2026, 10, 12)))).toBe('2026-10-12');
    expect(toDayKey(weekStart(d(2026, 10, 18)))).toBe('2026-10-12');
  });

  it('steps the week strip across months', () => {
    const october = calendarRows(d(2026, 10, 1));
    const selected = d(2026, 10, 14);
    expect(stepWeek(october, 2, 1, selected)).toEqual({ month: d(2026, 10, 1), row: 3 });
    // From the last October row to the next week: November's grid, its first full week.
    const next = stepWeek(october, 4, 1, selected);
    expect(next.month).toEqual(d(2026, 11, 1));
    expect(toDayKey(calendarRows(next.month)[next.row]![0]!)).toBe('2026-11-02');
    // A week spanning two months shows under the selected day's month when it's in it.
    expect(monthOfWeek(d(2026, 9, 28), d(2026, 9, 30))).toEqual(d(2026, 9, 1));
    expect(monthOfWeek(d(2026, 9, 28), d(2026, 10, 20))).toEqual(d(2026, 10, 1));
  });

  it('names the kind of day', () => {
    expect(dayKind('2026-10-14', '2026-10-14', false, true)).toBe('today');
    expect(dayKind('2026-10-14', '2026-10-14', true, true)).toBe('journal');
    expect(dayKind('2026-10-12', '2026-10-14', false, false)).toBe('past');
    expect(dayKind('2026-10-16', '2026-10-14', false, true)).toBe('planned');
    expect(dayKind('2026-10-16', '2026-10-14', false, false)).toBe('free');
    expect(kindLabel('journal', true).label).toBe('Worn today');
    expect(kindLabel('journal', false)).toEqual({ label: 'Outfit journal', tone: 'success' });
  });

  it('dots the main pieces’ colours, top to toe', () => {
    const c = (hex: string) => [{ hex, name: hex }];
    expect(
      dotColors([
        { category: 'shoes', colors: c('#000') },
        { category: 'jackets', colors: c('#111') },
        { category: 'trousers', colors: c('#222') },
        { category: 'shirts', colors: c('#333') },
      ]),
    ).toEqual(['#333', '#222', '#111']);
  });

  it('labels days and trips', () => {
    expect(dayLabel(d(2026, 10, 7), { today: false, worn: true, planned: null, trip: null }, 'en-GB')).toBe(
      'Wednesday 7 October, worn',
    );
    const trips = [{ name: 'Lisbon', startDate: '2026-11-02', endDate: '2026-11-06' }];
    expect(tripOn('2026-11-03', trips)?.name).toBe('Lisbon');
    expect(tripOn('2026-11-07', trips)).toBeNull();
    expect(tripDayLabel('2026-11-03', trips[0]!)).toBe('Day 2 of 5');
  });

  it('loads a week either side of the grid, and always the selected day', () => {
    const rows = calendarRows(d(2026, 10, 1));
    expect(loadRange(rows, '2026-10-14')).toEqual({ from: '2026-09-21', to: '2026-11-08' });
    expect(loadRange(rows, '2027-01-01').to).toBe('2027-01-01');
  });
});

describe('evening plan reminder', () => {
  it('reminds on coming evenings whose next day has nothing planned', () => {
    const now = new Date(2026, 9, 22, 21, 0); // Thursday, after this evening's 20:00
    const planned = new Set(['2026-10-24', '2026-10-26']);
    const evenings = reminderEvenings(now, planned, 5);
    expect(evenings.map((e) => e.day)).toEqual(['2026-10-25', '2026-10-27']);
    expect(evenings[0]!.at.getHours()).toBe(20);
    expect(toDayKey(evenings[0]!.at)).toBe('2026-10-24');
  });

  it('includes tonight when it is still to come', () => {
    const morning = new Date(2026, 9, 22, 9, 0);
    expect(reminderEvenings(morning, new Set(), 1)).toEqual([{ at: new Date(2026, 9, 22, 20, 0), day: '2026-10-23' }]);
  });

  it('says which day and opens the planner on it', () => {
    const content = planReminderContent('2026-10-23', 'en-GB');
    expect(content.body).toBe('Nothing planned for Fri 23 Oct yet. Pick something for the forecast.');
    expect(content.data).toEqual({ kind: 'plan', day: '2026-10-23' });
  });
});
