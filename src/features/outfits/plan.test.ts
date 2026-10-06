import { planButtonLabel, planDayLabel, planToast } from './plan';

const today = new Date(2026, 9, 6, 9, 30);

describe('plan copy', () => {
  it('names nearby days in words', () => {
    expect(planDayLabel(new Date(2026, 9, 6), today)).toBe('today');
    expect(planDayLabel(new Date(2026, 9, 7, 18), today)).toBe('tomorrow');
    expect(planDayLabel(new Date(2026, 9, 9), today, 'en-GB')).toBe('Fri 9 Oct');
  });

  it('says what happened', () => {
    const fri = new Date(2026, 9, 9);
    expect(planToast(fri, { replaced: null, already: false }, today, 'en-GB')).toBe('Planned for Fri 9 Oct');
    expect(planToast(fri, { replaced: 'Monday uniform', already: false }, today, 'en-GB')).toBe(
      'Planned for Fri 9 Oct, instead of Monday uniform',
    );
    expect(planToast(new Date(2026, 9, 7), { replaced: null, already: true }, today)).toBe(
      'Already planned for tomorrow',
    );
    expect(planButtonLabel(new Date(2026, 9, 6), today)).toBe('Plan for today');
  });
});
