import {
  atReminderHour,
  defaultReminderDate,
  earliestReminderDay,
  itemIdFromReminder,
  reminderContent,
  reminderId,
  reminderMoment,
} from './reminders';

describe('reminder ids', () => {
  it('derives one stable id per piece and reads it back', () => {
    expect(reminderId('abc-123')).toBe('lend-reminder:abc-123');
    expect(reminderId('abc-123')).toBe(reminderId('abc-123'));
    expect(itemIdFromReminder(reminderId('abc-123'))).toBe('abc-123');
    expect(itemIdFromReminder('something-else')).toBeNull();
    expect(itemIdFromReminder('lend-reminder:')).toBeNull();
  });
});

describe('defaultReminderDate', () => {
  it('is 14 days after lending, at 10:00', () => {
    const lentAt = new Date(2026, 9, 5, 18, 30);
    expect(defaultReminderDate(lentAt, new Date(2026, 9, 5, 19))).toEqual(new Date(2026, 9, 19, 10));
  });

  it('counts from today when the lend date is unknown', () => {
    expect(defaultReminderDate(null, new Date(2026, 9, 5, 8))).toEqual(new Date(2026, 9, 19, 10));
  });

  it('never lands in the past for a piece lent long ago', () => {
    const lentAt = new Date(2026, 8, 1);
    expect(defaultReminderDate(lentAt, new Date(2026, 9, 5, 8))).toEqual(new Date(2026, 9, 5, 10));
    expect(defaultReminderDate(lentAt, new Date(2026, 9, 5, 11))).toEqual(new Date(2026, 9, 6, 10));
  });

  it('crosses month and year ends', () => {
    expect(defaultReminderDate(new Date(2026, 11, 25, 12), new Date(2026, 11, 25, 12))).toEqual(
      new Date(2027, 0, 8, 10),
    );
  });
});

describe('reminder moments', () => {
  it('fires a picked day at 10:00, and refuses moments already passed', () => {
    const now = new Date(2026, 9, 5, 11);
    expect(atReminderHour(new Date(2026, 9, 9, 23, 59))).toEqual(new Date(2026, 9, 9, 10));
    expect(reminderMoment(new Date(2026, 9, 9), now)).toEqual(new Date(2026, 9, 9, 10));
    expect(reminderMoment(new Date(2026, 9, 5), now)).toBeNull();
  });

  it('offers today only while 10:00 is still ahead', () => {
    expect(earliestReminderDay(new Date(2026, 9, 5, 9, 59))).toEqual(new Date(2026, 9, 5));
    expect(earliestReminderDay(new Date(2026, 9, 5, 10))).toEqual(new Date(2026, 9, 6));
  });
});

describe('reminderContent', () => {
  const item = { id: 'dress', name: 'Black midi dress', lentTo: 'Nadia', lentAt: new Date(2026, 8, 14, 12) };

  it('asks the borrower by name and deep-links to the piece', () => {
    const content = reminderContent(item, new Date(2026, 9, 5, 10));
    expect(content.title).toBe('Ask Nadia for your black midi dress');
    expect(content.body).toBe('Nadia has had it 21 days. Tap to see it.');
    expect(content.data).toEqual({ url: '/item/dress', itemId: 'dress' });
  });

  it('works without a name, and keeps acronyms', () => {
    const content = reminderContent({ ...item, name: 'NYC tee', lentTo: null }, new Date(2026, 8, 15, 10));
    expect(content.title).toBe('Time to get your NYC tee back');
    expect(content.body).toBe('They have had it a day. Tap to see it.');
  });
});
