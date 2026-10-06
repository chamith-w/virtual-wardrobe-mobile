import { CATEGORIES, ITEM_STATUSES } from '@/features/items/catalog';
import { daysBetween, toDayKey } from '@/lib/dates';

import { buildDemoPlan, HISTORY_DAYS, SEED_GARMENTS, SEED_WISHLIST } from './demo-plan';

const TODAY = new Date(2026, 9, 5, 9, 30);
const plan = buildDemoPlan(TODAY);
const bySlug = new Map(plan.items.map((i) => [i.slug, i]));

describe('demo wardrobe', () => {
  it('has about 30 garments with unique slugs', () => {
    expect(plan.items.length).toBeGreaterThanOrEqual(30);
    expect(new Set(plan.items.map((i) => i.slug)).size).toBe(plan.items.length);
  });

  it('only uses known categories and statuses', () => {
    for (const item of plan.items) {
      expect(CATEGORIES).toContain(item.category);
      expect(ITEM_STATUSES).toContain(item.status);
    }
  });

  it('places every item in a zone of its own wardrobe', () => {
    const zones = new Map(plan.zones.map((z) => [z.key, z]));
    for (const item of plan.items) {
      const zone = zones.get(item.zoneKey);
      expect(zone).toBeDefined();
      expect(zone?.wardrobe).toBe(item.wardrobe);
    }
  });

  it('is deterministic for a given day and seed', () => {
    const again = buildDemoPlan(TODAY);
    expect(again.wearLogs).toEqual(plan.wearLogs);
    expect(again.items.map((i) => i.wearCount)).toEqual(plan.items.map((i) => i.wearCount));
  });
});

describe('generated wear history', () => {
  it('caches wearCount and lastWornAt exactly from the logs', () => {
    for (const item of plan.items) {
      const logs = plan.wearLogs.filter((l) => l.slugs.includes(item.slug));
      expect(item.wearCount).toBe(logs.length);
      const latest = logs.reduce<number | null>((min, l) => (min === null || l.daysAgo < min ? l.daysAgo : min), null);
      if (latest === null) expect(item.lastWornAt).toBeNull();
      else expect(item.lastWornAt && daysBetween(item.lastWornAt, TODAY)).toBe(latest);
    }
  });

  it('logs at most one outfit per day, within the history window', () => {
    const dates = plan.wearLogs.map((l) => l.date);
    expect(new Set(dates).size).toBe(dates.length);
    for (const log of plan.wearLogs) {
      expect(log.daysAgo).toBeGreaterThanOrEqual(0);
      expect(log.daysAgo).toBeLessThanOrEqual(HISTORY_DAYS);
      expect(new Set(log.slugs).size).toBe(log.slugs.length);
    }
  });

  it('never wears a piece before it joined the wardrobe', () => {
    for (const g of SEED_GARMENTS) {
      for (const log of plan.wearLogs.filter((l) => l.slugs.includes(g.slug))) {
        expect(log.daysAgo).toBeLessThanOrEqual(g.addedDaysAgo);
      }
    }
  });

  it('keeps "forgotten" pieces unworn for their rest period', () => {
    const forgotten = SEED_GARMENTS.filter((g) => g.restDays >= 90);
    expect(forgotten.length).toBeGreaterThanOrEqual(4);
    for (const g of forgotten) {
      const last = bySlug.get(g.slug)?.lastWornAt;
      if (last) expect(daysBetween(last, TODAY)).toBeGreaterThan(g.restDays);
    }
  });

  it("logs today's outfit for every piece marked worn", () => {
    const today = plan.wearLogs.find((l) => l.date === toDayKey(TODAY));
    const worn = plan.items.filter((i) => i.status === 'worn').map((i) => i.slug);
    expect(worn.length).toBeGreaterThan(0);
    expect(today?.slugs.sort()).toEqual(worn.sort());
  });

  it('wore laundry pieces recently', () => {
    for (const item of plan.items.filter((i) => i.status === 'laundry')) {
      expect(item.lastWornAt).not.toBeNull();
      expect(daysBetween(item.lastWornAt as Date, TODAY)).toBeLessThanOrEqual(7);
    }
  });
});

describe('outfits, plans and trips', () => {
  it('builds outfits only from existing pieces', () => {
    expect(plan.outfits.length).toBe(6);
    for (const o of plan.outfits) {
      expect(o.pieces.length).toBeGreaterThanOrEqual(3);
      for (const p of o.pieces) expect(bySlug.has(p.slug)).toBe(true);
    }
  });

  it('references known outfits and items from plans, trips and logs', () => {
    const outfitKeys = new Set(plan.outfits.map((o) => o.key));
    for (const p of plan.planned) expect(outfitKeys.has(p.outfitKey)).toBe(true);
    for (const e of plan.trip.entries) {
      expect(Boolean(e.slug) !== Boolean(e.outfitKey)).toBe(true);
      if (e.slug) expect(bySlug.has(e.slug)).toBe(true);
      if (e.outfitKey) expect(outfitKeys.has(e.outfitKey)).toBe(true);
    }
    for (const l of plan.wearLogs) if (l.outfitKey) expect(outfitKeys.has(l.outfitKey)).toBe(true);
  });

  it('plans upcoming days only', () => {
    for (const p of plan.planned) expect(p.date > toDayKey(TODAY)).toBe(true);
    expect(plan.trip.startDate <= plan.trip.endDate).toBe(true);
  });

  it('resolves wishlist colours from the palette', () => {
    expect(plan.wishlist.length).toBe(SEED_WISHLIST.length);
    for (const w of plan.wishlist) expect(w.colorsResolved.length).toBe(w.colors.length);
  });
});

describe('demo item states', () => {
  const today = new Date(2026, 9, 5, 9);
  const states = buildDemoPlan(today);

  it('dates every piece that is out, so the laundry and lent lists can sort them', () => {
    for (const item of states.items.filter((i) => i.status !== 'in_wardrobe')) {
      expect(item.statusChangedAt).toBeInstanceOf(Date);
    }
    for (const item of states.items.filter((i) => i.status === 'in_wardrobe')) {
      expect(item.statusChangedAt).toBeNull();
    }
  });

  it('drops the trench at the cleaner with a ready day ahead', () => {
    const trench = states.items.find((i) => i.status === 'dry_cleaner');
    expect(trench?.readyAt).toEqual(new Date(2026, 9, 8));
    expect(trench?.statusChangedAt?.getDate()).toBe(1);
    expect(states.items.filter((i) => i.readyAt !== null)).toHaveLength(1);
  });

  it('stamps lent pieces on the day they were lent', () => {
    for (const item of states.items.filter((i) => i.status === 'lent')) {
      expect(item.statusChangedAt).toEqual(item.lentAt);
    }
  });
});
