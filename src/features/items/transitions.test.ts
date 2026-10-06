import type { ItemStatus } from './catalog';
import type { PlacedItem, WardrobeLite, ZoneLite } from './placement';
import {
  planBatch,
  planKindChange,
  planMove,
  planRehome,
  planStatus,
  refusalMessage,
  transitionRefusal,
  type PlacementContext,
} from './transitions';

const wardrobes: WardrobeLite[] = [
  { id: 'home', icon: 'home', sortOrder: 0 },
  { id: 'cabin', icon: 'home', sortOrder: 1 },
  { id: 'storage', icon: 'archive', sortOrder: 2 },
];
const zones: ZoneLite[] = [
  { id: 'h-rail', wardrobeId: 'home', type: 'rail', sortOrder: 0 },
  { id: 'h-shelf', wardrobeId: 'home', type: 'shelf', sortOrder: 1 },
  { id: 'c-rail', wardrobeId: 'cabin', type: 'rail', sortOrder: 0 },
  { id: 's-rail', wardrobeId: 'storage', type: 'rail', sortOrder: 0 },
];
const ctx: PlacementContext = { wardrobes, zones };
const now = new Date(2026, 9, 5, 9);
const earlier = new Date(2026, 9, 1, 12);

function piece(status: ItemStatus, more: Partial<PlacedItem & { id: string }> = {}): PlacedItem & { id: string } {
  return {
    id: `${status}-piece`,
    wardrobeId: status === 'storage' ? 'storage' : 'home',
    zoneId: status === 'storage' ? 's-rail' : 'h-rail',
    category: 'shirts',
    status,
    statusChangedAt: earlier,
    lentTo: status === 'lent' ? 'Nadia' : null,
    lentAt: status === 'lent' ? earlier : null,
    remindAt: null,
    readyAt: null,
    ...more,
  };
}

describe('transitionRefusal', () => {
  it('lets a piece in the wardrobe go anywhere', () => {
    for (const to of ['worn', 'laundry', 'dry_cleaner', 'lent', 'storage'] as const) {
      expect(transitionRefusal('in_wardrobe', to)).toBeNull();
    }
  });

  it('always lets a piece come back', () => {
    for (const from of ['worn', 'laundry', 'dry_cleaner', 'lent', 'storage'] as const) {
      expect(transitionRefusal(from, 'in_wardrobe')).toBeNull();
    }
  });

  it('refuses wearing, lending or storing what is in the wash or at the cleaner', () => {
    for (const to of ['worn', 'lent', 'storage'] as const) {
      expect(transitionRefusal('laundry', to)).toBe('in_wash');
      expect(transitionRefusal('dry_cleaner', to)).toBe('at_cleaner');
    }
  });

  it('refuses wearing or storing what someone else has, but not washing it once back', () => {
    expect(transitionRefusal('lent', 'worn')).toBe('with_borrower');
    expect(transitionRefusal('lent', 'storage')).toBe('with_borrower');
    expect(transitionRefusal('lent', 'laundry')).toBeNull();
    expect(transitionRefusal('worn', 'laundry')).toBeNull();
    expect(transitionRefusal('worn', 'storage')).toBeNull();
  });

  it('refuses no-ops, changes to archived pieces, and archiving without a reason', () => {
    expect(transitionRefusal('laundry', 'laundry')).toBe('unchanged');
    expect(transitionRefusal('archived', 'in_wardrobe')).toBe('archived');
    expect(transitionRefusal('worn', 'archived')).toBe('needs_reason');
    expect(transitionRefusal('lent', 'archived', { archivedReason: 'donated' })).toBeNull();
  });
});

