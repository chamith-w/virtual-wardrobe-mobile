import {
  BOARD_ASPECT,
  boardSize,
  contentFrame,
  contentSize,
  FRAME_MAX_ASPECT,
  FRAME_MIN_ASPECT,
  handlePoint,
  handleTransform,
  hitTest,
  isOnHandle,
  MAX_SCALE,
  MIN_SCALE,
  normaliseRotation,
  PIECE_BASE,
  pieceBounds,
  placeNewPiece,
  ROLE_POSE,
  snapAxis,
  snapPiece,
  snapRotation,
  snapTargets,
  toCanvas,
  toNormalised,
  type PlacedPiece,
} from './canvas';

const board = boardSize(360);
const piece = (over: Partial<PlacedPiece> & { id?: string; z?: number } = {}) => ({
  id: 'p',
  z: 0,
  cx: 180,
  cy: 234,
  scale: 1,
  rotation: 0,
  aspect: 1,
  ...over,
});

describe('normalised ↔ canvas coordinates', () => {
  it('round-trips a pose on any board size', () => {
    const pose = { x: 0.27, y: 0.81, scale: 1.3, rotation: -12.5 };
    for (const width of [300, 360, 412.5]) {
      const b = boardSize(width);
      const back = toNormalised(toCanvas(pose, b), b);
      expect(back.x).toBeCloseTo(pose.x, 10);
      expect(back.y).toBeCloseTo(pose.y, 10);
      expect(back.scale).toBe(pose.scale);
      expect(back.rotation).toBeCloseTo(pose.rotation, 10);
    }
  });

  it('keeps the board at a fixed aspect so positions mean the same everywhere', () => {
    expect(boardSize(300).height).toBeCloseTo(300 * BOARD_ASPECT);
    expect(toCanvas({ x: 0.5, y: 0.5, scale: 1, rotation: 0 }, boardSize(200))).toEqual({
      cx: 100,
      cy: 130,
      scale: 1,
      rotation: 0,
    });
  });

  it('stores rotation in (−180, 180]', () => {
    expect(normaliseRotation(190)).toBe(-170);
    expect(normaliseRotation(-180)).toBe(180);
    expect(normaliseRotation(540)).toBe(180);
    expect(toNormalised({ cx: 0, cy: 0, scale: 1, rotation: 370 }, board).rotation).toBeCloseTo(10);
  });
});

describe('content size and bounds', () => {
  it('sizes the longest visible side by scale', () => {
    expect(contentSize(2, 1, 360)).toEqual({ width: PIECE_BASE * 360, height: (PIECE_BASE * 360) / 2 });
    const tall = contentSize(0.5, 2, 360);
    expect(tall.height).toBeCloseTo(PIECE_BASE * 360 * 2);
    expect(tall.width).toBeCloseTo(tall.height / 2);
  });

  it('widens the bounds of a rotated piece', () => {
    const flat = pieceBounds(piece({ aspect: 2 }), 360);
    const turned = pieceBounds(piece({ aspect: 2, rotation: 90 }), 360);
    expect(turned.width).toBeCloseTo(flat.height);
    expect(turned.height).toBeCloseTo(flat.width);
  });
});

describe('hit testing', () => {
  it('finds the topmost piece under a point', () => {
    const pieces = [piece({ id: 'back', z: 0 }), piece({ id: 'front', z: 2, cx: 200 }), piece({ id: 'far', cx: 40 })];
    expect(hitTest(pieces, { x: 190, y: 234 }, 360)).toBe('front');
    expect(hitTest(pieces, { x: 40, y: 234 }, 360)).toBe('far');
    expect(hitTest(pieces, { x: 350, y: 20 }, 360)).toBeNull();
  });

  it('follows rotation', () => {
    // A long, thin piece turned upright covers points above its centre, not beside it.
    const thin = piece({ aspect: 4, rotation: 90 });
    expect(hitTest([thin], { x: 180, y: 234 - 60 }, 360)).toBe('p');
    expect(hitTest([thin], { x: 180 + 60, y: 234 }, 360)).toBeNull();
  });

  it('gives tiny pieces a 44pt target', () => {
    const tiny = piece({ scale: 0.1 });
    expect(hitTest([tiny], { x: 180 + 20, y: 234 }, 360)).toBe('p');
  });
});

describe('corner handle', () => {
  it('sits at the turned bottom-right corner', () => {
    const h = handlePoint(piece({ rotation: 0 }), 360);
    const half = (PIECE_BASE * 360) / 2;
    expect(h.x).toBeGreaterThan(180 + half);
    expect(h.y).toBeGreaterThan(234 + half);
    const turned = handlePoint(piece({ rotation: 90 }), 360);
    expect(turned.x).toBeLessThan(180);
    expect(turned.y).toBeGreaterThan(234);
    expect(isOnHandle(piece(), h, 360)).toBe(true);
    expect(isOnHandle(piece(), { x: 180, y: 234 }, 360)).toBe(false);
  });

  it('scales with distance and rotates with angle, within limits', () => {
    const centre = { x: 0, y: 0 };
    const start = { scale: 1, rotation: 0, angle: 0, distance: 100 };
    const out = handleTransform(start, centre, { x: 0, y: 150 });
    expect(out.scale).toBeCloseTo(1.5);
    expect(out.rotation).toBeCloseTo(90);
    expect(handleTransform(start, centre, { x: 1000, y: 0 }).scale).toBe(MAX_SCALE);
    expect(handleTransform(start, centre, { x: 1, y: 0 }).scale).toBe(MIN_SCALE);
  });

  it('settles rotation on right angles', () => {
    expect(snapRotation(3)).toEqual({ rotation: 0, snapped: true });
    expect(snapRotation(-88)).toEqual({ rotation: -90, snapped: true });
    expect(snapRotation(178)).toEqual({ rotation: 180, snapped: true });
    expect(snapRotation(12)).toEqual({ rotation: 12, snapped: false });
  });
});

