/**
 * The add flow as a reducer: capture → cutout → details → saved, looping
 * through a batch of gallery photos ("2 of 4"). Pure — safe to import from tests.
 */

export type Shot = {
  id: string;
  uri: string;
  width: number;
  height: number;
  source: 'camera' | 'library';
};

export type AddStep = 'capture' | 'cutout' | 'details' | 'saved';

/** What the saved screen needs to fly a new piece into its zone. */
export type SavedPiece = {
  id: string;
  name: string;
  thumbUri: string | null;
  wardrobeId: string;
  zoneId: string | null;
};

export type AddState = {
  step: AddStep;
  /** The photos being added; `index` is the one on screen. */
  shots: Shot[];
  index: number;
  /** Everything saved since the flow opened, newest last. */
  saved: SavedPiece[];
};

export type AddAction =
  | { type: 'captured'; shots: Shot[] }
  | { type: 'retake' }
  | { type: 'skip' }
  | { type: 'details' }
  | { type: 'back' }
  | { type: 'saved'; piece: SavedPiece }
  | { type: 'next' }
  | { type: 'again' };

export const initialAddState: AddState = { step: 'capture', shots: [], index: 0, saved: [] };

const toCapture = (state: AddState): AddState => ({ ...state, step: 'capture', shots: [], index: 0 });

/** Moves to the next photo of the batch, or back to the camera when it's done. */
const advance = (state: AddState): AddState =>
  state.index + 1 < state.shots.length ? { ...state, step: 'cutout', index: state.index + 1 } : toCapture(state);

export function addFlow(state: AddState, action: AddAction): AddState {
  switch (action.type) {
    case 'captured':
      return action.shots.length > 0 ? { ...state, step: 'cutout', shots: action.shots, index: 0 } : state;
    case 'retake':
      return state.step === 'cutout' ? toCapture(state) : state;
    case 'skip':
      return state.step === 'cutout' ? advance(state) : state;
    case 'details':
      return state.step === 'cutout' ? { ...state, step: 'details' } : state;
    case 'back':
      return state.step === 'details' ? { ...state, step: 'cutout' } : state;
    case 'saved':
      return state.step === 'details' ? { ...state, step: 'saved', saved: [...state.saved, action.piece] } : state;
    case 'next':
      return state.step === 'saved' ? advance(state) : state;
    case 'again':
      return toCapture(state);
  }
}

export function currentShot(state: AddState): Shot | null {
  return state.shots[state.index] ?? null;
}

/** "2 of 4" while working through a batch; null for a single photo. */
export function batchLabel(state: AddState): string | null {
  return state.shots.length > 1 ? `${state.index + 1} of ${state.shots.length}` : null;
}

/** Photos still waiting after the current one. */
export function remaining(state: AddState): number {
  return Math.max(0, state.shots.length - state.index - 1);
}
