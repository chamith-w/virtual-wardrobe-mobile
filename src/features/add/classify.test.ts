import { classifyGarment, CONFIDENT, isConfident, setGarmentClassifier } from './classify';

const input = { imageUri: 'file:///cutout.png', width: 400, height: 480, colors: [] };

afterEach(() => setGarmentClassifier(null));

describe('classifyGarment', () => {
  it('returns null by default, so the quick-pick opens', async () => {
    await expect(classifyGarment(input)).resolves.toBeNull();
  });

  it('passes through a registered guess, clamping confidence', async () => {
    setGarmentClassifier(async () => ({ category: 'coats', confidence: 1.4 }));
    await expect(classifyGarment(input)).resolves.toEqual({ category: 'coats', confidence: 1 });
  });

  it('treats unknown categories and failures as no guess', async () => {
    setGarmentClassifier(async () => ({ category: 'capes' as never, confidence: 0.9 }));
    await expect(classifyGarment(input)).resolves.toBeNull();
    setGarmentClassifier(async () => {
      throw new Error('model missing');
    });
    await expect(classifyGarment(input)).resolves.toBeNull();
  });
});

describe('isConfident', () => {
  it('only skips the quick-pick for confident guesses', () => {
    expect(isConfident(null)).toBe(false);
    expect(isConfident({ category: 'shoes', confidence: CONFIDENT - 0.01 })).toBe(false);
    expect(isConfident({ category: 'shoes', confidence: CONFIDENT })).toBe(true);
  });
});
