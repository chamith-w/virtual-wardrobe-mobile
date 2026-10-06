import {
  addFlow,
  batchLabel,
  currentShot,
  initialAddState,
  remaining,
  type AddAction,
  type AddState,
  type Shot,
} from './flow';

const shot = (id: string): Shot => ({ id, uri: `file:///${id}.jpg`, width: 3000, height: 4000, source: 'library' });
const piece = (id: string) => ({ id, name: id, thumbUri: null, wardrobeId: 'home', zoneId: null });
const run = (actions: AddAction[], from: AddState = initialAddState) => actions.reduce(addFlow, from);

describe('addFlow', () => {
  it('walks one photo from capture to saved and back to the camera', () => {
    let state = run([{ type: 'captured', shots: [shot('a')] }]);
    expect(state.step).toBe('cutout');
    expect(batchLabel(state)).toBeNull();
    state = run([{ type: 'details' }, { type: 'saved', piece: piece('a') }], state);
    expect(state.step).toBe('saved');
    expect(remaining(state)).toBe(0);
    state = addFlow(state, { type: 'next' });
    expect(state).toMatchObject({ step: 'capture', shots: [], index: 0 });
    expect(state.saved.map((p) => p.id)).toEqual(['a']);
  });

  it('works through a gallery batch, one photo at a time', () => {
    let state = run([{ type: 'captured', shots: [shot('a'), shot('b'), shot('c')] }]);
    expect(batchLabel(state)).toBe('1 of 3');
    expect(remaining(state)).toBe(2);
    state = run([{ type: 'details' }, { type: 'saved', piece: piece('a') }, { type: 'next' }], state);
    expect(state.step).toBe('cutout');
    expect(currentShot(state)?.id).toBe('b');
    expect(batchLabel(state)).toBe('2 of 3');
    state = run([{ type: 'skip' }], state);
    expect(currentShot(state)?.id).toBe('c');
    state = run([{ type: 'skip' }], state);
    expect(state.step).toBe('capture');
    expect(state.saved).toHaveLength(1);
  });

  it('goes back and forth between cutout and details', () => {
    const state = run([{ type: 'captured', shots: [shot('a')] }, { type: 'details' }, { type: 'back' }]);
    expect(state.step).toBe('cutout');
  });

  it('retake drops the batch', () => {
    const state = run([{ type: 'captured', shots: [shot('a'), shot('b')] }, { type: 'retake' }]);
    expect(state).toMatchObject({ step: 'capture', shots: [] });
  });

  it('ignores actions that make no sense in the current step', () => {
    expect(addFlow(initialAddState, { type: 'details' })).toBe(initialAddState);
    expect(addFlow(initialAddState, { type: 'captured', shots: [] })).toBe(initialAddState);
    const cutout = run([{ type: 'captured', shots: [shot('a')] }]);
    expect(addFlow(cutout, { type: 'saved', piece: piece('a') })).toBe(cutout);
    expect(addFlow(cutout, { type: 'next' })).toBe(cutout);
  });
});
