/**
 * The outfit board's state: which pieces are on it, their poses, stacking
 * order and locks, with an undo stack. Pure — safe to import from tests.
 */
import type { NormalisedPose } from './canvas';

export type BoardPiece = NormalisedPose & {
  /** The garment; a piece appears on a board at most once. */
  itemId: string;
  /** Stacking order, 0 at the back; always 0…n−1. */
  z: number;
  /** Locked pieces stay put when shuffling. */
  locked: boolean;
};

export type BoardState = {
  pieces: BoardPiece[];
  /** Earlier boards, newest last. */
  past: BoardPiece[][];
};

export type BoardAction =
  /** Replace everything (opening an outfit); forgets the undo stack. */
  | { type: 'load'; pieces: BoardPiece[] }
  | { type: 'add'; piece: Omit<BoardPiece, 'z'> }
  | { type: 'remove'; itemId: string }
  | { type: 'pose'; itemId: string; pose: NormalisedPose }
  | { type: 'toggleLock'; itemId: string }
  | { type: 'forward'; itemId: string }
  | { type: 'backward'; itemId: string }
  /** Shuffle: swap garments in place, keeping each pose, z and lock. */
  | { type: 'swap'; swaps: { from: string; to: string }[] }
  /** Shuffle on an empty board: a whole starter outfit at once. */
  | { type: 'addMany'; pieces: Omit<BoardPiece, 'z'>[] }
  | { type: 'undo' };

const UNDO_LIMIT = 30;

export const EMPTY_BOARD: BoardState = { pieces: [], past: [] };

/** Back to front. */
export function byZ(pieces: readonly BoardPiece[]): BoardPiece[] {
  return [...pieces].sort((a, b) => a.z - b.z);
}

/** Renumbers stacking order to 0…n−1, keeping its sequence (ties keep list order). */
export function normaliseZ(pieces: readonly BoardPiece[]): BoardPiece[] {
  const rank = new Map(byZ(pieces).map((p, i) => [p.itemId, i]));
  return pieces.map((p) => (p.z === rank.get(p.itemId) ? p : { ...p, z: rank.get(p.itemId)! }));
}

/** Swaps a piece with the one just in front of it (`+1`) or just behind it (`−1`). No-op at the end of the stack. */
export function stepZ(pieces: readonly BoardPiece[], itemId: string, dir: 1 | -1): BoardPiece[] {
  const order = byZ(normaliseZ(pieces));
  const i = order.findIndex((p) => p.itemId === itemId);
  const j = i + dir;
  if (i < 0 || j < 0 || j >= order.length) return [...pieces];
  const a = order[i].itemId;
  const b = order[j].itemId;
  return normaliseZ(pieces).map((p) => {
    if (p.itemId === a) return { ...p, z: j };
    if (p.itemId === b) return { ...p, z: i };
    return p;
  });
}

export function isFront(pieces: readonly BoardPiece[], itemId: string): boolean {
  const order = byZ(pieces);
  return order.length > 0 && order[order.length - 1].itemId === itemId;
}

export function isBack(pieces: readonly BoardPiece[], itemId: string): boolean {
  const order = byZ(pieces);
  return order.length > 0 && order[0].itemId === itemId;
}

const samePose = (a: NormalisedPose, b: NormalisedPose) =>
  a.x === b.x && a.y === b.y && a.scale === b.scale && a.rotation === b.rotation;

/** The next board, or the same one when nothing changes. */
function apply(pieces: BoardPiece[], action: Exclude<BoardAction, { type: 'load' | 'undo' }>): BoardPiece[] {
  switch (action.type) {
    case 'add': {
      if (pieces.some((p) => p.itemId === action.piece.itemId)) return pieces;
      return [...normaliseZ(pieces), { ...action.piece, z: pieces.length }];
    }
    case 'addMany': {
      const fresh = action.pieces.filter(
        (p, i, all) => !pieces.some((q) => q.itemId === p.itemId) && all.findIndex((q) => q.itemId === p.itemId) === i,
      );
      if (fresh.length === 0) return pieces;
      return [...normaliseZ(pieces), ...fresh.map((p, i) => ({ ...p, z: pieces.length + i }))];
    }
    case 'remove': {
      if (!pieces.some((p) => p.itemId === action.itemId)) return pieces;
      return normaliseZ(pieces.filter((p) => p.itemId !== action.itemId));
    }
    case 'pose': {
      const target = pieces.find((p) => p.itemId === action.itemId);
      if (!target || samePose(target, action.pose)) return pieces;
      return pieces.map((p) => (p.itemId === action.itemId ? { ...p, ...action.pose } : p));
    }
    case 'toggleLock': {
      if (!pieces.some((p) => p.itemId === action.itemId)) return pieces;
      return pieces.map((p) => (p.itemId === action.itemId ? { ...p, locked: !p.locked } : p));
    }
    case 'forward':
    case 'backward': {
      const atEnd = action.type === 'forward' ? isFront(pieces, action.itemId) : isBack(pieces, action.itemId);
      if (atEnd || !pieces.some((p) => p.itemId === action.itemId)) return pieces;
      return stepZ(pieces, action.itemId, action.type === 'forward' ? 1 : -1);
    }
    case 'swap': {
      const to = new Map(action.swaps.map((s) => [s.from, s.to]));
      const next = pieces.map((p) => (to.has(p.itemId) ? { ...p, itemId: to.get(p.itemId)! } : p));
      // A swap may never put the same garment on the board twice.
      if (new Set(next.map((p) => p.itemId)).size !== next.length) return pieces;
      return next.some((p, i) => p.itemId !== pieces[i].itemId) ? next : pieces;
    }
  }
}

export function boardReducer(state: BoardState, action: BoardAction): BoardState {
  if (action.type === 'load') return { pieces: normaliseZ(action.pieces), past: [] };
  if (action.type === 'undo') {
    const previous = state.past[state.past.length - 1];
    return previous ? { pieces: previous, past: state.past.slice(0, -1) } : state;
  }
  const next = apply(state.pieces, action);
  if (next === state.pieces) return state;
  return { pieces: next, past: [...state.past, state.pieces].slice(-UNDO_LIMIT) };
}

/** A stable fingerprint of what Save writes, to tell whether the board has unsaved changes. */
export function boardKey(pieces: readonly BoardPiece[]): string {
  return JSON.stringify(
    [...pieces]
      .sort((a, b) => (a.itemId < b.itemId ? -1 : 1))
      .map((p) => [p.itemId, p.x, p.y, p.scale, p.rotation, p.z, p.locked]),
  );
}
