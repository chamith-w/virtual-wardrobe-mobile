import { byFrequency } from './vocabulary';

describe('byFrequency', () => {
  it('orders by use, then alphabetically, skipping blanks', () => {
    expect(byFrequency(['Northline', 'Arden', null, 'Northline', ' ', 'Cos', 'Arden', 'Northline'])).toEqual([
      'Northline',
      'Arden',
      'Cos',
    ]);
  });
});
