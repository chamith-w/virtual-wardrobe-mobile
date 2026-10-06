import { containRect, heroPose, IDENTITY_POSE, poseAt } from './hero';

describe('containRect', () => {
  it('letterboxes a tall image in a wide box', () => {
    expect(containRect({ x: 0, y: 0, width: 200, height: 100 }, 0.5)).toEqual({ x: 75, y: 0, width: 50, height: 100 });
  });

  it('pillarboxes a wide image in a tall box', () => {
    expect(containRect({ x: 10, y: 10, width: 100, height: 200 }, 2)).toEqual({ x: 10, y: 85, width: 100, height: 50 });
  });

  it('returns the box when the aspect is unknown', () => {
    const box = { x: 1, y: 2, width: 3, height: 4 };
    expect(containRect(box, 0)).toBe(box);
  });
});

describe('heroPose', () => {
  const target = { x: 40, y: 100, width: 300, height: 360 };

  it('rests at the target when source and target match', () => {
    expect(heroPose(target, target, 0.8)).toEqual(IDENTITY_POSE);
  });

  it('scales uniformly by the garment size and moves centre to centre', () => {
    const source = { x: 20, y: 500, width: 92, height: 110 };
    const pose = heroPose(source, target, 1);
    // A square garment: 92 wide in the source, 300 wide in the target.
    expect(pose.scale).toBeCloseTo(92 / 300);
    expect(pose.translateX).toBeCloseTo(20 + 46 - (40 + 150));
    expect(pose.translateY).toBeCloseTo(500 + 55 - (100 + 180));
  });

  it('matches the garment, not the box, when the boxes have different shapes', () => {
    // A wide shoe cutout in a square grid well and in the tall detail stage.
    const source = { x: 0, y: 0, width: 100, height: 100 };
    const pose = heroPose(source, target, 1.5);
    // 100 wide in the source, 300 wide in the target (both width-bound).
    expect(pose.scale).toBeCloseTo(1 / 3);
  });

  it('falls back to the source box shape without an aspect', () => {
    const source = { x: 0, y: 0, width: 60, height: 72 };
    expect(heroPose(source, target, null).scale).toBeCloseTo(60 / 300);
  });

  it('ignores an unmeasured target', () => {
    expect(heroPose(target, { x: 0, y: 0, width: 0, height: 0 }, 1)).toEqual(IDENTITY_POSE);
  });
});

describe('poseAt', () => {
  it('blends from the start pose to rest', () => {
    const start = { translateX: -100, translateY: 300, scale: 0.25 };
    expect(poseAt(start, 0)).toEqual(start);
    expect(poseAt(start, 1)).toEqual({ translateX: -0, translateY: 0, scale: 1 });
    expect(poseAt(start, 0.5)).toEqual({ translateX: -50, translateY: 150, scale: 0.625 });
  });
});