describe('snap guides', () => {
  it('catches the board centre lines within 8pt', () => {
    const targets = snapTargets([], board);
    const near = snapPiece(piece({ cx: 186, cy: 228 }), targets, 360);
    expect(near).toEqual({ cx: 180, cy: 234, guideX: 180, guideY: 234 });
    const far = snapPiece(piece({ cx: 200, cy: 260 }), targets, 360);
    expect(far).toEqual({ cx: 200, cy: 260, guideX: null, guideY: null });
  });

  it('lines centres up with other pieces', () => {
    const other = piece({ cx: 80, cy: 100 });
    const moving = piece({ cx: 84, cy: 400 });
    const out = snapPiece(moving, snapTargets([other], board), 360);
    expect(out.cx).toBe(80);
    expect(out.guideX).toBe(80);
    expect(out.guideY).toBeNull();
  });

  it('lines edges up with other pieces’ edges', () => {
    const other = piece({ cx: 100, cy: 100 });
    const otherLeft = pieceBounds(other, 360).x;
    // A narrower piece whose left edge sits 5pt right of the other's; its centre is far off.
    const width = pieceBounds(piece({ aspect: 0.5 }), 360).width;
    const moving = piece({ cx: otherLeft + 5 + width / 2, cy: 420, aspect: 0.5 });
    const out = snapPiece(moving, snapTargets([other], board), 360);
    expect(out.guideX).toBeCloseTo(otherLeft);
    expect(out.cx).toBeCloseTo(moving.cx - 5);
  });

  it('prefers the nearest line', () => {
    const s = snapAxis(0, 50, 100, [
      { at: 56, edge: false },
      { at: 52, edge: false },
    ]);
    expect(s).toEqual({ delta: 2, guide: 52 });
  });

  it('matches edges only to edges and centres only to centres', () => {
    expect(snapAxis(0, 50, 100, [{ at: 3, edge: false }])).toBeNull();
    expect(snapAxis(0, 50, 100, [{ at: 47, edge: true }])).toBeNull();
    expect(snapAxis(0, 50, 100, [{ at: 103, edge: true }])).toEqual({ delta: 3, guide: 103 });
  });
});

describe('placing a new piece', () => {
  it('uses the role’s spot on an empty board', () => {
    expect(placeNewPiece('shoes', [])).toEqual(ROLE_POSE.shoes);
    expect(placeNewPiece('jeans', [])).toEqual(ROLE_POSE.bottom);
  });

  it('steps aside when the spot is taken', () => {
    const first = placeNewPiece('shirts', []);
    const second = placeNewPiece('tshirts', [first]);
    expect(second).not.toEqual(first);
    const third = placeNewPiece('knitwear', [first, second]);
    expect(third).not.toEqual(second);
    for (const p of [second, third]) {
      expect(p.x).toBeGreaterThanOrEqual(0.12);
      expect(p.x).toBeLessThanOrEqual(0.88);
    }
  });
});

describe('content frame', () => {
  it('is the whole board when empty', () => {
    expect(contentFrame([])).toEqual({ x: 0, y: 0, width: 1, height: BOARD_ASPECT });
  });

  it('stays inside the board and within the aspect limits', () => {
    const layouts = [
      [{ x: 0.5, y: 0.3, scale: 0.95, rotation: 2 }],
      [
        { x: 0.1, y: 0.5, scale: 0.6, rotation: 0 },
        { x: 0.9, y: 0.5, scale: 0.6, rotation: 0 },
      ],
      [
        { x: 0.5, y: 0.05, scale: 0.5, rotation: 0 },
        { x: 0.5, y: 0.95, scale: 0.5, rotation: 0 },
      ],
      Object.values(ROLE_POSE),
    ];
    for (const pieces of layouts) {
      const f = contentFrame(pieces);
      expect(f.x).toBeGreaterThanOrEqual(-1e-9);
      expect(f.y).toBeGreaterThanOrEqual(-1e-9);
      expect(f.x + f.width).toBeLessThanOrEqual(1 + 1e-9);
      expect(f.y + f.height).toBeLessThanOrEqual(BOARD_ASPECT + 1e-9);
      const aspect = f.height / f.width;
      expect(aspect).toBeGreaterThanOrEqual(FRAME_MIN_ASPECT - 1e-9);
      expect(aspect).toBeLessThanOrEqual(FRAME_MAX_ASPECT + 1e-9);
    }
  });

  it('contains every piece’s centre', () => {
    const pieces = Object.values(ROLE_POSE);
    const f = contentFrame(pieces);
    for (const p of pieces) {
      expect(p.x).toBeGreaterThan(f.x);
      expect(p.x).toBeLessThan(f.x + f.width);
      expect(p.y * BOARD_ASPECT).toBeGreaterThan(f.y);
      expect(p.y * BOARD_ASPECT).toBeLessThan(f.y + f.height);
    }
  });
});
