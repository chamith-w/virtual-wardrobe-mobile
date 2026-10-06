import { boardKey, boardReducer, byZ, EMPTY_BOARD, normaliseZ, stepZ, type BoardPiece, type BoardState } from './board';

const pose = { x: 0.5, y: 0.5, scale: 1, rotation: 0 };
const piece = (itemId: string, z: number, over: Partial<BoardPiece> = {}): BoardPiece => ({
  itemId,
  z,
  locked: false,
  ...pose,
  ...over,
});
const order = (pieces: readonly BoardPiece[]) => byZ(pieces).map((p) => p.itemId);

const three: BoardState = boardReducer(EMPTY_BOARD, {
  type: 'load',
  pieces: [piece('coat', 0), piece('shirt', 1), piece('shoes', 2)],
});

describe('z-order', () => {
  it('renumbers any stacking to 0…n−1 without changing the order', () => {
    const z = normaliseZ([piece('a', 7), piece('b', -2), piece('c', 3)]);
    expect(z.map((p) => p.z)).toEqual([2, 0, 1]);
  });

  it('brings a piece forward one step', () => {
    const s = boardReducer(three, { type: 'forward', itemId: 'coat' });
    expect(order(s.pieces)).toEqual(['shirt', 'coat', 'shoes']);
    expect(s.pieces.map((p) => p.z).sort()).toEqual([0, 1, 2]);
  });

  it('sends a piece back one step', () => {
    const s = boardReducer(three, { type: 'backward', itemId: 'shoes' });
    expect(order(s.pieces)).toEqual(['coat', 'shoes', 'shirt']);
  });

  it('does nothing at either end of the stack', () => {
    expect(boardReducer(three, { type: 'forward', itemId: 'shoes' })).toBe(three);
    expect(boardReducer(three, { type: 'backward', itemId: 'coat' })).toBe(three);
    expect(stepZ(three.pieces, 'missing', 1)).toEqual(three.pieces);
  });

  it('puts new pieces on top and closes gaps when one leaves', () => {
    const added = boardReducer(three, { type: 'add', piece: { itemId: 'tote', locked: false, ...pose } });
    expect(order(added.pieces)).toEqual(['coat', 'shirt', 'shoes', 'tote']);
    const removed = boardReducer(added, { type: 'remove', itemId: 'shirt' });
    expect(order(removed.pieces)).toEqual(['coat', 'shoes', 'tote']);
    expect(removed.pieces.map((p) => p.z).sort()).toEqual([0, 1, 2]);
  });
});

describe('board actions', () => {
  it('never adds the same garment twice', () => {
    const s = boardReducer(three, { type: 'add', piece: { itemId: 'coat', locked: false, ...pose } });
    expect(s).toBe(three);
    const many = boardReducer(three, {
      type: 'addMany',
      pieces: [
        { itemId: 'coat', locked: false, ...pose },
        { itemId: 'tote', locked: false, ...pose },
        { itemId: 'tote', locked: false, ...pose },
      ],
    });
    expect(order(many.pieces)).toEqual(['coat', 'shirt', 'shoes', 'tote']);
  });

  it('moves, locks and swaps in place', () => {
    const moved = boardReducer(three, {
      type: 'pose',
      itemId: 'shirt',
      pose: { x: 0.2, y: 0.3, scale: 1.4, rotation: 9 },
    });
    expect(moved.pieces.find((p) => p.itemId === 'shirt')).toMatchObject({ x: 0.2, y: 0.3, scale: 1.4, rotation: 9 });
    const locked = boardReducer(moved, { type: 'toggleLock', itemId: 'shirt' });
    expect(locked.pieces.find((p) => p.itemId === 'shirt')?.locked).toBe(true);

    const swapped = boardReducer(locked, { type: 'swap', swaps: [{ from: 'shirt', to: 'blouse' }] });
    const blouse = swapped.pieces.find((p) => p.itemId === 'blouse');
    expect(blouse).toMatchObject({ x: 0.2, y: 0.3, scale: 1.4, rotation: 9, z: 1, locked: true });
  });

  it('refuses a swap that would duplicate a garment', () => {
    expect(boardReducer(three, { type: 'swap', swaps: [{ from: 'shirt', to: 'coat' }] })).toBe(three);
  });

  it('ignores a pose that changes nothing', () => {
    expect(boardReducer(three, { type: 'pose', itemId: 'coat', pose })).toBe(three);
  });
});

describe('undo', () => {
  it('steps back through changes', () => {
    let s = boardReducer(three, { type: 'forward', itemId: 'coat' });
    s = boardReducer(s, { type: 'remove', itemId: 'shoes' });
    s = boardReducer(s, { type: 'undo' });
    expect(order(s.pieces)).toEqual(['shirt', 'coat', 'shoes']);
    s = boardReducer(s, { type: 'undo' });
    expect(order(s.pieces)).toEqual(['coat', 'shirt', 'shoes']);
    expect(boardReducer(s, { type: 'undo' })).toBe(s);
  });

  it('starts fresh when an outfit loads, and skips no-ops', () => {
    expect(three.past).toEqual([]);
    expect(boardReducer(three, { type: 'forward', itemId: 'shoes' }).past).toEqual([]);
  });

  it('keeps a bounded history', () => {
    let s = three;
    for (let i = 0; i < 50; i++) s = boardReducer(s, { type: 'toggleLock', itemId: 'coat' });
    expect(s.past.length).toBe(30);
  });
});

describe('boardKey', () => {
  it('ignores list order but notices any saved change', () => {
    const a = [piece('a', 0), piece('b', 1)];
    expect(boardKey(a)).toBe(boardKey([a[1], a[0]]));
    expect(boardKey(a)).not.toBe(boardKey([piece('a', 0, { locked: true }), piece('b', 1)]));
  });
});
