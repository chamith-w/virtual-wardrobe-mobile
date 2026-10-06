import { savedBody, savedHeadline } from './savedCopy';

describe('savedHeadline', () => {
  it('says where the piece went', () => {
    expect(savedHeadline('rail')).toBe('Hung on the rail.');
    expect(savedHeadline('shoes')).toBe('On the shoe rack.');
    expect(savedHeadline(null)).toBe('In your wardrobe.');
  });
});

describe('savedBody', () => {
  it('names the wardrobe, group and seasons', () => {
    expect(
      savedBody({ name: 'Camel wool coat', wardrobeName: 'Home', category: 'coats', seasons: ['winter', 'autumn'] }),
    ).toBe('Camel wool coat is in your Home wardrobe. Filed under Outerwear, for autumn and winter.');
    expect(savedBody({ name: 'White tee', wardrobeName: 'Home', category: 'tshirts', seasons: [] })).toBe(
      'White tee is in your Home wardrobe. Filed under Tops, for any season.',
    );
    expect(
      savedBody({
        name: 'Linen shirt',
        wardrobeName: 'Home',
        category: 'shirts',
        seasons: ['spring', 'summer', 'autumn'],
      }),
    ).toBe('Linen shirt is in your Home wardrobe. Filed under Tops, for spring, summer and autumn.');
  });
});