describe('refusalMessage', () => {
  it('explains where the piece is', () => {
    const item = { name: 'Black tee', lentTo: 'Nadia' };
    expect(refusalMessage('in_wash', item, 'worn')).toBe('Black tee is in the wash');
    expect(refusalMessage('in_wash', item, 'storage')).toBe('Wash it before it goes into storage');
    expect(refusalMessage('with_borrower', item, 'storage')).toBe('Get it back from Nadia first');
    expect(refusalMessage('with_borrower', { ...item, lentTo: null }, 'worn')).toBe('Someone else has it');
  });
});

describe('planStatus', () => {
  it('returns only the columns that change', () => {
    const plan = planStatus(piece('laundry'), 'in_wardrobe', ctx, now);
    expect(plan).toEqual({ ok: true, patch: { status: 'in_wardrobe', statusChangedAt: now }, cancelReminder: false });
  });

  it('cancels the reminder when a lent piece comes back', () => {
    const plan = planStatus(piece('lent', { remindAt: now }), 'in_wardrobe', ctx, now);
    expect(plan).toMatchObject({
      ok: true,
      cancelReminder: true,
      patch: { status: 'in_wardrobe', lentTo: null, lentAt: null, remindAt: null },
    });
  });

  it('lends with a name and stamps the date', () => {
    expect(planStatus(piece('in_wardrobe'), 'lent', ctx, now, { lentTo: 'Jo' })).toMatchObject({
      ok: true,
      cancelReminder: false,
      patch: { status: 'lent', lentTo: 'Jo', lentAt: now, statusChangedAt: now },
    });
  });

  it('stamps the dry cleaner drop-off', () => {
    expect(planStatus(piece('worn'), 'dry_cleaner', ctx, now)).toMatchObject({
      ok: true,
      patch: { status: 'dry_cleaner', statusChangedAt: now },
    });
  });

  it('carries a piece into storage and back out', () => {
    expect(planStatus(piece('in_wardrobe'), 'storage', ctx, now)).toMatchObject({
      ok: true,
      patch: { wardrobeId: 'storage', zoneId: 's-rail', status: 'storage' },
    });
    expect(planStatus(piece('storage'), 'laundry', ctx, now)).toMatchObject({
      ok: true,
      patch: { wardrobeId: 'home', zoneId: 'h-rail', status: 'laundry' },
    });
  });

  it('refuses storage when there is no storage wardrobe', () => {
    const noStorage = { wardrobes: wardrobes.filter((w) => w.icon !== 'archive'), zones };
    expect(planStatus(piece('in_wardrobe'), 'storage', noStorage, now)).toEqual({ ok: false, refusal: 'no_storage' });
  });

  it('refuses what the table refuses', () => {
    expect(planStatus(piece('laundry'), 'worn', ctx, now)).toEqual({ ok: false, refusal: 'in_wash' });
  });
});

describe('planMove', () => {
  it('moves between everyday wardrobes without touching status', () => {
    expect(planMove(piece('laundry'), 'cabin', ctx, now)).toEqual({
      ok: true,
      patch: { wardrobeId: 'cabin', zoneId: 'c-rail' },
      cancelReminder: false,
    });
  });

  it('stores what moves into storage and un-stores what leaves it', () => {
    expect(planMove(piece('worn'), 'storage', ctx, now)).toMatchObject({ ok: true, patch: { status: 'storage' } });
    expect(planMove(piece('storage'), 'cabin', ctx, now)).toMatchObject({
      ok: true,
      patch: { wardrobeId: 'cabin', status: 'in_wardrobe' },
    });
  });

  it('won’t store a lent piece or move a piece where it already is', () => {
    expect(planMove(piece('lent'), 'storage', ctx, now)).toEqual({ ok: false, refusal: 'with_borrower' });
    expect(planMove(piece('in_wardrobe'), 'home', ctx, now)).toEqual({ ok: false, refusal: 'unchanged' });
  });
});

describe('planBatch (wash done)', () => {
  it('returns a whole basket with a single update', () => {
    const basket = ['a', 'b', 'c', 'd'].map((id, i) =>
      piece('laundry', { id, zoneId: i % 2 ? 'h-shelf' : 'h-rail', statusChangedAt: new Date(2026, 9, i + 1) }),
    );
    const plan = planBatch(basket, (item) => planStatus(item, 'in_wardrobe', ctx, now));
    expect(plan.updates).toEqual([
      { ids: ['a', 'b', 'c', 'd'], patch: { status: 'in_wardrobe', statusChangedAt: now } },
    ]);
    expect(plan.refused).toEqual([]);
  });

  it('reports refusals and collects reminders to cancel', () => {
    const plan = planBatch([piece('lent', { id: 'dress' }), piece('dry_cleaner', { id: 'trench' })], (item) =>
      planStatus(item, 'storage', ctx, now),
    );
    expect(plan.updates).toEqual([]);
    expect(plan.refused).toEqual([
      { id: 'dress', refusal: 'with_borrower' },
      { id: 'trench', refusal: 'at_cleaner' },
    ]);

    const back = planBatch([piece('lent', { id: 'dress' })], (item) => planStatus(item, 'in_wardrobe', ctx, now));
    expect(back.cancelReminders).toEqual(['dress']);
  });
});

describe('planRehome (deleting a wardrobe)', () => {
  const afterDelete: PlacementContext = { wardrobes: wardrobes.filter((w) => w.id !== 'cabin'), zones };

  it('moves every piece, sending what storage refuses to the everyday wardrobe', () => {
    const inCabin = [
      piece('in_wardrobe', { id: 'shirt', wardrobeId: 'cabin', zoneId: 'c-rail' }),
      piece('lent', { id: 'dress', wardrobeId: 'cabin', zoneId: 'c-rail' }),
    ];
    const plan = planRehome(inCabin, 'storage', afterDelete, now);
    expect(plan.refused).toEqual([]);
    expect(plan.updates).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          ids: ['shirt'],
          patch: expect.objectContaining({ wardrobeId: 'storage', status: 'storage' }),
        }),
        expect.objectContaining({ ids: ['dress'], patch: { wardrobeId: 'home', zoneId: 'h-rail' } }),
      ]),
    );
  });

  it('gives archived pieces a new wardrobe without changing their status', () => {
    const plan = planRehome([piece('archived', { id: 'old', wardrobeId: 'cabin' })], 'home', afterDelete, now);
    expect(plan.updates).toEqual([{ ids: ['old'], patch: { wardrobeId: 'home', zoneId: 'h-rail' } }]);
  });
});

describe('planKindChange', () => {
  it('stores what hangs in a wardrobe that becomes storage, and sends out pieces home', () => {
    const asStorage: PlacementContext = {
      wardrobes: wardrobes.map((w) => (w.id === 'cabin' ? { ...w, icon: 'archive' } : w)),
      zones,
    };
    const inCabin = [
      piece('in_wardrobe', { id: 'shirt', wardrobeId: 'cabin', zoneId: 'c-rail' }),
      piece('laundry', { id: 'tee', wardrobeId: 'cabin', zoneId: 'c-rail' }),
    ];
    const plan = planKindChange(inCabin, true, asStorage, now);
    expect(plan.refused).toEqual([]);
    expect(plan.updates).toEqual(
      expect.arrayContaining([
        { ids: ['shirt'], patch: { status: 'storage', statusChangedAt: now } },
        { ids: ['tee'], patch: { wardrobeId: 'home', zoneId: 'h-rail' } },
      ]),
    );
  });

  it('puts stored pieces back in use when storage becomes a wardrobe', () => {
    const asWardrobe: PlacementContext = {
      wardrobes: wardrobes.map((w) => (w.id === 'storage' ? { ...w, icon: 'home' } : w)),
      zones,
    };
    const plan = planKindChange([piece('storage', { id: 'coat' })], false, asWardrobe, now);
    expect(plan.updates).toEqual([{ ids: ['coat'], patch: { status: 'in_wardrobe', statusChangedAt: now } }]);
  });
});
